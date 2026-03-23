import { Asset } from 'expo-asset';
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
}

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
    public async getOneTapSuggestion(user: User, loc: Location): Promise<Event[]> {
        return await this.fetchRecommendedEvents(
            user.userId,
            loc.coordinates.latitude,
            loc.coordinates.longitude
        );
    }

    /**
     * Democratic Logic: 1. Calculate Centroid. 2. Find a common free slot.
     * 3. Search events matching Centroid.
     */
    public getGroupSuggestion(users: User[]): PlanProposal {
        // Stub implementation
        return {};
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
            (row.category as EventCategory) || EventCategory.SOCIAL,
            row.sub_category || '',
            location,
            timeSlot,
            row.min_capacity || 0,
            row.max_capacity || 10,
            row.description || '',
            row.chat_room_id || '',
            (row.visibility as EventVisibility) || EventVisibility.PUBLIC,
            (row.status as EventStatus) || EventStatus.OPEN
        );

        // Add dynamic properties for UI display (though not in the formal Event class properties, 
        // they are injected for the search results in this context)
        (event as any).distanceKm = row.distanceKm;
        (event as any).matchScore = row.matchScore;

        return event;
    }
}