#!/usr/bin/env python
# coding: utf-8

# # 🗼 GatherUp — Two-Tower Recommender
# 
# ## NCF'ten farkı ne?
# 
# ```
# NCF (eski):
#   user_idx + event_idx → MLP → skor
#   Problem: Her user-event çifti için ayrı forward pass → 10k user × 50k event = 500M işlem
# 
# Two-Tower (yeni):
#   User Tower:  user_emb → [Linear layers] → user_vec  (128-dim)
#   Event Tower: event_emb → [Linear layers] → event_vec (128-dim)
#   Skor: cosine_similarity(user_vec, event_vec)
# 
#   Production'da:
#   - Tüm event_vec'leri bir kez hesapla → FAISS index'e yükle
#   - Yeni user gelince: user_vec hesapla → FAISS.search() → top-K event (milisaniye)
# ```
# 
# ## Loss Fonksiyonu: InfoNCE (Contrastive)
# 
# ```
# Batch içinde N örnek var.
# Her user için: 1 pozitif event (gerçekten etkileşim), N-1 negatif event (diğer batch örnekleri)
# Model şunu öğreniyor: "Bu user'ın vektörü, kendi event'ine yakın — diğerlerine uzak olsun"
# 
# Bu loss'u kullanan sistemler: Google, YouTube, Spotify, CLIP (OpenAI)
# ```

# In[1]:


# ─── CELL 1: Install ─────────────────────────────────────────────────────────
get_ipython().system('pip install -q pandas numpy torch scikit-learn pyarrow faiss-cpu onnxscript')
print("✅ Libraries ready.")


# In[2]:


# ─── CELL 2: Imports ─────────────────────────────────────────────────────────
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, random_split
from torch.optim.swa_utils import AveragedModel, SWALR
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import MultiLabelBinarizer, StandardScaler

import faiss
import ast, os, random, pickle, joblib

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Device: {device}")
torch.manual_seed(42)
np.random.seed(42)


# In[3]:


# ─── CELL 3: Config ──────────────────────────────────────────────────────────
MAX_HIST  = 10      # Geçmiş 10 etkinliğe odaklanılacak şekilde güncellendi
TAG_DIM   = 64      # 32 -> 64 to give more capacity to distinct tags
SUBCAT_EMB_DIM = 128 # 64 -> 128 (matches OUT_DIM) so subcategory completely drives the event vector
OUT_DIM   = 128     # 64 → 128

EPOCHS_S1 = 25      # Stage 1: easy curriculum (small batches, standard InfoNCE)
EPOCHS_S2 = 100      # Stage 2: hard negatives + large batches
BATCH_S1  = 1024
BATCH_S2  = 2048
SWA_START = EPOCHS_S1 + EPOCHS_S2 - 25   # Start SWA in last 10 epochs of S2


# In[4]:


# ─── CELL 4: Load Data ───────────────────────────────────────────────────────
import pandas as pd
import numpy as np
import os

DATA_PATH = '/kaggle/input/datasets/keremkazandr/gatherup-dataset-v32'
TELEMETRY_PATH = f'{DATA_PATH}/real_telemetry.parquet'

df_users        = pd.read_parquet(f'{DATA_PATH}/gatherup_users.parquet')
df_events       = pd.read_parquet(f'{DATA_PATH}/gatherup_events.parquet')

# TAVSİYE 3: Gerçek Telemetri Verisine Geçiş Altyapısı
if os.path.exists(TELEMETRY_PATH):
    print("🟢 Gerçek telemetri verisi bulundu. Fine-Tuning moduna geçiliyor.")
    df_interactions = pd.read_parquet(TELEMETRY_PATH)
else:
    print("🟡 Sentetik etkileşim verisi kullanılıyor.")
    df_interactions = pd.read_parquet(f'{DATA_PATH}/gatherup_interactions.parquet')

    print(f"Original interactions: {len(df_interactions):,}")
    # Downsample data to massively speed up training. Synthetic data plateaus early anyway.
    MAX_INTERACTIONS = 500_000
    if len(df_interactions) > MAX_INTERACTIONS:
        df_interactions = df_interactions.sample(n=MAX_INTERACTIONS, random_state=42).reset_index(drop=True)

print(f"✅ {len(df_users):,} users | {len(df_events):,} events | {len(df_interactions):,} interactions (Sampled)")
print(f"Label dist  : {df_interactions['label'].value_counts().to_dict()}")
print(f"MatchType   : {df_interactions['matchType'].value_counts().to_dict()}")


# In[5]:


# ─── CELL 5: Feature Engineering ─────────────────────────────────────────────
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
assert len(MASTER_52) == 52
NUM_SUBCATS   = 52
SUBCAT_TO_IDX = {s: i for i, s in enumerate(MASTER_52)}

UPPER_CATEGORIES = ["Sports","Technology_Science","Arts_Culture","Hobbies_Lifestyle","Social_Career"]

user_mapping  = {uid: i for i, uid in enumerate(df_users['userId'].unique())}
event_mapping = {eid: i for i, eid in enumerate(df_events['eventId'].unique())}

mlb = MultiLabelBinarizer(classes=MASTER_52)
mlb.fit([MASTER_52])

# ── Event features ────────────────────────────────────────────────────────
df_e_indexed = df_events.set_index('eventId').loc[list(event_mapping.keys())].copy()

# TAVSİYE 1: Sentetik Veriye "Gürültü" (Noise) Eklemek
print("🔧 Veri çeşitliliğini artırmak için koordinat ve sürelere gürültü ekleniyor...")
noise_lat = np.random.uniform(-0.005, 0.005, size=len(df_e_indexed))
noise_lon = np.random.uniform(-0.005, 0.005, size=len(df_e_indexed))
df_e_indexed['latitude'] += noise_lat
df_e_indexed['longitude'] += noise_lon

noise_dur = np.random.randint(-15, 16, size=len(df_e_indexed))
df_e_indexed['durationMins'] = (df_e_indexed['durationMins'] + noise_dur).clip(lower=15)

event_subcat_idx = np.array(
    [SUBCAT_TO_IDX.get(str(s), 0) for s in df_e_indexed['subCategory']], dtype=np.int64
)
event_subcat_tensor = torch.tensor(event_subcat_idx, dtype=torch.long)

event_coord_scaler  = StandardScaler()
event_coords_raw    = df_e_indexed[['latitude','longitude']].values.astype(np.float32)
event_coords_scaled = event_coord_scaler.fit_transform(event_coords_raw).astype(np.float32)
joblib.dump(event_coord_scaler, "event_coord_scaler.bin")

event_durs_raw  = df_e_indexed['durationMins'].values.reshape(-1, 1).astype(np.float32)
event_dur_scaler = StandardScaler()
event_durs_scaled = event_dur_scaler.fit_transform(event_durs_raw).astype(np.float32)
joblib.dump(event_dur_scaler, "event_dur_scaler.bin")

