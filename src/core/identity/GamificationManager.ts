import { SupabaseClient } from '../../infra/SupabaseClient';
import { BadgeEnum, User } from './User';

/**
 * Controls reputation mechanics between users after social interactions.
 */
export class GamificationManager {
    private supabaseClient: any;

    constructor() {
        this.supabaseClient = SupabaseClient.getInstance();
    }

    public async calculateAndAwardBadges(userId: string): Promise<string[]> {
        try {
            // Fetch current stats
            const { count: eventsAttended, error: e1 } = await this.supabaseClient.client
                .from('event_participants')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);
            
            if (e1) console.error('GamificationManager: Error fetching attended count', e1);

            const { count: eventsHosted, error: e2 } = await this.supabaseClient.client
                .from('events')
                .select('*', { count: 'exact', head: true })
                .eq('organizer_id', userId);

            if (e2) console.error('GamificationManager: Error fetching hosted count', e2);
            
            // Fetch user document (for privacy_settings counters & existing badges)
            const { data: user, error: e3 } = await this.supabaseClient.client
                .from('users')
                .select('badges, privacy_settings')
                .eq('id', userId)
                .single();
            
            if (e3 || !user) {
                console.error('GamificationManager: User not found or error', e3);
                return [];
            }

            const groupAICount = user.privacy_settings?.groupAICount || 0;
            const oneTapCount = user.privacy_settings?.oneTapCount || 0;
            
            const currentBadges: string[] = user.badges || [];
            const newBadges = new Set<string>(currentBadges);

            // 1. Participation Badges
            if ((eventsAttended || 0) >= 1) newBadges.add('FIRST_STEP');
            if ((eventsAttended || 0) >= 10) newBadges.add('THE_REGULAR');
            if ((eventsAttended || 0) >= 50) newBadges.add('COMMUNITY_LEGEND');

            // 2. Organizing Badges
            if ((eventsHosted || 0) >= 1) newBadges.add('THE_HOST');
            if ((eventsHosted || 0) >= 10) newBadges.add('ACTIVE_ORGANIZER');
            if ((eventsHosted || 0) >= 30) newBadges.add('LISAN_AL_GAIB');

            // 3. Group AI Planning Badges
            if (groupAICount >= 1) newBadges.add('TEAM_SPIRIT');
            if (groupAICount >= 10) newBadges.add('THE_COORDINATOR');
            if (groupAICount >= 25) newBadges.add('THE_GANGMAKER');

            // 4. One-Tap Suggestion Badges
            if (oneTapCount >= 1) newBadges.add('SPONTANEOUS');
            if (oneTapCount >= 10) newBadges.add('THE_ADVENTURER');
            if (oneTapCount >= 25) newBadges.add('INDIANA_JONES');

            const updatedBadges = Array.from(newBadges);

            if (updatedBadges.length !== currentBadges.length) {
                const { error: updateError } = await this.supabaseClient.client
                    .from('users')
                    .update({ badges: updatedBadges })
                    .eq('id', userId);
                
                if (updateError) {
                    console.error('GamificationManager: Error updating badges', updateError);
                }
            }

            return updatedBadges;
        } catch (err) {
            console.error('GamificationManager: Unexpected error', err);
            return [];
        }
    }

    public async recordOneTapUsage(userId: string): Promise<void> {
        const { data: user } = await this.supabaseClient.client.from('users').select('privacy_settings').eq('id', userId).single();
        const settings = user?.privacy_settings || {};
        settings.oneTapCount = (settings.oneTapCount || 0) + 1;
        await this.supabaseClient.client.from('users').update({ privacy_settings: settings }).eq('id', userId);
    }

    public awardBadge(fromUser: string, toUser: string, badge: BadgeEnum): void {
        // Grants a peer badge 
    }

    public calculateXP(user: User): number {
        return user.reputationScore;
    }

    public updateReputation(user: User): void {}
}
