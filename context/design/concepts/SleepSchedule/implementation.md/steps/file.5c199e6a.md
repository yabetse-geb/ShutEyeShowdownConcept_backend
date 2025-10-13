---
timestamp: 'Sun Oct 12 2025 16:27:36 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251012_162736.3897e8d1.md]]'
content_id: 5c199e6ab0f76d2f1849a268e4a2c028b850359b0c1d106b956f0df7635c82e9
---

# file: src/SleepSchedule/SleepScheduleConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
// Assuming @utils/types.ts provides ID and Empty, and @utils/database.ts provides freshID
import { ID, Empty } from "../../utils/types.ts";
import { freshID } from "../../utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "SleepSchedule" + ".";

// Generic types of this concept
type User = ID;
type DateString = string; // Format: "YYYY-MM-DD"
type TimeString = string; // Format: "HH:MM" (24-hour)

/**
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
   * addSleepSlot (user: User, date: DateString, bedTimeGoal: TimeString, wakeUpTimeGoal: TimeString): { sleepSlotId: ID } | { error: string }
   *
   * @requires: There doesn't already exist a SleepSlot for the given user and date.
   * @effects: Creates a new sleep slot with the given goals. Initializes bedTimeSuccess and wakeUpSuccess to false.
   * @param {object} args - The arguments for the action.
   * @param {User} args.user - The ID of the user.
   * @param {DateString} args.date - The date for which the sleep slot is being set (e.g., "YYYY-MM-DD").
   * @param {TimeString} args.bedTimeGoal - The user's target bedtime (e.g., "22:30").
   * @param {TimeString} args.wakeUpTimeGoal - The user's target wake-up time (e.g., "07:00").
   * @returns {Promise<{ sleepSlotId: ID } | { error: string }>} The ID of the created sleep slot on success, or an error message.
   */
  async addSleepSlot(
    { user, date, bedTimeGoal, wakeUpTimeGoal }: {
      user: User;
      date: DateString;
      bedTimeGoal: TimeString;
      wakeUpTimeGoal: TimeString;
    },
  ): Promise<{ sleepSlotId: ID } | { error: string }> {
    // requires: there doesn't already exist a SleepSlot for the given user and date.
    const existingSlot = await this.sleepSlots.findOne({ user, date });
    if (existingSlot) {
      return {
        error: `Sleep slot for user ${user} on date ${date} already exists.`,
      };
    }

    // effects: Creates a new sleep slot with the given goals.
    const newSlot: SleepSlot = {
      _id: freshID(), // Generate a unique ID for the new sleep slot
      user,
      date,
      bedTimeGoal,
      wakeUpTimeGoal,
      bedTimeSuccess: false, // Initialize adherence flags
      wakeUpSuccess: false, // Initialize adherence flags
    };
    await this.sleepSlots.insertOne(newSlot);
    return { sleepSlotId: newSlot._id }; // Return the ID of the newly created slot
  }

  /**
   * removeSleepSlot (user: User, date: DateString): Empty | { error: string }
   *
   * @requires: There exists a SleepSlot with the given user and date.
   * @effects: Removes this SleepSlot from the state.
   * @param {object} args - The arguments for the action.
   * @param {User} args.user - The ID of the user.
   * @param {DateString} args.date - The date of the sleep slot to remove.
   * @returns {Promise<Empty | { error: string }>} An empty object on success, or an error message.
   */
  async removeSleepSlot(
    { user, date }: { user: User; date: DateString },
  ): Promise<Empty | { error: string }> {
    // requires: there exists a SleepSlot with user u and date d.
    const result = await this.sleepSlots.deleteOne({ user, date });
    if (result.deletedCount === 0) {
      return {
        error: `No sleep slot found for user ${user} on date ${date} to remove.`,
      };
    }
    // effects: removes this SleepSlot.
    return {};
  }

  /**
   * reportBedTime (user: User, reportedTime: TimeString, date: DateString): { bedTimeSuccess: boolean } | { error: string }
   *
   * @requires: A SleepSlot for the given user and date must exist.
   * @effects: Updates the `bedTimeSuccess` flag for the specific sleep slot based on whether
   *           the `reportedTime` was on or before the `bedTimeGoal`.
   * @param {object} args - The arguments for the action.
   * @param {User} args.user - The ID of the user.
   * @param {TimeString} args.reportedTime - The actual time the user reported going to bed (e.g., "22:15").
   * @param {DateString} args.date - The date for which the bed time is being reported.
   * @returns {Promise<{ bedTimeSuccess: boolean } | { error: string }>} The calculated `bedTimeSuccess` status on success, or an error message.
   */
  async reportBedTime(
    { user, reportedTime, date }: {
      user: User;
      reportedTime: TimeString;
      date: DateString;
    },
  ): Promise<{ bedTimeSuccess: boolean } | { error: string }> {
    // requires: SleepSlot with user:User and date:DateString exists
    const existingSlot = await this.sleepSlots.findOne({ user, date });
    if (!existingSlot) {
      return {
        error: `No sleep slot found for user ${user} on date ${date}. Cannot report bed time.`,
      };
    }

    // effects: sets bedTimeSuccess = reportedTime <= bedTimeGoal
    // String comparison for "HH:MM" works for lexicographical order assuming valid 24-hour format.
    // Success means going to bed *at or before* the goal.
    const bedTimeSuccess = reportedTime <= existingSlot.bedTimeGoal;

    await this.sleepSlots.updateOne(
      { _id: existingSlot._id },
      { $set: { bedTimeSuccess: bedTimeSuccess } },
    );
    return { bedTimeSuccess };
  }

  /**
   * reportWakeUpTime (user: User, reportedTime: TimeString, date: DateString): { wakeUpSuccess: boolean } | { error: string }
   *
   * @requires: A SleepSlot for the given user and date must exist.
   * @effects: Updates the `wakeUpSuccess` flag for the specific sleep slot based on whether
   *           the `reportedTime` was on or after the `wakeUpTimeGoal`.
   * @param {object} args - The arguments for the action.
   * @param {User} args.user - The ID of the user.
   * @param {TimeString} args.reportedTime - The actual time the user reported waking up (e.g., "07:05").
   * @param {DateString} args.date - The date for which the wake-up time is being reported.
   * @returns {Promise<{ wakeUpSuccess: boolean } | { error: string }>} The calculated `wakeUpSuccess` status on success, or an error message.
   */
  async reportWakeUpTime(
    { user, reportedTime, date }: {
      user: User;
      reportedTime: TimeString;
      date: DateString;
    },
  ): Promise<{ wakeUpSuccess: boolean } | { error: string }> {
    // requires: SleepSlot with user:User and date:DateString exists
    const existingSlot = await this.sleepSlots.findOne({ user, date });
    if (!existingSlot) {
      return {
        error: `No sleep slot found for user ${user} on date ${date}. Cannot report wake up time.`,
      };
    }

    // effects: set wakeUpSuccess = reportedTime >= wakeUpTimeGoal
    // String comparison for "HH:MM" works for lexicographical order assuming valid 24-hour format.
    // Success means waking up *at or after* the goal.
    const wakeUpSuccess = reportedTime >= existingSlot.wakeUpTimeGoal;

    await this.sleepSlots.updateOne(
      { _id: existingSlot._id },
      { $set: { wakeUpSuccess: wakeUpSuccess } },
    );
    return { wakeUpSuccess };
  }

  /**
   * _getSleepAdherence (user: User, date: DateString): { bedTimeSuccess: boolean; wakeUpSuccess: boolean } | { error: string }
   *
   * @effects: Returns the bed time and wake up time adherence status for a specific user and date.
   * @param {object} args - The arguments for the query.
   * @param {User} args.user - The ID of the user.
   * @param {DateString} args.date - The date for which to retrieve adherence.
   * @returns {Promise<{ bedTimeSuccess: boolean; wakeUpSuccess: boolean } | { error: string }>} The adherence status or an error message.
   */
  async _getSleepAdherence(
    { user, date }: { user: User; date: DateString },
  ): Promise<
    | { bedTimeSuccess: boolean; wakeUpSuccess: boolean }
    | { error: string }
  > {
    const slot = await this.sleepSlots.findOne({ user, date });
    if (!slot) {
      return {
        error: `No sleep slot found for user ${user} on date ${date}.`,
      };
    }
    return {
      bedTimeSuccess: slot.bedTimeSuccess,
      wakeUpSuccess: slot.wakeUpSuccess,
    };
  }

  /**
   * _getUserSleepSlots (user: User): { slots: SleepSlot[] }
   *
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
