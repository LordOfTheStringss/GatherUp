import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";
import { BlockType, DataSource, TimeSlot } from "./TimeSlot";

export class ScheduleManager {
  public toggleTimeSlot(
    schedule: TimeSlot[],
    dayIndex: number,
    hour: number,
    userId: string,
  ): TimeSlot[] {
    const newSchedule = [...schedule];

    const existingIndex = newSchedule.findIndex((s) => {
      if (!s.startTime) return false;
      const st = new Date(s.startTime);
      return st.getDay() === dayIndex && st.getHours() === hour;
    });

    if (existingIndex !== -1) {
      const slot = newSchedule[existingIndex];
      if (slot.type === BlockType.FREE) {
        newSchedule.splice(existingIndex, 1);
      }
    } else {
      const today = new Date();
      const diff = dayIndex - today.getDay();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() + diff);
      startDate.setHours(hour, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(hour + 1, 0, 0, 0);

      const newSlot = new TimeSlot(
        uuidv4(),
        userId,
        startDate,
        endDate,
        BlockType.FREE,
        DataSource.MANUAL,
        true,
        // DİKKAT: Burası İngilizce oldu
        {
          title: "Available for Socializing",
          type: "Available",
          color: "#10B981",
        },
      );
      newSchedule.push(newSlot);
    }

    return newSchedule;
  }

  public convertToFree(schedule: TimeSlot[], slotId: string): TimeSlot[] {
    return schedule.map((slot) => {
      if (slot.slotId === slotId) {
        return new TimeSlot(
          slot.slotId,
          slot.userId,
          new Date(slot.startTime),
          new Date(slot.endTime),
          BlockType.FREE,
          DataSource.MANUAL,
          slot.isRecurring,
          // DİKKAT: Burası İngilizce oldu
          {
            title: "Available for Socializing",
            type: "Available",
            color: "#10B981",
          },
        );
      }
      return slot;
    });
  }

  public async saveScheduleToDB(
    schedule: TimeSlot[],
    userId: string,
  ): Promise<boolean> {
    try {
      await AsyncStorage.setItem(
        `@schedule_${userId}`,
        JSON.stringify(schedule),
      );
      return true;
    } catch (e) {
      console.error("Save error:", e);
      return false;
    }
  }

  public async getScheduleFromDB(userId: string): Promise<TimeSlot[]> {
    try {
      const data = await AsyncStorage.getItem(`@schedule_${userId}`);
      if (!data) return [];
      return JSON.parse(data);
    } catch (e) {
      console.error("Load error:", e);
      return [];
    }
  }

  /**
   * Blocks a time range for an event (auto-blocking when creating/joining).
   * Rounds start hour down, end hour up to cover full hourly slots.
   */
  public async addEventBlock(
    userId: string,
    startTime: Date,
    endTime: Date,
    eventTitle: string,
    eventId: string
  ): Promise<boolean> {
    try {
      const schedule = await this.getScheduleFromDB(userId);

      // Check if already blocked for this event
      const alreadyExists = schedule.some(
        (s: any) => s.metadata?.eventId === eventId
      );
      if (alreadyExists) return true;

      // Round start down to hour, end up to next hour for clean blocks
      const blockStart = new Date(startTime);
      blockStart.setMinutes(0, 0, 0);

      const blockEnd = new Date(endTime);
      if (blockEnd.getMinutes() > 0) {
        blockEnd.setHours(blockEnd.getHours() + 1);
        blockEnd.setMinutes(0, 0, 0);
      }

      const newSlot = new TimeSlot(
        `event-${eventId}`,
        userId,
        blockStart,
        blockEnd,
        BlockType.BUSY,
        DataSource.EVENT,
        false,
        {
          title: eventTitle,
          type: "Event",
          color: "#818CF8",
          eventId: eventId,
        }
      );

      schedule.push(newSlot);
      await this.saveScheduleToDB(schedule, userId);
      return true;
    } catch (e) {
      console.error("addEventBlock error:", e);
      return false;
    }
  }
}
