[@testing-concepts](../../background/testing-concepts.md)

[@implementation](implementation.md)

[@testingDetailedConcepts](../../background/testingDetailedConcepts.md)


[@response.a2cd140a](../../../context/design/concepts/CompetitionManager/testing.md/steps/response.a2cd140a.md)

# test: update your previous response for testing SleepSchedule by putting each test case/scenario in its own Deno.test block 


# response:

To ensure concepts are independent:

1.  **No Direct Inter-Concept Imports**: Concepts should not directly import or reference implementation details (classes, methods, or internal types) of other concepts. Their code should be entirely self-contained within their respective boundaries.
2.  **Generic Parameters Only**: Concepts must operate exclusively on their specified generic type parameters (e.g., `User`, `Target`, `Item`). This forces them to treat external entities as opaque identifiers, preventing them from assuming or relying on the internal structure or behavior of objects managed by other concepts.
3.  **Separate, Encapsulated State**: Each concept manages its own distinct portion of the application state. While multiple concepts might refer to the same *logical entity* (like `User`), they store only the facets of that entity relevant to their specific purpose. There is no shared mutable state that concepts can directly manipulate in another concept's domain.
4.  **Single, Focused Purpose**: A concept should have a narrow, well-defined, and user-centric purpose. This prevents feature creep and ensures that a concept doesn't accumulate responsibilities that rightfully belong to other concepts, thus minimizing the chances of hidden dependencies.
5.  **Behavioral Completeness**: Within its defined purpose, a concept must be behaviorally complete. It shouldn't require another concept to complete its core function. If interactions between concepts are necessary, they should occur through a high-level coordination layer (like a synchronization mechanism) that passes generic identifiers and defined outputs, rather than direct method calls.
6.  **Pre/Post Conditions Refer to Own State**: The `requires` and `effects` clauses of an action must strictly refer to the concept's own state and its generic parameters. They should not mention or modify the state of other concepts.

By strictly adhering to these guidelines, especially the use of generic parameters and the isolation of state, concepts become highly decoupled, reusable, and easier to reason about in isolation.

# file: src/CompetitionManager/CompetitionManagerConcept.ts

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
 *   participants: a set of Users
 *   a `startDate` of type `Date`
 *   a `endDate` of type `Date`
 *   an active flag of type Boolean
 *   a winners a set of Users? (will be set to null until endCompetition establishes winner or remain null if tie among a subset of participants, otherwise if smaller subset of participants have the max score set it to the set of those winners)
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
 *   u: a User
 *   competition: a CompetitionId
 *   a wakeUpScore Number
 *   a bedTimeScore Number
 */
