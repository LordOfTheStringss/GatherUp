export class StaleObjectStateException extends Error {
    constructor(message: string = "Optimistic locking failure: Report ticket was modified by another moderator.") {
        super(message);
        this.name = "StaleObjectStateException";
    }
}
