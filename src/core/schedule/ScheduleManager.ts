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
}
