import { OCRProcessor } from "../core/schedule/OCRProcessor";
import { ScheduleManager } from "../core/schedule/ScheduleManager";
import { TimeSlot } from "../core/schedule/TimeSlot";
import { ResponseEntity } from "./ResponseEntity";

export interface MultipartFile {
  buffer: any;
  filename: string;
}

export interface ScheduleDTO {
  busyBlocks: TimeSlot[];
  freeBlocks: TimeSlot[];
}

export interface TimeSlotDTO {
  startTime: Date;
  endTime: Date;
}

export class ScheduleController {
  private scheduleManager: ScheduleManager;
  private ocrProcessor: OCRProcessor;

  constructor(scheduleManager: ScheduleManager, ocrProcessor: OCRProcessor) {
    this.scheduleManager = scheduleManager;
    this.ocrProcessor = ocrProcessor;
  }

  // --- UI İÇİN YEREL STATE (STATE MANAGEMENT) METOTLARI ---

  public handleToggleSlot(
    currentSchedule: TimeSlot[],
    dayIndex: number,
    hour: number,
    userId: string,
  ): TimeSlot[] {
    return this.scheduleManager.toggleTimeSlot(
      currentSchedule,
      dayIndex,
      hour,
      userId,
    );
  }

  public handleDeleteEvent(
    currentSchedule: TimeSlot[],
    slotId: string,
  ): TimeSlot[] {
    return this.scheduleManager.convertToFree(currentSchedule, slotId);
  }

  // --- BACKEND VE OCR METOTLARI (HEPSİ KORUNDU) ---

  public async uploadScheduleImage(
    file: MultipartFile,
  ): Promise<ResponseEntity<string>> {
    const imageId = await this.ocrProcessor.uploadImage(file.buffer);
    return { status: 200, data: imageId };
  }

  public async processScheduleImage(
    base64Image: string,
    userId: string,
  ): Promise<ResponseEntity<TimeSlot[]>> {
    try {
      const slots = await this.ocrProcessor.parseSchedule(base64Image, userId);
      return { status: 200, data: slots };
    } catch (error: any) {
      return { status: 400, message: error.message };
    }
  }

  public async confirmSchedule(
    slots: TimeSlot[],
    userId: string,
  ): Promise<ResponseEntity<any>> {
    await this.scheduleManager.saveScheduleToDB(slots, userId);
    return { status: 200, message: "Schedule Confirmed" };
  }

  public async getMySchedule(
    date: Date,
    userId: string = "user-123",
  ): Promise<ResponseEntity<ScheduleDTO>> {
    const slots = await this.scheduleManager.getScheduleFromDB(userId);
    return { status: 200, data: { busyBlocks: slots, freeBlocks: [] } };
  }

  public async addBusyBlock(slot: TimeSlotDTO): Promise<ResponseEntity<any>> {
    return { status: 201, message: "Busy block added" };
  }
}
