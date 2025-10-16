---
timestamp: 'Mon Oct 13 2025 15:38:44 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251013_153844.362f8f60.md]]'
content_id: 26c91fe877a9facb5b16a20e1eb147043efb1b05411bdbc1f554c484e453ce4d
---

# response:

```typescript
// file: src/SleepSchedule/SleepScheduleConcept.ts

import { Collection, Db } from "npm:mongodb";
// Assuming @utils/types.ts provides ID and Empty, and @utils/database.ts provides freshID
import { ID, Empty } from "../../utils/types.ts"; // Adjust path as per your project structure
import { freshID } from "../../utils/database.ts"; // Adjust path as per your project structure

// Declare collection prefix, use concept name
const PREFIX = "SleepSchedule" + ".";

// Generic types of this concept
type User = ID;
type DateString = string; // Expected format: "YYYY-MM-DD"
type TimeString = string; // Expected format: "HH:MM" (24-hour)

/**
 * @state
 * A set of SleepSlots with
 *   a bedTimeGoal of type TimeString
 *   a wakeUpTimeGoal of type TimeString
 *   a user of type User
 *   a date of type DateString
 *   a wakeUpSuccess of type boolean
 *   a bedTimeSuccess of type boolean
 */
interface SleepSlot {
  _id: ID; // Unique ID for the slot document in MongoDB
  user: User;
  date: DateString;
  bedTimeGoal: TimeString;
  wakeUpTimeGoal: TimeString;
  bedTimeSuccess: boolean;
  wakeUpSuccess: boolean;
  // Optional: Could also store the reported times for detailed logging
  // reportedBedTime?: TimeString;
  // reportedWakeUpTime?: TimeString;
}

/**
 * @concept SleepSchedule [User]
 * @purpose Let users set bedtime/wake goals, log sleep and wake events, and record daily adherence.
 * @principle Users set bedtime and wake targets. When the app receives sleep/wake logs,
 *            the concept computes whether the user met the bedtime/wake targets for that date
 *            and records adherence. Missed-adherence events are tracked for notifications/reports.
 */
export default class SleepScheduleConcept {
  sleepSlots: Collection<SleepSlot>;

  constructor(private readonly db: Db) {
    this.sleepSlots = this.db.collection(PREFIX + "sleepSlots");
  }

  /**
   * @action addSleepSlot
   * @requires:
   *   `dateStr`, `bedTimeStr`, and `wakeTimeStr` must be valid string formats.
   *   There doesn't already exist a `SleepSlot` for `user` on the parsed `date`.
   * @effects:
   *   Creates a new `SleepSlot` for `user` on `date` with `bedTimeGoal` and `wakeUpTimeGoal` targets.
   *   Initializes `wakeUpSuccess` and `bedTimeSuccess` to `false` for the new `SleepSlot`.
   *   Returns the `_id` of the created `SleepSlot`.
   * @param {object} args - The arguments for the action.
   * @param {User} args.user - The ID of the user.
   * @param {DateString} args.dateStr - The date for which the sleep slot is being set (e.g., "YYYY-MM-DD").
   * @param {TimeString} args.bedTimeStr - The user's target bedtime (e.g., "22:30").
   * @param {TimeString} args.wakeTimeStr - The user's target wake-up time (e.g., "07:00").
   * @returns {Promise<{ sleepSlotId: ID } | { error: string }>} The ID of the created sleep slot on success, or an error message.
   */
  async addSleepSlot(
    { user, dateStr, bedTimeStr, wakeTimeStr }: {
      user: User;
      dateStr: DateString;
      bedTimeStr: TimeString;
      wakeTimeStr: TimeString;
    },
  ): Promise<{ sleepSlotId: ID } | { error: string }> {
    // Basic format validation (can be more robust if needed, but for "string" types, this is an assumption)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { error: "Invalid dateStr format (expected YYYY-MM-DD)." };
    }
    if (!/^\d{2}:\d{2}$/.test(bedTimeStr) || !/^\d{2}:\d{2}$/.test(wakeTimeStr)) {
      return { error: "Invalid timeStr format (expected HH:MM)." };
    }

    // requires: There doesn't already exist a SleepSlot for the given user and date.
    const existingSlot = await this.sleepSlots.findOne({ user, date: dateStr });
    if (existingSlot) {
      return {
        error: `Sleep slot for user ${user} on date ${dateStr} already exists.`,
      };
    }

    // effects: Creates a new sleep slot with the given goals.
    const newSlot: SleepSlot = {
      _id: freshID(), // Generate a unique ID for the new sleep slot
      user,
      date: dateStr,
      bedTimeGoal: bedTimeStr,
      wakeUpTimeGoal: wakeTimeStr,
      bedTimeSuccess: false, // Initialize adherence flags
      wakeUpSuccess: false, // Initialize adherence flags
    };
    await this.sleepSlots.insertOne(newSlot);
    return { sleepSlotId: newSlot._id }; // Return the ID of the newly created slot
  }

  /**
   * @action removeSleepSlot
   * @requires:
   *   `dateStr` must be a valid string format.
   *   There exists a `SleepSlot` with `user u` and the parsed `date`.
   * @effects: Removes the `SleepSlot` for `u` on `date`.
   * @param {object} args - The arguments for the action.
   * @param {User} args.user - The ID of the user.
   * @param {DateString} args.dateStr - The date of the sleep slot to remove.
   * @returns {Promise<Empty | { error: string }>} An empty object on success, or an error message.
   */
  async removeSleepSlot(
    { user, dateStr }: { user: User; dateStr: DateString },
  ): Promise<Empty | { error: string }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { error: "Invalid dateStr format (expected YYYY-MM-DD)." };
    }

    // requires: there exists a SleepSlot with user u and date d.
    const result = await this.sleepSlots.deleteOne({ user, date: dateStr });
    if (result.deletedCount === 0) {
      return {
        error: `No sleep slot found for user ${user} on date ${dateStr} to remove.`,
      };
    }
    // effects: removes this SleepSlot.
    return {};
  }

  /**
   * @action reportBedTime
   * @requires:
   *   `reportedTimeStr` and `dateStr` must be valid string formats.
   *   A `SleepSlot` with `user u` and the parsed `date` exists.
   * @effects:
   *   Sets `bedTimeSuccess = reportedTimeStr <= bedTimeGoal` for the `SleepSlot` with (`u`, `date`).
   *   Returns `bedTimeSuccess`.
   * @param {object} args - The arguments for the action.
   * @param {User} args.user - The ID of the user.
   * @param {TimeString} args.reportedTimeStr - The actual time the user reported going to bed (e.g., "22:15").
   * @param {DateString} args.dateStr - The date for which the bed time is being reported.
   * @returns {Promise<{ bedTimeSuccess: boolean } | { error: string }>} The calculated `bedTimeSuccess` status on success, or an error message.
   */
  async reportBedTime(
    { user, reportedTimeStr, dateStr }: {
      user: User;
      reportedTimeStr: TimeString;
      dateStr: DateString;
    },
  ): Promise<{ bedTimeSuccess: boolean } | { error: string }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { error: "Invalid dateStr format (expected YYYY-MM-DD)." };
    }
    if (!/^\d{2}:\d{2}$/.test(reportedTimeStr)) {
      return { error: "Invalid reportedTimeStr format (expected HH:MM)." };
    }

    // requires: SleepSlot with user:User and date:DateString exists
    const existingSlot = await this.sleepSlots.findOne({ user, date: dateStr });
    if (!existingSlot) {
      return {
        error: `No sleep slot found for user ${user} on date ${dateStr}. Cannot report bed time.`,
      };
    }

    // effects: sets bedTimeSuccess = reportedTimeStr <= bedTimeGoal
    // String comparison for "HH:MM" works for lexicographical order assuming valid 24-hour format.
    // Success means going to bed *at or before* the goal.
    const bedTimeSuccess = reportedTimeStr <= existingSlot.bedTimeGoal;

    await this.sleepSlots.updateOne(
      { _id: existingSlot._id },
      { $set: { bedTimeSuccess: bedTimeSuccess } },
    );
    return { bedTimeSuccess };
  }

  /**
   * @action reportWakeUpTime
   * @requires:
   *   `reportedTimeStr` and `dateStr` must be valid string formats.
   *   A `SleepSlot` for the given user and date must exist.
   * @effects:
   *   Sets `wakeUpSuccess = reportedTimeStr >= wakeUpTimeGoal` for the `SleepSlot` with (`u`, `date`).
   *   Returns `wakeUpSuccess`.
   * @param {object} args - The arguments for the action.
   * @param {User} args.user - The ID of the user.
   * @param {TimeString} args.reportedTimeStr - The actual time the user reported waking up (e.g., "07:05").
   * @param {DateString} args.dateStr - The date for which the wake-up time is being reported.
   * @returns {Promise<{ wakeUpSuccess: boolean } | { error: string }>} The calculated `wakeUpSuccess` status on success, or an error message.
   */
  async reportWakeUpTime(
    { user, reportedTimeStr, dateStr }: {
      user: User;
      reportedTimeStr: TimeString;
      dateStr: DateString;
    },
  ): Promise<{ wakeUpSuccess: boolean } | { error: string }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { error: "Invalid dateStr format (expected YYYY-MM-DD)." };
    }
    if (!/^\d{2}:\d{2}$/.test(reportedTimeStr)) {
      return { error: "Invalid reportedTimeStr format (expected HH:MM)." };
    }

    // requires: SleepSlot with user:User and date:DateString exists
    const existingSlot = await this.sleepSlots.findOne({ user, date: dateStr });
    if (!existingSlot) {
      return {
        error: `No sleep slot found for user ${user} on date ${dateStr}. Cannot report wake up time.`,
      };
    }

    // effects: set wakeUpSuccess = reportedTimeStr >= wakeUpTimeGoal
    // String comparison for "HH:MM" works for lexicographical order assuming valid 24-hour format.
    // Success means waking up *at or after* the goal.
    const wakeUpSuccess = reportedTimeStr >= existingSlot.wakeUpTimeGoal;

    await this.sleepSlots.updateOne(
      { _id: existingSlot._id },
      { $set: { wakeUpSuccess: wakeUpSuccess } },
    );
    return { wakeUpSuccess };
  }

  /**
   * @query _getSleepAdherence
   * @effects: Returns the bed time and wake up time adherence status for a specific user and date.
   * @param {object} args - The arguments for the query.
   * @param {User} args.user - The ID of the user.
   * @param {DateString} args.dateStr - The date for which to retrieve adherence.
   * @returns {Promise<{ bedTimeSuccess: boolean; wakeUpSuccess: boolean } | { error: string }>} The adherence status or an error message.
   */
  async _getSleepAdherence(
    { user, dateStr }: { user: User; dateStr: DateString },
  ): Promise<
    | { bedTimeSuccess: boolean; wakeUpSuccess: boolean }
    | { error: string }
  > {
    const slot = await this.sleepSlots.findOne({ user, date: dateStr });
    if (!slot) {
      return {
        error: `No sleep slot found for user ${user} on date ${dateStr}.`,
      };
    }
    return {
      bedTimeSuccess: slot.bedTimeSuccess,
      wakeUpSuccess: slot.wakeUpSuccess,
    };
  }

  /**
   * @query _getUserSleepSlots
   * @effects: Returns all sleep slots (goals and current adherence) set up for a given user.
   * @param {object} args - The arguments for the query.
   * @param {User} args.user - The ID of the user.
   * @returns {Promise<{ slots: SleepSlot[] }>} An array of SleepSlot objects for the user.
   */
  async _getUserSleepSlots(
    { user }: { user: User },
  ): Promise<{ slots: SleepSlot[] }> {
    const slots = await this.sleepSlots.find({ user }).toArray();
    return { slots };
  }
}
```
