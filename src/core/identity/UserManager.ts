import { SupabaseClient } from '../../infra/SupabaseClient';
import { VectorService } from '../../intelligence/VectorService';

/**
 * Manages core user persistence and state updates.
 */
export class UserManager {
    private static instance: UserManager;
    private supabaseClient: any;

    private constructor() {
        this.supabaseClient = SupabaseClient.getInstance();
    }

    public static getInstance(): UserManager {
        if (!UserManager.instance) {
            UserManager.instance = new UserManager();
        }
        return UserManager.instance;
    }

    public async updateProfile(userId: string, data: { name?: string, bio?: string, interests?: string[], profilePhoto?: string, baseLocation?: string }): Promise<void> {
        const updateData: any = {};
        if (data.name) updateData.full_name = data.name;

        if (data.bio) {
            // Let's store bio in privacy_settings JSONB to avoid altering DB columns unnecessarily
            const currentUser = await this.getUserProfile(userId);
            const currentPrivacySettings = currentUser.privacy_settings || {};
            currentPrivacySettings.bio = data.bio;
            updateData.privacy_settings = currentPrivacySettings;
        }

        if (data.interests) updateData.interest_tags = data.interests;
        if (data.profilePhoto) updateData.profile_image = data.profilePhoto;
        if (data.baseLocation !== undefined) updateData.base_location = data.baseLocation;

        if (Object.keys(updateData).length === 0) return;

        const { error } = await this.supabaseClient.client
            .from('users')
            .update(updateData)
            .eq('id', userId);

        if (error) {
            console.error('Update profile error:', error);
            throw new Error(error.message);
        }

        // Trigger embedding update asynchronously
        const user = await this.getUserProfile(userId);
        const score = user.reputation_score || 0;
        const status = user.email ? (user.email.endsWith('.edu.tr') ? 'öğrenci' : 'çalışan') : 'çalışan';
        const tags = user.interest_tags || [];

        VectorService.getInstance().generateUserEmbedding(userId, score, status, tags, true)
            .catch((e: any) => console.error("Failed to update user embedding after profile change:", e));
    }

    public async getUserProfile(userId: string): Promise<any> {
        const { data, error } = await this.supabaseClient.client
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Get profile error:', error);
            throw new Error(error.message);
        }

        return data;
    }
}
