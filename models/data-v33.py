#!/usr/bin/env python
# coding: utf-8

# In[2]:


"""
GatherUp — Data Generation v32
Fixes applied vs v31:
  1. Non-uniform category distribution (Sports dominant, Social rare)
  2. Realistic event timing based on category & day type
  3. generate_interactions_v3: Hard negative mining (same upper-cat, wrong sub)
  4. generate_adam_gibi_data: Added 'group_schedule', 'free_slots_score',
     'participants' columns to output DataFrame
  5. Negative interaction label noise reduced (no same-subcategory negatives)
"""

# ─── CELL 1: Imports ────────────────────────────────────────────────────────
get_ipython().system('pip install pyarrow fastparquet')
import pandas as pd
import numpy as np
import uuid
import random
from datetime import datetime, timedelta
import collections
import gc
import os
from sklearn.preprocessing import MultiLabelBinarizer, StandardScaler

print(f"Pandas: {pd.__version__} | NumPy: {np.__version__}")
np.random.seed(42)
random.seed(42)

# ─── CELL 2: Category Definitions ───────────────────────────────────────────
UPPER_CATEGORIES = ["Sports", "Technology_Science", "Arts_Culture", "Hobbies_Lifestyle", "Social_Career"]

CLUSTER_MAP = {
    "Volleyball": "Sports", "Basketball": "Sports", "Football": "Sports", "Tennis": "Sports",
    "Swimming": "Sports", "Running": "Sports", "Yoga": "Sports", "Pilates": "Sports",
    "Fitness": "Sports", "Skateboarding": "Sports", "Cycling": "Sports", "Archery": "Sports",
    "Mountaineering": "Sports", "Boxing": "Sports", "Table Tennis": "Sports",
    "Software": "Technology_Science", "Artificial Intelligence": "Technology_Science",
    "Data Science": "Technology_Science", "Cybersecurity": "Technology_Science",
    "Robotics": "Technology_Science", "Game Development": "Technology_Science",
    "Blockchain": "Technology_Science", "Astronomy": "Technology_Science",
    "Electronics": "Technology_Science",
    "Theater": "Arts_Culture", "Cinema": "Arts_Culture", "Concert": "Arts_Culture",
    "Dance": "Arts_Culture", "Painting": "Arts_Culture", "Sculpture": "Arts_Culture",
    "Literature": "Arts_Culture", "Photography": "Arts_Culture", "Exhibition": "Arts_Culture",
    "Stand-up": "Arts_Culture", "Museums": "Arts_Culture", "Opera": "Arts_Culture",
    "Camping": "Hobbies_Lifestyle", "Chess": "Hobbies_Lifestyle", "Reading": "Hobbies_Lifestyle",
    "Food": "Hobbies_Lifestyle", "Gastronomy": "Hobbies_Lifestyle", "Gaming": "Hobbies_Lifestyle",
    "E-sports": "Hobbies_Lifestyle", "Gardening": "Hobbies_Lifestyle", "Travel": "Hobbies_Lifestyle",
    "Foreign Languages": "Hobbies_Lifestyle", "Collecting": "Hobbies_Lifestyle",
    "Musical Instruments": "Hobbies_Lifestyle",
    "Volunteering": "Social_Career", "Networking": "Social_Career",
    "Career Days": "Social_Career", "Workshop": "Social_Career",
}

GROUP_TO_SUBS = collections.defaultdict(list)
for sub, group in CLUSTER_MAP.items():
    GROUP_TO_SUBS[group].append(sub)

# ─── FIX 1: Non-uniform upper category distribution ─────────────────────────
# Real-world: Sports events are most common, Social/Career are rare
UPPER_CAT_PROBS = {
    "Sports":             0.35,
    "Technology_Science": 0.20,
    "Arts_Culture":       0.20,
    "Hobbies_Lifestyle":  0.15,
    "Social_Career":      0.10,
}

