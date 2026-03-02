import { AuthManager } from '../core/identity/AuthManager';
import { FriendshipManager } from '../core/identity/FriendshipManager';
import { GamificationManager } from '../core/identity/GamificationManager';
import { UserManager } from '../core/identity/UserManager';
import { ResponseEntity } from './ResponseEntity';

export interface UpdateProfileDTO {
    name?: string;
    bio?: string;
    interests?: string[];
    profilePhoto?: string;
}

export interface PublicProfileDTO {
    id: string;
    fullName: string;
    trustScore: number;
    interestTags: string[];
    bio?: string;
}

export interface UserDTO {
    id: string;
    email: string;
    fullName: string;
    bio?: string;
    xp: number;
    badges: string[];
}

export enum FriendAction {
    ACCEPT = 'ACCEPT',
    REJECT = 'REJECT'
}

/**
 * Handles profile management and Trusted Circle (friendship) operations.
 */
export class UserController {
    // Attributes
    private userManager: UserManager;
    private friendshipManager: FriendshipManager;
    private gamificationManager: GamificationManager;

    constructor(userManager: UserManager, friendshipManager: FriendshipManager, gamificationManager: GamificationManager) {
        this.userManager = userManager;
        this.friendshipManager = friendshipManager;
        this.gamificationManager = gamificationManager;
    }

    /**
     * Returns user profile including XP and badges.
     */
    public async getMyProfile(userId?: string): Promise<ResponseEntity<any>> {
        try {
            let effectiveId: string;
            if (!userId || userId === "mock-user-id") {
                const userSession = await AuthManager.getInstance().getCurrentUser();
                if (!userSession) throw new Error("Authentication required");
                effectiveId = userSession.id;
            } else {
                effectiveId = userId;
            }
            const user = await this.userManager.getUserProfile(effectiveId);

            // Get stats
            const sClient = require('../infra/SupabaseClient').SupabaseClient.getInstance().client;
            const { count: eventsAttended } = await sClient.from('event_participants').select('*', { count: 'exact', head: true }).eq('user_id', effectiveId);
            const { count: eventsHosted } = await sClient.from('events').select('*', { count: 'exact', head: true }).eq('organizer_id', effectiveId);
            const friends = await this.friendshipManager.getTrustedCircle(effectiveId);

            return {
                status: 200,
                data: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name || '',
                    bio: user.privacy_settings?.bio || '',
                    xp: user.reputation_score || 0,
                    badges: user.badges || [],
                    stats: {
                        eventsAttended: eventsAttended || 0,
                        eventsHosted: eventsHosted || 0,
                        trustedCircleCount: friends.length
                    }
                }
            };
        } catch (error: any) {
            return { status: 404, message: error.message || "User not found" };
        }
    }

    /**
     * Updates bio, interests, or profile photo.
     */
    public async updateProfile(userId?: string, data?: UpdateProfileDTO): Promise<ResponseEntity> {
        try {
            let effectiveId: string;
            if (!userId || userId === "mock-user-id") {
                const userSession = await AuthManager.getInstance().getCurrentUser();
                if (!userSession) throw new Error("Authentication required");
                effectiveId = userSession.id;
            } else {
                effectiveId = userId;
            }
            if (!data) throw new Error("Update data required");
            await this.userManager.updateProfile(effectiveId, {
                name: data.name,
                bio: data.bio,
                interests: data.interests,
                profilePhoto: data.profilePhoto
            });
            return { status: 200, message: "Profile Updated" };
        } catch (error: any) {
            return { status: 500, message: error.message || "Failed to update profile" };
        }
    }

    /**
     * Displays another user's profile with sensitive data hidden.
     */
    public async getUserProfile(targetUserId: string): Promise<ResponseEntity<PublicProfileDTO>> {
        try {
            const user = await this.userManager.getUserProfile(targetUserId);
            return {
                status: 200,
                data: {
                    id: user.id,
                    fullName: user.full_name || '',
                    bio: user.privacy_settings?.bio || '',
                    trustScore: user.reputation_score || 0,
                    interestTags: user.interest_tags || []
                }
            };
        } catch (error: any) {
            return { status: 404, message: error.message || "User not found" };
        }
    }

    // -- Friends placeholders, will improve later
    public async sendFriendRequest(toUserId: string): Promise<ResponseEntity> {
        return { status: 201, message: "Request Sent" };
    }
    public async respondToFriendRequest(requestId: string, action: FriendAction): Promise<ResponseEntity> {
        return { status: 200, message: `Request ${action}` };
    }
    public async getTrustedCircle(): Promise<ResponseEntity<UserDTO[]>> {
        return { status: 200, data: [] };
    }
}
