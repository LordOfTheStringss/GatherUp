import { Location } from '../../spatial/Location';

export enum BadgeEnum {
    PUNCTUAL = 'PUNCTUAL',
    FUN = 'FUN',
    LEADER = 'LEADER'
}

export interface ProfileDTO {
    fullName?: string;
    profileImage?: string;
    privacySettings?: any;
    isAvailable?: boolean;
}

/**
 * Represents the core actor within the system. Enforces "privacy-first".
 */
export class User {
    public userId: string; // UUID
    public email: string;
    // hashed password omitted from domain model as it's not stored in public.users per LLD
    public fullName: string;
    public profileVector: number[];
    public interestTags: string[];
    public reputationScore: number;
    public isVerified: boolean;
    public friendList: string[]; // List of UUIDs
    public badges: BadgeEnum[];
    public isStudent: boolean;
    public createdAt: Date;
    public locationBased?: Location; // GeoPoint - volatile
    public isAvailable: boolean;
    public profileImage?: string;
    public privacySettings: any; // JSONB

    constructor(userId: string, email: string) {
        this.userId = userId;
        this.email = email;
        this.fullName = '';
        this.profileVector = [];
        this.interestTags = [];
        this.reputationScore = 0;
        this.isVerified = false;
        this.friendList = [];
        this.badges = [];
        this.isStudent = email.endsWith('.edu.tr');
        this.createdAt = new Date();
        this.isAvailable = true;
        this.privacySettings = {};
    }

    public updateProfile(data: ProfileDTO): void {
        if (data.fullName !== undefined) this.fullName = data.fullName;
        if (data.profileImage !== undefined) this.profileImage = data.profileImage;
        if (data.privacySettings !== undefined) this.privacySettings = data.privacySettings;
        if (data.isAvailable !== undefined) this.isAvailable = data.isAvailable;
        // Triggers VectorService recalculation externally
    }

    public updateInterest(tag: string, add: boolean): void {
        if (add) {
            if (!this.interestTags.includes(tag)) {
                this.interestTags.push(tag);
            }
        } else {
            this.interestTags = this.interestTags.filter(t => t !== tag);
        }
        // Updates the profileVector...
    }

    public addFriend(friendId: string): void {
        if (!this.friendList.includes(friendId)) {
            this.friendList.push(friendId);
        }
    }

    public deleteFriend(friendId: string): void {
        this.friendList = this.friendList.filter(id => id !== friendId);
    }

    public addBadge(badge: BadgeEnum): void {
        this.badges.push(badge);
        // Increments reputationScore (XP)
        this.reputationScore += 10;
    }

    public isFriendWith(targetId: string): boolean {
        return this.friendList.includes(targetId);
    }
}