# ─── FIX 2: Realistic subcategory weights within each upper category ─────────
# Popular subcategories are more likely to appear
SUBCAT_WEIGHTS = {
    "Sports": {
        "Football": 0.12, "Basketball": 0.12, "Volleyball": 0.10, "Running": 0.10,
        "Tennis": 0.08, "Swimming": 0.08, "Yoga": 0.07, "Fitness": 0.07,
        "Cycling": 0.06, "Pilates": 0.05, "Archery": 0.03, "Boxing": 0.04,
        "Table Tennis": 0.03, "Skateboarding": 0.03, "Mountaineering": 0.02,
    },
    "Technology_Science": {
        "Software": 0.18, "Artificial Intelligence": 0.18, "Data Science": 0.15,
        "Game Development": 0.12, "Cybersecurity": 0.12, "Electronics": 0.10,
        "Robotics": 0.07, "Blockchain": 0.05, "Astronomy": 0.03,
    },
    "Arts_Culture": {
        "Cinema": 0.15, "Concert": 0.14, "Theater": 0.12, "Photography": 0.11,
        "Dance": 0.11, "Exhibition": 0.09, "Painting": 0.08, "Literature": 0.07,
        "Stand-up": 0.06, "Museums": 0.04, "Sculpture": 0.02, "Opera": 0.01,
    },
    "Hobbies_Lifestyle": {
        "Gaming": 0.13, "Reading": 0.12, "Food": 0.12, "Gastronomy": 0.10,
        "Travel": 0.10, "Chess": 0.09, "E-sports": 0.08, "Foreign Languages": 0.08,
        "Musical Instruments": 0.07, "Camping": 0.05, "Collecting": 0.03, "Gardening": 0.03,
    },
    "Social_Career": {
        "Workshop": 0.35, "Networking": 0.30, "Career Days": 0.20, "Volunteering": 0.15,
    },
}

# ─── FIX 3: Realistic hour distributions by category & day type ──────────────
# Previously all events were uniform random 8-22h, regardless of type
HOUR_PREFS = {
    "Sports": {
        "weekday": [7, 8, 17, 18, 19, 20],        # morning/evening training
        "weekend": [9, 10, 11, 15, 16, 17],
    },
    "Technology_Science": {
        "weekday": [10, 11, 14, 15, 16, 18, 19],  # daytime/evening meetups
        "weekend": [11, 12, 14, 15, 16],
    },
    "Arts_Culture": {
        "weekday": [18, 19, 20, 21],               # evening shows
        "weekend": [14, 15, 16, 18, 19, 20],
    },
    "Hobbies_Lifestyle": {
        "weekday": [18, 19, 20],
        "weekend": [11, 12, 13, 14, 15, 16, 17],
    },
    "Social_Career": {
        "weekday": [10, 11, 14, 15, 16, 17, 18, 19],
        "weekend": [11, 12, 13, 14],
    },
}


def sample_subcat(upper_cat):
    subs = SUBCAT_WEIGHTS[upper_cat]
    names = list(subs.keys())
    probs = np.array(list(subs.values()), dtype=float)
    probs /= probs.sum()
    return np.random.choice(names, p=probs)


def sample_start_hour(upper_cat, is_weekend):
    key = "weekend" if is_weekend else "weekday"
    hours = HOUR_PREFS[upper_cat][key]
    return random.choice(hours)


# ─── CELL 3: User generation ─────────────────────────────────────────────────
def generate_users_v4(num_users=100_000):
    print(f"Generating {num_users:,} users with probabilistic archetypes...")
    user_ids = [str(uuid.uuid4()) for _ in range(num_users)]

    upper_cats = list(UPPER_CAT_PROBS.keys())
    upper_probs = list(UPPER_CAT_PROBS.values())
    sampled_archetypes = np.random.choice(upper_cats, size=num_users, p=upper_probs)

    interest_tags = []
    for arch in sampled_archetypes:
        tags = []
        n_tags = np.random.randint(2, 6)
        for _ in range(n_tags):
            if random.random() < 0.70:
                tags.append(sample_subcat(arch))
            else:
                rand_cat = random.choice(upper_cats)
                tags.append(sample_subcat(rand_cat))
        interest_tags.append(list(set(tags)))

    df = pd.DataFrame({
        'userId':          user_ids,
        'archetype':       sampled_archetypes,
        'interestTags':    interest_tags,
        'reputationScore': np.random.randint(0, 501, size=num_users),
        'isStudent':       np.random.choice([True, False], size=num_users, p=[0.7, 0.3]),
        'isAvailable':     np.random.choice([True, False], size=num_users, p=[0.8, 0.2]),
        'longitude':       np.round(np.random.uniform(32.75, 32.88, size=num_users), 4),
        'latitude':        np.round(np.random.uniform(39.85, 39.95, size=num_users), 4),
    })
    return df