interface Score {
  _id: ID; // Unique ID for each score document
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
   *   - participants must contain at least two distinct User's
   *   - `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
   *   - The parsed `startDate` must logically precede or be equal to the parsed `endDate`.
   * @effects:
   *   - Parses `startDateStr` and `endDateStr` into `Date` objects: `startDate`, `endDate`.
   *   - creates a Competition with participates, startDate, endDate, a true active flag, a null winner.
   *   - Also, it creates a Score for each User in participants with wakeUpScore and bedTimeScore of zero and it is associated with the created competition.
   *   - returns the id of the Competition
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
    // Check for distinct participants
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

    // Normalize dates to start of day for comparison, as time components are generally ignored.
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
   *   - u is a part of at least one active Competition
   *   - `dateStr` is a valid date string parseable into a `Date`.
   *   - `eventType` is either `SleepEventType.BEDTIME` or `SleepEventType.WAKETIME`.
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
    const scoreFieldName = eventType === SleepEventType.BEDTIME
      ? "bedTimeScore"
      : "wakeUpScore";

    const updatePromises = activeCompetitions.map((comp) =>
      this.scores.updateOne(
        { u, competition: comp._id },
        { $inc: { [scoreFieldName]: scoreChange } },
      )
    );

    await Promise.all(updatePromises);

    return {};
  }

  /**
   * @action endCompetition
   * @requires:
   *   - current date is greater than or equal to the endDate of Competition c
   *   - c.active must be true
   * @effects:
   *   - return the User IDs of the users in competition c with the greatest sum of wakeUpScore + bedTimeScore and set this ID to the winner state (if tie among all participants keep winner as null)
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
      // but as a safety, if no scores are found (e.g., all removed), treat as no winners.
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
   *   - Returns `rankedLeaderboard`.
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

    const userTotalScores: Map<User, number> = new Map();
    // Populate scores from DB. I3 guarantees entries exist for all participants.
    for (const score of participantScores) {
      userTotalScores.set(score.u, score.wakeUpScore + score.bedTimeScore);
    }

    // Create leaderboard entries, defaulting to 0 if a participant mysteriously lacks a score entry (safety)
    const leaderboardEntries: { userId: User; totalScore: number }[] =
      competition.participants.map((u) => ({
        userId: u,
        totalScore: userTotalScores.get(u) || 0, // Default to 0 if no score found (shouldn't happen with I3)
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
      // If current score is less than last score (or first entry), increment position
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

    return rankedLeaderboard;
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
    // Requirement: `c.participants.size()` must be greater than 1 before removal.
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

# file: src/CompetitionManager/CompetitionManagerConcept.test.ts

```typescript
import { Db } from "npm:mongodb";
import { assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import CompetitionManagerConcept from "./CompetitionManagerConcept.ts";

// Helper to create user IDs for testing
const user = (name: string): ID => `user:${name}` as ID;

// Enum needs to be accessible in tests, matches the one in the concept file
enum SleepEventType {
  BEDTIME = "BEDTIME",
  WAKETIME = "WAKETIME",
}

Deno.test("CompetitionManager Concept Tests", async (t) => {
  let db: Db;
  let client: any;
  let concept: CompetitionManagerConcept;

  // This hook runs before each top-level or nested test step (t.step).
  // It ensures a fresh database connection and concept instance for each test.
  // The database itself is guaranteed to be dropped before the entire test file starts
  // by Deno's global hook (as per the prompt), so each t.step implicitly starts clean.
  Deno.test.beforeEach(async () => {
    [db, client] = await testDb();
    concept = new CompetitionManagerConcept(db);
    console.log("Database and concept initialized for a new test.");
  });

  Deno.test.afterEach(async () => {
    if (client) {
      await client.close();
      console.log("Database client closed.");
    }
  });

  // trace: Operational Principle Test
  // Demonstrates the full lifecycle: start, record stats, get leaderboard, end, get final leaderboard.
  await t.step("Operational Principle: Full competition lifecycle and leaderboard", async () => {
    console.log("\n--- Starting Operational Principle Test ---");

    const userAlice = user("Alice");
    const userBob = user("Bob");
    const userCharlie = user("Charlie");

    // Dates in the past to ensure `endCompetition` can be called immediately
    const startDateStr = "2023-01-01";
    const endDateStr = "2023-01-05";
    const competitionParticipants = [userAlice, userBob, userCharlie];

    // 1. Start Competition
    console.log(
      `Action: startCompetition(${JSON.stringify({ participants: competitionParticipants, startDateStr, endDateStr })})`,
    );
    const startResult = await concept.startCompetition({
      participants: competitionParticipants,
      startDateStr,
      endDateStr,
    });
    console.log(`Result: ${JSON.stringify(startResult)}`);
    assertEquals(typeof startResult, "object");
    assertEquals("competitionId" in startResult, true);
    const compId = (startResult as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId} started.`);

    // Verify competition created and active
    let competition = await concept.competitions.findOne({ _id: compId });
    assertEquals(competition?.active, true, `Competition ${compId} should be active after creation.`);
    assertEquals(competition?.participants.length, 3, `Competition ${compId} should have 3 participants.`);
    assertEquals(competition?.winners, null, `Competition ${compId} winners should be null initially.`);

    // Verify initial scores are 0 for all participants
    let scores = await concept.scores.find({ competition: compId }).toArray();
    assertEquals(scores.length, 3, `Expected 3 score entries for competition ${compId}.`);
    for (const s of scores) {
      assertEquals(s.wakeUpScore, 0, `Initial wakeUpScore for ${s.u} should be 0.`);
      assertEquals(s.bedTimeScore, 0, `Initial bedTimeScore for ${s.u} should be 0.`);
    }
    console.log("Competition started and initial scores verified.");

    // 2. Record Stats to build up scores over a couple of days
    // Day 1 (2023-01-01): Alice +1 Bedtime, Bob +1 Waketime, Charlie -1 Bedtime
    console.log("\n--- Recording Stats for Day 1 (2023-01-01) ---");
    await concept.recordStat({ u: userAlice, dateStr: "2023-01-01", eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userBob, dateStr: "2023-01-01", eventType: SleepEventType.WAKETIME, success: true });
    await concept.recordStat({ u: userCharlie, dateStr: "2023-01-01", eventType: SleepEventType.BEDTIME, success: false });

    // Day 2 (2023-01-02): Alice +1 Waketime, Bob -1 Bedtime
    console.log("\n--- Recording Stats for Day 2 (2023-01-02) ---");
    await concept.recordStat({ u: userAlice, dateStr: "2023-01-02", eventType: SleepEventType.WAKETIME, success: true });
    await concept.recordStat({ u: userBob, dateStr: "2023-01-02", eventType: SleepEventType.BEDTIME, success: false });

    // Expected Scores by end of Day 2:
    // Alice: BT=1 (from Day1), WT=1 (from Day2) => Total=2
    // Bob: BT=-1 (from Day2), WT=1 (from Day1) => Total=0
    // Charlie: BT=-1 (from Day1), WT=0 => Total=-1

    // Verify scores after recording
    scores = await concept.scores.find({ competition: compId }).toArray();
    const aliceScore = scores.find((s) => s.u === userAlice);
    const bobScore = scores.find((s) => s.u === userBob);
    const charlieScore = scores.find((s) => s.u === userCharlie);

    assertEquals(aliceScore?.bedTimeScore, 1, `Alice's bedTimeScore should be 1.`);
    assertEquals(aliceScore?.wakeUpScore, 1, `Alice's wakeUpScore should be 1.`);
    assertEquals(bobScore?.bedTimeScore, -1, `Bob's bedTimeScore should be -1.`);
    assertEquals(bobScore?.wakeUpScore, 1, `Bob's wakeUpScore should be 1.`);
    assertEquals(charlieScore?.bedTimeScore, -1, `Charlie's bedTimeScore should be -1.`);
    assertEquals(charlieScore?.wakeUpScore, 0, `Charlie's wakeUpScore should be 0.`);
    console.log("Scores updated and verified after recording stats.");

    // 3. Get Leaderboard (mid-competition)
    console.log("\n--- Getting Leaderboard Mid-Competition ---");
    const midLeaderboard = await concept._getLeaderboard({ competitionId: compId });
    console.log(`Result: ${JSON.stringify(midLeaderboard)}`);
    assertEquals(Array.isArray(midLeaderboard), true, "Leaderboard should be an array.");
    const expectedMidLeaderboard = [
      { position: 1, userId: userAlice, totalScore: 2 },
      { position: 2, userId: userBob, totalScore: 0 },
      { position: 3, userId: userCharlie, totalScore: -1 },
    ];
    assertEquals(midLeaderboard, expectedMidLeaderboard, "Mid-competition leaderboard should match expected ranking.");
    console.log("Mid-competition leaderboard verified.");

    // 4. End Competition (current date is assumed to be >= endDate based on past date choice)
    console.log("\n--- Ending Competition ---");
    const endResult = await concept.endCompetition({ competitionId: compId });
    console.log(`Result: ${JSON.stringify(endResult)}`);
    assertEquals(typeof endResult, "object");
    assertEquals("winners" in endResult, true);
    assertEquals(
      (endResult as { winners: ID[] | null }).winners,
      [userAlice],
      "Alice should be the sole winner as per scores.",
    );

    // Verify competition is inactive and winners are set in the database
    competition = await concept.competitions.findOne({ _id: compId });
    assertEquals(competition?.active, false, `Competition ${compId} should be inactive after ending.`);
    assertEquals(competition?.winners, [userAlice], `Competition ${compId} winners should be Alice in DB.`);
    console.log("Competition ended and winner verified in DB.");

    // 5. Get Leaderboard (post-competition)
    console.log("\n--- Getting Leaderboard Post-Competition ---");
    const postLeaderboard = await concept._getLeaderboard({ competitionId: compId });
    console.log(`Result: ${JSON.stringify(postLeaderboard)}`);
    assertEquals(Array.isArray(postLeaderboard), true, "Post-competition leaderboard should be an array.");
    // Leaderboard should remain the same, as scores don't change after ending.
    assertEquals(postLeaderboard, expectedMidLeaderboard, "Post-competition leaderboard should match expected ranking.");
    console.log("Post-competition leaderboard verified.");

    console.log("\n--- Operational Principle Test Complete ---");
  });

  // Scenario 1: Overlapping Competitions Allowed
  // Tests if a user can participate in multiple active competitions whose date ranges overlap.
  await t.step("Scenario 1: Overlapping Competitions Allowed (for a user)", async () => {
    console.log("\n--- Starting Scenario 1 Test (Overlapping Competitions) ---");

    const userA = user("Alpha");
    const userB = user("Beta");
    const userC = user("Gamma");

    // Comp 1: Jan 1 - Jan 10 (userA, userB)
    const startDate1 = "2023-01-01";
    const endDate1 = "2023-01-10";
    const participants1 = [userA, userB];

    console.log(
      `Action: startCompetition (Comp1) for ${JSON.stringify(participants1)} from ${startDate1} to ${endDate1}`,
    );
    const res1 = await concept.startCompetition({
      participants: participants1,
      startDateStr: startDate1,
      endDateStr: endDate1,
    });
    console.log(`Result: ${JSON.stringify(res1)}`);
    assertEquals("competitionId" in res1, true, "First competition should start successfully.");
    const compId1 = (res1 as { competitionId: ID }).competitionId;
    let comp1InDb = await concept.competitions.findOne({ _id: compId1 });
    assertEquals(comp1InDb?.active, true, `Competition ${compId1} should be active.`);
    console.log(`Competition ${compId1} started successfully.`);

    // Comp 2: Jan 5 - Jan 15 (userA, userC) - overlaps with Comp 1, userA is in both
    const startDate2 = "2023-01-05";
    const endDate2 = "2023-01-15";
    const participants2 = [userA, userC];

    console.log(
      `Action: startCompetition (Comp2) for ${JSON.stringify(participants2)} from ${startDate2} to ${endDate2}`,
    );
    const res2 = await concept.startCompetition({
      participants: participants2,
      startDateStr: startDate2,
      endDateStr: endDate2,
    });
    console.log(`Result: ${JSON.stringify(res2)}`);
    assertEquals("competitionId" in res2, true, "Second (overlapping) competition should start successfully.");
    const compId2 = (res2 as { competitionId: ID }).competitionId;
    let comp2InDb = await concept.competitions.findOne({ _id: compId2 });
    assertEquals(comp2InDb?.active, true, `Competition ${compId2} should be active.`);
    console.log(`Competition ${compId2} (overlapping) started successfully.`);

    // Verify both competitions are active and exist with correct participants
    assertEquals(comp1InDb?.participants.includes(userA), true, `Comp1 should include ${userA}.`);
    assertEquals(comp1InDb?.participants.includes(userB), true, `Comp1 should include ${userB}.`);
    assertEquals(comp2InDb?.participants.includes(userA), true, `Comp2 should include ${userA}.`);
    assertEquals(comp2InDb?.participants.includes(userC), true, `Comp2 should include ${userC}.`);

    // Verify scores exist for userA in both competitions (as per I3)
    const userAScoresComp1 = await concept.scores.findOne({ u: userA, competition: compId1 });
    const userAScoresComp2 = await concept.scores.findOne({ u: userA, competition: compId2 });
    assertEquals(userAScoresComp1 !== null, true, `User ${userA} should have scores for ${compId1}.`);
    assertEquals(userAScoresComp2 !== null, true, `User ${userA} should have scores for ${compId2}.`);
    console.log(`User ${userA} has score entries in both overlapping competitions, as expected.`);

    console.log("\n--- Scenario 1 Test Complete ---");
  });

  // Scenario 2: Score Update Outside Competition Period
  // Tests if `recordStat` correctly rejects events outside the competition's defined date range.
  await t.step("Scenario 2: Score Update Outside Competition Period", async () => {
    console.log("\n--- Starting Scenario 2 Test (Score Update Outside Period) ---");

    const userX = user("Xavier");
    const userY = user("Yara");

    const startDate = "2023-03-05";
    const endDate = "2023-03-10";
    const participants = [userX, userY];

    const startRes = await concept.startCompetition({
      participants,
      startDateStr: startDate,
      endDateStr: endDate,
    });
    assertEquals("competitionId" in startRes, true, "Competition should start successfully.");
    const compId = (startRes as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId} started from ${startDate} to ${endDate}.`);

    // Attempt to record stat BEFORE start date
    const beforeStartDate = "2023-03-01";
    console.log(
      `Action: recordStat for ${userX} on ${beforeStartDate} (before start date)`,
    );
    const recordResult1 = await concept.recordStat({
      u: userX,
      dateStr: beforeStartDate,
      eventType: SleepEventType.BEDTIME,
      success: true,
    });
    console.log(`Result: ${JSON.stringify(recordResult1)}`);
    assertEquals("error" in recordResult1, true, "Recording before start date should return an error.");
    assertEquals(
      (recordResult1 as { error: string }).error,
      "User is not part of any active competition for the specified date, or the event date is outside the competition range.",
      "Error message for before-start-date should match expected.",
    );
    console.log("Record stat before start date correctly failed.");

    // Attempt to record stat AFTER end date
    const afterEndDate = "2023-03-12";
    console.log(
      `Action: recordStat for ${userX} on ${afterEndDate} (after end date)`,
    );
    const recordResult2 = await concept.recordStat({
      u: userX,
      dateStr: afterEndDate,
      eventType: SleepEventType.WAKETIME,
      success: false,
    });
    console.log(`Result: ${JSON.stringify(recordResult2)}`);
    assertEquals("error" in recordResult2, true, "Recording after end date should return an error.");
    assertEquals(
      (recordResult2 as { error: string }).error,
      "User is not part of any active competition for the specified date, or the event date is outside the competition range.",
      "Error message for after-end-date should match expected.",
    );
    console.log("Record stat after end date correctly failed.");

    // Verify scores remain 0 for userX in competition compId
    const userXScore = await concept.scores.findOne({ u: userX, competition: compId });
    assertEquals(userXScore?.bedTimeScore, 0, `User ${userX}'s bedTimeScore should still be 0.`);
    assertEquals(userXScore?.wakeUpScore, 0, `User ${userX}'s wakeUpScore should still be 0.`);
    console.log(`Scores for user ${userX} remained 0, as expected.`);

    console.log("\n--- Scenario 2 Test Complete ---");
  });

  // Scenario 3: Tie Across All Participants at End
  // Tests `endCompetition` behavior when all participants have the same total score.
  await t.step("Scenario 3: Tie Across All Participants at End", async () => {
    console.log("\n--- Starting Scenario 3 Test (Full Tie) ---");

    const userP = user("Paul");
    const userQ = user("Quinn");

    const startDate = "2023-04-01";
    const endDate = "2023-04-05"; // In the past for immediate ending
    const participants = [userP, userQ];

    const startRes = await concept.startCompetition({
      participants,
      startDateStr: startDate,
      endDateStr: endDate,
    });
    assertEquals("competitionId" in startRes, true, "Competition should start successfully.");
    const compId = (startRes as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId} started.`);

    // Record stats to ensure a tie (both get a total score of 2)
    // Paul: +1 BT, +1 WT (Total 2)
    await concept.recordStat({ u: userP, dateStr: "2023-04-02", eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userP, dateStr: "2023-04-03", eventType: SleepEventType.WAKETIME, success: true });

    // Quinn: +1 BT, +1 WT (Total 2)
    await concept.recordStat({ u: userQ, dateStr: "2023-04-02", eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userQ, dateStr: "2023-04-03", eventType: SleepEventType.WAKETIME, success: true });
    console.log("Scores recorded to create a tie situation (Paul: 2, Quinn: 2).");

    let leaderboard = await concept._getLeaderboard({ competitionId: compId });
    console.log(`Mid-competition Leaderboard: ${JSON.stringify(leaderboard)}`);
    assertEquals(leaderboard.length, 2, "Leaderboard should contain 2 entries.");
    // Cast to access properties safely
    const typedLeaderboard = leaderboard as { position: number; userId: ID; totalScore: number }[];
    assertEquals(typedLeaderboard[0].totalScore, 2, `Leaderboard top score should be 2.`);
    assertEquals(typedLeaderboard[1].totalScore, 2, `Leaderboard second score should be 2.`);
    assertEquals(typedLeaderboard[0].position, 1, `Leaderboard top position should be 1 (due to tie).`);
    assertEquals(typedLeaderboard[1].position, 1, `Leaderboard second position should be 1 (due to tie).`);

    // End competition (assuming current date is >= endDate)
    console.log("\n--- Ending Competition with Tie ---");
    const endResult = await concept.endCompetition({ competitionId: compId });
    console.log(`Result: ${JSON.stringify(endResult)}`);
    assertEquals("winners" in endResult, true);
    assertEquals((endResult as { winners: ID[] | null }).winners, null, "Winners should be null for a full tie.");
    console.log("Competition ended, winners correctly null due to full tie.");

    // Verify competition state in DB
    const competition = await concept.competitions.findOne({ _id: compId });
    assertEquals(competition?.active, false, `Competition ${compId} should be inactive after ending.`);
    assertEquals(competition?.winners, null, `Competition ${compId} winners should be null in DB.`);
    console.log("Competition active status and winners field verified in DB.");

    // Verify post-end leaderboard still shows scores
    leaderboard = await concept._getLeaderboard({ competitionId: compId });
    assertEquals(leaderboard.length, 2, "Post-end leaderboard should still contain 2 entries.");
    assertEquals(typedLeaderboard[0].totalScore, 2, `Post-end leaderboard top score should be 2.`);
    assertEquals(typedLeaderboard[1].totalScore, 2, `Post-end leaderboard second score should be 2.`);
    console.log("Post-competition leaderboard still reflects tied scores.");

    console.log("\n--- Scenario 3 Test Complete ---");
  });

  // Scenario 4: Removing Participant to Invalidate Competition
  // Tests `removeParticipant` leading to competition deactivation and edge cases with participant counts.
  await t.step("Scenario 4: Removing Participant to Invalidate Competition", async () => {
    console.log("\n--- Starting Scenario 4 Test (Removing Participant) ---");

    const userR = user("Rita");
    const userS = user("Sam");
    const userT = user("Tom");

    // Start a competition with 3 participants
    const startRes1 = await concept.startCompetition({
      participants: [userR, userS, userT],
      startDateStr: "2023-05-01",
      endDateStr: "2023-05-07",
    });
    assertEquals("competitionId" in startRes1, true, "First competition should start successfully.");
    const compId1 = (startRes1 as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId1} started with 3 participants (${userR}, ${userS}, ${userT}).`);

    // Record some stats for userT to ensure their score exists before removal
    await concept.recordStat({ u: userT, dateStr: "2023-05-02", eventType: SleepEventType.BEDTIME, success: true });
    let userTScoreBeforeRemoval = await concept.scores.findOne({ u: userT, competition: compId1 });
    assertEquals(userTScoreBeforeRemoval?.bedTimeScore, 1, "User T's score initialized correctly.");

    // Remove one participant (userT) - competition should remain active as 2 participants are left
    console.log(`Action: removeParticipant for ${userT} from ${compId1} (leaving 2 participants)`);
    const removeRes1 = await concept.removeParticipant({
      competitionId: compId1,
      userId: userT,
    });
    console.log(`Result: ${JSON.stringify(removeRes1)}`);
    assertEquals("error" in removeRes1, false, "Removing userT should not return an error.");
    console.log(`User ${userT} removed. Competition ${compId1} should still be active with 2 participants.`);

    let competition1 = await concept.competitions.findOne({ _id: compId1 });
    assertEquals(competition1?.active, true, `Competition ${compId1} should still be active.`);
    assertEquals(competition1?.participants.length, 2, `Competition ${compId1} should have 2 participants.`);
    assertEquals(competition1?.participants.includes(userT), false, `Competition ${compId1} should not include ${userT}.`);
    // Verify userT's score is gone
    const userTScoreAfterRemoval = await concept.scores.findOne({ u: userT, competition: compId1 });
    assertEquals(userTScoreAfterRemoval, null, `User ${userT}'s score entry should be removed.`);
    console.log("User T's score entry correctly removed.");

    // Now remove another participant (userS), leaving only 1, which should deactivate the competition
    console.log(`Action: removeParticipant for ${userS} from ${compId1} (leaving 1 participant)`);
    const removeRes2 = await concept.removeParticipant({
      competitionId: compId1,
      userId: userS,
    });
    console.log(`Result: ${JSON.stringify(removeRes2)}`);
    assertEquals("error" in removeRes2, false, "Removing userS should not return an error.");
    console.log(`User ${userS} removed. Competition ${compId1} should now be inactive.`);

    competition1 = await concept.competitions.findOne({ _id: compId1 });
    assertEquals(competition1?.active, false, `Competition ${compId1} should now be inactive.`); // Expect inactive
    assertEquals(competition1?.winners, null, `Competition ${compId1} winners should be null.`); // Expect winners null
    assertEquals(competition1?.participants.length, 1, `Competition ${compId1} should have 1 participant remaining.`); // Only userR remains
    assertEquals(competition1?.participants.includes(userS), false, `Competition ${compId1} should not include ${userS}.`);
    const userSScoreAfterRemoval = await concept.scores.findOne({ u: userS, competition: compId1 });
    assertEquals(userSScoreAfterRemoval, null, `User ${userS}'s score entry should be removed.`);
    console.log("User S removed, competition correctly deactivated and winners null.");

    // Attempt to remove the last participant (userR) from the now 1-participant competition
    console.log(`Action: removeParticipant for ${userR} from ${compId1} (should fail as only 1 participant)`);
    const removeRes3 = await concept.removeParticipant({
      competitionId: compId1,
      userId: userR,
    });
    console.log(`Result: ${JSON.stringify(removeRes3)}`);
    assertEquals("error" in removeRes3, true, "Attempt to remove last participant should return an error.");
    assertEquals(
      (removeRes3 as { error: string }).error,
      `Cannot remove participant from competition ${compId1}: it must have more than 1 participant.`,
      "Error message for removing last participant should match.",
    );
    console.log("Removing the last participant correctly failed as per requirement.");

    // Start a fresh competition with exactly 2 participants, then remove one to see immediate deactivation
    const userU = user("Uma");
    const userV = user("Victor");
    const startRes2 = await concept.startCompetition({
      participants: [userU, userV],
      startDateStr: "2023-06-01",
      endDateStr: "2023-06-05",
    });
    assertEquals("competitionId" in startRes2, true, "Second competition should start successfully.");
    const compId2 = (startRes2 as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId2} started with 2 participants (${userU}, ${userV}).`);

    // Remove one participant (userU) - should deactivate immediately as only 1 remains
    console.log(`Action: removeParticipant for ${userU} from ${compId2} (leaving 1 participant)`);
    const removeRes4 = await concept.removeParticipant({
      competitionId: compId2,
      userId: userU,
    });
    console.log(`Result: ${JSON.stringify(removeRes4)}`);
    assertEquals("error" in removeRes4, false, "Removing userU should not return an error.");
    console.log(`User ${userU} removed. Competition ${compId2} should now be inactive.`);

    let competition2 = await concept.competitions.findOne({ _id: compId2 });
    assertEquals(competition2?.active, false, `Competition ${compId2} should be inactive.`); // Expect inactive
    assertEquals(competition2?.winners, null, `Competition ${compId2} winners should be null.`); // Expect winners null
    assertEquals(competition2?.participants.length, 1, `Competition ${compId2} should have 1 participant remaining.`); // Only userV remains
    assertEquals(competition2?.participants.includes(userU), false, `Competition ${compId2} should not include ${userU}.`);
    console.log(
      "From 2 participants, removing one correctly deactivated competition as expected.",
    );

    console.log("\n--- Scenario 4 Test Complete ---");
  });

  // Scenario 5: Repeated or Conflicting Actions (recordStat)
  // Tests if `recordStat` correctly accumulates scores with repeated or mixed success/failure events for the same day.
  await t.step("Scenario 5: Repeated or Conflicting RecordStat Actions", async () => {
    console.log("\n--- Starting Scenario 5 Test (Repeated RecordStat) ---");

    const userM = user("Mike");
    const userN = user("Nancy");

    const startDate = "2023-07-01";
    const endDate = "2023-07-07";
    const eventDate = "2023-07-03"; // A date within the competition period

    const startRes = await concept.startCompetition({
      participants: [userM, userN],
      startDateStr: startDate,
      endDateStr: endDate,
    });
    assertEquals("competitionId" in startRes, true, "Competition should start successfully.");
    const compId = (startRes as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId} started.`);

    // Initial state: Mike's scores are 0, 0
    let mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
    assertEquals(mikeScore?.bedTimeScore, 0, "Initial bedTimeScore for Mike should be 0.");
    assertEquals(mikeScore?.wakeUpScore, 0, "Initial wakeUpScore for Mike should be 0.");
    console.log("Initial scores for Mike verified.");

    // 1. Record BEDTIME success (+1)
    console.log(
      `Action: recordStat for ${userM} on ${eventDate}, BEDTIME success (+1)`,
    );
    await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true });
    mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
    assertEquals(mikeScore?.bedTimeScore, 1, "Mike's bedTimeScore should be 1 after first success.");
    assertEquals(mikeScore?.wakeUpScore, 0, "Mike's wakeUpScore should remain 0.");
    console.log("Bedtime +1 verified (Mike's scores: BT=1, WT=0).");

    // 2. Repeat BEDTIME success (+1)
    console.log(
      `Action: recordStat for ${userM} on ${eventDate}, BEDTIME success (+1 again)`,
    );
    await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true });
    mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
    assertEquals(mikeScore?.bedTimeScore, 2, "Mike's bedTimeScore should be 2 after second success.");
    assertEquals(mikeScore?.wakeUpScore, 0, "Mike's wakeUpScore should remain 0.");
    console.log("Bedtime +1 (repeated) verified (Mike's scores: BT=2, WT=0).");

    // 3. Record BEDTIME failure (-1)
    console.log(
      `Action: recordStat for ${userM} on ${eventDate}, BEDTIME failure (-1)`,
    );
    await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: false });
    mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
    assertEquals(mikeScore?.bedTimeScore, 1, "Mike's bedTimeScore should be 1 after failure (2-1=1).");
    assertEquals(mikeScore?.wakeUpScore, 0, "Mike's wakeUpScore should remain 0.");
    console.log("Bedtime -1 verified (Mike's scores: BT=1, WT=0).");

    // 4. Record WAKETIME success (+1)
    console.log(
      `Action: recordStat for ${userM} on ${eventDate}, WAKETIME success (+1)`,
    );
    await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.WAKETIME, success: true });
    mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
    assertEquals(mikeScore?.bedTimeScore, 1, "Mike's bedTimeScore should remain 1.");
    assertEquals(mikeScore?.wakeUpScore, 1, "Mike's wakeUpScore should be 1 after waketime success.");
    console.log("Waketime +1 verified (Mike's scores: BT=1, WT=1).");

    console.log("\n--- Scenario 5 Test Complete ---");
  });
});
```
# response:

To ensure your concepts are independent, adhere to the following principles:

1.  **No Direct Inter-Concept Imports**: Concepts should not directly import or reference implementation details (like classes, methods, or internal types) of other concepts. Their code should be entirely self-contained within their respective boundaries.
2.  **Generic Parameters Only**: Concepts must operate exclusively on their specified generic type parameters (e.g., `User`, `Target`, `Item`). This forces them to treat external entities as opaque identifiers, preventing them from assuming or relying on the internal structure or behavior of objects managed by other concepts.
3.  **Separate, Encapsulated State**: Each concept manages its own distinct portion of the application state. While multiple concepts might refer to the same *logical entity* (like `User`), they store only the facets of that entity relevant to their specific purpose. There is no shared mutable state that concepts can directly manipulate in another concept's domain.
4.  **Single, Focused Purpose**: A concept should have a narrow, well-defined, and user-centric purpose. This prevents feature creep and ensures that a concept doesn't accumulate responsibilities that rightfully belong to other concepts, thus minimizing the chances of hidden dependencies.
5.  **Behavioral Completeness**: Within its defined purpose, a concept must be behaviorally complete. It shouldn't require another concept to complete its core function. If interactions between concepts are necessary, they should occur through a high-level coordination layer (like a synchronization mechanism) that passes generic identifiers and defined outputs, rather than direct method calls.
6.  **Pre/Post Conditions Refer to Own State**: The `requires` and `effects` clauses of an action must strictly refer to the concept's own state and its generic parameters. They should not mention or modify the state of other concepts.

By strictly adhering to these guidelines, especially the use of generic parameters and the isolation of state, concepts become highly decoupled, reusable, and easier to reason about in isolation.

***

# file: src/CompetitionManager/CompetitionManagerConcept.ts

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
 *   participants: a set of Users
 *   a `startDate` of type `Date`
 *   a `endDate` of type `Date`
 *   an active flag of type Boolean
 *   a winners a set of Users? (will be set to null until endCompetition establishes winner or remain null if tie among a subset of participants, otherwise if smaller subset of participants have the max score set it to the set of those winners)
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
 *   u: a User
 *   competition: a CompetitionId
 *   a wakeUpScore Number
 *   a bedTimeScore Number
 */
interface Score {
  _id: ID; // Unique ID for each score document
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
   *   - participants must contain at least two distinct User's
   *   - `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
   *   - The parsed `startDate` must logically precede or be equal to the parsed `endDate`.
   * @effects:
   *   - Parses `startDateStr` and `endDateStr` into `Date` objects: `startDate`, `endDate`.
   *   - creates a Competition with participates, startDate, endDate, a true active flag, a null winner.
   *   - Also, it creates a Score for each User in participants with wakeUpScore and bedTimeScore of zero and it is associated with the created competition.
   *   - returns the id of the Competition
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
    // Check for distinct participants
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

    // Normalize dates to start of day for comparison, as time components are generally ignored.
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
   *   - u is a part of at least one active Competition
   *   - `dateStr` is a valid date string parseable into a `Date`.
   *   - `eventType` is either `SleepEventType.BEDTIME` or `SleepEventType.WAKETIME`.
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
    const scoreFieldName = eventType === SleepEventType.BEDTIME
      ? "bedTimeScore"
      : "wakeUpScore";

    const updatePromises = activeCompetitions.map((comp) =>
      this.scores.updateOne(
        { u, competition: comp._id },
        { $inc: { [scoreFieldName]: scoreChange } },
      )
    );

    await Promise.all(updatePromises);

    return {};
  }

  /**
   * @action endCompetition
   * @requires:
   *   - current date is greater than or equal to the endDate of Competition c
   *   - c.active must be true
   * @effects:
   *   - return the User IDs of the users in competition c with the greatest sum of wakeUpScore + bedTimeScore and set this ID to the winner state (if tie among all participants keep winner as null)
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
      // but as a safety, if no scores are found (e.g., all removed), treat as no winners.
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
   *   - Returns `rankedLeaderboard`.
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

    const userTotalScores: Map<User, number> = new Map();
    // Populate scores from DB. I3 guarantees entries exist for all participants.
    for (const score of participantScores) {
      userTotalScores.set(score.u, score.wakeUpScore + score.bedTimeScore);
    }

    // Create leaderboard entries, defaulting to 0 if a participant mysteriously lacks a score entry (safety)
    const leaderboardEntries: { userId: User; totalScore: number }[] =
      competition.participants.map((u) => ({
        userId: u,
        totalScore: userTotalScores.get(u) || 0, // Default to 0 if no score found (shouldn't happen with I3)
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
      // If current score is less than last score (or first entry), increment position
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

    return rankedLeaderboard;
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
    // Requirement: `c.participants.size()` must be greater than 1 before removal.
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

# file: src/CompetitionManager/CompetitionManagerConcept.test.ts

```typescript
import { Db } from "npm:mongodb";
import { assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import CompetitionManagerConcept from "./CompetitionManagerConcept.ts";

// Helper to create user IDs for testing
const user = (name: string): ID => `user:${name}` as ID;

// Enum needs to be accessible in tests, matches the one in the concept file
enum SleepEventType {
  BEDTIME = "BEDTIME",
  WAKETIME = "WAKETIME",
}

Deno.test("CompetitionManager Concept Tests", async (t) => {
  let db: Db;
  let client: any; // MongoClient type from npm:mongodb, but any for simplicity here
  let concept: CompetitionManagerConcept;

  // This hook runs before each t.step block, providing a clean state for the concept and database.
  Deno.test.beforeEach(async () => {
    [db, client] = await testDb();
    concept = new CompetitionManagerConcept(db);
    // console.log("Database and concept initialized for a new test step.");
  });

  Deno.test.afterEach(async () => {
    if (client) {
      await client.close();
      // console.log("Database client closed after test step.");
    }
  });

  // trace: Operational Principle Test
  // Demonstrates the full lifecycle: start, record stats, get leaderboard, end, get final leaderboard.
  await t.step("Operational Principle: Full competition lifecycle and leaderboard", async () => {
    console.log("\n--- Starting Operational Principle Test ---");

    const userAlice = user("Alice");
    const userBob = user("Bob");
    const userCharlie = user("Charlie");

    // Dates in the past to ensure `endCompetition` can be called immediately
    const startDateStr = "2023-01-01";
    const endDateStr = "2023-01-05"; // End date is in the past

    const competitionParticipants = [userAlice, userBob, userCharlie];

    // 1. Start Competition
    console.log(
      `Action: startCompetition(${JSON.stringify({ participants: competitionParticipants, startDateStr, endDateStr })})`,
    );
    const startResult = await concept.startCompetition({
      participants: competitionParticipants,
      startDateStr,
      endDateStr,
    });
    console.log(`Result: ${JSON.stringify(startResult)}`);
    assertEquals(typeof startResult, "object");
    assertEquals("competitionId" in startResult, true, "startCompetition should return a competitionId.");
    const compId = (startResult as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId} started.`);

    // Verify competition created and active
    let competition = await concept.competitions.findOne({ _id: compId });
    assertEquals(competition?.active, true, `Competition ${compId} should be active after creation.`);
    assertEquals(competition?.participants.length, 3, `Competition ${compId} should have 3 participants.`);
    assertEquals(competition?.winners, null, `Competition ${compId} winners should be null initially.`);

    // Verify initial scores are 0 for all participants
    let scores = await concept.scores.find({ competition: compId }).toArray();
    assertEquals(scores.length, 3, `Expected 3 score entries for competition ${compId}.`);
    for (const s of scores) {
      assertEquals(s.wakeUpScore, 0, `Initial wakeUpScore for ${s.u} should be 0.`);
      assertEquals(s.bedTimeScore, 0, `Initial bedTimeScore for ${s.u} should be 0.`);
    }
    console.log("Competition started and initial scores verified.");

    // 2. Record Stats to build up scores over a couple of days
    // Day 1 (2023-01-01): Alice +1 Bedtime, Bob +1 Waketime, Charlie -1 Bedtime
    console.log("\n--- Recording Stats for Day 1 (2023-01-01) ---");
    await concept.recordStat({ u: userAlice, dateStr: "2023-01-01", eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userBob, dateStr: "2023-01-01", eventType: SleepEventType.WAKETIME, success: true });
    await concept.recordStat({ u: userCharlie, dateStr: "2023-01-01", eventType: SleepEventType.BEDTIME, success: false });

    // Day 2 (2023-01-02): Alice +1 Waketime, Bob -1 Bedtime
    console.log("\n--- Recording Stats for Day 2 (2023-01-02) ---");
    await concept.recordStat({ u: userAlice, dateStr: "2023-01-02", eventType: SleepEventType.WAKETIME, success: true });
    await concept.recordStat({ u: userBob, dateStr: "2023-01-02", eventType: SleepEventType.BEDTIME, success: false });

    // Expected Scores by end of Day 2:
    // Alice: BT=1 (from Day1), WT=1 (from Day2) => Total=2
    // Bob: BT=-1 (from Day2), WT=1 (from Day1) => Total=0
    // Charlie: BT=-1 (from Day1), WT=0 => Total=-1

    // Verify scores after recording
    scores = await concept.scores.find({ competition: compId }).toArray();
    const aliceScore = scores.find((s) => s.u === userAlice);
    const bobScore = scores.find((s) => s.u === userBob);
    const charlieScore = scores.find((s) => s.u === userCharlie);

    assertEquals(aliceScore?.bedTimeScore, 1, `Alice's bedTimeScore should be 1.`);
    assertEquals(aliceScore?.wakeUpScore, 1, `Alice's wakeUpScore should be 1.`);
    assertEquals(bobScore?.bedTimeScore, -1, `Bob's bedTimeScore should be -1.`);
    assertEquals(bobScore?.wakeUpScore, 1, `Bob's wakeUpScore should be 1.`);
    assertEquals(charlieScore?.bedTimeScore, -1, `Charlie's bedTimeScore should be -1.`);
    assertEquals(charlieScore?.wakeUpScore, 0, `Charlie's wakeUpScore should be 0.`);
    console.log("Scores updated and verified after recording stats.");

    // 3. Get Leaderboard (mid-competition)
    console.log("\n--- Getting Leaderboard Mid-Competition ---");
    const midLeaderboardResult = await concept._getLeaderboard({ competitionId: compId });
    assertEquals(Array.isArray(midLeaderboardResult), true, "Leaderboard should be an array.");
    const midLeaderboard = midLeaderboardResult as { position: number; userId: ID; totalScore: number }[];
    console.log(`Result: ${JSON.stringify(midLeaderboard)}`);
    const expectedMidLeaderboard = [
      { position: 1, userId: userAlice, totalScore: 2 },
      { position: 2, userId: userBob, totalScore: 0 },
      { position: 3, userId: userCharlie, totalScore: -1 },
    ];
    assertEquals(midLeaderboard, expectedMidLeaderboard, "Mid-competition leaderboard should match expected ranking.");
    console.log("Mid-competition leaderboard verified.");

    // 4. End Competition (current date is assumed to be >= endDate based on past date choice)
    console.log("\n--- Ending Competition ---");
    const endResult = await concept.endCompetition({ competitionId: compId });
    console.log(`Result: ${JSON.stringify(endResult)}`);
    assertEquals(typeof endResult, "object");
    assertEquals("winners" in endResult, true, "endCompetition should return winners.");
    assertEquals(
      (endResult as { winners: ID[] | null }).winners,
      [userAlice],
      "Alice should be the sole winner as per scores.",
    );

    // Verify competition is inactive and winners are set in the database
    competition = await concept.competitions.findOne({ _id: compId });
    assertEquals(competition?.active, false, `Competition ${compId} should be inactive after ending.`);
    assertEquals(competition?.winners, [userAlice], `Competition ${compId} winners should be Alice in DB.`);
    console.log("Competition ended and winner verified in DB.");

    // 5. Get Leaderboard (post-competition)
    console.log("\n--- Getting Leaderboard Post-Competition ---");
    const postLeaderboardResult = await concept._getLeaderboard({ competitionId: compId });
    assertEquals(Array.isArray(postLeaderboardResult), true, "Post-competition leaderboard should be an array.");
    const postLeaderboard = postLeaderboardResult as { position: number; userId: ID; totalScore: number }[];
    console.log(`Result: ${JSON.stringify(postLeaderboard)}`);
    // Leaderboard should remain the same, as scores don't change after ending.
    assertEquals(postLeaderboard, expectedMidLeaderboard, "Post-competition leaderboard should match expected ranking.");
    console.log("Post-competition leaderboard verified.");

    console.log("\n--- Operational Principle Test Complete ---");
  });

  // Scenario 1: Overlapping Competitions Allowed
  // Tests if a user can participate in multiple active competitions whose date ranges overlap.
  await t.step("Scenario 1: Overlapping Competitions Allowed (for a user)", async () => {
    console.log("\n--- Starting Scenario 1 Test (Overlapping Competitions) ---");

    const userA = user("Alpha");
    const userB = user("Beta");
    const userC = user("Gamma");

    // Comp 1: Jan 1 - Jan 10 (userA, userB)
    const startDate1 = "2023-01-01";
    const endDate1 = "2023-01-10";
    const participants1 = [userA, userB];

    console.log(
      `Action: startCompetition (Comp1) for ${JSON.stringify(participants1)} from ${startDate1} to ${endDate1}`,
    );
    const res1 = await concept.startCompetition({
      participants: participants1,
      startDateStr: startDate1,
      endDateStr: endDate1,
    });
    console.log(`Result: ${JSON.stringify(res1)}`);
    assertEquals("competitionId" in res1, true, "First competition should start successfully.");
    const compId1 = (res1 as { competitionId: ID }).competitionId;
    let comp1InDb = await concept.competitions.findOne({ _id: compId1 });
    assertEquals(comp1InDb?.active, true, `Competition ${compId1} should be active.`);
    console.log(`Competition ${compId1} started successfully.`);

    // Comp 2: Jan 5 - Jan 15 (userA, userC) - overlaps with Comp 1, userA is in both
    const startDate2 = "2023-01-05";
    const endDate2 = "2023-01-15";
    const participants2 = [userA, userC];

    console.log(
      `Action: startCompetition (Comp2) for ${JSON.stringify(participants2)} from ${startDate2} to ${endDate2}`,
    );
    const res2 = await concept.startCompetition({
      participants: participants2,
      startDateStr: startDate2,
      endDateStr: endDate2,
    });
    console.log(`Result: ${JSON.stringify(res2)}`);
    assertEquals("competitionId" in res2, true, "Second (overlapping) competition should start successfully.");
    const compId2 = (res2 as { competitionId: ID }).competitionId;
    let comp2InDb = await concept.competitions.findOne({ _id: compId2 });
    assertEquals(comp2InDb?.active, true, `Competition ${compId2} should be active.`);
    console.log(`Competition ${compId2} (overlapping) started successfully.`);

    // Verify both competitions are active and exist with correct participants
    assertEquals(comp1InDb?.participants.includes(userA), true, `Comp1 should include ${userA}.`);
    assertEquals(comp1InDb?.participants.includes(userB), true, `Comp1 should include ${userB}.`);
    assertEquals(comp2InDb?.participants.includes(userA), true, `Comp2 should include ${userA}.`);
    assertEquals(comp2InDb?.participants.includes(userC), true, `Comp2 should include ${userC}.`);

    // Verify scores exist for userA in both competitions (as per I3)
    const userAScoresComp1 = await concept.scores.findOne({ u: userA, competition: compId1 });
    const userAScoresComp2 = await concept.scores.findOne({ u: userA, competition: compId2 });
    assertEquals(userAScoresComp1 !== null, true, `User ${userA} should have scores for ${compId1}.`);
    assertEquals(userAScoresComp2 !== null, true, `User ${userA} should have scores for ${compId2}.`);
    console.log(`User ${userA} has score entries in both overlapping competitions, as expected.`);

    console.log("\n--- Scenario 1 Test Complete ---");
  });

  // Scenario 2: Score Update Outside Competition Period
  // Tests if `recordStat` correctly rejects events outside the competition's defined date range.
  await t.step("Scenario 2: Score Update Outside Competition Period", async () => {
    console.log("\n--- Starting Scenario 2 Test (Score Update Outside Period) ---");

    const userX = user("Xavier");
    const userY = user("Yara");

    const startDate = "2023-03-05";
    const endDate = "2023-03-10";
    const participants = [userX, userY];

    const startRes = await concept.startCompetition({
      participants,
      startDateStr: startDate,
      endDateStr: endDate,
    });
    assertEquals("competitionId" in startRes, true, "Competition should start successfully.");
    const compId = (startRes as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId} started from ${startDate} to ${endDate}.`);

    // Attempt to record stat BEFORE start date
    const beforeStartDate = "2023-03-01";
    console.log(
      `Action: recordStat for ${userX} on ${beforeStartDate} (before start date)`,
    );
    const recordResult1 = await concept.recordStat({
      u: userX,
      dateStr: beforeStartDate,
      eventType: SleepEventType.BEDTIME,
      success: true,
    });
    console.log(`Result: ${JSON.stringify(recordResult1)}`);
    assertEquals("error" in recordResult1, true, "Recording before start date should return an error.");
    assertEquals(
      (recordResult1 as { error: string }).error,
      "User is not part of any active competition for the specified date, or the event date is outside the competition range.",
      "Error message for before-start-date should match expected.",
    );
    console.log("Record stat before start date correctly failed.");

    // Attempt to record stat AFTER end date
    const afterEndDate = "2023-03-12";
    console.log(
      `Action: recordStat for ${userX} on ${afterEndDate} (after end date)`,
    );
    const recordResult2 = await concept.recordStat({
      u: userX,
      dateStr: afterEndDate,
      eventType: SleepEventType.WAKETIME,
      success: false,
    });
    console.log(`Result: ${JSON.stringify(recordResult2)}`);
    assertEquals("error" in recordResult2, true, "Recording after end date should return an error.");
    assertEquals(
      (recordResult2 as { error: string }).error,
      "User is not part of any active competition for the specified date, or the event date is outside the competition range.",
      "Error message for after-end-date should match expected.",
    );
    console.log("Record stat after end date correctly failed.");

    // Verify scores remain 0 for userX in competition compId
    const userXScore = await concept.scores.findOne({ u: userX, competition: compId });
    assertEquals(userXScore?.bedTimeScore, 0, `User ${userX}'s bedTimeScore should still be 0.`);
    assertEquals(userXScore?.wakeUpScore, 0, `User ${userX}'s wakeUpScore should still be 0.`);
    console.log(`Scores for user ${userX} remained 0, as expected.`);

    console.log("\n--- Scenario 2 Test Complete ---");
  });

  // Scenario 3: Tie Across All Participants at End
  // Tests `endCompetition` behavior when all participants have the same total score.
  await t.step("Scenario 3: Tie Across All Participants at End", async () => {
    console.log("\n--- Starting Scenario 3 Test (Full Tie) ---");

    const userP = user("Paul");
    const userQ = user("Quinn");

    const startDate = "2023-04-01";
    const endDate = "2023-04-05"; // In the past for immediate ending
    const participants = [userP, userQ];

    const startRes = await concept.startCompetition({
      participants,
      startDateStr: startDate,
      endDateStr: endDate,
    });
    assertEquals("competitionId" in startRes, true, "Competition should start successfully.");
    const compId = (startRes as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId} started.`);

    // Record stats to ensure a tie (both get a total score of 2)
    // Paul: +1 BT, +1 WT (Total 2)
    await concept.recordStat({ u: userP, dateStr: "2023-04-02", eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userP, dateStr: "2023-04-03", eventType: SleepEventType.WAKETIME, success: true });

    // Quinn: +1 BT, +1 WT (Total 2)
    await concept.recordStat({ u: userQ, dateStr: "2023-04-02", eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userQ, dateStr: "2023-04-03", eventType: SleepEventType.WAKETIME, success: true });
    console.log("Scores recorded to create a tie situation (Paul: 2, Quinn: 2).");

    const midLeaderboardResult = await concept._getLeaderboard({ competitionId: compId });
    assertEquals(Array.isArray(midLeaderboardResult), true, "Leaderboard should be an array.");
    const leaderboard = midLeaderboardResult as { position: number; userId: ID; totalScore: number }[];
    console.log(`Mid-competition Leaderboard: ${JSON.stringify(leaderboard)}`);
    assertEquals(leaderboard.length, 2, "Leaderboard should contain 2 entries.");
    assertEquals(leaderboard[0].totalScore, 2, `Leaderboard top score should be 2.`);
    assertEquals(leaderboard[1].totalScore, 2, `Leaderboard second score should be 2.`);
    // For a tie, both should have position 1 as per the tie-handling logic.
    assertEquals(leaderboard[0].position, 1, `Leaderboard top position should be 1 (due to tie).`);
    assertEquals(leaderboard[1].position, 1, `Leaderboard second position should be 1 (due to tie).`);

    // End competition (assuming current date is >= endDate)
    console.log("\n--- Ending Competition with Tie ---");
    const endResult = await concept.endCompetition({ competitionId: compId });
    console.log(`Result: ${JSON.stringify(endResult)}`);
    assertEquals("winners" in endResult, true);
    assertEquals((endResult as { winners: ID[] | null }).winners, null, "Winners should be null for a full tie.");
    console.log("Competition ended, winners correctly null due to full tie.");

    // Verify competition state in DB
    const competition = await concept.competitions.findOne({ _id: compId });
    assertEquals(competition?.active, false, `Competition ${compId} should be inactive after ending.`);
    assertEquals(competition?.winners, null, `Competition ${compId} winners should be null in DB.`);
    console.log("Competition active status and winners field verified in DB.");

    // Verify post-end leaderboard still shows scores
    const postLeaderboardResult = await concept._getLeaderboard({ competitionId: compId });
    assertEquals(Array.isArray(postLeaderboardResult), true, "Post-end leaderboard should still contain 2 entries.");
    const postLeaderboard = postLeaderboardResult as { position: number; userId: ID; totalScore: number }[];
    assertEquals(postLeaderboard[0].totalScore, 2, `Post-end leaderboard top score should be 2.`);
    assertEquals(postLeaderboard[1].totalScore, 2, `Post-end leaderboard second score should be 2.`);
    console.log("Post-competition leaderboard still reflects tied scores.");

    console.log("\n--- Scenario 3 Test Complete ---");
  });

  // Scenario 4: Removing Participant to Invalidate Competition
  // Tests `removeParticipant` leading to competition deactivation and edge cases with participant counts.
  await t.step("Scenario 4: Removing Participant to Invalidate Competition", async () => {
    console.log("\n--- Starting Scenario 4 Test (Removing Participant) ---");

    const userR = user("Rita");
    const userS = user("Sam");
    const userT = user("Tom");

    // Start a competition with 3 participants
    const startRes1 = await concept.startCompetition({
      participants: [userR, userS, userT],
      startDateStr: "2023-05-01",
      endDateStr: "2023-05-07",
    });
    assertEquals("competitionId" in startRes1, true, "First competition should start successfully.");
    const compId1 = (startRes1 as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId1} started with 3 participants (${userR}, ${userS}, ${userT}).`);

    // Record some stats for userT to ensure their score exists before removal
    await concept.recordStat({ u: userT, dateStr: "2023-05-02", eventType: SleepEventType.BEDTIME, success: true });
    let userTScoreBeforeRemoval = await concept.scores.findOne({ u: userT, competition: compId1 });
    assertEquals(userTScoreBeforeRemoval?.bedTimeScore, 1, "User T's score initialized correctly.");

    // Remove one participant (userT) - competition should remain active as 2 participants are left
    console.log(`Action: removeParticipant for ${userT} from ${compId1} (leaving 2 participants)`);
    const removeRes1 = await concept.removeParticipant({
      competitionId: compId1,
      userId: userT,
    });
    console.log(`Result: ${JSON.stringify(removeRes1)}`);
    assertEquals("error" in removeRes1, false, "Removing userT should not return an error.");
    console.log(`User ${userT} removed. Competition ${compId1} should still be active with 2 participants.`);

    let competition1 = await concept.competitions.findOne({ _id: compId1 });
    assertEquals(competition1?.active, true, `Competition ${compId1} should still be active.`);
    assertEquals(competition1?.participants.length, 2, `Competition ${compId1} should have 2 participants.`);
    assertEquals(competition1?.participants.includes(userT), false, `Competition ${compId1} should not include ${userT}.`);
    // Verify userT's score is gone
    const userTScoreAfterRemoval = await concept.scores.findOne({ u: userT, competition: compId1 });
    assertEquals(userTScoreAfterRemoval, null, `User ${userT}'s score entry should be removed.`);
    console.log("User T's score entry correctly removed.");

    // Now remove another participant (userS), leaving only 1, which should deactivate the competition
    console.log(`Action: removeParticipant for ${userS} from ${compId1} (leaving 1 participant)`);
    const removeRes2 = await concept.removeParticipant({
      competitionId: compId1,
      userId: userS,
    });
    console.log(`Result: ${JSON.stringify(removeRes2)}`);
    assertEquals("error" in removeRes2, false, "Removing userS should not return an error.");
    console.log(`User ${userS} removed. Competition ${compId1} should now be inactive.`);

    competition1 = await concept.competitions.findOne({ _id: compId1 });
    assertEquals(competition1?.active, false, `Competition ${compId1} should now be inactive.`); // Expect inactive
    assertEquals(competition1?.winners, null, `Competition ${compId1} winners should be null.`); // Expect winners null
    assertEquals(competition1?.participants.length, 1, `Competition ${compId1} should have 1 participant remaining.`); // Only userR remains
    assertEquals(competition1?.participants.includes(userS), false, `Competition ${compId1} should not include ${userS}.`);
    const userSScoreAfterRemoval = await concept.scores.findOne({ u: userS, competition: compId1 });
    assertEquals(userSScoreAfterRemoval, null, `User ${userS}'s score entry should be removed.`);
    console.log("User S removed, competition correctly deactivated and winners null.");

    // Attempt to remove the last participant (userR) from the now 1-participant competition
    console.log(`Action: removeParticipant for ${userR} from ${compId1} (should fail as only 1 participant)`);
    const removeRes3 = await concept.removeParticipant({
      competitionId: compId1,
      userId: userR,
    });
    console.log(`Result: ${JSON.stringify(removeRes3)}`);
    assertEquals("error" in removeRes3, true, "Attempt to remove last participant should return an error.");
    assertEquals(
      (removeRes3 as { error: string }).error,
      `Cannot remove participant from competition ${compId1}: it must have more than 1 participant.`,
      "Error message for removing last participant should match.",
    );
    console.log("Removing the last participant correctly failed as per requirement.");

    // Start a fresh competition with exactly 2 participants, then remove one to see immediate deactivation
    const userU = user("Uma");
    const userV = user("Victor");
    const startRes2 = await concept.startCompetition({
      participants: [userU, userV],
      startDateStr: "2023-06-01",
      endDateStr: "2023-06-05",
    });
    assertEquals("competitionId" in startRes2, true, "Second competition should start successfully.");
    const compId2 = (startRes2 as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId2} started with 2 participants (${userU}, ${userV}).`);

    // Remove one participant (userU) - should deactivate immediately as only 1 remains
    console.log(`Action: removeParticipant for ${userU} from ${compId2} (leaving 1 participant)`);
    const removeRes4 = await concept.removeParticipant({
      competitionId: compId2,
      userId: userU,
    });
    console.log(`Result: ${JSON.stringify(removeRes4)}`);
    assertEquals("error" in removeRes4, false, "Removing userU should not return an error.");
    console.log(`User ${userU} removed. Competition ${compId2} should now be inactive.`);

    let competition2 = await concept.competitions.findOne({ _id: compId2 });
    assertEquals(competition2?.active, false, `Competition ${compId2} should be inactive.`); // Expect inactive
    assertEquals(competition2?.winners, null, `Competition ${compId2} winners should be null.`); // Expect winners null
    assertEquals(competition2?.participants.length, 1, `Competition ${compId2} should have 1 participant remaining.`); // Only userV remains
    assertEquals(competition2?.participants.includes(userU), false, `Competition ${compId2} should not include ${userU}.`);
    console.log(
      "From 2 participants, removing one correctly deactivated competition as expected.",
    );

    console.log("\n--- Scenario 4 Test Complete ---");
  });

  // Scenario 5: Repeated or Conflicting Actions (recordStat)
  // Tests if `recordStat` correctly accumulates scores with repeated or mixed success/failure events for the same day.
  await t.step("Scenario 5: Repeated or Conflicting RecordStat Actions", async () => {
    console.log("\n--- Starting Scenario 5 Test (Repeated RecordStat) ---");

    const userM = user("Mike");
    const userN = user("Nancy");

    const startDate = "2023-07-01";
    const endDate = "2023-07-07";
    const eventDate = "2023-07-03"; // A date within the competition period

    const startRes = await concept.startCompetition({
      participants: [userM, userN],
      startDateStr: startDate,
      endDateStr: endDate,
    });
    assertEquals("competitionId" in startRes, true, "Competition should start successfully.");
    const compId = (startRes as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId} started.`);

    // Initial state: Mike's scores are 0, 0
    let mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
    assertEquals(mikeScore?.bedTimeScore, 0, "Initial bedTimeScore for Mike should be 0.");
    assertEquals(mikeScore?.wakeUpScore, 0, "Initial wakeUpScore for Mike should be 0.");
    console.log("Initial scores for Mike verified.");

    // 1. Record BEDTIME success (+1)
    console.log(
      `Action: recordStat for ${userM} on ${eventDate}, BEDTIME success (+1)`,
    );
    await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true });
    mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
    assertEquals(mikeScore?.bedTimeScore, 1, "Mike's bedTimeScore should be 1 after first success.");
    assertEquals(mikeScore?.wakeUpScore, 0, "Mike's wakeUpScore should remain 0.");
    console.log("Bedtime +1 verified (Mike's scores: BT=1, WT=0).");

    // 2. Repeat BEDTIME success (+1)
    console.log(
      `Action: recordStat for ${userM} on ${eventDate}, BEDTIME success (+1 again)`,
    );
    await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true });
    mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
    assertEquals(mikeScore?.bedTimeScore, 2, "Mike's bedTimeScore should be 2 after second success.");
    assertEquals(mikeScore?.wakeUpScore, 0, "Mike's wakeUpScore should remain 0.");
    console.log("Bedtime +1 (repeated) verified (Mike's scores: BT=2, WT=0).");

    // 3. Record BEDTIME failure (-1)
    console.log(
      `Action: recordStat for ${userM} on ${eventDate}, BEDTIME failure (-1)`,
    );
    await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: false });
    mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
    assertEquals(mikeScore?.bedTimeScore, 1, "Mike's bedTimeScore should be 1 after failure (2-1=1).");
    assertEquals(mikeScore?.wakeUpScore, 0, "Mike's wakeUpScore should remain 0.");
    console.log("Bedtime -1 verified (Mike's scores: BT=1, WT=0).");

    // 4. Record WAKETIME success (+1)
    console.log(
      `Action: recordStat for ${userM} on ${eventDate}, WAKETIME success (+1)`,
    );
    await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.WAKETIME, success: true });
    mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
    assertEquals(mikeScore?.bedTimeScore, 1, "Mike's bedTimeScore should remain 1.");
    assertEquals(mikeScore?.wakeUpScore, 1, "Mike's wakeUpScore should be 1 after waketime success.");
    console.log("Waketime +1 verified (Mike's scores: BT=1, WT=1).");

    console.log("\n--- Scenario 5 Test Complete ---");
  });
});
```
# response:

To ensure concepts are independent, it's crucial to adhere to several design principles:

1.  **Strict Separation of State**: Each concept manages its own distinct portion of the application state. While different concepts might refer to the same logical entities (e.g., `User` IDs), they only store the attributes of those entities relevant to their specific purpose. There should be no shared mutable state that one concept can directly read from or write to another concept's internal data model. This prevents implicit dependencies and unexpected side effects.

2.  **Generic Type Parameters**: Concepts should be designed using generic type parameters (e.g., `[User, Target, Item]`). These parameters represent opaque identifiers that the concept can store and compare for equality but cannot inspect for internal structure or specific properties. This forces concepts to operate polymorphically, ensuring they don't depend on the concrete types or schemas managed by other concepts.

3.  **Well-Defined, Singular Purpose**: Each concept must have a narrow, clearly articulated, and user-centric purpose. This helps to prevent "feature creep" and ensures that a concept doesn't accumulate responsibilities that rightfully belong to other concepts. A focused purpose acts as a boundary, making it easier to reason about the concept in isolation.

4.  **Behavioral Completeness**: Within its defined purpose, a concept must be behaviorally complete. It should encapsulate all necessary actions and queries to fulfill its purpose without requiring direct invocation of another concept's internal logic. If interaction with other concerns is needed, it should happen through a higher-level orchestration layer (like a synchronization mechanism) that passes generic identifiers and uses defined action/query interfaces.

5.  **Actions as Pre/Post Conditions on Own State**: The `requires` (preconditions) and `effects` (postconditions) for each action must exclusively refer to the concept's own internal state and its generic input/output parameters. They should never mention or attempt to modify the state of another concept. This declarative style reinforces isolation by strictly defining the boundaries of an action's impact.

6.  **No Direct Inter-Concept Imports**: At the implementation level, a concept's code should avoid direct import statements that reference other concept implementations. This prevents compile-time and runtime coupling, reinforcing the idea that concepts are independent units.

By diligently applying these principles, concepts become highly decoupled, reusable, and easier to understand, test, and maintain in isolation, which is a core tenet of concept-oriented design.

***

# file: src/CompetitionManager/CompetitionManagerConcept.ts

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
export enum SleepEventType { // Exported for use in tests
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
 */
