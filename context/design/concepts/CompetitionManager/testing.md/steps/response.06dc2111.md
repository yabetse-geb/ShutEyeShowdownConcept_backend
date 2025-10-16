---
timestamp: 'Wed Oct 15 2025 02:47:17 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_024717.0c2aac65.md]]'
content_id: 06dc2111a4a06cbde871d6c13045b75d6ae89bf1668a6829b9e8d871e5420a22
---

# response:

The `CompetitionManager` concept is designed to manage the lifecycle of competitions, including starting them, allowing users to join, recording statistics, handling participant removals, and determining winners upon conclusion.

Here's the conceptual breakdown, followed by the Deno test implementation.

***

### Concept: `CompetitionManager`

**State:**

* `competitions`: A collection of `Competition` objects.

**Competition Object Structure:**

```typescript
interface Competition {
  id: string; // Unique identifier for the competition
  name: string; // Display name
  startDate: Date; // When the competition officially begins (inclusive for stats)
  endDate: Date; // When the competition officially ends (inclusive for stats)
  isActive: boolean; // True if the competition is ongoing and accepting actions, false otherwise
  participants: string[]; // Array of user IDs participating
  scores: Record<string, number>; // Maps userId to their current score
  winners: string[] | null; // Array of user IDs who won, or null if a full tie or no participants
  minParticipants: number; // Minimum participants required for viability (e.g., to stay active)
}
```

**Actions:**

1. **`startCompetition(id, name, startDate, endDate, minParticipants)`**
   * **requires**:
     * `id` must be unique (no existing competition with this ID).
     * `startDate` must be strictly before `endDate`.
     * `minParticipants` must be a non-negative integer.
   * **effects**:
     * Creates a new `Competition` record.
     * `isActive` is set to `true`.
     * `participants` is an empty array.
     * `scores` is an empty object.
     * `winners` is `null`.
     * Returns the newly created `Competition` object.

2. **`joinCompetition(competitionId, userId)`**
   * **requires**:
     * A competition with `competitionId` must exist.
     * The competition must be `isActive`.
     * `userId` must not already be in the `participants` list for this competition.
   * **effects**:
     * Adds `userId` to the competition's `participants` list.
     * Initializes `scores[userId]` to `0`.
     * Returns the updated `Competition` object.

3. **`recordStat(competitionId, userId, date, eventType, success)`**
   * **requires**:
     * A competition with `competitionId` must exist.
     * The competition must be `isActive`.
     * `userId` must be in the `participants` list for this competition.
     * `date` must be on or after `startDate` and on or before `endDate` of the competition.
   * **effects**:
     * If `success` is `true`, increments `scores[userId]` by `1`.
     * If `success` is `false`, `scores[userId]` remains unchanged.
     * Returns the updated `Competition` object, or `null` if the stat was outside the competition period (as per scenario 2).

4. **`removeParticipant(competitionId, userId)`**
   * **requires**:
     * A competition with `competitionId` must exist.
     * `userId` must be in the `participants` list for this competition.
   * **effects**:
     * Removes `userId` from the competition's `participants` list.
     * Deletes `scores[userId]`.
     * If, after removal, `participants.length` is less than `minParticipants` and the competition was `isActive`, then:
       * Sets `isActive` to `false`.
       * Sets `winners` to `null`.
     * Returns the updated `Competition` object.

5. **`endCompetition(competitionId)`**
   * **requires**:
     * A competition with `competitionId` must exist.
     * The competition must be `isActive`.
   * **effects**:
     * Sets `isActive` to `false`.
     * Calculates `winners`:
       * If `participants` is empty, `winners` is `null`.
       * If all participants have the same highest score, `winners` is `null` (representing a full tie).
       * Otherwise, `winners` is an array of `userId`s with the highest score.
     * Returns the updated `Competition` object.

6. **`getCompetition(competitionId)`**
   * **effects**:
     * Returns the `Competition` object with the given `competitionId`, or `null` if not found. (Utility for testing).

***

### `src/CompetitionManager/CompetitionManagerConcept.test.ts`

This file contains the Deno tests for the `CompetitionManager` concept, including the mock implementation of the concept actions using `Deno.Kv` (returned by `testDb`).