df_users = generate_users_v4(100_000)
print(f"\nShape: {df_users.shape}")
print(df_users['archetype'].value_counts())

# ─── CELL 4: Friendships & Schedules ────────────────────────────────────────
def generate_friendships_v3(df_users, conn_per_user=5):
    print("Generating friendship edges...")
    user_ids = df_users['userId'].values
    u1 = np.repeat(user_ids, conn_per_user)
    u2 = np.random.choice(user_ids, size=len(u1))
    mask = u1 != u2
    df = pd.DataFrame({'user_id_1': u1[mask], 'user_id_2': u2[mask], 'status': 'ACCEPTED'}).drop_duplicates()
    print(f"  {len(df):,} edges created.")
    return df


def generate_schedules_v3(df_users, days_to_generate=7):
    print(f"Generating {days_to_generate}-day HOURLY schedules (vectorized)...")
    u_ids = df_users['userId'].values
    n = len(u_ids)

    base_date = datetime(2026, 2, 24)

    prob_table = np.zeros((7, 24, 3), dtype=np.float32)
    for d in range(7):
        is_weekend = d >= 5
        for h in range(24):
            if is_weekend:
                if   h < 8:  p = [0.10, 0.85, 0.05]
                elif h < 11: p = [0.50, 0.40, 0.10]
                elif h < 22: p = [0.70, 0.20, 0.10]
                else:        p = [0.20, 0.70, 0.10]
            else:
                if   h < 8:  p = [0.05, 0.90, 0.05]
                elif h < 17: p = [0.15, 0.75, 0.10]
                elif h < 22: p = [0.65, 0.25, 0.10]
                else:        p = [0.15, 0.75, 0.10]
            prob_table[d, h] = p

    TYPES = np.array(["FREE", "BUSY", "TENTATIVE"])
    chunks = []

    for d in range(days_to_generate):
        current_day = base_date + timedelta(days=d)
        date_str = current_day.strftime("%Y-%m-%d")
        day_name = current_day.strftime("%A")
        for h in range(24):
            probs = prob_table[d, h]
            type_idx = np.random.choice(3, size=n, p=probs)
            types = TYPES[type_idx]
            chunks.append({
                'userId':    u_ids,
                'startTime': f"{date_str}T{h:02d}:00:00Z",
                'endTime':   f"{date_str}T{(h+1)%24:02d}:00:00Z",
                'type':      types,
                'dayOfWeek': day_name,
                'hour':      h,
            })

    all_user_ids = np.tile(u_ids, days_to_generate * 24)
    all_types    = np.concatenate([c['type']      for c in chunks])
    all_days     = np.repeat([c['dayOfWeek'] for c in chunks], n)
    all_hours    = np.repeat([c['hour']      for c in chunks], n)
    all_starts   = np.repeat([c['startTime'] for c in chunks], n)
    all_ends     = np.repeat([c['endTime']   for c in chunks], n)

    df = pd.DataFrame({
        'userId':    all_user_ids,
        'startTime': all_starts,
        'endTime':   all_ends,
        'type':      all_types,
        'dayOfWeek': all_days,
        'hour':      all_hours,
    })
    df['type']      = df['type'].astype('category')
    df['dayOfWeek'] = df['dayOfWeek'].astype('category')
    df['hour']      = df['hour'].astype(np.int8)

    print(f"  {len(df):,} slots | RAM: {df.memory_usage(deep=True).sum() / 1e6:.1f} MB")
    return df


df_friendships     = generate_friendships_v3(df_users, 5)
df_smart_schedules = generate_schedules_v3(df_users, 7)

# ─── CELL 5: Locations ──────────────────────────────────────────────────────
import pandas as pd
import uuid

def load_static_locations(file_path):
    print(f"Loading locations from {file_path}...")
    try:
        df_locs = pd.read_parquet(file_path)
        print(f"✅ Loaded {len(df_locs)} unique venues from file.")
        return df_locs
    except Exception as e:
        print(f"❌ File not found, using minimal fallback: {e}")
        return pd.DataFrame([
            {"locationId": str(uuid.uuid4()), "name": "Ankara Center",
             "longitude": 32.8597, "latitude": 39.9272, "type": "CAFE"}
        ])

