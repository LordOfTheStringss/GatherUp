import { Location } from '../../spatial/Location';
import { User } from '../identity/User';
import { TimeSlot } from '../schedule/TimeSlot';
import { EventCapacityReachedException } from './Exceptions';

export enum EventCategory {
    SPORTS = 'SPORTS',
    STUDY = 'STUDY',
    SOCIAL = 'SOCIAL',
    OTHER = 'OTHER'
}

export enum EventStatus {
    DRAFT = 'DRAFT',
    UPCOMING = 'UPCOMING',
    ONGOING = 'ONGOING',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

export enum EventVisibility {
    PUBLIC = 'PUBLIC',
    PRIVATE = 'PRIVATE'
}

/**
 * Represents the core unit of social interaction. Matches LLD definition.
 */
export class Event {
    public eventId: string; // UUID
    public organizerId: string; // UUID
    public title: string;
    public category: EventCategory;
    public subCategory: string; // Enum/String
    public status: EventStatus;
    public visibility: EventVisibility;
    public location: Location;
    public timeSlot: TimeSlot;
    public minCapacity: number;
    public maxCapacity: number;
    public participants: User[];
    public embedding: number[]; // FloatArray
    public description: string;
    public chatRoomId: string; // UUID

    constructor(
        eventId: string,
        organizerId: string,
        title: string,
        category: EventCategory,
        subCategory: string,
        location: Location,
        timeSlot: TimeSlot,
        minCapacity: number,
        maxCapacity: number,
        description: string,
        chatRoomId: string,
        visibility: EventVisibility = EventVisibility.PUBLIC,
        status: EventStatus = EventStatus.UPCOMING
    ) {
        this.eventId = eventId;
        this.organizerId = organizerId;
        this.title = title;
        this.category = category;
        this.subCategory = subCategory;
        this.location = location;
        this.timeSlot = timeSlot;
        this.minCapacity = minCapacity;
        this.maxCapacity = maxCapacity;
        this.description = description;
        this.chatRoomId = chatRoomId;
        this.visibility = visibility;
        this.status = status;
        this.participants = [];
        this.embedding = [];
    }

    public isFull(): boolean {
        return this.participants.length >= this.maxCapacity;
    }

    public addParticipant(user: User): boolean {
        if (this.isFull()) {
            throw new EventCapacityReachedException();
        }

        // Detailed check logic happens in controllers (ConflictEngine check)

        if (!this.participants.find(p => p.userId === user.userId)) {
            this.participants.push(user);
        }

        if (this.isFull()) {
            this.status = EventStatus.ONGOING; // or COMPLETED
        }

        // Emits EVENT_JOINED via infra
        return true;
    }

    public removeParticipant(user: User): void {
        this.participants = this.participants.filter(p => p.userId !== user.userId);

        if (this.status === EventStatus.ONGOING && !this.isFull()) {
            this.status = EventStatus.UPCOMING;
        }

        // Potential call for Pivot logic if size < minCapacity
    }

    public cancel(): void {
        this.status = EventStatus.CANCELLED;
        // Preserves chat, notifies participants
    }

    public updateEmbedding(): void {
        // Recalculates vector if Title/Description changes
    }

    public isVisibleTo(user: User): boolean {
        if (this.visibility === EventVisibility.PUBLIC) {
            return true;
        }
        // If PRIVATE, organizer must be friend with user
        return true; // Simplified for stub, the controller or user object handles check
    }
}
