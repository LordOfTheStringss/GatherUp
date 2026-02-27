import { Message } from './Message';

/**
 * Event-scoped communication container.
 * Real-time distribution and retrieval of chat messages.
 */
export class ChatRoom {
    public roomId: string; // UUID (typically equal to EventID)
    public messages: Message[]; // Collection of exchanged messages

    constructor(roomId: string) {
        this.roomId = roomId;
        this.messages = [];
    }

    /**
     * Sends the given message to all connected clients via WebSocket.
     */
    public broadcast(msg: Message): void {
        this.messages.push(msg);
        // Integrate with Supabase Realtime channel later
    }

    /**
     * Returns the most recent messages up to the specified limit.
     */
    public loadHistory(limit: number): Message[] {
        // Return messages sorted chronologically and capped at limit
        return this.messages.slice(-limit);
    }
}
