import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { Event, EventCategory, EventStatus, EventVisibility } from '../core/event/Event';
import { User } from '../core/identity/User';
import { ScheduleManager } from '../core/schedule/ScheduleManager';
import { BlockType, DataSource, TimeSlot } from '../core/schedule/TimeSlot';
import { SupabaseClient } from '../infra/SupabaseClient';
import { Location, LocationType } from '../spatial/Location';
import { VectorService } from './VectorService';

export interface PlanProposal {
    suggestedTime?: Date;
    suggestedLocation?: Location;
    matchingEvents?: Event[];
    suggestedCategory?: string;
    suggestedSubCategory?: string;
    suggestedSubCategoryUI?: string;
    suggestedTitle?: string;
    suggestedTags?: string;
}

// ─── Model Assets ─────────────────────────────────────────────────────────────
const SUBCAT_TO_IDX_JSON = require('../../assets/models/subcat_to_idx.json');
const CAT_ENCODER_JSON = require('../../assets/models/cat_encoder.json');
const USER_COORD_SCALER = require('../../assets/models/user_coord_scaler.json');
const EVENT_COORD_SCALER = require('../../assets/models/event_coord_scaler.json');
const EVENT_DUR_SCALER = require('../../assets/models/event_dur_scaler.json');

/** 52 subcategories in sorted order — index position is the embedding index. */
export const MASTER_52: string[] = CAT_ENCODER_JSON;
const MASTER_52_SORTED: string[] = CAT_ENCODER_JSON;

/** Maps subcategory name → index in MASTER_52_SORTED */
const SUBCAT_TO_IDX: Record<string, number> = SUBCAT_TO_IDX_JSON;

/** Upper categories in the same order as the model's UPPER_CATEGORIES list. */
const UPPER_CATEGORIES = [
    'Sports',
    'Technology_Science',
    'Arts_Culture',
    'Hobbies_Lifestyle',
    'Social_Career',
] as const;

/** Maps each subcategory to its upper category. */
const CLUSTER_MAP: Record<string, string> = {
    Volleyball: 'Sports', Basketball: 'Sports', Football: 'Sports', Tennis: 'Sports',
    Swimming: 'Sports', Running: 'Sports', Yoga: 'Sports', Pilates: 'Sports',
    Fitness: 'Sports', Skateboarding: 'Sports', Cycling: 'Sports', Archery: 'Sports',
    Mountaineering: 'Sports', Boxing: 'Sports', 'Table Tennis': 'Sports',
    Software: 'Technology_Science', 'Artificial Intelligence': 'Technology_Science',
    'Data Science': 'Technology_Science', Cybersecurity: 'Technology_Science',
    Robotics: 'Technology_Science', 'Game Development': 'Technology_Science',
    Blockchain: 'Technology_Science', Astronomy: 'Technology_Science',
    Electronics: 'Technology_Science',
    Theater: 'Arts_Culture', Cinema: 'Arts_Culture', Concert: 'Arts_Culture',
    Dance: 'Arts_Culture', Painting: 'Arts_Culture', Sculpture: 'Arts_Culture',
    Literature: 'Arts_Culture', Photography: 'Arts_Culture', Exhibition: 'Arts_Culture',
    'Stand-up': 'Arts_Culture', Museums: 'Arts_Culture', Opera: 'Arts_Culture',
    Camping: 'Hobbies_Lifestyle', Chess: 'Hobbies_Lifestyle', Reading: 'Hobbies_Lifestyle',
    Food: 'Hobbies_Lifestyle', Gastronomy: 'Hobbies_Lifestyle', Gaming: 'Hobbies_Lifestyle',
    'E-sports': 'Hobbies_Lifestyle', Gardening: 'Hobbies_Lifestyle', Travel: 'Hobbies_Lifestyle',
    'Foreign Languages': 'Hobbies_Lifestyle', Collecting: 'Hobbies_Lifestyle',
    'Musical Instruments': 'Hobbies_Lifestyle',
    Volunteering: 'Social_Career', Networking: 'Social_Career',
    'Career Days': 'Social_Career', Workshop: 'Social_Career',
};

