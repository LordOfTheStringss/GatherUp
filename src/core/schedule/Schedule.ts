import { ScheduleOverlapException } from './Exceptions';
import { TimeSlot } from './TimeSlot';

/**
 * Manages the integrity of a user's calendar and executes the Gap Analysis algorithm.
 */
export class Schedule {
    public userId: string; // UUID
    public slots: TimeSlot[]; // Ordered collection

    constructor(userId: string) {
        this.userId = userId;
        this.slots = [];
    }

    /**
     * Inserts a new block after validating no hard conflicts exist.
     */
    public addBusyBlock(slot: TimeSlot): void {
        if (this.checkConflict(slot)) {
            throw new ScheduleOverlapException();
        }
        this.slots.push(slot);

        // Keep the collection ordered by start time
        this.slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }

    /**
     * Modifies an existing block.
     */
    public updateBusyBlock(slot: TimeSlot): void {
        const index = this.slots.findIndex(s => s.slotId === slot.slotId);
        if (index !== -1) {
            // Remove the old slot, re-check conflict with the rest, then push back
            const originalSlot = this.slots[index];
            this.slots.splice(index, 1);

            if (this.checkConflict(slot)) {
                // Revert
                this.slots.push(originalSlot);
                this.slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
                throw new ScheduleOverlapException();
            }

            this.slots.push(slot);
            this.slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        }
    }

    /**
     * Gap Analysis Logic: Calculates available time by subtracting BUSY blocks.
     */
    public getFreeWindows(date: Date): TimeSlot[] {
        // Stub: A full implementation would define a "wake window" (e.g., 8am - 10pm),
        // find all overlapping busy slots for the given date (including recurring),
        // and subtract them to yield free blocks.
        return [];
    }

    /**
     * Iterates through slots to detect overlaps.
     */
    public checkConflict(proposedTime: TimeSlot): boolean {
        return this.slots.some(slot => slot.overlaps(proposedTime));
    }

    /**
     * Executes a hard delete of all schedule data (Privacy Compliance).
     */
    public clearSchedule(): void {
        this.slots = [];
    }
}
