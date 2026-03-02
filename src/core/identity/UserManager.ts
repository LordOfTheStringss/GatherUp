import { SupabaseClient } from '../../infra/SupabaseClient';

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

    public async updateProfile(userId: string, data: { name?: string, bio?: string, interests?: string[], profilePhoto?: string }): Promise<void> {
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

        if (Object.keys(updateData).length === 0) return;

        const { error } = await this.supabaseClient.client
            .from('users')
            .update(updateData)
            .eq('id', userId);

        if (error) {
            console.error('Update profile error:', error);
            throw new Error(error.message);
        }
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
