---
timestamp: 'Mon Oct 20 2025 01:43:55 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_014355.fa9ebe04.md]]'
content_id: 2d7f3788d91f988b533343c0e43ef183b404a07cb9d24971c911d7a21d74e6c6
---

# implement: CompetitionManager

```typescript
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

 *   participants: a set of Users

 *   a `startDate` of type `Date`

 *   a `endDate` of type `Date`

 *   an active flag of type Boolean

 *   a winners a set of Users? (will be set to null until endCompetition establishes winner or remain null if tie among a subset of participants, otherwise if smaller subset of participants have the max score set it to the set of those winners)

 */

interface Competition {

  _id: CompetitionId;

  participants: User[];

  startDate: Date; // Stored as ISODate in MongoDB, time components normalized to 00:00:00.000Z

  endDate: Date; // Stored as ISODate in MongoDB, time components normalized to 00:00:00.000Z

  active: boolean;

  winners: User[] | null;

}

  

/**

 * @state a set of Scores with:

 *   u: a User

 *   competition: a CompetitionId

 *   a wakeUpScore Number

 *   a bedTimeScore Number

 */

interface Score {

  _id: ID; // Unique ID for each score document (not necessarily competitionId + userId)

  u: User;

  competition: CompetitionId;

  wakeUpScore: number;

  bedTimeScore: number;

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

   *   - participants must contain at least two distinct User's

   *   - `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.

   *   - The parsed `startDate` must logically precede or be equal to the parsed `endDate`.

   * @effects:

   *   - Parses `startDateStr` and `endDateStr` into `Date` objects: `startDate`, `endDate`.

   *   - creates a Competition with participates, startDate, endDate, a true active flag, a null winner.

   *   - Also, it creates a Score for each User in participants with wakeUpScore and bedTimeScore of zero and it is associated with the created competition.

   *   - returns the id of the Competition

   */

  async startCompetition(

    { participants, startDateStr, endDateStr }: {

      participants: User[];

      startDateStr: string;

      endDateStr: string;

    },

  ): Promise<{ competitionId: CompetitionId } | { error: string }> {

    // 1. Validate inputs

    if (!participants || participants.length < 2) {

      return { error: "Competition must have at least two participants." };

    }

    if (new Set(participants).size !== participants.length) {

      return { error: "Participants must be distinct." };

    }

  

    let startDate: Date;

    let endDate: Date;

    try {

      startDate = new Date(startDateStr);

      endDate = new Date(endDateStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {

        return { error: "Invalid date strings provided." };

      }

    } catch (_e) {

      return { error: "Invalid date strings provided." };

    }

  

    // Normalize dates to start of day for comparison, as time components are ignored.

    startDate.setUTCHours(0, 0, 0, 0);

    endDate.setUTCHours(0, 0, 0, 0);

  

    if (startDate > endDate) {

      return { error: "Start date cannot be after end date." };

    }

  

    // 2. Create Competition

    const competitionId = freshID() as CompetitionId;

    const newCompetition: Competition = {

      _id: competitionId,

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

    }));

  

    await this.scores.insertMany(scoreDocuments);

  

    return { competitionId };

  }

  

  /**

   * @action recordStat

   * @requires:

   *   - u is a part of at least one active Competition

   *   - `dateStr` is a valid date string parseable into a `Date`.

   *   - `eventType` is either `SleepEventType.BEDTIME` or `SleepEventType.WAKETIME`.

   * @effects:

   *   - Parses `dateStr` into a `Date` object: `eventDate`.

   *   - Calculates `scoreChange`: if `success` is `true`, `scoreChange = 1`; if `success` is `false`, `scoreChange = -1`.

   *   - for all the active competitions that u is apart of and where date is in the range of the start and end dates of the competition, and u is a member of

   *     update the wakeUpScore+=scoreChange if event is "bedtime" otherwise update the bedTimeScore+=scoreChange

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

    let eventDate: Date;

    try {

      eventDate = new Date(dateStr);

      if (isNaN(eventDate.getTime())) {

        return { error: "Invalid date string provided for event." };

      }

    } catch (_e) {

      return { error: "Invalid date string provided for event." };

    }

    eventDate.setUTCHours(0, 0, 0, 0); // Normalize to date only

  

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

  

    // 2. Calculate score change

    const scoreChange = success ? 1 : -1;

  

    // 3. Update scores for matching competitions

    const updatePromises = activeCompetitions.map((comp) => {

      const scoreFieldName = eventType === SleepEventType.BEDTIME

        ? "bedTimeScore"

        : "wakeUpScore";

      return this.scores.updateOne(

        { u, competition: comp._id },

        { $inc: { [scoreFieldName]: scoreChange } },

      );

    });

  

    await Promise.all(updatePromises);

  

    return {};

  }

  

  /**

   * @action endCompetition

   * @requires:

   *   - current date is greater than or equal to the endDate of Competition c

   *   - c.active must be true

   * @effects:

   *   - return the User IDs of the users in competition c with the greatest sum of wakeUpScore + bedTimeScore and set this ID to the winner state (if tie among all participants keep winner as null)

   *   - also change active flag to false for competition c

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

  

    const currentDate = new Date();

    currentDate.setUTCHours(0, 0, 0, 0); // Normalize to date only

  

    if (currentDate < competition.endDate) {

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

  

    let maxScore = -Infinity;

    const userTotalScores: Map<User, number> = new Map();

  

    for (const score of participantScores) {

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

   *   - Retrieves the `Competition c` identified by `competitionId`.

   *   - Creates a temporary list `leaderboardEntries` of `{userId: UserId, totalScore: Number}`.

   *   - For each `userId` in `c.participants`:

   *     - Retrieves the `CompetitionScore cs` for `userId` and `c.id` from `competitionScores`. (Guaranteed to exist by `I3`).

   *     - Calculates `totalScore = cs.wakeUpScore + cs.bedTimeScore`.

   *     - Adds `{userId, totalScore}` to `leaderboardEntries`.

   *   - Sorts `leaderboardEntries` in descending order by `totalScore`.

   *   - Initializes `rankedLeaderboard: List<{position: Number, userId: UserId, totalScore: Number}>`.

   *   - Initializes `currentPosition = 1`, `lastScore = null`.

   *   - Iterates through sorted `leaderboardEntries` with their 0-based index:

   *     - Let `currentEntry = leaderboardEntries[index]`.

   *     - If `lastScore` is `null` or `currentEntry.totalScore < lastScore`:

   *       `currentPosition = index + 1`.

   *     - Adds `{position: currentPosition, userId: currentEntry.userId, totalScore: currentEntry.totalScore}` to `rankedLeaderboard`.

   *     - `lastScore = currentEntry.totalScore`.

   *   - Returns `rankedLeaderboard` stringified.

   */

  async _getLeaderboard(

    { competitionId }: { competitionId: CompetitionId },

  ): Promise<string>

  {

    const competition = await this.competitions.findOne({ _id: competitionId });

  

    if (!competition) {

      return JSON.stringify({ error: `Competition with ID ${competitionId} not found.` });

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

  

    return JSON.stringify(rankedLeaderboard);

  }

  

  /**

   * @action removeParticipant

   * @purpose: To remove a specific user from an active competition and clear their associated scores. If the competition no longer has a viable number of participants, it is deactivated.

   * @requires:

   *   - `competitionId` must refer to an existing `Competition c` in `competitions`.

   *   - `c.active` must be `true`.

   *   - `userId` must be a member of `c.participants`.

   *   - `c.participants.size()` must be greater than 1 (to ensure the removal doesn't lead to an invalid state, *before* considering the 'less than 2' rule for deactivation). A competition with only one participant effectively doesn't exist.

   * @effects:

   *   - Retrieves the `Competition c` identified by `competitionId`.

   *   - Removes `userId` from `c.participants`.

   *   - Removes the `CompetitionScore cs` where `cs.competitionId == competitionId` and `cs.userId == userId` from `competitionScores`.

   *   - If `c.participants.size() < 2` (i.e., fewer than two participants remain after removal):

   *     - Sets `c.active` to `false`.

   *     - Sets `c.winners` to `null` (as the competition is no longer viable and cannot have meaningful winners).

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

    // Requirement: `c.participants.size()` must be greater than 1 *before* removal.

    // If there's only 1 participant, removal would make the competition invalid/empty.

    if (competition.participants.length <= 1) {

      return {

        error:

          `Cannot remove participant from competition ${competitionId}: it must have more than 1 participant.`,

      };

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

}
```
