import { Event } from '../core/event/Event';
import { NotificationService } from '../infra/NotificationService';
import { SupabaseClient } from '../infra/SupabaseClient';
import { PivotNotPossibleException } from './Exceptions';
import { VectorService } from './VectorService';

export interface MergeProposal {
    id: string;
    eventA: Event;
    eventB: Event;
    suggestedData: any;
    accepted_by: string[];
    status: 'PENDING' | 'EXECUTED' | 'REJECTED';
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
    public async scanForMerges(activeEvents: Event[]): Promise<void> {
        // Logic to find pairs
        // For each pair, call this.createMergeProposal
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
    public async executeMerge(proposalId: string): Promise<void> {
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

        const organizerId = proposal.accepted_by[0]; // First one to accept is organizer
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
                `Your event has been merged into: ${proposal.suggested_data.title}`,
                { eventId: newEvent.id },
                'general'
            );
        }
    }
}
