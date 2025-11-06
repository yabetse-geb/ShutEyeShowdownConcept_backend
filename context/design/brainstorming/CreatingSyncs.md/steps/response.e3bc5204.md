---
timestamp: 'Tue Nov 04 2025 17:03:16 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251104_170316.d1fa87f4.md]]'
content_id: e3bc520482ac2a4f06ac0c5d6d6b63e14e8c4dc6262e8fda68af6eea9cc291e4
---

# response:

```typescript
import { Collection, Db } from "npm:mongodb";
import { ID, Empty } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * @concept SleepSchedule [User]
 * @purpose Let users set bedtime/wake goals, log sleep and wake events, and record daily adherence (did the user follow their targets).
 * @principle Users set bedtime and wake targets. When the app receives sleep/wake logs, the concept computes whether the user met the bedtime/wake targets
 *            for that date and records adherence. Missed-adherence events are tracked for notifications/reports.
 */

// Declare collection prefix, use concept name
const PREFIX = "SleepSchedule" + ".";

// Generic type for User as per specification
type User = ID;

/**
 * @typedef Date
 * A standard date object, capable of representing a specific calendar day.
 * (For implementation, we use JavaScript's Date object, normalized to midnight for daily comparisons).
 */

/**
 * @typedef Time
 * A standard time object, capable of representing a specific time of day.
 * (For implementation, we use "HH:MM" string format for simplicity, as it's easily comparable lexicographically).
 */

/**
 * Helper to parse date string to Date object, normalized to the start of the day (local time).
 * This ensures that comparisons are purely based on the calendar day, ignoring time components.
 */
function parseDateString(dateStr: string): Date | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return null; // Invalid date string
  }
  // Normalize to the start of the day in local time (e.g., YYYY-MM-DDT00:00:00.000)
  // return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}


/**
 * Parses a datetime string in "YYYY-MM-DDTHH:MM" format into a local Date object.
 * Unlike `new Date(string)`, this version interprets the time as LOCAL (not UTC).
 * Returns null if the input is invalid.
 */
function parseDateTimeString(dateTimeStr: string): Date|null {
  // Match "YYYY-MM-DDTHH:MM"
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dateTimeStr);
  if (!match) {
    // throw new Error(`Invalid date-time format: ${dateTimeStr}`);
    return null;
  }

  const [_, yearStr, monthStr, dayStr, hourStr, minuteStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr) - 1; // JS months are 0-based
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  const date = new Date(year, month, day, hour, minute);

  // Validate round-trip (detects invalid calendar dates)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    // throw new Error(`Invalid date-time value: ${dateTimeStr}`);
    return null;
  }

  return date;
}



/**
 * @state
 * A set of SleepSlots with
 *   a `bedTime` of type `Date`
 *   a `wakeUpTime` of type `Date`
 *   a `user` of type `User`
 *   a `date` of type `Date`
 *   a `wakeUpSuccess` of type Boolean? (false initially as per spec, null implies not yet reported)
 *   a `bedTimeSuccess` of type Boolean? (false initially as per spec, null implies not yet reported)
 */
interface SleepSlot {
  _id: ID; // Unique ID for each SleepSlot
  u: User;
  date: Date; // Stored as Date object, normalized to start of day
  bedTime: Date; // full datetime to handle sleeping past midnight cases
  wakeUpTime: Date; // full datetime to handle waking up past midnight cases (should be after bedTime)
  toleranceMins:number; // minutes of tolerance for wake up time and bed time
  wakeUpSuccess: boolean | null;
  bedTimeSuccess: boolean | null;
}

export default class SleepScheduleConcept {
  sleepSlots: Collection<SleepSlot>;

  constructor(private readonly db: Db) {
    this.sleepSlots = this.db.collection(PREFIX + "sleepSlots");
  }

  /**
   * @action addSleepSlot
   * @requires:
   *   `dateStr`, `bedTimeStr`, and `wakeTimeStr` must be valid strings parseable into `Date` and `Time` objects respectively.
   * @effects:
   *   Parses `dateStr` into a `Date` object: `date`. passed in like "2025-10-16"
   *   Parses `bedTimeStr` into a `Date` object: `bedTime`. passed in like 2025-10-16T00:20
   *   Parses `wakeTimeStr` into a `Date` object: `wakeUpTime`. passed in like "2025-10-16T07:30"
   *   If a `SleepSlot` already exists for `u` on the parsed `date`, preserves its `wakeUpSuccess` and `bedTimeSuccess` values, then removes it.
   *   Creates a new `SleepSlot` for `u` on `date` with `bedTime` and `wakeUpTime` targets.
   *   Sets `wakeUpSuccess` and `bedTimeSuccess` to the preserved values (or `null` if no existing slot).
   */
  async addSleepSlot(
    { u, bedTimeStr, wakeTimeStr, dateStr, toleranceMins }: {
      u: User;
      bedTimeStr: string;
      wakeTimeStr: string;
      dateStr: string;
      toleranceMins: number;
    },
  ): Promise<Empty | { error: string }> {
    const date = parseDateString(dateStr);
    const bedTime = parseDateTimeString(bedTimeStr);
    const wakeUpTime = parseDateTimeString(wakeTimeStr);

    // Requires: dateStr, bedTimeStr, and wakeTimeStr must be valid
    if (!date) {
      return { error: "Invalid date string provided." };
    }
    if (!bedTime) {
      return { error: "Invalid bedtime string format. Expected YYYY-MM-DDTHH:MM" };
    }
    if (!wakeUpTime) {
      return { error: "Invalid wake-up time string format. Expected YYYY-MM-DDTHH:MM" };
    }

    // Effects: If a SleepSlot already exists for u on the parsed date, save its success values
    const existingSlot = await this.sleepSlots.findOne({ u, date });
    let savedWakeUpSuccess = null;
    let savedBedTimeSuccess = null;

    if (existingSlot) {
      // Save the existing success values before removing the slot
      savedWakeUpSuccess = existingSlot.wakeUpSuccess;
      savedBedTimeSuccess = existingSlot.bedTimeSuccess;
      // Remove the existing slot before creating a new one
      await this.removeSleepSlot({ u, dateStr });
    }

    // Effects: Creates a new SleepSlot
    const newSleepSlot: SleepSlot = {
      _id: freshID(),
      u,
      date,
      bedTime,
      wakeUpTime,
      toleranceMins,
      wakeUpSuccess: savedWakeUpSuccess, // Preserve existing value or null if new slot
      bedTimeSuccess: savedBedTimeSuccess, // Preserve existing value or null if new slot
    };
    await this.sleepSlots.insertOne(newSleepSlot);

    return {};
  }

  /**
   * @action removeSleepSlot
   * @requires:
   *   `dateStr` must be a valid date string parseable into a `Date`. should be format YYYY-MM-DD
   *   There exists a `SleepSlot` with `user u` and the parsed `date`.
   * @effects:
   *   Parses `dateStr` into a `Date` object: `date`.
   *   Removes the `SleepSlot` for `u` on `date`.
   */
  async removeSleepSlot(
    { u, dateStr }: { u: User; dateStr: string },
  ): Promise<Empty | { error: string }> {
    const date = parseDateString(dateStr);

    // Requires: dateStr must be a valid date string
    if (!date) {
      return { error: "Invalid date string provided." };
    }

    // Requires: There exists a SleepSlot with user u and the parsed date.
    const result = await this.sleepSlots.deleteOne({ u, date });

    if (result.deletedCount === 0) {
      return {
        error: `No sleep schedule found for user ${u} on ${dateStr} to remove.`,
      };
    }

    return {};
  }

  /**
   * @action reportBedTime
   * @requires:
   *   `reportedTimeStr` and `dateStr` must be valid strings parseable into `Time` and `Date` objects respectively.
   *   A `SleepSlot` with `user u` and the parsed `date` exists.
   * @effects:
   *   Parses `reportedTimeStr` into a `Time` object: `reportedTime`.
   *   Parses `dateStr` into a `Date` object: `date`.
   *   Calculates the difference in minutes between reported time and bedtime using local time.
   *   Sets `bedTimeSuccess = true` if the absolute difference (handling wrap-around across midnight) is within the tolerance.
   *   Returns `bedTimeSuccess`.
   */
  async reportBedTime(
    { u, reportedTimeStr, dateStr }: {
      u: User;
      reportedTimeStr: string;
      dateStr: string;
    },
  ): Promise<{ bedTimeSuccess: boolean } | { error: string }> {
    const date = parseDateString(dateStr);
    const reportedTime = parseDateTimeString(reportedTimeStr);

    // Requires: reportedTimeStr and dateStr must be valid
    if (!date) {
      return { error: "Invalid date string provided." };
    }
    if (!reportedTime) {
      return { error: "Invalid reported bedtime string format. Expected YYYY-MM-DDTHH:MM" };
    }

    const sleepSlot = await this.sleepSlots.findOne({ u, date });

    // Requires: A SleepSlot with user u and the parsed date exists.
    if (!sleepSlot) {
      return {
        error: `No sleep schedule set for user ${u} on ${dateStr} to report bedtime.`,
      };
    }

    // Effects: Sets bedTimeSuccess based on tolerance using local time
    // Extract hours and minutes from both times for local time comparison
    const reportedMins = reportedTime.getHours() * 60 + reportedTime.getMinutes();
    const bedTimeMins = sleepSlot.bedTime.getHours() * 60 + sleepSlot.bedTime.getMinutes();

    // Calculate absolute difference in minutes-of-day
    let diffMins = Math.abs(reportedMins - bedTimeMins);

    // Handle wrap-around case (e.g., 23:00 to 01:00 is 2 hours, not 22 hours)
    const wrapAroundDiff = 1440 - diffMins;
    diffMins = Math.min(diffMins, wrapAroundDiff);

    const bedTimeSuccess = diffMins <= sleepSlot.toleranceMins;

    await this.sleepSlots.updateOne(
      { _id: sleepSlot._id },
      { $set: { bedTimeSuccess: bedTimeSuccess } },
    );

    // Effects: Returns bedTimeSuccess
    return { bedTimeSuccess };
  }

  /**
   * @action reportWakeUpTime
   * @requires:
   *   `reportedTimeStr` and `dateStr` must be valid strings parseable into `Time` and `Date` objects respectively.
   *   A `SleepSlot` with `user u` and the parsed `date` exists.
   * @effects:
   *   Parses `reportedTimeStr` into a `Time` object: `reportedTime`.
   *   Parses `dateStr` into a `Date` object: `date`.
   *   Calculates the difference in minutes between reported time and wake-up time using local time.
   *   Sets `wakeUpSuccess = true` if the absolute difference (handling wrap-around across midnight) is within the tolerance.
   *   Returns `wakeUpSuccess`.
   */
  async reportWakeUpTime(
    { u, reportedTimeStr, dateStr }: {
      u: User;
      reportedTimeStr: string;
      dateStr: string;
    },
  ): Promise<{ wakeUpSuccess: boolean } | { error: string }> {
    const date = parseDateString(dateStr);
    const reportedTime = parseDateTimeString(reportedTimeStr);

    // Requires: reportedTimeStr and dateStr must be valid
    if (!date) {
      return { error: "Invalid date string provided." };
    }
    if (!reportedTime) {
      return { error: "Invalid reported wake-up time string format. Expected YYYY-MM-DDTHH:MM" };
    }

    const sleepSlot = await this.sleepSlots.findOne({ u, date });

    // Requires: A SleepSlot with user u and the parsed date exists.
    if (!sleepSlot) {
      return {
        error: `No sleep schedule set for user ${u} on ${dateStr} to report wake-up time.`,
      };
    }

    // Effects: Sets wakeUpSuccess based on tolerance using local time
    // Extract hours and minutes from both times for local time comparison
    const reportedMins = reportedTime.getHours() * 60 + reportedTime.getMinutes();
    const wakeUpTimeMins = sleepSlot.wakeUpTime.getHours() * 60 + sleepSlot.wakeUpTime.getMinutes();

    // Calculate absolute difference in minutes-of-day
    let diffMins = Math.abs(reportedMins - wakeUpTimeMins);

    // Handle wrap-around case (e.g., 23:00 to 01:00 is 2 hours, not 22 hours)
    const wrapAroundDiff = 1440 - diffMins;
    diffMins = Math.min(diffMins, wrapAroundDiff);

    const wakeUpSuccess = diffMins <= sleepSlot.toleranceMins;

    await this.sleepSlots.updateOne(
      { _id: sleepSlot._id },
      { $set: { wakeUpSuccess: wakeUpSuccess } },
    );

    // Effects: Returns wakeUpSuccess
    return { wakeUpSuccess };
  }

  /**
   * @query _getSleepSlot
   * Returns the sleep slot for a given user and date.
   */
  async _getSleepSlot(
    { u, dateStr }: { u: User; dateStr: string },
  ): Promise<SleepSlot[]> {
    const date = parseDateString(dateStr);
    if (!date) {
      return [];
    }
    return await this.sleepSlots.find({ u, date }).toArray();
  }

  /**
   * @query _getAllSleepSlotsForUser
   * Returns all sleep slots for a given user.
   */
  async _getAllSleepSlotsForUser(
    { u }: { u: User },
  ): Promise<SleepSlot[]> {
    return await this.sleepSlots.find({ u }).toArray();
  }
}

```
