export enum BlockType {
    BUSY = 'BUSY',
    FREE = 'FREE',
    TENTATIVE = 'TENTATIVE'
}

export enum DataSource {
    OCR = 'OCR',
    MANUAL = 'MANUAL',
    CALENDAR_SYNC = 'CALENDAR_SYNC'
}

export enum DayOfWeek {
    SUNDAY = 0,
    MONDAY = 1,
    TUESDAY = 2,
    WEDNESDAY = 3,
    THURSDAY = 4,
    FRIDAY = 5,
    SATURDAY = 6
}

/**
 * Represents an atomic unit of time and encapsulates mathematical logic.
 */
export class TimeSlot {
    public slotId: string; // UUID
    public userId: string; // UUID
    public startTime: Date;
    public endTime: Date;
    public type: BlockType;
    public source: DataSource;
    public isRecurring: boolean;
    public metadata: any; // JSONB

    constructor(
        slotId: string,
        userId: string,
        startTime: Date,
        endTime: Date,
        type: BlockType = BlockType.BUSY,
        source: DataSource = DataSource.MANUAL,
        isRecurring: boolean = false,
        metadata: any = {}
    ) {
        if (startTime >= endTime) {
            throw new Error("start time must be before end time");
        }

        this.slotId = slotId;
        this.userId = userId;
        this.startTime = startTime;
        this.endTime = endTime;
        this.type = type;
        this.source = source;
        this.isRecurring = isRecurring;
        this.metadata = metadata;
    }

    /**
     * Determines if two time intervals intersect mathematically.
     */
    public overlaps(other: TimeSlot): boolean {
        return this.startTime < other.endTime && this.endTime > other.startTime;
    }

    /**
     * Returns total duration in minutes.
     */
    public duration(): number {
        return (this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60);
    }

    /**
     * Dynamically extracts the day from startTime.
     */
    public getDayOfWeek(): DayOfWeek {
        return this.startTime.getDay() as DayOfWeek;
    }

    /**
     * Serializes the object for PostgreSQL JSONB storage.
     */
    public toStructuredJSON(): any {
        return {
            slotId: this.slotId,
            userId: this.userId,
            startTime: this.startTime.toISOString(),
            endTime: this.endTime.toISOString(),
            type: this.type,
            source: this.source,
            isRecurring: this.isRecurring,
            metadata: this.metadata
        };
    }
}
