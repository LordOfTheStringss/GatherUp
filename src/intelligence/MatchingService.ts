import { Event } from '../core/event/Event';
import { NotificationService } from '../infra/NotificationService';
import { MergeInvalidException, PivotNotPossibleException } from './Exceptions';
import { VectorService } from './VectorService';

export interface MergeProposal {
    eventA: Event;
    eventB: Event;
    score: number;
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
    public scanForMerges(activeEvents: Event[]): MergeProposal[] {
        return [];
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
    public executeMerge(eventA: Event, eventB: Event): Event {
        // Verify buffer length
        const timeDiff = eventA.timeSlot.startTime.getTime() - new Date().getTime();
        const hoursBefore = timeDiff / (1000 * 60 * 60);

        if (hoursBefore < this.minHoursBeforeMerge) {
            throw new MergeInvalidException();
        }

        // Proceed to move users and alter status
        return eventA;
    }
}
