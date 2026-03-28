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
    const localSlots = await this.scheduleManager.getScheduleFromDB(userId);
    let eventSlots: TimeSlot[] = [];

    try {
      if (userId !== "user-123") {
        const sb = SupabaseClient.getInstance().client;
        
        const nowIso = new Date().toISOString();

        // Fetch hosted events
        const { data: hosted } = await sb.from('events').select('*').eq('organizer_id', userId).gt('end_time', nowIso);
        if (hosted) {
          hosted.forEach((e: any) => {
            const blockStart = new Date(e.start_time);
            blockStart.setMinutes(0, 0, 0);
            const blockEnd = new Date(e.end_time);
            
            // Adjust end time to next hour if it's not on the hour, or if it exactly matches start time due to rounding
            if (blockEnd.getMinutes() > 0 || blockEnd.getTime() <= blockStart.getTime()) {
              blockEnd.setHours(blockEnd.getHours() + 1);
              blockEnd.setMinutes(0, 0, 0);
            }
            
            eventSlots.push(new TimeSlot(
              `event-${e.id}`,
              userId,
              blockStart,
              blockEnd,
              BlockType.BUSY,
              DataSource.EVENT,
              false,
              { title: e.title, type: "Event (Hosted)", color: "#818CF8", eventId: e.id }
            ));
          });
        }

        // Fetch attended events
        const { data: attended } = await sb.from('event_participants').select('event_id, events(*)').eq('user_id', userId);
        if (attended) {
          attended.forEach((p: any) => {
            const e = p.events;
            if (!e || e.end_time <= nowIso) return;
            if (eventSlots.some(s => s.slotId === `event-${e.id}`)) return; // skip if hosted
            
            const blockStart = new Date(e.start_time);
            blockStart.setMinutes(0, 0, 0);
            const blockEnd = new Date(e.end_time);
            if (blockEnd.getMinutes() > 0 || blockEnd.getTime() <= blockStart.getTime()) {
              blockEnd.setHours(blockEnd.getHours() + 1);
              blockEnd.setMinutes(0, 0, 0);
            }

            eventSlots.push(new TimeSlot(
              `event-${e.id}`,
              userId,
              blockStart,
              blockEnd,
              BlockType.BUSY,
              DataSource.EVENT,
              false,
              { title: e.title, type: "Event", color: "#10B981", eventId: e.id }
            ));
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch dynamic events for schedule:", err);
    }

    // Combine local manual blocks (filter out old cached events) with fresh DB events
    const manualSlots = localSlots.filter(s => s.source !== DataSource.EVENT);
    const combined = [...manualSlots, ...eventSlots];

    return { status: 200, data: { busyBlocks: combined, freeBlocks: [] } };
  }

  public async addBusyBlock(slot: TimeSlotDTO): Promise<ResponseEntity<any>> {
    return { status: 201, message: "Busy block added" };
  }
}
