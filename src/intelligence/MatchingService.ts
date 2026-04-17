import { Event } from '../core/event/Event';
import { NotificationService } from '../infra/NotificationService';
import { SupabaseClient } from '../infra/SupabaseClient';
import { PivotNotPossibleException } from './Exceptions';
import { VectorService } from './VectorService';

export interface MergeProposal {
    id: string;
    event_a_id: string;
    event_b_id: string;
    suggested_data: {
        title_a: string;
        title_b: string;
        distance?: number;
    };
    accepted_by: string[];
    status: 'PENDING' | 'EXECUTED' | 'REJECTED' | 'EXPIRED';
    created_at: string;
    expires_at: string;
}

export enum ActivityType {
    CANCELLED = 'CANCELLED',
    COFFEE = 'COFFEE',
    WALK = 'WALK'
}

/**
 * The background "Optimizer" that identifies opportunities to Merge small
 * events or Pivot failing ones.
 */
export class MatchingService {
    public mergeThreshold: number = 0.85;
    public minHoursBeforeMerge: number = 24;
    private vectorService: VectorService;
    private notificationService: NotificationService;

    constructor(vectorService: VectorService, notificationService: NotificationService) {
        this.vectorService = vectorService;
        this.notificationService = notificationService;
    }

    /**
     * Optimization Loop: 1. Filter (size < min and locationDifference < max).
     * 2. Pairwise compare (Similarity > specified value & Time overlap). 3. Check
     * Capacity. 4. Return Candidates.
     */
    /**
     * Triggers the server-side scan for merge candidates via Supabase RPC.
     * The actual matching logic lives in scan_and_create_merge_proposals() SQL function.
     * This method is meant to be called from a background scheduler or on-demand.
     */
    public async scanForMerges(_activeEvents?: Event[]): Promise<void> {
        const { error } = await SupabaseClient.getInstance().client
            .rpc('scan_and_create_merge_proposals');

        if (error) {
            console.error('[MatchingService] scanForMerges RPC failed:', error.message);
            throw error;
        }

        console.log('[MatchingService] Merge scan completed successfully.');
    }

    public async createMergeProposal(eventA: Event, eventB: Event): Promise<string> {
        const suggestedData = {
            title: `Merged: ${eventA.title} & ${eventB.title}`,
            start_time: eventA.timeSlot.startTime.toISOString(),
            end_time: eventA.timeSlot.endTime.toISOString(),
            location_id: eventA.location.locationId,
            location_name: eventA.location.name,
            location_lat: eventA.location.coordinates.latitude,
            location_lng: eventA.location.coordinates.longitude,
            sub_category: eventA.subCategory,
            max_capacity: Math.max(eventA.maxCapacity, eventB.maxCapacity) + 2
        };

        const { data, error } = await SupabaseClient.getInstance().client
            .from('merge_proposals')
            .insert({
                event_a_id: eventA.eventId,
                event_b_id: eventB.eventId,
                suggested_data: suggestedData,
                status: 'PENDING'
            })
            .select()
            .single();

        if (error) throw error;

        // Notify both organizers
        await this.notificationService.sendPush(
            eventA.organizerId,
            "Event Merge Suggested",
            `Would you like to merge your event with ${eventB.title}?`,
            { proposalId: data.id, action: 'EVENT_MERGE_PROPOSAL' },
            'event_merge'
        );

        await this.notificationService.sendPush(
            eventB.organizerId,
            "Event Merge Suggested",
            `Would you like to merge your event with ${eventA.title}?`,
            { proposalId: data.id, action: 'EVENT_MERGE_PROPOSAL' },
            'event_merge'
        );

        return data.id;
    }

    /**
     * Rescue Logic: 1. Trigger when size < min near start. 2. Analyze participants'
     * vectors. 3. Find a fitting activity.
     */
    public suggestPivot(event: Event): ActivityType {
        if (event.participants.length < 2) {
            throw new PivotNotPossibleException();
        }
        return ActivityType.COFFEE;
    }

