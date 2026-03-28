import { ConflictEngine } from '../core/event/ConflictEngine';
import { Event } from '../core/event/Event';
import { EventManager } from '../core/event/EventManager';
import { AuthManager } from '../core/identity/AuthManager';
import { GeoPoint } from '../spatial/Location';
import { ResponseEntity } from './ResponseEntity';
import { SupabaseClient } from '../infra/SupabaseClient';

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

                // --- Schedule overlap check ---
                let endTime = new Date(eventDate.getTime());
                if (request.duration) {
                    const match = request.duration.match(/(\d+)/);
                    if (match) endTime.setMinutes(endTime.getMinutes() + parseInt(match[1]));
                    else endTime.setHours(endTime.getHours() + 2);
                } else {
                    endTime.setHours(endTime.getHours() + 2);
                }

                const sClient = SupabaseClient.getInstance().client;
                
                const { data: userJoinedEvents } = await sClient.from('event_participants').select('event_id').eq('user_id', user.id);
                const joinedEventIds = userJoinedEvents?.map((e: any) => e.event_id) || [];
                
                const orCondition = `organizer_id.eq.${user.id}` + (joinedEventIds.length > 0 ? `,id.in.(${joinedEventIds.join(',')})` : '');
                
                const { data: userEvents } = await sClient.from('events').select('id, start_time, end_time, title').or(orCondition);
                
                if (userEvents) {
                    for (const userEvent of userEvents) {
                        if (!userEvent.start_time || !userEvent.end_time) continue;
                        const existingStart = new Date(userEvent.start_time);
                        const existingEnd = new Date(userEvent.end_time);
                        
                        if (eventDate < existingEnd && endTime > existingStart) {
                            throw new Error(`Schedule Conflict: You already have an event ("${userEvent.title}") scheduled during this time.`);
                        }
                    }
                }
                // --- End overlap check ---
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

            const sClient = SupabaseClient.getInstance().client;
            
            // 1. Fetch target event time
            const { data: targetEvent } = await sClient.from('events').select('start_time, end_time, title').eq('id', eventId).single();
            if (!targetEvent || !targetEvent.start_time || !targetEvent.end_time) {
                await this.eventManager.joinEvent(eventId, user.id);
                return { status: 200, message: "Joined Event" };
            }

            const eventDate = new Date(targetEvent.start_time);
            const endTime = new Date(targetEvent.end_time);

            // 2. Fetch user's current schedule to check overlap
            const { data: userJoinedEvents } = await sClient.from('event_participants').select('event_id').eq('user_id', user.id);
            const joinedEventIds = userJoinedEvents?.map((e: any) => e.event_id) || [];
            
            const orCondition = `organizer_id.eq.${user.id}` + (joinedEventIds.length > 0 ? `,id.in.(${joinedEventIds.join(',')})` : '');
            
            const { data: userEvents } = await sClient.from('events').select('id, start_time, end_time, title').or(orCondition);
            
            if (userEvents) {
                for (const userEvent of userEvents) {
                    if (userEvent.id === eventId) continue;
                    if (!userEvent.start_time || !userEvent.end_time) continue;
                    
                    const existingStart = new Date(userEvent.start_time);
                    const existingEnd = new Date(userEvent.end_time);
                    
                    if (eventDate < existingEnd && endTime > existingStart) {
                        throw new Error(`Schedule Conflict: You already have an event ("${userEvent.title}") scheduled during this time.`);
                    }
                }
            }

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
     * Calls recommendationEngine.fetchRecommendedEvents().
     */
    public async getSuggestions(location: GeoPoint): Promise<ResponseEntity<Event[]>> {
        try {
            const user = await AuthManager.getInstance().getCurrentUser();
            if (!user) throw new Error("Authentication required");

            const suggestions = await this.recommendationEngine.fetchRecommendedEvents(
                user.id,
                location.latitude,
                location.longitude
            );
            return { status: 200, data: suggestions as any };
        } catch (error: any) {
            return { status: 500, message: error.message || "Failed to fetch suggestions" };
        }
    }

    /**
     * Calls recommendationEngine.getGroupSuggestion().
     */
    public async getGroupAIPlan(friendsIds: string[]): Promise<ResponseEntity<any>> {
        try {
            // Mocking User objects for the stub
            const plan = this.recommendationEngine.getGroupSuggestion([]);
            return { status: 200, data: plan };
        } catch (error: any) {
            return { status: 500, message: error.message || "AI Planning failed" };
        }
    }

    public async getParticipants(eventId: string): Promise<ResponseEntity<any[]>> {
        try {
            const participants = await this.eventManager.getEventParticipants(eventId);
            return { status: 200, data: participants };
        } catch (error: any) {
            return { status: 500, message: error.message };
        }
    }
    public async endEvent(eventId: string): Promise<{ status: number, message: string }> {
        try {
            await this.eventManager.endEvent(eventId);
            return { status: 200, message: 'Event ended successfully' };
        } catch (e: any) {
            return { status: 500, message: e.message };
        }
    }
}
