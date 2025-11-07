import { Collection, Db, ObjectId } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "CompetitionManager" + ".";

// Generic types of this concept
type User = ID;
type CompetitionId = ID;

/**
 * @type SleepEventType
 * An enumeration representing the type of sleep event.
 * BEDTIME: Represents the event of going to bed.
 * WAKETIME: Represents the event of waking up.
 */
enum SleepEventType {
  BEDTIME = "BEDTIME",
  WAKETIME = "WAKETIME",
}

/**
 * @state A set of Competitions with
 *   participants: a set of Users
 *   a `startDate` of type `Date`
 *   a `endDate` of type `Date`
 *   an active flag of type Boolean
 *   a winners a set of Users? (will be set to null until endCompetition establishes winner or remain null if tie among a subset of participants, otherwise if smaller subset of participants have the max score set it to the set of those winners)
 */
interface Competition {
  _id: CompetitionId;
  name: string;
  participants: User[];
  startDate: Date; // Stored as ISODate in MongoDB, time components normalized to 00:00:00.000Z
  endDate: Date; // Stored as ISODate in MongoDB, time components normalized to 00:00:00.000Z
  active: boolean;
  winners: User[] | null;
}

/**
 * @state a set of Scores with:
 *   u: a User
 *   competition: a CompetitionId
 *   a wakeUpScore Number
 *   a bedTimeScore Number
 *   a reportedBedtimeDates string[] (array of date strings in YYYY-MM-DD format)
 *   a reportedWakeUpDates string[] (array of date strings in YYYY-MM-DD format)
 */
interface Score {
  _id: ID; // Unique ID for each score document (not necessarily competitionId + userId)
  u: User;
  competition: CompetitionId;
  wakeUpScore: number;
  bedTimeScore: number;
  reportedBedtimeDates: string[]; // Array of date strings in YYYY-MM-DD format
  reportedWakeUpDates: string[]; // Array of date strings in YYYY-MM-DD format
}

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
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * @concept CompetitionManager [User]
 * @purpose manage multiple sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores.
 * @principle Users initiate competitions with one or more other users, specifying a start and end date. Throughout the competition duration, participants' sleep adherence events (bedtime and wake-up) are recorded. Based on the success or failure of these events, individual scores are accumulated. Upon the competition's conclusion, these scores are tallied, and a winner (or set of tied winners) is determined, with provisions for handling cases where all participants tie. During or after a competition, a ranked leaderboard can be generated, and participants can be removed from active competitions under certain conditions.
 */
export default class CompetitionManagerConcept {
  competitions: Collection<Competition>;
  scores: Collection<Score>;

  constructor(private readonly db: Db) {
    this.competitions = this.db.collection(PREFIX + "competitions");
    this.scores = this.db.collection(PREFIX + "scores");
  }

  /**
   * @action startCompetition
   * @requires:
   *   - participants must contain at least two distinct User's
   *   - `startDateStr` and `endDateStr` must be valid date strings in YYYY-MM-DD format, parseable into `Date` objects
   *   - The parsed `startDate` must logically precede or be equal to the parsed `endDate`.
   * @effects:
   *   - Parses `startDateStr` and `endDateStr` into `Date` objects normalized to start of day: `startDate`, `endDate`.
   *   - creates a Competition with participants, startDate, endDate, a true active flag, a null winner.
   *   - Also, it creates a Score for each User in participants with wakeUpScore and bedTimeScore of zero and it is associated with the created competition.
   *   - returns the id of the Competition
   */
  async startCompetition(
    { name, participants, startDateStr, endDateStr }: {
      name:string;
      participants: User[];
      startDateStr: string;
      endDateStr: string;
    },
  ): Promise<{ competitionId: CompetitionId } | { error: string }> {
    // 1. Validate inputs
    if (!name || name.trim() === "") {
      return { error: "Competition name must be a non-empty string." };
    }
    if (!participants || participants.length < 2) {
      return { error: "Competition must have at least two participants." };
    }
    if (new Set(participants).size !== participants.length) {
      return { error: "Participants must be distinct." };
    }

    const startDate = parseDateString(startDateStr);
    const endDate = parseDateString(endDateStr);

    if (!startDate || !endDate) {
      return { error: "Invalid date strings provided." };
    }

    if (startDate > endDate) {
      return { error: "Start date cannot be after end date." };
    }

    // 2. Create Competition
    const competitionId = freshID() as CompetitionId;
    const newCompetition: Competition = {
      _id: competitionId,
      name: name.trim(),
      participants,
      startDate,
      endDate,
      active: true,
      winners: null,
    };

    await this.competitions.insertOne(newCompetition);

    // 3. Create Scores for each participant
    const scoreDocuments: Score[] = participants.map((u) => ({
      _id: freshID(), // A unique ID for each score document
      u,
      competition: competitionId,
      wakeUpScore: 0,
      bedTimeScore: 0,
      reportedBedtimeDates: [], // Initialize empty array for bedtime dates
      reportedWakeUpDates: [], // Initialize empty array for wake-up dates
    }));

    await this.scores.insertMany(scoreDocuments);

    return { competitionId };
  }

