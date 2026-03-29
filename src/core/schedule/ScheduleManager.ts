import { v4 as uuidv4 } from "uuid";
import { SupabaseClient } from "../../infra/SupabaseClient";
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

  public async saveScheduleBlocksToSupabase(slots: TimeSlot[], _userId: string): Promise<boolean> {
    try {
      const sb = SupabaseClient.getInstance().client;

      const { data: { user }, error: authError } = await sb.auth.getUser();
      if (authError || !user) {
        throw new Error('User is not authenticated. Cannot sync schedule. Please log in first.');
      }
      const realUserId = user.id;

      // Clean Slate: Delete any existing rows for this user
      const { error: deleteError } = await sb
        .from("schedule")
        .delete()
        .eq("user_id", realUserId);

      if (deleteError) {
        console.error("Failed to delete existing schedule:", deleteError);
        return false;
      }

      const pad = (n: number) => n.toString().padStart(2, "0");
      const DAYS_MAP = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      // Map busy blocks to DB format
      const insertData = slots
        .filter((slot) => slot.type === BlockType.BUSY)
        .map((slot) => {
          const start = new Date(slot.startTime);
          const end = new Date(slot.endTime);

          return {
            user_id: realUserId,
            day_of_week: DAYS_MAP[start.getDay()],
            start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())}`,
            end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}:${pad(end.getSeconds())}`,
            is_busy: true,
            label: slot.metadata?.type || (slot.source === DataSource.OCR ? "Class" : "Busy"),
            title: slot.metadata?.title || ""
          };
        });

      if (insertData.length > 0) {
        const { error: insertError } = await sb
          .from("schedule")
          .insert(insertData);

        if (insertError) {
          console.error("Failed to insert schedule to Supabase:", insertError);
          return false;
        }
      }

      // Re-fetch to ensure any local cache/state gets the newly generated Supabase IDs
      await this.getScheduleFromDB(realUserId);

      return true;
    } catch (e: any) {
      console.error("saveScheduleBlocksToSupabase error:", e);
      throw e; // Throw upwards so the controller handles the auth error gracefully
    }
  }

  public async saveScheduleToDB(
    schedule: TimeSlot[],
    userId: string,
  ): Promise<boolean> {
    return this.saveScheduleBlocksToSupabase(schedule, userId);
  }

  public async getScheduleFromDB(_userId: string): Promise<TimeSlot[]> {
    try {
      const sb = SupabaseClient.getInstance().client;

      const { data: { user }, error: authError } = await sb.auth.getUser();
      if (authError || !user) {
        console.warn("User is not authenticated. Cannot fetch schedule.");
        return []; // Gracefully handle unauthenticated load
      }
      const realUserId = user.id;

      const { data, error } = await sb
        .from("schedule")
        .select("*")
        .eq("user_id", realUserId);

      if (error) {
        console.error("Supabase fetch error:", error);
        return [];
      }

      if (!data) return [];

      const BASE_DATES: Record<string, string> = {
        "Sunday": "2024-01-07",
        "Monday": "2024-01-01",
        "Tuesday": "2024-01-02",
        "Wednesday": "2024-01-03",
        "Thursday": "2024-01-04",
        "Friday": "2024-01-05",
        "Saturday": "2024-01-06",
      };

      return data.map((row: any) => {
        // Stop dynamic offsetting. Revert to injecting literal local-time strings exactly like JSON native fetch.
        const dateStr = BASE_DATES[row.day_of_week] || "2024-01-01";
        const start = new Date(`${dateStr}T${row.start_time}`);
        const end = new Date(`${dateStr}T${row.end_time}`);


        const CATEGORIES_COLOR_MAP: Record<string, string> = {
          "Class": "#E11D48",
          "Work": "#F59E0B",
          "Sports": "#3B82F6",
          "Tech": "#8B5CF6",
          "Art": "#EC4899",
          "Hobby": "#8910b9",
          "Social": "#10B981",
          "Available": "#32b910ff"
        };
        const CATEGORIES_ICON_MAP: Record<string, string> = {
          "Class": "book",
          "Work": "briefcase",
          "Sports": "fitness",
          "Tech": "code-working",
          "Art": "color-palette",
          "Hobby": "heart",
          "Social": "people",
          "Available": "checkmark-circle",
        };

        return new TimeSlot(
          row.id || uuidv4(),
          row.user_id,
          start,
          end,
          row.is_busy ? BlockType.BUSY : BlockType.FREE,
          DataSource.OCR,
          true, // Assuming weekly recurring based on day_of_week
          {
            title: row.title || row.label || "Event",
            type: row.label || "Event",
            color: CATEGORIES_COLOR_MAP[row.label] || "#818CF8",
            icon: CATEGORIES_ICON_MAP[row.label] || "calendar-outline"
          }
        );
      });
    } catch (e) {
      console.error("Supabase Load error:", e);
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
