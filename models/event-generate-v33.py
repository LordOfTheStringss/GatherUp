#!/usr/bin/env python
# coding: utf-8

# In[1]:


# ─── CELL 1: Install ─────────────────────────────────────────────────────────
get_ipython().system('pip install -q onnx onnxscript')

import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader, Subset
from torch.utils.data import random_split
from torch.optim.swa_utils import AveragedModel, SWALR
from sklearn.preprocessing import LabelEncoder, MultiLabelBinarizer
import random, gc, ast, joblib

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Device: {device}")
torch.manual_seed(42)
np.random.seed(42)


# In[2]:


# ─── CELL 2: Load Data ───────────────────────────────────────────────────────
DATA_PATH = '/kaggle/input/datasets/keremkazandr/gatherup-dataset-v32'

df_group = pd.read_parquet(f'{DATA_PATH}/gatherup_group_generative.parquet')
df_users = pd.read_parquet(f'{DATA_PATH}/gatherup_users.parquet')

print(f"Original Group samples : {len(df_group):,}")
MAX_GROUP_SAMPLES = 450_000
if len(df_group) > MAX_GROUP_SAMPLES:
    df_group = df_group.sample(n=MAX_GROUP_SAMPLES, random_state=42).reset_index(drop=True)

print(f"Group samples : {len(df_group):,} (Sampled)")
print(f"Users         : {len(df_users):,}")
print(f"Columns       : {list(df_group.columns)}")

required_cols = [
    'avg_interests', 'interest_diversity', 'avg_longitude', 'avg_latitude',
    'participant_count', 'max_geo_spread', 'group_schedule', 'free_slots_score',
    'participants', 'target_subCategory', 'target_day', 'target_hour',
]
missing = [c for c in required_cols if c not in df_group.columns]
if missing:
    raise ValueError(f"❌ Missing columns: {missing}\nRun data_v32.py first.")
print("✅ All required columns present.")


# In[3]:


# ─── CELL 3: Label Encoding ──────────────────────────────────────────────────
cat_encoder = LabelEncoder()
day_encoder = LabelEncoder()

df_group['target_subCategory_encoded'] = cat_encoder.fit_transform(df_group['target_subCategory'])
df_group['target_day_encoded']         = day_encoder.fit_transform(df_group['target_day'])
df_group['target_hour_encoded']        = df_group['target_hour'].astype(int)

num_categories = len(cat_encoder.classes_)   # 52
num_days       = len(day_encoder.classes_)   # 7
num_hours      = 24

print(f"Categories: {num_categories} | Days: {num_days} | Hours: {num_hours}")


# In[4]:


# ─── CELL 4: Feature Engineering (TAM VE EKSİKSİZ) ───────────────────────────
MASTER_52 = sorted([
    "Volleyball","Basketball","Football","Tennis","Swimming","Running",
    "Yoga","Pilates","Fitness","Skateboarding","Cycling","Archery",
    "Mountaineering","Boxing","Table Tennis",
    "Software","Artificial Intelligence","Data Science","Cybersecurity",
    "Robotics","Game Development","Blockchain","Astronomy","Electronics",
    "Theater","Cinema","Concert","Dance","Painting","Sculpture",
    "Literature","Photography","Exhibition","Stand-up","Museums","Opera",
    "Camping","Chess","Reading","Food","Gastronomy","Gaming",
    "E-sports","Gardening","Travel","Foreign Languages","Collecting","Musical Instruments",
    "Volunteering","Networking","Career Days","Workshop",
])
SUBCAT_TO_IDX = {s: i for i, s in enumerate(MASTER_52)}

mlb = MultiLabelBinarizer(classes=MASTER_52)
mlb.fit([MASTER_52])

print("Building feature arrays...")

# ── avg_interests (52-dim) ────────────────────────────────────────────────
avg_interests = np.stack(df_group['avg_interests'].values).astype(np.float32)  # (N, 52)

# ── Scalar stats (6-dim) ─────────────────────────────────────────────────
from sklearn.preprocessing import StandardScaler
diversity  = df_group['interest_diversity'].values.reshape(-1, 1).astype(np.float32)
p_count    = np.log1p(df_group['participant_count'].values.reshape(-1, 1)).astype(np.float32)

# Koordinatlar, yayılım ve boş zaman skorunu scale et
raw_scalarsToScale = np.concatenate([
    df_group[['avg_longitude', 'avg_latitude']].values,
    df_group['max_geo_spread'].values.reshape(-1, 1),
    df_group['free_slots_score'].values.reshape(-1, 1)
], axis=1).astype(np.float32)