df_locations = load_static_locations('/kaggle/input/datasets/keremkazandr/location/gatherup_locations_v3.parquet')
loc_pools = {t: grp for t, grp in df_locations.groupby('type')}

# ─── CELL 6: Smart Location Map ─────────────────────────────────────────────
SMART_LOC_MAP = {
    "Volleyball": ["SPORTS_HALL", "CAMPUS", "PARK"],
    "Basketball": ["SPORTS_HALL", "CAMPUS", "PARK"],
    "Football":   ["SPORTS_HALL", "PARK"],
    "Tennis":     ["SPORTS_HALL", "CAMPUS", "PARK"],
    "Swimming":   ["SPORTS_HALL", "CAMPUS"],
    "Running":    ["PARK", "CAMPUS"],
    "Yoga":       ["PARK", "SPORTS_HALL", "CAMPUS"],
    "Pilates":    ["SPORTS_HALL", "CAMPUS"],
    "Fitness":    ["SPORTS_HALL", "CAMPUS"],
    "Skateboarding": ["PARK", "CAMPUS"],
    "Cycling":    ["PARK", "CAMPUS"],
    "Archery":    ["SPORTS_HALL", "CAMPUS", "PARK"],
    "Mountaineering": ["PARK"],
    "Boxing":     ["SPORTS_HALL", "CAMPUS"],
    "Table Tennis": ["SPORTS_HALL", "CAMPUS", "CAFE"],
    "Software":              ["CAMPUS", "CAFE"],
    "Artificial Intelligence": ["CAMPUS", "CAFE"],
    "Data Science":          ["CAMPUS", "CAFE"],
    "Cybersecurity":         ["CAMPUS", "CAFE"],
    "Robotics":              ["CAMPUS"],
    "Game Development":      ["CAMPUS", "CAFE"],
    "Blockchain":            ["CAMPUS", "CAFE"],
    "Astronomy":             ["PARK", "CAMPUS"],
    "Electronics":           ["CAMPUS", "CAFE"],
    "Theater":      ["CAMPUS"],
    "Cinema":       ["CAMPUS", "CAFE"],
    "Concert":      ["PARK", "CAMPUS", "CAFE"],
    "Dance":        ["SPORTS_HALL", "CAMPUS", "PARK"],
    "Painting":     ["CAFE", "CAMPUS", "PARK"],
    "Sculpture":    ["CAMPUS", "CAFE"],
    "Literature":   ["CAFE", "CAMPUS", "PARK"],
    "Photography":  ["PARK", "CAMPUS", "CAFE"],
    "Exhibition":   ["CAMPUS", "CAFE"],
    "Stand-up":     ["CAFE", "CAMPUS"],
    "Museums":      ["CAMPUS", "PARK"],
    "Opera":        ["CAMPUS"],
    "Camping":              ["PARK"],
    "Chess":                ["CAFE", "CAMPUS"],
    "Reading":              ["CAFE", "PARK", "CAMPUS"],
    "Food":                 ["CAFE"],
    "Gastronomy":           ["CAFE"],
    "Gaming":               ["CAFE", "CAMPUS"],
    "E-sports":             ["CAFE", "CAMPUS"],
    "Gardening":            ["PARK"],
    "Travel":               ["CAFE", "CAMPUS"],
    "Foreign Languages":    ["CAFE", "CAMPUS", "PARK"],
    "Collecting":           ["CAFE", "CAMPUS"],
    "Musical Instruments":  ["CAFE", "CAMPUS", "PARK"],
    "Volunteering":  ["PARK", "CAMPUS", "CAFE"],
    "Networking":    ["CAFE", "CAMPUS"],
    "Career Days":   ["CAMPUS"],
    "Workshop":      ["CAFE", "CAMPUS"],
}

