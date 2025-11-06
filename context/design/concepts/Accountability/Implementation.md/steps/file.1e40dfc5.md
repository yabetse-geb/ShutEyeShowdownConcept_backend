---
timestamp: 'Wed Nov 05 2025 19:01:41 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251105_190141.549e5ac4.md]]'
content_id: 1e40dfc5c293bc553417f213db5a1d6157b0b21071a41066b505e57a2fd46989
---

# file: src/Accountability/AccountabilityConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
import { ID, Empty } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * Concept: Accountability
 * Purpose: Enable structured accountability between users by recording their partnerships, adherence tracking preferences, and report frequencies.
 *          The concept maintains only the data required to support external systems in generating notifications or summaries—it does not send or deliver messages itself.
 *          By storing which types of adherence failures are monitored and when reports should be produced, the concept ensures that each partnership’s accountability data
 *          remains accurate, consistent, and ready for use by reporting or notification services.
 *
 * Principle: If a user establishes an accountability partnership with a partner and configures notification preferences (e.g., daily reports for specific adherence failures),
 *            and the user then records adherence failures, then the concept will, at the defined frequency, enable the generation of a report for the partner detailing
 *            those failures, marking them as reported and updating the partnership's last report date.
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
 *   lastReportDate:Date | null
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

/**
 * a set of Reports with
 *   a user: User
 *   a accountabilitySeeker: User
 *   a allReports: string[]
 */
interface Report {
  _id: ID;
  user: User;
  accountabilitySeeker: User;
  allReports: string[];
}

