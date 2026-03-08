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

  public async uploadScheduleImage(
    file: MultipartFile,
  ): Promise<ResponseEntity<string>> {
    const imageId = await this.ocrProcessor.uploadImage(file.buffer);
    return { status: 200, data: imageId };
  }

  // DİKKAT: Buraya userId parametresi ve doğrudan Base64 akışı eklendi
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

  // DİKKAT: userId parametresi buraya da eklendi
  public async confirmSchedule(
    slots: TimeSlot[],
    userId: string,
  ): Promise<ResponseEntity<any>> {
    return { status: 200, message: "Schedule Confirmed" };
  }

  public async getMySchedule(date: Date): Promise<ResponseEntity<ScheduleDTO>> {
    return { status: 200, data: { busyBlocks: [], freeBlocks: [] } };
  }

  public async addBusyBlock(slot: TimeSlotDTO): Promise<ResponseEntity<any>> {
    return { status: 201, message: "Busy block added" };
  }
}
