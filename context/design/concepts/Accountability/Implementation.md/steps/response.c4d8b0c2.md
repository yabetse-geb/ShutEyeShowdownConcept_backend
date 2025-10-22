---
timestamp: 'Tue Oct 21 2025 18:32:53 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_183253.2d45cf9b.md]]'
content_id: c4d8b0c293980df07f4d09c2e2a799272f2f13ecf0e9d71bcc71386133924b03
---

# response:

Here's how to ensure your concepts are independent, followed by the implementation of the `Accountability` concept including the requested query.

***

### How to make sure your concepts are independent?

Based on the provided "Concept Design Background" and "Concepts are not objects" sections, here are the key strategies to ensure your concepts are independent:

1. **Encapsulate State Entirely within the Concept:**
   * A concept's `state` definition should include *only* the data essential for its unique purpose. It should not hold or directly modify data that is conceptually owned by another concept.
   * The document explicitly states: "Concepts are completely independent of one another in terms of dependencies and state." This means one concept's state should not directly contain or depend on the internal structure of another concept's state.
   * **Example:** A `UserAuthentication` concept holds `username` and `password` for `User`s. A separate `UserProfile` concept holds `bio` and `thumbnail` for the *same* `User`s. Neither concept knows or cares about the other's specific data related to a `User` ID; they only care about their own slice of the user's data.

2. **Operate on Generic Type Parameters (IDs) Only:**
   * Concepts accept generic `type parameters` (like `User`, `Target`, `Item`). These parameters *must* be treated polymorphically, meaning the concept cannot assume they have any properties beyond being comparable identifiers/references.
   * The only valid operation on these generic types (often implemented as `ID`s in code) is equality checking (e.g., `user1 === user2`). This prevents a concept from implicitly depending on the schema, structure, or behavior of objects managed by *other* concepts.
   * **Example:** A `Comment` concept takes `User` and `Target` as generic parameters. It knows *a `User` made a `Comment` on a `Target`*, but it doesn't know (or need to know) what a `User`'s `username` or `bio` is, nor what a `Target`'s `title` or `content` is. Those details belong to other concepts (like `UserAuthentication`, `UserProfile`, `Post` concepts).

3. **Adhere to a Single, User-Relevant Purpose:**
   * Each concept must have a "single purpose" that is "strongly grounded in a user-relevant purpose, and not just a structure for software."
   * A clear, specific, and evaluable `purpose` acts as a natural boundary. If a concept's responsibilities start to extend beyond its stated purpose, it's a strong indicator that it might be conflating concerns or creating dependencies on other functionalities.
   * **Example:** The `Trash` concept's purpose is "support deletion of items with possibility of restoring," not just "delete items." This specific purpose means it needs to track deleted items, which is its sole responsibility, not the actual deletion *logic* for the item itself.

4. **Be Behaviorally Complete for its Defined Purpose:**
   * "A concept must embody all the functionality associated with a behavioral concern, unlike objects which often depend on other objects for their functioning." This means a concept should be self-contained for performing its core actions and queries related to its purpose, without needing to invoke or directly rely on the internal mechanisms of other concepts.
   * **Example:** The `Labeling` concept provides `createLabel`, `addLabel`, `deleteLabel` and implicitly querying for labels. It manages the entire labeling lifecycle without needing an `EmailMessage` object to tell it what labels it has.

5. **Avoid Direct Code-Level Dependencies (No Cross-Concept Imports):**
   * The implementation guidelines explicitly state: "No import statements can reference another concept in any way, including type declarations." This is the strictest enforcement of independence at the code level. Concepts should communicate indirectly, primarily by exchanging `ID`s and through external orchestration, rather than direct method calls between concept classes.

By diligently following these principles, you ensure that concepts remain modular, reusable, testable in isolation, and loosely coupled, making the overall system more robust and easier to manage.

***

### Implementation: Accountability Concept

Here is the TypeScript implementation for the `AccountabilityConcept`, including all specified actions and the requested `_getPartnerships` query.