  /**
   * @action recordStat
   * @requires:
   *   - u is a part of at least one active Competition
   *   - `dateStr` is a valid date string in YYYY-MM-DD format, parseable into a `Date`.
   *   - `eventType` is either `SleepEventType.BEDTIME` or `SleepEventType.WAKETIME`.
   * @effects:
   *   - Parses `dateStr` into a `Date` object normalized to start of day: `eventDate`.
   *   - For all active competitions that u is part of where the eventDate is within the competition's date range:
   *     - If `success` is true: increments the appropriate score (wakeUpScore for WAKETIME, bedTimeScore for BEDTIME)
   *     - If `success` is false: no change to score
   *     - Adds the date (as string in YYYY-MM-DD format) to reportedBedtimeDates array if event is BEDTIME and date string is not already in the array
   *     - Adds the date (as string in YYYY-MM-DD format) to reportedWakeUpDates array if event is WAKETIME and date string is not already in the array
   */
  async recordStat(
    { u, dateStr, eventType, success }: {
      u: User;
      dateStr: string;
      eventType: SleepEventType;
      success: boolean;
    },
  ): Promise<Empty | { error: string }> {
    // 1. Validate inputs
    const eventDate = parseDateString(dateStr);

    if (!eventDate) {
      return { error: "Invalid date string provided for event." };
    }

    if (
      eventType !== SleepEventType.BEDTIME && eventType !== SleepEventType.WAKETIME
    ) {
      return { error: "Invalid sleep event type." };
    }

    // Find all active competitions `u` is part of, and the eventDate is within the competition's range
    const activeCompetitions = await this.competitions.find({
      active: true,
      participants: u,
      startDate: { $lte: eventDate },
      endDate: { $gte: eventDate },
    }).toArray();

    if (activeCompetitions.length === 0) {
      return {
        error:
          "User is not part of any active competition for the specified date, or the event date is outside the competition range.",
      };
    }

    // 2. Update scores and add dates to the appropriate arrays for matching competitions
    // For each competition, get the score document, check if dateStr is in the array, and update accordingly
    const updatePromises = activeCompetitions.map(async (comp) => {
      const scoreFieldName = eventType === SleepEventType.BEDTIME
        ? "bedTimeScore"
        : "wakeUpScore";
      const dateArrayFieldName = eventType === SleepEventType.BEDTIME
        ? "reportedBedtimeDates"
        : "reportedWakeUpDates";

      // Get the current score document
      const scoreDoc = await this.scores.findOne({ u, competition: comp._id });
      if (!scoreDoc) {
        return; // Skip if score document doesn't exist
      }

      // Determine if we need to add the date and/or update the score
      // Convert eventDate to YYYY-MM-DD string format for storage
      // Use UTC methods since eventDate is normalized to UTC midnight
      const dateString = `${eventDate.getUTCFullYear()}-${String(eventDate.getUTCMonth() + 1).padStart(2, '0')}-${String(eventDate.getUTCDate()).padStart(2, '0')}`;

      // Check if the date string already exists in the array
      const dateArrayToCheck = eventType === SleepEventType.BEDTIME
        ? scoreDoc.reportedBedtimeDates
        : scoreDoc.reportedWakeUpDates;

      const dateExists = dateArrayToCheck.includes(dateString);

      // Only add date if it's not already in the array
      const needsDateUpdate = !dateExists;

      // Only update score if it's a success
      const needsScoreUpdate = success;

      // Update the score document only if something needs to change
      if (needsDateUpdate || needsScoreUpdate) {
        const updateOperations: any = {};

        // Increment score if success
        if (needsScoreUpdate) {
          updateOperations.$inc = { [scoreFieldName]: 1 };
        }

        // Add date string to array if not already present
        if (needsDateUpdate) {
          updateOperations.$push = { [dateArrayFieldName]: dateString };
        }

        await this.scores.updateOne(
          { u, competition: comp._id },
          updateOperations,
        );
      }
    });

    await Promise.all(updatePromises);

    return {};
  }