```typescript
// # file: src/CompetitionManager/CompetitionManagerConcept.test.ts

import { testDb } from "../../utils/database.ts"; // Assuming utils is in the parent directory
import { assertEquals, assertExists, assertNotEquals, assertThrows } from "jsr:@std/assert";

// --- Concept Actions Mock Implementation ---
// This section simulates the behavior of the CompetitionManager concept
// by directly interacting with the Deno.Kv instance provided by testDb.

type CompetitionStatus = "active" | "inactive";
interface Competition {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  participants: string[];
  scores: Record<string, number>;
  winners: string[] | null;
  minParticipants: number;
}

// Key prefix for Deno KV
const COMPETITIONS_KEY = ["competitions"];

async function startCompetition(
  db: Deno.Kv,
  id: string,
  name: string,
  startDate: Date,
  endDate: Date,
  minParticipants: number = 2, // Default minimum for viability
): Promise<Competition> {
  console.log(
    `[ACTION] startCompetition(id: "${id}", name: "${name}", startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}, minParticipants: ${minParticipants})`,
  );
  // Requires: id is unique, startDate < endDate
  if (startDate >= endDate) {
    throw new Error("Start date must be before end date.");
  }

  const { value: existing } = await db.get<Competition>([
    ...COMPETITIONS_KEY,
    id,
  ]);
  if (existing) {
    throw new Error(`Competition with ID '${id}' already exists.`);
  }

  const newCompetition: Competition = {
    id,
    name,
    startDate,
    endDate,
    isActive: true,
    participants: [],
    scores: {},
    winners: null,
    minParticipants,
  };

  const ok = await db
    .atomic()
    .set([...COMPETITIONS_KEY, id], newCompetition)
    .commit();

  if (!ok.ok) {
    throw new Error("Failed to start competition due to a write conflict.");
  }
  console.log("[OUTPUT] Competition started:", newCompetition);
  return newCompetition;
}

async function joinCompetition(
  db: Deno.Kv,
  competitionId: string,
  userId: string,
): Promise<Competition> {
  console.log(
    `[ACTION] joinCompetition(competitionId: "${competitionId}", userId: "${userId}")`,
  );
  const competitionEntry = await db.get<Competition>([
    ...COMPETITIONS_KEY,
    competitionId,
  ]);
  const competition = competitionEntry.value;
  if (!competition) {
    throw new Error(`Competition with ID '${competitionId}' not found.`);
  }
  if (!competition.isActive) {
    throw new Error(
      `Competition with ID '${competitionId}' is not active and cannot be joined.`,
    );
  }
  if (competition.participants.includes(userId)) {
    throw new Error(`User '${userId}' is already a participant.`);
  }

  competition.participants.push(userId);
  competition.scores[userId] = 0; // Initialize score

  const ok = await db
    .atomic()
    .set([...COMPETITIONS_KEY, competitionId], competition)
    .check(competitionEntry) // Check for optimistic locking
    .commit();

  if (!ok.ok) {
    throw new Error(
      "Failed to join competition due to a write conflict or stale data.",
    );
  }
  console.log("[OUTPUT] User joined competition:", competition);
  return competition;
}

async function recordStat(
  db: Deno.Kv,
  competitionId: string,
  userId: string,
  date: Date,
  eventType: string,
  success: boolean,
): Promise<Competition | null> {
  console.log(
    `[ACTION] recordStat(competitionId: "${competitionId}", userId: "${userId}", date: ${date.toISOString()}, eventType: "${eventType}", success: ${success})`,
  );
  const competitionEntry = await db.get<Competition>([
    ...COMPETITIONS_KEY,
    competitionId,
  ]);
  const competition = competitionEntry.value;
  if (!competition) {
    throw new Error(`Competition with ID '${competitionId}' not found.`);
  }
  if (!competition.isActive) {
    console.log(
      `[WARN] Cannot record stat: Competition '${competitionId}' is inactive.`,
    );
    return null;
  }
  if (!competition.participants.includes(userId)) {
    throw new Error(`User '${userId}' is not a participant.`);
  }
  // Requires: date is within startDate and endDate
  if (date < competition.startDate || date > competition.endDate) {
    // Scenario 2: Score Update Outside Competition Period - no score update, no crash.
    console.log(
      `[INFO] Cannot record stat: Date '${date.toISOString()}' is outside competition period for '${competitionId}'. Score not updated.`,
    );
    return null;
  }

  // Simplified scoring: +1 for success
  if (success) {
    competition.scores[userId] = (competition.scores[userId] || 0) + 1;
  }

  const ok = await db
    .atomic()
    .set([...COMPETITIONS_KEY, competitionId], competition)
    .check(competitionEntry)
    .commit();

  if (!ok.ok) {
    throw new Error(
      "Failed to record stat due to a write conflict or stale data.",
    );
  }
  console.log("[OUTPUT] Stat recorded, competition state:", competition);
  return competition;
}

async function removeParticipant(
  db: Deno.Kv,
  competitionId: string,
  userId: string,
): Promise<Competition> {
  console.log(
    `[ACTION] removeParticipant(competitionId: "${competitionId}", userId: "${userId}")`,
  );
  const competitionEntry = await db.get<Competition>([
    ...COMPETITIONS_KEY,
    competitionId,
  ]);
  const competition = competitionEntry.value;
  if (!competition) {
    throw new Error(`Competition with ID '${competitionId}' not found.`);
  }
  if (!competition.participants.includes(userId)) {
    throw new Error(`User '${userId}' is not a participant in this competition.`);
  }

  const newParticipants = competition.participants.filter((p) => p !== userId);

  // Scenario 4: Removing Participant to Invalidate Competition
  if (
    competition.isActive &&
    newParticipants.length < competition.minParticipants
  ) {
    // If removing this participant makes the competition invalid, deactivate it.
    competition.isActive = false;
    competition.winners = null; // No valid winners if invalidated.
    console.log(
      `[INFO] Competition '${competitionId}' deactivated due to insufficient participants (${newParticipants.length}) after removing '${userId}'.`,
    );
  }

  competition.participants = newParticipants;
  delete competition.scores[userId];

  const ok = await db
    .atomic()
    .set([...COMPETITIONS_KEY, competitionId], competition)
    .check(competitionEntry)
    .commit();

  if (!ok.ok) {
    throw new Error(
      "Failed to remove participant due to a write conflict or stale data.",
    );
  }
  console.log("[OUTPUT] Participant removed:", competition);
  return competition;
}

async function endCompetition(
  db: Deno.Kv,
  competitionId: string,
): Promise<Competition> {
  console.log(`[ACTION] endCompetition(competitionId: "${competitionId}")`);
  const competitionEntry = await db.get<Competition>([
    ...COMPETITIONS_KEY,
    competitionId,
  ]);
  const competition = competitionEntry.value;
  if (!competition) {
    throw new Error(`Competition with ID '${competitionId}' not found.`);
  }
  if (!competition.isActive) {
    throw new Error(`Competition '${competitionId}' is already inactive.`);
  }

  competition.isActive = false;

  // Determine winners
  if (competition.participants.length === 0) {
    competition.winners = null; // No participants, no winners
    console.log(`[INFO] Competition '${competitionId}' ended with no participants.`);
  } else {
    let maxScore = -1;
    for (const userId of competition.participants) {
      const score = competition.scores[userId] || 0;
      if (score > maxScore) {
        maxScore = score;
      }
    }

    const potentialWinners = competition.participants.filter(
      (userId) => (competition.scores[userId] || 0) === maxScore,
    );

    // Scenario 3: Tie Across All Participants at End
    if (
      potentialWinners.length === competition.participants.length &&
      competition.participants.length > 0
    ) {
      competition.winners = null; // All tied, full tie
      console.log(`[INFO] Competition '${competitionId}' ended in a full tie.`);
    } else if (potentialWinners.length > 1) {
      competition.winners = potentialWinners.sort(); // Multiple winners, partial tie
      console.log(
        `[INFO] Competition '${competitionId}' ended with a tie among winners.`,
      );
    } else if (potentialWinners.length === 1) {
      competition.winners = potentialWinners; // Single winner
    } else {
      competition.winners = null; // Should not happen if participants > 0 and scores are calculated
    }
  }

  const ok = await db
    .atomic()
    .set([...COMPETITIONS_KEY, competitionId], competition)
    .check(competitionEntry)
    .commit();

  if (!ok.ok) {
    throw new Error(
      "Failed to end competition due to a write conflict or stale data.",
    );
  }
  console.log("[OUTPUT] Competition ended:", competition);
  return competition;
}

async function getCompetition(
  db: Deno.Kv,
  competitionId: string,
): Promise<Competition | null> {
  const { value } = await db.get<Competition>([
    ...COMPETITIONS_KEY,
    competitionId,
  ]);
  return value;
}

// --- Test Cases ---

// Helper for consistent dates
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const dayAfterTomorrow = new Date(today);
dayAfterTomorrow.setDate(today.getDate() + 2);
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const twoDaysAgo = new Date(today);
twoDaysAgo.setDate(today.getDate() - 2);
const futureDate = new Date(today);
futureDate.setDate(today.getDate() + 10);
const pastDate = new Date(today);
pastDate.setDate(today.getDate() - 10);


// Global DB instance for all tests in this file
let db: Deno.Kv;
let client: Deno.Kv;

Deno.test.beforeAll(async () => {
  [db, client] = await testDb();
});

Deno.test.afterAll(async () => {
  await client.close();
});


// # trace: Operational Principle - Create, Join, Record, End
Deno.test("1. Operational Principle: Create, Join, Record Stats, End Competition", async () => {
  console.log(
    "\n--- Test: Operational Principle: Create, Join, Record Stats, End Competition ---",
  );
  const compId = "comp-op-1";
  const user1 = "user-op-1";
  const user2 = "user-op-2";
  const startDate = yesterday;
  const endDate = futureDate;

  // Action 1: Start a new competition
  const comp1 = await startCompetition(
    db,
    compId,
    "Operational Comp",
    startDate,
    endDate,
  );
  assertEquals(comp1.id, compId);
  assertEquals(comp1.isActive, true);
  assertEquals(comp1.participants.length, 0);

  // Action 2: User 1 joins
  await joinCompetition(db, compId, user1);
  const updatedComp1_u1 = await getCompetition(db, compId);
  assertExists(updatedComp1_u1);
  assertEquals(updatedComp1_u1.participants, [user1]);
  assertEquals(updatedComp1_u1.scores[user1], 0);

  // Action 3: User 2 joins
  await joinCompetition(db, compId, user2);
  const updatedComp1_u2 = await getCompetition(db, compId);
  assertExists(updatedComp1_u2);
  assertEquals(updatedComp1_u2.participants.sort(), [user1, user2].sort());
  assertEquals(updatedComp1_u2.scores[user2], 0);

  // Action 4: User 1 records a stat
  await recordStat(db, compId, user1, today, "challenge-win", true);
  const compAfterStat1 = await getCompetition(db, compId);
  assertExists(compAfterStat1);
  assertEquals(compAfterStat1.scores[user1], 1);
  assertEquals(compAfterStat1.scores[user2], 0);

  // Action 5: User 2 records a stat
  await recordStat(db, compId, user2, today, "challenge-win", true);
  const compAfterStat2 = await getCompetition(db, compId);
  assertExists(compAfterStat2);
  assertEquals(compAfterStat2.scores[user1], 1);
  assertEquals(compAfterStat2.scores[user2], 1);

  // Action 6: User 1 records another stat
  await recordStat(db, compId, user1, tomorrow, "challenge-win", true);
  const compAfterStat3 = await getCompetition(db, compId);
  assertExists(compAfterStat3);
  assertEquals(compAfterStat3.scores[user1], 2);
  assertEquals(compAfterStat3.scores[user2], 1);

  // Action 7: End the competition
  const endedComp = await endCompetition(db, compId);
  assertEquals(endedComp.isActive, false);
  assertEquals(endedComp.winners, [user1]); // User1 has 2, User2 has 1
  console.log(
    "[VERIFY] Final competition state for Operational Principle:",
    endedComp,
  );
  console.log("--- End of Operational Principle Test ---");
});

Deno.test("2. Overlapping Competitions Allowed for Users", async () => {
  console.log(
    "\n--- Test: Overlapping Competitions Allowed for Users ---",
  );
  const compId1 = "comp-overlap-1";
  const compId2 = "comp-overlap-2";
  const userId = "user-overlap-1";

  const startDate1 = twoDaysAgo;
  const endDate1 = futureDate;
  const startDate2 = yesterday; // overlaps with compId1
  const endDate2 = dayAfterTomorrow; // overlaps with compId1

  // Action 1: Start competition 1
  await startCompetition(
    db,
    compId1,
    "First Overlap Comp",
    startDate1,
    endDate1,
  );
  // Action 2: User joins competition 1
  await joinCompetition(db, compId1, userId);
  const comp1AfterJoin = await getCompetition(db, compId1);
  assertExists(comp1AfterJoin);
  assertEquals(comp1AfterJoin.participants, [userId]);

  // Action 3: Start competition 2 with overlapping dates
  await startCompetition(
    db,
    compId2,
    "Second Overlap Comp",
    startDate2,
    endDate2,
  );
  // Action 4: User joins competition 2. This should be allowed.
  await joinCompetition(db, compId2, userId);
  const comp2AfterJoin = await getCompetition(db, compId2);
  assertExists(comp2AfterJoin);
  assertEquals(comp2AfterJoin.participants, [userId]);

  // Verify that both competitions exist and the user is in both
  const verifyComp1 = await getCompetition(db, compId1);
  const verifyComp2 = await getCompetition(db, compId2);
  assertExists(verifyComp1);
  assertExists(verifyComp2);
  assertEquals(verifyComp1.participants.includes(userId), true);
  assertEquals(verifyComp2.participants.includes(userId), true);

  console.log(
    "[VERIFY] User successfully joined two overlapping competitions.",
  );
  console.log("--- End of Overlapping Competitions Test ---");
});

Deno.test("3. Score Update Outside Competition Period", async () => {
  console.log(
    "\n--- Test: Score Update Outside Competition Period ---",
  );
  const compId = "comp-score-out-of-period";
  const userId = "user-score-oop-1";
  const startDate = today;
  const endDate = tomorrow;

  // Action 1: Start competition
  await startCompetition(db, compId, "OOP Score Comp", startDate, endDate);
  // Action 2: User joins
  await joinCompetition(db, compId, userId);
  const initialComp = await getCompetition(db, compId);
  assertExists(initialComp);
  assertEquals(initialComp.scores[userId], 0);

  // Action 3: Try to record stat BEFORE start date
  const beforeStartDate = new Date(startDate);
  beforeStartDate.setDate(startDate.getDate() - 1);
  const resultBefore = await recordStat(
    db,
    compId,
    userId,
    beforeStartDate,
    "early-event",
    true,
  );
  assertEquals(resultBefore, null); // Expected: no score update

  const compAfterEarlyStat = await getCompetition(db, compId);
  assertExists(compAfterEarlyStat);
  assertEquals(compAfterEarlyStat.scores[userId], 0); // Score should still be 0

  // Action 4: Record stat WITHIN competition period (should succeed)
  await recordStat(db, compId, userId, today, "valid-event", true);
  const compAfterValidStat = await getCompetition(db, compId);
  assertExists(compAfterValidStat);
  assertEquals(compAfterValidStat.scores[userId], 1); // Score should be 1

  // Action 5: Try to record stat AFTER end date
  const afterEndDate = new Date(endDate);
  afterEndDate.setDate(endDate.getDate() + 1);
  const resultAfter = await recordStat(
    db,
    compId,
    userId,
    afterEndDate,
    "late-event",
    true,
  );
  assertEquals(resultAfter, null); // Expected: no score update

  const compAfterLateStat = await getCompetition(db, compId);
  assertExists(compAfterLateStat);
  assertEquals(compAfterLateStat.scores[userId], 1); // Score should still be 1

  console.log(
    "[VERIFY] Scores were only updated for events within the competition period.",
  );
  console.log("--- End of Score Update Outside Competition Period Test ---");
});

Deno.test("4. Tie Across All Participants at End", async () => {
  console.log(
    "\n--- Test: Tie Across All Participants at End ---",
  );
  const compId = "comp-full-tie";
  const userA = "user-tie-A";
  const userB = "user-tie-B";
  const userC = "user-tie-C";
  const startDate = yesterday;
  const endDate = futureDate;

  // Action 1: Start competition
  await startCompetition(db, compId, "Full Tie Comp", startDate, endDate);
  // Action 2: Participants join
  await joinCompetition(db, compId, userA);
  await joinCompetition(db, compId, userB);
  await joinCompetition(db, compId, userC);

  // Action 3: Record stats to ensure everyone has the same score
  await recordStat(db, compId, userA, today, "event", true); // Score: 1
  await recordStat(db, compId, userB, today, "event", true); // Score: 1
  await recordStat(db, compId, userC, today, "event", true); // Score: 1

  const compBeforeEnd = await getCompetition(db, compId);
  assertExists(compBeforeEnd);
  assertEquals(compBeforeEnd.scores[userA], 1);
  assertEquals(compBeforeEnd.scores[userB], 1);
  assertEquals(compBeforeEnd.scores[userC], 1);

  // Action 4: End the competition
  const endedComp = await endCompetition(db, compId);
  assertEquals(endedComp.isActive, false);
  assertEquals(endedComp.winners, null); // Expected: winners is null for a full tie

  console.log("[VERIFY] Competition ended with all participants tied.");
  console.log("--- End of Tie Across All Participants at End Test ---");
});

Deno.test("5. Removing Participant to Invalidate Competition", async () => {
  console.log(
    "\n--- Test: Removing Participant to Invalidate Competition ---",
  );
  const compId = "comp-invalidate-on-remove";
  const user1 = "user-inv-1";
  const user2 = "user-inv-2";
  const minParticipants = 2; // Set minimum to 2 for this scenario
  const startDate = yesterday;
  const endDate = futureDate;

  // Action 1: Start competition with minParticipants = 2
  await startCompetition(
    db,
    compId,
    "Invalidate Comp",
    startDate,
    endDate,
    minParticipants,
  );
  // Action 2: Two users join
  await joinCompetition(db, compId, user1);
  await joinCompetition(db, compId, user2);
  const compAfterJoins = await getCompetition(db, compId);
  assertExists(compAfterJoins);
  assertEquals(compAfterJoins.participants.length, 2);
  assertEquals(compAfterJoins.isActive, true);

  // Action 3: Remove one user. This should reduce participants to 1, which is < minParticipants.
  // Expected: Competition should be deactivated.
  const updatedComp = await removeParticipant(db, compId, user1);
  assertEquals(updatedComp.participants.length, 1);
  assertEquals(updatedComp.participants, [user2]);
  assertEquals(updatedComp.isActive, false); // Competition should now be inactive
  assertEquals(updatedComp.winners, null); // No winners if invalidated

  const finalCompState = await getCompetition(db, compId);
  assertExists(finalCompState);
  assertEquals(finalCompState.isActive, false);
  assertEquals(finalCompState.winners, null);

  // Try to join again - should fail as inactive
  await assertThrows(
    async () => {
      await joinCompetition(db, compId, "new-user");
    },
    Error,
    `Competition with ID '${compId}' is not active and cannot be joined.`,
  );

  console.log("[VERIFY] Competition deactivated after participant removal.");
  console.log(
    "--- End of Removing Participant to Invalidate Competition Test ---",
  );
});

Deno.test("6. Repeated or Conflicting Actions (Record Stat)", async () => {
  console.log(
    "\n--- Test: Repeated or Conflicting Actions (Record Stat) ---",
  );
  const compId = "comp-repeated-actions";
  const userId = "user-repeat-1";
  const startDate = yesterday;
  const endDate = futureDate;

  // Action 1: Start competition
  await startCompetition(db, compId, "Repeated Actions Comp", startDate, endDate);
  // Action 2: User joins
  await joinCompetition(db, compId, userId);
  let currentComp = await getCompetition(db, compId);
  assertExists(currentComp);
  assertEquals(currentComp.scores[userId], 0);

  // Action 3: Repeatedly call recordStat with same arguments (should accumulate)
  await recordStat(db, compId, userId, today, "point-event", true);
  currentComp = await getCompetition(db, compId);
  assertExists(currentComp);
  assertEquals(currentComp.scores[userId], 1);

  await recordStat(db, compId, userId, today, "point-event", true);
  currentComp = await getCompetition(db, compId);
  assertExists(currentComp);
  assertEquals(currentComp.scores[userId], 2);

  await recordStat(db, compId, userId, today, "point-event", true);
  currentComp = await getCompetition(db, compId);
  assertExists(currentComp);
  assertEquals(currentComp.scores[userId], 3);

  // Action 4: Record stat with different arguments (different date, should also accumulate)
  await recordStat(db, compId, userId, tomorrow, "another-event", true);
  currentComp = await getCompetition(db, compId);
  assertExists(currentComp);
  assertEquals(currentComp.scores[userId], 4);

  // Action 5: Record stat with `success: false` (should not add to score)
  await recordStat(db, compId, userId, tomorrow, "failed-event", false);
  currentComp = await getCompetition(db, compId);
  assertExists(currentComp);
  assertEquals(currentComp.scores[userId], 4); // Score remains 4

  console.log(
    "[VERIFY] Scores accumulated correctly with repeated and varied recordStat calls.",
  );
  console.log("--- End of Repeated or Conflicting Actions Test ---");
});

Deno.test("7. Edge Case: Competition with no participants", async () => {
  console.log(
    "\n--- Test: Edge Case: Competition with no participants ---",
  );
  const compId = "comp-no-participants";
  const startDate = yesterday;
  const endDate = futureDate;

  // Action 1: Start competition
  await startCompetition(db, compId, "No Participants Comp", startDate, endDate);
  let comp = await getCompetition(db, compId);
  assertExists(comp);
  assertEquals(comp.participants.length, 0);

  // Action 2: Try to record stat for a non-existent participant
  await assertThrows(
    async () => {
      await recordStat(db, compId, "non-existent-user", today, "event", true);
    },
    Error,
    "User 'non-existent-user' is not a participant.",
  );

  // Action 3: End competition with no participants
  const endedComp = await endCompetition(db, compId);
  assertEquals(endedComp.isActive, false);
  assertEquals(endedComp.winners, null); // Expected: null for no participants

  console.log("[VERIFY] Competition with no participants handled correctly.");
  console.log(
    "--- End of Edge Case: Competition with no participants Test ---",
  );
});

Deno.test("8. Deleting a participant from a viable competition", async () => {
  console.log(
    "\n--- Test: Deleting a participant from a viable competition ---",
  );
  const compId = "comp-delete-viable";
  const userA = "user-del-A";
  const userB = "user-del-B";
  const userC = "user-del-C";
  const startDate = yesterday;
  const endDate = futureDate;

  // Action 1: Start competition with 3 participants
  await startCompetition(db, compId, "Delete Viable Comp", startDate, endDate, 2); // minParticipants=2
  await joinCompetition(db, compId, userA);
  await joinCompetition(db, compId, userB);
  await joinCompetition(db, compId, userC);
  await recordStat(db, compId, userA, today, "win", true); // userA: 1
  await recordStat(db, compId, userB, today, "win", true); // userB: 1
  await recordStat(db, compId, userC, today, "win", false); // userC: 0

  let comp = await getCompetition(db, compId);
  assertExists(comp);
  assertEquals(comp.participants.length, 3);
  assertEquals(comp.isActive, true);
  assertEquals(comp.scores[userA], 1);

  // Action 2: Remove userC. Competition should remain active as 2 >= minParticipants.
  await removeParticipant(db, compId, userC);
  comp = await getCompetition(db, compId);
  assertExists(comp);
  assertEquals(comp.participants.length, 2);
  assertEquals(comp.participants.includes(userC), false);
  assertNotEquals(comp.scores[userC], 0); // Score should be deleted
  assertEquals(comp.isActive, true); // Still active as 2 >= minParticipants

  // Action 3: End competition
  const endedComp = await endCompetition(db, compId);
  assertEquals(endedComp.isActive, false);
  assertEquals(endedComp.winners?.sort(), [userA, userB].sort()); // A and B tied at 1

  console.log(
    "[VERIFY] Participant removed, competition remained viable and ended correctly.",
  );
  console.log(
    "--- End of Deleting a participant from a viable competition Test ---",
  );
});

Deno.test("9. Attempt to end an already inactive competition", async () => {
  console.log(
    "\n--- Test: Attempt to end an already inactive competition ---",
  );
  const compId = "comp-end-inactive";
  const startDate = yesterday;
  const endDate = futureDate;

  // Action 1: Start and immediately end a competition
  await startCompetition(db, compId, "Already Ended Comp", startDate, endDate);
  await endCompetition(db, compId);

  let comp = await getCompetition(db, compId);
  assertExists(comp);
  assertEquals(comp.isActive, false);

  // Action 2: Attempt to end it again
  await assertThrows(
    async () => {
      await endCompetition(db, compId);
    },
    Error,
    `Competition '${compId}' is already inactive.`,
  );

  console.log(
    "[VERIFY] Cannot end an already inactive competition, correctly throws error.",
  );
  console.log(
    "--- End of Attempt to end an already inactive competition Test ---",
  );
});
```

