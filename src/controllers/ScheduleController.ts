import { OCRProcessor } from '../core/schedule/OCRProcessor';
import { ScheduleManager } from '../core/schedule/ScheduleManager';
import { TimeSlot } from '../core/schedule/TimeSlot';
import { ResponseEntity } from './ResponseEntity';

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

/**
 * Manages OCR-based schedule extraction and manual busy blocks.
 */
export class ScheduleController {
    // Attributes
    private scheduleManager: ScheduleManager;
    private ocrProcessor: OCRProcessor;

    constructor(scheduleManager: ScheduleManager, ocrProcessor: OCRProcessor) {
        this.scheduleManager = scheduleManager;
        this.ocrProcessor = ocrProcessor;
    }

    /**
     * Calls ocrProcessor.uploadImage() and returns image ID.
     */
    public async uploadScheduleImage(file: MultipartFile): Promise<ResponseEntity<string>> {
        return { status: 200, data: "image-id-123" };
    }

    /**
     * Calls ocrProcessor.parseSchedule() and returns parsed slots.
     */
    public async processScheduleImage(imageId: string): Promise<ResponseEntity<TimeSlot[]>> {
        return { status: 200, data: [] };
    }

    /**
     * Calls ocrProcessor.validateParsing() and stores schedule.
     */
    public async confirmSchedule(slots: TimeSlot[]): Promise<ResponseEntity> {
        return { status: 200, message: "Schedule Confirmed" };
    }

    /**
     * Returns busy/free hours of the day.
     */
    public async getMySchedule(date: Date): Promise<ResponseEntity<ScheduleDTO>> {
        return { status: 200 };
    }

    /**
     * Manually adds busy time block.
     */
    public async addBusyBlock(slot: TimeSlotDTO): Promise<ResponseEntity> {
        return { status: 201, message: "Busy block added" };
    }
}
