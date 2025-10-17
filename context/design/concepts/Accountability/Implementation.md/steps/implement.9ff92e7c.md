---
timestamp: 'Thu Oct 16 2025 11:58:09 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_115809.ee22536f.md]]'
content_id: 9ff92e7cc289b85d54f10e3decc7662d5fe756aa5b14a1ab4862ef42ee3171f8
---

# implement: Accountability concept

**# file: src/Accountability/AccountabilityConcept.ts**

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "../../utils/types.ts"; // Adjust path as necessary for your project
import { freshID } from "../../utils/database.ts"; // Adjust path as necessary for your project

// --- Helper Date Utilities (can be moved to @utils/date.ts if common) ---
function parseDateString(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return date;
}

function formatDateToYYYYMMDD(date: Date): string {
  // Returns date in "YYYY-MM-DD" format in UTC to avoid timezone issues for date-only comparisons
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

function areDatesEqualYYYYMMDD(date1: Date, date2: Date): boolean {
    return formatDateToYYYYMMDD(date1) === formatDateToYYYYMMDD(date2);
}
// --- End Helper Date Utilities ---

// Declare collection prefix, use concept name
const PREFIX = "Accountability" + ".";

// Generic types of this concept
type User = ID;

// --- Types from concept specification ---

/**
 * An enumeration representing the type of sleep event.
 */
enum SleepEventType {
  BEDTIME = "BEDTIME",
  WAKETIME = "WAKETIME",
}

/**
 * An enumeration representing the frequency of reports.
 */
enum FrequencyType {
  Immediate = "Immediate",
  Daily = "Daily",
  Weekly = "Weekly",
}

/**
 * Alias for SleepEventType for clarity as per notifyTypes in the state.
 */
type FailureType = SleepEventType;

/**
 * Represents a partnership between two users, including notification preferences.
 * Corresponds to "a set of Partnerships" in the concept state.
 */
interface PartnershipDoc {
  _id: ID; // Unique ID for this partnership record
  user: User;
  partner: User;
  notifyTypes: FailureType[]; // e.g., {MissedBedtime, MissedWake}. Stored as array.
  reportFrequency: FrequencyType; // Immediate | Daily | Weekly
  lastReportDate: Date | null; // Null initially as per concept spec
}

/**
 * Represents a recorded adherence failure for a user.
 * Corresponds to "a set of AdherenceFailures" in the concept state.
 */
interface AdherenceFailureDoc {
  _id: ID; // Unique ID for this failure record
  failingUser: User;
  date: string; // Stored as a string (e.g., "YYYY-MM-DD")
  failType: SleepEventType;
  reported: boolean;
}

/**
 * Accountability concept
 * purpose: Record accountability partnerships between users and their associated notification preferences.
 * The concept does not send messages or access contact information — it only stores user IDs and preference data.
 */
export default class AccountabilityConcept {
  partnerships: Collection<PartnershipDoc>;
  adherenceFailures: Collection<AdherenceFailureDoc>;

  constructor(private readonly db: Db) {
    this.partnerships = this.db.collection(PREFIX + "partnerships");
    this.adherenceFailures = this.db.collection(PREFIX + "adherenceFailures");
    this._initializeIndexes();
  }

  /**
   * Private method to initialize MongoDB indexes.
   * Ensures uniqueness and efficient querying.
   */
  private async _initializeIndexes() {
    // Ensures that a user can only have one partnership with a specific partner.
    await this.partnerships.createIndex({ user: 1, partner: 1 }, { unique: true });

    // Ensures that a specific adherence failure type for a user on a given date is recorded only once.
    await this.adherenceFailures.createIndex({ failingUser: 1, date: 1, failType: 1 }, { unique: true });
  }

  /**
   * addPartner action
   * @param {object} params - The action parameters.
   * @param {User} params.user - The ID of the user initiating the partnership.
   * @param {User} params.partner - The ID of the user being partnered with.
   * @returns {Promise<Empty | { error: string }>} An empty object on success, or an error object.
   *
   * requires: user and partner are not equal and (user, partner) is not in Partnerships
   * effects: add (user, partner, notifyTypes, reportFrequency, null) to Partnerships
   */
  async addPartner({ user, partner }: { user: User; partner: User }): Promise<Empty | { error: string }> {
    // Requires check 1: user and partner are not equal
    if (user === partner) {
      return { error: "A user cannot partner with themselves." };
    }

    // Requires check 2: (user, partner) is not in Partnerships
    // The unique index handles this implicitly, but checking beforehand provides a cleaner error message.
    const existingPartnership = await this.partnerships.findOne({ user, partner });
    if (existingPartnership) {
      return { error: `Partnership already exists between user '${user}' and partner '${partner}'.` };
    }

    // Effects: add new partnership to Partnerships
    const newPartnership: PartnershipDoc = {
      _id: freshID(), // Generate a unique ID for this partnership document
      user,
      partner,
      notifyTypes: [], // Default: no specific failure types to notify for initially
      reportFrequency: FrequencyType.Immediate, // Default: immediate reporting
      lastReportDate: null, // As specified in the concept
    };

    try {
      await this.partnerships.insertOne(newPartnership);
      return {}; // Success
    } catch (e: any) {
      // In case of a rare race condition or other database error not caught by findOne.
      if (e.code === 11000) { // MongoDB duplicate key error code
         return { error: `Partnership already exists between user '${user}' and partner '${partner}'.` };
      }
      return { error: `Failed to add partner: ${e.message}` };
    }
  }

  /**
   * removePartner action
   * @param {object} params - The action parameters.
   * @param {User} params.user - The ID of the user whose partnership is being removed.
   * @param {User} params.partner - The ID of the partner to be removed.
   * @returns {Promise<Empty | { error: string }>} An empty object on success, or an error object.
   *
   * requires: (user, partner) in Partnerships
   * effects: remove the pairing user, partner in Partnerships
   */
  async removePartner({ user, partner }: { user: User; partner: User }): Promise<Empty | { error: string }> {
    // Requires check: (user, partner) in Partnerships
    const deleteResult = await this.partnerships.deleteOne({ user, partner });

    // If no document was deleted, it means the partnership did not exist.
    if (deleteResult.deletedCount === 0) {
      return { error: `Partnership between user '${user}' and partner '${partner}' not found.` };
    }
    // Effects: partnership removed
    return {}; // Success
  }

  /**
   * updatePreferences action
   * @param {object} params - The action parameters.
   * @param {User} params.user - The ID of the user.
   * @param {User} params.partner - The ID of the partner.
   * @param {FailureType[]} params.notifyTypes - The new set of failure types to notify for.
   * @param {FrequencyType} params.reportFrequency - The new reporting frequency.
   * @returns {Promise<Empty | { error: string }>} An empty object on success, or an error object.
   *
   * requires: (user, partner) in Partnerships
   * effects: modify that partnership’s notifyTypes and reportFrequency
   */
  async updatePreferences(
    { user, partner, notifyTypes, reportFrequency }: {
      user: User;
      partner: User;
      notifyTypes: FailureType[];
      reportFrequency: FrequencyType;
    },
  ): Promise<Empty | { error: string }> {
    // Requires check: (user, partner) in Partnerships
    const updateResult = await this.partnerships.updateOne(
      { user, partner },
      { $set: { notifyTypes, reportFrequency } },
    );

    if (updateResult.matchedCount === 0) {
      return { error: `Partnership between user '${user}' and partner '${partner}' not found.` };
    }
    // Effects: partnership's preferences modified
    return {}; // Success
  }

  /**
   * recordFailure action
   * @param {object} params - The action parameters.
   * @param {User} params.user - The ID of the failing user.
   * @param {string} params.date - The date of the failure (YYYY-MM-DD string).
   * @param {SleepEventType} params.failureType - The type of sleep event failure.
   * @returns {Promise<Empty | { error: string }>} An empty object on success, or an error object.
   *
   * effects: if user is not in AdherenceFailures add (user, date, failureType) to AdherenceFailures
   *          (Interpreted as: if (failingUser, date, failType) combination is not already present)
   */
  async recordFailure(
    { user, date, failureType }: { user: User; date: string; failureType: SleepEventType },
  ): Promise<Empty | { error: string }> {
    try {
      // Validate date string
      parseDateString(date);

      const newFailure: AdherenceFailureDoc = {
        _id: freshID(),
        failingUser: user,
        date: date, // Store as string as per spec
        failType: failureType,
        reported: false, // Initially false
      };
      await this.adherenceFailures.insertOne(newFailure);
      // Effects: new adherence failure added
      return {}; // Success
    } catch (e: any) {
      if (e.code === 11000) { // MongoDB duplicate key error (if the specific failure already exists)
        return { error: `Adherence failure for user '${user}' on '${date}' with type '${failureType}' already recorded.` };
      }
      return { error: `Failed to record failure: ${e.message}` };
    }
  }

  /**
   * reportAllFailuresFromStartToEnd action
   * @param {object} params - The action parameters.
   * @param {User} params.user - The ID of the user whose failures are being reported.
   * @param {string} params.startDate - The start date for the report (YYYY-MM-DD string).
   * @param {string} params.endDate - The end date for the report (YYYY-MM-DD string).
   * @returns {Promise<{ report: string, failureIds: ID[] } | { error: string }>} A report string and list of failure IDs on success, or an error object.
   *
   * requires:
   *   startDate <= endDate
   *   `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
   * effects:
   *   parse startDate and endDate into Date objects
   *   Find all adherence failures for the given user whose date is between startDate and endDate (inclusive) and whose reported flag is false.
   *   if there are any failures:
   *     Return a string listing each failure’s type and date in readable form and the IDs of the failures.
   *   otherwise:
   *     Return the string "No adherence failures for this period." and an empty array of IDs.
   */
  async reportAllFailuresFromStartToEnd(
    { user, startDate, endDate }: { user: User; startDate: string; endDate: string },
  ): Promise<{ report: string; failureIds: ID[] } | { error: string }> {
    try {
      const start = parseDateString(startDate);
      const end = parseDateString(endDate);

      // Requires check 1: startDate <= endDate
      if (start.getTime() > end.getTime()) {
        return { error: "Start date cannot be after end date." };
      }

      // Find failures for the user within the date range, not yet reported
      const failures = await this.adherenceFailures.find({
        failingUser: user,
        date: {
          $gte: formatDateToYYYYMMDD(start),
          $lte: formatDateToYYYYMMDD(end),
        },
        reported: false,
      }).toArray();

      if (failures.length === 0) {
        return { report: "No adherence failures for this period.", failureIds: [] };
      }

      const failureList = failures
        .map((f) => `- ${f.failType} on ${f.date}`)
        .join("\n");

      // Effects: Returns formatted report and IDs of failures
      return { report: `Adherence Failures:\n${failureList}`, failureIds: failures.map(f => f._id) };
    } catch (e: any) {
      return { error: `Failed to generate report: ${e.message}` };
    }
  }

  /**
   * generateNotificationMessage action
   * @param {object} params - The action parameters.
   * @param {User} params.user - The ID of the user for whom notifications are generated.
   * @param {string} params.date - The current date (YYYY-MM-DD string) for context.
   * @returns {Promise<{ message: string } | { error: string }>} A notification message string on success, or an error object.
   *
   * requires: The user has at least one partnership recorded in Partnerships.
   * effects:
   *   For each partnership where the user is the main user:
   *     If reportFrequency is Immediate:
   *       • Let message = reportAllFailuresFromStartToEnd(user, date, date)
   *       • If message does not equal "No adherence failures for this period.":
   *         * Mark those failures as reported.
   *         * Return "Immediate Alert for " + partner + ": " + message
   *     If reportFrequency is Daily:
   *       • Let previousDay = date minus one day
   *       • If the last report date is before the current date:
   *         \- Let message = reportAllFailuresFromStartToEnd(user, previousDay, previousDay)
   *         \- Mark those failures as reported.
   *         \- Update the last report date to the current date.
   *         \- Return "Daily Report for " + partner + ":\n" + message
   *     If reportFrequency is Weekly:
   *       • If seven or more days have passed since the last report date:
   *         \- Let startDate = date minus seven days
   *         \- Let message = reportAllFailuresFromStartToEnd(user, startDate, date)
   *         \- Mark those failures as reported.
   *         \- Update the last report date to the current date.
   *         \- Return "Weekly Report for " + partner + ":\n" + message
   *   If there are no new messages to send, return an empty string.
   */
  async generateNotificationMessage(
    { user, date }: { user: User; date: string },
  ): Promise<{ message: string } | { error: string }> {
    try {
      const currentDate = parseDateString(date);
      const currentDateFormatted = formatDateToYYYYMMDD(currentDate);

      const partnerships = await this.partnerships.find({ user: user }).toArray();

      // Requires check: The user has at least one partnership recorded in Partnerships.
      if (partnerships.length === 0) {
        return { error: `User '${user}' has no recorded partnerships.` };
      }

      for (const partnership of partnerships) {
        const partner = partnership.partner;
        let reportDetails: { report: string; failureIds: ID[] } | { error: string };
        let generatedMessage: string | null = null;
        let shouldUpdatePartnershipLastReportDate = false;

        if (partnership.reportFrequency === FrequencyType.Immediate) {
          reportDetails = await this.reportAllFailuresFromStartToEnd({ user, startDate: currentDateFormatted, endDate: currentDateFormatted });
          if ("report" in reportDetails && reportDetails.report !== "No adherence failures for this period.") {
            generatedMessage = `Immediate Alert for ${partner}: ${reportDetails.report}`;
            shouldUpdatePartnershipLastReportDate = true; // Update if an immediate message is generated
          }
        } else if (partnership.reportFrequency === FrequencyType.Daily) {
          const previousDay = addDays(currentDate, -1);
          const previousDayFormatted = formatDateToYYYYMMDD(previousDay);

          const shouldReportDaily = !partnership.lastReportDate ||
                                    (partnership.lastReportDate.getTime() < currentDate.getTime() &&
                                    !areDatesEqualYYYYMMDD(partnership.lastReportDate, currentDate));

          if (shouldReportDaily) {
            reportDetails = await this.reportAllFailuresFromStartToEnd({ user, startDate: previousDayFormatted, endDate: previousDayFormatted });
            shouldUpdatePartnershipLastReportDate = true; // Always update lastReportDate if daily period is checked
            if ("report" in reportDetails && reportDetails.report !== "No adherence failures for this period.") {
              generatedMessage = `Daily Report for ${partner}:\n${reportDetails.report}`;
            }
          }
        } else if (partnership.reportFrequency === FrequencyType.Weekly) {
          const sevenDaysAgo = addDays(currentDate, -7);
          const shouldReportWeekly = !partnership.lastReportDate ||
                                     partnership.lastReportDate.getTime() <= sevenDaysAgo.getTime();

          if (shouldReportWeekly) {
            const startDateForWeekly = addDays(currentDate, -7);
            const startDateForWeeklyFormatted = formatDateToYYYYMMDD(startDateForWeekly);

            reportDetails = await this.reportAllFailuresFromStartToEnd({ user, startDate: startDateForWeeklyFormatted, endDate: currentDateFormatted });
            shouldUpdatePartnershipLastReportDate = true; // Always update lastReportDate if weekly period is checked
            if ("report" in reportDetails && reportDetails.report !== "No adherence failures for this period.") {
              generatedMessage = `Weekly Report for ${partner}:\n${reportDetails.report}`;
            }
          }
        }

        // Effects: Mark failures as reported if a message was generated and there were failures
        if (generatedMessage && "failureIds" in reportDetails && reportDetails.failureIds.length > 0) {
            await this.adherenceFailures.updateMany(
              { _id: { $in: reportDetails.failureIds } },
              { $set: { reported: true } },
            );
        }

        // Effects: Update lastReportDate for the partnership
        if (shouldUpdatePartnershipLastReportDate) {
           await this.partnerships.updateOne(
              { _id: partnership._id },
              { $set: { lastReportDate: currentDate } },
            );
        }

        // Return the first generated message encountered (as implied by spec's "Return X")
        if (generatedMessage) {
            return { message: generatedMessage };
        }
      }
      // Effects: If no new messages to send for any partnership, return an empty string
      return { message: "" };
    } catch (e: any) {
      return { error: `Failed to generate notification message: ${e.message}` };
    }
  }
}
```