event_start = pd.to_datetime(df_e_indexed['startTime'])
hours       = (event_start.dt.hour + event_start.dt.minute / 60.0).values
event_sin   = np.sin(2 * np.pi * hours / 24.0).reshape(-1, 1).astype(np.float32)
event_cos   = np.cos(2 * np.pi * hours / 24.0).reshape(-1, 1).astype(np.float32)
event_dow   = event_start.dt.dayofweek.values.astype(np.float32)
event_dow_sin = np.sin(2 * np.pi * event_dow / 7.0).reshape(-1, 1).astype(np.float32)
event_dow_cos = np.cos(2 * np.pi * event_dow / 7.0).reshape(-1, 1).astype(np.float32)

# 7-dim: coord(2) + dur(1) + hour_cyc(2) + dow_cyc(2)
event_numeric = np.concatenate([
    event_coords_scaled, event_durs_scaled, event_sin, event_cos, event_dow_sin, event_dow_cos
], axis=1).astype(np.float32)
event_numeric_tensor = torch.tensor(event_numeric, dtype=torch.float32)

# Raw coords for geo-loss
event_lons_raw = df_e_indexed['longitude'].values.astype(np.float32)
event_lats_raw = df_e_indexed['latitude'].values.astype(np.float32)

print(f"Event subcat idx : {event_subcat_tensor.shape}")
print(f"Event numeric    : {event_numeric_tensor.shape}  (7-dim)")

# ── User features ─────────────────────────────────────────────────────────
df_u_indexed = df_users.set_index('userId').loc[list(user_mapping.keys())]

def clean_interests(tag_list):
    if isinstance(tag_list, str):
        try:    tag_list = ast.literal_eval(tag_list)
        except: tag_list = [tag_list]
    return tag_list if isinstance(tag_list, list) else []

cleaned_tags = df_u_indexed['interestTags'].apply(clean_interests)

# Separate interests (52-dim binary) from context (cluster+coords)
user_interests_binary = mlb.transform(cleaned_tags).astype(np.float32)  # (N, 52)
user_interests_tensor = torch.tensor(user_interests_binary, dtype=torch.float32)

def archetype_to_bits(arch):
    return [1 if arch == cat else 0 for cat in UPPER_CATEGORIES]

cluster_bits = np.array(
    df_u_indexed['archetype'].apply(archetype_to_bits).tolist(), dtype=np.float32
)  # (N, 5)

user_coord_scaler   = StandardScaler()
user_coords_raw     = df_u_indexed[['longitude','latitude']].values.astype(np.float32)
user_coords_scaled  = user_coord_scaler.fit_transform(user_coords_raw).astype(np.float32)  # (N, 2)
joblib.dump(user_coord_scaler, "user_coord_scaler.bin")

user_context_matrix = np.concatenate([cluster_bits, user_coords_scaled], axis=1)  # (N, 7)
user_context_tensor = torch.tensor(user_context_matrix, dtype=torch.float32)

# Raw coords for geo-loss
user_lons_raw = df_u_indexed['longitude'].values.astype(np.float32)
user_lats_raw = df_u_indexed['latitude'].values.astype(np.float32)

print(f"User interests : {user_interests_tensor.shape}  (52-dim binary)")
print(f"User context   : {user_context_tensor.shape}    (7-dim: cluster+coords)")

# ── User history as SEQUENCE (N, MAX_HIST, 7) ─────────────
pos_interactions = df_interactions[df_interactions['label'] == 1]
user_past_events = pos_interactions.groupby('userId')['eventId'].apply(list).to_dict()
event_numeric_map = {eid: feat for eid, feat in zip(df_e_indexed.index, event_numeric)}

print(f"Building history sequences (MAX_HIST={MAX_HIST})...")

def get_history_sequence(user_id):
    past_eids = user_past_events.get(user_id, [])
    valid     = [(eid, event_numeric_map[eid]) for eid in past_eids if eid in event_numeric_map]
    if not valid:
        return np.zeros((MAX_HIST, 7), dtype=np.float32), 0
    # Take most recent MAX_HIST events
    valid  = valid[-MAX_HIST:]
    length = len(valid)
    seq    = np.zeros((MAX_HIST, 7), dtype=np.float32)
    for i, (_, feat) in enumerate(valid):
        seq[i] = feat
    return seq, length

history_seqs, history_lens = [], []
for uid in user_mapping.keys():
    seq, length = get_history_sequence(uid)
    history_seqs.append(seq)
    history_lens.append(length)

user_history_seq_tensor = torch.tensor(np.stack(history_seqs), dtype=torch.float32)  # (N, MAX_HIST, 7)
user_history_len_tensor = torch.tensor(history_lens, dtype=torch.long)               # (N,)
print(f"User history seq : {user_history_seq_tensor.shape}")
print(f"  Avg hist length: {np.mean(history_lens):.1f} | Max: {np.max(history_lens)}")

# Derived signals for gate
user_counts    = np.array([len(user_past_events.get(uid, [])) for uid in user_mapping.keys()],
                           dtype=np.float32).reshape(-1, 1)
user_count_tensor  = torch.tensor(np.log1p(user_counts), dtype=torch.float32)
user_hist_norm_raw = np.linalg.norm(
    user_history_seq_tensor.numpy().reshape(len(user_mapping), -1), axis=1, keepdims=True
).astype(np.float32)
user_hist_norm_t = torch.tensor(np.log1p(user_hist_norm_raw), dtype=torch.float32)

print(f"User count     : {user_count_tensor.shape}")
print(f"User hist_norm : {user_hist_norm_t.shape}")
print("\n✅ All feature matrices ready!")

# Sanity: event numeric cosine
from sklearn.metrics.pairwise import cosine_similarity as cos_sim_sk
sim_num = cos_sim_sk(event_numeric[:1000])
np.fill_diagonal(sim_num, 0)
print(f"Event numeric avg cosine: {sim_num.mean():.4f}  (pre-training sanity check)")


# In[6]:


# ─── CELL 6: Model Architecture ──────────────────────────────────────────────

# ── ÇÖZÜM 1: Interest Self-Attention Encoder (Max Pooling İyileştirmeli) ──
class InterestAttentionEncoder(nn.Module):
    """
    Kullanıcının ilgi alanlarını alır, Self-Attention uygular 
    ve Mean Pooling yerine MAX POOLING yaparak baskın sinyalleri korur.
    """
    def __init__(self, num_tags=52, tag_dim=TAG_DIM, n_heads=4, output_dim=OUT_DIM):
        super().__init__()
        self.tag_emb = nn.Embedding(num_tags + 1, tag_dim, padding_idx=0)
        nn.init.normal_(self.tag_emb.weight, std=0.05)

        self.attn = nn.MultiheadAttention(tag_dim, n_heads, batch_first=True, dropout=0.1)
        self.proj = nn.Sequential(
            nn.Linear(tag_dim, output_dim),
            nn.LayerNorm(output_dim),
        )

    def forward(self, tag_binary):  # (B, 52)
        B = tag_binary.size(0)
        all_idx = torch.arange(1, 53, device=tag_binary.device).unsqueeze(0).expand(B, -1)
        all_emb = self.tag_emb(all_idx)                      # (B, 52, tag_dim)

        key_pad_mask = (tag_binary < 0.5)                    # (B, 52) True = "ignore"
        all_masked = key_pad_mask.all(dim=1, keepdim=True)   # (B, 1)
        key_pad_mask = key_pad_mask & ~all_masked             

        attn_out, _ = self.attn(all_emb, all_emb, all_emb,
                                 key_padding_mask=key_pad_mask)   # (B, 52, tag_dim)

        # Mean Pooling yerine Max Pooling - İstenmeyenleri -1e9 ile gizle
        masked_attn = attn_out.masked_fill(key_pad_mask.unsqueeze(-1), -1e9)
        pooled, _ = masked_attn.max(dim=1)                   # (B, tag_dim)

        return self.proj(pooled)                             # (B, output_dim)


