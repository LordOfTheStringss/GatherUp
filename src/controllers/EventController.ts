import { ConflictEngine } from '../core/event/ConflictEngine';
import { Event } from '../core/event/Event';
import { EventManager } from '../core/event/EventManager';
import { RecommendationEngine } from '../intelligence/RecommendationEngine';
import { GeoPoint } from '../spatial/Location';
import { ResponseEntity } from './ResponseEntity';

export interface CreateEventDTO {
    title: string;
    category: string;
}

export interface EventFilterDTO {
    location?: GeoPoint;
    startTime?: Date;
    category?: string;
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
    private recommendationEngine: RecommendationEngine;
    private conflictEngine: ConflictEngine;

    constructor(eventManager: EventManager, recommendationEngine: RecommendationEngine, conflictEngine: ConflictEngine) {
        this.eventManager = eventManager;
        this.recommendationEngine = recommendationEngine;
        this.conflictEngine = conflictEngine;
    }

    /**
     * Starts EventBuilder and validates availability via conflictEngine.checkAvailability().
     */
    public async createEvent(request: CreateEventDTO): Promise<ResponseEntity<Event>> {
        return { status: 201 };
    }

    /**
     * Lists events by location, time, or category.
     */
    public async getEvents(filter: EventFilterDTO): Promise<ResponseEntity<Event[]>> {
        return { status: 200, data: [] };
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
        return { status: 200, message: "Joined Event" };
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
}
