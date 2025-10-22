---
timestamp: 'Mon Oct 20 2025 21:58:06 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_215806.519e17b4.md]]'
content_id: 628fda89876942d6203a188e0ff669f2d4e121b40efa5b0c8b46bac2be0fcc2b
---

# implement: CompetitionManager

```typescript
import { Collection, Db } from "npm:mongodb";
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
 *   a name String
 *   participants: a set of Users
 *   a `startDate` of type `Date`
 *   a `endDate` of type `Date`
 *   an active flag of type Boolean
 *   a winners a set of Users? (will be set to null until endCompetition establishes winner or remain null if tie among all participants, otherwise if smaller subset of participants have the max score set it to the set of those winners)
 */
interface Competition {
  _id: CompetitionId;
  name: string;
  participants: User[];
  startDate: Date; // Stored as ISODate in MongoDB
  endDate: Date; // Stored as ISODate in MongoDB
  active: boolean;
  winners: User[] | null;
}

/**
 * @state a set of Scores with:
 *   u: a User
 *   competition: a CompetitionId
 *   a wakeUpScore Number
 *   a bedTimeScore Number
 */
interface Score {
  _id: ID;
  u: User;
  competition: CompetitionId;
  wakeUpScore: number;
  bedTimeScore: number;
}

/**
 * @concept CompetitionManager [User]
 * @purpose manage multiple named sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores.
 * @principle Users initiate competitions with a name and one or more other users, specifying a start and end date. Throughout the competition duration, participants' sleep adherence events (bedtime and wake-up) are recorded. Based on the success or failure of these events, individual scores are accumulated. Upon the competition's conclusion, these scores are tallied, and a winner (or set of tied winners) is determined, with provisions for handling cases where all participants tie. During or after a competition, a ranked leaderboard can be generated, and participants can be removed from active competitions under certain conditions.
 */
export default class CompetitionManagerConcept {
  competitions: Collection<Competition>;
  scores: Collection<Score>;

  constructor(private readonly db: Db) {
    this.competitions = this.db.collection(PREFIX + "competitions");
    this.scores = this.db.collection(PREFIX + "scores");
  }

  /**
   * @action startCompetition (name: String, participants: set of Users, startDateStr:String, endDateStr:String): CompetitionId
   * @requires:
   *   - `name` must be a non-empty string.
   *   - participants must contain at least two distinct User's
   *   - `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
   *   - The parsed `startDate` must logically precede or be equal to the parsed `endDate`.
   * @effects:
   *   - Parses `startDateStr` and `endDateStr` into `Date` objects: `startDate`, `endDate`.
   *   - Creates a Competition with the provided `name`, `participants`, `startDate`, `endDate`, a true active flag, and a null winner.
   *   - Also, it creates a Score for each User in participants with wakeUpScore and bedTimeScore of zero and it is associated with the created competition.
   *   - returns the id of the Competition
   */
  async startCompetition(
    { name, participants, startDateStr, endDateStr }: {
      name: string;
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

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(0, 0, 0, 0);

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
      _id: freshID(),
      u,
      competition: competitionId,
      wakeUpScore: 0,
      bedTimeScore: 0,
    }));

    await this.scores.insertMany(scoreDocuments);

    return { competitionId };
  }

  /**
   * @action recordStat (u: User, dateStr: String, eventType:SleepEvent, success:Boolean)
   * @requires:
   *   - u is a part of at least one active Competition
   *   - `dateStr` is a valid date string parseable into a `Date`.
   * @effects:
   *   - Parses `dateStr` into a `Date` object: `eventDate`.
   *   - Calculates `scoreChange`: if `success` is `true`, `scoreChange = 1`; if `success` is `false`, `scoreChange = -1`.
   *   - for all the active competitions that u is apart of and where date is in the range of the start and end dates of the competition, and u is a member of
   *     update the wakeUpScore+=scoreChange if event is "bedtime" otherwise update the bedTimeScore+=scoreChange
   */
  async recordStat(
    { u, dateStr, eventType, success }: {
      u: User;
      dateStr: string;
      eventType: SleepEventType;
      success: boolean;
    },
  ): Promise<Empty | { error: string }> {
    let eventDate: Date;
    try {
      eventDate = new Date(dateStr);
      if (isNaN(eventDate.getTime())) {
        return { error: "Invalid date string provided for event." };
      }
    } catch (_e) {
      return { error: "Invalid date string provided for event." };
    }
    eventDate.setUTCHours(0, 0, 0, 0);

    if (
      eventType !== SleepEventType.BEDTIME && eventType !== SleepEventType.WAKETIME
    ) {
      return { error: "Invalid sleep event type." };
    }

    const activeCompetitions = await this.competitions.find({
      active: true,
      participants: u,
      startDate: { $lte: eventDate },
      endDate: { $gte: eventDate },
    }).toArray();

    if (activeCompetitions.length === 0) {
      return {
        error:
          "User is not part of any active competition for the specified date.",
      };
    }

    const scoreChange = success ? 1 : -1;

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
   * @action endCompetition (c:Competition): Set<User>?
   * @requires: current date is greater than or equal to the endDate of Competition c
   *   - c.active must be true
   * @effects: return the User IDs of the users in competition c with the greatest sum of wakeUpScore + bedTimeScore and set this ID to the winner state (if tie among all participants keep winner as null)
   *   - also change active flag to false for competition c
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
    currentDate.setUTCHours(0, 0, 0, 0);

    if (currentDate < competition.endDate) {
      return { error: `Competition ${competitionId} has not ended yet.` };
    }

    const participantScores = await this.scores.find({
      competition: competitionId,
    }).toArray();

    if (participantScores.length === 0) {
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

    const potentialWinners: User[] = [];
    for (const [user, totalScore] of userTotalScores.entries()) {
      if (totalScore === maxScore) {
        potentialWinners.push(user);
      }
    }

    const allParticipantsTied = potentialWinners.length ===
      competition.participants.length;
    const finalWinners = allParticipantsTied ? null : potentialWinners;

    await this.competitions.updateOne(
      { _id: competitionId },
      { $set: { active: false, winners: finalWinners } },
    );

    return { winners: finalWinners };
  }

  /**
   * @query getLeaderboard (c: Competition): {position:number; userId: User; totalScore: number}[]
   * @requires: `competitionId` must refer to an existing `Competition c` in `competitions`.
   * @effects: returns a ranked leaderboard of users in `Competition c`
   */
  async _getLeaderboard(
    { competitionId }: { competitionId: CompetitionId },
  ): Promise<
    | { position: number; userId: User; totalScore: number }[]
    | { error: string }
  > {
    const competition = await this.competitions.findOne({ _id: competitionId });

    if (!competition) {
      return { error: `Competition with ID ${competitionId} not found.` };
    }

    const participantScores = await this.scores.find({
      competition: competitionId,
    }).toArray();

    const userTotalScores = new Map<User, number>();
    for (const score of participantScores) {
      userTotalScores.set(score.u, score.wakeUpScore + score.bedTimeScore);
    }

    const leaderboardEntries = competition.participants.map((u) => ({
      userId: u,
      totalScore: userTotalScores.get(u) || 0,
    }));

    leaderboardEntries.sort((a, b) => b.totalScore - a.totalScore);

    const rankedLeaderboard: {
      position: number;
      userId: User;
      totalScore: number;
    }[] = [];
    let lastScore: number | null = null;

    for (let i = 0; i < leaderboardEntries.length; i++) {
      const currentEntry = leaderboardEntries[i];
      let position = i + 1;
      if (lastScore !== null && currentEntry.totalScore === lastScore) {
        position = rankedLeaderboard[i - 1].position;
      }
      rankedLeaderboard.push({
        position,
        userId: currentEntry.userId,
        totalScore: currentEntry.totalScore,
      });
      lastScore = currentEntry.totalScore;
    }

    return rankedLeaderboard;
  }

  /**
   * @action removeParticipant (competitionId: CompetitionId, userId: UserId)
   * @purpose To remove a specific user from an active competition and clear their associated scores. If the competition no longer has a viable number of participants, it is deactivated.
   * @requires:
   *   - `competitionId` must refer to an existing `Competition c` in `competitions`.
   *   - `c.active` must be `true`.
   *   - `userId` must be a member of `c.participants`.
   * @effects:
   *   - Retrieves the `Competition c` identified by `competitionId`.
   *   - Removes `userId` from `c.participants`.
   *   - Removes the `Score` entry for that user and competition.
   *   - If `c.participants.size() < 2` after removal:
   *     - Sets `c.active` to `false`.
   *     - Sets `c.winners` to `null`.
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

    const updatedParticipants = competition.participants.filter((p) =>
      p !== userId
    );

    await this.scores.deleteOne({ u: userId, competition: competitionId });

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
