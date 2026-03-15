import { SupabaseClient } from '../infra/SupabaseClient';
import { VectorGenerationException } from './Exceptions';

/**
 * Interfaces with the embedding model to convert text to vectors 
 * and performs similarity calculations.
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

    // SBERT sentence templates for generating descriptive user profiles
    private userTemplates = [
        "Platformda {score} tecrübe puanına (XP) sahip aktif bir {statu}. Özellikle {tags} konularına büyük ilgi duyuyor.",
        "{tags} alanlarındaki etkinlikleri yakından takip eden bir {statu}. Topluluk puanı {score}.",
        "Kendini {tags} konularında geliştirmeyi seven ve sosyalleşmeye açık bir {statu}. Sistemde {score} XP'si bulunuyor..",
        "Bir {statu} olarak {tags} üzerine odaklanıyor. Platformda {score} puanlık bir repütasyona sahip."
    ];

    /**
     * Generates a random sentence from the templates filled with user data.
     */
    public generateUserSentence(score: number, statu: string, tags: string[]): string {
        const randomIndex = Math.floor(Math.random() * this.userTemplates.length);
        let template = this.userTemplates[randomIndex];

        const tagsString = tags.join(', ');

        return template
            .replace('{score}', score.toString())
            .replace('{statu}', statu)
            .replace('{tags}', tagsString);
    }

    /**
     * Generates user embedding (from rich context) by calling edge function and saves it to the database
     */
    public async generateUserEmbedding(userId: string, score: number, statu: string, tags: string[], isAvailable: boolean): Promise<boolean> {
        try {
            const profil_ozeti = this.generateUserSentence(score, statu, tags);
            const tags_str = tags.join(', ');
            const capitalizeStatu = statu.charAt(0).toUpperCase() + statu.slice(1);
            const musaitlikText = isAvailable ? "Müsait" : "Pek müsait değil";

            // Zengin User Context (Yapay Zeka DNA'sı - User requested format)
            const zengin_user_context = (
                `Kullanıcı Statüsü: ${capitalizeStatu} | ` +
                `İlgi Alanları: ${tags_str} | ` +
                `Repütasyon Puanı (XP): ${score} | ` +
                `Müsaitlik Durumu: ${musaitlikText} | ` +
                `Profil Özeti: ${profil_ozeti}`
            );

            console.log('Generated Rich User Context:', zengin_user_context);

            const supabaseClient = SupabaseClient.getInstance();

            // Generate embedding via Edge Function, giving it the generated rich context
            const result = await supabaseClient.invokeEdgeFunction('profiler', { id: userId, type: 'user', text: zengin_user_context });

            if (result.error || (result.data && !result.data.success)) {
                console.error('Error invoking profiler edge function:', result.error || result.data?.error);
                return false;
            }

            console.log('Result from Edge Function:', result.data.message);
            return true;
        } catch (error) {
            console.error('Failed to generate user embedding:', error);
            throw new VectorGenerationException();
        }
    }

    /**
     * Generates event embedding (from rich context) by calling edge function and saves it to the database
     */
    public async generateEventEmbedding(
        eventId: string,
        eventData: {
            title: string,
            time: string | Date,
            durationHours: number,
            locationName?: string,
            locationType?: string,
            category: string,
            subCategory: string,
            minCapacity?: number,
            maxCapacity?: number,
            description?: string
        }
    ): Promise<boolean> {
        try {
            const date = new Date(eventData.time);
            const gun = date.getDate();
            const ay = this.months[date.getMonth()];
            const yil = date.getFullYear();
            const saat = date.getHours().toString().padStart(2, '0') + ":" + date.getMinutes().toString().padStart(2, '0');

            const cleanDesc = (eventData.description || '').replace(/\r?\n|\r/g, " ");

            // Smart Map lookup for Tags and Category consistency
            const smartDetails = this.smartMap[eventData.subCategory];
            const tagsString = smartDetails ? smartDetails.tags : '';
            const category = smartDetails ? smartDetails.cat : eventData.category;

            // Zengin AI Context (User requested format)
            const zengin_ai_context = (
                `Başlık: ${eventData.title} | ` +
                `Tarih ve Saat: ${gun} ${ay} ${yil} - ${saat} | ` +
                `Mekan: ${eventData.locationName || 'Belirtilmedi'} (Tip: ${eventData.locationType || 'Belirtilmedi'}) | ` +
                `Kategori: ${category} > ${eventData.subCategory} | ` +
                `Süre: ${eventData.durationHours} Saat | ` +
                `Kapasite: ${eventData.minCapacity || 0}-${eventData.maxCapacity || 0} Kişi | ` +
                `Karakteristik Özellikler: ${tagsString} | ` +
                `Açıklama Özeti: ${cleanDesc.substring(0, 100)}...`
            );

            console.log('Generated Rich Event Context:', zengin_ai_context);

            const supabaseClient = SupabaseClient.getInstance();

            // Generate embedding via Edge Function, giving it the generated rich context
            const result = await supabaseClient.invokeEdgeFunction('profiler', { id: eventId, type: 'event', text: zengin_ai_context });

            if (result.error || (result.data && !result.data.success)) {
                console.error('Error invoking profiler edge function:', result.error || result.data?.error);
                return false;
            }

            console.log('Result from Edge Function:', result.data.message);
            return true;
        } catch (error) {
            console.error('Failed to generate event embedding:', error);
            throw new VectorGenerationException();
        }
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