const UI_TO_AI_MAP: Record<string, string> = {
    'AI': 'Artificial Intelligence',
    'Cyber Security': 'Cybersecurity',
    'Game Dev': 'Game Development',
    'Concerts': 'Concert',
    'Exhibitions': 'Exhibition',
    'Cooking': 'Food',
    'Traveling': 'Travel',
    'Languages': 'Foreign Languages',
    'Guitar': 'Musical Instruments',
    'Career Fairs': 'Career Days',
    'Workshops': 'Workshop'
};

/**
 * Event clusters for UI display — keys now match model's UPPER_CATEGORIES.
 * Values use the canonical MASTER_52 subcategory names.
 */
export const EVENT_CLUSTERS: Record<string, string[]> = {
    Sports: [
        'Volleyball', 'Basketball', 'Football', 'Tennis', 'Swimming', 'Running',
        'Yoga', 'Pilates', 'Fitness', 'Skateboarding', 'Cycling', 'Archery',
        'Mountaineering', 'Boxing', 'Table Tennis',
    ],
    Technology_Science: [
        'Software', 'Artificial Intelligence', 'Data Science', 'Cybersecurity',
        'Robotics', 'Game Development', 'Blockchain', 'Astronomy', 'Electronics',
    ],
    Arts_Culture: [
        'Theater', 'Cinema', 'Concert', 'Dance', 'Painting', 'Sculpture',
        'Literature', 'Photography', 'Exhibition', 'Stand-up', 'Museums', 'Opera',
    ],
    Hobbies_Lifestyle: [
        'Camping', 'Chess', 'Reading', 'Food', 'Gastronomy', 'Gaming',
        'E-sports', 'Gardening', 'Travel', 'Foreign Languages', 'Collecting',
        'Musical Instruments',
    ],
    Social_Career: ['Volunteering', 'Networking', 'Career Days', 'Workshop'],
};

// ─── Scaler Parameters ───────────────────────────────────────────────────────
// Pulled from assets/models/*.json

// User scaler: [lon, lat]
const USER_LON_MEAN = USER_COORD_SCALER.mean[0];
const USER_LON_STD = USER_COORD_SCALER.scale[0];
const USER_LAT_MEAN = USER_COORD_SCALER.mean[1];
const USER_LAT_STD = USER_COORD_SCALER.scale[1];

// Event scaler: [lat, lon] -> DİKKAT: Sıralama farklı olabilir
const EVENT_LAT_MEAN = EVENT_COORD_SCALER.mean[0];
const EVENT_LAT_STD = EVENT_COORD_SCALER.scale[0];
const EVENT_LON_MEAN = EVENT_COORD_SCALER.mean[1];
const EVENT_LON_STD = EVENT_COORD_SCALER.scale[1];

// Duration scaler
const EVENT_DUR_MEAN = EVENT_DUR_SCALER.mean[0];
const EVENT_DUR_STD = EVENT_DUR_SCALER.scale[0];

// Group Model Defaults (if no JSON available or incomplete)
const GROUP_SPREAD_MEAN = 10.0;
const GROUP_SPREAD_STD = 5.0;
const GROUP_FREE_SCORE_MEAN = 0.65;
const GROUP_FREE_SCORE_STD = 0.15;

const MAX_HIST = 10; // matches user tower expected dimension

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derives the dominant archetype from a user's interest tags. */
function deriveArchetype(interestTags: string[]): string {
    const counts: Record<string, number> = {};
    for (const tag of interestTags) {
        const cat = CLUSTER_MAP[tag];
        if (cat) counts[cat] = (counts[cat] || 0) + 1;
    }
    let best = 'Hobbies_Lifestyle';
    let bestCount = -1;
    for (const [cat, cnt] of Object.entries(counts)) {
        if (cnt > bestCount) { best = cat; bestCount = cnt; }
    }
    return best;
}

/** Converts interest tag list to a 52-dim binary Float32Array. */
function buildInterestsBinary(interestTags: string[]): Float32Array {
    const vec = new Float32Array(MASTER_52_SORTED.length);
    for (const tag of interestTags) {
        const canonical = UI_TO_AI_MAP[tag] || tag;
        const idx = SUBCAT_TO_IDX[canonical];
        if (idx !== undefined) vec[idx] = 1.0;
    }
    return vec;
}

