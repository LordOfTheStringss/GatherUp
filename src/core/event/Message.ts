/**
 * Data object representing a single chat entry created by a user.
 */
export class Message {
    public id: string;
    public roomId: string;
    public senderId: string; // UUID
    public content: string;
    public timestamp: Date;

    constructor(id: string, roomId: string, senderId: string, content: string) {
        this.id = id;
        this.roomId = roomId;
        this.senderId = senderId;
        this.content = content;
        this.timestamp = new Date();
    }
}
