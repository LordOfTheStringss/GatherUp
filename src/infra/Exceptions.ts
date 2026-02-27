export class EmergencyBroadcastException extends Error {
    constructor(message: string = "Failed to deliver emergency broadcast to Trusted Circle.") {
        super(message);
        this.name = "EmergencyBroadcastException";
    }
}