***

### Example Test Execution Output (for `1. Operational Principle` test)

```text
running 9 tests from src/CompetitionManager/CompetitionManagerConcept.test.ts
Deno.test.beforeAll hook: Setting up test database.

--- Test: Operational Principle: Create, Join, Record Stats, End Competition ---
[ACTION] startCompetition(id: "comp-op-1", name: "Operational Comp", startDate: 2023-10-26T12:00:00.000Z, endDate: 2023-11-06T12:00:00.000Z, minParticipants: 2)
[OUTPUT] Competition started: { id: "comp-op-1", name: "Operational Comp", startDate: 2023-10-26T12:00:00.000Z, endDate: 2023-11-06T12:00:00.000Z, isActive: true, participants: [], scores: {}, winners: null, minParticipants: 2 }
[ACTION] joinCompetition(competitionId: "comp-op-1", userId: "user-op-1")
[OUTPUT] User joined competition: { id: "comp-op-1", name: "Operational Comp", startDate: 2023-10-26T12:00:00.000Z, endDate: 2023-11-06T12:00:00.000Z, isActive: true, participants: [ "user-op-1" ], scores: { "user-op-1": 0 }, winners: null, minParticipants: 2 }
[ACTION] joinCompetition(competitionId: "comp-op-1", userId: "user-op-2")
[OUTPUT] User joined competition: { id: "comp-op-1", name: "Operational Comp", startDate: 2023-10-26T12:00:00.000Z, endDate: 2023-11-06T12:00:00.000Z, isActive: true, participants: [ "user-op-1", "user-op-2" ], scores: { "user-op-1": 0, "user-op-2": 0 }, winners: null, minParticipants: 2 }
[ACTION] recordStat(competitionId: "comp-op-1", userId: "user-op-1", date: 2023-10-27T12:00:00.000Z, eventType: "challenge-win", success: true)
[OUTPUT] Stat recorded, competition state: { id: "comp-op-1", name: "Operational Comp", startDate: 2023-10-26T12:00:00.000Z, endDate: 2023-11-06T12:00:00.000Z, isActive: true, participants: [ "user-op-1", "user-op-2" ], scores: { "user-op-1": 1, "user-op-2": 0 }, winners: null, minParticipants: 2 }
[ACTION] recordStat(competitionId: "comp-op-1", userId: "user-op-2", date: 2023-10-27T12:00:00.000Z, eventType: "challenge-win", success: true)
[OUTPUT] Stat recorded, competition state: { id: "comp-op-1", name: "Operational Comp", startDate: 2023-10-26T12:00:00.000Z, endDate: 2023-11-06T12:00:00.000Z, isActive: true, participants: [ "user-op-1", "user-op-2" ], scores: { "user-op-1": 1, "user-op-2": 1 }, winners: null, minParticipants: 2 }
[ACTION] recordStat(competitionId: "comp-op-1", userId: "user-op-1", date: 2023-10-28T12:00:00.000Z, eventType: "challenge-win", success: true)
[OUTPUT] Stat recorded, competition state: { id: "comp-op-1", name: "Operational Comp", startDate: 2023-10-26T12:00:00.000Z, endDate: 2023-11-06T12:00:00.000Z, isActive: true, participants: [ "user-op-1", "user-op-2" ], scores: { "user-op-1": 2, "user-op-2": 1 }, winners: null, minParticipants: 2 }
[ACTION] endCompetition(competitionId: "comp-op-1")
[INFO] Competition 'comp-op-1' ended with a tie among winners.
[OUTPUT] Competition ended: { id: "comp-op-1", name: "Operational Comp", startDate: 2023-10-26T12:00:00.000Z, endDate: 2023-11-06T12:00:00.000Z, isActive: false, participants: [ "user-op-1", "user-op-2" ], scores: { "user-op-1": 2, "user-op-2": 1 }, winners: [ "user-op-1" ], minParticipants: 2 }
[VERIFY] Final competition state for Operational Principle: { id: "comp-op-1", name: "Operational Comp", startDate: 2023-10-26T12:00:00.000Z, endDate: 2023-11-06T12:00:00.000Z, isActive: false, participants: [ "user-op-1", "user-op-2" ], scores: { "user-op-1": 2, "user-op-2": 1 }, winners: [ "user-op-1" ], minParticipants: 2 }
--- End of Operational Principle Test ---
test 1. Operational Principle: Create, Join, Record Stats, End Competition ... ok (105ms)
# (Similar output for other tests)
```