group_scalar_scaler = StandardScaler()
scaled_scalars = group_scalar_scaler.fit_transform(raw_scalarsToScale).astype(np.float32)
joblib.dump(group_scalar_scaler, "group_scalar_scaler.bin")

avg_loc    = scaled_scalars[:, 0:2]
geo_spread = scaled_scalars[:, 2:3]
free_score = scaled_scalars[:, 3:4]

# ❌ DİKKAT: interest_alignment (Data Leakage) SİLİNDİ!
# Compact scalar = 52 + 6 = 58-dim
scalar_compact = np.concatenate([
    avg_interests,       # 52
    diversity,           # 1
    avg_loc,             # 2
    p_count,             # 1
    geo_spread,          # 1
    free_score,          # 1
], axis=1).astype(np.float32)   # → (N, 58)

print(f"Compact scalar : {scalar_compact.shape}   (N x 58)")

# ── Full 168-dim schedule  ─────────────────────────────────────────────────
print("  Loading 168-dim schedule (for ScheduleAttentionEncoder)...")
all_schedules_raw = np.stack(df_group['group_schedule'].values).astype(np.float32)  # (N, 168)
print(f"Schedule matrix: {all_schedules_raw.shape}")

# ── Auxiliary label: is target slot free? ─────────────────────────────────
day_order  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
day_to_idx = {d: i for i, d in enumerate(day_order)}
target_slot_idx = np.array([
    day_to_idx.get(str(day), 0) * 24 + int(hour)
    for day, hour in zip(df_group['target_day'], df_group['target_hour'])
], dtype=np.int32)
group_free_at_target = all_schedules_raw[np.arange(len(df_group)), target_slot_idx]  # (N,)

# ── Target arrays ─────────────────────────────────────────────────────────
target_cat  = df_group['target_subCategory_encoded'].values.astype(np.int64)
target_day  = df_group['target_day_encoded'].values.astype(np.int64)
target_hour = df_group['target_hour_encoded'].values.astype(np.int64)

# ── IMPROVEMENT 5: Curriculum — sort by free_slots_score for Stage 1 ────
# Boş zamanı çok olan grupları tahmin etmek daha kolaydır.
free_scores_flat = df_group['free_slots_score'].values
free_median = float(np.median(free_scores_flat))
easy_idx = np.where(free_scores_flat >= free_median)[0]
print(f"Curriculum: {len(easy_idx):,} easy samples (free_score ≥ {free_median:.4f})")


# In[5]:


# ─── CELL 5: Dataset ─────────────────────────────────────────────────────────
import numpy as np

class GroupDatasetV33(Dataset):
    """
    Two inputs per sample:
      scalar  (58)  — compact features (Data leak silindiği için 59 -> 58 oldu)
      sched   (168) — full group schedule for ScheduleAttentionEncoder
    Four targets:
      cat, day, hour (main), free_at_target (auxiliary)
    """
    def __init__(self, scalar, schedule, t_cat, t_day, t_hour, free_at_target):
        self.scalar        = torch.tensor(scalar,        dtype=torch.float32)
        self.schedule      = torch.tensor(schedule,      dtype=torch.float32)
        self.target_cat    = torch.tensor(t_cat,         dtype=torch.long)
        self.target_day    = torch.tensor(t_day,         dtype=torch.long)
        self.target_hour   = torch.tensor(t_hour,        dtype=torch.long)
        self.free_at_target= torch.tensor(free_at_target,dtype=torch.float32)

    def __len__(self): return len(self.scalar)

    def __getitem__(self, idx):
        return (self.scalar[idx], self.schedule[idx],
                self.target_cat[idx], self.target_day[idx],
                self.target_hour[idx], self.free_at_target[idx])


full_dataset = GroupDatasetV33(
    scalar_compact, all_schedules_raw,
    target_cat, target_day, target_hour, group_free_at_target,
)

val_size   = int(len(full_dataset) * 0.10)
train_size = len(full_dataset) - val_size
train_ds, val_ds = random_split(full_dataset, [train_size, val_size],
                                 generator=torch.Generator().manual_seed(42))
print(f"Full dataset: {len(full_dataset):,} | Train: {train_size:,} | Val: {val_size:,}")

# IMPROVEMENT 5: Curriculum Stage 1 subset 
# ÇÖZÜM: Python List Comprehension yerine süper hızlı NumPy Kesişimi (Intersection) kullanıldı
train_indices_arr = np.array(train_ds.indices)
easy_train_indices = np.intersect1d(train_indices_arr, easy_idx).tolist()

