---
timestamp: 'Wed Oct 15 2025 03:02:32 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_030232.532952f5.md]]'
content_id: f2cdd933880b48045e0c30716aed85eff53f7eb879cc07682598e6ae256a570c
---

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
