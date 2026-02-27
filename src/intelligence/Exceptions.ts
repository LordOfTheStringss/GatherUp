export class MergeInvalidException extends Error {
    constructor(message: string = "Cannot merge events less than 24h before start time.") {
        super(message);
        this.name = "MergeInvalidException";
    }
}

export class PivotNotPossibleException extends Error {
    constructor(message: string = "Too few users for any activity. Cancellation recommended.") {
        super(message);
        this.name = "PivotNotPossibleException";
    }
}

export class VectorGenerationException extends Error {
    constructor(message: string = "API endpoint timeout or failure during vector generation.") {
        super(message);
        this.name = "VectorGenerationException";
    }
}