easy_train_ds = Subset(full_dataset, easy_train_indices)
print(f"Curriculum easy subset: {len(easy_train_ds):,} samples")


# In[6]:


# ─── CELL 6: Model Architecture ──────────────────────────────────────────────

# ── IMPROVEMENT 1: Schedule Attention Encoder ─────────────────────────────
class ScheduleAttentionEncoder(nn.Module):
    """
    Treats the 168-dim schedule as a (7 days × 24 hours) grid.
    Day-level attention: finds which days the group is most free.
    Then produces a compact representation that captures temporal patterns.
    """
    def __init__(self, hour_dim=24, day_hidden=64, n_heads=4, output_dim=64):
        super().__init__()
        # Each day is a 24-dim free-probability vector
        self.day_proj  = nn.Linear(hour_dim, day_hidden)
        self.day_ln    = nn.LayerNorm(day_hidden)
        # Self-attention over 7 days
        self.day_attn  = nn.MultiheadAttention(day_hidden, n_heads,
                                                batch_first=True, dropout=0.1)
        self.post_attn_ln = nn.LayerNorm(day_hidden)
        # Output projection
        self.out_proj  = nn.Sequential(
            nn.Linear(day_hidden, output_dim),
            nn.LayerNorm(output_dim),
            nn.GELU(),
        )

    def forward(self, schedule_168):         # (B, 168)
        B    = schedule_168.size(0)
        sched = schedule_168.view(B, 7, 24)  # (B, 7, 24)

        # Project each day to day_hidden
        day_emb = self.day_ln(self.day_proj(sched))    # (B, 7, day_hidden)
        # Self-attention: days attend to each other
        attn_out, _ = self.day_attn(day_emb, day_emb, day_emb)  # (B, 7, day_hidden)
        attn_out = self.post_attn_ln(attn_out + day_emb)          # residual

        # Weight pooling: days with more free hours get higher weight
        free_per_day = sched.mean(dim=2, keepdim=True)            # (B, 7, 1)
        weighted     = (attn_out * free_per_day).sum(dim=1)        # (B, day_hidden)
        denom        = free_per_day.sum(dim=1).clamp(min=1e-8)     # (B, 1)
        pooled       = weighted / denom

        return self.out_proj(pooled)   # (B, output_dim)


# ── IMPROVEMENT 2: Group Interest Self-Attention ─────────────────────────
class GroupInterestAttention(nn.Module):
    """
    Applies self-attention over the group's 52-dim avg interest vector,
    treated as 52 tag-level activations. Tags attend to each other.
    """
    def __init__(self, num_tags=52, tag_dim=32, n_heads=4, output_dim=64):
        super().__init__()
        # +1 for padding position
        self.tag_emb  = nn.Embedding(num_tags + 1, tag_dim, padding_idx=0)
        nn.init.normal_(self.tag_emb.weight, std=0.05)
        self.attn     = nn.MultiheadAttention(tag_dim, n_heads,
                                               batch_first=True, dropout=0.1)
        self.proj     = nn.Sequential(
            nn.Linear(tag_dim, output_dim),
            nn.LayerNorm(output_dim),
            nn.GELU(),
        )

    def forward(self, avg_interests):      # (B, 52) — float, sum per tag ∈ [0,1]
        B = avg_interests.size(0)
        # All 52 tag indices (1-indexed; 0 = padding)
        all_idx  = torch.arange(1, 53, device=avg_interests.device
                                ).unsqueeze(0).expand(B, -1)         # (B, 52)
        tag_emb  = self.tag_emb(all_idx)                             # (B, 52, tag_dim)

        # Ignore near-zero tags in attention (treat as padding)
        key_pad  = (avg_interests < 0.01)                            # (B, 52)
        # Safety: if all zero, unblock everything
        all_zero = key_pad.all(dim=1, keepdim=True)
        key_pad  = key_pad & ~all_zero

        attn_out, _ = self.attn(tag_emb, tag_emb, tag_emb,
                                  key_padding_mask=key_pad)           # (B, 52, tag_dim)
        # Weighted mean pool by activation strength
        weights = avg_interests.unsqueeze(-1).clamp(min=0)           # (B, 52, 1)
        denom   = weights.sum(dim=1).clamp(min=1e-8)                 # (B, 1)
        pooled  = (attn_out * weights).sum(dim=1) / denom            # (B, tag_dim)
        return self.proj(pooled)                                      # (B, output_dim)