# ── IMPROVEMENT 3: GRU History Encoder ───────────────────────────────────
class GRUHistoryEncoder(nn.Module):
    def __init__(self, input_dim=7, hidden_dim=64, output_dim=OUT_DIM):
        super().__init__()
        self.gru = nn.GRU(input_dim, hidden_dim, batch_first=True,
                           bidirectional=False, num_layers=1)
        self.proj = nn.Sequential(
            nn.Linear(hidden_dim, output_dim),
            nn.LayerNorm(output_dim),
        )

    def forward(self, hist_seq, hist_len):  # (B, MAX_HIST, 7), (B,)
        out, _ = self.gru(hist_seq)           # out: (B, MAX_HIST, hidden_dim)

        valid_len = hist_len.clamp(min=1)
        idx = (valid_len - 1).view(-1, 1, 1).expand(-1, 1, out.size(2))  # (B, 1, hidden_dim)

        h_n = out.gather(1, idx).squeeze(1)   # (B, hidden_dim)

        mask = (hist_len > 0).float().unsqueeze(1).to(h_n.device)  # (B, 1)
        h_n  = h_n * mask
        return self.proj(h_n)                  # (B, output_dim)


# ── Gated User Tower v33 ──────────────────────────────────────────────────
class GatedUserTowerV33(nn.Module):
    def __init__(self, ctx_dim=7, hist_input_dim=7, output_dim=OUT_DIM):
        super().__init__()
        self.interest_enc = InterestAttentionEncoder(52, TAG_DIM, 4, output_dim)
        self.context_enc  = nn.Sequential(
            nn.Linear(ctx_dim, 64), nn.LayerNorm(64), nn.GELU(),
            nn.Linear(64, output_dim),
        )
        self.history_enc  = GRUHistoryEncoder(hist_input_dim, 64, output_dim)

        self.gate = nn.Sequential(
            nn.Linear(2, 32), nn.GELU(),
            nn.Linear(32, 3),
        )
        self.combine = nn.Sequential(
            nn.Linear(output_dim, output_dim), nn.LayerNorm(output_dim), nn.GELU(),
            nn.Dropout(0.10),
            nn.Linear(output_dim, output_dim),
        )

    def forward(self, interests, context, count, hist_norm, hist_seq, hist_len):
        i_emb = self.interest_enc(interests)          # (B, OUT_DIM)
        c_emb = self.context_enc(context)             # (B, OUT_DIM)
        h_emb = self.history_enc(hist_seq, hist_len)  # (B, OUT_DIM)

        gate_input = torch.cat([count, hist_norm], dim=-1)     # (B, 2)
        gate_logits= self.gate(gate_input)                     # (B, 3)

        is_cold = (hist_norm < 1e-4).float()                   # (B, 1)
        history_penalty = is_cold * -1e9                       # (B, 1)
        zero_penalty = torch.zeros_like(is_cold).expand(-1, 2) # (B, 2)
        penalty = torch.cat([zero_penalty, history_penalty], dim=-1) # (B, 3)

        gate_w = F.softmax(gate_logits + penalty, dim=-1)      # (B, 3)

        fused = (i_emb * gate_w[:, 0:1] +
                 c_emb * gate_w[:, 1:2] +
                 h_emb * gate_w[:, 2:3])
        return F.normalize(self.combine(fused), p=2, dim=-1)   # (B, OUT_DIM)


# ── Event Tower v33 ───────────────────────────────────────────────────────
class EventTowerV33(nn.Module):
    def __init__(self, num_subcats=52, embed_dim=SUBCAT_EMB_DIM,
                 numeric_dim=7, output_dim=OUT_DIM):
        super().__init__()
        self.subcat_emb = nn.Embedding(num_subcats, embed_dim)
        nn.init.normal_(self.subcat_emb.weight, std=0.05)

        combined = embed_dim + numeric_dim  
        self.net = nn.Sequential(
            nn.Linear(combined, 256), nn.LayerNorm(256), nn.GELU(), nn.Dropout(0.10),
            nn.Linear(256, 128),      nn.LayerNorm(128), nn.GELU(), nn.Dropout(0.10),
            nn.Linear(128, output_dim),
        )

    def forward(self, subcat_idx, numeric_feats):
        emb = self.subcat_emb(subcat_idx)            # (B, embed_dim)
        x   = torch.cat([emb, numeric_feats], dim=1) # (B, embed_dim+7)
        return F.normalize(self.net(x), p=2, dim=-1)


# ── Full Two-Tower Model ──────────────────────────────────────────────────
class TwoTowerModelV33(nn.Module):
    def __init__(self):
        super().__init__()
        self.user_tower  = GatedUserTowerV33(ctx_dim=7, hist_input_dim=7, output_dim=OUT_DIM)
        self.event_tower = EventTowerV33(NUM_SUBCATS, SUBCAT_EMB_DIM, 7, OUT_DIM)
        self.raw_temp = nn.Parameter(torch.tensor(0.0))  

    @property
    def temperature(self):
        return 0.05 + 0.45 * torch.sigmoid(self.raw_temp)

    def forward(self, interests, context, count, hist_norm, hist_seq, hist_len,
                subcat_idx, numeric_feats):
        u_vec = self.encode_user(interests, context, count, hist_norm, hist_seq, hist_len)
        e_vec = self.encode_event(subcat_idx, numeric_feats)
        return u_vec, e_vec

    def encode_user(self, interests, context, count, hist_norm, hist_seq, hist_len):
        return self.user_tower(interests, context, count, hist_norm, hist_seq, hist_len)

    def encode_event(self, subcat_idx, numeric_feats):
        return self.event_tower(subcat_idx, numeric_feats)


model = TwoTowerModelV33().to(device)
total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"\nTwoTowerModelV33 | params: {total_params:,}")
print(f"  OUT_DIM           : {OUT_DIM}")
print(f"  Temp range        : [{0.05:.3f}, {0.05+0.45:.3f}]  (sigmoid-bounded)")
print(f"  User Tower        : Interest-Attn(52→{OUT_DIM}) + Context(7→{OUT_DIM}) + GRU(seq→{OUT_DIM})")
print(f"  Event Tower       : Emb({NUM_SUBCATS},{SUBCAT_EMB_DIM}) + numeric(7) → {OUT_DIM}")


# In[7]:


