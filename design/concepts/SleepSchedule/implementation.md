[@concept-design-overview](../../background/concept-design-overview.md)

[@concept-specifications](../../background/concept-specifications.md)

[@implementing-concepts](../../background/implementing-concepts.md)

[@SleepSchedule](SleepSchedule.md)

# implement: SleepSchedule
# response:

Here's how to ensure your concepts are independent, based on the provided "Concept Design Background" and "Structure of a concept specification" documentation:

### How to Make Sure Your Concepts Are Independent

The documentation explicitly states that concepts are "Completely independent of one another in terms of dependencies and state" and highlights key characteristics that contribute to this independence. To ensure your concepts are independent, follow these principles:

1.  **Encapsulate a Single, User-Relevant Purpose:**
    *   Each concept must have a very specific, well-defined purpose that addresses a user need. This prevents a concept from becoming overly broad and trying to manage functionality that belongs elsewhere.
    *   *Example:* The `Labeling` concept's purpose is *only* to associate labels with items and retrieve items by label. It doesn't handle the content of the items themselves or other messaging functions.
    *   *Check:* If a concept's purpose statement sounds too generic or overlaps significantly with another concept's purpose, it might indicate a lack of clear separation.

2.  **Strictly Separate State and Concerns:**
    *   A concept manages its *own* state, which represents all the necessary information for *its* specific behavioral concern. It should not directly access or modify the internal state of another concept.
    *   *Example:* `UserAuthentication` might store `username` and `password` for `Users`, while `UserProfile` stores `bio` and `thumbnail` for the *same* generic `Users`. These are distinct views or partitions of data related to a `User` entity, managed independently by separate concepts.
    *   *Check:* If your concept's state includes details that are primarily managed or owned by another concept, or if an action in your concept needs to directly alter another concept's internal state, your concepts are likely not independent.

3.  **Work Off Generic Type Parameters (Polymorphism):**
    *   Concepts should be defined using generic type parameters (e.g., `User`, `Item`, `Target`). They should treat these parameters as opaque identifiers or references, without knowing their concrete types or internal properties.
    *   *Example:* The `Comment` concept takes `User` and `Target`. It doesn't know if `User` comes from `UserAuthentication` or `UserProfiles`, nor does it know if `Target` is a `Post`, `Image`, or `Document`. It only knows how to associate text with these generic IDs.
    *   *Check:* If your concept's actions or state implicitly or explicitly rely on specific properties or methods of a "typed" object that is intended to be managed by *another* concept, you are creating a direct dependency.

4.  **No Direct Code-Level Dependencies (Imports/References):**
    *   This is a crucial implementation rule: "No import statements can reference another concept in any way, including type declarations."
    *   Concepts should communicate indirectly, often by referencing shared generic IDs or by acting as a response to events (though the event mechanism isn't fully detailed in this text, it's implied by the "interleaved sequence of events" in "Concept actions").
    *   *Check:* During implementation, strictly enforce that a concept's TypeScript class does not `import` or directly reference types or instances of other concept classes.

5.  **Behavioral Completeness (for its purpose):**
    *   Each concept must embody *all* the functionality (actions and queries) required to fulfill its specific purpose. It should not rely on other concepts to complete its core operations.
    *   *Example:* The `Labeling` concept provides `createLabel`, `addLabel`, `deleteLabel`, enabling it to fully manage the labeling process for any `Item` without delegating core labeling logic to an `EmailMessage` class.
    *   *Check:* If a user workflow related to a concept's purpose requires invoking methods from multiple concepts in a tightly coupled sequence, or if a concept feels incomplete without another, independence is compromised.

By adhering to these principles, concept design promotes a modular architecture where each unit is self-contained, reusable, and less prone to breaking when other parts of the system change.

---

# implement: SleepSchedule

Here's the implementation for the `SleepSchedule` concept, following the provided guidelines and addressing the observed ambiguities in the specification.

**Assumptions & Corrections Made During Implementation:**

1.  **`addSleepSlot` Parameters:** The original spec had `addSleepSlot (u: User, bedTime:String , wakeTime: String, Time: Number): (survey: Survey)`.
    *   I've assumed `Time: Number` was a typo and should have been `date: String`, aligning with other actions.
    *   I've assumed `(survey: Survey)` was a typo for the return type and instead return `{ sleepSlotId: ID }` on success, or `{ error: string }` on failure, to comply with the non-empty return dictionary rule when an error path exists.
2.  **`bedTime` and `wakeUpTime` in State:** Renamed to `bedTimeGoal` and `wakeUpTimeGoal` in the `SleepSlot` interface for clarity, as they represent the *target* times set by the user.
3.  **`reportBedTime` and `reportWakeUpTime` Return Type:** The spec said `Boolean`. I've implemented this as `Promise<{ bedTimeSuccess: boolean } | { error: string }>` and `Promise<{ wakeUpSuccess: boolean } | { error: string }>` respectively, to return a non-empty dictionary on success when an error path is present.
4.  **Time/Date Representation:** Used `string` for `DateString` (e.g., "YYYY-MM-DD") and `TimeString` (e.g., "HH:MM"), and relied on lexicographical string comparison for `reportedTime <= bedTimeGoal` and `reportedTime >= wakeUpTimeGoal`. This works for 24-hour time.
5.  **Adherence Logic:**
    *   `bedTimeSuccess`: `reportedTime <= bedTimeGoal` (went to bed on or before target).
    *   `wakeUpSuccess`: `reportedTime >= wakeUpTimeGoal` (woke up on or after target).
6.  **`_id` for SleepSlot:** Each `SleepSlot` gets a `freshID()` for its `_id`, in addition to `user` and `date` which form a natural unique key for lookups.

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