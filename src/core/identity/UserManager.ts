import * as FileSystem from 'expo-file-system/legacy';
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

    /**
     * Helper to decode base64 to Uint8Array (binary) for Supabase
     */
    private decodeBase64(base64: string): Uint8Array {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const binaryString = base64.replace(/\s/g, '');
        const len = binaryString.length;
        
        // Calculate the actual length of binary data
        let size = (len / 4) * 3;
        if (binaryString.endsWith('==')) size -= 2;
        else if (binaryString.endsWith('=')) size -= 1;
        
        const buffer = new Uint8Array(size);
        
        let i = 0;
        let j = 0;
        while (i < len) {
            const char1 = characters.indexOf(binaryString[i++]);
            const char2 = characters.indexOf(binaryString[i++]);
            const char3 = characters.indexOf(binaryString[i++]);
            const char4 = characters.indexOf(binaryString[i++]);

            const byte1 = (char1 << 2) | (char2 >> 4);
            const byte2 = ((char2 & 15) << 4) | (char3 >> 2);
            const byte3 = ((char3 & 3) << 6) | (char4 & 63);

            buffer[j++] = byte1;
            if (char3 !== -1 && char3 !== 64 && j < buffer.length) buffer[j++] = byte2;
            if (char4 !== -1 && char4 !== 64 && j < buffer.length) buffer[j++] = byte3;
        }
        return buffer;
    }

    /**
     * Uploads user avatar to Supabase storage.
     * Fixed with raw binary decoding to avoid 0-byte blob issues.
     */
    public async uploadAvatar(userId: string, imageUri: string): Promise<string> {
        const fileName = `${userId}_${Date.now()}.jpg`;
        const filePath = `${fileName}`;

        console.log("UserManager: STARTING RAW BINARY UPLOAD for:", imageUri);

        try {
            // 1. Read as base64
            const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
            
            // 2. Convert to binary
            const binaryData = this.decodeBase64(base64);

            console.log("UserManager: Raw binary size:", binaryData.length, "bytes (should NOT be 0)");

            if (!binaryData || binaryData.length === 0) {
              console.error("UserManager: CRITICAL FAILURE! Binary data is empty.");
              throw new Error("Failed to capture image data as binary.");
            }

            // 3. Upload raw binary
            const { data, error } = await this.supabaseClient.client.storage
                .from('avatars')
                .upload(filePath, binaryData, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (error) {
                console.error('Supabase storage binary upload error:', error);
                throw new Error(error.message);
            }

            const { data: { publicUrl } } = this.supabaseClient.client.storage
                .from('avatars')
                .getPublicUrl(filePath);

            console.log("UserManager: Upload SUCCESS! Final URL:", publicUrl);

            // AUTO-SYNC: Update the database record as well!
            console.log("UserManager: Syncing profile_image URL to database for", userId);
            const { error: dbError } = await this.supabaseClient.client
                .from('users')
                .update({ profile_image: publicUrl })
                .eq('id', userId);

            if (dbError) {
                console.error("UserManager: Database sync failed:", dbError);
                // We don't throw here to avoid failing the whole process if only sync fails, 
                // but usually this should succeed.
            } else {
                console.log("UserManager: Database sync SUCCESS!");
            }

            return publicUrl;
        } catch (err: any) {
            console.error('UserManager: uploadAvatar (binary) failed:', err);
            throw err;
        }
    }

    public async updateProfile(userId: string, data: { name?: string, bio?: string, interests?: string[], profilePhoto?: string, baseLocation?: string, status?: string, isAvailable?: boolean }): Promise<void> {
        console.log("UserManager: updateProfile called for", userId, "with data:", JSON.stringify(data));
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
        if (data.profilePhoto !== undefined) {
            console.log("UserManager: Updating profile_image to:", data.profilePhoto);
            updateData.profile_image = data.profilePhoto;
        }
        if (data.baseLocation !== undefined) updateData.base_location = data.baseLocation;
        if (data.status) updateData.status = data.status;
        if (data.isAvailable !== undefined) updateData.is_available = data.isAvailable;

        if (Object.keys(updateData).length === 0) {
            console.warn("UserManager: No update data provided");
            return;
        }

        console.log("UserManager: Supabase Update Payload:", JSON.stringify(updateData));
        const { error } = await this.supabaseClient.client
            .from('users')
            .update(updateData)
            .eq('id', userId);

        if (error) {
            console.error('Update profile error:', error);
            throw new Error(error.message);
        }
        console.log("UserManager: Supabase update successful");

        // Trigger embedding update asynchronously via local ONNX model
        VectorService.getInstance().generateUserEmbedding(userId)
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