# ─── CELL 7: Dataset ──────────────────────────────────────────────────────────
WEIGHT_MAP = {
    'related_loyal':  1.0,
    'related_diverse': 0.6,
    'exploration':    0.3,
    'hard_negative':  0.0,
    'easy_negative':  0.0,
}

df_interactions['user_idx']  = df_interactions['userId'].map(user_mapping)
df_interactions['event_idx'] = df_interactions['eventId'].map(event_mapping)
df_interactions = df_interactions.dropna(subset=['user_idx','event_idx'])
df_interactions['user_idx']  = df_interactions['user_idx'].astype(int)
df_interactions['event_idx'] = df_interactions['event_idx'].astype(int)

df_pos = df_interactions[df_interactions['label'] == 1].copy()
df_pos['weight'] = df_pos['matchType'].map(WEIGHT_MAP).fillna(0.3)
print(f"Positive pairs: {len(df_pos):,}")


class TwoTowerDatasetV33(Dataset):
    """
    Returns per-sample:
      interests  (52)      — binary tag vector
      context    (7)       — cluster bits + scaled coords
      count      (1)       — log1p(#events)
      hist_norm  (1)       — L2 norm of history (cold-start signal)
      hist_seq   (MAX_HIST, 7) — event feature sequence
      hist_len   scalar    — actual sequence length (for GRU packing)
      subcat_idx scalar    — event subcategory index
      numeric    (7)       — event numeric features
      weight     scalar    — sample weight
      u_lon, u_lat, e_lon, e_lat — raw coords for geo-loss
    """
    def __init__(self, df,
                 interests_t, context_t, count_t, hist_norm_t,
                 hist_seq_t, hist_len_t,
                 event_subcat_t, event_numeric_t,
                 u_lons, u_lats, e_lons, e_lats, is_train=True):
        self.u_idx = torch.tensor(df['user_idx'].values,  dtype=torch.long)
        self.e_idx = torch.tensor(df['event_idx'].values, dtype=torch.long)
        self.w     = torch.tensor(df['weight'].values,    dtype=torch.float32)
        self.interests_t   = interests_t
        self.context_t     = context_t
        self.count_t       = count_t
        self.hist_norm_t   = hist_norm_t
        self.hist_seq_t    = hist_seq_t
        self.hist_len_t    = hist_len_t
        self.event_subcat_t  = event_subcat_t
        self.event_numeric_t = event_numeric_t
        self.is_train = is_train
        # Raw coords (for geo loss)
        self.u_lons = torch.tensor(u_lons, dtype=torch.float32)
        self.u_lats = torch.tensor(u_lats, dtype=torch.float32)
        self.e_lons = torch.tensor(e_lons, dtype=torch.float32)
        self.e_lats = torch.tensor(e_lats, dtype=torch.float32)

    def __len__(self): return len(self.u_idx)

    def __getitem__(self, idx):
        u = self.u_idx[idx].item()
        e = self.e_idx[idx].item()

        hist = self.hist_seq_t[u].clone()
        hn   = self.hist_norm_t[u]
        ctx  = self.context_t[u].clone() # Context'i (Arketip) kopyala

        # EĞİTİM SIRASINDA DROPOUT (Kolaya kaçmayı engelle)
        if self.is_train:
            # Geçmişi gizleme (Cold-start simülasyonu)
            if torch.rand(1).item() < 0.30:
                hist = torch.zeros_like(hist)
                hn   = torch.zeros(1, dtype=torch.float32)

            # YENİ: Context'i gizleme (Modeli İlgi Alanlarına bakmaya zorla!)
            if torch.rand(1).item() < 0.30:
                ctx = torch.zeros_like(ctx)

        return (
            self.interests_t[u],
            ctx,              # Güncellenmiş ctx kullanılıyor
            self.count_t[u],
            hn,
            hist,
            self.hist_len_t[u],
            self.event_subcat_t[e],
            self.event_numeric_t[e],
            self.w[idx],
            self.u_lons[u], self.u_lats[u],
            self.e_lons[e], self.e_lats[e],
        )

# Create train/val sets completely independent so dropout is only active for training
full_ds_t = TwoTowerDatasetV33(
    df_pos,
    user_interests_tensor, user_context_tensor, user_count_tensor, user_hist_norm_t,
    user_history_seq_tensor, user_history_len_tensor,
    event_subcat_tensor, event_numeric_tensor,
    user_lons_raw, user_lats_raw, event_lons_raw, event_lats_raw,
    is_train=True
)
full_ds_v = TwoTowerDatasetV33(
    df_pos,
    user_interests_tensor, user_context_tensor, user_count_tensor, user_hist_norm_t,
    user_history_seq_tensor, user_history_len_tensor,
    event_subcat_tensor, event_numeric_tensor,
    user_lons_raw, user_lats_raw, event_lons_raw, event_lats_raw,
    is_train=False
)

indices = np.arange(len(df_pos))
np.random.shuffle(indices)
val_size   = int(len(indices) * 0.15)
val_idx    = indices[:val_size]
train_idx  = indices[val_size:]

train_ds = torch.utils.data.Subset(full_ds_t, train_idx)
val_ds   = torch.utils.data.Subset(full_ds_v, val_idx)


# In[8]:


# ─── CELL 8: Loss Functions ───────────────────────────────────────────────────

def haversine_batch(lon1, lat1, lon2, lat2):
    """Batch Haversine distance in km. All inputs: degree tensors (B,)"""
    R = 6371.0
    l1 = torch.deg2rad(lon1); a1 = torch.deg2rad(lat1)
    l2 = torch.deg2rad(lon2); a2 = torch.deg2rad(lat2)
    dlon = l2 - l1;  dlat = a2 - a1
    a = torch.sin(dlat/2)**2 + torch.cos(a1) * torch.cos(a2) * torch.sin(dlon/2)**2
    return R * 2 * torch.arcsin(torch.clamp(torch.sqrt(a), 0, 1))

def geo_weight(u_lon, u_lat, e_lon, e_lat, max_km=15.0):
    """Weight = 1 if event within max_km, linearly decays to 0.2"""
    dist = haversine_batch(u_lon, u_lat, e_lon, e_lat)           # (B,)
    w    = torch.clamp(1.0 - 0.8 * dist / max_km, min=0.2)       # [0.2, 1.0]
    return w

def subcategory_margin_penalty(event_vecs, subcat_idx, margin=0.5):
    """
    TAVSİYE 2: Alt-Kategori Margin Cezası
    Farklı alt kategorilerdeki etkinliklerin vektörel olarak birbirine çok yaklaşmasını engeller.
    """
    sim = torch.matmul(event_vecs, event_vecs.T)

    same_subcat = (subcat_idx.unsqueeze(1) == subcat_idx.unsqueeze(0))
    diff_subcat_mask = ~same_subcat

    violation = torch.relu(sim - (1.0 - margin)) 

    penalty = (violation * diff_subcat_mask).sum() / diff_subcat_mask.sum().clamp(min=1.0)
    return penalty

