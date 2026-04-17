import { Asset } from 'expo-asset';
import { SupabaseClient } from '../infra/SupabaseClient';
import { VectorGenerationException } from './Exceptions';

const SUBCAT_TO_IDX_JSON = require('../../assets/models/subcat_to_idx.json');
const CAT_ENCODER_JSON = require('../../assets/models/cat_encoder.json');
const USER_COORD_SCALER = require('../../assets/models/user_coord_scaler.json');
const EVENT_COORD_SCALER = require('../../assets/models/event_coord_scaler.json');
const EVENT_DUR_SCALER = require('../../assets/models/event_dur_scaler.json');

// Re-using constants from the model assets
const MASTER_52: string[] = CAT_ENCODER_JSON;
const SUBCAT_TO_IDX: Record<string, number> = SUBCAT_TO_IDX_JSON;

/**
 * Interfaces with the local ONNX models to produce embeddings
 * for both users (User Tower) and events (Event Tower).
 */
export class VectorService {
    private static instance: VectorService;
    public readonly EMBEDDING_DIM: number = 384; // Constant size

    private months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

    private smartMap: Record<string, { tags: string, cat: string }> = {
        // SPOR
        "Voleybol": { "tags": "Spor, Takım, Fiziksel, Efor, Rekabet, Top", "cat": "Spor" },
        "Basketbol": { "tags": "Spor, Takım, Fiziksel, Efor, Rekabet, Top", "cat": "Spor" },
        "Futbol": { "tags": "Spor, Takım, Fiziksel, Efor, Rekabet, Açık Hava", "cat": "Spor" },
        "Tenis": { "tags": "Spor, Bireysel, Fiziksel, Odak, Raket", "cat": "Spor" },
        "Yüzme": { "tags": "Spor, Bireysel, Fiziksel, Su, Efor", "cat": "Spor" },
        "Koşu": { "tags": "Spor, Bireysel, Fiziksel, Açık Hava, Kondisyon", "cat": "Spor" },
        "Yoga": { "tags": "Spor, Bireysel, Fiziksel, Sakin, Esneklik, Meditasyon", "cat": "Spor" },
        "Pilates": { "tags": "Spor, Bireysel, Fiziksel, Esneklik, Sağlık", "cat": "Spor" },
        "Fitness": { "tags": "Spor, Bireysel, Fiziksel, Ağırlık, Güç", "cat": "Spor" },
        "Kaykay": { "tags": "Spor, Bireysel, Fiziksel, Açık Hava, Macera", "cat": "Spor" },
        "Bisiklet": { "tags": "Spor, Bireysel, Fiziksel, Açık Hava, Gezi", "cat": "Spor" },
        "Okçuluk": { "tags": "Spor, Bireysel, Odak, Hedef, Sakin", "cat": "Spor" },
        "Dağcılık": { "tags": "Spor, Takım, Fiziksel, Açık Hava, Macera, Doğa, Efor", "cat": "Spor" },
        "Boks": { "tags": "Spor, Bireysel, Fiziksel, Efor, Rekabet, Güç", "cat": "Spor" },
        "Masa Tenisi": { "tags": "Spor, Bireysel, Hız, Odak, Kapalı Alan", "cat": "Spor" },

        // TEKNOLOJİ
        "Yazılım": { "tags": "Teknoloji, Zeka, Eğitim, Odak, Bilgisayar, Kodlama", "cat": "Teknoloji" },
        "Yapay Zeka": { "tags": "Teknoloji, Zeka, Gelecek, Bilgisayar, Yenilik", "cat": "Teknoloji" },
        "Veri Bilimi": { "tags": "Teknoloji, Analiz, Matematik, Bilgisayar", "cat": "Teknoloji" },
        "Siber Güvenlik": { "tags": "Teknoloji, Gizlilik, Savunma, Bilgisayar, Ağ", "cat": "Teknoloji" },
        "Robotik": { "tags": "Teknoloji, Donanım, Zeka, Mühendislik, Üretim", "cat": "Teknoloji" },
        "Oyun Geliştirme": { "tags": "Teknoloji, Eğlence, Yaratıcılık, Kodlama, Tasarım", "cat": "Teknoloji" },
        "Blockchain": { "tags": "Teknoloji, Finans, Kripto, Gelecek, Ağ", "cat": "Teknoloji" },
        "Astronomi": { "tags": "Teknoloji, Bilim, Uzay, Gece, Keşif, Gözlem", "cat": "Teknoloji" },
        "Elektronik": { "tags": "Teknoloji, Donanım, Devre, Mühendislik", "cat": "Teknoloji" },

        // SANAT
        "Tiyatro": { "tags": "Sanat, Kültür, Gösteri, Sahne, Sosyal", "cat": "Sanat" },
        "Sinema": { "tags": "Sanat, Kültür, Eğlence, İzleme, Sosyal", "cat": "Sanat" },
        "Konser": { "tags": "Sanat, Müzik, Eğlence, Ses, Kalabalık", "cat": "Sanat" },
        "Dans": { "tags": "Sanat, Fiziksel, Müzik, Ritim, Hareket", "cat": "Sanat" },
        "Resim": { "tags": "Sanat, Yaratıcılık, Görsel, Boya, Sakin", "cat": "Sanat" },
        "Heykel": { "tags": "Sanat, Yaratıcılık, Görsel, Kil, El Becerisi", "cat": "Sanat" },
        "Edebiyat": { "tags": "Sanat, Kültür, Kitap, Okuma, Sakin", "cat": "Sanat" },
        "Fotoğrafçılık": { "tags": "Sanat, Görsel, Doğa, Gezi, Kamera", "cat": "Sanat" },
        "Sergi": { "tags": "Sanat, Kültür, Görsel, Gezi, Tasarım", "cat": "Sanat" },
        "Stand-up": { "tags": "Sanat, Eğlence, Komedi, Gülme, Sosyal", "cat": "Sanat" },
        "Müzeler": { "tags": "Sanat, Kültür, Tarih, Gezi, Öğrenme", "cat": "Sanat" },
        "Opera": { "tags": "Sanat, Kültür, Müzik, Sahne, Klasik", "cat": "Sanat" },

        // HOBİLER
        "Kamp": { "tags": "Hobi, Doğa, Açık Hava, Macera, Keşif, Dinlenme, Çadır", "cat": "Hobiler" },
        "Satranç": { "tags": "Hobi, Zeka, Mantık, Odak, Bireysel, Rekabet", "cat": "Hobiler" },
        "Kitap": { "tags": "Hobi, Kültür, Okuma, Sakin, Öğrenme", "cat": "Hobiler" },
        "Yemek": { "tags": "Hobi, Gastronomi, Lezzet, Mutfak, Sosyal", "cat": "Hobiler" },
        "Gastronomi": { "tags": "Hobi, Kültür, Lezzet, Tadım, Gurme", "cat": "Hobiler" },
        "Oyun": { "tags": "Hobi, Eğlence, Rekabet, Sosyal, Masa Oyunu", "cat": "Hobiler" },
        "E-spor": { "tags": "Hobi, Bilgisayar, Rekabet, Oyun, Dijital", "cat": "Hobiler" },
        "Bahçecilik": { "tags": "Hobi, Doğa, Bitki, Toprak, Sakin", "cat": "Hobiler" },
        "Seyahat": { "tags": "Hobi, Keşif, Gezi, Kültür, Planlama", "cat": "Hobiler" },
        "Yabancı Dil": { "tags": "Hobi, Eğitim, Konuşma, Öğrenme, Kültür", "cat": "Hobiler" },
        "Koleksiyon": { "tags": "Hobi, Tutku, Biriktirme, Tarih, Sergi", "cat": "Hobiler" },
        "Müzik Enstrümanı": { "tags": "Hobi, Sanat, Ses, Pratik, Yetenek", "cat": "Hobiler" },

        // SOSYAL
        "Gönüllülük": { "tags": "Sosyal, Yardım, İyilik, Toplum, Destek", "cat": "Sosyal" },
        "Networking": { "tags": "Sosyal, Kariyer, İletişim, İş, Tanışma", "cat": "Sosyal" },
        "Kariyer Günleri": { "tags": "Sosyal, Kariyer, İş, Gelecek, Profesyonel", "cat": "Sosyal" },
        "Workshop": { "tags": "Sosyal, Eğitim, Atölye, Üretim, Öğrenme", "cat": "Sosyal" }
    };

