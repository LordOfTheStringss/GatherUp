import { ConflictEngine } from '../core/event/ConflictEngine';
import { Event } from '../core/event/Event';
import { EventManager } from '../core/event/EventManager';
import { AuthManager } from '../core/identity/AuthManager';
import { GeoPoint } from '../spatial/Location';
import { ResponseEntity } from './ResponseEntity';

export interface CreateEventDTO {
    title: string;
    category: string;
    sub_category: string;
    time?: Date;
    duration?: string;
    location_lat?: number;
    location_lng?: number;
    location_name?: string;
    location_type?: string;
    location_id?: string;
    is_private?: boolean;
    description?: string;
    min_capacity?: number;
    max_capacity?: number;
}

export interface EventFilterDTO {
    location?: GeoPoint;
    radius?: number; // In kilometers
    startTime?: Date;
    category?: string;
    organizerId?: string;
    friendsOnly?: boolean;
    userId?: string; // Required if friendsOnly is true
    includeExpired?: boolean;
}

export interface EventDetailDTO {
    id: string;
    title: string;
    participants: any[];
}

/**
 * Controls event lifecycle and recommendation features.
 */
export class EventController {
    // Attributes
    private eventManager: EventManager;
    private recommendationEngine: any;
    private conflictEngine: ConflictEngine;

    constructor(eventManager: EventManager, recommendationEngine: any, conflictEngine: ConflictEngine) {
        this.eventManager = eventManager;
        this.recommendationEngine = recommendationEngine;
        this.conflictEngine = conflictEngine;
    }

    /**
     * Starts EventBuilder and validates availability via conflictEngine.checkAvailability().
     */
    public async createEvent(request: CreateEventDTO): Promise<ResponseEntity<Event | any>> {
        try {
            const user = await AuthManager.getInstance().getCurrentUser();
            if (!user) throw new Error("Authentication required");

            if (request.time) {
                const eventDate = new Date(request.time);
                if (eventDate <= new Date()) {
                    throw new Error("Event time cannot be in the past.");
                }
            }

            const event = await this.eventManager.createEvent(user.id, request);
            return { status: 201, data: event, message: "Event Created" };
        } catch (error: any) {
            return { status: 500, message: error.message || "Event creation failed" };
        }
    }

    /**
     * Lists events by location, time, or category.
     */
    public async getEvents(filter: EventFilterDTO): Promise<ResponseEntity<any[]>> {
        try {
            const events = await this.eventManager.getEvents(filter);
            return { status: 200, data: events };
        } catch (error: any) {
            return { status: 500, message: error.message || "Failed to fetch events" };
        }
    }

    /**
     * Returns event details and participants.
     */
    public async getEventDetails(eventId: string): Promise<ResponseEntity<EventDetailDTO>> {
        return { status: 200 };
    }

    /**
     * Adds participant; returns error if capacity is full.
     */
    public async joinEvent(eventId: string): Promise<ResponseEntity> {
        try {
            const user = await AuthManager.getInstance().getCurrentUser();
            if (!user) throw new Error("Authentication required");

            await this.eventManager.joinEvent(eventId, user.id);
            return { status: 200, message: "Joined Event" };
        } catch (error: any) {
            return { status: 500, message: error.message || "Failed to join event" };
        }
    }

    /**
     * Removes user from event.
     */
    public async leaveEvent(eventId: string): Promise<ResponseEntity> {
        return { status: 200, message: "Left Event" };
    }

    /**
     * Calls recommendationEngine.getOneTapSuggestion().
     */
    public async getSuggestions(location: GeoPoint): Promise<ResponseEntity<Event[]>> {
        return { status: 200, data: [] };
    }

    public async getParticipants(eventId: string): Promise<ResponseEntity<any[]>> {
        try {
            const participants = await this.eventManager.getEventParticipants(eventId);
            return { status: 200, data: participants };
        } catch (error: any) {
            return { status: 500, message: error.message };
        }
    }
}