# ─── CELL 7: Event Generation (v32 — realistic timing & distribution) ────────
def _build_loc_lookup(loc_pools, df_locations, num_events, sampled_subs):
    sub_to_loc = {}
    for sub, allowed_types in SMART_LOC_MAP.items():
        chosen_pool = None
        for t in allowed_types:
            if t in loc_pools and len(loc_pools[t]) > 0:
                chosen_pool = loc_pools[t]
                break
        if chosen_pool is None:
            chosen_pool = df_locations
        mask = sampled_subs == sub
        count = int(mask.sum())
        if count == 0:
            continue
        samples = chosen_pool.sample(count, replace=True).reset_index(drop=True)
        sub_to_loc[sub] = {
            'mask':        mask,
            'locationIds': samples['locationId'].values,
            'lons':        samples['longitude'].values.astype(np.float32),
            'lats':        samples['latitude'].values.astype(np.float32),
        }
    return sub_to_loc


def generate_events_v32(num_events=1_000_000):
    """
    FIX: Events now use category-aware hour sampling instead of uniform 8-22h.
    FIX: Upper category chosen with realistic weights, subcategory within it also weighted.
    """
    print(f"Generating {num_events:,} events (v32 — realistic timing & distribution)...")

    event_ids     = np.array([str(uuid.uuid4()) for _ in range(num_events)])
    organizer_ids = np.random.choice(df_users['userId'].values, size=num_events)

    # FIX: Sample upper category with realistic probabilities
    upper_cats   = list(UPPER_CAT_PROBS.keys())
    upper_probs  = list(UPPER_CAT_PROBS.values())
    sampled_upper = np.random.choice(upper_cats, size=num_events, p=upper_probs)

    # FIX: Sample subcat within upper cat using per-category weights
    sampled_subs = np.empty(num_events, dtype=object)
    for i, uc in enumerate(sampled_upper):
        sampled_subs[i] = sample_subcat(uc)

    cluster_map_arr = np.array([CLUSTER_MAP[s] for s in sampled_subs])

    base_date   = np.datetime64('2026-02-24')
    days_offset = np.random.randint(-30, 15, size=num_events)

    # FIX: Hour sampling based on category + day-of-week
    hours_start = np.empty(num_events, dtype=int)
    for i in range(num_events):
        offset     = days_offset[i]
        day_of_week = (3 + offset) % 7   # 2026-02-24 is Tuesday (index 1), compute weekday
        is_weekend  = day_of_week >= 5
        upper_cat   = sampled_upper[i]
        hours_start[i] = sample_start_hour(upper_cat, is_weekend)

    days_offset_td = days_offset.astype('timedelta64[D]')
    hours_td       = hours_start.astype('timedelta64[h]')
    durations_h    = np.random.randint(1, 4, size=num_events)
    start_times    = base_date + days_offset_td + hours_td
    end_times      = start_times + durations_h.astype('timedelta64[h]')

    current_time = np.datetime64('2026-02-24T00:00:00')
    statuses     = np.where(end_times < current_time, 'COMPLETED', 'OPEN')

    print("  Vectorized location assignment...")
    loc_ids = np.empty(num_events, dtype=object)
    lons    = np.empty(num_events, dtype=np.float32)
    lats    = np.empty(num_events, dtype=np.float32)

    sub_to_loc = _build_loc_lookup(loc_pools, df_locations, num_events, sampled_subs)
    for sub, data in sub_to_loc.items():
        idx = np.where(data['mask'])[0]
        loc_ids[idx] = data['locationIds']
        lons[idx]    = data['lons']
        lats[idx]    = data['lats']

    df = pd.DataFrame({
        'eventId':      event_ids,
        'organizerId':  organizer_ids,
        'category':     cluster_map_arr,
        'subCategory':  sampled_subs,
        'status':       statuses,
        'locationId':   loc_ids,
        'longitude':    lons,
        'latitude':     lats,
        'startTime':    start_times,
        'endTime':      end_times,
        'durationMins': durations_h * 60,
        'minCapacity':  np.random.randint(2,  6, size=num_events).astype(np.int8),
        'maxCapacity':  np.random.randint(10, 51, size=num_events).astype(np.int8),
    })
    df['category']    = df['category'].astype('category')
    df['subCategory'] = df['subCategory'].astype('category')
    df['status']      = df['status'].astype('category')

    print(f"  Category distribution:\n{df['category'].value_counts()}")
    print(f"  Status: {df['status'].value_counts().to_dict()}")
    print(f"  RAM: {df.memory_usage(deep=True).sum() / 1e6:.1f} MB")
    return df


df_events_final = generate_events_v32(1_000_000)

