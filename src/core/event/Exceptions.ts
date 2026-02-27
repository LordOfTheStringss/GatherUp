export class EventCapacityReachedException extends Error {
    constructor(message: string = "Event is already full.") {
        super(message);
        this.name = "EventCapacityReachedException";
    }
}

export class MergeInvalidException extends Error {
    constructor(message: string = "Cannot merge events less than 24h before start.") {
        super(message);
        this.name = "MergeInvalidException";
    }
}

export class PivotNotPossibleException extends Error {
    constructor(message: string = "Not enough participants to pivot. Event cancelled.") {
        super(message);
        this.name = "PivotNotPossibleException";
    }
}

export class ScheduleConflictException extends Error {
    constructor(message: string = "Schedule conflict detected during your busy block.") {
        super(message);
        this.name = "ScheduleConflictException";
    }
}