# ── IMPROVEMENT 3: Hierarchical Output Head ───────────────────────────────
class HierarchicalOutputHead(nn.Module):
    """
    Cat → Day → Hour with soft conditioning:
      day  logits are conditioned on soft cat predictions
      hour logits are conditioned on soft cat+day predictions
    This models the dependency: event type influences best weekday,
    which in turn influences best hour.
    """
    def __init__(self, hidden_dim, num_cat, num_day, num_hour):
        super().__init__()
        self.cat_head  = nn.Sequential(
            nn.Linear(hidden_dim, 256), nn.GELU(), nn.Dropout(0.1),
            nn.Linear(256, num_cat)
        )
        # Day: hidden + soft cat (num_cat) → 32 → num_day
        self.day_cond  = nn.Linear(num_cat, 32)
        self.day_head  = nn.Linear(hidden_dim + 32, num_day)

        # Hour: hidden + soft cat+day → 32 → num_hour
        self.hour_cond = nn.Linear(num_cat + num_day, 32)
        self.hour_head = nn.Linear(hidden_dim + 32, num_hour)

    def forward(self, h):
        cat_logits = self.cat_head(h)                                # (B, 52)

        cat_soft   = F.softmax(cat_logits.detach(), dim=-1)          # detach: no leakage
        day_ctx    = F.gelu(self.day_cond(cat_soft))                  # (B, 32)
        day_logits = self.day_head(torch.cat([h, day_ctx], dim=-1))  # (B, 7)

        day_soft   = F.softmax(day_logits.detach(), dim=-1)
        hour_in    = torch.cat([cat_soft, day_soft], dim=-1)         # (B, 52+7)
        hour_ctx   = F.gelu(self.hour_cond(hour_in))                  # (B, 32)
        hour_logits = self.hour_head(torch.cat([h, hour_ctx], dim=-1)) # (B, 24)

        return cat_logits, day_logits, hour_logits


# ── Full Group Model ──────────────────────────────────────────────────────
class GroupEventGeneratorV33(nn.Module):
    # DİKKAT: Boyut 7'den 6'ya düşürüldü (Data leak silindiği için)
    SCALAR_STAT_DIM = 6   # diversity+loc+pcount+geo+free

    def __init__(self, num_cat, num_day, num_hour):
        super().__init__()
        INTEREST_OUT = 64
        SCHEDULE_OUT = 64

        # IMPROVEMENT 2: Interest attention
        self.interest_enc = GroupInterestAttention(52, 32, 4, INTEREST_OUT)

        # Scalar stats encoder
        self.scalar_enc = nn.Sequential(
            nn.Linear(self.SCALAR_STAT_DIM, 64),
            nn.LayerNorm(64), nn.GELU(),
        )

        # IMPROVEMENT 1: Schedule attention
        self.schedule_enc = ScheduleAttentionEncoder(24, 64, 4, SCHEDULE_OUT)

        combined_dim = INTEREST_OUT + 64 + SCHEDULE_OUT  # 64+64+64 = 192

        # IMPROVEMENT 8: Larger shared trunk 192→512→256→128
        self.trunk = nn.Sequential(
            nn.Linear(combined_dim, 512), nn.LayerNorm(512), nn.GELU(), nn.Dropout(0.2),
            nn.Linear(512, 256),          nn.LayerNorm(256), nn.GELU(), nn.Dropout(0.15),
            nn.Linear(256, 128),          nn.LayerNorm(128), nn.GELU(),
        )
        # Skip connection from skip_in→128 for gradient flow
        self.skip_proj = nn.Linear(combined_dim, 128)

        # IMPROVEMENT 3: Hierarchical heads
        self.output_head = HierarchicalOutputHead(128, num_cat, num_day, num_hour)

        # Auxiliary: predict free-slot binary
        self.head_free = nn.Sequential(nn.Linear(128, 32), nn.GELU(), nn.Linear(32, 1))

    def encode(self, scalar_59, schedule_168):
        """Shared encoder → 128-dim representation."""
        interests = scalar_59[:, :52]                     # (B, 52)
        stats     = scalar_59[:, 52:]                     # (B, 7)

        i_emb  = self.interest_enc(interests)             # (B, 64)
        s_emb  = self.scalar_enc(stats)                   # (B, 64)
        sc_emb = self.schedule_enc(schedule_168)          # (B, 64)

        combined = torch.cat([i_emb, s_emb, sc_emb], dim=1)  # (B, 192)
        skip     = self.skip_proj(combined)               # (B, 128)
        h        = self.trunk(combined) + skip            # (B, 128)
        return h

    def forward(self, scalar_59, schedule_168):
        h = self.encode(scalar_59, schedule_168)
        cat_logits, day_logits, hour_logits = self.output_head(h)
        free_logit = self.head_free(h).squeeze(-1)        # (B,)
        return cat_logits, day_logits, hour_logits, free_logit


