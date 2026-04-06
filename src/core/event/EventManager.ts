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
            if (eventData.duration === '30 mins') minutes = 30;
            else if (eventData.duration === '1.5 hours') minutes = 90;
            else if (eventData.duration === '2 hours') minutes = 120;
            else if (eventData.duration === '2.5 hours') minutes = 150;
            else if (eventData.duration === '3 hours') minutes = 180;
            else if (eventData.duration === '4 hours') minutes = 240;
            else if (eventData.duration === '5 hours') minutes = 300;
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

    /**
     * Fetches events the user either hosts or has joined (attended).
     * Returns a combined, deduplicated list with participant counts and role.
     */
    public async getMyEventsIncludingAttended(userId: string): Promise<any[]> {
        // 1. Events I organized
        const { data: hosted, error: hostedErr } = await this.supabaseClient.client
            .from('events')
            .select('*, users!events_organizer_id_fkey(full_name)')
            .eq('organizer_id', userId)
            .gte('end_time', new Date().toISOString());

        if (hostedErr) console.error('Hosted events error:', hostedErr);

        // 2. Events I joined (via event_participants)
        const { data: participations, error: partErr } = await this.supabaseClient.client
            .from('event_participants')
            .select('event_id, events(*, users!events_organizer_id_fkey(full_name))')
            .eq('user_id', userId);

        if (partErr) console.error('Participated events error:', partErr);

        // 3. Get participant counts for all relevant events
        const hostedList = (hosted || []).map((e: any) => ({ ...e, _role: 'hosted' }));
        const attendedList = (participations || [])
            .map((p: any) => p.events)
            .filter((e: any) => e && new Date(e.end_time) >= new Date())
            .map((e: any) => ({ ...e, _role: 'attending' }));

        // 4. Merge & deduplicate (hosted takes priority)
        const eventMap = new Map<string, any>();
        for (const e of hostedList) eventMap.set(e.id, e);
        for (const e of attendedList) {
            if (!eventMap.has(e.id)) eventMap.set(e.id, e);
        }

        // 5. Filter out events that have already ended using proper Date objects
        const nowObj = new Date();
        const activeEvents = Array.from(eventMap.values()).filter(e => new Date(e.end_time || e.start_time) >= nowObj);

        // 6. Fetch participant counts for all events
        const eventIds = activeEvents.map(e => e.id);

        if (eventIds.length > 0) {
            const { data: counts } = await this.supabaseClient.client
                .from('event_participants')
                .select('event_id')
                .in('event_id', eventIds);

            const countMap: Record<string, number> = {};
            (counts || []).forEach((c: any) => {
                countMap[c.event_id] = (countMap[c.event_id] || 0) + 1;
            });

            activeEvents.forEach(e => {
                e.participant_count = countMap[e.id] || 0;
            });
        }

        return activeEvents;
    }

    public async endEvent(eventId: string): Promise<void> {
        const { error } = await this.supabaseClient.client
            .from('events')
            .update({ end_time: new Date().toISOString() })
            .eq('id', eventId);

        if (error) {
            console.error('End event error:', error);
            throw new Error(error.message);
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

        const bannedUserId = process.env.EXPO_PUBLIC_BANNED_USER_ID;
        if (bannedUserId && filter.organizerId !== bannedUserId) {
            query = query.neq('organizer_id', bannedUserId);
        }

        if (filter.userId) {
            // Fetch accepted friends (mutual follows) to limit feed scope if friendsOnly=true
            const { data: whoFollowsMe } = await this.supabaseClient.client.from('friendships').select('user_id').eq('friend_id', filter.userId);
            const { data: whoIFollow } = await this.supabaseClient.client.from('friendships').select('friend_id').eq('user_id', filter.userId);
            const myFollowingIds = (whoIFollow || []).map((f: any) => f.friend_id);
            const friendsIds = (whoFollowsMe || []).map((f: any) => f.user_id).filter((id: string) => myFollowingIds.includes(id));
            const allowedOrganizerIds = [filter.userId, ...friendsIds];

            // Determine which private events this user has explicit access to
            // 1. Check event invites in notifications table
            const { data: myInvites } = await this.supabaseClient.client
                .from('notifications')
                .select('data')
                .eq('user_id', filter.userId)
                .eq('type', 'event_invite');

            const invitedEventIds = (myInvites || []).filter((n: any) => n.data && n.data.eventId).map((n: any) => n.data.eventId);

            // 2. Check events user has already joined
            const { data: myParticipations } = await this.supabaseClient.client
                .from('event_participants')
                .select('event_id')
                .eq('user_id', filter.userId);

            const participatedEventIds = (myParticipations || []).map((p: any) => p.event_id);

            const allowedPrivateIds = [...new Set([...invitedEventIds, ...participatedEventIds])];
            const privateIdsString = allowedPrivateIds.length > 0 ? `,id.in.(${allowedPrivateIds.join(',')})` : '';

            // Visibility condition: Event is PUBLIC, OR I am the organizer, OR I have explicit access (invited/joined)
            const visibilityOrCondition = `is_private.eq.false,organizer_id.eq.${filter.userId}${privateIdsString}`;

            if (filter.friendsOnly) {
                // If friendsOnly feed, restrict strictly to friends' events AND apply the visibility condition
                query = query.in('organizer_id', allowedOrganizerIds);
                query = query.or(visibilityOrCondition);
            } else {
                // If not friends-only (e.g. Nearby map), show everything that satisfies visibility
                query = query.or(visibilityOrCondition);
            }
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