# ─── CELL 8: Interactions (v32 — Hard Negative Mining) ───────────────────────
def generate_interactions_v32(df_u, df_e):
    """
    FIX: Hard Negative Mining — negatives are drawn from SAME upper category
    but DIFFERENT subcategory. This forces the model to learn fine-grained
    distinctions (e.g., Football vs Tennis) instead of only broad ones.

    Negative strategy:
      60% → same upper-cat, different subcat   (hard negative)
      40% → completely random                   (easy negative)
    """
    print("Generating cluster-aware interactions (v32 — hard negatives)...")

    completed     = df_e[df_e['status'] == 'COMPLETED']
    all_completed = completed['eventId'].values

    # Build pools
    sub_pools = {
        sub: completed[completed['subCategory'] == sub]['eventId'].values
        for sub in CLUSTER_MAP
    }
    group_pools = {
        grp: completed[completed['subCategory'].isin(
            [s for s, g in CLUSTER_MAP.items() if g == grp])
        ]['eventId'].values
        for grp in UPPER_CATEGORIES
    }

    # FIX: Build "hard negative" pools — same upper cat, but other subcategories
    hard_neg_pools = {}
    for sub, upper in CLUSTER_MAP.items():
        other_subs = [s for s, g in CLUSTER_MAP.items() if g == upper and s != sub]
        eids = completed[completed['subCategory'].isin(other_subs)]['eventId'].values
        hard_neg_pools[sub] = eids if len(eids) > 0 else all_completed

    u_ids    = df_u['userId'].values
    u_tags   = df_u['interestTags'].values
    u_clusters = df_u['archetype'].values

    pos_counts = np.clip(np.random.lognormal(3.5, 0.8, len(u_ids)).astype(int), 5, 200)
    neg_counts = np.clip(np.random.lognormal(3.5, 0.8, len(u_ids)).astype(int), 5, 200)

    user_ids_out, event_ids_out, labels_out, weights_out, match_types_out = [], [], [], [], []

    for idx in range(len(u_ids)):
        uid   = u_ids[idx]
        tags  = u_tags[idx]
        cid   = u_clusters[idx]
        if len(tags) == 0:
            continue

        n_pos = pos_counts[idx]
        n_neg = neg_counts[idx]

        # ── Positive samples ──────────────────────────────────────────────
        rolls = np.random.random(n_pos)
        loyal_mask   = rolls < 0.50
        diverse_mask = (rolls >= 0.50) & (rolls < 0.80)
        explore_mask = rolls >= 0.80

        n_loyal   = int(loyal_mask.sum())
        n_diverse = int(diverse_mask.sum())
        n_explore = int(explore_mask.sum())

        if n_loyal > 0:
            tag  = tags[np.random.randint(len(tags))]
            pool = sub_pools.get(tag, all_completed)
            pool = pool if len(pool) > 0 else all_completed
            sel  = np.random.choice(pool, size=n_loyal, replace=True)
            user_ids_out.extend([uid] * n_loyal);   event_ids_out.extend(sel)
            labels_out.extend([1] * n_loyal);        weights_out.extend([1.0] * n_loyal)
            match_types_out.extend(['related_loyal'] * n_loyal)

        if n_diverse > 0:
            pool = group_pools.get(cid, all_completed)
            pool = pool if len(pool) > 0 else all_completed
            sel  = np.random.choice(pool, size=n_diverse, replace=True)
            user_ids_out.extend([uid] * n_diverse);  event_ids_out.extend(sel)
            labels_out.extend([1] * n_diverse);       weights_out.extend([0.7] * n_diverse)
            match_types_out.extend(['related_diverse'] * n_diverse)

        if n_explore > 0:
            sel = np.random.choice(all_completed, size=n_explore, replace=True)
            user_ids_out.extend([uid] * n_explore);  event_ids_out.extend(sel)
            labels_out.extend([1] * n_explore);       weights_out.extend([0.3] * n_explore)
            match_types_out.extend(['exploration'] * n_explore)

        # ── Negative samples — FIX: Hard negatives ────────────────────────
        if n_neg > 0:
            # 60% hard (same upper cat, wrong subcat), 40% random
            n_hard = int(n_neg * 0.60)
            n_easy = n_neg - n_hard

            if n_hard > 0 and len(tags) > 0:
                tag      = tags[np.random.randint(len(tags))]
                hard_pool = hard_neg_pools.get(tag, all_completed)
                hard_sel = np.random.choice(hard_pool, size=n_hard,
                                            replace=len(hard_pool) < n_hard)
                user_ids_out.extend([uid] * n_hard);  event_ids_out.extend(hard_sel)
                labels_out.extend([0] * n_hard);       weights_out.extend([0.0] * n_hard)
                match_types_out.extend(['hard_negative'] * n_hard)

            if n_easy > 0:
                easy_sel = np.random.choice(all_completed, size=n_easy,
                                            replace=len(all_completed) < n_easy)
                user_ids_out.extend([uid] * n_easy);  event_ids_out.extend(easy_sel)
                labels_out.extend([0] * n_easy);       weights_out.extend([0.0] * n_easy)
                match_types_out.extend(['easy_negative'] * n_easy)

    df = pd.DataFrame({
        'userId':    user_ids_out,
        'eventId':   event_ids_out,
        'label':     np.array(labels_out,  dtype=np.int8),
        'weight':    np.array(weights_out, dtype=np.float32),
        'matchType': match_types_out,
    })
    df['matchType'] = df['matchType'].astype('category')
    print(f"  Total: {len(df):,} | Pos: {(df['label']==1).sum():,} | Neg: {(df['label']==0).sum():,}")
    print(f"  MatchType: {df['matchType'].value_counts().to_dict()}")
    return df