  /**
   * @action decrementScore
   * @requires:
   *   - u is a part of at least one active Competition
   *   - `dateStr` is a valid date string in YYYY-MM-DD format, parseable into a `Date`.
   *   - `eventType` is either `SleepEventType.BEDTIME` or `SleepEventType.WAKETIME`.
   * @effects:
   *   - Parses `dateStr` into a `Date` object normalized to start of day: `eventDate`.
   *   - For all active competitions that u is part of where the eventDate is within the competition's date range:
   *     - Decrements the appropriate score (wakeUpScore for WAKETIME, bedTimeScore for BEDTIME) by 1
   */
  async decrementScore(
    { u, dateStr, eventType }: {
      u: User;
      dateStr: string;
      eventType: SleepEventType;
    },
  ): Promise<Empty | { error: string }> {
    // 1. Validate inputs
    const eventDate = parseDateString(dateStr);

    if (!eventDate) {
      return { error: "Invalid date string provided for event." };
    }

    if (
      eventType !== SleepEventType.BEDTIME && eventType !== SleepEventType.WAKETIME
    ) {
      return { error: "Invalid sleep event type." };
    }

    // Find all active competitions `u` is part of, and the eventDate is within the competition's range
    const activeCompetitions = await this.competitions.find({
      active: true,
      participants: u,
      startDate: { $lte: eventDate },
      endDate: { $gte: eventDate },
    }).toArray();

    if (activeCompetitions.length === 0) {
      return {
        error:
          "User is not part of any active competition for the specified date, or the event date is outside the competition range.",
      };
    }

    // 2. Decrement scores for matching competitions
    const scoreFieldName = eventType === SleepEventType.BEDTIME
      ? "bedTimeScore"
      : "wakeUpScore";

    const updatePromises = activeCompetitions.map(async (comp) => {
      const scoreDoc = await this.scores.findOne({ u, competition: comp._id });
      if (!scoreDoc) {
        return; // Skip if score document doesn't exist
      }

      // Decrement score by 1
      await this.scores.updateOne(
        { u, competition: comp._id },
        { $inc: { [scoreFieldName]: -1 } },
      );
    });

    await Promise.all(updatePromises);

    return {};
  }