    private constructor() { }

    public static getInstance(): VectorService {
        if (!VectorService.instance) {
            VectorService.instance = new VectorService();
        }
        return VectorService.instance;
    }

    /**
     * Internal helper to run ONNX inference for User Tower.
     * Centralized here to avoid duplication in RecommendationEngine.
     */
    public async runUserTowerInference(userId: string): Promise<number[]> {
        const supabase = SupabaseClient.getInstance().client;
        const ONNX = require('onnxruntime-react-native');
        const TensorClass = ONNX.Tensor;

        try {
            // 1. Fetch User Data (Interests & Archetype)
            const { data: profile, error: pErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            const { data: userData, error: uErr } = await supabase
                .from('users')
                .select('longitude, latitude, archetype, interest_tags')
                .eq('id', userId)
                .single();

            if (pErr || uErr || !profile || !userData) throw new Error("User data not found for vector sync");

            // 2. Prepare History Sequence
            // We need past events' numeric features
            const MAX_HIST = 10;
            const { data: participations } = await supabase
                .from('event_participants')
                .select('event_id, events(latitude, longitude, start_time, end_time)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(MAX_HIST);

            const histSeq = new Float32Array(MAX_HIST * 7).fill(0);
            let histLen = 0;

            if (participations) {
                histLen = participations.length;
                participations.reverse().forEach((p: any, idx: number) => {
                    if (p.events) {
                        const feats = this.calculateEventNumericFeatures(p.events);
                        histSeq.set(feats, idx * 7);
                    }
                });
            }

            // 3. Prepare Inputs
            const interests = new Float32Array(52).fill(0);
            const userTags = userData.interest_tags || [];
            userTags.forEach((t: string) => {
                const idx = SUBCAT_TO_IDX[t];
                if (idx !== undefined) interests[idx] = 1.0;
            });

            // Context: [cluster(5) + scaled_coords(2)]
            const context = new Float32Array(7).fill(0);
            const UPPER_CATEGORIES = ["Sports", "Technology_Science", "Arts_Culture", "Hobbies_Lifestyle", "Social_Career"];
            const archeIdx = UPPER_CATEGORIES.indexOf(userData.archetype || "Social_Career");
            if (archeIdx !== -1) context[archeIdx] = 1.0;

            // Scaled coords
            const lonMean = USER_COORD_SCALER.mean[0];
            const lonStd = USER_COORD_SCALER.scale[0];
            const latMean = USER_COORD_SCALER.mean[1];
            const latStd = USER_COORD_SCALER.scale[1];

            context[5] = ((userData.longitude || 32.815) - lonMean) / lonStd;
            context[6] = ((userData.latitude || 39.900) - latMean) / latStd;

            const count = new Float32Array([Math.log1p(histLen)]);
            
            // Calculate L2 norm of history sequence
            let sumSq = 0;
            histSeq.forEach(v => sumSq += v * v);
            const histNorm = new Float32Array([Math.log1p(Math.sqrt(sumSq))]);

            // 4. Run ONNX Session
            const modelAsset = Asset.fromModule(require('../../assets/models/user_tower.onnx'));
            await modelAsset.downloadAsync();
            const session = await ONNX.InferenceSession.create(modelAsset.localUri || modelAsset.uri);

            const results = await session.run({
                interests: new TensorClass('float32', interests, [1, 52]),
                context: new TensorClass('float32', context, [1, 7]),
                count: new TensorClass('float32', count, [1, 1]),
                hist_norm: new TensorClass('float32', histNorm, [1, 1]),
                hist_seq: new TensorClass('float32', histSeq, [1, MAX_HIST, 7]),
                hist_len: new TensorClass('int64', BigInt64Array.from([BigInt(histLen)]), [1]),
            });

            const userVectorTensor = results.user_vector || Object.values(results)[0];
            return Array.from(userVectorTensor.data as Float32Array);
        } catch (error) {
            console.error('User Tower Inference Error:', error);
            throw error;
        }
    }

    /**
     * Generates user embedding using local ONNX model and saves it to 'profiles.profile_vector'.
     */
    public async generateUserEmbedding(userId: string): Promise<boolean> {
        try {
            console.log(`[VectorService] Syncing profile_vector for user ${userId}...`);
            const vector = await this.runUserTowerInference(userId);

            const { error } = await SupabaseClient.getInstance().client
                .from('profiles')
                .update({ 
                    profile_vector: vector,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (error) throw error;
            console.log(`[VectorService] Success: profile_vector updated.`);
            return true;
        } catch (error) {
            console.error('Failed to generate user embedding:', error);
            return false;
        }
    }

    /**
     * Generates event embedding using local ONNX model and saves it to 'events.embedding'.
     */
    public async generateEventEmbedding(eventId: string, eventData?: any): Promise<boolean> {
        try {
            console.log(`[VectorService] Syncing event embedding for ${eventId}...`);
            const supabase = SupabaseClient.getInstance().client;
            const ONNX = require('onnxruntime-react-native');
            const TensorClass = ONNX.Tensor;

            // 1. Ensure we have data
            let record = eventData;
            if (!record) {
                const { data } = await supabase.from('events').select('*').eq('id', eventId).single();
                record = data;
            }
            if (!record) throw new Error("Event record not found");

            // 2. Prepare Numeric Features (7-dim)
            const numericFeats = this.calculateEventNumericFeatures(record);

            // 3. Subcategory Index
            const subCategory = record.sub_category || record.subCategory || "";
            const subcatIdx = SUBCAT_TO_IDX[subCategory] || 0;

            // 4. Run ONNX Session
            const modelAsset = Asset.fromModule(require('../../assets/models/event_tower.onnx'));
            await modelAsset.downloadAsync();
            const session = await ONNX.InferenceSession.create(modelAsset.localUri || modelAsset.uri);

            const results = await session.run({
                subcat_idx: new TensorClass('int64', BigInt64Array.from([BigInt(subcatIdx)]), [1]),
                numeric_feats: new TensorClass('float32', numericFeats, [1, 7]),
            });

            // Correct output key check
            const eventVectorTensor = results.output || results.vector || Object.values(results)[0];
            const vector = Array.from(eventVectorTensor.data as Float32Array);

            // 5. Update DB (column: embedding)
            const { error } = await supabase
                .from('events')
                .update({ embedding: vector })
                .eq('id', eventId);

            if (error) throw error;
            console.log(`[VectorService] Success: event embedding updated.`);
            return true;
        } catch (error) {
            console.error('Failed to generate event embedding:', error);
            return false;
        }
    }

    private calculateEventNumericFeatures(row: any): Float32Array {
        const feats = new Float32Array(7);
        
        // Coords: Handle snake_case (DB) and camelCase (DTO)
        const lat = row.location_lat ?? row.latitude ?? row.locationLat ?? 39.900;
        const lon = row.location_lng ?? row.longitude ?? row.locationLng ?? 32.815;
        
        feats[0] = (lat - EVENT_COORD_SCALER.mean[0]) / EVENT_COORD_SCALER.scale[0];
        feats[1] = (lon - EVENT_COORD_SCALER.mean[1]) / EVENT_COORD_SCALER.scale[1];

        // Duration: Handle pre-calculated durationHours or raw times
        let durMins = 120;
        if (row.durationHours) {
            durMins = row.durationHours * 60;
        } else if (row.start_time && row.end_time) {
            const startTime = new Date(row.start_time);
            const endTime = new Date(row.end_time);
            durMins = (endTime.getTime() - startTime.getTime()) / 60000;
        } else if (row.time) { // CreateEventDTO fallback
            durMins = 60; 
        }

        feats[2] = (durMins - EVENT_DUR_SCALER.mean[0]) / EVENT_DUR_SCALER.scale[0];

        // Cyclic Time
        const startDate = row.start_time ? new Date(row.start_time) : (row.time ? new Date(row.time) : new Date());
        const hour = startDate.getHours() + startDate.getMinutes() / 60.0;
        feats[3] = Math.sin(2 * Math.PI * hour / 24.0);
        feats[4] = Math.cos(2 * Math.PI * hour / 24.0);

        const dow = startDate.getDay(); // 0 is Sunday
        feats[5] = Math.sin(2 * Math.PI * dow / 7.0);
        feats[6] = Math.cos(2 * Math.PI * dow / 7.0);

        return feats;
    }

    /**
     * Similarity: Returns score -1.0 to 1.0. Used for ranking & merging.
     */
    public calculateSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length || vecA.length === 0) return 0;

        // Dot product / magnitude (Cosine similarity stub)
        let dotProduct = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
        }
        return dotProduct; // Mocked, must return -1.0 to 1.0
    }

    /**
     * Group Logic Helper: Calculates the centroid of multiple user vectors
     * to create a "Group Composite Vector".
     */
    public weightedAverage(vectors: number[][]): number[] {
        if (vectors.length === 0) return [];
        const dim = vectors[0].length;
        const result = new Array(dim).fill(0);

        for (const vec of vectors) {
            for (let i = 0; i < dim; i++) {
                result[i] += vec[i];
            }
        }
        return result.map(val => val / vectors.length);
    }
}
