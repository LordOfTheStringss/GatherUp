import { GeoPoint } from '../spatial/Location';
import { EmergencyBroadcastException } from './Exceptions';
import { SupabaseClient } from './SupabaseClient';

export interface NotificationLog {
    id: string; // UUID
    timestamp: Date;
    message: string;
}

/**
 * Manages the delivery of transactional and safety-critical notifications
 * to user devices via Expo Push API. <<Singleton>>
 */
export class NotificationService {
    private static instance: NotificationService;
    private expoPushToken: string | null = null;
    private notificationHistory: NotificationLog[] = [];
    private supabaseClient: SupabaseClient;

    private constructor() {
        this.supabaseClient = SupabaseClient.getInstance();
    }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Associations the current device's push token with the user profile in the database.
     */
    public async registerDevice(userId: string): Promise<boolean> {
        // Get token from Expo and save to Supabase
        return true;
    }

    /**
     * Delivers a standard unicast notification and saves it to the DB.
     */
    public async sendPush(targetUserId: string, title: string, body: string, data: any, type: string = 'general'): Promise<void> {
        this.notificationHistory.push({
            id: 'mock-id',
            timestamp: new Date(),
            message: title
        });

        const { error } = await this.supabaseClient.client
            .from('notifications')
            .insert({
                user_id: targetUserId,
                title: title,
                body: body,
                type: type,
                data: data
            });

        if (error) {
            console.error("Failed to insert notification:", error);
        }
    }

    public async sendFriendRequestNotification(targetUserId: string, senderName: string, senderId: string): Promise<void> {
        await this.sendPush(
            targetUserId,
            "New Friend Request",
            `${senderName} wants to connect with you.`,
            { senderId, action: 'friend_request' },
            'friend_request'
        );
    }

    public async sendEventJoinNotification(targetUserId: string, eventTitle: string, participantName: string): Promise<void> {
        await this.sendPush(
            targetUserId,
            "New Participant",
            `${participantName} joined your event: ${eventTitle}`,
            { action: 'event_join' },
            'event_join'
        );
    }

    /**
     * Multicast notification to all participants (e.g., "Event location changed").
     */
    public async broadcastToEvent(eventId: string, message: string): Promise<void> {
        // Query event participants, bundle push notifications
    }

    /**
     * Schedules a local notification X minutes before an event starts.
     */
    public async scheduleReminder(eventId: string, timeBefore: number): Promise<void> {
        // Use Expo Notifications to schedule a local trigger
    }

    /**
     * Triggers a high-priority alert to the user's "Trusted Circle" with live location data.
     */
    public async sendEmergencyAlert(userId: string, location: GeoPoint): Promise<void> {
        try {
            // Workflow: 1. query friends 2. loop through friends 3. sendPush 4. catch exceptions

            // Const mock
            const trustedCircle = ['friend1', 'friend2'];

            for (const friendId of trustedCircle) {
                await this.sendPush(friendId, "EMERGENCY", "User triggered panic!", { location });
            }

        } catch (error) {
            throw new EmergencyBroadcastException();
        }
    }
}