  /**
   * @action endCompetition
   * @requires:
   *   - current date is greater than or equal to the endDate of Competition c
   *   - c.active must be true
   * @effects:
   *   - Calculates the total number of days in the competition (endDate - startDate + 1)
   *   - For each participant's Score, applies penalties based on missing reports:
   *     - Decrements bedTimeScore by (totalDays - length of reportedBedtimeDates)
   *     - Decrements wakeUpScore by (totalDays - length of reportedWakeUpDates)
   *   - Returns the User IDs of the users in competition c with the greatest adjusted sum of wakeUpScore + bedTimeScore
   *   - Sets winners to the IDs of users with highest scores, or null if all participants tie
   *   - Changes active flag to false for competition c
   */
  async endCompetition(
    { competitionId }: { competitionId: CompetitionId },
  ): Promise<{ winners: User[] | null } | { error: string }> {
    const competition = await this.competitions.findOne({ _id: competitionId });

    if (!competition) {
      return { error: `Competition with ID ${competitionId} not found.` };
    }
    if (!competition.active) {
      return { error: `Competition ${competitionId} is not active.` };
    }

    // Normalize current date to UTC midnight for consistent comparison with competition.endDate
    const currentDate = new Date();
    const currentDateUTC = new Date(Date.UTC(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate()
    ));

    if (currentDateUTC < competition.endDate) {
      return { error: `Competition ${competitionId} has not ended yet.` };
    }

    // Calculate total scores for all participants
    const participantScores = await this.scores.find({
      competition: competitionId,
    }).toArray();

    if (participantScores.length === 0) {
      // Per I3, this case should ideally not happen if participants exist,
      // but as a safety, if no scores are found, treat as no winners.
      await this.competitions.updateOne(
        { _id: competitionId },
        { $set: { active: false, winners: null } },
      );
      return { winners: null };
    }

    // Calculate total number of days in the competition (inclusive of start and end dates)
    const startDate = new Date(competition.startDate);
    const endDate = new Date(competition.endDate);
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Apply penalties for missing reports BEFORE tallying scores
    for (const score of participantScores) {
      // Calculate missing reports for bedtime and wake-up
      const missingBedtimeReports = totalDays - score.reportedBedtimeDates.length;
      const missingWakeUpReports = totalDays - score.reportedWakeUpDates.length;

      // Apply penalties by decrementing scores for missing reports
      if (missingBedtimeReports > 0) {
        score.bedTimeScore -= missingBedtimeReports;
      }
      if (missingWakeUpReports > 0) {
        score.wakeUpScore -= missingWakeUpReports;
      }
    }

    // Persist the penalized scores to the database
    const updatePromises = participantScores.map((score) => {
      const missingBedtimeReports = totalDays - score.reportedBedtimeDates.length;
      const missingWakeUpReports = totalDays - score.reportedWakeUpDates.length;

      const updateOperations: any = {};
      if (missingBedtimeReports > 0) {
        updateOperations.bedTimeScore = -missingBedtimeReports;
      }
      if (missingWakeUpReports > 0) {
        updateOperations.wakeUpScore = -missingWakeUpReports;
      }

      // Only update if there are penalties to apply
      if (missingBedtimeReports > 0 || missingWakeUpReports > 0) {
        return this.scores.updateOne(
          { _id: score._id },
          { $inc: updateOperations }
        );
      }
      return Promise.resolve();
    });

    await Promise.all(updatePromises);

    // NOW tally the scores (with penalties already applied)
    let maxScore = -Infinity;
    const userTotalScores: Map<User, number> = new Map();

    for (const score of participantScores) {
      // Sum the penalized scores (penalties were applied above)
      const totalScore = score.wakeUpScore + score.bedTimeScore;
      userTotalScores.set(score.u, totalScore);
      if (totalScore > maxScore) {
        maxScore = totalScore;
      }
    }

    let potentialWinners: User[] = [];
    for (const [user, totalScore] of userTotalScores.entries()) {
      if (totalScore === maxScore) {
        potentialWinners.push(user);
      }
    }

    // If all participants have the same max score (a tie among all), winners should be null.
    // Otherwise, the subset with the max score are the winners.
    const allParticipantsTied = potentialWinners.length ===
        competition.participants.length && potentialWinners.length > 0;
    const finalWinners = allParticipantsTied ? null : (potentialWinners.length > 0
      ? potentialWinners
      : null);

    // Update competition state
    await this.competitions.updateOne(
      { _id: competitionId },
      { $set: { active: false, winners: finalWinners } },
    );

    return { winners: finalWinners };
  }

