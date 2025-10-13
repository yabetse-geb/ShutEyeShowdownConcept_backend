---
timestamp: 'Mon Oct 13 2025 14:26:56 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251013_142656.1dce5131.md]]'
content_id: 9c17ccc641814468d5d4cd46978c203501a345fe33c3605fbcc1a4bc7b21692a
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
 *          over a defined time period and establishing a winner based off of scores.
 * @principle Users initiate competitions with one or more other users, specifying a start and end date. Throughout the
 *            competition duration, participants' sleep adherence events (bedtime and wake-up) are recorded. Based on the
 *            success or failure of these events, individual scores are accumulated. Upon the competition's conclusion,
 *            these scores are tallied, and a winner is determined, with provisions for handling ties.
 */

// Declare collection prefix, use concept name
const PREFIX = "CompetitionManager" + ".";

// Generic type for User as per specification
type User = ID;
type CompetitionId = ID;

/**
 * @typedef SleepEventType
 * An enumeration representing the type of sleep event.
 */
export enum SleepEventType {
  BEDTIME = "BEDTIME",
  WAKETIME = "WAKETIME",
}

/**
 * @state
 * A set of Competitions with
 *   participants: a set of Users
 *   a `startDate` of type `Date`
 *   a `endDate` of type `Date`
 *   an active flag of type Boolean
 *   a winners a set of Users?
 */
interface Competition {
  _id: CompetitionId;
  participants: User[];
  startDate: Date;
  endDate: Date;
  active: boolean;
  winners: User[] | null; // null if no winner yet, or if tie among all participants
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
   *   participants must contain at least two distinct User's.
   *   `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
   *   The parsed `startDate` must logically precede or be equal to the parsed `endDate`.
   * @effects:
   *   Parses `startDateStr` and `endDateStr` into `Date` objects: `startDate`, `endDate`.
   *   Creates a Competition with participates, startDate, endDate, a true active flag, a null winner.
   *   Also, it creates a Score for each User in participants with wakeUpScore and bedTimeScore of zero and it is associated with the created competition.
   *   Returns the id of the Competition.
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

    // Requires: startDateStr and endDateStr must be valid date strings parseable into Date objects.
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { error: "Invalid startDateStr or endDateStr." };
    }

    // Requires: The parsed startDate must logically precede or be equal to the parsed endDate.
    // Normalize dates to start of day for comparison, ignoring time components as per concept.
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (startOfDay(startDate) > startOfDay(endDate)) {
      return { error: "Start date cannot be after end date." };
    }

    const competitionId = freshID();

    // Effects: creates a Competition
    const newCompetition: Competition = {
      _id: competitionId,
      participants: [...new Set(participants)], // Ensure distinct participants
      startDate: startDate,
      endDate: endDate,
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
   * @requires:
   *   u is a part of at least one active Competition.
   *   `dateStr` is a valid date string parseable into a `Date`.
   *   `eventType` is either `SleepEventType.BEDTIME` or `SleepEventType.WAKETIME`.
   * @effects:
   *   Parses `dateStr` into a `Date` object: `eventDate`.
   *   Calculates `scoreChange`: if `success` is `true`, `scoreChange = 1`; if `success` is `false`, `scoreChange = -1`.
   *   For all the active competitions that u is a part of and where date is in the range of the start and end dates of the competition,
   *   update the wakeUpScore+=scoreChange if event is "WAKETIME" otherwise update the bedTimeScore+=scoreChange.
   */
  async recordStat(
    { u, dateStr, eventType, success }: {
      u: User;
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

    // Requires: eventType is either SleepEventType.BEDTIME or SleepEventType.WAKETIME
    if (!Object.values(SleepEventType).includes(eventType)) {
      return { error: "Invalid eventType." };
    }

    const scoreChange = success ? 1 : -1;

    // Find all active competitions where u is a participant
    const activeCompetitions = await this.competitions.find({
      active: true,
      participants: u,
    }).toArray();

    // Requires: u is a part of at least one active Competition
    if (activeCompetitions.length === 0) {
      return { error: "User is not part of any active competition." };
    }

    // Normalize eventDate to start of day for comparison
    const normalizedEventDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    const updatePromises = activeCompetitions.map(async (comp) => {
      // Normalize competition dates to start of day for comparison
      const normalizedStartDate = new Date(comp.startDate.getFullYear(), comp.startDate.getMonth(), comp.startDate.getDate());
      const normalizedEndDate = new Date(comp.endDate.getFullYear(), comp.endDate.getMonth(), comp.endDate.getDate());

      // Check if eventDate is within the competition's range (inclusive)
      if (normalizedEventDate >= normalizedStartDate && normalizedEventDate <= normalizedEndDate) {
        const updateField = eventType === SleepEventType.WAKETIME ? "wakeUpScore" : "bedTimeScore";
        await this.scores.updateOne(
          { u: u, competitionId: comp._id },
          { $inc: { [updateField]: scoreChange } },
        );
      }
    });

    await Promise.all(updatePromises);

    return {};
  }

  /**
   * @action endCompetition
   * @requires:
   *   current date is greater than or equal to the endDate of Competition c.
   *   c.active must be true.
   * @effects:
   *   Returns the User IDs of the users in competition c with the greatest sum of wakeUpScore + bedTimeScore
   *   and set this ID to the winner state (if tie among all participants keep winner as null).
   *   Also change active flag to false for competition c.
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
    const normalizedCurrentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const normalizedEndDate = new Date(competition.endDate.getFullYear(), competition.endDate.getMonth(), competition.endDate.getDate());

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
    for (const [user, totalScore] of userTotalScores.entries()) {
      if (totalScore === maxTotalScore) {
        potentialWinners.push(user);
      }
    }

    let finalWinners: User[] | null = null;
    // Effects: if tie among all participants keep winner as null
    if (potentialWinners.length > 0 && potentialWinners.length < competition.participants.length) {
      finalWinners = potentialWinners;
    } else if (potentialWinners.length === 0) {
      // This case should ideally not happen if all participants have scores,
      // but defensively handle if somehow no scores were recorded or maxTotalScore remains -Infinity.
      finalWinners = null; // No scores or no clear winner
    } else if (potentialWinners.length === competition.participants.length && maxTotalScore > -Infinity) {
        // All participants tied with the same max score (and at least one score was made).
        finalWinners = null;
    }


    // Effects: change active flag to false for competition c
    // Effects: set this ID to the winner state
    await this.competitions.updateOne(
      { _id: competitionId },
      { $set: { active: false, winners: finalWinners } },
    );

    // Effects: return the User IDs of the users in competition c with the greatest sum of wakeUpScore + bedTimeScore
    return { winners: finalWinners };
  }
}
```
