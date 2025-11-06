---
timestamp: 'Wed Nov 05 2025 19:00:41 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251105_190041.5e686237.md]]'
content_id: 7ea51da28ccc40e6562ddeeaea4ae53d58460d71ae70dc4642165cff975fc963
---

# implement: update queries so that they are implemented correctly

Here's the TypeScript implementation for the `AccountabilityConcept`, following the specified

```
import { Collection, Db } from "npm:mongodb";

import { ID, Empty } from "@utils/types.ts";

import { freshID } from "@utils/database.ts"; // Assuming freshID is provided as per instructions

  

/**

 * Concept: Accountability

 * Purpose: Record accountability partnerships between users and their associated notification preferences.

 *          The concept does not send messages or access contact information — it only stores user IDs and preference data.

 *

 * Principle: After a user designates a partner, the system tracks that relationship and stores which types of

 *            adherence failures and reporting frequency apply. External notification or email components

 *            use this data separately.

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

 * Partnerships:

 * a set of Partnerships with

 *   a user:User

 *   a partner:User

 *   notifyTypes: set of FailureType // e.g., {MissedBedtime, MissedWake}

 *   reportFrequency: FrequencyType // Immediate | Daily | Weekly

 *   lastReportDate:Date | null

 */

interface Partnership {

  _id: ID; // Unique ID for the partnership record

  user: User; // The user who initiated the partnership

  partner: User; // The user designated as the partner

  notifyTypes: FailureType[]; // Types of failures to notify about

  reportFrequency: FrequencyType; // How often to report

  lastReportDate: Date | null; // Date of the last report for this partnership

}

  

/**

 * AdherenceFailures:

 * a set of AdherenceFailures with

 *   a failingUser:User

 *   a date:Date

 *   a failType: SleepEventType

 *   reported:Boolean

 */

interface AdherenceFailure {

  _id: ID; // Unique ID for the failure record

  failingUser: User; // The user who failed adherence

  date: Date; // The date of the failure (time component ignored)

  failType: SleepEventType; // The type of sleep event failure

  reported: boolean; // Whether this failure has been reported

}

  

/**

 * Reports:

 * a set of Reports with

 *   a user: User

 *   a accountabilitySeeker: User

 *   a allReports: string[]

 */

interface Report {

  _id: ID; // Unique ID for the report record

  user: User; // The user being reported on

  accountabilitySeeker: User; // The partner/observer seeking accountability

  allReports: string[]; // Arbitrary report payloads/strings accumulated over time

}

  

// Utility for parsing date strings to Date objects (YYYY-MM-DD format assumed)

// Normalize to the start of the day in LOCAL time for consistency with other concepts.

function parseDateString(dateString: string): Date | null {

  // // Strictly treat YYYY-MM-DD as a local calendar date

  // const parts = dateString.split("-").map(Number);

  // if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;

  // const [y, m, d] = parts;

  // const dt = new Date(y, m - 1, d, 0, 0, 0, 0);

  // // Validate round-trip to guard invalid dates (e.g., 2024-02-30)

  // if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;

  // return dt;

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {

    return null; // Invalid date string

  }

  // Normalize to the start of the day in local time (e.g., YYYY-MM-DDT00:00:00.000)

  // return new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

}

  
  

function formatDateToString(date: Date): string {

  const y = date.getUTCFullYear();

  const m = String(date.getUTCMonth() + 1).padStart(2, "0");

  const d = String(date.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;

}

  
  

export default class AccountabilityConcept {

  partnerships: Collection<Partnership>;

  adherenceFailures: Collection<AdherenceFailure>;

  reports: Collection<Report>;

  

  constructor(private readonly db: Db) {

    this.partnerships = this.db.collection(PREFIX + "partnerships");

    this.adherenceFailures = this.db.collection(PREFIX + "adherenceFailures");

    this.reports = this.db.collection(PREFIX + "reports");

  }

  

  /**

   * addPartner

   * Adds a new accountability partnership between two users.

   *

   * @param {Object} args - The action arguments.

   * @param {User} args.user - The user initiating the partnership.

   * @param {User} args.partner - The user designated as the partner.

   * @returns {Empty | {error: string}} An empty object on success, or an error object.

   *

   * @requires user and partner are not equal and (user, partner) is not in Partnerships.

   * @effects add (user, partner, notifyTypes, reportFrequency, null) to Partnerships

   */

  async addPartner({

    user,

    partner,

    notifyTypes = [], // Default: no specific failure types to notify

    reportFrequency = FrequencyType.IMMEDIATE, // Default: immediate reporting

  }: {

    user: User;

    partner: User;

    notifyTypes?: FailureType[];

    reportFrequency?: FrequencyType;

  }): Promise<Empty | { error: string }> {

    // requires: user and partner are not equal

    if (user === partner) {

      return { error: "User cannot partner with themselves." };

    }

  

    // requires: (user, partner) is not in Partnerships

    const existingPartnership = await this.partnerships.findOne({ user, partner });

    if (existingPartnership) {

      return { error: "Partnership already exists." };

    }

  

    // effects: add (user, partner, notifyTypes, reportFrequency, null) to Partnerships

    const newPartnership: Partnership = {

      _id: freshID(),

      user,

      partner,

      notifyTypes, // Default: no specific failure types to notify

      reportFrequency, // Default: immediate reporting

      lastReportDate: null,

    };

  

    try {

      // Insert the new partnership

      await this.partnerships.insertOne(newPartnership);

  

      // Also insert a corresponding Reports entry: (partner, user, [])

      const newReport: Report = {

        _id: freshID(),

        user: partner,

        accountabilitySeeker: user,

        allReports: [],

      };

      await this.reports.insertOne(newReport);

  

      return {};

    } catch (e) {

      console.error("Error adding partner and initializing report:", e);

      return { error: "Failed to add partner due to database error." };

    }

  }

  

  /**

   * removePartner

   * Removes an existing accountability partnership.

   *

   * @param {Object} args - The action arguments.

   * @param {User} args.user - The user who initiated the partnership.

   * @param {User} args.partner - The user designated as the partner to remove.

   * @returns {Empty | {error: string}} An empty object on success, or an error object.

   *

   * @requires (user, partner) in Partnerships

   * @effects remove the pairing user, partner in Partnerships

   */

  async removePartner({

    user,

    partner,

  }: {

    user: User;

    partner: User;

  }): Promise<Empty | { error: string }> {

    // requires: (user, partner) in Partnerships

    const partnershipExists = await this.partnerships.findOne({ user, partner });

    if (!partnershipExists) {

      return { error: "Partnership does not exist." };

    }

  

    // effects: remove the pairing user, partner in Partnerships

    try {

      const result = await this.partnerships.deleteOne({ user, partner });

      if (result.deletedCount === 0) {

        return { error: "Partnership not found for deletion." };

      }

  

      // Also remove the corresponding Reports pairing (partner, user)

      await this.reports.deleteOne({ user: partner, accountabilitySeeker: user });

  

      return {};

    } catch (e) {

      console.error("Error removing partner:", e);

      return { error: "Failed to remove partner due to database error." };

    }

  }

  

  /**

   * updatePreferences

   * Modifies the notification preferences for an existing partnership.

   *

   * @param {Object} args - The action arguments.

   * @param {User} args.user - The user who initiated the partnership.

   * @param {User} args.partner - The partner whose preferences are being updated.

   * @param {FailureType[]} args.notifyTypes - The new set of failure types to notify about.

   * @param {FrequencyType} args.reportFrequency - The new reporting frequency.

   * @returns {Empty | {error: string}} An empty object on success, or an error object.

   *

   * @requires (user, partner) in Partnerships

   * @effects modify that partnership’s notifyTypes and reportFrequency

   */

  async updatePreferences({

    user,

    partner,

    notifyTypes,

    reportFrequency,

  }: {

    user: User;

    partner: User;

    notifyTypes: FailureType[];

    reportFrequency: FrequencyType;

  }): Promise<Empty | { error: string }> {

    // requires: (user, partner) in Partnerships

    const partnership = await this.partnerships.findOne({ user, partner });

    if (!partnership) {

      return { error: "Partnership not found." };

    }

  

    // effects: modify that partnership’s notifyTypes and reportFrequency

    try {

      const result = await this.partnerships.updateOne(

        { _id: partnership._id },

        { $set: { notifyTypes, reportFrequency } },

      );

      if (result.matchedCount === 0) {

        return { error: "Partnership not found for update." };

      }

      return {};

    } catch (e) {

      console.error("Error updating preferences:", e);

      return { error: "Failed to update preferences due to database error." };

    }

  }

  

  /**

   * recordFailure

   * Records an adherence failure for a user on a specific date.

   *

   * @param {Object} args - The action arguments.

   * @param {User} args.user - The user who experienced the failure.

   * @param {string} args.date - The date of the failure (e.g., "YYYY-MM-DD").

   * @param {SleepEventType} args.failureType - The type of sleep event failure.

   * @returns {Empty | {error: string}} An empty object on success, or an error object.

   *

   * @requires date can be parsed into a Date object

   * @effects parse date into a Date object; if user is not in AdherenceFailures, add (user, date, failureType) to AdherenceFailures

   */

  async recordFailure({

    user,

    date: dateString,

    failureType,

  }: {

    user: User;

    date: string;

    failureType: SleepEventType;

  }): Promise<Empty | { error: string }> {

    // requires: date can be parsed into a Date object

    const date = parseDateString(dateString);

    if (!date) {

      return { error: "Invalid date string provided." };

    }

  

    // effects: if same failure is not in AdherenceFailures add (user, date, failureType) to AdherenceFailures

    // This implies we don't record the *exact same* failure (user, date, failureType) twice.

    const existingFailure = await this.adherenceFailures.findOne({

      failingUser: user,

      date: date, // MongoDB can query Date objects directly

      failType: failureType,

    });

  

    if (existingFailure) {

      // If the exact failure already exists, we don't re-record it.

      // The requirement "if user is not in AdherenceFailures" is ambiguous if it means

      // any failure for the user, or this specific failure. Assuming specific for uniqueness.

      return { error: "Failure already recorded for this user, date, and type." };

    }

  

    const newFailure: AdherenceFailure = {

      _id: freshID(),

      failingUser: user,

      date: date,

      failType: failureType,

      reported: false,

    };

  

    try {

      await this.adherenceFailures.insertOne(newFailure);

      return {};

    } catch (e) {

      console.error("Error recording failure:", e);

      return { error: "Failed to record failure due to database error." };

    }

  }

  

  /**

   * reportAllFailuresFromStartToEnd

   * Finds and returns a formatted string of adherence failures for a user within a date range,

   * without marking them as reported.

   *

   * @param {Object} args - The action arguments.

   * @param {User} args.user - The user whose failures are to be reported.

   * @param {string} args.startDate - The start date of the reporting period (e.g., "YYYY-MM-DD").

   * @param {string} args.endDate - The end date of the reporting period (e.g., "YYYY-MM-DD").

   * @returns {string | {error: string}} A formatted string of failures, or an error object.

   *

   * @requires startDate <= endDate; startDate and endDate must be valid date strings parseable into Date objects.

   * @effects Find all adherence failures for the given user whose date is between startDate and endDate (inclusive)

   *          and whose reported flag is false. Return a string listing each failure, or "No adherence failures for this period."

   */

  async reportAllFailuresFromStartToEnd({

    user,

    startDate: startDateString,

    endDate: endDateString,

  }: {

    user: User;

    startDate: string;

    endDate: string;

  }): Promise<{ message: string } | { error: string }> {

    // requires: startDate and endDate must be valid date strings parseable into Date objects.

    const startDate = parseDateString(startDateString);

    const endDate = parseDateString(endDateString);

  

    if (!startDate || !endDate) {

      return { error: "Invalid start or end date string provided." };

    }

  

    // requires: startDate <= endDate

    if (startDate.getTime() > endDate.getTime()) {

      return { error: "Start date cannot be after end date." };

    }

  

    // effects: Find all adherence failures for the given user whose date is between startDate and endDate (inclusive)

    // and whose reported flag is false.

    try {

      // Use [startDate, dayAfterEndDate) to avoid UTC boundary issues

      const dayAfterEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1, 0, 0, 0, 0);

      const failures = await this.adherenceFailures

        .find({

          failingUser: user,

          reported: false,

          date: {

            $gte: startDate,

            $lt: dayAfterEndDate,

          },

        })

        .toArray();

  

      if (failures.length === 0) {

        return { message: "No adherence failures for this period." };

      }

  

      // Return a string listing each failure’s type and date in readable form.

      const failureMessages = failures

        .map(

          (failure) =>

            `- Type: ${failure.failType}, Date: ${formatDateToString(failure.date)}`,

        )

        .join("\n");

  

      return { message: "Failures:\n" + failureMessages };

    } catch (e) {

      console.error("Error reporting failures:", e);

      return { error: "Failed to retrieve failures due to database error." };

    }

  }

  

  /**

   * updateReports

   * Generates failure reports for each partnership according to preferences and appends them to Reports.

   *

   * @param {Object} args - The action arguments.

   * @param {User} args.user - The user whose failures are being summarized for partners.

   * @param {string} args.date - The current date for context (e.g., "YYYY-MM-DD").

   * @returns {Empty | {error: string}} Empty on success, or an error object.

   *

   * @requires The user has at least one partnership recorded in Partnerships. date is parseable into a Date object.

   * @effects Dynamically generates notifications based on partnership preferences (Immediate, Daily, Weekly),

   *          marks relevant failures as reported, updates the partnership's lastReportDate,

   *          and appends the generated report string to the Reports document with (user: partner, accountabilitySeeker: user).

   */

  async updateReports({

    user,

    date: currentDateString,

  }: {

    user: User;

    date: string;

  }): Promise<Empty | { error: string }> {

    // requires: date is parseable into a Date object

    const currentDate = parseDateString(currentDateString);

    if (!currentDate) {

      return { error: "Invalid date string provided for current date." };

    }

  

    // requires: The user has at least one partnership recorded in Partnerships.

    const partnerships = await this.partnerships

      .find({ user: user })

      .toArray();

    if (partnerships.length === 0) {

      return { error: "User has no recorded partnerships." };

    }

  

    let allMessages: { partner: User; message: string }[] = [];

  

    for (const partnership of partnerships) {

      let message = "";

      let failuresToMarkReported: ID[] = [];

      let shouldUpdateLastReportDate = false;

  

      // Helper to find and mark failures

      const getAndMarkFailures = async (

        failingUser: User,

        start: Date,

        endInclusive: Date,

      ) => {

        // Build [start, nextDayOfEnd) to avoid UTC boundary issues

        const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);

        const endExclusive = new Date(endInclusive.getFullYear(), endInclusive.getMonth(), endInclusive.getDate() + 1, 0, 0, 0, 0);

        const failures = await this.adherenceFailures

          .find({

            failingUser: failingUser,

            reported: false,

            failType: { $in: partnership.notifyTypes }, // Filter by preferred notification types

            date: { $gte: startOfDay, $lt: endExclusive },

          })

          .toArray();

  

        if (failures.length > 0) {

          failuresToMarkReported.push(...failures.map((f) => f._id));

          return (

            "Failures:\n" +

            failures

              .map(

                (failure) =>

                  `- Type: ${failure.failType}, Date: ${formatDateToString(failure.date)}`,

              )

              .join("\n")

          );

        }

        return "No adherence failures for this period.";

      };

  

      try {

        if (partnership.reportFrequency === FrequencyType.IMMEDIATE) {

          // Immediate: check failures for *today*

          const report = await getAndMarkFailures(

            user,

            currentDate,

            currentDate,

          );

          if (report !== "No adherence failures for this period.") {

            message = `Immediate Alert for ${partnership.partner}:\n${report}`;

            shouldUpdateLastReportDate = true;

          }

        } else if (partnership.reportFrequency === FrequencyType.DAILY) {

          // Daily: check failures for *yesterday*

          const previousDay = new Date(currentDate);

          previousDay.setDate(currentDate.getDate() - 1);

          previousDay.setHours(0, 0, 0, 0); // Ensure it's start of local day

  

          // Only report if last report was before the previous day (to avoid multiple reports for same day)

          const lastReportForDaily = partnership.lastReportDate ? new Date(partnership.lastReportDate) : null;

          lastReportForDaily?.setHours(0, 0, 0, 0);

  

          if (!lastReportForDaily || lastReportForDaily.getTime() < currentDate.getTime()) {

             const report = await getAndMarkFailures(

                user,

                previousDay,

                previousDay,

             );

            if (report !== "No adherence failures for this period.") {

              message = `Daily Report for ${partnership.partner}:\n${report}`;

              shouldUpdateLastReportDate = true;

            }

          }

        } else if (partnership.reportFrequency === FrequencyType.WEEKLY) {

          // Weekly: check failures for the last 7 days

          const sevenDaysAgo = new Date(currentDate);

          sevenDaysAgo.setDate(currentDate.getDate() - 7);

          sevenDaysAgo.setHours(0, 0, 0, 0); // Ensure it's start of local day

  

          const lastReportForWeekly = partnership.lastReportDate ? new Date(partnership.lastReportDate) : null;

          lastReportForWeekly?.setHours(0, 0, 0, 0);

  

          // Only report if 7+ days have passed since the last report, or no report yet.

          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

          if (!lastReportForWeekly || (currentDate.getTime() - lastReportForWeekly.getTime() >= sevenDaysMs)) {

            const report = await getAndMarkFailures(

              user,

              sevenDaysAgo,

              currentDate,

            );

            if (report !== "No adherence failures for this period.") {

              message = `Weekly Report for ${partnership.partner}:\n${report}`;

              shouldUpdateLastReportDate = true;

            }

          }

        }

  

        if (message) {

          allMessages.push({ partner: partnership.partner, message });

  

          // Mark those failures as reported.

          if (failuresToMarkReported.length > 0) {

            await this.adherenceFailures.updateMany(

              { _id: { $in: failuresToMarkReported } },

              { $set: { reported: true } },

            );

          }

  

          // Update the last report date to the current date.

          if (shouldUpdateLastReportDate) {

            await this.partnerships.updateOne(

              { _id: partnership._id },

              { $set: { lastReportDate: currentDate } },

            );

          }

        }

      } catch (e) {

        console.error(

          `Error generating notification for partnership ${partnership._id}:`,

          e,

        );

        // Continue to other partnerships even if one fails

      }

    }

  

    // Append messages to Reports for each partner

    for (const entry of allMessages) {

      await this.reports.updateOne(

        { user: entry.partner, accountabilitySeeker: user },

        { $push: { allReports: entry.message } },

        { upsert: true },

      );

    }

  

    return {};

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

  

  /**

   * _getAccountabilitySeekersForUser

   * Returns the list of users who have designated the given mentor as their partner.

   *

   * @param args.mentor The mentor user ID to find seekers for

   * @returns List<User> or { error }

   */

  async _getAccountabilitySeekersForUser(

    { mentor }: { mentor: User },

  ): Promise<User[]> {

    try {

      const partnerships = await this.partnerships

        .find({ partner: mentor })

        .project<{ user: User }>({ user: 1, _id: 0 })

        .toArray();

      return partnerships.map((p) => p.user);

    } catch (e) {

      return []; // On error, return empty list;

    }

  }

  

  /**

   * _getAllReports

   * Returns the stored list of report strings for the given (user, accountabilitySeeker) pair.

   */

  async _getAllReports(

    { user, accountabilitySeeker }: { user: User; accountabilitySeeker: User },

  ): Promise<string[]> {

    try {

      const report = await this.reports.findOne({ user, accountabilitySeeker });

      return report?.allReports ?? [];

    } catch (e) {

      return []; // On error, return empty list];

    }

  }

}
```