def info_nce_hard(user_vecs, event_vecs, temperature, event_subcat_idx=None, weights=None, k_hard=32):
    """
    Hard Negative Mining InfoNCE.
    50% standard in-batch InfoNCE + 50% hard negative InfoNCE.
    """
    B    = user_vecs.size(0)
    temp = temperature

    sim    = torch.matmul(user_vecs, event_vecs.T) / temp   # (B, B)
    labels = torch.arange(B, device=user_vecs.device)

    # Standard InfoNCE (both directions)
    loss_u2e = F.cross_entropy(sim,   labels, reduction='none')  # (B,)
    loss_e2u = F.cross_entropy(sim.T, labels, reduction='none')  # (B,)
    loss_standard = (loss_u2e + loss_e2u) / 2.0                  # (B,)

    # Hard InfoNCE: mask diagonal, find top-k hardest negatives
    sim_no_diag = sim.clone()
    sim_no_diag.fill_diagonal_(-1e9)
    k = min(k_hard, B - 1)
    _, hard_idx = torch.topk(sim_no_diag, k=k, dim=1)            # (B, k)

    # Build small matrix: [positive | hard_negatives]
    pos_scores  = sim[range(B), labels].unsqueeze(1)              # (B, 1)
    hard_scores = sim.gather(1, hard_idx)                         # (B, k)
    hard_sim    = torch.cat([pos_scores, hard_scores], dim=1)     # (B, k+1)
    hard_labels = torch.zeros(B, dtype=torch.long, device=sim.device)
    loss_hard   = F.cross_entropy(hard_sim, hard_labels, reduction='none')  # (B,)

    # Mix 50/50
    loss = 0.5 * loss_standard + 0.5 * loss_hard

    # Preserve gradient magnitude!
    if weights is not None:
        loss = (loss * weights).sum() / weights.sum().clamp(min=1e-5)
    else:
        loss = loss.mean()

    # Margin Penalty Entegrasyonu
    if event_subcat_idx is not None:
        margin_loss = subcategory_margin_penalty(event_vecs, event_subcat_idx, margin=0.5)
        loss = loss + (0.2 * margin_loss)

    return loss

def recall_at_k(user_vecs, event_vecs, k=10):
    sim    = torch.matmul(user_vecs, event_vecs.T)
    _, topk = torch.topk(sim, k, dim=1)
    labels = torch.arange(user_vecs.size(0), device=user_vecs.device).unsqueeze(1)
    return (topk == labels).any(dim=1).float().mean().item()

print("Loss functions ready.")


# ## 🏗️ Two-Tower Model Mimarisi
# 
# ```
# USER TOWER (GATED ATTENTION)                    EVENT TOWER
# ──────────────────────────────                  ──────────────────────
# Input:                                          Input:
#  Profile(54-dim)  History(57-dim)                 Event Feats(57-dim)
#       │                │                                │
# [Profile_Enc]    [History_Enc]                     [Event_Enc]
#       │                │                                │
#     p_emb            h_emb                            e_emb
#       │                │
#       └───►[GATE]◄─────┘ ◄─── event_count
#         (%w1)    (%w2)
#           └──────┴──────► [Combined_Enc]            L2 Normalize
#                                 │                       │
#                    user_vec (256-dim)               event_vec (256-dim)
#                          │                              │
#                          └──────── cosine_similarity ───┘
# ```
# 
# **L2 Normalize** son katmanda zorunlu — cosine similarity'nin anlamlı olması için vektörler birim uzunlukta olmalı.

# In[9]:


# ─── CELL 9: Training Helper ──────────────────────────────────────────────────
def make_loader(dataset, batch_size, shuffle=True):
    # num_workers=0 and pin_memory=False is wildly faster for pure in-memory PyTorch slicing
    return DataLoader(dataset, batch_size=batch_size, shuffle=shuffle,
                      num_workers=0, pin_memory=False, drop_last=shuffle)

def run_epoch(loader, train=True, use_hard_neg=True):
    if train:
        model.train()
    else:
        model.eval()

    total_loss = r10_sum = r50_sum = 0.0
    n_batches  = 0
    ctx = torch.no_grad() if not train else torch.enable_grad()

    with ctx:
        for batch in loader:
            (interests, context, count, hist_norm, hist_seq, hist_len,
             sub_idx, num_feats, w,
             u_lon, u_lat, e_lon, e_lat) = [x.to(device) for x in batch]

            if train:
                optimizer.zero_grad()

            u_v, e_v = model(interests, context, count, hist_norm,
                              hist_seq, hist_len, sub_idx, num_feats)

            # geo-aware sample weights
            g_w      = geo_weight(u_lon, u_lat, e_lon, e_lat)
            combined_w = w * g_w

            if use_hard_neg:
                # sub_idx parametresi artık margin cezası için loss fonksiyona gönderiliyor
                loss = info_nce_hard(u_v, e_v, model.temperature, event_subcat_idx=sub_idx, weights=combined_w, k_hard=128)
            else:
                # Stage 1: standard InfoNCE (simpler, easier convergence)
                temp = model.temperature
                sim  = torch.matmul(u_v, e_v.T) / temp
                lbl  = torch.arange(u_v.size(0), device=device)

                loss_raw = F.cross_entropy(sim, lbl, reduction='none')
                loss = (loss_raw * combined_w).sum() / combined_w.sum().clamp(min=1e-5)

                # İsteğe bağlı: Stage 1'de de hafif bir margin cezası eklenebilir
                margin_loss = subcategory_margin_penalty(e_v, sub_idx, margin=0.5)
                loss = loss + (0.1 * margin_loss)

            if train:
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()

            total_loss += loss.item()
            if not train:
                r10_sum += recall_at_k(u_v, e_v, 10)
                r50_sum += recall_at_k(u_v, e_v, 50)
            n_batches += 1

    return total_loss / n_batches, r10_sum / n_batches, r50_sum / n_batches


# In[10]:


# ─── CELL 10: Training — Curriculum + SWA ────────────────────────────────────
"""
IMPROVEMENT 7: Curriculum Training
  Stage 1 (10 epochs, batch=512):
    Standard InfoNCE — easy negatives — small batches.
    Goal: warm up towers, find reasonable embedding space.

  Stage 2 (40 epochs, batch=1024):
    Hard Negative InfoNCE + Geo-aware weights.
    Goal: fine-grained discrimination.

IMPROVEMENT 8: SWA in last 10 epochs of Stage 2.
"""
CKPT = '/kaggle/working/best_two_tower_v33.pth'

optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)

# ── Stage 1: Easy curriculum ────────────────────────────────────────────
print("─" * 80)
print(f"STAGE 1 — Easy Curriculum ({EPOCHS_S1} epochs, batch={BATCH_S1})")
print("─" * 80)

train_loader_s1 = make_loader(train_ds, BATCH_S1, shuffle=True)
val_loader      = make_loader(val_ds,   BATCH_S2, shuffle=False)
sched_s1 = optim.lr_scheduler.OneCycleLR(optimizer, max_lr=1.5e-3,
                                           epochs=EPOCHS_S1,
                                           steps_per_epoch=len(train_loader_s1))
BEST_VAL = float('inf')

