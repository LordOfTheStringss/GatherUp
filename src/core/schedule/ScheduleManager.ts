import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { SupabaseClient } from "../../infra/SupabaseClient";
import { BlockType, DataSource, TimeSlot } from "./TimeSlot";


export class ScheduleManager {
  public toggleTimeSlot(
    schedule: TimeSlot[],
    dateStr: string,
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
      const [year, month, day] = dateStr.split("-").map(Number);
      const startDate = new Date(year, month - 1, day);
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
        false, // FALSE: Manual toggles should ONLY be for that specific date in this context
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

      // Clean Slate (Partial): Delete any existing manual rows for this user
      // We specifically exclude EVENT-source slots from being wiped by manual schedule saves.
      const { error: deleteError } = await sb
        .from("schedule")
        .delete()
        .eq("user_id", realUserId)
        .neq("source", DataSource.EVENT);

      if (deleteError) {
        console.error("Failed to delete existing schedule:", deleteError);
        return false;
      }

      const pad = (n: number) => n.toString().padStart(2, "0");
      const DAYS_MAP = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      // Map busy blocks to DB format (exclude EVENT-source slots — they're queried dynamically)
      const insertData = slots
        .filter((slot) => slot.type === BlockType.BUSY && slot.source !== DataSource.EVENT)
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
            title: slot.metadata?.title || "",
            specific_date: slot.isRecurring ? null : `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
            source: slot.source
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

  public async getScheduleFromDB(userId: string): Promise<TimeSlot[]> {
    try {
      const sb = SupabaseClient.getInstance().client;

      const { data, error } = await sb
        .from("schedule")
        .select("*")
        .eq("user_id", userId);

      if (error) {
        console.error("Supabase fetch error:", error);
        return [];
      }

      if (!data) return [];

      return this.mapRowsToSlots(data);
    } catch (e) {
      console.error("Supabase Load error:", e);
      return [];
    }
  }

  public async getBulkSchedules(userIds: string[]): Promise<Record<string, TimeSlot[]>> {
    try {
      const sb = SupabaseClient.getInstance().client;
      // Defensive check: filter out invalid or undefined userIds
      const validIds = userIds.filter(id => id && id !== 'undefined' && id.length > 0);
      
      if (validIds.length === 0) {
        console.warn("getBulkSchedules: No valid userIds provided.");
        return {};
      }

      const { data, error } = await sb
        .from("schedule")
        .select("*")
        .in("user_id", validIds);

      if (error) {
        console.error("Bulk fetch error:", error);
        return {};
      }

      const grouped: Record<string, any[]> = {};
      data.forEach((row: any) => {
        if (!grouped[row.user_id]) grouped[row.user_id] = [];
        grouped[row.user_id].push(row);
      });

      const result: Record<string, TimeSlot[]> = {};
      for (const [uid, rows] of Object.entries(grouped)) {
        result[uid] = this.mapRowsToSlots(rows);
      }
      return result;
    } catch (e) {
      console.error("Bulk schedules load error:", e);
      return {};
    }
  }

  private mapRowsToSlots(data: any[]): TimeSlot[] {
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
      const dateStr = row.specific_date || (BASE_DATES[row.day_of_week] || "2024-01-01");
      const start = new Date(`${dateStr}T${row.start_time}`);
      const end = new Date(`${dateStr}T${row.end_time}`);

      if (end < start) {
        end.setDate(end.getDate() + 1);
      }

      const CATEGORIES_COLOR_MAP: Record<string, string> = {
        "Class": "#E11D48", "Work": "#F59E0B", "Sports": "#3B82F6", "Tech": "#8B5CF6",
        "Art": "#EC4899", "Hobby": "#8910b9", "Social": "#10B981", "Available": "#32b910ff"
      };
      const CATEGORIES_ICON_MAP: Record<string, string> = {
        "Class": "book", "Work": "briefcase", "Sports": "fitness", "Tech": "code-working",
        "Art": "color-palette", "Hobby": "heart", "Social": "people", "Available": "checkmark-circle",
      };

      return new TimeSlot(
        row.id || uuidv4(),
        row.user_id,
        start,
        end,
        row.is_busy ? BlockType.BUSY : BlockType.FREE,
        (row.source as DataSource) || DataSource.OCR,
        row.specific_date ? false : true,
        {
          title: row.title || row.label || "Event",
          type: row.label || "Event",
          color: CATEGORIES_COLOR_MAP[row.label] || "#818CF8",
          icon: CATEGORIES_ICON_MAP[row.label] || "calendar-outline"
        }
      );
    });
  }

  /**
   * Directly inserts a single event block into the schedule table.
   * This is used when a user joins or creates an event to securely block out the time,
   * without wiping or affecting manual schedule blocks.
   */
  public async syncEventToSchedule(
    userId: string,
    eventId: string,
    startTime: Date,
    endTime: Date,
    eventTitle: string
  ): Promise<boolean> {
    try {
      const sb = SupabaseClient.getInstance().client;
      const pad = (n: number) => n.toString().padStart(2, "0");
      const DAYS_MAP = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      const start = new Date(startTime);
      const end = new Date(endTime);

      const insertData = {
        user_id: userId,
        day_of_week: DAYS_MAP[start.getDay()],
        start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())}`,
        end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}:${pad(end.getSeconds())}`,
        is_busy: true,
        label: "Event",
        title: eventTitle,
        specific_date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
        source: DataSource.EVENT,
      };

      const { error } = await sb.from("schedule").insert(insertData);
      
      if (error) {
        console.error("syncEventToSchedule DB error:", error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("syncEventToSchedule error:", e);
      return false;
    }
  }

  /**
   * Deletes a specific event's block from the physical schedule table.
   * Called when a user leaves an event or the event is deleted.
   */
  public async removeEventFromSchedule(userId: string, eventTitle: string): Promise<boolean> {
    try {
      const sb = SupabaseClient.getInstance().client;
      // We use both user_id and title to ensure we delete the correct block.
      // Since we don't store eventId in the schedule schema columns natively (except sometimes in label/title),
      // we match by title and source.
      const { error } = await sb
        .from("schedule")
        .delete()
        .eq("user_id", userId)
        .eq("source", DataSource.EVENT)
        .eq("title", eventTitle);

      if (error) {
        console.error("removeEventFromSchedule DB error:", error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("removeEventFromSchedule error:", e);
      return false;
    }
  }
}