gen_model = GroupEventGeneratorV33(num_categories, num_days, num_hours).to(device)
total_params = sum(p.numel() for p in gen_model.parameters() if p.requires_grad)
print(f"\nGroupEventGeneratorV33 | params: {total_params:,}")
print(f"  InterestAttention (52→64) + ScalarStats (7→64) + ScheduleAttn (168→64)")
print(f"  Trunk: 192→512→256→128 + skip")
print(f"  HierarchicalHead: Cat→Day(|Cat)→Hour(|Cat,Day)")


# In[7]:


# ─── CELL 7: Loss & Metrics ──────────────────────────────────────────────────

# IMPROVEMENT 4: Label smoothing
ce_cat  = nn.CrossEntropyLoss(label_smoothing=0.10)   # 52 classes, smooth a lot
ce_day  = nn.CrossEntropyLoss(label_smoothing=0.05)
ce_hour = nn.CrossEntropyLoss(label_smoothing=0.05)
bce     = nn.BCEWithLogitsLoss()


def compute_loss(p_cat, p_day, p_hour, p_free, cat, day, hour, free_lbl):
    """Balanced multi-task loss."""
    l_cat  = ce_cat(p_cat,  cat)
    l_day  = ce_day(p_day,  day)
    l_hour = ce_hour(p_hour, hour)
    l_free = bce(p_free, free_lbl)
    return 1.5 * l_cat + 1.0 * l_day + 1.0 * l_hour + 0.5 * l_free


def topk_accuracy(logits, targets, k=1):
    _, pred = logits.topk(k, dim=1)
    correct = pred.eq(targets.unsqueeze(1)).any(dim=1).float()
    return correct.mean().item()


def run_epoch(loader, train=True):
    if train:
        gen_model.train()
    else:
        gen_model.eval()

    total_loss = 0.0
    cat1 = cat3 = cat5 = day1 = hour1 = n = 0

    ctx = torch.enable_grad() if train else torch.no_grad()
    with ctx:
        for scalar, schedule, cat, day, hour, free_lbl in loader:
            scalar   = scalar.to(device)
            schedule = schedule.to(device)
            cat      = cat.to(device)
            day      = day.to(device)
            hour     = hour.to(device)
            free_lbl = free_lbl.to(device)

            if train:
                optimizer.zero_grad()

            p_cat, p_day, p_hour, p_free = gen_model(scalar, schedule)
            loss = compute_loss(p_cat, p_day, p_hour, p_free, cat, day, hour, free_lbl)

            if train:
                loss.backward()
                torch.nn.utils.clip_grad_norm_(gen_model.parameters(), 1.0)
                optimizer.step()

            total_loss += loss.item()
            B = cat.size(0)
            # IMPROVEMENT 7: Top-k accuracy metrics
            cat1  += topk_accuracy(p_cat, cat, k=1)  * B
            cat3  += topk_accuracy(p_cat, cat, k=3)  * B
            cat5  += topk_accuracy(p_cat, cat, k=5)  * B
            day1  += topk_accuracy(p_day, day, k=1)  * B
            hour1 += topk_accuracy(p_hour, hour, k=1)* B
            n     += B

    return (total_loss / len(loader),
            cat1/n, cat3/n, cat5/n, day1/n, hour1/n)


# In[ ]:


# ─── CELL 8: Training — Curriculum + SWA ────────────────────────────────────
EPOCHS_S1 = 10    # Stage 1: easy samples only
EPOCHS_S2 = 40    # Stage 2: full dataset + hard samples
# FIX 2: Massive batch size increase + eliminate DataLoader multiprocessing overhead for pure RAM tensors
BATCH_S1  = 4096
BATCH_S2  = 4096
CKPT      = '/kaggle/working/best_group_model_v33.pth'

def make_loader(ds, batch_size, shuffle=True):
    # num_workers=0 is >10x faster for indexing big RAM matrices than sending indices over IPC
    return DataLoader(ds, batch_size=batch_size, shuffle=shuffle,
                      num_workers=0, pin_memory=False)

# ── Stage 1: Curriculum easy ─────────────────────────────────────────────
print("=" * 75)
print(f"STAGE 1 — Curriculum easy ({EPOCHS_S1} epochs | {len(easy_train_ds):,} samples)")
print("=" * 75)

