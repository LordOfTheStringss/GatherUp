import { NotificationService } from '../../infra/NotificationService';
import { FriendshipManager } from '../identity/FriendshipManager';

/**
 * Provides an emergency alert mechanism for user safety within social interactions.
 */
export class SafetyService {
    private notificationService: NotificationService;
    private friendshipManager: FriendshipManager;

    constructor() {
        this.notificationService = NotificationService.getInstance();
        this.friendshipManager = new FriendshipManager(this.notificationService);
    }

    /**
     * Initiates panic workflow with the current location.
     */
    public async triggerPanic(userId: string, locationStr: string): Promise<void> {
        console.warn(`[PANIC] User ${userId} triggered panic at ${locationStr}`);
        await this.notifyTrustedContacts(userId, locationStr);
    }

    /**
     * Sends emergency alerts to a predefined circle.
     */
    public async notifyTrustedContacts(userId: string, locationStr: string): Promise<void> {
        const friends = await this.friendshipManager.getTrustedCircle(userId);

        for (const friend of friends) {
            await this.notificationService.sendPush(
                friend.id,
                "EMERGENCY ALERT",
                `Your friend needs help! Location: ${locationStr}`,
                { type: 'emergency', locationStr },
                'emergency'
            );
        }
    }
}