for epoch in range(EPOCHS_S1):
    train_loss, _, _          = run_epoch(train_loader_s1, train=True,  use_hard_neg=False)
    val_loss,   r10,   r50    = run_epoch(val_loader,       train=False, use_hard_neg=False)
    sched_s1.step()

    flag = ""
    if val_loss < BEST_VAL:
        BEST_VAL = val_loss
        torch.save(model.state_dict(), CKPT)
        flag = " ⭐"
    print(f"S1 Epoch {epoch+1:02d}/{EPOCHS_S1} | Train:{train_loss:.4f} | "
          f"Val:{val_loss:.4f} | R@10:{r10:.3f} | R@50:{r50:.3f} | "
          f"T:{model.temperature.item():.3f}{flag}")

print(f"\n✅ Stage 1 complete. Best val: {BEST_VAL:.4f}")

# ── Stage 2: Hard Negatives + SWA ───────────────────────────────────────
print("\n" + "─" * 80)
print(f"STAGE 2 — Hard Negatives + SWA ({EPOCHS_S2} epochs, batch={BATCH_S2})")
print("─" * 80)

# Reload best S1 checkpoint to start S2 from best point
model.load_state_dict(torch.load(CKPT, map_location=device))

train_loader_s2 = make_loader(train_ds, BATCH_S2, shuffle=True)
optimizer_s2    = optim.AdamW(model.parameters(), lr=3e-4, weight_decay=1e-4)
sched_s2        = optim.lr_scheduler.CosineAnnealingLR(optimizer_s2, T_max=EPOCHS_S2)

# IMPROVEMENT 8: SWA model
swa_model = AveragedModel(model)
swa_scheduler = SWALR(optimizer_s2, swa_lr=1e-4, anneal_epochs=10)
swa_started = False
optimizer = optimizer_s2

for epoch in range(EPOCHS_S2):
    abs_epoch = EPOCHS_S1 + epoch + 1
    total_epoch = EPOCHS_S1 + EPOCHS_S2

    use_swa = (epoch >= EPOCHS_S2 - 10)

    train_loss, _, _       = run_epoch(train_loader_s2, train=True,  use_hard_neg=True)
    val_loss,   r10, r50   = run_epoch(val_loader,       train=False, use_hard_neg=True)

    if use_swa:
        swa_model.update_parameters(model)
        swa_scheduler.step()
        swa_started = True
    else:
        sched_s2.step()

    flag = ""
    if val_loss < BEST_VAL:
        BEST_VAL = val_loss
        torch.save(model.state_dict(), CKPT)
        flag = " ⭐"

    swa_tag = " [SWA]" if use_swa else ""
    print(f"S2 Epoch {epoch+1:02d}/{EPOCHS_S2} | Train:{train_loss:.4f} | "
          f"Val:{val_loss:.4f} | R@10:{r10:.3f} | R@50:{r50:.3f} | "
          f"T:{model.temperature.item():.3f}{flag}{swa_tag}")

# Finalize SWA: update batch-norm statistics
if swa_started:
    print("\nFinalizing SWA batch norm statistics...")
    torch.optim.swa_utils.update_bn(train_loader_s2, swa_model, device=device)
    torch.save(swa_model.state_dict(), '/kaggle/working/swa_two_tower_v33.pth')
    print("SWA model saved.")

print("\n✅ Training complete!")
print(f"Best individual model val loss : {BEST_VAL:.4f}")


# In[11]:


# ─── CELL 11: Build FAISS Index ───────────────────────────────────────────────
# Use SWA model if available, else best checkpoint
if swa_started:
    inference_model = swa_model
    inference_model.eval()
    print("Using SWA model for inference.")
else:
    model.load_state_dict(torch.load(CKPT, map_location=device))
    inference_model = model
    inference_model.eval()

all_event_vecs = []
with torch.no_grad():
    for start in range(0, len(event_subcat_idx), 4096):
        sub_b = event_subcat_tensor[start:start+4096].to(device)
        num_b = event_numeric_tensor[start:start+4096].to(device)
        # SWA model wraps original; use module.encode_event if needed
        try:
            vecs = inference_model.encode_event(sub_b, num_b)
        except AttributeError:
            vecs = inference_model.module.encode_event(sub_b, num_b)
        all_event_vecs.append(vecs.cpu().numpy())

event_vecs_np = np.concatenate(all_event_vecs).astype(np.float32)
print(f"\nEvent vectors: {event_vecs_np.shape}")

# Cosine sanity check
sample_vecs = event_vecs_np[:2000]
sim_post    = cos_sim_sk(sample_vecs)
np.fill_diagonal(sim_post, 0)
print(f"Post-training event vec avg cosine (target <0.5): {sim_post.mean():.4f}")

faiss_index = faiss.IndexFlatIP(OUT_DIM)
faiss_index.add(event_vecs_np)
print(f"FAISS index: {faiss_index.ntotal:,} events | dim={OUT_DIM}")


# In[12]:


# ─── CELL 12: Recommend Function (Hybrid Retrieval) ──────────────────────────
def recommend(user_uuid, top_k=10, only_open=True):
    u_idx = user_mapping.get(user_uuid)
    if u_idx is None:
        return f"User not found: {user_uuid}"

    interests = user_interests_tensor[u_idx].unsqueeze(0).to(device)
    context   = user_context_tensor[u_idx].unsqueeze(0).to(device)
    count     = user_count_tensor[u_idx].unsqueeze(0).to(device)
    hn        = user_hist_norm_t[u_idx].unsqueeze(0).to(device)
    hist_seq  = user_history_seq_tensor[u_idx].unsqueeze(0).to(device)
    hist_len  = user_history_len_tensor[u_idx].unsqueeze(0).to(device)

    with torch.no_grad():
        try:
            u_vec = inference_model.encode_user(interests, context, count, hn, hist_seq, hist_len)
        except AttributeError:
            u_vec = inference_model.module.encode_user(interests, context, count, hn, hist_seq, hist_len)
        u_vec = u_vec.cpu().numpy().astype(np.float32)

    # 1. FAISS ADAYLARI (Dense Retrieval - Gizli Örüntüler)
    scores, indices = faiss_index.search(u_vec, top_k * 100)
    idx_to_event = {v: k for k, v in event_mapping.items()}
    faiss_eids = [idx_to_event[i] for i in indices[0] if i in idx_to_event]

    # 2. İLGİ ALANI ADAYLARI (Heuristic Retrieval - Kesin Eşleşmeler)
    user_tag_indices = torch.where(interests[0] > 0.5)[0].cpu().numpy()
    active_interests = set([mlb.classes_[i] for i in user_tag_indices])

    # Kullanıcının ilgi alanlarına uyan rastgele 200 açık etkinliği veritabanından zorla çekiyoruz
    heuristic_df = df_events[(df_events['subCategory'].isin(active_interests))]
    if only_open:
        heuristic_df = heuristic_df[heuristic_df['status'] == 'OPEN']
    heuristic_eids = heuristic_df['eventId'].head(200).tolist()

    # 3. ADAY HAVUZUNU BİRLEŞTİR VE YENİDEN SKORLA
    candidate_eids = list(set(faiss_eids + heuristic_eids))

    # Tüm adayların orijinal Two-Tower skorlarını hesapla (Dot Product)
    cand_idx = [event_mapping[eid] for eid in candidate_eids if eid in event_mapping]
    cand_vecs = event_vecs_np[cand_idx]
    cand_scores = np.dot(cand_vecs, u_vec[0])

    score_map = {idx_to_event[idx]: float(score) for idx, score in zip(cand_idx, cand_scores)}

    result_df = df_events[df_events['eventId'].isin(candidate_eids)].copy()
    if only_open:
        result_df = result_df[result_df['status'] == 'OPEN']

    # 4. İŞ MANTIĞI (Business Logic): İlgi alanı eşleşmelerine %25 Bonus
    def apply_interest_bonus(row):
        base_score = score_map.get(row['eventId'], 0.0)
        if row['subCategory'] in active_interests:
            return base_score * 1.25  # Bonus oranını %25'e çıkardık
        return base_score

    result_df['score'] = result_df.apply(apply_interest_bonus, axis=1)
    result_df = result_df.sort_values('score', ascending=False)

    final_recs, subcat_counts = [], {}
    for _, row in result_df.iterrows():
        sub = row['subCategory']
        # Aynı alt kategoriden maksimum 2 tane göstererek çeşitliliği sağla
        if subcat_counts.get(sub, 0) < 2:
            final_recs.append(row)
            subcat_counts[sub] = subcat_counts.get(sub, 0) + 1
        if len(final_recs) == top_k:
            break

    return pd.DataFrame(final_recs)[['category','subCategory','status','score']]