  /**
   * @query _getLeaderboard
   * @purpose: To provide a ranked list of participants and their current total scores for a given competition, ordered from highest to lowest score.
   * @requires: `competitionId` must refer to an existing `Competition c` in `competitions`.
   * @effects:
   *   - Retrieves the `Competition c` identified by `competitionId`.
   *   - Creates a temporary list `leaderboardEntries` of `{userId: UserId, totalScore: Number}`.
   *   - For each `userId` in `c.participants`:
   *     - Retrieves the `CompetitionScore cs` for `userId` and `c.id` from `competitionScores`. (Guaranteed to exist by `I3`).
   *     - Calculates `totalScore = cs.wakeUpScore + cs.bedTimeScore`.
   *     - Adds `{userId, totalScore}` to `leaderboardEntries`.
   *   - Sorts `leaderboardEntries` in descending order by `totalScore`.
   *   - Initializes `rankedLeaderboard: List<{position: Number, userId: UserId, totalScore: Number}>`.
   *   - Initializes `currentPosition = 1`, `lastScore = null`.
   *   - Iterates through sorted `leaderboardEntries` with their 0-based index:
   *     - Let `currentEntry = leaderboardEntries[index]`.
   *     - If `lastScore` is `null` or `currentEntry.totalScore < lastScore`:
   *       `currentPosition = index + 1`.
   *     - Adds `{position: currentPosition, userId: currentEntry.userId, totalScore: currentEntry.totalScore}` to `rankedLeaderboard`.
   *     - `lastScore = currentEntry.totalScore`.
   *   - Returns `rankedLeaderboard` stringified.
   */
  async _getLeaderboard(
    { competitionId }: { competitionId: CompetitionId },
  ): Promise<Array<{ entry: { position: number; userId: User; totalScore: number } }>>
  {
    const competition = await this.competitions.findOne({ _id: competitionId });

    if (!competition) {
      return [];  // Return empty list if competition not found
    }

    const participantScores = await this.scores.find({
      competition: competitionId,
    }).toArray();

    const userTotalScores: Map<User, number> = new Map();
    // Populate scores from DB, ensuring I3 (all participants have score entries)
    for (const score of participantScores) {
      userTotalScores.set(score.u, score.wakeUpScore + score.bedTimeScore);
    }

    // Create leaderboard entries, defaulting to 0 if a participant mysteriously lacks a score entry
    const leaderboardEntries: { userId: User; totalScore: number }[] =
      competition.participants.map((u) => ({
        userId: u,
        totalScore: userTotalScores.get(u) || 0,
      }));

    // Sort entries by totalScore in descending order
    leaderboardEntries.sort((a, b) => b.totalScore - a.totalScore);

    // Assign positions, handling ties
    const rankedLeaderboard: {
      position: number;
      userId: User;
      totalScore: number;
    }[] = [];
    let currentPosition = 1;
    let lastScore: number | null = null;

    for (let i = 0; i < leaderboardEntries.length; i++) {
      const currentEntry = leaderboardEntries[i];
      if (lastScore === null || currentEntry.totalScore < lastScore) {
        currentPosition = i + 1;
      }
      rankedLeaderboard.push({
        position: currentPosition,
        userId: currentEntry.userId,
        totalScore: currentEntry.totalScore,
      });
      lastScore = currentEntry.totalScore;
    }

    // Return in query-friendly shape for sync engine: one frame per entry
    return rankedLeaderboard.map((e) => ({ entry: e }));
  }