/** Converts archetype string + user lon/lat to 7-dim context Float32Array. */
function buildContext(archetype: string, lon: number, lat: number): Float32Array {
    const ctx = new Float32Array(7);
    const catIdx = UPPER_CATEGORIES.indexOf(archetype as any);
    if (catIdx >= 0) ctx[catIdx] = 1.0;     // 5-dim one-hot
    ctx[5] = (lon - USER_LON_MEAN) / USER_LON_STD;
    ctx[6] = (lat - USER_LAT_MEAN) / USER_LAT_STD;
    return ctx;
}

/** Builds a 7-dim numeric feature vector for a single past event. */
function buildEventNumeric(lat: number, lon: number, durationMins: number, startTime: Date): Float32Array {
    const scaledLon = (lon - EVENT_LON_MEAN) / EVENT_LON_STD;
    const scaledLat = (lat - EVENT_LAT_MEAN) / EVENT_LAT_STD;
    const scaledDur = (durationMins - EVENT_DUR_MEAN) / EVENT_DUR_STD;
    const hours = startTime.getHours() + startTime.getMinutes() / 60.0;
    const hourSin = Math.sin((2 * Math.PI * hours) / 24.0);
    const hourCos = Math.cos((2 * Math.PI * hours) / 24.0);
    const dow = startTime.getDay() === 0 ? 6 : startTime.getDay() - 1; // 0=Mon
    const dowSin = Math.sin((2 * Math.PI * dow) / 7.0);
    const dowCos = Math.cos((2 * Math.PI * dow) / 7.0);
    return new Float32Array([scaledLon, scaledLat, scaledDur, hourSin, hourCos, dowSin, dowCos]);
}

