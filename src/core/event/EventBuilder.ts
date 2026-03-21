import { Location } from '../../spatial/Location';
import { TimeSlot } from '../schedule/TimeSlot';
import { Event, EventCategory, EventStatus, EventVisibility } from './Event';

/**
 * Manages the event creation "Wizard". Validates inputs, 
 * ensures organizer availability, and initializes infrastructure.
 */
export class EventBuilder {
    private eventId: string;
    private organizerId: string;
    private title: string = '';
    private category!: EventCategory;
    private subCategory: string = '';
    private location!: Location;
    private timeSlot!: TimeSlot;
    private minCapacity: number = 2;
    private maxCapacity: number = 50;
    private description: string = '';
    private chatRoomId: string;
    private visibility: EventVisibility = EventVisibility.PUBLIC;

    constructor(eventId: string, organizerId: string, chatRoomId: string) {
        this.eventId = eventId;
        this.organizerId = organizerId;
        this.chatRoomId = chatRoomId;
    }

    // Setters (returning this) would typically exist here to populate the fields

    public withDetails(title: string, desc: string): this {
        this.title = title;
        this.description = desc;
        return this;
    }

    public withSchedule(timeSlot: TimeSlot): this {
        this.timeSlot = timeSlot;
        return this;
    }

    public withLocation(loc: Location): this {
        this.location = loc;
        return this;
    }

    public withCategory(cat: EventCategory, subCat: string): this {
        this.category = cat;
        this.subCategory = subCat;
        return this;
    }

    public withCapacity(min: number, max: number): this {
        this.minCapacity = min;
        this.maxCapacity = max;
        return this;
    }

    public build(): Event {
        // 1. Validates inputs
        if (!this.title || !this.timeSlot || !this.location) {
            throw new Error("Missing required event inputs.");
        }

        // 2. Call ConflictEngine.checkAvailability() - in reality, injected or called outside

        // 3. Creates Event
        const event = new Event(
            this.eventId,
            this.organizerId,
            this.title,
            this.category,
            this.subCategory,
            this.location,
            this.timeSlot,
            this.minCapacity,
            this.maxCapacity,
            this.description,
            this.chatRoomId,
            this.visibility,
            EventStatus.UPCOMING
        );

        // 4. Call ChatService.createRoom - usually managed externally 
        // 5. Returns Event
        return event;
    }
}