    /**
     * Commit: 1. Check the 24h buffer. 2. Move participants B->A. 
     * 3. Set B.status=MERGED. 4. Notify.
     */
    public async executeMerge(proposalId: string, executingUserId: string): Promise<void> {
        const sClient = SupabaseClient.getInstance().client;

        // 1. Fetch proposal
        const { data: proposal, error: propErr } = await sClient
            .from('merge_proposals')
            .select('*, event_a_id, event_b_id')
            .eq('id', proposalId)
            .single();

        if (propErr || !proposal) throw new Error("Merge proposal not found");

        // 2. Create NEW merged event
        const { NotificationService } = await import('../infra/NotificationService');
        const { EventManager } = await import('../core/event/EventManager');

        // To pass Supabase RLS (organizer_id = auth.uid()), the executing user must be the organizer
        const organizerId = executingUserId;
        const newEvent = await EventManager.getInstance().createEvent(organizerId, proposal.suggested_data);

        // 3. Migrate participants from BOTH events
        const { data: participantsA } = await sClient.from('event_participants').select('user_id').eq('event_id', proposal.event_a_id);
        const { data: participantsB } = await sClient.from('event_participants').select('user_id').eq('event_id', proposal.event_b_id);

        const allUserIds = Array.from(new Set([
            ...(participantsA || []).map((p: any) => p.user_id),
            ...(participantsB || []).map((p: any) => p.user_id),
            organizerId
        ]));

        for (const uid of allUserIds) {
            if (uid === organizerId) continue; // Already added as organizer? Wait, createEvent might not add organizer to participants table
            await EventManager.getInstance().joinEvent(newEvent.id, uid);
        }

        // 4. Cancel/Archive old events
        await sClient.from('events').update({ status: 'CANCELLED' }).in('id', [proposal.event_a_id, proposal.event_b_id]);
        await sClient.from('merge_proposals').update({ status: 'EXECUTED' }).eq('id', proposalId);

        // 5. Notify everyone
        for (const uid of allUserIds) {
            await NotificationService.getInstance().sendPush(
                uid,
                "Events Merged!",
                `Your event has been merged! Check the new combined event.`,
                { eventId: newEvent.id },
                'general'
            );
        }
    }

    /**
     * Rejects a merge proposal. Marks it as REJECTED and notifies the other organizer.
     * @param proposalId  The UUID of the merge_proposals row.
     * @param rejectingUserId  The user who is rejecting.
     */
    public async rejectMerge(proposalId: string, rejectingUserId: string): Promise<void> {
        const sClient = SupabaseClient.getInstance().client;

        // 1. Fetch proposal — must be PENDING
        const { data: proposal, error: fetchErr } = await sClient
            .from('merge_proposals')
            .select('*')
            .eq('id', proposalId)
            .single();

        if (fetchErr || !proposal) throw new Error('Merge proposal not found');
        if (proposal.status !== 'PENDING') throw new Error('Proposal is no longer pending');

        // 2. Mark as REJECTED
        const { error: updateErr } = await sClient
            .from('merge_proposals')
            .update({ status: 'REJECTED' })
            .eq('id', proposalId);

        if (updateErr) throw updateErr;

        // 3. Notify the other organizer
        const { data: eventA } = await sClient
            .from('events')
            .select('organizer_id, title')
            .eq('id', proposal.event_a_id)
            .single();

        const { data: eventB } = await sClient
            .from('events')
            .select('organizer_id, title')
            .eq('id', proposal.event_b_id)
            .single();

        if (!eventA || !eventB) return;

        // Figure out who is the other party
        const otherOrganizerId = eventA.organizer_id === rejectingUserId
            ? eventB.organizer_id
            : eventA.organizer_id;

        const rejectingTitle = eventA.organizer_id === rejectingUserId ? eventA.title : eventB.title;
        const otherTitle    = eventA.organizer_id === rejectingUserId ? eventB.title : eventA.title;

        await this.notificationService.sendPush(
            otherOrganizerId,
            'Birleşme İsteği Reddedildi',
            `"${rejectingTitle}" etkinliğinin organizatörü, "${otherTitle}" ile birleşme teklifini reddetti.`,
            { proposalId, action: 'merge_rejected' },
            'merge_rejected'
        );

        console.log(`[MatchingService] Proposal ${proposalId} rejected by ${rejectingUserId}.`);
    }
}