function parseDateString(dateString: string): Date | null {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return null;
  }
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
   * addPartner(user: User, partner: User, notifyTypes: FailureType[], reportFrequency: FrequencyType): Empty
   *
   * @requires user and partner are not equal and a partnership between them does not already exist.
   * @effects Creates a new partnership record and a corresponding report document for the partner.
   */
  async addPartner({
    user,
    partner,
    notifyTypes = [],
    reportFrequency = FrequencyType.IMMEDIATE,
  }: {
    user: User;
    partner: User;
    notifyTypes?: FailureType[];
    reportFrequency?: FrequencyType;
  }): Promise<Empty | { error: string }> {
    if (user === partner) {
      return { error: "User cannot partner with themselves." };
    }

    const existingPartnership = await this.partnerships.findOne({ user, partner });
    if (existingPartnership) {
      return { error: "Partnership already exists." };
    }

    const newPartnership: Partnership = {
      _id: freshID(),
      user,
      partner,
      notifyTypes,
      reportFrequency,
      lastReportDate: null,
    };

    try {
      await this.partnerships.insertOne(newPartnership);

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
   * removePartner(user: User, partner: User): Empty
   *
   * @requires A partnership from `user` to `partner` exists.
   * @effects Removes the partnership and the corresponding report document.
   */
  async removePartner({ user, partner }: { user: User; partner: User }): Promise<Empty | { error: string }> {
    try {
      const result = await this.partnerships.deleteOne({ user, partner });
      if (result.deletedCount === 0) {
        return { error: "Partnership does not exist." };
      }
      await this.reports.deleteOne({ user: partner, accountabilitySeeker: user });
      return {};
    } catch (e) {
      console.error("Error removing partner:", e);
      return { error: "Failed to remove partner due to database error." };
    }
  }

  /**
   * updatePreferences(user: User, partner: User, notifyTypes: FailureType[], reportFrequency: FrequencyType): Empty
   *
   * @requires A partnership from `user` to `partner` exists.
   * @effects Modifies the `notifyTypes` and `reportFrequency` for the specified partnership.
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
    try {
      const result = await this.partnerships.updateOne({ user, partner }, { $set: { notifyTypes, reportFrequency } });
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
   * recordFailure(user: User, date: string, failureType: SleepEventType): Empty
   *
   * @requires `date` is a valid date string, and the exact same failure has not been recorded previously.
   * @effects Creates a new adherence failure record for the user.
   */
  async recordFailure({ user, date: dateString, failureType }: { user: User; date: string; failureType: SleepEventType }): Promise<Empty | { error: string }> {
    const date = parseDateString(dateString);
    if (!date) {
      return { error: "Invalid date string provided." };
    }

    const existingFailure = await this.adherenceFailures.findOne({
      failingUser: user,
      date: date,
      failType: failureType,
    });

    if (existingFailure) {
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
   * reportAllFailuresFromStartToEnd(user: User, startDate: string, endDate: string): { message: string }
   *
   * @requires `startDate` and `endDate` are valid date strings, and `startDate` is not after `endDate`.
   * @effects Returns a formatted string of all unreported failures for a user within the given date range.
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
    const startDate = parseDateString(startDateString);
    const endDate = parseDateString(endDateString);

    if (!startDate || !endDate) {
      return { error: "Invalid start or end date string provided." };
    }

    if (startDate.getTime() > endDate.getTime()) {
      return { error: "Start date cannot be after end date." };
    }

    try {
      const dayAfterEndDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() + 1));
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

      const failureMessages = failures.map((failure) => `- Type: ${failure.failType}, Date: ${formatDateToString(failure.date)}`).join("\n");

      return { message: "Failures:\n" + failureMessages };
    } catch (e) {
      console.error("Error reporting failures:", e);
      return { error: "Failed to retrieve failures due to database error." };
    }
  }

  /**
   * updateReports(user: User, date: string): Empty
   *
   * @requires The user has at least one partnership, and `date` is a valid date string.
   * @effects Generates reports for partners based on their preferences, marks failures as reported,
   *          updates `lastReportDate` on partnerships, and appends report strings to the partner's report document.
   */
  async updateReports({ user, date: currentDateString }: { user: User; date: string }): Promise<Empty | { error: string }> {
    const currentDate = parseDateString(currentDateString);
    if (!currentDate) {
      return { error: "Invalid date string provided for current date." };
    }

    const partnerships = await this.partnerships.find({ user: user }).toArray();
    if (partnerships.length === 0) {
      return { error: "User has no recorded partnerships." };
    }

    for (const partnership of partnerships) {
      let message = "";
      let failuresToMarkReported: ID[] = [];

      const getAndMarkFailures = async (start: Date, endInclusive: Date) => {
        const endExclusive = new Date(Date.UTC(endInclusive.getUTCFullYear(), endInclusive.getUTCMonth(), endInclusive.getUTCDate() + 1));
        const failures = await this.adherenceFailures
          .find({
            failingUser: user,
            reported: false,
            failType: { $in: partnership.notifyTypes },
            date: { $gte: start, $lt: endExclusive },
          })
          .toArray();

        if (failures.length > 0) {
          failuresToMarkReported.push(...failures.map((f) => f._id));
          return "Failures:\n" + failures.map((failure) => `- Type: ${failure.failType}, Date: ${formatDateToString(failure.date)}`).join("\n");
        }
        return null;
      };

      let report: string | null = null;
      let shouldGenerateReport = false;

      if (partnership.reportFrequency === FrequencyType.IMMEDIATE) {
        report = await getAndMarkFailures(currentDate, currentDate);
        shouldGenerateReport = !!report;
      } else if (partnership.reportFrequency === FrequencyType.DAILY) {
        const lastReportDay = partnership.lastReportDate ? parseDateString(formatDateToString(partnership.lastReportDate)) : null;
        if (!lastReportDay || lastReportDay.getTime() < currentDate.getTime()) {
          const previousDay = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate() - 1));
          report = await getAndMarkFailures(previousDay, previousDay);
          shouldGenerateReport = true;
        }
      } else if (partnership.reportFrequency === FrequencyType.WEEKLY) {
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const lastReportTime = partnership.lastReportDate?.getTime() ?? 0;
        if (!lastReportTime || currentDate.getTime() - lastReportTime >= sevenDaysMs) {
          const sevenDaysAgo = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate() - 6));
          report = await getAndMarkFailures(sevenDaysAgo, currentDate);
          shouldGenerateReport = true;
        }
      }

      if (report) {
        message = `${partnership.reportFrequency} Report for ${user}:\n${report}`;
        await this.reports.updateOne({ user: partnership.partner, accountabilitySeeker: user }, { $push: { allReports: message } });
        await this.adherenceFailures.updateMany({ _id: { $in: failuresToMarkReported } }, { $set: { reported: true } });
        await this.partnerships.updateOne({ _id: partnership._id }, { $set: { lastReportDate: currentDate } });
      } else if (shouldGenerateReport) {
        // We checked for reports but found none; still update the date to prevent re-checking unnecessarily.
        await this.partnerships.updateOne({ _id: partnership._id }, { $set: { lastReportDate: currentDate } });
      }
    }
    return {};
  }

  /**
   * _getPartnerships(user: User): (partnerships: Partnership)[]
   *
   * @requires user exists
   * @effects returns all partnerships where the user is either the primary user or the partner.
   */
  async _getPartnerships({ user }: { user: User }): Promise<Partnership[]> {
    return this.partnerships
      .find({
        $or: [{ user: user }, { partner: user }],
      })
      .toArray();
  }

  /**
   * _getAccountabilitySeekersForUser(mentor: User): (user: User)[]
   *
   * @effects Returns a list of all users who have designated the `mentor` as their accountability partner.
   */
  async _getAccountabilitySeekersForUser({ mentor }: { mentor: User }): Promise<{ user: User }[]> {
    try {
      const partnerships = await this.partnerships
        .find({ partner: mentor })
        .project<{ user: User }>({ user: 1, _id: 0 })
        .toArray();
      return partnerships.map((p) => ({ user: p.user }));
    } catch (e) {
      return [];
    }
  }

  /**
   * _getAllReports(user: User, accountabilitySeeker: User): (report: string)[]
   *
   * @effects Returns all accumulated report strings for a specific partner (`user`) about an accountability seeker (`accountabilitySeeker`).
   */
  async _getAllReports({ user, accountabilitySeeker }: { user: User; accountabilitySeeker: User }): Promise<{ report: string }[]> {
    try {
      const result = await this.reports.findOne({ user, accountabilitySeeker });
      return result?.allReports?.map((r) => ({ report: r })) ?? [];
    } catch (e) {
      return [];
    }
  }
}
```
