import { Location } from '../../spatial/Location';
import { User } from '../identity/User';

/**
 * Provides an emergency alert mechanism for user safety within social interactions.
 */
export class SafetyService {

    /**
     * Initiates panic workflow with the current location.
     */
    public triggerPanic(user: User, location: Location): void {
        // Invokes notifyTrustedContacts and potentially contacts authorities
        console.warn(`[PANIC] User ${user.userId} triggered panic at ${location.coordinates.latitude}, ${location.coordinates.longitude}`);
        this.notifyTrustedContacts(user.userId);
    }

    /**
     * Sends emergency alerts to a predefined circle.
     */
    public notifyTrustedContacts(userId: string): void {
        // In reality, looks up the user's friendList or specific emergency contacts
        // via NotificationService
    }
}