interface Score {
  _id: ID; // Unique ID for each score document
  u: User;
  competition: CompetitionId; // Reference to Competition._id
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
   *   - participants must contain at least two distinct User's
   *   - `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
   *   - The parsed `startDate` must logically precede or be equal to the parsed `endDate`.
   * @effects:
   *   - Parses `startDateStr` and `endDateStr` into `Date` objects: `startDate`, `endDate`.
   *   - creates a Competition with participates, startDate, endDate, a true active flag, a null winner.
   *   - Also, it creates a Score for each User in participants with wakeUpScore and bedTimeScore of zero and it is associated with the created competition.
   *   - returns the id of the Competition
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
      return { error: "Participants must contain at least two distinct users." };
    }
    // Check for distinct participants
    if (new Set(participants).size !== participants.length) {
      return { error: "Participants must be distinct." };
    }

    let startDate: Date;
    let endDate: Date;
    try {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { error: "Invalid startDateStr or endDateStr." };
      }
    } catch (_e) {
      return { error: "Invalid startDateStr or endDateStr." };
    }

    // Normalize dates to start of day for comparison, as time components are generally ignored.
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
   *   - u is a part of at least one active Competition
   *   - `dateStr` is a valid date string parseable into a `Date`.
   *   - `eventType` is either `SleepEventType.BEDTIME` or `SleepEventType.WAKETIME`.
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
      participants: u, // Ensures user is a participant
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
    const scoreFieldName = eventType === SleepEventType.BEDTIME
      ? "bedTimeScore"
      : "wakeUpScore";

    const updatePromises = activeCompetitions.map((comp) =>
      this.scores.updateOne(
        { u, competition: comp._id },
        { $inc: { [scoreFieldName]: scoreChange } },
      )
    );

    await Promise.all(updatePromises);

    return {};
  }

  /**
   * @action endCompetition
   * @requires:
   *   - current date is greater than or equal to the endDate of Competition c
   *   - c.active must be true
   * @effects:
   *   - return the User IDs of the users in competition c with the greatest sum of wakeUpScore + bedTimeScore and set this ID to the winner state (if tie among all participants keep winner as null)
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
    currentDate.setUTCHours(0, 0, 0, 0); // Normalize to date only

    // `competition.endDate` is stored as normalized date (00:00:00.000Z).
    // The requirement states `current date is greater than or equal to the endDate`.
    // So, if currentDate is 2023-01-05 00:00:00.000Z and competition.endDate is 2023-01-05 00:00:00.000Z, it's valid.
    // If currentDate is 2023-01-04 23:59:59.999Z, and competition.endDate is 2023-01-05 00:00:00.000Z, it's not valid.
    if (currentDate < competition.endDate) {
      return {
        error: `Competition ${competitionId} has not ended yet. End date is ${
          competition.endDate.toDateString()
        }.`,
      };
    }

    // Calculate total scores for all participants
    const participantScores = await this.scores.find({
      competition: competitionId,
    }).toArray();

    // If no scores exist (e.g., all participants removed, though I3 should prevent this if participants exist),
    // treat as no winners.
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

    let potentialWinners: User[] = [];
    for (const [user, totalScore] of userTotalScores.entries()) {
      if (totalScore === maxScore) {
        potentialWinners.push(user);
      }
    }

    // If all participants have the same max score (a tie among all), winners should be null.
    // Otherwise, the subset with the max score are the winners.
    const allParticipantsTied = potentialWinners.length > 0 &&
      potentialWinners.length === competition.participants.length;
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
   *   - Returns `rankedLeaderboard`.
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

    const userTotalScores: Map<User, number> = new Map();
    // Populate scores from DB. I3 guarantees entries exist for all participants.
    // However, as a safety measure, we'll map to 0 if a score is unexpectedly missing.
    for (const score of participantScores) {
      userTotalScores.set(score.u, score.wakeUpScore + score.bedTimeScore);
    }

    // Create leaderboard entries, defaulting to 0 if a participant mysteriously lacks a score entry (safety)
    const leaderboardEntries: { userId: User; totalScore: number }[] =
      competition.participants.map((u) => ({
        userId: u,
        totalScore: userTotalScores.get(u) || 0, // Default to 0 if no score found (shouldn't happen with I3)
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
      // If current score is less than last score (or first entry), increment position
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

    return rankedLeaderboard;
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
    // Requirement: `c.participants.size()` must be greater than 1 before removal.
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

# file: src/CompetitionManager/CompetitionManagerConcept.test.ts

```typescript
import { Db } from "npm:mongodb";
import { assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import CompetitionManagerConcept, { SleepEventType } from "./CompetitionManagerConcept.ts"; // Import SleepEventType

// Helper to create user IDs for testing
const user = (name: string): ID => `user:${name}` as ID;

Deno.test("CompetitionManager Concept Tests", async (t) => {
  let db: Db;
  let client: any; // MongoClient type from npm:mongodb, but any for simplicity here
  let concept: CompetitionManagerConcept;

  // This hook runs before each top-level or nested test step (t.step).
  // It ensures a fresh database connection and concept instance for each test.
  // The database itself is guaranteed to be dropped before the entire test file starts
  // by Deno's global hook (as per the prompt), so each t.step implicitly starts clean.
  Deno.test.beforeEach(async () => {
    [db, client] = await testDb();
    concept = new CompetitionManagerConcept(db);
    console.log("Database and concept initialized for a new test step.");
  });

  Deno.test.afterEach(async () => {
    if (client) {
      await client.close();
      console.log("Database client closed after test step.");
    }
  });

  // trace: Operational Principle Test
  // Demonstrates the full lifecycle: start, record stats, get leaderboard, end, get final leaderboard.
  await t.step("Operational Principle: Full competition lifecycle and leaderboard", async () => {
    console.log("\n--- Starting Operational Principle Test ---");

    const userAlice = user("Alice");
    const userBob = user("Bob");
    const userCharlie = user("Charlie");

    // Dates in the past to ensure `endCompetition` can be called immediately
    const startDateStr = "2023-01-01";
    const endDateStr = "2023-01-05"; // End date is in the past

    const competitionParticipants = [userAlice, userBob, userCharlie];

    // 1. Start Competition
    console.log(
      `Action: startCompetition(${JSON.stringify({ participants: competitionParticipants, startDateStr, endDateStr })})`,
    );
    const startResult = await concept.startCompetition({
      participants: competitionParticipants,
      startDateStr,
      endDateStr,
    });
    console.log(`Result: ${JSON.stringify(startResult)}`);
    assertEquals(typeof startResult, "object");
    assertEquals("competitionId" in startResult, true, "startCompetition should return a competitionId.");
    const compId = (startResult as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId} started.`);

    // Verify competition created and active
    let competition = await concept.competitions.findOne({ _id: compId });
    assertEquals(competition?.active, true, `Competition ${compId} should be active after creation.`);
    assertEquals(competition?.participants.length, 3, `Competition ${compId} should have 3 participants.`);
    assertEquals(competition?.winners, null, `Competition ${compId} winners should be null initially.`);

    // Verify initial scores are 0 for all participants
    let scores = await concept.scores.find({ competition: compId }).toArray();
    assertEquals(scores.length, 3, `Expected 3 score entries for competition ${compId}.`);
    for (const s of scores) {
      assertEquals(s.wakeUpScore, 0, `Initial wakeUpScore for ${s.u} should be 0.`);
      assertEquals(s.bedTimeScore, 0, `Initial bedTimeScore for ${s.u} should be 0.`);
    }
    console.log("Competition started and initial scores verified.");

    // 2. Record Stats to build up scores over a couple of days
    // Day 1 (2023-01-01): Alice +1 Bedtime, Bob +1 Waketime, Charlie -1 Bedtime
    console.log("\n--- Recording Stats for Day 1 (2023-01-01) ---");
    await concept.recordStat({ u: userAlice, dateStr: "2023-01-01", eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userBob, dateStr: "2023-01-01", eventType: SleepEventType.WAKETIME, success: true });
    await concept.recordStat({ u: userCharlie, dateStr: "2023-01-01", eventType: SleepEventType.BEDTIME, success: false });

    // Day 2 (2023-01-02): Alice +1 Waketime, Bob -1 Bedtime
    console.log("\n--- Recording Stats for Day 2 (2023-01-02) ---");
    await concept.recordStat({ u: userAlice, dateStr: "2023-01-02", eventType: SleepEventType.WAKETIME, success: true });
    await concept.recordStat({ u: userBob, dateStr: "2023-01-02", eventType: SleepEventType.BEDTIME, success: false });

    // Expected Scores by end of Day 2:
    // Alice: BT=1 (from Day1), WT=1 (from Day2) => Total=2
    // Bob: BT=-1 (from Day2), WT=1 (from Day1) => Total=0
    // Charlie: BT=-1 (from Day1), WT=0 => Total=-1

    // Verify scores after recording
    scores = await concept.scores.find({ competition: compId }).toArray();
    const aliceScore = scores.find((s) => s.u === userAlice);
    const bobScore = scores.find((s) => s.u === userBob);
    const charlieScore = scores.find((s) => s.u === userCharlie);

    assertEquals(aliceScore?.bedTimeScore, 1, `Alice's bedTimeScore should be 1.`);
    assertEquals(aliceScore?.wakeUpScore, 1, `Alice's wakeUpScore should be 1.`);
    assertEquals(bobScore?.bedTimeScore, -1, `Bob's bedTimeScore should be -1.`);
    assertEquals(bobScore?.wakeUpScore, 1, `Bob's wakeUpScore should be 1.`);
    assertEquals(charlieScore?.bedTimeScore, -1, `Charlie's bedTimeScore should be -1.`);
    assertEquals(charlieScore?.wakeUpScore, 0, `Charlie's wakeUpScore should be 0.`);
    console.log("Scores updated and verified after recording stats.");

    // 3. Get Leaderboard (mid-competition)
    console.log("\n--- Getting Leaderboard Mid-Competition ---");
    const midLeaderboardResult = await concept._getLeaderboard({ competitionId: compId });
    assertEquals(Array.isArray(midLeaderboardResult), true, "Leaderboard should be an array.");
    const midLeaderboard = midLeaderboardResult as { position: number; userId: ID; totalScore: number }[];
    console.log(`Result: ${JSON.stringify(midLeaderboard)}`);
    const expectedMidLeaderboard = [
      { position: 1, userId: userAlice, totalScore: 2 },
      { position: 2, userId: userBob, totalScore: 0 },
      { position: 3, userId: userCharlie, totalScore: -1 },
    ];
    assertEquals(midLeaderboard, expectedMidLeaderboard, "Mid-competition leaderboard should match expected ranking.");
    console.log("Mid-competition leaderboard verified.");

    // 4. End Competition (current date is assumed to be >= endDate based on past date choice)
    console.log("\n--- Ending Competition ---");
    const endResult = await concept.endCompetition({ competitionId: compId });
    console.log(`Result: ${JSON.stringify(endResult)}`);
    assertEquals(typeof endResult, "object");
    assertEquals("winners" in endResult, true, "endCompetition should return winners.");
    assertEquals(
      (endResult as { winners: ID[] | null }).winners,
      [userAlice],
      "Alice should be the sole winner as per scores.",
    );

    // Verify competition is inactive and winners are set in the database
    competition = await concept.competitions.findOne({ _id: compId });
    assertEquals(competition?.active, false, `Competition ${compId} should be inactive after ending.`);
    assertEquals(competition?.winners, [userAlice], `Competition ${compId} winners should be Alice in DB.`);
    console.log("Competition ended and winner verified in DB.");

    // 5. Get Leaderboard (post-competition)
    console.log("\n--- Getting Leaderboard Post-Competition ---");
    const postLeaderboardResult = await concept._getLeaderboard({ competitionId: compId });
    assertEquals(Array.isArray(postLeaderboardResult), true, "Post-competition leaderboard should be an array.");
    const postLeaderboard = postLeaderboardResult as { position: number; userId: ID; totalScore: number }[];
    console.log(`Result: ${JSON.stringify(postLeaderboard)}`);
    // Leaderboard should remain the same, as scores don't change after ending.
    assertEquals(postLeaderboard, expectedMidLeaderboard, "Post-competition leaderboard should match expected ranking.");
    console.log("Post-competition leaderboard verified.");

    console.log("\n--- Operational Principle Test Complete ---");
  });

  // Scenario 1: Invalid Competition Start Conditions (Missing/Non-Distinct Participants, Invalid Dates)
  await t.step("Scenario 1: Invalid Competition Start Conditions", async () => {
    console.log("\n--- Starting Scenario 1 Test (Invalid Start Conditions) ---");

    const userA = user("Alice");
    const userB = user("Bob");

    // Test case: Less than two distinct participants
    console.log(`Action: startCompetition with 1 participant: [${userA}]`);
    const result1 = await concept.startCompetition({
      participants: [userA],
      startDateStr: "2023-02-01",
      endDateStr: "2023-02-05",
    });
    assertEquals("error" in result1, true);
    assertEquals((result1 as { error: string }).error, "Participants must contain at least two distinct users.", "Should return an error for less than 2 participants.");
    console.log(`Output: Error - ${result1.error}`);

    // Test case: Non-distinct participants
    console.log(`Action: startCompetition with non-distinct participants: [${userA}, ${userA}]`);
    const resultDuplicateParticipants = await concept.startCompetition({
      participants: [userA, userA],
      startDateStr: "2023-02-01",
      endDateStr: "2023-02-05",
    });
    assertEquals("error" in resultDuplicateParticipants, true);
    assertEquals((resultDuplicateParticipants as { error: string }).error, "Participants must be distinct.", "Should return an error for non-distinct participants.");
    console.log(`Output: Error - ${resultDuplicateParticipants.error}`);

    // Test case: Invalid date strings
    console.log(`Action: startCompetition with invalid startDateStr`);
    const result2 = await concept.startCompetition({
      participants: [userA, userB],
      startDateStr: "not-a-date",
      endDateStr: "2023-02-05",
    });
    assertEquals("error" in result2, true);
    assertEquals((result2 as { error: string }).error, "Invalid startDateStr or endDateStr.", "Should return an error for invalid startDate string.");
    console.log(`Output: Error - ${result2.error}`);

    // Test case: End date logically precedes start date
    console.log(`Action: startCompetition with endDate before startDate`);
    const result3 = await concept.startCompetition({
      participants: [userA, userB],
      startDateStr: "2023-02-05",
      endDateStr: "2023-02-01",
    });
    assertEquals("error" in result3, true);
    assertEquals((result3 as { error: string }).error, "Start date cannot be after end date.", "Should return an error for endDate before startDate.");
    console.log(`Output: Error - ${result3.error}`);

    console.log("\n--- Scenario 1 Test Complete ---");
  });

  // Scenario 2: Overlapping Competitions Allowed for a user (as per current spec)
  await t.step("Scenario 2: Overlapping Competitions Allowed (for a user)", async () => {
    console.log("\n--- Starting Scenario 2 Test (Overlapping Competitions) ---");

    const userA = user("Alpha");
    const userB = user("Beta");
    const userC = user("Gamma");

    // Comp 1: Jan 1 - Jan 10 (userA, userB)
    const startDate1 = "2023-01-01";
    const endDate1 = "2023-01-10";
    const participants1 = [userA, userB];

    console.log(
      `Action: startCompetition (Comp1) for ${JSON.stringify(participants1)} from ${startDate1} to ${endDate1}`,
    );
    const res1 = await concept.startCompetition({
      participants: participants1,
      startDateStr: startDate1,
      endDateStr: endDate1,
    });
    console.log(`Result: ${JSON.stringify(res1)}`);
    assertEquals("competitionId" in res1, true, "First competition should start successfully.");
    const compId1 = (res1 as { competitionId: ID }).competitionId;
    let comp1InDb = await concept.competitions.findOne({ _id: compId1 });
    assertEquals(comp1InDb?.active, true, `Competition ${compId1} should be active.`);
    console.log(`Competition ${compId1} started successfully.`);

    // Comp 2: Jan 5 - Jan 15 (userA, userC) - overlaps with Comp 1, userA is in both
    const startDate2 = "2023-01-05";
    const endDate2 = "2023-01-15";
    const participants2 = [userA, userC];

    console.log(
      `Action: startCompetition (Comp2) for ${JSON.stringify(participants2)} from ${startDate2} to ${endDate2}`,
    );
    const res2 = await concept.startCompetition({
      participants: participants2,
      startDateStr: startDate2,
      endDateStr: endDate2,
    });
    console.log(`Result: ${JSON.stringify(res2)}`);
    assertEquals("competitionId" in res2, true, "Second (overlapping) competition should start successfully.");
    const compId2 = (res2 as { competitionId: ID }).competitionId;
    let comp2InDb = await concept.competitions.findOne({ _id: compId2 });
    assertEquals(comp2InDb?.active, true, `Competition ${compId2} should be active.`);
    console.log(`Competition ${compId2} (overlapping) started successfully.`);

    // Verify both competitions are active and exist with correct participants
    assertEquals(comp1InDb?.participants.includes(userA), true, `Comp1 should include ${userA}.`);
    assertEquals(comp1InDb?.participants.includes(userB), true, `Comp1 should include ${userB}.`);
    assertEquals(comp2InDb?.participants.includes(userA), true, `Comp2 should include ${userA}.`);
    assertEquals(comp2InDb?.participants.includes(userC), true, `Comp2 should include ${userC}.`);

    // Verify scores exist for userA in both competitions (as per I3 implicitly)
    const userAScoresComp1 = await concept.scores.findOne({ u: userA, competition: compId1 });
    const userAScoresComp2 = await concept.scores.findOne({ u: userA, competition: compId2 });
    assertEquals(userAScoresComp1 !== null, true, `User ${userA} should have scores for ${compId1}.`);
    assertEquals(userAScoresComp2 !== null, true, `User ${userA} should have scores for ${compId2}.`);
    console.log(`User ${userA} has score entries in both overlapping competitions, as expected.`);

    // Record a stat for userA that falls within the overlap period
    console.log(`Action: recordStat for ${userA} on 2023-01-06, BEDTIME success`);
    const recordOverlapResult = await concept.recordStat({ u: userA, dateStr: "2023-01-06", eventType: SleepEventType.BEDTIME, success: true });
    assertEquals("error" in recordOverlapResult, false, "Recording stat for user in overlapping competitions should succeed.");

    // Verify userA's score increased in BOTH competitions
    const updatedUserAScoresComp1 = await concept.scores.findOne({ u: userA, competition: compId1 });
    const updatedUserAScoresComp2 = await concept.scores.findOne({ u: userA, competition: compId2 });
    assertEquals(updatedUserAScoresComp1?.bedTimeScore, 1, `User ${userA}'s bedTimeScore in ${compId1} should be 1.`);
    assertEquals(updatedUserAScoresComp2?.bedTimeScore, 1, `User ${userA}'s bedTimeScore in ${compId2} should be 1.`);
    console.log(`User ${userA}'s scores updated in both competitions as expected from single recordStat action.`);


    console.log("\n--- Scenario 2 Test Complete ---");
  });


  // Scenario 3: Score Update Validation for `recordStat`
  // Tests if `recordStat` correctly rejects events outside the competition's defined date range
  // or for invalid participants/inactive competitions.
  await t.step("Scenario 3: Score Update Validation", async () => {
    console.log("\n--- Starting Scenario 3 Test (Score Update Validation) ---");

    const userX = user("Xavier");
    const userY = user("Yara");
    const userZ = user("Zoe"); // Not a participant

    const startDate = "2023-03-05";
    const endDate = "2023-03-10";
    const participants = [userX, userY];

    const startRes = await concept.startCompetition({
      participants,
      startDateStr: startDate,
      endDateStr: endDate,
    });
    assertEquals("competitionId" in startRes, true, "Competition should start successfully.");
    const compId = (startRes as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId} started from ${startDate} to ${endDate}.`);

    // 1. Attempt to record stat BEFORE start date
    const beforeStartDate = "2023-03-01";
    console.log(
      `Action: recordStat for ${userX} on ${beforeStartDate} (before start date)`,
    );
    const recordResult1 = await concept.recordStat({
      u: userX,
      dateStr: beforeStartDate,
      eventType: SleepEventType.BEDTIME,
      success: true,
    });
    console.log(`Result: ${JSON.stringify(recordResult1)}`);
    assertEquals("error" in recordResult1, true, "Recording before start date should return an error.");
    assertEquals(
      (recordResult1 as { error: string }).error,
      "User is not part of any active competition for the specified date, or the event date is outside the competition range.",
      "Error message for before-start-date should match expected.",
    );
    console.log("Record stat before start date correctly failed.");

    // 2. Attempt to record stat AFTER end date
    const afterEndDate = "2023-03-12";
    console.log(
      `Action: recordStat for ${userX} on ${afterEndDate} (after end date)`,
    );
    const recordResult2 = await concept.recordStat({
      u: userX,
      dateStr: afterEndDate,
      eventType: SleepEventType.WAKETIME,
      success: false,
    });
    console.log(`Result: ${JSON.stringify(recordResult2)}`);
    assertEquals("error" in recordResult2, true, "Recording after end date should return an error.");
    assertEquals(
      (recordResult2 as { error: string }).error,
      "User is not part of any active competition for the specified date, or the event date is outside the competition range.",
      "Error message for after-end-date should match expected.",
    );
    console.log("Record stat after end date correctly failed.");

    // 3. Attempt to record stat for a user NOT in the competition
    const validDate = "2023-03-07";
    console.log(`Action: recordStat for ${userZ} on ${validDate} (not a participant)`);
    const recordResultNonParticipant = await concept.recordStat({
      u: userZ,
      dateStr: validDate,
      eventType: SleepEventType.BEDTIME,
      success: true,
    });
    assertEquals("error" in recordResultNonParticipant, true, "Recording for non-participant should return an error.");
    assertEquals(
      (recordResultNonParticipant as { error: string }).error,
      "User is not part of any active competition for the specified date, or the event date is outside the competition range.",
      "Error message for non-participant should match expected.",
    );
    console.log("Record stat for non-participant correctly failed.");


    // Verify scores remain 0 for userX in competition compId
    const userXScore = await concept.scores.findOne({ u: userX, competition: compId });
    assertEquals(userXScore?.bedTimeScore, 0, `User ${userX}'s bedTimeScore should still be 0.`);
    assertEquals(userXScore?.wakeUpScore, 0, `User ${userX}'s wakeUpScore should still be 0.`);
    console.log(`Scores for user ${userX} remained 0, as expected, because previous events were invalid.`);

    // Now, mark the competition as inactive and try to record a stat (valid date, valid participant)
    await concept.competitions.updateOne({ _id: compId }, { $set: { active: false } });
    console.log(`Competition ${compId} explicitly set to inactive.`);

    console.log(`Action: recordStat for ${userX} on ${validDate} for an INACTIVE competition`);
    const recordInactiveResult = await concept.recordStat({ u: userX, dateStr: validDate, eventType: SleepEventType.BEDTIME, success: true });
    assertEquals("error" in recordInactiveResult, true, "Recording for inactive competition should return an error.");
    assertEquals((recordInactiveResult as { error: string }).error, "User is not part of any active competition for the specified date, or the event date is outside the competition range.", "Should return an error when trying to record stats for an inactive competition.");
    console.log(`Output: Error - ${recordInactiveResult.error}`);

    console.log("\n--- Scenario 3 Test Complete ---");
  });

  // Scenario 4: End Competition - Tie Scenarios (Full Tie and Subset Tie)
  await t.step("Scenario 4: End Competition - Tie Scenarios", async () => {
    console.log("\n--- Starting Scenario 4 Test (Full Tie and Subset Tie) ---");

    const userP = user("Paul");
    const userQ = user("Quinn");
    const userR = user("Rachel");

    // Test case A: Tie across all participants (Paul and Quinn)
    const startDateA = "2023-04-01";
    const endDateA = "2023-04-05"; // In the past for immediate ending
    const participantsA = [userP, userQ];

    const startResA = await concept.startCompetition({
      participants: participantsA,
      startDateStr: startDateA,
      endDateStr: endDateA,
    });
    assertEquals("competitionId" in startResA, true, "Competition A should start successfully.");
    const compIdA = (startResA as { competitionId: ID }).competitionId;
    console.log(`Competition ${compIdA} started for ${userP}, ${userQ}.`);

    // Record stats to ensure a tie (both get a total score of 2)
    // Paul: +1 BT, +1 WT (Total 2)
    await concept.recordStat({ u: userP, dateStr: "2023-04-02", eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userP, dateStr: "2023-04-03", eventType: SleepEventType.WAKETIME, success: true });
    // Quinn: +1 BT, +1 WT (Total 2)
    await concept.recordStat({ u: userQ, dateStr: "2023-04-02", eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userQ, dateStr: "2023-04-03", eventType: SleepEventType.WAKETIME, success: true });
    console.log("Scores recorded to create a tie situation for Comp A (Paul: 2, Quinn: 2).");

    const endResultA = await concept.endCompetition({ competitionId: compIdA });
    console.log(`Result for Comp A end: ${JSON.stringify(endResultA)}`);
    assertEquals("winners" in endResultA, true);
    assertEquals((endResultA as { winners: ID[] | null }).winners, null, "Winners should be null for a full tie.");
    console.log("Competition A ended, winners correctly null due to full tie.");

    let competitionA = await concept.competitions.findOne({ _id: compIdA });
    assertEquals(competitionA?.active, false, `Competition ${compIdA} should be inactive after ending.`);
    assertEquals(competitionA?.winners, null, `Competition ${compIdA} winners should be null in DB.`);
    console.log("Competition A state verified in DB (inactive, winners null).");

    // Test case B: Multiple Winners (subset tie)
    const startDateB = "2023-05-01";
    const endDateB = "2023-05-05"; // In the past for immediate ending
    const participantsB = [userP, userQ, userR];

    const startResB = await concept.startCompetition({
      participants: participantsB,
      startDateStr: startDateB,
      endDateStr: endDateB,
    });
    assertEquals("competitionId" in startResB, true, "Competition B should start successfully.");
    const compIdB = (startResB as { competitionId: ID }).competitionId;
    console.log(`Competition ${compIdB} started for ${userP}, ${userQ}, ${userR}.`);

    // UserP: Total 2
    await concept.recordStat({ u: userP, dateStr: "2023-05-02", eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userP, dateStr: "2023-05-03", eventType: SleepEventType.WAKETIME, success: true });
    // UserQ: Total 2 (tied for highest with Paul)
    await concept.recordStat({ u: userQ, dateStr: "2023-05-02", eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userQ, dateStr: "2023-05-03", eventType: SleepEventType.WAKETIME, success: true });
    // UserR: Total 1
    await concept.recordStat({ u: userR, dateStr: "2023-05-02", eventType: SleepEventType.BEDTIME, success: true });
    console.log("Scores recorded for Comp B (Paul: 2, Quinn: 2, Rachel: 1).");

    const endResultB = await concept.endCompetition({ competitionId: compIdB });
    console.log(`Result for Comp B end: ${JSON.stringify(endResultB)}`);
    assertEquals("winners" in endResultB, true);
    // Use `assertArrayIncludes` as order might not be strictly guaranteed
    assertEquals(endResultB.winners?.length, 2, "There should be two winners for subset tie.");
    assertEquals(endResultB.winners?.includes(userP), true, "Paul should be a winner.");
    assertEquals(endResultB.winners?.includes(userQ), true, "Quinn should be a winner.");
    console.log("Competition B ended, Paul and Quinn correctly identified as winners.");

    let competitionB = await concept.competitions.findOne({ _id: compIdB });
    assertEquals(competitionB?.active, false, `Competition ${compIdB} should be inactive after ending.`);
    assertEquals(competitionB?.winners?.length, 2, `Competition ${compIdB} winners field should have 2 entries.`);
    assertEquals(competitionB?.winners?.includes(userP), true, `DB winners for ${compIdB} should include Paul.`);
    assertEquals(competitionB?.winners?.includes(userQ), true, `DB winners for ${compIdB} should include Quinn.`);
    console.log("Competition B state verified in DB (inactive, Paul and Quinn as winners).");

    console.log("\n--- Scenario 4 Test Complete ---");
  });


  // Scenario 5: Participant Management & Competition Deactivation
  await t.step("Scenario 5: Participant Management & Competition Deactivation", async () => {
    console.log("\n--- Starting Scenario 5 Test (Participant Management) ---");

    const userR = user("Rita");
    const userS = user("Sam");
    const userT = user("Tom");
    const userU = user("Uma"); // For a 2-person test case

    // --- Part 1: Remove from 3-person competition, stays active, then deactivates ---
    // Start a competition with 3 participants
    const startRes1 = await concept.startCompetition({
      participants: [userR, userS, userT],
      startDateStr: "2023-08-01",
      endDateStr: "2023-08-07",
    });
    assertEquals("competitionId" in startRes1, true, "First competition should start successfully.");
    const compId1 = (startRes1 as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId1} started with 3 participants (${userR}, ${userS}, ${userT}).`);

    // Record some stats for userT to ensure their score exists before removal
    await concept.recordStat({ u: userT, dateStr: "2023-08-02", eventType: SleepEventType.BEDTIME, success: true });
    let userTScoreBeforeRemoval = await concept.scores.findOne({ u: userT, competition: compId1 });
    assertEquals(userTScoreBeforeRemoval?.bedTimeScore, 1, "User T's score initialized correctly.");

    // Remove one participant (userT) - competition should remain active as 2 participants are left
    console.log(`Action: removeParticipant for ${userT} from ${compId1} (leaving 2 participants)`);
    const removeRes1 = await concept.removeParticipant({
      competitionId: compId1,
      userId: userT,
    });
    console.log(`Result: ${JSON.stringify(removeRes1)}`);
    assertEquals("error" in removeRes1, false, "Removing userT should not return an error.");
    console.log(`User ${userT} removed. Competition ${compId1} should still be active with 2 participants.`);

    let competition1 = await concept.competitions.findOne({ _id: compId1 });
    assertEquals(competition1?.active, true, `Competition ${compId1} should still be active.`);
    assertEquals(competition1?.participants.length, 2, `Competition ${compId1} should have 2 participants.`);
    assertEquals(competition1?.participants.includes(userT), false, `Competition ${compId1} should not include ${userT}.`);
    // Verify userT's score is gone
    const userTScoreAfterRemoval = await concept.scores.findOne({ u: userT, competition: compId1 });
    assertEquals(userTScoreAfterRemoval, null, `User ${userT}'s score entry should be removed.`);
    console.log("User T's score entry correctly removed.");

    // Now remove another participant (userS), leaving only 1, which should deactivate the competition
    console.log(`Action: removeParticipant for ${userS} from ${compId1} (leaving 1 participant)`);
    const removeRes2 = await concept.removeParticipant({
      competitionId: compId1,
      userId: userS,
    });
    console.log(`Result: ${JSON.stringify(removeRes2)}`);
    assertEquals("error" in removeRes2, false, "Removing userS should not return an error.");
    console.log(`User ${userS} removed. Competition ${compId1} should now be inactive.`);

    competition1 = await concept.competitions.findOne({ _id: compId1 });
    assertEquals(competition1?.active, false, `Competition ${compId1} should now be inactive.`); // Expect inactive
    assertEquals(competition1?.winners, null, `Competition ${compId1} winners should be null.`); // Expect winners null
    assertEquals(competition1?.participants.length, 1, `Competition ${compId1} should have 1 participant remaining.`); // Only userR remains
    assertEquals(competition1?.participants.includes(userS), false, `Competition ${compId1} should not include ${userS}.`);
    const userSScoreAfterRemoval = await concept.scores.findOne({ u: userS, competition: compId1 });
    assertEquals(userSScoreAfterRemoval, null, `User ${userS}'s score entry should be removed.`);
    console.log("User S removed, competition correctly deactivated and winners null.");

    // --- Part 2: Attempt to remove last participant (should fail) ---
    console.log(`Action: removeParticipant for ${userR} from ${compId1} (should fail as only 1 participant)`);
    const removeRes3 = await concept.removeParticipant({
      competitionId: compId1,
      userId: userR,
    });
    console.log(`Result: ${JSON.stringify(removeRes3)}`);
    assertEquals("error" in removeRes3, true, "Attempt to remove last participant should return an error.");
    assertEquals(
      (removeRes3 as { error: string }).error,
      `Cannot remove participant from competition ${compId1}: it must have more than 1 participant.`,
      "Error message for removing last participant should match.",
    );
    console.log("Removing the last participant correctly failed as per requirement.");

    // --- Part 3: Remove from 2-person competition, immediate deactivation ---
    // Start a fresh competition with exactly 2 participants
    const startRes2 = await concept.startCompetition({
      participants: [userU, userV], // userV from previous test still active, but unique competitionId means isolation
      startDateStr: "2023-09-01",
      endDateStr: "2023-09-05",
    });
    assertEquals("competitionId" in startRes2, true, "Second competition should start successfully.");
    const compId2 = (startRes2 as { competitionId: ID }).competitionId;
    console.log(`Competition ${compId2} started with 2 participants (${userU}, ${userV}).`);

    // Remove one participant (userU) - should deactivate immediately as only 1 remains
    console.log(`Action: removeParticipant for ${userU} from ${compId2} (leaving 1 participant)`);
    const removeRes4 = await concept.removeParticipant({
      competitionId: compId2,
      userId: userU,
    });
    console.log(`Result: ${JSON.stringify(removeRes4)}`);
    assertEquals("error" in removeRes4, false, "Removing userU should not return an error.");
    console.log(`User ${userU} removed. Competition ${compId2} should now be inactive.`);

    let competition2 = await concept.competitions.findOne({ _id: compId2 });
    assertEquals(competition2?.active, false, `Competition ${compId2} should be inactive.`); // Expect inactive
    assertEquals(competition2?.winners, null, `Competition ${compId2} winners should be null.`); // Expect winners null
    assertEquals(competition2?.participants.length, 1, `Competition ${compId2} should have 1 participant remaining.`); // Only userV remains
    assertEquals(competition2?.participants.includes(userU), false, `Competition ${compId2} should not include ${userU}.`);
    console.log(
      "From 2 participants, removing one correctly deactivated competition as expected.",
    );

    console.log("\n--- Scenario 5 Test Complete ---");
  });

  // Scenario 6: End Competition Before End Date
  await t.step("Scenario 6: End Competition Before End Date", async () => {
    console.log("\n--- Starting Scenario 6 Test (End Competition Before End Date) ---");

    const userA = user("Alice");
    const userB = user("Bob");

    // Set end date far in the future
    const futureEndDate = new Date();
    futureEndDate.setFullYear(futureEndDate.getFullYear() + 1); // 1 year in the future
    const futureEndDateStr = futureEndDate.toISOString().split("T")[0];

    const startDate = "2024-01-01"; // A date in the past for the start, relevant only for active competitions
    const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: startDate, endDateStr: futureEndDateStr });
    assertEquals("competitionId" in compResult, true, "Expected successful competition start.");
    const competitionId = (compResult as { competitionId: ID }).competitionId;
    console.log(`Competition started with future end date: ${futureEndDateStr}. ID: ${competitionId}`);

    console.log(`Action: endCompetition for ID: ${competitionId}`);
    const endResult = await concept.endCompetition({ competitionId: competitionId });

    assertEquals("error" in endResult, true, "Should return an error if endCompetition is called before the competition's end date.");
    assertEquals((endResult as { error: string }).error, `Competition ${competitionId} has not ended yet. End date is ${futureEndDate.toDateString()}.`, "Error message for ending before end date should match.");
    console.log(`Output: Error - ${endResult.error}`);

    const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
    assertEquals(finalCompetition?.active, true, "Competition should still be active as it hasn't genuinely ended.");
    assertEquals(finalCompetition?.winners, null, "Competition winners should still be null as no winner has been determined.");
    console.log("State verification: Competition state remains unchanged (still active, no winner determined).");

    console.log("\n--- Scenario 6 Test Complete ---");
  });
});
```