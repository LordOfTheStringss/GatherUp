import { CreateEventDTO, EventFilterDTO } from '../../controllers/EventController';
import { SupabaseClient } from '../../infra/SupabaseClient';
import { VectorService } from '../../intelligence/VectorService';

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
                sub_category: eventData.sub_category,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                location_lat: eventData.location_lat,
                location_lng: eventData.location_lng,
                location_name: eventData.location_name,
                location_type: eventData.location_type,
                location_id: eventData.location_id,
                is_private: eventData.is_private || false,
                description: eventData.description || '',
                min_capacity: eventData.min_capacity || 0,
                max_capacity: eventData.max_capacity || 0
            })
            .select()
            .single();

        if (error) {
            console.error('Create event error:', error);
            throw new Error(error.message);
        }

        // Notify friends asynchronously
        if (!eventData.is_private) {
            this.notifyFriendsAboutNewEvent(organizerId, eventData.title).catch(e => console.error("Failed to notify friends:", e));
        }

        // Generate and save event embedding asynchronously
        const durationHours = (endTime.getTime() - startTime.getTime()) / 3600000;
        
        VectorService.getInstance().generateEventEmbedding(data.id, {
            title: eventData.title,
            time: startTime,
            durationHours: durationHours,
            locationName: eventData.location_name,
            locationType: eventData.location_type,
            category: eventData.category,
            subCategory: eventData.sub_category,
            minCapacity: eventData.min_capacity,
            maxCapacity: eventData.max_capacity,
            description: eventData.description
        }).catch((e: any) => console.error("Failed to generate event embedding:", e));

        return data;
    }

    private async notifyFriendsAboutNewEvent(organizerId: string, eventTitle: string) {
        // 1. Fetch organizer name
        const { data: user } = await this.supabaseClient.client.from('users').select('full_name').eq('id', organizerId).single();
        if (!user) return;

        // 2. Fetch friends (mutual follows)
        const { data: whoFollowsMe } = await this.supabaseClient.client.from('friendships').select('user_id').eq('friend_id', organizerId);
        const { data: whoIFollow } = await this.supabaseClient.client.from('friendships').select('friend_id').eq('user_id', organizerId);

        const myFollowingIds = (whoIFollow || []).map((f: any) => f.friend_id);
        const friendsIds = (whoFollowsMe || []).map((f: any) => f.user_id).filter((id: string) => myFollowingIds.includes(id));

        if (!friendsIds || friendsIds.length === 0) return;

        // 3. Dispatch notifications
        const { NotificationService } = await import('../../infra/NotificationService');
        const notifService = NotificationService.getInstance();

        for (const targetId of friendsIds) {
            await notifService.sendFriendEventNotification(targetId, eventTitle, user.full_name);
        }
    }

    public async getEvents(filter: EventFilterDTO): Promise<any[]> {
        // Default: Only fetch events that have not yet ended
        let query = this.supabaseClient.client.from('events')
            .select('*, users!events_organizer_id_fkey(full_name)');

        if (!filter.includeExpired) {
            query = query.gte('end_time', new Date().toISOString());
        }

        if (filter.category && filter.category !== 'All') {
            query = query.eq('sub_category', filter.category);
        }
        if (filter.organizerId) {
            query = query.eq('organizer_id', filter.organizerId);
        }

        if (filter.friendsOnly && filter.userId) {
            // Fetch accepted friends (mutual follows)
            const { data: whoFollowsMe } = await this.supabaseClient.client.from('friendships').select('user_id').eq('friend_id', filter.userId);
            const { data: whoIFollow } = await this.supabaseClient.client.from('friendships').select('friend_id').eq('user_id', filter.userId);

            const myFollowingIds = (whoIFollow || []).map((f: any) => f.friend_id);
            const friendsIds = (whoFollowsMe || []).map((f: any) => f.user_id).filter((id: string) => myFollowingIds.includes(id));

            let allowedIds = [filter.userId, ...friendsIds];
            query = query.in('organizer_id', allowedIds);
        } else if (filter.userId) {
            // If not friends-only, but userId is provided (like in Nearby feed),
            // we should only show (public events) OR (my events) OR (friends' events).
            // We'll fetch friends first.
            const { data: whoFollowsMe } = await this.supabaseClient.client.from('friendships').select('user_id').eq('friend_id', filter.userId);
            const { data: whoIFollow } = await this.supabaseClient.client.from('friendships').select('friend_id').eq('user_id', filter.userId);
            const myFollowingIds = (whoIFollow || []).map((f: any) => f.friend_id);
            const friendsIds = (whoFollowsMe || []).map((f: any) => f.user_id).filter((id: string) => myFollowingIds.includes(id));

            const allowedOrganizerIds = [filter.userId, ...friendsIds];

            // Build the visibility condition: is_private is false OR organizer_id in allowedOrganizerIds
            query = query.or(`is_private.eq.false,organizer_id.in.(${allowedOrganizerIds.join(',')})`);
        } else {
            // No userId, only show public events
            query = query.eq('is_private', false);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Get events error:', error);
            throw new Error(error.message);
        }

        let results = data || [];

        // Apply local geographic filtering if requested
        if (filter.location && filter.radius) {
            results = results.filter((event: any) => {
                if (!event.location_lat || !event.location_lng) return false;
                const dist = this.calculateDistance(
                    filter.location!.latitude,
                    filter.location!.longitude,
                    event.location_lat,
                    event.location_lng
                );
                return dist <= filter.radius!;
            });
        }

        return results;
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    public async joinEvent(eventId: string, userId: string): Promise<void> {
        // 1. Fetch event to check time and capacity
        const { data: eventData, error: eventErr } = await this.supabaseClient.client
            .from('events')
            .select('start_time, end_time, max_capacity, title, organizer_id')
            .eq('id', eventId)
            .single();

        if (eventErr || !eventData) {
            throw new Error('Event not found.');
        }

        // Check time constraints
        const now = new Date();
        const endTime = new Date(eventData.end_time);
        if (now > endTime) {
            throw new Error('This event has already ended.');
        }

        // 2. Check current capacity
        const { count, error: countErr } = await this.supabaseClient.client
            .from('event_participants')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId);

        if (countErr) {
            throw new Error('Failed to verify capacity: ' + countErr.message);
        }

        const currentCount = count || 0;
        const maxCapacity = eventData.max_capacity || 9999; // Fallback if null

        if (currentCount >= maxCapacity) {
            throw new Error('This event has reached its maximum capacity.');
        }

        // 3. Insert participant
        const { error } = await this.supabaseClient.client
            .from('event_participants')
            .insert({
                event_id: eventId,
                user_id: userId
            });

        if (error) {
            // Check for unique constraint violation (already joined)
            if (error.code === '23505') {
                throw new Error('You have already joined this event.');
            }
            console.error('Join event error:', error);
            throw new Error(error.message);
        }

        // 4. Send Notification to Organizer
        if (userId !== eventData.organizer_id) {
            const { data: participant } = await this.supabaseClient.client
                .from('users')
                .select('full_name')
                .eq('id', userId)
                .single();

            if (participant) {
                const { NotificationService } = await import('../../infra/NotificationService');
                await NotificationService.getInstance().sendEventJoinNotification(
                    eventData.organizer_id,
                    eventData.title,
                    participant.full_name
                );
            }
        }
    }
    public async getEventParticipants(eventId: string): Promise<any[]> {
        const { data, error } = await this.supabaseClient.client
            .from('event_participants')
            .select(`
                user_id,
                users!event_participants_user_id_fkey (id, full_name, profile_image, badges)
            `)
            .eq('event_id', eventId);

        if (error) {
            console.error('getEventParticipants error:', error);
            throw new Error(error.message);
        }

        return (data || []).map((p: any) => p.users);
    }
}
