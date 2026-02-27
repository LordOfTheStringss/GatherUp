export class InsufficientDataException extends Error {
    constructor(message: string = "Zero historical events for region. Returning standardized 'No Data Available'.") {
        super(message);
        this.name = "InsufficientDataException";
    }
}