print("✅ Hybrid recommend() hazır.")


# In[17]:


# ─── CELL 13: Cold-Start Test (Hibrit Arama ile) ─────────────────────────────
print("\n" + "=" * 65)
print("COLD START TEST — SENTETİK RASTGELE KULLANICI")

import random

num_interests = random.randint(5, 10)
fake_interests = random.sample(MASTER_52, num_interests)
print(f"🎯 Seçilen İlgi Alanları (Interests) : {fake_interests}")

binary_tags = mlb.transform([fake_interests]).astype(np.float32)
interests_t = torch.tensor(binary_tags, dtype=torch.float32).to(device)

random_arch = random.choice(UPPER_CATEGORIES)
print(f"🎭 Seçilen Arketip (Cluster)         : {random_arch}")

cluster_bits_arr = np.array([archetype_to_bits(random_arch)], dtype=np.float32)
neutral_coords = np.array([[0.0, 0.0]], dtype=np.float32)
context_matrix = np.concatenate([cluster_bits_arr, neutral_coords], axis=1)
context_t = torch.tensor(context_matrix, dtype=torch.float32).to(device)

print("📚 Past Events (hist_seq)            : []  <-- (Cold Start)")

count_t     = torch.zeros(1, 1, dtype=torch.float32).to(device)
hn_t        = torch.zeros(1, 1, dtype=torch.float32).to(device)
hist_seq_t  = torch.zeros(1, MAX_HIST, 7, dtype=torch.float32).to(device)
hist_len_t  = torch.zeros(1, dtype=torch.long).to(device)

with torch.no_grad():
    gate_input = torch.cat([count_t, hn_t], dim=-1)
    try:
        gate_logits = inference_model.user_tower.gate(gate_input)
        u_vec = inference_model.encode_user(interests_t, context_t, count_t, hn_t, hist_seq_t, hist_len_t)
    except AttributeError:
        gate_logits = inference_model.module.user_tower.gate(gate_input)
        u_vec = inference_model.module.encode_user(interests_t, context_t, count_t, hn_t, hist_seq_t, hist_len_t)

    is_cold = (hn_t < 1e-4).float()
    history_penalty = is_cold * -1e9
    zero_penalty = torch.zeros_like(is_cold).expand(-1, 2)
    penalty = torch.cat([zero_penalty, history_penalty], dim=-1)
    gate_w = F.softmax(gate_logits + penalty, dim=-1)

    print(f"\n🧠 GERÇEK Gate weights:")
    print(f"  Interest-Att : {gate_w[0][0].item()*100:.1f}%")
    print(f"  Context      : {gate_w[0][1].item()*100:.1f}%")
    print(f"  History-GRU  : {gate_w[0][2].item()*100:.6f}%")

    u_vec = u_vec.cpu().numpy().astype(np.float32)

# --- HİBRİT ARAMA SİMÜLASYONU ---
scores, indices = faiss_index.search(u_vec, 1000)
idx_to_event = {v: k for k, v in event_mapping.items()}
faiss_eids  = [idx_to_event[i] for i in indices[0] if i in idx_to_event]

# İlgi alanlarını DB'den zorla çek
heuristic_eids = df_events[(df_events['subCategory'].isin(fake_interests))]['eventId'].head(200).tolist()

# Havuzları birleştir ve manuel dot-product ile asıl skoru hesapla
candidate_eids = list(set(faiss_eids + heuristic_eids))
cand_idx = [event_mapping[eid] for eid in candidate_eids if eid in event_mapping]
cand_vecs = event_vecs_np[cand_idx]
cand_scores = np.dot(cand_vecs, u_vec[0])

score_map = {idx_to_event[idx]: float(score) for idx, score in zip(cand_idx, cand_scores)}

res_df = df_events[df_events['eventId'].isin(candidate_eids)].copy()

# Bonus Uygula
def apply_interest_bonus(row):
    base_score = score_map.get(row['eventId'], 0.0)
    if row['subCategory'] in fake_interests:
        return base_score * 1.25 # %25 Bonus
    return base_score

res_df['final_score'] = res_df.apply(apply_interest_bonus, axis=1)
res_df = res_df.sort_values('final_score', ascending=False)

print("\n🔥 Hibrit Recommender Sonuçları (İlk 15):")
print(res_df[['category','subCategory','status','final_score']].head(15).to_string())
print("=" * 65)


# # ─── CELL 12: Kaydetme ───────────────────────────────────────────────────────
# OUTPUT = '/kaggle/working'
# 
# # Model ağırlıkları
# torch.save(model.state_dict(), f'{OUTPUT}/two_tower_model.pth')
# 
# faiss.write_index(faiss_index, f'{OUTPUT}/event_faiss.index')
# # Event vektörleri (offline inference için)
# np.save(f'{OUTPUT}/event_vecs.npy', event_vecs_np)
# 
# # Mapping'ler
# with open(f'{OUTPUT}/user_mapping.pkl',  'wb') as f: pickle.dump(user_mapping,  f)
# with open(f'{OUTPUT}/event_mapping.pkl', 'wb') as f: pickle.dump(event_mapping, f)
# 
# print(f"✅ Kaydedilen dosyalar:")
# for fname in sorted(os.listdir(OUTPUT)):
#     size = os.path.getsize(f'{OUTPUT}/{fname}') / 1e6
#     print(f"   {fname:40s}  {size:.2f} MB")

# In[ ]:





# In[14]:


# ─── CELL 15: Save Everything ─────────────────────────────────────────────────
OUTPUT = '/kaggle/working'

torch.save(model.state_dict(), f'{OUTPUT}/two_tower_model_v33.pth')
if swa_started:
    # Already saved above
    pass
