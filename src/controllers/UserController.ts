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
    public async getMyProfile(userId: string): Promise<ResponseEntity<UserDTO>> {
        return { status: 200 };
    }

    /**
     * Updates bio, interests, or profile photo.
     */
    public async updateProfile(userId: string, data: UpdateProfileDTO): Promise<ResponseEntity> {
        return { status: 200, message: "Profile Updated" };
    }

    /**
     * Displays another user's profile with sensitive data hidden.
     */
    public async getUserProfile(targetUserId: string): Promise<ResponseEntity<PublicProfileDTO>> {
        return { status: 200 };
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