df_ncf_interactions = generate_interactions_v32(df_users, df_events_final)

# ─── CELL 9: Group Generative Data (v32) ─────────────────────────────────────
def generate_group_data_v32(df_u, df_e, df_interactions, df_schedules):
    """
    FIX: Added missing columns that event_generate notebook needs:
      - 'participants': list of user IDs in the group
      - 'group_schedule': 168-dim float32 (7 days x 24 hours free probability)
      - 'free_slots_score': scalar — average free-slot ratio across participants

    FIX: Interaction-based group building now enforces category alignment:
      participants are more likely to share an interest in the event subcategory.
    """
    print("Generating group training data (v32)...")

    # Build schedule lookup: userId → 168-dim vector
    day_order  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_to_idx = {d: i for i, d in enumerate(day_order)}

    print("  Building schedule pivot...")
    sched_tmp = df_schedules.copy()
    sched_tmp['is_free']  = (sched_tmp['type'] == 'FREE').astype(np.float32)
    sched_tmp['slot_idx'] = (
        sched_tmp['dayOfWeek'].map(day_to_idx).astype(int) * 24 +
        sched_tmp['hour'].astype(int)
    ).astype(np.int16)

    pivot = sched_tmp.pivot_table(
        index='userId', columns='slot_idx',
        values='is_free', aggfunc='mean', fill_value=0.0
    )
    pivot = pivot.reindex(columns=range(168), fill_value=0.0)
    sched_matrix  = pivot.values.astype(np.float32)
    sched_uid_idx = {uid: i for i, uid in enumerate(pivot.index)}
    del sched_tmp
    gc.collect()

    # Build tag lookup
    MASTER_52 = sorted(CLUSTER_MAP.keys())
    mlb = MultiLabelBinarizer(classes=MASTER_52)
    mlb.fit([MASTER_52])

    user_tags_dict = dict(zip(df_u['userId'], df_u['interestTags']))
    user_loc_dict  = dict(zip(df_u['userId'], zip(df_u['longitude'], df_u['latitude'])))

    loc_scaler = StandardScaler()
    all_locs   = np.array(list(user_loc_dict.values()), dtype=np.float32)
    loc_scaler.fit(all_locs)

    event_info = df_e.set_index('eventId')[['subCategory', 'startTime', 'category']].to_dict('index')

    # Use positive interactions to build groups
    pos = df_interactions[df_interactions['label'] == 1]
    event_participants = pos.groupby('eventId')['userId'].apply(list).to_dict()
    group_events = {eid: plist for eid, plist in event_participants.items()
                    if len(plist) >= 2}

    print(f"  {len(group_events):,} events with ≥2 participants")

    gen_data = []

    for eid, participants in group_events.items():
        if eid not in event_info:
            continue
        einfo   = event_info[eid]
        p_count = len(participants)

        # ── Interest features ─────────────────────────────────────────────
        group_tags    = [user_tags_dict.get(uid, []) for uid in participants]
        group_binary  = mlb.transform(group_tags).astype(np.float32)
        sum_interests = group_binary.sum(axis=0) / p_count
        interest_div  = float(np.mean(np.std(group_binary, axis=0)))

        # ── Location features ─────────────────────────────────────────────
        locs   = [user_loc_dict.get(uid, (32.85, 39.92)) for uid in participants]
        lons, lats = zip(*locs)
        avg_loc_raw    = np.array([[np.mean(lons), np.mean(lats)]], dtype=np.float32)
        avg_loc_scaled = loc_scaler.transform(avg_loc_raw)[0]
        max_dist = float(np.max(
            np.sqrt((np.array(lons) - avg_loc_raw[0, 0])**2 +
                    (np.array(lats) - avg_loc_raw[0, 1])**2)
        ))

        # ── FIX: Group schedule (168-dim) & free_slots_score ─────────────
        valid_sched_users = [uid for uid in participants if uid in sched_uid_idx]
        if valid_sched_users:
            indices    = [sched_uid_idx[uid] for uid in valid_sched_users]
            group_sched = sched_matrix[indices].mean(axis=0)   # (168,) mean free prob
            free_slots_score = float(group_sched.mean())
        else:
            group_sched      = np.zeros(168, dtype=np.float32)
            free_slots_score = 0.0

        # ── Target extraction ─────────────────────────────────────────────
        try:
            st         = pd.to_datetime(einfo['startTime'])
            target_day  = st.day_name()
            target_hour = st.hour
        except Exception:
            target_day, target_hour = 'Monday', 12

        gen_data.append({
            # Input features (X)
            'participant_count':  p_count,
            'avg_interests':      sum_interests.tolist(),
            'interest_diversity': interest_div,
            'avg_longitude':      float(avg_loc_scaled[0]),
            'avg_latitude':       float(avg_loc_scaled[1]),
            'max_geo_spread':     max_dist,
            # FIX: New required columns
            'participants':       participants,          # list[str]
            'group_schedule':     group_sched.tolist(),  # list[float], 168-dim
            'free_slots_score':   free_slots_score,      # float scalar
            # Target labels (Y)
            'target_subCategory': str(einfo['subCategory']),
            'target_day':         target_day,
            'target_hour':        target_hour,
        })

    df = pd.DataFrame(gen_data)
    print(f"  Generated {len(df):,} group training samples.")
    print(f"  Columns: {list(df.columns)}")
    return df


