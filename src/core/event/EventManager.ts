import { CreateEventDTO, EventFilterDTO } from '../../controllers/EventController';
import { SupabaseClient } from '../../infra/SupabaseClient';

/**
 * Orchestrates event lifecycle operations.
 */
export class EventManager {
    private static instance: EventManager;
    private supabaseClient: any;

    private constructor() {
        this.supabaseClient = SupabaseClient.getInstance();
    }

    public static getInstance(): EventManager {
        if (!EventManager.instance) {
            EventManager.instance = new EventManager();
        }
        return EventManager.instance;
    }

    public async createEvent(organizerId: string, eventData: CreateEventDTO): Promise<any> {
        let startTime = eventData.time ? new Date(eventData.time) : new Date();
        let endTime = new Date(startTime.getTime() + 3600000); // Default 1 hour
        if (eventData.duration) {
            let minutes = 60;
            if (eventData.duration.includes('30')) minutes = 30;
            if (eventData.duration.includes('1.5')) minutes = 90;
            if (eventData.duration.includes('2 hours')) minutes = 120;
            if (eventData.duration.includes('2.5')) minutes = 150;
            if (eventData.duration.includes('3')) minutes = 180;
            if (eventData.duration.includes('4')) minutes = 240;
            if (eventData.duration.includes('5')) minutes = 300;
            endTime = new Date(startTime.getTime() + minutes * 60000);
        }

        const { data, error } = await this.supabaseClient.client
            .from('events')
            .insert({
                organizer_id: organizerId,
                title: eventData.title,
                sub_category: eventData.category,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                location_lat: eventData.location_lat,
                location_lng: eventData.location_lng,
            })
            .select()
            .single();

        if (error) {
            console.error('Create event error:', error);
            throw new Error(error.message);
        }
        return data;
    }

    public async getEvents(filter: EventFilterDTO): Promise<any[]> {
        // Fetch events and join with users table to get host data
        let query = this.supabaseClient.client.from('events').select('*, host_details:users!events_organizer_id_fkey(full_name)');
        // Fallback or simpler approach if above fails: .select('*, users(full_name)') 
        // We'll just try the simpler one first since it is usually sufficient if one FK exists.
        // Actually the safest simple way is .select('*, users(full_name)')
        query = this.supabaseClient.client.from('events').select('*, users!events_organizer_id_fkey(full_name)');

        if (filter.category && filter.category !== 'All') {
            query = query.eq('sub_category', filter.category);
        }
        if (filter.organizerId) {
            query = query.eq('organizer_id', filter.organizerId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Get events error:', error);
            throw new Error(error.message);
        }
        return data || [];
    }

    public async joinEvent(eventId: string, userId: string): Promise<void> {
        const { error } = await this.supabaseClient.client
            .from('event_participants')
            .insert({
                event_id: eventId,
                user_id: userId
            });

        if (error) {
            console.error('Join event error:', error);
            throw new Error(error.message);
        }
    }
}
