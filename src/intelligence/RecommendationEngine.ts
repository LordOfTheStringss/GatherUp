import { Event } from '../core/event/Event';
import { User } from '../core/identity/User';
import { Location } from '../spatial/Location';

export interface PlanProposal {
    // Structure holding a group suggestion
    suggestedEvent?: Event;
    centroidTimeSlot?: any;
}

/**
 * Orchestrates suggestions by combining Vector Similarity with
 * Spatio-Temporal Constraints (Location & Availability).
 */
export class RecommendationEngine {
    public SEARCH_RADIUS_KM: number = 2.0;
    public SIMILARITY_THRESHOLD: number = 0.70; // Float

    /**
     * Instant Plan: 1. Query events within radius. 2. Filter (Time > 2h, !isFull).
     * 3. Rank via user.profileVector. 4. Return Top #1.
     */
    public getOneTapSuggestion(user: User, loc: Location): Event | null {
        // Mock query & filter
        return null;
    }

    /**
     * Democratic Logic: 1. Calculate Centroid. 2. Find a common free slot.
     * 3. Search events matching Centroid.
     */
    public getGroupSuggestion(users: User[]): PlanProposal {
        return {};
    }

    /**
     * Scoring: 1. calculateSimilarity. 2. Add Context Boost (Proximity + Popularity).
     * 3. Sort Descending. 
     */
    public rankEvents(candidates: Event[], userVec: number[]): Event[] {
        return candidates; // Stub for ranking logic
    }
}