optimizer = optim.AdamW(gen_model.parameters(), lr=1.5e-3, weight_decay=1e-4)
loader_s1 = make_loader(easy_train_ds, BATCH_S1, shuffle=True)
val_loader = make_loader(val_ds, BATCH_S2, shuffle=False)
sched_s1  = optim.lr_scheduler.OneCycleLR(optimizer, max_lr=1.5e-3,
                                            epochs=EPOCHS_S1,
                                            steps_per_epoch=len(loader_s1))
best_val = float('inf')

for epoch in range(EPOCHS_S1):
    tr_loss, tr_c1, tr_c3, tr_c5, tr_d1, tr_h1 = run_epoch(loader_s1, train=True)
    va_loss, va_c1, va_c3, va_c5, va_d1, va_h1 = run_epoch(val_loader,  train=False)
    for _ in range(len(loader_s1)):
        sched_s1.step()

    flag = ""
    if va_loss < best_val:
        best_val = va_loss
        torch.save(gen_model.state_dict(), CKPT)
        flag = " ⭐"

    print(f"S1 Ep {epoch+1:02d}/{EPOCHS_S1} | "
          f"Loss {tr_loss:.3f}/{va_loss:.3f} | "
          f"Cat@1:{va_c1:.3f} @3:{va_c3:.3f} @5:{va_c5:.3f} | "
          f"Day@1:{va_d1:.3f} | Hr@1:{va_h1:.3f}{flag}")

print(f"\n✅ Stage 1 done. Best val loss: {best_val:.4f}")

# ── Stage 2: Full dataset + SWA ──────────────────────────────────────────
print("\n" + "=" * 75)
print(f"STAGE 2 — Full dataset + SWA ({EPOCHS_S2} epochs | {train_size:,} samples)")
print("=" * 75)

gen_model.load_state_dict(torch.load(CKPT, map_location=device))

optimizer  = optim.AdamW(gen_model.parameters(), lr=1e-3, weight_decay=1e-4)
loader_s2  = make_loader(train_ds, BATCH_S2, shuffle=True)
sched_s2   = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS_S2)

# IMPROVEMENT 6: SWA
swa_model     = AveragedModel(gen_model)
swa_scheduler = SWALR(optimizer, swa_lr=1e-4, anneal_epochs=10)
swa_started   = False

for epoch in range(EPOCHS_S2):
    tr_loss, tr_c1, tr_c3, tr_c5, tr_d1, tr_h1 = run_epoch(loader_s2, train=True)
    va_loss, va_c1, va_c3, va_c5, va_d1, va_h1 = run_epoch(val_loader,  train=False)

    use_swa = (epoch >= EPOCHS_S2 - 10)
    if use_swa:
        swa_model.update_parameters(gen_model)
        swa_scheduler.step()
        swa_started = True
    else:
        sched_s2.step()

    flag = ""
    if va_loss < best_val:
        best_val = va_loss
        torch.save(gen_model.state_dict(), CKPT)
        flag = " ⭐"

    swa_tag = " [SWA]" if use_swa else ""
    print(f"S2 Ep {epoch+1:02d}/{EPOCHS_S2} | "
          f"Loss {tr_loss:.3f}/{va_loss:.3f} | "
          f"Cat@1:{va_c1:.3f} @3:{va_c3:.3f} @5:{va_c5:.3f} | "
          f"Day@1:{va_d1:.3f} | Hr@1:{va_h1:.3f}{flag}{swa_tag}")

# Finalize SWA BN stats
if swa_started:
    print("\nFinalizing SWA BN statistics...")
    torch.optim.swa_utils.update_bn(loader_s2, swa_model, device=device)
    torch.save(swa_model.state_dict(), '/kaggle/working/swa_group_model_v33.pth')
    print("SWA model saved.")

print("\n✅ Training complete!")
print(f"  Best individual model val loss: {best_val:.4f}")

# Load best model for inference
gen_model.load_state_dict(torch.load(CKPT, map_location=device))
gen_model.eval()


# In[ ]:


# ─── CELL 9: Accuracy Summary ────────────────────────────────────────────────
print("\n📊 Final Validation Metrics:")
va_loss, va_c1, va_c3, va_c5, va_d1, va_h1 = run_epoch(val_loader, train=False)

baselines = {
    'Category (52 cls)': 1/52,
    'Day (7 cls)'      : 1/7,
    'Hour (24 cls)'    : 1/24,
}
print(f"  {'Metric':<25} {'Random':>8}  {'Model':>8}")
print(f"  {'-'*45}")
print(f"  {'Cat Top-1':<25} {1/52:>8.3f}  {va_c1:>8.3f}")
print(f"  {'Cat Top-3':<25} {3/52:>8.3f}  {va_c3:>8.3f}")
print(f"  {'Cat Top-5':<25} {5/52:>8.3f}  {va_c5:>8.3f}")
print(f"  {'Day Top-1':<25} {1/7:>8.3f}  {va_d1:>8.3f}")
print(f"  {'Hour Top-1':<25} {1/24:>8.3f}  {va_h1:>8.3f}")


