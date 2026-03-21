import { GoogleGenerativeAI } from "@google/generative-ai";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { ImageProcessingException } from "./Exceptions";
import { BlockType, DataSource, TimeSlot } from "./TimeSlot";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const getGenAI = () => {
  if (!GEMINI_API_KEY) {
    throw new Error("EXPO_PUBLIC_GEMINI_API_KEY tanimli degil.");
  }
  return new GoogleGenerativeAI(GEMINI_API_KEY);
};

export class OCRProcessor {
  public async uploadImage(image: Blob | Buffer | string): Promise<string> {
    return "https://supabase.co/temp-image-url.jpg";
  }

  public async parseSchedule(
    base64Image: string,
    userId: string,
  ): Promise<TimeSlot[]> {
    try {
      if (base64Image.startsWith("http"))
        throw new Error("Base64 formatı gerekli.");

      const cleanBase64 = base64Image.includes("base64,")
        ? base64Image.split("base64,")[1]
        : base64Image;

      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
                Sen uzman bir veri analistisin. Ekteki görselde bir üniversite ders programı bulunuyor. 
                Lütfen programdaki dersleri çıkar.
                ÇOK ÖNEMLİ KURALLAR:
                1. Çıktıyı SADECE JSON formatında ver.
                2. "title" alanına sadece dersin kodunu veya adını yaz (Örn: "BİL 476").
                3. "location" alanına SADECE sınıf/amfi adını yaz (Örn: "AB.105" veya "Kırmızı Amfi"). Eğer yazmıyorsa boş string "" bırak.
                4. Günleri "Pazartesi", "Salı" gibi tam yaz.
                5. Saatleri görselde ne görüyorsan tam olarak o "HH:mm" formatında ver (Örn: 08:30, 19:20). Kesinlikle saatleri yuvarlama.
                Format Örneği:
                [
                  {
                    "day": "Pazartesi",
                    "startTime": "08:30",
                    "endTime": "10:20",
                    "title": "BİL 476",
                    "location": "AB.105"
                  }
                ]
            `;

      const imageParts = [
        { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } },
      ];
      const result = await model.generateContent([prompt, ...imageParts]);
      const text = result.response.text();

      const cleanJsonString = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const rawJson = JSON.parse(cleanJsonString);

      return this.convertToTimeSlots(rawJson, userId);
    } catch (error: any) {
      throw new ImageProcessingException(error.message || "Görsel işlenemedi.");
    }
  }

  private convertToTimeSlots(rawJson: any[], userId: string): TimeSlot[] {
    const today = new Date();
    const daysMap: { [key: string]: number } = {
      Pazartesi: 1,
      Salı: 2,
      Çarşamba: 3,
      Perşembe: 4,
      Cuma: 5,
      Cumartesi: 6,
      Pazar: 0,
    };

    const slots: TimeSlot[] = [];

    rawJson.forEach((item) => {
      const targetDay = daysMap[item.day];
      if (targetDay === undefined) return;

      const diff = targetDay - today.getDay();

      // Saatleri ve Dakikaları ayırıyoruz
      const [startH, startM] = item.startTime.split(":");
      const [endH, endM] = item.endTime.split(":");

      // DİKKAT: Artık for döngüsüyle saatleri parçalamak YOK!
      // Doğrudan okunan saati ve dakikayı set ediyoruz.
      const startDate = new Date(today);
      startDate.setDate(today.getDate() + diff);
      startDate.setHours(parseInt(startH), parseInt(startM), 0, 0);

      const endDate = new Date(today);
      endDate.setDate(today.getDate() + diff);
      endDate.setHours(parseInt(endH), parseInt(endM), 0, 0);

      const cleanLocation = item.location
        ? String(item.location).replace("Derslik", "").replace(":", "").trim()
        : "";

      slots.push(
        new TimeSlot(
          uuidv4(),
          userId,
          startDate,
          endDate,
          BlockType.BUSY,
          DataSource.OCR,
          true,
          {
            title: String(item.title || "Ders"),
            location: cleanLocation,
          },
        ),
      );
    });

    return slots;
  }

  public validateParsing(confirmedSlots: TimeSlot[]): boolean {
    return true;
  }
  public async deleteSourceImage(imageUrl: string): Promise<void> {}
}
