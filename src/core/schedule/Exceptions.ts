export class ScheduleOverlapException extends Error {
    constructor(message: string = "Proposed time overlaps with an existing schedule block.") {
        super(message);
        this.name = "ScheduleOverlapException";
    }
}

export class OCRConfidenceLowException extends Error {
    constructor(message: string = "AI confidence score is below threshold. Manual review required.") {
        super(message);
        this.name = "OCRConfidenceLowException";
    }
}

export class ImageProcessingException extends Error {
    constructor(message: string = "File is corrupt, unreadable, or in an unsupported format.") {
        super(message);
        this.name = "ImageProcessingException";
    }
}