# In[ ]:


# ─── CELL 10: Inference — Suggest Event ──────────────────────────────────────
user_interest_map = dict(zip(df_users['userId'], df_users['interestTags']))

# HATA GİDERİCİ: infer_model'i güvenli bir şekilde tanımla
if 'swa_model' in locals():
    infer_model = swa_model
    print("Using SWA model for inference.")
else:
    # SWA yoksa en iyi kaydedilen modeli yükle
    gen_model.load_state_dict(torch.load(CKPT, map_location=device))
    infer_model = gen_model
    print(f"Using best checkpoint for inference: {CKPT}")

def suggest_event(sample_idx=None):
    infer_model.eval()
    if sample_idx is None:
        sample_idx = random.randint(0, len(full_dataset) - 1)

    scalar_t, schedule_t, _, _, _, _ = full_dataset[sample_idx]
    group_row    = df_group.iloc[sample_idx]
    participants = group_row['participants']

    with torch.no_grad():
        s_inp = scalar_t.unsqueeze(0).to(device)
        sc_inp = schedule_t.unsqueeze(0).to(device)

        # SWA wrapper kontrolü
        try:
            p_cat, p_day, p_hour, _ = infer_model(s_inp, sc_inp)
        except AttributeError:
            p_cat, p_day, p_hour, _ = infer_model.module(s_inp, sc_inp)

        day_probs  = torch.softmax(p_day,  dim=1).cpu().numpy()[0]   # (7,)
        hour_probs = torch.softmax(p_hour, dim=1).cpu().numpy()[0]   # (24,)
        weekly_mask = schedule_t.cpu().numpy().reshape(7, 24)        # (7, 24)

        # ── POST-PROCESSING (BUSINESS LOGIC) ──
        # 1. Ham olasılık matrisini oluştur (7x24)
        raw_scores = np.outer(day_probs, hour_probs)

        # 2. Soft Masking: Kesip atmak yerine grubun müsaitlik oranıyla çarp
        masked_scores = raw_scores * weekly_mask

        # 3. Zaman Bonusu Matrisi (İnsan davranışına uygun saatleri teşvik et)
        time_bonus = np.ones((7, 24), dtype=np.float32)

        # Hafta içi akşam saatleri (18:00 - 22:00) için %20 bonus
        time_bonus[0:5, 18:23] = 1.20
        # Hafta sonu öğleden sonra ve akşam (12:00 - 22:00) için %30 bonus
        time_bonus[5:7, 12:23] = 1.30
        # Gece yarısı ve sabaha karşı saatleri (01:00 - 08:00) cezalandır (%80 kesinti)
        time_bonus[:, 1:9] = 0.20

        final_scores = masked_scores * time_bonus

        # En iyi zaman dilimini bul
        max_val  = np.max(final_scores)
        best_idx = int(np.argmax(final_scores)) if max_val > 0 else int(np.argmax(raw_scores))
        d_res, h_res = divmod(best_idx, 24)

        # Top-3 Kategoriler
        top3_cat_idx = torch.topk(p_cat, 3, dim=1).indices[0].cpu().numpy()
        top3_cats    = cat_encoder.inverse_transform(top3_cat_idx)
        pred_day     = day_encoder.inverse_transform([d_res])[0]

    output = []
    output.append("=" * 70)
    output.append(f"GROUP (idx={sample_idx} | n={len(participants)})")
    output.append("-" * 30)
    for uid in participants[:6]:
        tags    = user_interest_map.get(uid, [])
        tag_str = ", ".join(tags[:4]) if isinstance(tags, list) else str(tags)
        output.append(f"  {uid[:8]}… : {tag_str}")
    output.append("-" * 30)
    output.append(f"TOP-3 CATEGORIES  : {' | '.join(top3_cats)}")
    output.append(f"SUGGESTED TIME    : {pred_day}, {h_res:02d}:00")
    output.append(f"GROUP FREE SCORE  : {float(group_row['free_slots_score']):.3f}")
    output.append("=" * 70)
    print("\n".join(output))

# Test et
suggest_event()


# In[ ]:


# ─── CELL 11 GÜNCELLEMESİ: ONNX Export (CPU Fix) ─────────────────────────────
import onnx

cpu_device = torch.device('cpu')