/** Haversine distance in km. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── RecommendationEngine ─────────────────────────────────────────────────────

export class RecommendationEngine {
    private static instance: RecommendationEngine;

    private constructor() { }

    public static getInstance(): RecommendationEngine {
        if (!RecommendationEngine.instance) {
            RecommendationEngine.instance = new RecommendationEngine();
        }
        return RecommendationEngine.instance;
    }

    /**
     * One-tap event suggestion entry point.
     */
    public async getOneTapSuggestion(user: any, loc: Location): Promise<Event[]> {
        const targetUserId = user.userId || user.id;
        return this.fetchRecommendedEvents(
            targetUserId,
            loc.coordinates.latitude,
            loc.coordinates.longitude
        );
    }

    /**
     * Group plan suggestion logic.
     * Inputs: scalar_input (1,59) + schedule_input (1,168).
     *
     * scalar_input layout (59-dim):
     *   avg_interests(52) + diversity(1) + avg_loc(2) + p_count(1) + geo_spread(1)
     *   + free_score(1) + interest_alignment(1)
     */
    public async getGroupSuggestion(users: User[]): Promise<{ features: Float32Array; proposal: PlanProposal }> {
        const numUsers = users.length;
        // BUG FIX: Filter out invalid/undefined userIds to prevent Supabase UUID errors
        // create.tsx'den gelen objeler Supabase'den direk geldiği için 'userId' yerine 'id' alanına sahipler.
        const userIds = users.map((u: any) => u.userId || u.id).filter(id => id && id !== 'undefined');
        console.log("Extracted IDs:", userIds);

        if (userIds.length === 0) {
            console.warn('getGroupSuggestion: No valid user IDs found.');
            return { features: new Float32Array(58), proposal: {} };
        }

        // 1. Fetch real schedules for all members
        const scheduleMgr = new ScheduleManager();
        const userSchedules = await scheduleMgr.getBulkSchedules(userIds);

        // 2. Build aggregated schedule mask (168-dim) and calculate free score
        // Each slot is 1 (FREE) only if NO user is BUSY at that exact hour of the week.
        const scheduleMask = new Float32Array(168).fill(1.0);
        for (const slots of Object.values(userSchedules)) {
            for (const slot of slots) {
                if (slot.type === BlockType.BUSY) {
                    const start = new Date(slot.startTime);
                    const end = new Date(slot.endTime);
                    let day = start.getDay() - 1; // 0=Mon
                    if (day < 0) day = 6;

                    const startHour = start.getHours();
                    const endHour = end.getHours() || 24; // Handle midnight

                    for (let h = startHour; h < endHour; h++) {
                        const idx = day * 24 + h;
                        if (idx >= 0 && idx < 168) scheduleMask[idx] = 0.0;
                    }
                }
            }
        }

        const freeScore = scheduleMask.reduce((a, b) => a + b, 0) / 168.0;
        const scaledFreeScore = (freeScore - GROUP_FREE_SCORE_MEAN) / GROUP_FREE_SCORE_STD;

        // 3. Build interest matrices
        const interestMtx: Float32Array[] = users.map(u =>
            buildInterestsBinary(u.interestTags || [])
        );

        const avgInterests = new Float32Array(MASTER_52_SORTED.length);
        for (const vec of interestMtx) {
            for (let i = 0; i < vec.length; i++) avgInterests[i] += vec[i];
        }
        for (let i = 0; i < avgInterests.length; i++) avgInterests[i] /= numUsers;

        // 4. Diversity
        let divSum = 0;
        for (let i = 0; i < MASTER_52_SORTED.length; i++) {
            let varSum = 0;
            for (const vec of interestMtx) {
                varSum += (vec[i] - avgInterests[i]) ** 2;
            }
            divSum += Math.sqrt(varSum / numUsers);
        }
        const diversity = divSum / MASTER_52_SORTED.length;

        // 5. Spatial features
        const lons = users.map(u => u.locationBased?.coordinates?.longitude ?? 32.815);
        const lats = users.map(u => u.locationBased?.coordinates?.latitude ?? 39.900);
        const avgLon = lons.reduce((a, b) => a + b, 0) / numUsers;
        const avgLat = lats.reduce((a, b) => a + b, 0) / numUsers;
        const scaledAvgLon = (avgLon - USER_LON_MEAN) / USER_LON_STD;
        const scaledAvgLat = (avgLat - USER_LAT_MEAN) / USER_LAT_STD;

        let maxGeoSpread = 0;
        for (let i = 0; i < numUsers; i++) {
            const d = Math.sqrt((lons[i] - avgLon) ** 2 + (lats[i] - avgLat) ** 2);
            if (d > maxGeoSpread) maxGeoSpread = d;
        }
        const scaledGeoSpread = (maxGeoSpread - GROUP_SPREAD_MEAN) / GROUP_SPREAD_STD;

        const pCount = Math.log1p(numUsers);

        // ──────────────────────────────────────────────────────────────────
        // 6. Assemble scalar_input (58-dim)
        const scalarInput = new Float32Array(58);
        scalarInput.set(avgInterests, 0); // 52
        scalarInput[52] = diversity;      // 1
        scalarInput[53] = scaledAvgLon;   // 1
        scalarInput[54] = scaledAvgLat;   // 1
        scalarInput[55] = pCount;         // 1
        scalarInput[56] = scaledGeoSpread; // 1
        scalarInput[57] = scaledFreeScore; // 1

        let finalProposal: PlanProposal = {
            suggestedTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        };

        try {
            if (Platform.OS === 'web') throw new Error('ONNX not supported on web');

            const modelAsset = await Asset.loadAsync(
                require('../../assets/models/gatherup_group_model.onnx')
            );
            const modelUri = modelAsset[0].localUri || modelAsset[0].uri;
            if (!modelUri) throw new Error('Group model URI not found');

            const ONNX = require('onnxruntime-react-native');
            const session = await ONNX.InferenceSession.create(modelUri);
            const TensorClass = ONNX.Tensor;

            const scalarTensor = new TensorClass('float32', scalarInput, [1, 58]);
            const scheduleTensor = new TensorClass('float32', scheduleMask, [1, 168]);

            const results = await session.run({
                scalar_input: scalarTensor,
                schedule_input: scheduleTensor,
            });

            // ── Extract Logits ──────────────────────────────────────────────
            let catLogits: Float32Array = results['category_logits']?.data as Float32Array
                ?? (results[Object.keys(results)[0]]?.data as Float32Array);
            let dayLogits: Float32Array = results['day_logits']?.data as Float32Array
                ?? (results[Object.keys(results)[1]]?.data as Float32Array);
            let hourLogits: Float32Array = results['hour_logits']?.data as Float32Array
                ?? (results[Object.keys(results)[2]]?.data as Float32Array);

            const softmax = (arr: Float32Array): number[] => {
                const max = Math.max(...Array.from(arr));
                const exps = Array.from(arr).map(x => Math.exp(x - max));
                const sum = exps.reduce((a, b) => a + b, 0);
                return exps.map(x => x / sum);
            };

            const dayProbs = softmax(dayLogits);
            const hourProbs = softmax(hourLogits);

            // ── Business Logic: Soft Masking + Time Bonus Matrix ──────────────
            const now = new Date();
            let currentDayIdx = now.getDay() - 1;
            if (currentDayIdx < 0) currentDayIdx = 6;
            const currentHour = now.getHours();

            const finalScores = new Float32Array(168);
            for (let d = 0; d < 7; d++) {
                for (let h = 0; h < 24; h++) {
                    const idx = d * 24 + h;

                    // 1. Raw match score
                    let score = dayProbs[d] * hourProbs[h];

                    // 2. Schedule Mask (Everyone Free = 1, Anyone Busy = 0)
                    score *= scheduleMask[idx];

                    // 3. Current Time Mask (Don't suggest the past)
                    if (d < currentDayIdx || (d === currentDayIdx && h <= currentHour)) {
                        score *= 0.1; // Penalty for past/immediate slots to force "Next Week" fallback if needed
                    }

                    // 4. Time Bonus Matrix
                    let bonus = 1.0;
                    if (d < 5 && h >= 18 && h < 23) bonus = 1.20; // Weekday Evening
                    else if (d >= 5 && h >= 12 && h < 23) bonus = 1.30; // Weekend Afternoon/Evening
                    if (h >= 1 && h < 9) bonus = 0.20; // Night Penalty

                    finalScores[idx] = score * bonus;
                }
            }

            let bestIdx = -1;
            let maxScore = -1;
            for (let i = 0; i < 168; i++) {
                if (finalScores[i] > maxScore) {
                    maxScore = finalScores[i];
                    bestIdx = i;
                }
            }

            // Fallback if everyone is busy 24/7 (should be rare)
            if (bestIdx === -1) bestIdx = currentDayIdx * 24 + ((currentHour + 2) % 24);

            const resDay = Math.floor(bestIdx / 24);
            const resHour = bestIdx % 24;

            // ── Best Category Logic ────────────────────────────────────────
            let bestCatIdx = 0;
            let bestCatVal = -Infinity;
            for (let i = 0; i < catLogits.length; i++) {
                if (catLogits[i] > bestCatVal) {
                    bestCatVal = catLogits[i];
                    bestCatIdx = i;
                }
            }
            const rawCat = MASTER_52_SORTED[bestCatIdx];

            const AI_TO_UI_MAP: Record<string, string> = {
                'Artificial Intelligence': 'AI',
                'Cybersecurity': 'Cyber Security',
                'Game Development': 'Game Dev',
                'Concert': 'Concerts',
                'Exhibition': 'Exhibitions',
                'Food': 'Cooking',
                'Travel': 'Traveling',
                'Foreign Languages': 'Languages',
                'Musical Instruments': 'Guitar',
                'Career Days': 'Career Fairs',
                'Workshop': 'Workshops'
            };

            const predictedSubCat = AI_TO_UI_MAP[rawCat] || rawCat;
            const predictedCat = CLUSTER_MAP[rawCat] || 'Social_Career';

            // Resolve target date
            const targetTime = new Date(now);
            let daysToAdd = resDay - currentDayIdx;
            if (daysToAdd < 0 || (daysToAdd === 0 && resHour <= currentHour)) daysToAdd += 7;
            targetTime.setDate(targetTime.getDate() + daysToAdd);
            targetTime.setHours(resHour, 0, 0, 0);

            console.log(`🚀 GROUP GEN → ${predictedSubCat} on ${targetTime.toDateString()} at ${resHour}:00`);

            finalProposal = {
                suggestedTime: targetTime,
                suggestedCategory: predictedCat,
                suggestedSubCategory: rawCat, // Canonical name for DB
                suggestedSubCategoryUI: predictedSubCat, // For display
                suggestedTitle: predictedSubCat,
                suggestedTags: '', // Sadece 1 tür seçiliyor, ekstra taglere gerek kalmadı
            };

            // ── Phase 3: Post-Inference Real Event Matching ───────────────────
            console.log('🔍 Searching for matching real events...');
            const supabase = SupabaseClient.getInstance().client;

            // Search range: ±12 hours around suggested time
            const timeLower = new Date(targetTime.getTime() - 12 * 60 * 60 * 1000).toISOString();
            const timeUpper = new Date(targetTime.getTime() + 12 * 60 * 60 * 1000).toISOString();

            const { data: realEvents, error: searchError } = await supabase
                .from('events')
                .select('*')
                .eq('sub_category', predictedSubCat)
                .eq('status', 'UPCOMING')
                .gte('start_time', timeLower)
                .lte('start_time', timeUpper)
                .limit(5);

            if (!searchError && realEvents && realEvents.length > 0) {
                console.log(`✅ Found ${realEvents.length} matching real events!`);
                finalProposal.matchingEvents = realEvents.map((ev: any) => this.mapToEvent(ev));
            }

        } catch (e) {
            console.error('Group model ONNX error:', e);
        }

        return { features: scalarInput, proposal: finalProposal };
    }

    /**
     * Fetches personalized events using the Two-Tower User Tower.
     *
     * User Tower inputs (6 tensors):
     *   interests  (1, 52)           — binary interest tag vector
     *   context    (1, 7)            — archetype one-hot (5) + scaled lon/lat (2)
     *   count      (1, 1)            — log1p(past event count)
     *   hist_norm  (1, 1)            — L2 norm of history sequence
     *   hist_seq   (1, MAX_HIST, 7)  — per-event 7-dim numeric features (GRU input)
     *   hist_len   (1,)              — actual sequence length (long)
     *
     * Output: user_vector (1, 128) — cosine-comparable with event embeddings
     */
    public async fetchRecommendedEvents(
        userId: string,
        userLat: number,
        userLon: number
    ): Promise<Event[]> {
        try {
            const supabase = SupabaseClient.getInstance().client;

            // 1. Fetch user profile
            console.log('1. Fetching user profile...');
            const { data: userProfile, error: profileError } = await supabase
                .from('users')
                .select('interest_tags, past_events, base_location')
                .eq('id', userId)
                .single();

            if (profileError || !userProfile) {
                console.error('Profile fetch failed:', profileError);
                throw new Error('User not found or profile fetch failed.');
            }

            const interestTags: string[] = userProfile.interest_tags || [];
            const pastEventIds: string[] = userProfile.past_events || [];

            // Use DB coords from base_locations table if available
            let lat = userLat;
            let lon = userLon;

            if (userProfile.base_location) {
                console.log(`1.1. Resolving coordinates for: ${userProfile.base_location}`);
                const { data: locData, error: locError } = await supabase
                    .from('base_locations')
                    .select('latitude, longitude')
                    .eq('label', userProfile.base_location)
                    .single();

                if (!locError && locData) {
                    lat = locData.latitude;
                    lon = locData.longitude;
                    console.log(`📍 Resolved DB coords: ${lat}, ${lon}`);
                } else {
                    console.warn(`Could not resolve coordinates from DB for ${userProfile.base_location}, using fallbacks.`);
                }
            }

            // 2. Generate user_vector using local ONNX inference
            console.log('2. Running user tower inference (ONNX)...');
            const userVector = await VectorService.getInstance().runUserTowerInference(userId);
            console.log('3. User vector produced, dim:', userVector.length);

            // Auto-sync profile_vector to DB asynchronously
            VectorService.getInstance().generateUserEmbedding(userId)
                .catch(e => console.warn("Background embedding sync failed:", e));

            // 7. Vector search via Supabase RPC
            console.log('6. Querying match_events RPC...');

            const { data: topEvents, error: matchError } = await supabase.rpc('match_events', {
                query_embedding: userVector, // Passing array directly for better type handling
                match_threshold: 0.05,
                match_count: 500,
            });

            if (matchError) {
                console.error('match_events RPC Error:', JSON.stringify(matchError, null, 2));
                throw matchError;
            }
            console.log(`6.1. match_events returned ${topEvents?.length || 0} candidates.`);

            if (!topEvents || topEvents.length === 0) {
                console.log('✅ Pipeline complete. Suggestions: 0 (No vector matches)');
                return [];
            }

            // ─── Phase 2: Fetch full details for these IDs ─────────────────────────
            const candidateIds = topEvents.map((r: any) => r.id);
            const similarityMap = new Map<string, number>(
                topEvents.map((r: any) => [r.id, r.similarity || 0])
            );

            console.log('6.2. Fetching full event records for candidates...');
            const { data: fullEvents, error: fetchError } = await supabase
                .from('events')
                .select('*')
                .in('id', candidateIds);

            if (fetchError) {
                console.error('Full events fetch failed:', fetchError);
                throw fetchError;
            }

            // 8. Re-rank: Hybrid Scoring (Interest Bonus %25) + Distance Boost + Subcategory Diversity
            console.log('7. Re-ranking results (OPEN only, hybrid scoring, max 2 per sub, top 10)...');
            const scored = [];
            const activeInterests = new Set(interestTags);

            for (const event of (fullEvents || [])) {
                // Sadece UPCOMING olanları al (DB fonksiyonuyla uyumlu)
                const status = (event.status ?? '').toUpperCase();
                if (status !== 'UPCOMING') continue;

                // Merge similarity back from the RPC result
                let similarity = similarityMap.get(event.id) || 0;
                let baseScore = similarity;
                const sub = (event.sub_category ?? '').trim();

                // İŞ MANTIĞI: Kullanıcının aktif ilgi alanına giriyorsa %25 Bonus
                if (activeInterests.has(sub)) {
                    baseScore = baseScore * 1.25;
                }

                let finalScore = baseScore;
                // Use latitude/longitude or location_lat/location_lng depending on table schema
                const evLat = event.latitude ?? event.location_lat ?? 0;
                const evLon = event.longitude ?? event.location_lng ?? 0;

                const distKm = haversineKm(userLat, userLon, evLat, evLon);
                if (distKm < 2.0) finalScore += 0.15;
                else if (distKm > 15.0) finalScore -= 0.20;

                scored.push({
                    ...event,
                    similarity, // ensure similarity is inside for mapToEvent
                    distanceKm: +distKm.toFixed(2),
                    matchScore: +finalScore.toFixed(3)
                });
            }

            scored.sort((a, b) => b.matchScore - a.matchScore);

            const picked: typeof scored = [];
            const subcatCounts: Record<string, number> = {};
            const TOP_K = 3;

            for (const event of scored) {
                const sub = (event.sub_category ?? '').trim();
                const count = subcatCounts[sub] || 0;

                // Maksimum çeşitlilik için her alt kategoriden sadece 1 tane al
                if (count < 1) {
                    picked.push(event);
                    subcatCounts[sub] = count + 1;
                }

                if (picked.length === TOP_K) break;
            }

            const suggestions = picked.map(ev => this.mapToEvent(ev));
            console.log(`✅ Pipeline complete. Suggestions: ${suggestions.length}`);
            return suggestions;

        } catch (error) {
            console.error('Recommendation engine error:', error);
            return [];
        }
    }

    public rankEvents(candidates: Event[], userVec: number[]): Event[] {
        return candidates;
    }

    /**
     * Maps flat Supabase RPC result row to a rich Event domain object.
     */
    private mapToEvent(row: any): Event {
        const location = new Location(
            row.location_id || 'unknown',
            row.location_name || 'Generic Location',
            {
                latitude: row.latitude ?? row.location_lat ?? 39.900,
                longitude: row.longitude ?? row.location_lng ?? 32.815
            },
            (row.location_type as LocationType) || LocationType.CAFE
        );

        const timeSlot = new TimeSlot(
            row.slot_id || 'temp-slot',
            row.organizer_id || 'system',
            new Date(row.start_time || Date.now()),
            new Date(row.end_time || Date.now() + 3_600_000),
            BlockType.BUSY,
            DataSource.MANUAL
        );

        const event = new Event(
            row.id,
            row.organizer_id,
            (row.title || '').replace(/^Etkinliği - /i, ''),
            (row.category as EventCategory) || EventCategory.SOCIAL,
            row.sub_category || '',
            location,
            timeSlot,
            row.min_capacity || 0,
            row.max_capacity || 10,
            row.description || '',
            row.chat_room_id || '',
            (row.visibility as EventVisibility) || EventVisibility.PUBLIC,
            (row.status as EventStatus) || EventStatus.ONGOING
        );

        (event as any).distanceKm = row.distanceKm;
        (event as any).matchScore = row.matchScore;

        return event;
    }
}