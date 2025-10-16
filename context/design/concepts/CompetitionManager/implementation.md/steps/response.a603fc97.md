---
timestamp: 'Wed Oct 15 2025 02:14:03 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_021403.0b6ab777.md]]'
content_id: a603fc9738a765c99652e9c840ebebaa76ddef406339d2cbf2fa1fd68b565893
---

# response:

```typescript
// file: src/CompetitionManager/CompetitionManagerConcept.ts

import { Collection, Db } from "npm:mongodb";
import { ID, Empty } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * @concept CompetitionManager [User]
 * @purpose manage multiple sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance
 *          over a defined time period and establishing a winner based off of scores. A key constraint is preventing users
 *          from joining overlapping active competitions.
 * @principle Users initiate competitions with one or more other users, specifying a start and end date. Throughout the
 *            competition duration, participants' sleep adherence events (bedtime and wake-up) are recorded. Each distinct
 *            daily event (bedtime/wake-up for a user within a competition) is recorded once, and only new events contribute
 *            to scoring. Based on the success or failure of these events, individual scores are accumulated. Upon the
 *            competition's conclusion, these scores are tallied, and a winner (or set of tied winners) is determined,
 *            with provisions for handling cases where all participants tie. During or after a competition, a ranked
 *            leaderboard can be generated, and participants can be removed from active competitions under certain conditions.
 */

// Declare collection prefix, use concept name
const PREFIX = "CompetitionManager" + ".";

// Generic type for User as per specification
type User = ID;
type CompetitionId = ID; // Unique identifier for a competition

/**
 * @typedef SleepEventType
 * An enumeration representing the type of sleep event.
 */
export enum SleepEventType {
  BEDTIME = "BEDTIME",
  WAKETIME = "WAKETIME",
}

/**
 * Helper to normalize a Date object to the start of the day (YYYY-MM-DD 00:00:00).
 * This is crucial for consistent daily event and competition date range comparisons.
 */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * @state
 * A set of Competitions with
 *   participants: a set of Users
 *   a `startDate` of type `Date`
 *   a `endDate` of type `Date`
 *   an active flag of type Boolean
 *   a winners a set of Users? (null until endCompetition establishes winner or if all participants tie for max score;
 *                            otherwise, a set of UserId's tied for the max score).
 */
interface Competition {
  _id: CompetitionId;
  participants: User[]; // Stored as an array, but conceptually a set
  startDate: Date;
  endDate: Date;
  active: boolean;
  winners: User[] | null;
}

/**
 * @state
 * a set of Scores with:
 *   u: a User
 *   competitionId: a CompetitionId (reference to Competition)
 *   a wakeUpScore Number
 *   a bedTimeScore Number
 */
interface Score {
  _id: ID; // Unique ID for each score entry
  u: User;
  competitionId: CompetitionId;
  wakeUpScore: number;
  bedTimeScore: number;
}

/**
 * @state
 * a set of DailyEvents where each daily event has a user, Competition, Date, eventType:SleepEventType, and success:boolean
 */
interface DailyEvent {
  _id: ID;
  userId: User;
  competitionId: CompetitionId;
  date: Date; // Normalized to start of day for uniqueness
  eventType: SleepEventType;
  success: boolean;
}

export default class CompetitionManagerConcept {
  competitions: Collection<Competition>;
  scores: Collection<Score>;
  dailyEvents: Collection<DailyEvent>;

  constructor(private readonly db: Db) {
    this.competitions = this.db.collection(PREFIX + "competitions");
    this.scores = this.db.collection(PREFIX + "scores");
    this.dailyEvents = this.db.collection(PREFIX + "dailyEvents");
  }

  /**
   * @action startCompetition
   * @purpose: To initiate and register a new sleep-adherence competition between a specified group of users for a defined duration.
   * @requires:
   *   `participants` must contain at least two distinct `User`s.
   *   `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
   *   The parsed `startDate` must logically precede or be equal to the parsed `endDate`.
   *   For each `userId` in `participants`, there must be no *active* competition that overlaps in time with the period `[parsedStartDate, parsedEndDate]`. (Upholds I2).
   * @effects:
   *   Parses `startDateStr` and `endDateStr` into `Date` objects: `newStartDate`, `newEndDate`.
   *   Generates a unique `CompetitionId` (`newCompetitionId`).
   *   Creates a `Competition` with `newCompetitionId`, `participants`, `newStartDate`, `newEndDate`, `active: true`, `winners: null`.
   *   Adds `c_new` to the `competitions` collection.
   *   For each `userId` in `participants`, creates a `Score` object with `userId`, `newCompetitionId`, and scores initialized to `0`.
   *   Adds `s_new` to the `scores` collection.
   *   Returns `newCompetitionId`.
   */
  async startCompetition(
    { participants, startDateStr, endDateStr }: {
      participants: User[];
      startDateStr: string;
      endDateStr: string;
    },
  ): Promise<{ competitionId: CompetitionId } | { error: string }> {
    // Requires: participants must contain at least two distinct User's
    if (!participants || new Set(participants).size < 2) {
      return { error: "Participants must contain at least two distinct users." };
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Requires: startDateStr and endDateStr must be valid date strings
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { error: "Invalid startDateStr or endDateStr." };
    }

    // Normalize dates to start of day for comparison, ignoring time components as per concept.
    const normalizedStartDate = startOfDay(startDate);
    const normalizedEndDate = startOfDay(endDate);

    // Requires: The parsed startDate must logically precede or be equal to the parsed endDate.
    if (normalizedStartDate > normalizedEndDate) {
      return { error: "Start date cannot be after end date." };
    }

    // Requires (I2): No overlapping active competitions for any participant
    const overlappingCompetitions = await this.competitions.find({
      active: true,
      participants: { $in: participants }, // Any new participant is in this active competition
      startDate: { $lte: normalizedEndDate }, // existing_start <= new_end
      endDate: { $gte: normalizedStartDate }, // existing_end >= new_start
    }).toArray();

    if (overlappingCompetitions.length > 0) {
      for (const participantId of participants) {
        for (const existingComp of overlappingCompetitions) {
          if (existingComp.participants.includes(participantId)) {
            // Further check if the specific participant and competition dates truly overlap
            const existingCompNormalizedStart = startOfDay(existingComp.startDate);
            const existingCompNormalizedEnd = startOfDay(existingComp.endDate);

            if (
              existingCompNormalizedStart <= normalizedEndDate &&
              existingCompNormalizedEnd >= normalizedStartDate
            ) {
              return {
                error: `User ${participantId} is already in an active competition (${existingComp._id}) that overlaps with the proposed dates.`,
              };
            }
          }
        }
      }
    }

    const competitionId = freshID();

    // Effects: creates a Competition
    const newCompetition: Competition = {
      _id: competitionId,
      participants: [...new Set(participants)], // Ensure distinct participants
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      active: true,
      winners: null,
    };
    await this.competitions.insertOne(newCompetition);

    // Effects: creates a Score for each User in participants
    const scoreDocuments: Score[] = participants.map((u) => ({
      _id: freshID(),
      u: u,
      competitionId: competitionId,
      wakeUpScore: 0,
      bedTimeScore: 0,
    }));
    await this.scores.insertMany(scoreDocuments);

    // Effects: returns the id of the Competition
    return { competitionId: competitionId };
  }

  /**
   * @action recordStat
   * @purpose: To record a specific sleep adherence event (bedtime or wake-up success/failure) for a user on a given day,
   *           updating scores in relevant active competitions only if the event is new for that day/type/competition.
   * @requires:
   *   `userId` is a valid `User`.
   *   `dateStr` is a valid date string parseable into a `Date`.
   *   `eventType` is either `SleepEventType.BEDTIME` or `SleepEventType.WAKETIME`.
   *   The `userId` must be a participant in at least one *active* `Competition` whose date range includes the parsed `eventDate`.
   *   For each relevant active competition, there must NOT already exist a `DailyEvent` for this `userId`, `competitionId`, `eventDate`, and `eventType`. (Upholds I6 and the score update logic).
   * @effects:
   *   Parses `dateStr` into a `Date` object: `eventDate`.
   *   Calculates `scoreChange`: if `success` is `true`, `scoreChange = 1`; if `success` is `false`, `scoreChange = -1`.
   *   Identifies all `Competition c` where `c.active` is `true`, `userId` is in `c.participants`, and `c.startDate <= eventDate <= c.endDate`.
   *   For each such identified `competition c`:
   *     If no `DailyEvent` exists for `userId`, `c.id`, `eventDate` (normalized), and `eventType`:
   *       Creates and adds a new `DailyEvent` to `dailyEvents`.
   *       Retrieves `Score s` for `userId` and `c.id` and updates `s.bedTimeScore` or `s.wakeUpScore` by `scoreChange`.
   *     If a `DailyEvent` already exists, no changes are made for that competition (idempotency).
   */
  async recordStat(
    { userId, dateStr, eventType, success }: {
      userId: User;
      dateStr: string;
      eventType: SleepEventType;
      success: boolean;
    },
  ): Promise<Empty | { error: string }> {
    const eventDate = new Date(dateStr);

    // Requires: dateStr is a valid date string
    if (isNaN(eventDate.getTime())) {
      return { error: "Invalid dateStr." };
    }

    // Requires: eventType is valid
    if (!Object.values(SleepEventType).includes(eventType)) {
      return { error: "Invalid eventType." };
    }

    const scoreChange = success ? 1 : -1;
    const normalizedEventDate = startOfDay(eventDate);

    // Find all active competitions where userId is a participant and eventDate is within range
    const relevantCompetitions = await this.competitions.find({
      active: true,
      participants: userId,
      startDate: { $lte: normalizedEventDate },
      endDate: { $gte: normalizedEventDate },
    }).toArray();

    // Requires: userId is a part of at least one active Competition
    if (relevantCompetitions.length === 0) {
      return { error: `User ${userId} is not part of any active competition for date ${dateStr}.` };
    }

    const updatePromises = relevantCompetitions.map(async (comp) => {
      // Requires (I6): Check if DailyEvent already exists
      const existingDailyEvent = await this.dailyEvents.findOne({
        userId: userId,
        competitionId: comp._id,
        date: normalizedEventDate,
        eventType: eventType,
      });

      if (!existingDailyEvent) {
        // Effects: Create a new DailyEvent
        const newDailyEvent: DailyEvent = {
          _id: freshID(),
          userId: userId,
          competitionId: comp._id,
          date: normalizedEventDate,
          eventType: eventType,
          success: success,
        };
        await this.dailyEvents.insertOne(newDailyEvent);

        // Effects: Update score
        const updateField = eventType === SleepEventType.WAKETIME ? "wakeUpScore" : "bedTimeScore";
        await this.scores.updateOne(
          { u: userId, competitionId: comp._id },
          { $inc: { [updateField]: scoreChange } },
        );
      }
      // If DailyEvent exists, do nothing as per specification (score only updated for initially non-existent events)
    });

    await Promise.all(updatePromises);

    return {};
  }

  /**
   * @action endCompetition
   * @purpose: To conclude a specified competition, determine its winner(s) based on accumulated scores, and mark it as inactive.
   * @requires:
   *   `competitionId` must refer to an existing `Competition c`.
   *   `c.active` must be `true`.
   *   The current date must be greater than or equal to `c.endDate`.
   * @effects:
   *   Retrieves `Competition c` using `competitionId`.
   *   Calculates total scores for all participants.
   *   Determines `potentialWinners` (all users with the greatest sum of scores).
   *   If `potentialWinners` is empty (no scores) or `potentialWinners` includes *all* participants: `c.winners` is set to `null`.
   *   Otherwise (a subset of participants tied for max score): `c.winners` is set to the set of `potentialWinners`.
   *   Sets `c.active` to `false`.
   *   Returns the determined `winners` set (or `null`).
   */
  async endCompetition(
    { competitionId }: { competitionId: CompetitionId },
  ): Promise<{ winners: User[] | null } | { error: string }> {
    const competition = await this.competitions.findOne({ _id: competitionId });

    if (!competition) {
      return { error: `Competition with ID ${competitionId} not found.` };
    }

    // Requires: c.active must be true
    if (!competition.active) {
      return { error: `Competition ${competitionId} is not active.` };
    }

    const currentDate = new Date();
    // Normalize current date and competition endDate to start of day for comparison
    const normalizedCurrentDate = startOfDay(currentDate);
    const normalizedEndDate = startOfDay(competition.endDate);

    // Requires: current date is greater than or equal to the endDate of Competition c
    if (normalizedCurrentDate < normalizedEndDate) {
      return { error: `Competition ${competitionId} has not ended yet. End date is ${competition.endDate.toDateString()}.` };
    }

    // Get all scores for this competition
    const competitionScores = await this.scores.find({ competitionId: competitionId }).toArray();

    let maxTotalScore = -Infinity;
    const userTotalScores: Map<User, number> = new Map();

    // Calculate total scores for each participant
    for (const score of competitionScores) {
      const totalScore = score.wakeUpScore + score.bedTimeScore;
      userTotalScores.set(score.u, totalScore);
      if (totalScore > maxTotalScore) {
        maxTotalScore = totalScore;
      }
    }

    const potentialWinners: User[] = [];
    if (maxTotalScore !== -Infinity) { // Only consider winners if at least one score was recorded
      for (const [user, totalScore] of userTotalScores.entries()) {
        if (totalScore === maxTotalScore) {
          potentialWinners.push(user);
        }
      }
    }

    let finalWinners: User[] | null = null;
    if (potentialWinners.length > 0 && potentialWinners.length < competition.participants.length) {
      // A subset of participants tied for the highest score
      finalWinners = potentialWinners;
    } else {
      // No winners (e.g., no scores recorded, or all participants tied for the highest score)
      finalWinners = null;
    }

    // Effects: change active flag to false for competition c, and set winners state
    await this.competitions.updateOne(
      { _id: competitionId },
      { $set: { active: false, winners: finalWinners } },
    );

    // Effects: return the User IDs of the winners
    return { winners: finalWinners };
  }

  /**
   * @action getLeaderboard
   * @purpose: To provide a ranked list of participants and their current total scores for a given competition, ordered from highest to lowest score.
   * @requires:
   *   `competitionId` must refer to an existing `Competition c` in `competitions`.
   * @effects:
   *   Retrieves the `Competition c` identified by `competitionId`.
   *   Creates a temporary list `leaderboardEntries` of `{userId: UserId, totalScore: Number}`.
   *   For each `userId` in `c.participants`:
   *     Retrieves the `Score s` for `userId` and `c.id` from `competitionScores`.
   *     Calculates `totalScore = s.wakeUpScore + s.bedTimeScore`.
   *     Adds `{userId, totalScore}` to `leaderboardEntries`.
   *   Sorts `leaderboardEntries` in descending order by `totalScore`.
   *   Iterates through sorted `leaderboardEntries` to assign `position`s, handling ties correctly.
   *   Returns `rankedLeaderboard`.
   */
  async getLeaderboard(
    { competitionId }: { competitionId: CompetitionId },
  ): Promise<{ leaderboard: Array<{ position: number; userId: User; totalScore: number }> } | { error: string }> {
    const competition = await this.competitions.findOne({ _id: competitionId });

    // Requires: competitionId must refer to an existing Competition c
    if (!competition) {
      return { error: `Competition with ID ${competitionId} not found.` };
    }

    const competitionScores = await this.scores.find({ competitionId: competitionId }).toArray();

    type LeaderboardEntry = { userId: User; totalScore: number };
    const leaderboardEntries: LeaderboardEntry[] = [];

    // Effects: For each userId in c.participants, calculate totalScore and add to leaderboardEntries
    for (const userId of competition.participants) {
      const score = competitionScores.find((s) => s.u === userId);
      // I4 (Complete Score Coverage) ensures score exists for all participants
      const totalScore = (score?.wakeUpScore || 0) + (score?.bedTimeScore || 0);
      leaderboardEntries.push({ userId, totalScore });
    }

    // Effects: Sorts leaderboardEntries in descending order by totalScore
    leaderboardEntries.sort((a, b) => b.totalScore - a.totalScore);

    const rankedLeaderboard: Array<{ position: number; userId: User; totalScore: number }> = [];
    let currentRank = 1;
    let previousScore: number | null = null;

    // Effects: Iterates through sorted leaderboardEntries to assign positions, handling ties
    for (let i = 0; i < leaderboardEntries.length; i++) {
      const entry = leaderboardEntries[i];
      if (previousScore === null || entry.totalScore < previousScore) {
        currentRank = i + 1;
      }
      rankedLeaderboard.push({
        position: currentRank,
        userId: entry.userId,
        totalScore: entry.totalScore,
      });
      previousScore = entry.totalScore;
    }

    return { leaderboard: rankedLeaderboard };
  }

  /**
   * @action removeParticipant
   * @purpose: To remove a specific user from an active competition and clear their associated scores and daily events.
   *           If the competition no longer has a viable number of participants, it is deactivated.
   * @requires:
   *   `competitionId` must refer to an existing `Competition c`.
   *   `c.active` must be `true`.
   *   `userId` must be a member of `c.participants`.
   *   `c.participants.size()` must be greater than 2 (ensuring that after `userId` is removed, at least two participants remain in the competition).
   * @effects:
   *   Retrieves the `Competition c` identified by `competitionId`.
   *   Removes `userId` from `c.participants`.
   *   Removes the `Score s` for `userId` and `competitionId` from `scores`.
   *   Removes all `DailyEvent` records for `userId` and `competitionId` from `dailyEvents`.
   *   If `c.participants.size()` becomes less than `2` (after removal):
   *     Sets `c.active` to `false`.
   *     Sets `c.winners` to `null` (as the competition is no longer viable).
   */
  async removeParticipant(
    { competitionId, userId }: { competitionId: CompetitionId; userId: User },
  ): Promise<Empty | { error: string }> {
    const competition = await this.competitions.findOne({ _id: competitionId });

    // Requires: competitionId must refer to an existing Competition c
    if (!competition) {
      return { error: `Competition with ID ${competitionId} not found.` };
    }

    // Requires: c.active must be true
    if (!competition.active) {
      return { error: `Competition ${competitionId} is not active.` };
    }

    // Requires: userId must be a member of c.participants
    if (!competition.participants.includes(userId)) {
      return { error: `User ${userId} is not a participant in competition ${competitionId}.` };
    }

    // Requires: c.participants.size() must be greater than 2
    // This implies that after removal, there will be at least 2 participants remaining.
    if (competition.participants.length <= 2) {
      return {
        error:
          `Cannot remove participant. Competition ${competitionId} must have more than 2 participants to allow removal without deactivation.`,
      };
    }

    // Effects: Removes userId from c.participants
    const updatedParticipants = competition.participants.filter((p) => p !== userId);
    await this.competitions.updateOne(
      { _id: competitionId },
      { $set: { participants: updatedParticipants } },
    );

    // Effects: Removes the Score s for userId and competitionId
    await this.scores.deleteOne({ competitionId: competitionId, u: userId });

    // Effects: Removes all DailyEvent records for userId and competitionId
    await this.dailyEvents.deleteMany({ competitionId: competitionId, userId: userId });

    // Check if competition needs to be deactivated after removal
    if (updatedParticipants.length < 2) {
      await this.competitions.updateOne(
        { _id: competitionId },
        { $set: { active: false, winners: null } },
      );
    }

    return {};
  }
}
```
