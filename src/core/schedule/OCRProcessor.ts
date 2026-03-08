import { GoogleGenerativeAI } from "@google/generative-ai";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { ImageProcessingException } from "./Exceptions";
import { BlockType, DataSource, TimeSlot } from "./TimeSlot";

// API Anahtarını aynen korudum
const GEMINI_API_KEY = "AIzaSyBPEUFJdXAFUdPLXc8x6DKZ7bpKGWI6laA";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // DİKKAT: Prompt çok daha spesifik. Derslik ve ismi kesin olarak ayırmasını istiyoruz!
      const prompt = `
                Sen uzman bir veri analistisin. Ekteki görselde bir üniversite ders programı bulunuyor. 
                Lütfen programdaki dersleri çıkar.
                ÇOK ÖNEMLİ KURALLAR:
                1. Çıktıyı SADECE JSON formatında ver.
                2. "title" alanına sadece dersin kodunu veya adını yaz (Örn: "BİL 476"). İçine "Derslik" kelimesini veya sınıf adını KESİNLİKLE EKLEME.
                3. "location" alanına SADECE sınıf/amfi adını yaz (Örn: "AB.105" veya "Kırmızı Amfi"). Eğer yazmıyorsa boş string "" bırak.
                4. Günleri "Pazartesi", "Salı" gibi tam yaz.
                5. Saatleri "HH:mm" formatında ver.
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
      const [startH, startM] = item.startTime.split(":");
      const [endH, endM] = item.endTime.split(":");

      const startHourInt = parseInt(startH);
      let endHourInt = parseInt(endH);

      // Eğer ders 10:20'de bitiyorsa, 10:00 - 11:00 saat dilimini de meşgul eder
      if (parseInt(endM) > 0) {
        endHourInt += 1;
      }

      // DİKKAT: Bağımsız Silme Algoritması!
      // Uzun blokları, arayüzdeki gibi tek tek 1'er saatlik bağımsız objelere böleriz.
      for (let h = startHourInt; h < endHourInt; h++) {
        const startDate = new Date(today);
        startDate.setDate(today.getDate() + diff);
        startDate.setHours(h, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setHours(h + 1, 0, 0, 0);

        // Gelen "Derslik : AB.105" verisindeki fazlalıkları temizliyoruz
        const cleanLocation = item.location
          ? String(item.location).replace("Derslik", "").replace(":", "").trim()
          : "";

        slots.push(
          new TimeSlot(
            uuidv4(), // Her saat için YEPYENİ bir ID üretiliyor (Çift silinmeyi engeller)
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
      }
    });

    return slots;
  }

  public validateParsing(confirmedSlots: TimeSlot[]): boolean {
    return true;
  }
  public async deleteSourceImage(imageUrl: string): Promise<void> {}
}
