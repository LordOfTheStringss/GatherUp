import { OCRProcessor } from "../core/schedule/OCRProcessor";
import { ScheduleManager } from "../core/schedule/ScheduleManager";
import { TimeSlot, BlockType, DataSource } from "../core/schedule/TimeSlot";
import { ResponseEntity } from "./ResponseEntity";
import { SupabaseClient } from "../infra/SupabaseClient";

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
    schedule: TimeSlot[],
    dateStr: string,
    dayIndex: number,
    hour: number,
    userId: string = "user-123",
  ): TimeSlot[] {
    return this.scheduleManager.toggleTimeSlot(schedule, dateStr, dayIndex, hour, userId);
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
    const localSlots = await this.scheduleManager.getScheduleFromDB(userId);
    let eventSlots: TimeSlot[] = [];

    try {
      if (userId !== "user-123") {
        const sb = SupabaseClient.getInstance().client;
        
        // Fetch all hosted and attended events
        const { data: hosted } = await sb.from('events').select('*').eq('organizer_id', userId);
        if (hosted) {
          hosted.forEach((e: any) => {
            const blockStart = new Date(e.start_time);
            const blockEnd = new Date(e.end_time);
            
            if (blockStart >= blockEnd) {
              console.warn(`Skipping invalid hosted event #${e.id}: start_time (${e.start_time}) is after end_time (${e.end_time})`);
              return;
            }

            eventSlots.push(new TimeSlot(
              `event-${e.id}`,
              userId,
              blockStart,
              blockEnd,
              BlockType.BUSY,
              DataSource.EVENT,
              false, // NEVER recurring
              { title: e.title, type: "Event (Hosted)", color: "#818CF8", eventId: e.id }
            ));
          });
        }

        const { data: attended } = await sb.from('event_participants').select('event_id, events(*)').eq('user_id', userId);
        if (attended) {
          attended.forEach((p: any) => {
            const e = p.events;
            if (!e) return;
            if (eventSlots.some(s => s.slotId === `event-${e.id}`)) return;
            
            const blockStart = new Date(e.start_time);
            const blockEnd = new Date(e.end_time);

            if (blockStart >= blockEnd) {
                console.warn(`Skipping invalid attended event #${e.id}: start_time (${e.start_time}) is after end_time (${e.end_time})`);
                return;
            }

            eventSlots.push(new TimeSlot(
              `event-${e.id}`,
              userId,
              blockStart,
              blockEnd,
              BlockType.BUSY,
              DataSource.EVENT,
              false, // NEVER recurring
              { title: e.title, type: "Event", color: "#10B981", eventId: e.id }
            ));
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch dynamic events for schedule:", err);
    }

    // Filter local manual/OCR blocks (keep only those that are NOT events)
    // Legacy entries with source=EVENT in the schedule table are stale and should be ignored
    const manualSlots = localSlots.filter(s => s.source !== DataSource.EVENT);
    const combined = [...manualSlots, ...eventSlots];

    return { status: 200, data: { busyBlocks: combined, freeBlocks: [] } };
  }

  public async addBusyBlock(slot: TimeSlotDTO): Promise<ResponseEntity<any>> {
    return { status: 201, message: "Busy block added" };
  }
}
