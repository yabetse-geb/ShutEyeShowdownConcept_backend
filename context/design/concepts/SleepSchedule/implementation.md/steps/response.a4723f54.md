---
timestamp: 'Mon Oct 13 2025 15:41:49 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251013_154149.5d95cf8d.md]]'
content_id: a4723f54769f1b02535d083d28e73a771967bd6cb8d3d6f0eb87b495a843ff24
---

# response:

```typescript
// file: src/SleepSchedule/SleepScheduleConcept.ts

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
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Helper to validate and normalize time string to "HH:MM" format.
 */
function parseTimeString(timeStr: string): string | null {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM format
  if (!timeRegex.test(timeStr)) {
    return null; // Invalid time string format
  }
  return timeStr;
}


/**
 * @state
 * A set of SleepSlots with
 *   a `bedTime` of type `Time`
 *   a `wakeUpTime` of type `Time`
 *   a `user` of type `User`
 *   a `date` of type `Date`
 *   a `wakeUpSuccess` of type Boolean? (false initially as per spec, null implies not yet reported)
 *   a `bedTimeSuccess` of type Boolean? (false initially as per spec, null implies not yet reported)
 */
interface SleepSlot {
  _id: ID; // Unique ID for each SleepSlot
  u: User;
  date: Date; // Stored as Date object, normalized to start of day
  bedTime: string; // Stored as "HH:MM" string
  wakeUpTime: string; // Stored as "HH:MM" string
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
   *   There doesn't already exist a `SleepSlot` for `u` on the parsed `date`.
   * @effects:
   *   Parses `dateStr` into a `Date` object: `date`.
   *   Parses `bedTimeStr` into a `Time` object: `bedTime`.
   *   Parses `wakeTimeStr` into a `Time` object: `wakeUpTime`.
   *   Creates a new `SleepSlot` for `u` on `date` with `bedTime` and `wakeUpTime` targets.
   *   Initializes `wakeUpSuccess` and `bedTimeSuccess` to `false` for the new `SleepSlot`.
   */
  async addSleepSlot(
    { u, bedTimeStr, wakeTimeStr, dateStr }: {
      u: User;
      bedTimeStr: string;
      wakeTimeStr: string;
      dateStr: string;
    },
  ): Promise<Empty | { error: string }> {
    const date = parseDateString(dateStr);
    const bedTime = parseTimeString(bedTimeStr);
    const wakeUpTime = parseTimeString(wakeTimeStr);

    // Requires: dateStr, bedTimeStr, and wakeTimeStr must be valid
    if (!date) {
      return { error: "Invalid date string provided." };
    }
    if (!bedTime) {
      return { error: "Invalid bedtime string format. Expected HH:MM." };
    }
    if (!wakeUpTime) {
      return { error: "Invalid wake-up time string format. Expected HH:MM." };
    }

    // Requires: There doesn't already exist a SleepSlot for u on the parsed date.
    const existingSlot = await this.sleepSlots.findOne({ u, date });
    if (existingSlot) {
      return {
        error: `Sleep schedule already exists for user ${u} on ${dateStr}.`,
      };
    }

    // Effects: Creates a new SleepSlot
    const newSleepSlot: SleepSlot = {
      _id: freshID(),
      u,
      date,
      bedTime,
      wakeUpTime,
      wakeUpSuccess: null, // As per spec, null until reported
      bedTimeSuccess: null, // As per spec, null until reported
    };
    await this.sleepSlots.insertOne(newSleepSlot);

    return {};
  }

  /**
   * @action removeSleepSlot
   * @requires:
   *   `dateStr` must be a valid date string parseable into a `Date`.
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
   *   Sets `bedTimeSuccess = reportedTime < bedTime` for the `SleepSlot` with (`u`, `date`).
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
    const reportedTime = parseTimeString(reportedTimeStr);

    // Requires: reportedTimeStr and dateStr must be valid
    if (!date) {
      return { error: "Invalid date string provided." };
    }
    if (!reportedTime) {
      return { error: "Invalid reported bedtime string format. Expected HH:MM." };
    }

    const sleepSlot = await this.sleepSlots.findOne({ u, date });

    // Requires: A SleepSlot with user u and the parsed date exists.
    if (!sleepSlot) {
      return {
        error: `No sleep schedule set for user ${u} on ${dateStr} to report bedtime.`,
      };
    }

    // Effects: Sets bedTimeSuccess = reportedTime < bedTime
    // Lexicographical comparison for HH:MM strings works for chronological order.
    const bedTimeSuccess = reportedTime < sleepSlot.bedTime;

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
   *   Sets `wakeUpSuccess = reportedTime < wakeUpTime` for the `SleepSlot` with (`u`, `date`).
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
    const reportedTime = parseTimeString(reportedTimeStr);

    // Requires: reportedTimeStr and dateStr must be valid
    if (!date) {
      return { error: "Invalid date string provided." };
    }
    if (!reportedTime) {
      return { error: "Invalid reported wake-up time string format. Expected HH:MM." };
    }

    const sleepSlot = await this.sleepSlots.findOne({ u, date });

    // Requires: A SleepSlot with user u and the parsed date exists.
    if (!sleepSlot) {
      return {
        error: `No sleep schedule set for user ${u} on ${dateStr} to report wake-up time.`,
      };
    }

    // Effects: Sets wakeUpSuccess = reportedTime < wakeUpTime
    // Lexicographical comparison for HH:MM strings works for chronological order.
    const wakeUpSuccess = reportedTime < sleepSlot.wakeUpTime;

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
  ): Promise<SleepSlot | null | { error: string }> {
    const date = parseDateString(dateStr);
    if (!date) {
      return { error: "Invalid date string provided." };
    }
    return await this.sleepSlots.findOne({ u, date });
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