df_group_train = generate_group_data_v32(df_users, df_events_final, df_ncf_interactions, df_smart_schedules)

# ─── CELL 10: Save ────────────────────────────────────────────────────────────
print("Saving all datasets...")

df_events_export = df_events_final.copy()
df_events_export['startTime'] = df_events_export['startTime'].astype(str)
df_events_export['endTime']   = df_events_export['endTime'].astype(str)

df_users.to_parquet('gatherup_users.parquet', engine='pyarrow')
df_events_export.to_parquet('gatherup_events.parquet', engine='pyarrow')
df_ncf_interactions.to_parquet('gatherup_interactions.parquet', engine='pyarrow')
df_friendships.to_parquet('gatherup_friendships.parquet', engine='pyarrow')
df_smart_schedules.to_parquet('gatherup_schedules.parquet', engine='pyarrow')
df_group_train.to_parquet('gatherup_group_generative.parquet', engine='pyarrow')
df_locations.to_parquet('gatherup_locations.parquet', engine='pyarrow')

df_users.to_csv('gatherup_users_v3.csv', index=False)
df_ncf_interactions.to_csv('gatherup_interactions_v3.csv', index=False)

print()
for name, df in [
    ('Users',            df_users),
    ('Events',           df_events_export),
    ('Interactions',     df_ncf_interactions),
    ('Friendships',      df_friendships),
    ('Schedules',        df_smart_schedules),
    ('Group Generative', df_group_train),
    ('Locations',        df_locations),
]:
    print(f"  {name:20s}: {df.shape[0]:>10,} rows x {df.shape[1]:>3} cols")

print("\n✅ All datasets exported successfully!")