```typescript
// file: src/concepts/Accountability/AccountabilityConcept.ts
import { Collection, Db } from "npm:mongodb";
import { ID, Empty } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * concept: Accountability [User]
 * purpose: Enable structured accountability between users by recording their partnerships, adherence tracking preferences, and report frequencies.
 *          The concept maintains only the data required to support external systems in generating notifications or summaries—it does not send or deliver messages itself.
 *
 * principle: If a user establishes an accountability partnership with a partner and configures notification preferences (e.g., daily reports for specific adherence failures),
 *            and the user then records adherence failures, then the concept will, at the defined frequency, enable the generation of a report for the partner
 *            detailing those failures, marking them as reported and updating the partnership's last report date.
 */

// Declare collection prefix, use concept name
const PREFIX = "Accountability" + ".";

// Generic types of this concept
type User = ID;

/**
 * SleepEventType: An enumeration representing the type of sleep event.
 * BEDTIME: Represents the event of going to bed.
 * WAKETIME: Represents the event of waking up.
 */
enum SleepEventType {
  BEDTIME = "BEDTIME",
  WAKETIME = "WAKETIME",
}

/**
 * FailureType: Represents the type of adherence failure.
 * Corresponds to SleepEventType for this concept.
 */
type FailureType = SleepEventType;

/**
 * FrequencyType: Defines how often notifications should be reported.
 * Immediate | Daily | Weekly
 */
enum FrequencyType {
  IMMEDIATE = "Immediate",
  DAILY = "Daily",
  WEEKLY = "Weekly",
}

/**
 * a set of Partnerships with
 *   a user:User
 *   a partner:User
 *   notifyTypes: set of FailureType
 *   reportFrequency: FrequencyType
 *   lastReportDate:Date
 */
interface Partnership {
  _id: ID;
  user: User;
  partner: User;
  notifyTypes: FailureType[];
  reportFrequency: FrequencyType;
  lastReportDate: Date | null;
}

/**
 * a set of AdherenceFailures with
 *   a failingUser:User
 *   a date:Date
 *   a failType: SleepEventType
 *   reported:Boolean
 */
interface AdherenceFailure {
  _id: ID;
  failingUser: User;
  date: Date;
  failType: SleepEventType;
  reported: boolean;
}

// Utility to parse a YYYY-MM-DD string into a Date object at midnight UTC
function parseDateString(dateString: string): Date | null {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return null;
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

// Utility to format a Date object into a YYYY-MM-DD string
function formatDateToString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default class AccountabilityConcept {
  partnerships: Collection<Partnership>;
  adherenceFailures: Collection<AdherenceFailure>;

  constructor(private readonly db: Db) {
    this.partnerships = this.db.collection(PREFIX + "partnerships");
    this.adherenceFailures = this.db.collection(PREFIX + "adherenceFailures");
  }

  /**
   * addPartner(user:User, partner:User, notifyTypes: FailureType[], reportFrequency:FrequencyType)
   *
   * requires: user and partner are not equal and (user, partner) is not in Partnerships
   * effects: add (user, partner, notifyTypes, reportFrequency, null) to Partnerships
   */
  async addPartner({ user, partner, notifyTypes, reportFrequency }: { user: User; partner: User; notifyTypes: FailureType[]; reportFrequency: FrequencyType }): Promise<Empty | { error: string }> {
    if (user === partner) {
      return { error: "User cannot be their own partner." };
    }

    const existing = await this.partnerships.findOne({ user, partner });
    if (existing) {
      return { error: "This partnership already exists." };
    }

    const newPartnership: Partnership = {
      _id: freshID(),
      user,
      partner,
      notifyTypes,
      reportFrequency,
      lastReportDate: null,
    };
    await this.partnerships.insertOne(newPartnership);
    return {};
  }

  /**
   * removePartner(user: User, partner:User)
   *
   * requires: (user, partner) in Partnerships
   * effects: remove the pairing user, partner in Partnerships
   */
  async removePartner({ user, partner }: { user: User; partner: User }): Promise<Empty | { error: string }> {
    const result = await this.partnerships.deleteOne({ user, partner });
    if (result.deletedCount === 0) {
      return { error: "Partnership not found." };
    }
    return {};
  }

  /**
   * updatePreferences(user: User, partner: User, notifyTypes: set of FailureType, reportFrequency: FrequencyType)
   *
   * requires: (user, partner) in Partnerships
   * effects: modify that partnership’s notifyTypes and reportFrequency
   */
  async updatePreferences({ user, partner, notifyTypes, reportFrequency }: { user: User; partner: User; notifyTypes: FailureType[]; reportFrequency: FrequencyType }): Promise<Empty | { error: string }> {
    const result = await this.partnerships.updateOne({ user, partner }, { $set: { notifyTypes, reportFrequency } });

    if (result.matchedCount === 0) {
      return { error: "Partnership not found." };
    }
    return {};
  }

  /**
   * recordFailure(user: User, date:string, failureType:SleepEvent)
   *
   * requires: date can be parsed into a Date object and same exact failure is not in AdherenceFailures
   * effects: parse date into a Date object, if user is not in AdherenceFailures add (user, date, failureType) to AdherenceFailures
   */
  async recordFailure({ user, date: dateString, failureType }: { user: User; date: string; failureType: SleepEventType }): Promise<Empty | { error: string }> {
    const date = parseDateString(dateString);
    if (!date) {
      return { error: "Invalid date format. Please use YYYY-MM-DD." };
    }

    const existingFailure = await this.adherenceFailures.findOne({
      failingUser: user,
      date,
      failType: failureType,
    });

    if (existingFailure) {
      return { error: "This specific failure has already been recorded." };
    }

    const newFailure: AdherenceFailure = {
      _id: freshID(),
      failingUser: user,
      date,
      failType: failureType,
      reported: false,
    };
    await this.adherenceFailures.insertOne(newFailure);
    return {};
  }

  /**
   * reportAllFailuresFromStartToEnd(user:User, startDate:string, endDate:string): (message: String)
   *
   * requires: startDate<=endDate, startDateStr and endDateStr must be valid date strings parseable into Date objects.
   * effects: Returns a string listing each failure’s type and date in readable form, or "No adherence failures for this period."
   */
  async reportAllFailuresFromStartToEnd({ user, startDate: startDateStr, endDate: endDateStr }: { user: User; startDate: string; endDate: string }): Promise<{ message: string } | { error: string }> {
    const startDate = parseDateString(startDateStr);
    const endDate = parseDateString(endDateStr);

    if (!startDate || !endDate) {
      return { error: "Invalid date format. Please use YYYY-MM-DD." };
    }
    if (startDate > endDate) {
      return { error: "Start date cannot be after end date." };
    }

    const failures = await this.adherenceFailures
      .find({
        failingUser: user,
        reported: false,
        date: { $gte: startDate, $lte: endDate },
      })
      .toArray();

    if (failures.length === 0) {
      return { message: "No adherence failures for this period." };
    }

    const message = failures.map((f) => `- Type: ${f.failType}, Date: ${formatDateToString(f.date)}`).join("\n");
    return { message };
  }

  /**
   * generateNotificationMessage(user: User, date: String): (message: String)
   *
   * requires: The user has at least one partnership. date is parseable into a Date object.
   * effects: Generates notifications based on partnership preferences, marks failures as reported, updates lastReportDate.
   */
  async generateNotificationMessage({ user, date: dateString }: { user: User; date: string }): Promise<{ message: string } | { error: string }> {
    const currentDate = parseDateString(dateString);
    if (!currentDate) {
      return { error: "Invalid date format. Please use YYYY-MM-DD." };
    }

    const partnerships = await this.partnerships.find({ user }).toArray();
    if (partnerships.length === 0) {
      return { message: "" }; // No partnerships, so no message
    }

    let allMessages: string[] = [];

    const sevenDaysAgo = new Date(currentDate);
    sevenDaysAgo.setDate(currentDate.getDate() - 7);

    for (const partnership of partnerships) {
      let shouldReport = false;
      const lastReportDate = partnership.lastReportDate ? parseDateString(formatDateToString(partnership.lastReportDate)) : null;

      if (partnership.reportFrequency === FrequencyType.IMMEDIATE) {
        shouldReport = true;
      } else if (partnership.reportFrequency === FrequencyType.DAILY) {
        if (!lastReportDate || lastReportDate.getTime() < currentDate.getTime()) {
          shouldReport = true;
        }
      } else if (partnership.reportFrequency === FrequencyType.WEEKLY) {
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (!lastReportDate || currentDate.getTime() - lastReportDate.getTime() >= sevenDaysMs) {
          shouldReport = true;
        }
      }

      if (shouldReport) {
        const failures = await this.adherenceFailures
          .find({
            failingUser: user,
            reported: false,
            failType: { $in: partnership.notifyTypes },
            date: { $gte: sevenDaysAgo, $lte: currentDate },
          })
          .toArray();

        if (failures.length > 0) {
          const failureMessages = failures.map((f) => `- Type: ${f.failType}, Date: ${formatDateToString(f.date)}`).join("\n");
          allMessages.push(`Report for partner ${partnership.partner}:\n${failureMessages}`);

          // Mark failures as reported
          const failureIds = failures.map((f) => f._id);
          await this.adherenceFailures.updateMany({ _id: { $in: failureIds } }, { $set: { reported: true } });

          // Update last report date
          await this.partnerships.updateOne({ _id: partnership._id }, { $set: { lastReportDate: currentDate } });
        }
      }
    }

    return { message: allMessages.join("\n\n") };
  }

  /**
   * _getPartnerships(user: User): (partnerships: Partnership[])
   *
   * requires: user exists
   * effects: returns all partnerships where the user is either the primary user or the partner.
   */
  async _getPartnerships({ user }: { user: User }): Promise<Partnership[]> {
    const partnerships = await this.partnerships
      .find({
        $or: [{ user: user }, { partner: user }],
      })
      .toArray();
    return partnerships;
  }
}
```