  /**
   * @action removeParticipant
   * @purpose: To remove a specific user from an active competition and clear their associated scores. If the competition no longer has a viable number of participants, it is deactivated.
   * @requires:
   *   - `competitionId` must refer to an existing `Competition c` in `competitions`.
   *   - `c.active` must be `true`.
   *   - `userId` must be a member of `c.participants`.
   *   - `c.participants.size()` must be greater than 1 (to ensure the removal doesn't lead to an invalid state, *before* considering the 'less than 2' rule for deactivation). A competition with only one participant effectively doesn't exist.
   * @effects:
   *   - Retrieves the `Competition c` identified by `competitionId`.
   *   - Removes `userId` from `c.participants`.
   *   - Removes the `CompetitionScore cs` where `cs.competitionId == competitionId` and `cs.userId == userId` from `competitionScores`.
   *   - If `c.participants.size() < 2` (i.e., fewer than two participants remain after removal):
   *     - Sets `c.active` to `false`.
   *     - Sets `c.winners` to `null` (as the competition is no longer viable and cannot have meaningful winners).
   */
  async removeParticipant(
    { competitionId, userId }: { competitionId: CompetitionId; userId: User },
  ): Promise<Empty | { error: string }> {
    const competition = await this.competitions.findOne({ _id: competitionId });

    if (!competition) {
      return { error: `Competition with ID ${competitionId} not found.` };
    }
    if (!competition.active) {
      return { error: `Competition ${competitionId} is not active.` };
    }
    if (!competition.participants.includes(userId)) {
      return { error: `User ${userId} is not a participant in competition ${competitionId}.` };
    }

    // Remove user from participants list
    const updatedParticipants = competition.participants.filter((p) =>
      p !== userId
    );

    // Remove score entry for the user from this competition
    await this.scores.deleteOne({ u: userId, competition: competitionId });

    // Check if competition needs to be deactivated due to insufficient participants
    if (updatedParticipants.length < 2) {
      await this.competitions.updateOne(
        { _id: competitionId },
        {
          $set: {
            participants: updatedParticipants,
            active: false,
            winners: null,
          },
        },
      );
    } else {
      await this.competitions.updateOne(
        { _id: competitionId },
        { $set: { participants: updatedParticipants } },
      );
    }

    return {};
  }

  async _getCompetitionsForUser(
    { user }: { user: User },
  ): Promise<Array<{ competition: Competition }>> {
    try {
      console.log("[_getCompetitionsForUser] input user:", user);
      const competitions = await this.competitions
        .find({ participants: user, active: true })
        .toArray();
      console.log("[_getCompetitionsForUser] found competitions:", competitions.length);
      if (competitions.length > 0) {
        console.log("[_getCompetitionsForUser] sample competition:", competitions[0]);
      }
      // Return in query-friendly shape for sync engine: one frame per record
      return competitions.map((c) => ({ competition: c }));
    } catch (e) {
      console.error("[_getCompetitionsForUser] error:", e);
      return [];
    }
  }

  /**
   * @query _getReportedDates
   * @purpose: To retrieve the list of reported dates for a user in a competition for a specific event type.
   * @requires:
   *   - `competitionId` must refer to an existing `Competition c` in `competitions`.
   *   - `userId` must be a member of `c.participants`.
   * @effects:
   *   - Returns the list of dates from reportedBedtimeDates for the Score with (u:userId, competition:competitionId) if eventType==SleepEventType.BEDTIME
   *   - Returns the list of dates from reportedWakeUpDates for the Score with (u:userId, competition:competitionId) if eventType==SleepEventType.WAKETIME
   *   - Returns an error if competition doesn't exist or user is not a participant
   */
  async _getReportedDates(
    { competitionId, userId, eventType }: {
      competitionId: CompetitionId;
      userId: User;
      eventType: SleepEventType;
    },
  ): Promise<string[]> {
    // Validate eventType
    if (eventType !== SleepEventType.BEDTIME && eventType !== SleepEventType.WAKETIME) {
      return []; // Invalid event type
    }

    // Get the competition
    const competition = await this.competitions.findOne({ _id: competitionId });
    if (!competition) {
      return []; // Competition not found
    }

    // Validate that user is a participant
    if (!competition.participants.includes(userId)) {
      return []; // User is not a participant
    }

    // Get the score document for this user and competition
    const score = await this.scores.findOne({
      u: userId,
      competition: competitionId,
    });

    if (!score) {
      return []; // Score not found
    }

    // Return the appropriate dates array based on event type
    if (eventType === SleepEventType.BEDTIME) {
      return score.reportedBedtimeDates;
    } else {
      return score.reportedWakeUpDates;
    }
  }
}