joblib.dump(SUBCAT_TO_IDX, f'{OUTPUT}/subcat_to_idx.bin')

print(f"\n✅ Saved:")
for fname in sorted(os.listdir(OUTPUT)):
    size = os.path.getsize(f'{OUTPUT}/{fname}') / 1e6
    print(f"   {fname:50s}  {size:.2f} MB")


# In[18]:


import joblib
import json
import os

# Dosya listesi
bin_files = [
    "event_coord_scaler.bin", 
    "event_dur_scaler.bin", 
    "user_coord_scaler.bin",
    "subcat_to_idx.bin"
]

print("🚀 JSON dönüşüm işlemi başlatılıyor...\n")

for bin_file in bin_files:
    if os.path.exists(bin_file):
        # Dosyayı yükle
        obj = joblib.load(bin_file)
        json_file = bin_file.replace(".bin", ".json")

        # Eğer nesne bir StandardScaler ise (mean_ ve scale_ nitelikleri varsa)
        if hasattr(obj, "mean_") and hasattr(obj, "scale_"):
            data = {
                "mean": obj.mean_.tolist(),
                "scale": obj.scale_.tolist()
            }
        # Eğer nesne bir sözlük ise (subcat_to_idx gibi)
        elif isinstance(obj, dict):
            data = obj
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

print("\n🎉 İşlem tamamlandı. Artık bu .json dosyalarını TypeScript projenize import edebilirsiniz.")


# In[15]:


# ─── CELL 16: ONNX Export (CPU Fix) ───────────────────────────────────────────
import onnx

# EXPORT İŞLEMİNİ CPU'DA YAPMAK HAYAT KURTARIR!
# GPU üzerindeki özel attention çekirdekleri (FlashAttention) ONNX tracer'ını bozar.
cpu_device = torch.device('cpu')

export_model = TwoTowerModelV33().to(cpu_device)
export_model.load_state_dict(torch.load(CKPT, map_location=cpu_device))
export_model.eval()

# User Tower ONNX
class UserTowerONNX(nn.Module):
    def __init__(self, m): super().__init__(); self.t = m.user_tower
    def forward(self, interests, context, count, hist_norm, hist_seq, hist_len):
        return self.t(interests, context, count, hist_norm, hist_seq, hist_len)

onnx_user  = UserTowerONNX(export_model).to(cpu_device).eval()

# Dummy tensörlerin tamamını CPU'da yaratıyoruz
dummy_int  = torch.randn(1, 52).to(cpu_device)
dummy_ctx  = torch.randn(1, 7).to(cpu_device)
dummy_cnt  = torch.randn(1, 1).to(cpu_device)
dummy_hn   = torch.randn(1, 1).to(cpu_device)
dummy_hs   = torch.randn(1, MAX_HIST, 7).to(cpu_device)
dummy_hl   = torch.tensor([MAX_HIST], dtype=torch.long).to(cpu_device)

print("Exporting User Tower (CPU Mode)...")
torch.onnx.export(
    onnx_user, (dummy_int, dummy_ctx, dummy_cnt, dummy_hn, dummy_hs, dummy_hl),
    f"{OUTPUT}/user_tower_v33.onnx",
    export_params=True, opset_version=18, do_constant_folding=True,
    input_names=['interests','context','count','hist_norm','hist_seq','hist_len'],
    output_names=['user_vector'],
    dynamic_axes={
        'interests':   {0:'batch'}, 'context':   {0:'batch'},
        'count':       {0:'batch'}, 'hist_norm': {0:'batch'},
        'hist_seq':    {0:'batch'}, 'hist_len':  {0:'batch'},
        'user_vector': {0:'batch'},
    }
)
print("✅ User Tower ONNX exported successfully!")

# Event Tower ONNX
class EventTowerONNX(nn.Module):
    def __init__(self, m): super().__init__(); self.t = m.event_tower
    def forward(self, sub_idx, numeric): return self.t(sub_idx, numeric)

onnx_evt  = EventTowerONNX(export_model).to(cpu_device).eval()
dummy_sub = torch.zeros(1, dtype=torch.long).to(cpu_device)
dummy_num = torch.randn(1, 7).to(cpu_device)

print("\nExporting Event Tower (CPU Mode)...")
torch.onnx.export(
    onnx_evt, (dummy_sub, dummy_num),
    f"{OUTPUT}/event_tower_v33.onnx",
    export_params=True, opset_version=18, do_constant_folding=True,
    input_names=['subcat_idx','numeric_input'],
    output_names=['event_vector'],
    dynamic_axes={
        'subcat_idx':    {0:'batch'}, 'numeric_input': {0:'batch'},
        'event_vector':  {0:'batch'},
    }
)
print("✅ Event Tower ONNX exported successfully!")
print("\n🎉 Tüm modeller mobil entegrasyon için hazır!")


# In[20]:


import zipfile
import os

# Paketlenmesini istediğin dosyaların listesi
# .npy ve .pth dosyalarını dışarıda bırakıyoruz (Backend için gereksizler)
files_to_zip = [
    "user_tower_v33.onnx",
    "event_tower_v33.onnx",
    "event_coord_scaler.json",
    "event_dur_scaler.json",
    "user_coord_scaler.json",
    "subcat_to_idx.json"
]

zip_name = "GatherUp_Backend_Assets.zip"

with zipfile.ZipFile(zip_name, 'w') as zipf:
    for file in files_to_zip:
        if os.path.exists(file):
            zipf.write(file)
            print(f"📦 Ziplendi: {file}")
        else:
            print(f"⚠️ Uyarı: {file} bulunamadığı için atlandı.")

print(f"\n✅ İşlem Tamam! {zip_name} dosyasını sağdaki 'Output' kısmından indirebilirsin.")


# ## 📊 Özet & Sonraki Adımlar
# 
# ### Ne yaptık?
# 
# | Adım | Açıklama |
# |---|---|
# | User Tower | `emb_base + last3 + last10` (1152-dim) → 128-dim |
# | Event Tower | `event_embedding` (384-dim) → 128-dim |
# | Loss | InfoNCE — in-batch negatives |
# | Inference | FAISS index → milisaniye |
# | Metrik | Recall@10, Recall@50 |
# 
# ### Gerçek uygulama açıldığında ne yapacaksın?
# 
# ```
# 1. Gerçek sinyal topla:
#    - Kullanıcı event'e tıkladı         → pozitif (label=1)
#    - Kullanıcı event'i gördü, tıklamadı → negatif (label=0)
#    - Kullanıcı event'e katıldı          → güçlü pozitif (weight=1.5)
# 
# 2. Modeli fine-tune et (aynı kod, yeni data)
#    → FAISS index'i güncelle
# 
# 3. A/B test yap: sentetik model vs. fine-tuned model
# ```
# 
# ### Recall@K nasıl yorumlanır?
# ```
# R@10 = 0.4 → Kullanıcının gerçek etkinliği, %40 ihtimalle top-10 içinde
# R@10 = 0.7 → İyi model
# R@10 = 0.9 → Çok iyi model (production'da nadiren görülür)
# ```
