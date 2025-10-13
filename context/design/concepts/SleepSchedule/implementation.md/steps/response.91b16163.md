---
timestamp: 'Sun Oct 12 2025 16:15:58 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251012_161558.390900f5.md]]'
content_id: 91b1616324311ee23031f11847a3715e94bdcf073379412fdafd51243f9d06b5
---

# response:

```file: src/SleepSchedule/SleepScheduleConcept.ts
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "SleepSchedule" + ".";

// Generic type of this concept
type User = ID;

/**
 * a set of UserSchedules with
 *   a user User                   // The ID of the user
 *   a bedtime String              // e.g., "22:30" (HH:MM format)
 *   a wakeTime String             // e.g., "07:00" (HH:MM format)
 *   a notificationEnabled Boolean = false // Whether notifications for this schedule are active
 */
interface UserSchedules { // Renamed from UserSchedule to UserSchedules as per "a set of UserSchedules"
  _id: User; // The 'user' ID is used as the document _id to ensure one schedule per user
  bedtime: string;
  wakeTime: string;
  notificationEnabled: boolean;
}

/**
 * a set of SleepSessions with
 *   a user User                   // The ID of the user who had this session
 *   a startTime String            // ISO DateTime string, e.g., "2023-10-27T22:00:00Z"
 *   a endTime String              // ISO DateTime string, e.g., "2023-10-28T06:30:00Z"
 */
interface SleepSessions { // Renamed from SleepSession to SleepSessions as per "a set of SleepSessions"
  _id: ID; // Unique ID for each sleep session
  user: User;
  startTime: string;
  endTime: string;
}

/**
 * concept SleepSchedule [User]
 * purpose associate desired sleep and wake times with a user, and track actual sleep sessions to promote consistent sleep habits
 * principle after a user sets a recurring bedtime and wake-up time, and records their actual sleep sessions, they can retrieve their schedule and historical sleep data to observe consistency
 */
export default class SleepScheduleConcept {
  // Collections for the concept's state
  // Collection names directly reflect the "set of X" in the concept state
  userSchedules: Collection<UserSchedules>;
  sleepSessions: Collection<SleepSessions>;

  constructor(private readonly db: Db) {
    this.userSchedules = this.db.collection(PREFIX + "userSchedules");
    this.sleepSessions = this.db.collection(PREFIX + "sleepSessions");
  }

  /**
   * setSchedule (user: User, bedtime: String, wakeTime: String, notificationEnabled: Boolean)
   *   requires 'bedtime' and 'wakeTime' are valid HH:MM strings
   *   effects
   *     if a schedule for 'user' exists:
   *       update its 'bedtime', 'wakeTime', and 'notificationEnabled' fields
   *     else:
   *       create a new schedule for 'user' with the given 'bedtime', 'wakeTime', and 'notificationEnabled'
   */
  async setSchedule(
    { user, bedtime, wakeTime, notificationEnabled }: {
      user: User;
      bedtime: string;
      wakeTime: string;
      notificationEnabled: boolean;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: 'bedtime' and 'wakeTime' are valid HH:MM strings
    const hhMmRegex = /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/;
    if (!hhMmRegex.test(bedtime) || !hhMmRegex.test(wakeTime)) {
      return { error: "Invalid bedtime or wakeTime format. Expected HH:MM (e.g., '22:30')." };
    }

    const result = await this.userSchedules.updateOne(
      { _id: user }, // Use user ID as the document ID for the UserSchedules collection
      { $set: { bedtime, wakeTime, notificationEnabled } },
      { upsert: true }, // Create if not exists, update if exists
    );

    if (result.acknowledged) {
      return {};
    } else {
      return { error: "Failed to set or update sleep schedule." };
    }
  }

  /**
   * recordSleep (user: User, startTime: String, endTime: String): (sessionId: ID)
   *   requires 'startTime' represents a time before 'endTime'; 'startTime' and 'endTime' are valid ISO DateTime strings
   *   effects create a new SleepSessions for 'user' with a fresh ID, and the given 'startTime' and 'endTime'
   */
  async recordSleep(
    { user, startTime, endTime }: {
      user: User;
      startTime: string;
      endTime: string;
    },
  ): Promise<{ sessionId: ID } | { error: string }> {
    // Precondition: 'startTime' and 'endTime' are valid ISO DateTime strings
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return { error: "Invalid startTime or endTime format. Expected ISO DateTime string (e.g., '2023-10-27T22:00:00Z')." };
    }
    // Precondition: 'startTime' must be strictly before 'endTime'
    if (startDateTime >= endDateTime) {
      return { error: "startTime must be strictly before endTime." };
    }

    const sessionId = freshID();
    const result = await this.sleepSessions.insertOne({
      _id: sessionId,
      user,
      startTime,
      endTime,
    });
    if (result.acknowledged) {
      return { sessionId };
    } else {
      return { error: "Failed to record sleep session." };
    }
  }

  /**
   * removeSleepSession (user: User, sessionId: ID)
   *   requires a SleepSessions with '_id' equal to 'sessionId' exists and its 'user' matches the input 'user'
   *   effects delete the SleepSessions with '_id' equal to 'sessionId'
   */
  async removeSleepSession(
    { user, sessionId }: { user: User; sessionId: ID },
  ): Promise<Empty | { error: string }> {
    // Precondition: a SleepSessions with '_id' equal to 'sessionId' exists and its 'user' matches the input 'user'
    const result = await this.sleepSessions.deleteOne({ _id: sessionId, user });

    if (result.deletedCount === 1) {
      return {};
    } else {
      // This means either the session didn't exist or didn't belong to the user
      return { error: "Sleep session not found or does not belong to the specified user." };
    }
  }

  /**
   * toggleNotifications (user: User, enable: Boolean)
   *   requires a schedule for 'user' exists
   *   effects update the 'notificationEnabled' field of 'user''s schedule to 'enable'
   */
  async toggleNotifications(
    { user, enable }: { user: User; enable: boolean },
  ): Promise<Empty | { error: string }> {
    const result = await this.userSchedules.updateOne(
      { _id: user },
      { $set: { notificationEnabled: enable } },
    );

    // Precondition: a schedule for 'user' exists
    if (result.matchedCount === 0) {
      return { error: "User schedule not found. A schedule must be set before toggling notifications." };
    }
    return {};
  }

  /**
   * system checkScheduleAdherence (user: User): (deviationHours: Number)
   *   requires a schedule for 'user' exists and there are recent sleep sessions (e.g., last 7 days) for 'user'
   *   effects
   *     calculate the average absolute deviation of 'user''s recent actual sleep start times from their scheduled bedtime,
   *     considering a 24-hour cycle to find the shortest time difference.
   *     return 'deviationHours' representing this average deviation in hours.
   *     (This system action could be triggered periodically to assess user adherence.)
   *
   * Note: This calculation assumes all times are relative to a single day for simplicity in HH:MM comparison.
   * A more robust solution might handle timezones and potential cross-midnight schedules differently.
   */
  async checkScheduleAdherence(
    { user }: { user: User },
  ): Promise<{ deviationHours: number } | { error: string }> {
    // Precondition: a schedule for 'user' exists
    const schedule = await this.userSchedules.findOne({ _id: user });
    if (!schedule) {
      return { error: "User schedule not found. Please set a schedule first." };
    }

    // Precondition: there are recent sleep sessions for 'user' (e.g., last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSessions = await this.sleepSessions.find({
      user,
      startTime: { $gte: sevenDaysAgo.toISOString() },
    }).toArray();

    if (recentSessions.length === 0) {
      return { error: "No recent sleep sessions found for the user in the last 7 days to check adherence." };
    }

    let totalDeviationMinutes = 0;
    const [scheduledBedtimeHour, scheduledBedtimeMinute] = schedule.bedtime.split(':').map(Number);
    // Convert scheduled bedtime to minutes from midnight (00:00)
    const scheduledBedtimeInMinutes = scheduledBedtimeHour * 60 + scheduledBedtimeMinute;

    for (const session of recentSessions) {
      const actualStart = new Date(session.startTime);
      // Convert actual sleep start time to minutes from midnight
      const actualStartInMinutes = actualStart.getHours() * 60 + actualStart.getMinutes();

      let diff = actualStartInMinutes - scheduledBedtimeInMinutes;

      // Adjust 'diff' to find the shortest time difference across a 24-hour cycle.
      // For example, 23:00 (scheduled) vs 01:00 (actual) should be 2 hours, not 22 hours.
      if (diff > 12 * 60) { // If the difference is greater than 12 hours (720 minutes), it's shorter the other way around the clock
        diff -= 24 * 60;
      } else if (diff < -12 * 60) { // If the difference is less than -12 hours, it's shorter the other way
        diff += 24 * 60;
      }

      totalDeviationMinutes += Math.abs(diff);
    }

    const averageDeviationMinutes = totalDeviationMinutes / recentSessions.length;
    const deviationHours = averageDeviationMinutes / 60;

    return { deviationHours: parseFloat(deviationHours.toFixed(2)) };
  }

  // Queries

  /**
   * _getSchedule (user: User): (bedtime: String, wakeTime: String, notificationEnabled: Boolean)
   *   effects return the 'bedtime', 'wakeTime', and 'notificationEnabled' from the UserSchedules for 'user'
   */
  async _getSchedule(
    { user }: { user: User },
  ): Promise<
    { bedtime: string; wakeTime: string; notificationEnabled: boolean } | {
      error: string;
    }
  > {
    const schedule = await this.userSchedules.findOne({ _id: user });
    if (!schedule) {
      return { error: "User schedule not found." };
    }
    return {
      bedtime: schedule.bedtime,
      wakeTime: schedule.wakeTime,
      notificationEnabled: schedule.notificationEnabled,
    };
  }

  /**
   * _getSleepSessions (user: User, startDate: String, endDate: String): (sessions: SleepSessions[])
   *   effects return all SleepSessions for 'user' where 'startTime' is between 'startDate' and 'endDate' (inclusive)
   */
  async _getSleepSessions(
    { user, startDate, endDate }: { user: User; startDate: string; endDate: string },
  ): Promise<{ sessions: SleepSessions[] } | { error: string }> {
    // Validate ISO date strings
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return { error: "Invalid startDate or endDate format. Expected ISO DateTime string." };
    }
    // Validate startDate <= endDate
    if (startDateTime > endDateTime) {
      return { error: "startDate must be before or equal to endDate." };
    }

    // MongoDB query to find sessions where startTime is between startDate and endDate (inclusive)
    const sessions = await this.sleepSessions.find({
      user,
      startTime: { $gte: startDate, $lte: endDate },
    }).toArray();

    return { sessions };
  }

  /**
   * _calculateAverageSleep (user: User, startDate: String, endDate: String): (averageHours: Number)
   *   effects
   *     calculate the total duration of sleep from all SleepSessions for 'user' between 'startDate' and 'endDate'
   *     divide by the number of sessions in that period to get the average sleep duration in hours
   *     return 'averageHours'
   */
  async _calculateAverageSleep(
    { user, startDate, endDate }: { user: User; startDate: string; endDate: string },
  ): Promise<{ averageHours: number } | { error: string }> {
    // Leverage _getSleepSessions to apply validation and fetch data
    const sessionsResult = await this._getSleepSessions({ user, startDate, endDate });
    if ("error" in sessionsResult) {
      return sessionsResult; // Propagate error from _getSleepSessions
    }
    const sessions = sessionsResult.sessions;

    if (sessions.length === 0) {
      return { averageHours: 0 }; // No sessions means 0 average sleep
    }

    let totalDurationMs = 0;
    for (const session of sessions) {
      const start = new Date(session.startTime);
      const end = new Date(session.endTime);
      totalDurationMs += end.getTime() - start.getTime(); // Duration in milliseconds
    }

    const totalDurationHours = totalDurationMs / (1000 * 60 * 60); // Convert milliseconds to hours
    const averageHours = totalDurationHours / sessions.length;

    return { averageHours: parseFloat(averageHours.toFixed(2)) }; // Return average hours rounded to 2 decimal places
  }
}
```
