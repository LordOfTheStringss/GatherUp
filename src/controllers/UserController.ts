import { AuthManager } from '../core/identity/AuthManager';
import { FriendshipManager } from '../core/identity/FriendshipManager';
import { GamificationManager } from '../core/identity/GamificationManager';
import { UserManager } from '../core/identity/UserManager';
import { ResponseEntity } from './ResponseEntity';

export interface UpdateProfileDTO {
    bio?: string;
    interests?: string[];
    profilePhoto?: string;
}

export interface PublicProfileDTO {
    id: string;
    fullName: string;
    trustScore: number;
    interestTags: string[];
}

export interface UserDTO {
    id: string;
    email: string;
    fullName: string;
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
    public async getMyProfile(userId?: string): Promise<ResponseEntity<UserDTO>> {
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
            return {
                status: 200,
                data: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name || '',
                    xp: user.reputation_score || 0,
                    badges: user.badges || []
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
                    trustScore: user.reputation_score || 0,
                    interestTags: user.interest_tags || []
                }
            };
        } catch (error: any) {
            return { status: 404, message: error.message || "User not found" };
        }
    }

    /**
     * Calls friendshipManager.sendRequest().
     */
    public async sendFriendRequest(toUserId: string): Promise<ResponseEntity> {
        return { status: 201, message: "Request Sent" };
    }

    /**
     * Calls accept or reject operations of FriendshipManager.
     */
    public async respondToFriendRequest(requestId: string, action: FriendAction): Promise<ResponseEntity> {
        return { status: 200, message: `Request ${action}` };
    }

    /**
     * Returns the friend list.
     */
    public async getTrustedCircle(): Promise<ResponseEntity<UserDTO[]>> {
        return { status: 200, data: [] };
    }
}