# SWA içermeyen ana modeli CPU'ya yükle
onnx_base = GroupEventGeneratorV33(num_categories, num_days, num_hours).to(cpu_device)
onnx_base.load_state_dict(torch.load(CKPT, map_location=cpu_device))
onnx_base.eval()

# DİKKAT: Data leak kapandığı için bu değer 58 oldu
SCALAR_DIM = 58  

class GroupModelInference(nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m
    def forward(self, scalar, schedule):
        p_cat, p_day, p_hour, _ = self.m(scalar, schedule)
        return p_cat, p_day, p_hour

export_model  = GroupModelInference(onnx_base).to(cpu_device).eval()
dummy_scalar  = torch.randn(1, SCALAR_DIM).to(cpu_device)
dummy_sched   = torch.randn(1, 168).to(cpu_device)

print("Exporting ONNX model (CPU Mode)...")
torch.onnx.export(
    export_model, (dummy_scalar, dummy_sched),
    "/kaggle/working/gatherup_group_model_v33.onnx",
    export_params=True, opset_version=18, do_constant_folding=True,
    input_names=['scalar_input', 'schedule_input'],
    output_names=['category_logits', 'day_logits', 'hour_logits'],
    dynamic_axes={
        'scalar_input':    {0: 'batch'},
        'schedule_input':  {0: 'batch'},
        'category_logits': {0: 'batch'},
        'day_logits':      {0: 'batch'},
        'hour_logits':     {0: 'batch'},
    }
)

m_onnx = onnx.load("/kaggle/working/gatherup_group_model_v33.onnx")
onnx.save_model(m_onnx, "/kaggle/working/gatherup_group_model_v33_final.onnx",
                save_as_external_data=False, all_tensors_to_one_file=True)

print(f"✅ ONNX exported successfully!")
print(f"   Inputs : scalar_input ({SCALAR_DIM}-dim) + schedule_input (168-dim)")
print(f"   Outputs: category_logits (52) | day_logits (7) | hour_logits (24)")

joblib.dump(cat_encoder, '/kaggle/working/cat_encoder_v33.bin')
joblib.dump(day_encoder, '/kaggle/working/day_encoder_v33.bin')
print("✅ Label encoders saved.")


# In[ ]:


# ─── CELL 12: Export Assets to JSON & ZIP (for TS Backend) ───
import joblib
import json
import os
import zipfile

# Dönüştürülecek dosyaların listesi
bin_files = [
    "group_scalar_scaler.bin",
    "cat_encoder_v33.bin",
    "day_encoder_v33.bin"
]

print("🚀 JSON dönüşüm işlemi başlatılıyor...\n")

for bin_file in bin_files:
    if os.path.exists(bin_file):
        # Dosyayı yükle
        obj = joblib.load(bin_file)
        json_file = bin_file.replace(".bin", ".json")

        # 1. Eğer nesne bir StandardScaler ise (group_scalar_scaler)
        if hasattr(obj, "mean_") and hasattr(obj, "scale_"):
            data = {
                "mean": obj.mean_.tolist(),
                "scale": obj.scale_.tolist()
            }
        # 2. Eğer nesne bir LabelEncoder ise (cat ve day encoder'lar)
        elif hasattr(obj, "classes_"):
            # Sınıfları liste olarak alıyoruz. (İndeks 0 -> Listenin 0. elemanı)
            data = obj.classes_.tolist()
        else:
            print(f"⚠️ Uyarı: {bin_file} formatı tanınamadı, atlanıyor.")
            continue

        # JSON olarak kaydet
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        size = os.path.getsize(json_file) / 1024
        print(f"✅ Dönüştürüldü: {bin_file:25s} -> {json_file:25s} ({size:.2f} KB)")
    else:
        print(f"❌ Hata: {bin_file} dosyası bulunamadı!")

print("\n📦 Dosyalar Zipleniyor...")

# TS Backend için gereken tüm dosyaları (JSON'lar ve ONNX) paketle
files_to_zip = [
    "gatherup_group_model_v33_final.onnx",
    "group_scalar_scaler.json",
    "cat_encoder_v33.json",
    "day_encoder_v33.json"
]

zip_name = "Group_Generator_TS_Assets.zip"

with zipfile.ZipFile(zip_name, 'w') as zipf:
    for file in files_to_zip:
        if os.path.exists(file):
            zipf.write(file)
            print(f"  + Eklendi: {file}")
        else:
            print(f"  ⚠️ Atlandı: {file} (Bulunamadı)")

print(f"\n🎉 İşlem Tamam! Sağdaki 'Output' panelini yenileyerek '{zip_name}' dosyasını indirebilirsin.")

