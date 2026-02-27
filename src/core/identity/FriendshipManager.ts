import { NotificationService } from '../../infra/NotificationService';
import { User } from './User';

export interface FriendshipRepo {
    // Database interface for the Friendships table
}

/**
 * Manages the social graph. Handles lifecycle of connections.
 */
export class FriendshipManager {
    private repository: FriendshipRepo;
    private notificationService: NotificationService;
    private MAX_FRIENDS: number = 500;

    constructor(repository: FriendshipRepo, notificationService: NotificationService) {
        this.repository = repository;
        this.notificationService = notificationService;
    }

    public async sendRequest(from: string, to: string): Promise<void> {
        // Creates a PENDING record. Notification sent to. Throws error if blocked.
    }

    public async acceptRequest(requestId: string): Promise<void> {
        // Updates status to ACCEPTED. Updates friendList for both users.
    }

    public async rejectRequest(requestId: string): Promise<void> {
        // Soft delete (Status: REJECTED) or hard delete.
    }

    public async getTrustedCircle(userId: string): Promise<User[]> {
        // Returns all users where status == ACCEPTED. Used for Event Visibility.
        return [];
    }

    public async removeFriend(userId: string, targetId: string): Promise<void> {
        // Deletes the bidirectional link. Immediate access revocation.
    }

    public async blockUser(userId: string, targetId: string): Promise<void> {
        // Sets status to BLOCKED. Prevents future interaction.
    }
}
