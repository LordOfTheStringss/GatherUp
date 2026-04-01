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
    public async createEvent(request: CreateEventDTO, forceCreate: boolean = false): Promise<ResponseEntity<Event | any>> {
        try {
            const user = await AuthManager.getInstance().getCurrentUser();
            if (!user) throw new Error("Authentication required");

            if (request.time && !forceCreate) {
                const eventDate = new Date(request.time);
                let endTime = new Date(eventDate.getTime());
                if (request.duration) {
                    let minutes = 60;
                    if (request.duration === '30 mins') minutes = 30;
                    else if (request.duration === '1.5 hours') minutes = 90;
                    else if (request.duration === '2 hours') minutes = 120;
                    else if (request.duration === '2.5 hours') minutes = 150;
                    else if (request.duration === '3 hours') minutes = 180;
                    else if (request.duration === '4 hours') minutes = 240;
                    else if (request.duration === '5 hours') minutes = 300;
                    endTime = new Date(endTime.getTime() + minutes * 60000);
                } else {
                    endTime.setHours(endTime.getHours() + 2);
                }

                const conflict = await this.checkScheduleConflict(user.id, eventDate, endTime);
                if (conflict) {
                    return { 
                        status: 409, 
                        message: `Schedule Conflict: You already have "${conflict}" scheduled during this time. Create anyway?`,
                        data: { conflictingEvent: conflict }
                    };
                }
            }

            const event = await this.eventManager.createEvent(user.id, request);
            return { status: 201, data: event, message: "Event Created" };
        } catch (error: any) {
            return { status: 500, message: error.message || "Event creation failed" };
        }
    }

    private async checkScheduleConflict(userId: string, start: Date, end: Date, ignoreEventId?: string): Promise<string | null> {
        const sClient = SupabaseClient.getInstance().client;
        
        // 1. Check other events (Hosted or Joined)
        const { data: userJoinedEvents } = await sClient.from('event_participants').select('event_id').eq('user_id', userId);
        const joinedEventIds = userJoinedEvents?.map((e: any) => e.event_id) || [];
        const orCondition = `organizer_id.eq.${userId}` + (joinedEventIds.length > 0 ? `,id.in.(${joinedEventIds.join(',')})` : '');
        
        const { data: userEvents } = await sClient.from('events').select('id, start_time, end_time, title').or(orCondition);
        if (userEvents) {
            for (const e of userEvents) {
                if (ignoreEventId && e.id === ignoreEventId) continue;
                const eStart = new Date(e.start_time);
                const eEnd = new Date(e.end_time);
                if (start < eEnd && end > eStart) return e.title;
            }
        }

        // 2. Check Schedule Table (OCR Classes / Manual Busy Blocks)
        const { data: scheduleBlocks } = await sClient.from('schedule').select('*').eq('user_id', userId).eq('is_busy', true);
        if (scheduleBlocks) {
            const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][start.getDay()];
            
            for (const block of scheduleBlocks) {
                let blockDateForCompare = new Date(start);

                // If specific_date exists, it must match
                if (block.specific_date) {
                    const bDate = new Date(block.specific_date);
                    const sDate = new Date(start);
                    if (bDate.getFullYear() !== sDate.getFullYear() || bDate.getMonth() !== sDate.getMonth() || bDate.getDate() !== sDate.getDate()) continue;
                    blockDateForCompare = bDate;
                } else {
                    // Recurring block: must match day of week
                    if (block.day_of_week !== dayOfWeek) continue;
                }

                // Check time overlap securely by mapping to the actual event day
                const [bSH, bSM] = block.start_time.split(':').map(Number);
                const [bEH, bEM] = block.end_time.split(':').map(Number);
                
                const blockStartDate = new Date(blockDateForCompare);
                blockStartDate.setHours(bSH, bSM, 0, 0);
                
                const blockEndDate = new Date(blockDateForCompare);
                blockEndDate.setHours(bEH, bEM, 0, 0);
                
                // If it crosses midnight, end time is on the next day
                if (blockEndDate < blockStartDate) {
                    blockEndDate.setDate(blockEndDate.getDate() + 1);
                }

                // Standard overlap formula
                if (start.getTime() < blockEndDate.getTime() && end.getTime() > blockStartDate.getTime()) {
                    return block.title || block.label || "Busy Block";
                }
            }
        }

        return null;
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
    public async joinEvent(eventId: string, forceJoin: boolean = false): Promise<ResponseEntity> {
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

            // 2. Check overlap only if not force-joining
            if (!forceJoin) {
                const conflict = await this.checkScheduleConflict(user.id, eventDate, endTime, eventId);
                if (conflict) {
                    return { 
                        status: 409, 
                        message: `Schedule Conflict: You already have "${conflict}" scheduled during this time. Join anyway?`,
                        data: { conflictingEvent: conflict }
                    };
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
