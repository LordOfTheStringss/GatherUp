import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { Event, EventCategory, EventStatus, EventVisibility } from '../core/event/Event';
import { User } from '../core/identity/User';
import { BlockType, DataSource, TimeSlot } from '../core/schedule/TimeSlot';
import { SupabaseClient } from '../infra/SupabaseClient';
import { Location, LocationType } from '../spatial/Location';

export interface PlanProposal {
    // Defines the structure for a suggested group plan
    suggestedTime?: Date;
    suggestedLocation?: Location;
    matchingEvents?: Event[];
    suggestedCategory?: string;
    suggestedSubCategory?: string;
    suggestedTitle?: string;
    suggestedTags?: string;
}

export const EVENT_CLUSTERS: Record<string, string[]> = {
    "Sports": [
        "Volleyball", "Basketball", "Football", "Tennis", "Swimming", "Running", "Yoga", "Pilates",
        "Fitness", "Skateboarding", "Cycling", "Archery", "Mountaineering", "Boxing", "Table Tennis"
    ],
    "Tech & Science": [
        "Software", "Artificial Intelligence", "Data Science", "Cyber Security", "Robotics",
        "Game Development", "Blockchain", "Astronomy", "Electronics"
    ],
    "Art & Culture": [
        "Theater", "Cinema", "Concert", "Dance", "Painting", "Sculpture", "Literature",
        "Photography", "Exhibition", "Stand-up Comedy", "Museums", "Opera"
    ],
    "Hobbies & Lifestyle": [
        "Camping", "Chess", "Books", "Cooking", "Gastronomy", "E-sports",
        "Gardening", "Travel", "Foreign Languages", "Collections", "Musical Instrument"
    ],
    "Social & Career": [
        "Volunteering", "Networking", "Career Days", "Workshop"
    ]
};

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
     * Entry point for a quick, one-click event suggestion.
     * Uses the internal pipeline to find the best match.
     */
    public async getOneTapSuggestion(user: any, loc: Location): Promise<Event[]> {
        // Fallback for Supabase User object, which uses 'id' instead of 'userId'
        const targetUserId = user.userId || user.id;

        return await this.fetchRecommendedEvents(
            targetUserId,
            loc.coordinates.latitude,
            loc.coordinates.longitude
        );
    }

    /**
     * Group Generative Model Input Builder
     * Calculates the 939-dimensional input for group_model.onnx based on users' profile vectors and schedules.
     */
    public async getGroupSuggestion(users: User[]): Promise<{ features: Float32Array; proposal: PlanProposal }> {
        const embDim = 384;
        const numUsers = users.length;

        let avgBase = new Float32Array(embDim);
        let maxBase = new Float32Array(embDim).fill(-Infinity);
        let diversityScore = 0.0;

        // "sadece userların normal embdeddingi olucak"
        const validUsers = users.filter(u => u.profileVector && u.profileVector.length === embDim);

        if (validUsers.length > 0) {
            // Calculate avg_base and max_base
            for (let i = 0; i < embDim; i++) {
                let sum = 0;
                for (const u of validUsers) {
                    const val = u.profileVector[i];
                    sum += val;
                    if (val > maxBase[i]) {
                        maxBase[i] = val;
                    }
                }
                avgBase[i] = sum / validUsers.length;
            }

            // Calculate diversity_score = mean(std(group_base_embs, axis=0))
            let stdSum = 0;
            for (let i = 0; i < embDim; i++) {
                let varianceSum = 0;
                for (const u of validUsers) {
                    const diff = u.profileVector[i] - avgBase[i];
                    varianceSum += diff * diff;
                }
                const std = Math.sqrt(varianceSum / validUsers.length);
                stdSum += std;
            }
            diversityScore = stdSum / embDim;
        } else {
            maxBase.fill(0); // reset if no users
        }

        // Mocking group_mask_168 since schedule is not present in User model yet
        // Simüle edilmiş takvim: Pazartesi - Cuma, 09:00 - 18:00 arası mesai/okul saatini (0) olarak işaretle.
        const groupMask168 = new Float32Array(168).fill(1);
        for (let d = 0; d < 5; d++) { // 0=Monday .. 4=Friday
            for (let h = 9; h < 18; h++) { // 09:00 - 17:59
                groupMask168[d * 24 + h] = 0;
            }
        }
        const pCount = numUsers;
        const actualFreeSlots = groupMask168.reduce((a, b) => a + b, 0);

        // Concatenate all into a single Float32Array of length 939
        // avg_base(384) + max_base(384) + div_feat(1) + p_count(1) + actual_free_slots(1) + group_mask_168(168) = 939
        const combined = new Float32Array(939);
        combined.set(avgBase, 0);
        combined.set(maxBase, 384);
        combined.set([diversityScore], 768);
        combined.set([pCount], 769);
        combined.set([actualFreeSlots], 770);
        combined.set(groupMask168, 771);

        console.log("Group model telefonda hazırlanıyor...");
        let session;
        let TensorClass;
        let finalProposal: PlanProposal = { suggestedTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) };

        try {
            if (Platform.OS === 'web') throw new Error("ONNX not supported on web");

            const modelAsset = await Asset.loadAsync(require('../../assets/models/gatherup_group_model_final.onnx'));
            const modelUri = modelAsset[0].localUri || modelAsset[0].uri;

            if (!modelUri) {
                throw new Error("Grup modelinin yerel adresi bulunamadı!");
            }

            const ONNX = require('onnxruntime-react-native');
            session = await ONNX.InferenceSession.create(modelUri);
            TensorClass = ONNX.Tensor;

            console.log("Veriler grup modeline sokuluyor (939 boyutlu)...");
            const tensor = new TensorClass('float32', combined, [1, 939]);

            const inputName = session.inputNames[0];
            const feeds: any = {};
            feeds[inputName] = tensor;

            const results = await session.run(feeds);

            // Extract tensors carefully depending on possible string names or just keys
            const outKeys = Object.keys(results);
            // Default mapping assuming order: cat, day, hour. Adjust if your names are different.
            let catLogits: Float32Array = results[outKeys[0]].data as Float32Array;
            let dayLogits: Float32Array = results[outKeys[1]].data as Float32Array;
            let hourLogits: Float32Array = results[outKeys[2]].data as Float32Array;

            // Optional: try matching by names like 'cat', 'day', 'hour' if they exist
            for (const key of outKeys) {
                if (key.includes('cat')) catLogits = results[key].data as Float32Array;
                if (key.includes('day')) dayLogits = results[key].data as Float32Array;
                if (key.includes('hour')) hourLogits = results[key].data as Float32Array;
            }

            // ─── Post-Processing: Softmax & Masking (Based on suggest_quality_plan_v4_detailed) ───
            const softmax = (arr: Float32Array) => {
                const max = Math.max(...Array.from(arr));
                const exps = Array.from(arr).map(x => Math.exp(x - max));
                const sum = exps.reduce((a, b) => a + b, 0);
                return exps.map(x => x / sum);
            };

            const dayProbs = softmax(dayLogits);
            const hourProbs = softmax(hourLogits);

            // Get Current Time to form future_mask
            const now = new Date();
            // JS getDay(): 0=Sun, 1=Mon...6=Sat. Math logic assumes 0=Mon, 6=Sun.
            let currentDayIdx = now.getDay() - 1;
            if (currentDayIdx < 0) currentDayIdx = 6;
            const currentHourIdx = now.getHours();

            let bestScore = -1;
            let bestIdx = -1;
            let isNextWeek = false;

            for (let d = 0; d < 7; d++) {
                for (let h = 0; h < 24; h++) {
                    const idx = d * 24 + h;
                    const wMask = groupMask168[idx];
                    const sMask = (h >= 11 && h < 21) ? 1.0 : 0.0; // strict_social_mask
                    const fMask = (d > currentDayIdx || (d === currentDayIdx && h > currentHourIdx)) ? 1.0 : 0.0; // future_mask

                    const score = dayProbs[d] * hourProbs[h] * wMask * sMask * fMask;

                    if (score > bestScore) {
                        bestScore = score;
                        bestIdx = idx;
                    }
                }
            }

            // Fallback for next week if no valid slots this week
            if (bestScore <= 1e-6) {
                isNextWeek = true;
                bestScore = -1;
                for (let d = 0; d < 7; d++) {
                    for (let h = 0; h < 24; h++) {
                        const idx = d * 24 + h;
                        const wMask = groupMask168[idx];
                        const sMask = (h >= 11 && h < 21) ? 1.0 : 0.0;

                        const score = dayProbs[d] * hourProbs[h] * wMask * sMask;

                        if (score > bestScore) {
                            bestScore = score;
                            bestIdx = idx;
                        }
                    }
                }
            }

            const resDay = Math.floor(bestIdx / 24);
            const resHour = bestIdx % 24;

            const catClasses = Object.values(EVENT_CLUSTERS).flat();
            let maxCatVal = -Infinity;
            let maxCatIdx = 0;
            for (let i = 0; i < catLogits.length; i++) {
                if (catLogits[i] > maxCatVal) {
                    maxCatVal = catLogits[i];
                    maxCatIdx = i;
                }
            }

            const randomActivityTitle = catClasses[maxCatIdx] || 'Gönüllülük';

            let catName = 'Sosyal_Kariyer';
            for (const [cat, subCats] of Object.entries(EVENT_CLUSTERS)) {
                if (subCats.includes(randomActivityTitle)) {
                    catName = cat;
                    break;
                }
            }

            const targetTime = new Date(now);
            let daysToAdd = resDay - currentDayIdx;
            if (isNextWeek || daysToAdd <= 0) daysToAdd += 7; // if in the past or exactly now, push to next week if isNextWeek

            targetTime.setDate(targetTime.getDate() + daysToAdd);
            targetTime.setHours(resHour, 0, 0, 0);

            console.log("=".repeat(80));
            console.log(`🚀 MODEL SUGGESTION : Day ${resDay} at ${resHour}:00 (${isNextWeek ? 'Next Week' : 'This Week'})`);
            console.log(`✨ ACTIVITY TYPE : ${catName} -> ${randomActivityTitle}`);

            finalProposal = {
                suggestedTime: targetTime,
                suggestedCategory: randomActivityTitle,
                suggestedSubCategory: randomActivityTitle,
                suggestedTitle: randomActivityTitle,
                suggestedTags: ''
            };

        } catch (e) {
            console.error("Grup modeli ONNX hata aldı:", e);
        }

        return {
            features: combined,
            proposal: finalProposal // Updated with actual model results
        };
    }

    /**
     * Scoring: 1. calculateSimilarity. 2. Add Context Boost (Proximity + Popularity).
     * 3. Sort Descending. 
     */
    public rankEvents(candidates: Event[], userVec: number[]): Event[] {
        return candidates; // Stub for ranking logic
    }
    // 📍 Haversine Formülü: Mesafe hesaplama (KM)
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // 🧮 Vektör Havuzlama (Pooling): 384 x 3 = 1152 boyut üretir
    private calculateHistoryPoolings(historyEmbeddings: number[][]): number[] {
        const dim = 384;
        if (!historyEmbeddings || historyEmbeddings.length === 0) {
            return new Array(dim * 3).fill(0);
        }

        const meanPool = new Array(dim).fill(0);
        const maxPool = new Array(dim).fill(-Infinity);
        const stdPool = new Array(dim).fill(0);

        for (let i = 0; i < dim; i++) {
            let sum = 0;
            for (let j = 0; j < historyEmbeddings.length; j++) {
                const val = historyEmbeddings[j][i];
                sum += val;
                if (val > maxPool[i]) maxPool[i] = val;
            }
            meanPool[i] = sum / historyEmbeddings.length;
        }

        for (let i = 0; i < dim; i++) {
            let varianceSum = 0;
            for (let j = 0; j < historyEmbeddings.length; j++) {
                const diff = historyEmbeddings[j][i] - meanPool[i];
                varianceSum += diff * diff;
            }
            stdPool[i] = Math.sqrt(varianceSum / historyEmbeddings.length);
        }

        return [...meanPool, ...maxPool, ...stdPool];
    }

    public async fetchRecommendedEvents(userId: string, userLat: number, userLon: number): Promise<Event[]> {
        try {
            // 1. Supabase Singleton nesnesine erişim
            const supabase = SupabaseClient.getInstance().client;

            console.log("1. Supabase'den kullanıcı verileri çekiliyor...");
            const { data: userProfile, error: profileError } = await supabase
                .from('users')
                .select('profile_vector, past_events')
                .eq('id', userId)
                .single();

            if (profileError || !userProfile) throw new Error("Kullanıcı bulunamadı veya profil çekilemedi.");

            // 2. Geçmiş Etkinlik Vektörlerini Çek
            let historyEmbeddings: number[][] = [];
            if (userProfile.past_events && userProfile.past_events.length > 0) {
                const { data: eventVectors, error: eventError } = await supabase
                    .from('events')
                    .select('sbert_vec')
                    .in('id', userProfile.past_events);

                if (!eventError && eventVectors) {
                    historyEmbeddings = eventVectors.map((row: any) =>
                        typeof row.sbert_vec === 'string' ? JSON.parse(row.sbert_vec) : row.sbert_vec
                    ).filter((v: any) => v !== null);
                }
            }

            // 3. Özellikleri Birleştir (1152 + 384 = 1536)
            const historyVector_1152 = this.calculateHistoryPoolings(historyEmbeddings);
            const profileVector_384 = typeof userProfile.profile_vector === 'string'
                ? JSON.parse(userProfile.profile_vector)
                : userProfile.profile_vector;

            if (!profileVector_384 || profileVector_384.length !== 384) {
                console.warn("Kullanıcı profil vektörü henüz oluşturulmamış. Öneri sistemi atlanıyor.");
                return [];
            }

            const finalUserFeatures_1536 = [...historyVector_1152, ...profileVector_384];

            console.log("2. Model telefonda hazırlanıyor...");
            // Expo Asset ile modeli uygulamanın içinden güvenle okuyoruz
            const modelAsset = await Asset.loadAsync(require('../../assets/models/user_tower_final.onnx'));
            const modelUri = modelAsset[0].localUri || modelAsset[0].uri;

            if (!modelUri) {
                throw new Error("Modelin yerel adresi bulunamadı!");
            }

            console.log("3. Veriler modele sokuluyor...");

            let session;
            let TensorClass;

            try {
                if (Platform.OS === 'web') throw new Error("ONNX not supported on web");
                const ONNX = require('onnxruntime-react-native');
                session = await ONNX.InferenceSession.create(modelUri);
                TensorClass = ONNX.Tensor;
            } catch (e) {
                console.error("ONNX Runtime initialization failed:", e);
                throw new Error("Öneri motoru başlatılamadı.");
            }

            // 1536'lık dizini Float32 formatına çevir
            const float32Data = new Float32Array(finalUserFeatures_1536);
            const tensor = new TensorClass('float32', float32Data, [1, 1536]);

            // Modeli çalıştır
            const results = await session.run({ user_input: tensor });

            // Çıkan 256'lık final vektörünü al ve TypeScript hatasını çözmek için Float32Array'a çevir!
            const userVectorArray = Array.from(results.user_vector.data as Float32Array);
            console.log("4. Vektör başarıyla üretildi! Uzunluk:", userVectorArray.length);

            console.log("5. Supabase'den eşleşen etkinlikler isteniyor...");
            // Veritabanındaki rpc fonksiyonu için vektörü string formatına dönüştürüyoruz
            const vectorString = `[${userVectorArray.join(',')}]`;

            const { data: top50Events, error: matchError } = await supabase.rpc('match_events', {
                query_embedding: vectorString,
                match_threshold: 0.1, // Varsayılan eşleşme sınırı
                match_count: 50 // Mesafe filtresinden geçebileceği için sayı fazla tutuldu
            });

            if (matchError) throw matchError;

            console.log("6. Eşleşen etkinlikler uzaklığa göre yeniden sıralanıyor (Re-ranking)...");

            const maxPerLocation = 2; // Bir adresten en fazla 2 etkinlik öner
            const locationCounts: Record<string, number> = {};
            const finalRecommendations = [];

            for (const event of top50Events) {
                const locKey = `${event.location_lat},${event.location_lng}`;
                if (locationCounts[locKey] >= maxPerLocation) continue;

                let finalScore = event.similarity;
                const distanceKm = this.calculateDistance(userLat, userLon, event.location_lat, event.location_lng);

                // Mesafe Puanlaması (LLD Context Rules)
                if (distanceKm < 2.0) finalScore += 0.15;
                else if (distanceKm > 15.0) finalScore -= 0.20;

                // Front-end'de direkt listeleyebilmek için distance ve score nesneye dahil ediliyor
                finalRecommendations.push({
                    ...event,
                    distanceKm: Number(distanceKm.toFixed(2)),
                    matchScore: Number(finalScore.toFixed(3)),
                });

                locationCounts[locKey] = (locationCounts[locKey] || 0) + 1;
            }

            // Final skorlarına göre en büyükten küçüğe sırala ve en iyi 10'u seç
            finalRecommendations.sort((a, b) => b.matchScore - a.matchScore);
            const top10Raw = finalRecommendations.slice(0, 10);

            // Supabase sonuçlarını Event sınıfına map'le
            const top10 = top10Raw.map(event => this.mapToEvent(event));

            console.log("✅ Pipeline tamamlandı! Önerilen etkinlik sayısı:", top10.length);
            return top10;

        } catch (error) {
            console.error("Öneri sistemi hatası:", error);
            return [];
        }
    }

    /**
     * Maps flat RPC result to rich Event object.
     */
    private mapToEvent(row: any): Event {
        // Construct Location object
        const location = new Location(
            row.location_id || 'unknown',
            row.location_name || 'Generic Location',
            { latitude: row.location_lat, longitude: row.location_lng },
            (row.location_type as LocationType) || LocationType.CAFE
        );

        // Construct TimeSlot object
        const timeSlot = new TimeSlot(
            row.slot_id || 'temp-slot',
            row.organizer_id || 'system',
            new Date(row.start_time || Date.now()),
            new Date(row.end_time || (Date.now() + 3600000)),
            BlockType.BUSY,
            DataSource.MANUAL
        );

        const event = new Event(
            row.id,
            row.organizer_id,
            row.title,
            (row.category as EventCategory) || EventCategory.SOSYAL,
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

        // Add dynamic properties for UI display (though not in the formal Event class properties, 
        // they are injected for the search results in this context)
        (event as any).distanceKm = row.distanceKm;
        (event as any).matchScore = row.matchScore;

        return event;
    }
}