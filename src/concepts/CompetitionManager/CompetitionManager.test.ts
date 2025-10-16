import { Db } from "npm:mongodb";
import { assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
//import CompetitionManagerConcept from "./CompetitionManagerConcept.ts"; // Import SleepEventType
import CompetitionManagerConcept from "./CompetitionManagerConcept.ts";

// Helper to create user IDs for testing
const user = (name: string): ID => `user:${name}` as ID;

enum SleepEventType {
  BEDTIME = "BEDTIME",
  WAKETIME = "WAKETIME",
}

// Deno.test("CompetitionManager Concept Tests", async (t) => {
  let db: Db;
  let client: any; // MongoClient type from npm:mongodb, but any for simplicity here
  let concept: CompetitionManagerConcept;

  // This hook runs before each top-level or nested test step (t.step).
  // It ensures a fresh database connection and concept instance for each test.
  // The database itself is guaranteed to be dropped before the entire test file starts
  // by Deno's global hook (as per the prompt), so each t.step implicitly starts clean.
  // Deno.test.beforeEach(async () => {
  //   [db, client] = await testDb();
  //   concept = new new CompetitionManagerConcept(db);
  //   console.log("Database and concept initialized for a new test step.");
  // });

  // Deno.test.afterEach(async () => {
  //   if (client) {
  //     await client.close();
  //     console.log("Database client closed after test step.");
  //   }
  // });

  // trace: Operational Principle Test
  // Demonstrates the full lifecycle: start, record stats, get leaderboard, end, get final leaderboard.
Deno.test("Operational Principle: Full competition lifecycle and leaderboard", async () => {
  const [db, client] = await testDb();
  const concept = new CompetitionManagerConcept(db);

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

  await client.close();
});

  // Scenario 1: Invalid Competition Start Conditions (Missing/Non-Distinct Participants, Invalid Dates)
Deno.test("Scenario 1: Invalid Competition Start Conditions", async () => {
  console.log("\n--- Starting Scenario 1 Test (Invalid Start Conditions) ---");
  const [db, client] = await testDb();
  const concept = new CompetitionManagerConcept(db);

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
  assertEquals((result1 as { error: string }).error, "Competition must have at least two participants.", "Should return an error for less than 2 participants.");
  console.log("result unexpected: ", JSON.stringify(result1));
  console.log(`Output: Error - ${(result1 as { error: string }).error}`);

  // Test case: Non-distinct participants
  console.log(`Action: startCompetition with non-distinct participants: [${userA}, ${userA}]`);
  const resultDuplicateParticipants = await concept.startCompetition({
    participants: [userA, userA],
    startDateStr: "2023-02-01",
    endDateStr: "2023-02-05",
  });
  assertEquals("error" in resultDuplicateParticipants, true);
  assertEquals((resultDuplicateParticipants as { error: string }).error, "Participants must be distinct.", "Should return an error for non-distinct participants.");
  console.log(`Output: Error - ${(resultDuplicateParticipants as { error: string }).error}`);

  // Test case: Invalid date strings
  console.log(`Action: startCompetition with invalid startDateStr`);
  const result2 = await concept.startCompetition({
    participants: [userA, userB],
    startDateStr: "not-a-date",
    endDateStr: "2023-02-05",
  });
  assertEquals("error" in result2, true);
  assertEquals((result2 as { error: string }).error, "Invalid date strings provided.", "Should return an error for invalid startDate string.");
  console.log(`Output: Error - ${(result2 as { error: string }).error}`);

  // Test case: End date logically precedes start date
  console.log(`Action: startCompetition with endDate before startDate`);
  const result3 = await concept.startCompetition({
    participants: [userA, userB],
    startDateStr: "2023-02-05",
    endDateStr: "2023-02-01",
  });
  assertEquals("error" in result3, true);
  assertEquals((result3 as { error: string }).error, "Start date cannot be after end date.", "Should return an error for endDate before startDate.");
  console.log(`Output: Error - ${(result3 as { error: string }).error}`);

  console.log("\n--- Scenario 1 Test Complete ---");

  await client.close();
});

  // Scenario 2: Overlapping Competitions Allowed for a user (as per current spec)
Deno.test("Scenario 2: Overlapping Competitions Allowed (for a user)", async () => {
  const [db, client] = await testDb();
  const concept = new CompetitionManagerConcept(db);
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
  await client.close();
});


  // Scenario 3: Score Update Validation for `recordStat`
  // Tests if `recordStat` correctly rejects events outside the competition's defined date range
  // or for invalid participants/inactive competitions.
Deno.test("Scenario 3: Score Update Validation", async () => {
  const [db, client] = await testDb();
  const concept = new CompetitionManagerConcept(db);
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

  await client.close();});

  // Scenario 4: End Competition - Tie Scenarios (Full Tie and Subset Tie)
Deno.test("Scenario 4: End Competition - Tie Scenarios", async () => {
  const [db, client] = await testDb();
  const concept = new CompetitionManagerConcept(db);
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
  if ("winners" in endResultB && endResultB.winners) {
    assertEquals(endResultB.winners.length, 2, "There should be two winners for subset tie.");
    assertEquals(endResultB.winners.includes(userP), true, "Paul should be a winner.");
    assertEquals(endResultB.winners.includes(userQ), true, "Quinn should be a winner.");
  } else {
    throw new Error("Expected winners in endResultB, but got error: " + (endResultB as { error?: string }).error);
  }
  console.log("Competition B ended, Paul and Quinn correctly identified as winners.");

  let competitionB = await concept.competitions.findOne({ _id: compIdB });
  assertEquals(competitionB?.active, false, `Competition ${compIdB} should be inactive after ending.`);
  assertEquals(competitionB?.winners?.length, 2, `Competition ${compIdB} winners field should have 2 entries.`);
  assertEquals(competitionB?.winners?.includes(userP), true, `DB winners for ${compIdB} should include Paul.`);
  assertEquals(competitionB?.winners?.includes(userQ), true, `DB winners for ${compIdB} should include Quinn.`);
  console.log("Competition B state verified in DB (inactive, Paul and Quinn as winners).");

  console.log("\n--- Scenario 4 Test Complete ---");
  await client.close();
});


  // Scenario 5: Participant Management & Competition Deactivation
Deno.test("Scenario 5: Participant Management & Competition Deactivation", async () => {
  const [db, client] = await testDb();
  const concept = new CompetitionManagerConcept(db);
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
    `Competition ${compId1} is not active.`,
    "Error message for removing last participant should match.",
  );
  console.log("Removing the last participant correctly failed as per requirement.");

  // --- Part 3: Remove from 2-person competition, immediate deactivation ---
  // Start a fresh competition with exactly 2 participants
  const startRes2 = await concept.startCompetition({
    participants: [userU, userR], // userV from previous test still active, but unique competitionId means isolation
    startDateStr: "2023-09-01",
    endDateStr: "2023-09-05",
  });
  assertEquals("competitionId" in startRes2, true, "Second competition should start successfully.");
  const compId2 = (startRes2 as { competitionId: ID }).competitionId;
  console.log(`Competition ${compId2} started with 2 participants (${userU}, ${userR}).`);

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
  await client.close();
});

  // Scenario 6: End Competition Before End Date
Deno.test("Scenario 6: End Competition Before End Date", async () => {
  const [db, client] = await testDb();
  const concept = new CompetitionManagerConcept(db);
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
  assertEquals((endResult as { error: string }).error, `Competition ${competitionId} has not ended yet.`, "Error message for ending before end date should match.");
  console.log(`Output: Error - ${(endResult as { error: string }).error}`);

  const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
  assertEquals(finalCompetition?.active, true, "Competition should still be active as it hasn't genuinely ended.");
  assertEquals(finalCompetition?.winners, null, "Competition winners should still be null as no winner has been determined.");
  console.log("State verification: Competition state remains unchanged (still active, no winner determined).");

  console.log("\n--- Scenario 6 Test Complete ---");
  await client.close( );
});
// import { Db } from "npm:mongodb";
// import { assertEquals } from "jsr:@std/assert";
// import { testDb } from "@utils/database.ts";
// import { ID } from "@utils/types.ts";
// import CompetitionManagerConcept from "./CompetitionManagerConcept.ts";

// // Helper to create user IDs for testing
// const user = (name: string): ID => `user:${name}` as ID;

// // Enum needs to be accessible in tests, matches the one in the concept file
// enum SleepEventType {
//   BEDTIME = "BEDTIME",
//   WAKETIME = "WAKETIME",
// }

// Deno.test("CompetitionManager Concept Tests", async (t) => {
//   let db: Db;
//   let client: any;
//   let concept: CompetitionManagerConcept;

//   // This hook runs before each top-level or nested test step (t.step).
//   // It ensures a fresh database connection and concept instance for each test.
//   // The database itself is guaranteed to be dropped before the entire test file starts
//   // by Deno's global hook (as per the prompt), so each t.step implicitly starts clean.
//   Deno.test.beforeEach(async () => {
//     [db, client] = await testDb();
//     concept = new new CompetitionManagerConcept(db);
//     console.log("Database and concept initialized for a new test.");
//   });

//   Deno.test.afterEach(async () => {
//     if (client) {
//       await client.close();
//       console.log("Database client closed.");
//     }
//   });

//   // trace: Operational Principle Test
//   // Demonstrates the full lifecycle: start, record stats, get leaderboard, end, get final leaderboard.
//   await t.step("Operational Principle: Full competition lifecycle and leaderboard", async () => {
//     console.log("\n--- Starting Operational Principle Test ---");

//     const userAlice = user("Alice");
//     const userBob = user("Bob");
//     const userCharlie = user("Charlie");

//     // Dates in the past to ensure `endCompetition` can be called immediately
//     const startDateStr = "2023-01-01";
//     const endDateStr = "2023-01-05";
//     const competitionParticipants = [userAlice, userBob, userCharlie];

//     // 1. Start Competition
//     console.log(
//       `Action: startCompetition(${JSON.stringify({ participants: competitionParticipants, startDateStr, endDateStr })})`,
//     );
//     const startResult = await concept.startCompetition({
//       participants: competitionParticipants,
//       startDateStr,
//       endDateStr,
//     });
//     console.log(`Result: ${JSON.stringify(startResult)}`);
//     assertEquals(typeof startResult, "object");
//     assertEquals("competitionId" in startResult, true);
//     const compId = (startResult as { competitionId: ID }).competitionId;
//     console.log(`Competition ${compId} started.`);

//     // Verify competition created and active
//     let competition = await concept.competitions.findOne({ _id: compId });
//     assertEquals(competition?.active, true, `Competition ${compId} should be active after creation.`);
//     assertEquals(competition?.participants.length, 3, `Competition ${compId} should have 3 participants.`);
//     assertEquals(competition?.winners, null, `Competition ${compId} winners should be null initially.`);

//     // Verify initial scores are 0 for all participants
//     let scores = await concept.scores.find({ competition: compId }).toArray();
//     assertEquals(scores.length, 3, `Expected 3 score entries for competition ${compId}.`);
//     for (const s of scores) {
//       assertEquals(s.wakeUpScore, 0, `Initial wakeUpScore for ${s.u} should be 0.`);
//       assertEquals(s.bedTimeScore, 0, `Initial bedTimeScore for ${s.u} should be 0.`);
//     }
//     console.log("Competition started and initial scores verified.");

//     // 2. Record Stats to build up scores over a couple of days
//     // Day 1 (2023-01-01): Alice +1 Bedtime, Bob +1 Waketime, Charlie -1 Bedtime
//     console.log("\n--- Recording Stats for Day 1 (2023-01-01) ---");
//     await concept.recordStat({ u: userAlice, dateStr: "2023-01-01", eventType: SleepEventType.BEDTIME, success: true });
//     await concept.recordStat({ u: userBob, dateStr: "2023-01-01", eventType: SleepEventType.WAKETIME, success: true });
//     await concept.recordStat({ u: userCharlie, dateStr: "2023-01-01", eventType: SleepEventType.BEDTIME, success: false });

//     // Day 2 (2023-01-02): Alice +1 Waketime, Bob -1 Bedtime
//     console.log("\n--- Recording Stats for Day 2 (2023-01-02) ---");
//     await concept.recordStat({ u: userAlice, dateStr: "2023-01-02", eventType: SleepEventType.WAKETIME, success: true });
//     await concept.recordStat({ u: userBob, dateStr: "2023-01-02", eventType: SleepEventType.BEDTIME, success: false });

//     // Expected Scores by end of Day 2:
//     // Alice: BT=1 (from Day1), WT=1 (from Day2) => Total=2
//     // Bob: BT=-1 (from Day2), WT=1 (from Day1) => Total=0
//     // Charlie: BT=-1 (from Day1), WT=0 => Total=-1

//     // Verify scores after recording
//     scores = await concept.scores.find({ competition: compId }).toArray();
//     const aliceScore = scores.find((s) => s.u === userAlice);
//     const bobScore = scores.find((s) => s.u === userBob);
//     const charlieScore = scores.find((s) => s.u === userCharlie);

//     assertEquals(aliceScore?.bedTimeScore, 1, `Alice's bedTimeScore should be 1.`);
//     assertEquals(aliceScore?.wakeUpScore, 1, `Alice's wakeUpScore should be 1.`);
//     assertEquals(bobScore?.bedTimeScore, -1, `Bob's bedTimeScore should be -1.`);
//     assertEquals(bobScore?.wakeUpScore, 1, `Bob's wakeUpScore should be 1.`);
//     assertEquals(charlieScore?.bedTimeScore, -1, `Charlie's bedTimeScore should be -1.`);
//     assertEquals(charlieScore?.wakeUpScore, 0, `Charlie's wakeUpScore should be 0.`);
//     console.log("Scores updated and verified after recording stats.");

//     // 3. Get Leaderboard (mid-competition)
//     console.log("\n--- Getting Leaderboard Mid-Competition ---");
//     const midLeaderboard = await concept._getLeaderboard({ competitionId: compId });
//     console.log(`Result: ${JSON.stringify(midLeaderboard)}`);
//     assertEquals(Array.isArray(midLeaderboard), true, "Leaderboard should be an array.");
//     const expectedMidLeaderboard = [
//       { position: 1, userId: userAlice, totalScore: 2 },
//       { position: 2, userId: userBob, totalScore: 0 },
//       { position: 3, userId: userCharlie, totalScore: -1 },
//     ];
//     assertEquals(midLeaderboard, expectedMidLeaderboard, "Mid-competition leaderboard should match expected ranking.");
//     console.log("Mid-competition leaderboard verified.");

//     // 4. End Competition (current date is assumed to be >= endDate based on past date choice)
//     console.log("\n--- Ending Competition ---");
//     const endResult = await concept.endCompetition({ competitionId: compId });
//     console.log(`Result: ${JSON.stringify(endResult)}`);
//     assertEquals(typeof endResult, "object");
//     assertEquals("winners" in endResult, true);
//     assertEquals(
//       (endResult as { winners: ID[] | null }).winners,
//       [userAlice],
//       "Alice should be the sole winner as per scores.",
//     );

//     // Verify competition is inactive and winners are set in the database
//     competition = await concept.competitions.findOne({ _id: compId });
//     assertEquals(competition?.active, false, `Competition ${compId} should be inactive after ending.`);
//     assertEquals(competition?.winners, [userAlice], `Competition ${compId} winners should be Alice in DB.`);
//     console.log("Competition ended and winner verified in DB.");

//     // 5. Get Leaderboard (post-competition)
//     console.log("\n--- Getting Leaderboard Post-Competition ---");
//     const postLeaderboard = await concept._getLeaderboard({ competitionId: compId });
//     console.log(`Result: ${JSON.stringify(postLeaderboard)}`);
//     assertEquals(Array.isArray(postLeaderboard), true, "Post-competition leaderboard should be an array.");
//     // Leaderboard should remain the same, as scores don't change after ending.
//     assertEquals(postLeaderboard, expectedMidLeaderboard, "Post-competition leaderboard should match expected ranking.");
//     console.log("Post-competition leaderboard verified.");

//     console.log("\n--- Operational Principle Test Complete ---");
//   });

//   // Scenario 1: Overlapping Competitions Allowed
//   // Tests if a user can participate in multiple active competitions whose date ranges overlap.
//   await t.step("Scenario 1: Overlapping Competitions Allowed (for a user)", async () => {
//     console.log("\n--- Starting Scenario 1 Test (Overlapping Competitions) ---");

//     const userA = user("Alpha");
//     const userB = user("Beta");
//     const userC = user("Gamma");

//     // Comp 1: Jan 1 - Jan 10 (userA, userB)
//     const startDate1 = "2023-01-01";
//     const endDate1 = "2023-01-10";
//     const participants1 = [userA, userB];

//     console.log(
//       `Action: startCompetition (Comp1) for ${JSON.stringify(participants1)} from ${startDate1} to ${endDate1}`,
//     );
//     const res1 = await concept.startCompetition({
//       participants: participants1,
//       startDateStr: startDate1,
//       endDateStr: endDate1,
//     });
//     console.log(`Result: ${JSON.stringify(res1)}`);
//     assertEquals("competitionId" in res1, true, "First competition should start successfully.");
//     const compId1 = (res1 as { competitionId: ID }).competitionId;
//     let comp1InDb = await concept.competitions.findOne({ _id: compId1 });
//     assertEquals(comp1InDb?.active, true, `Competition ${compId1} should be active.`);
//     console.log(`Competition ${compId1} started successfully.`);

//     // Comp 2: Jan 5 - Jan 15 (userA, userC) - overlaps with Comp 1, userA is in both
//     const startDate2 = "2023-01-05";
//     const endDate2 = "2023-01-15";
//     const participants2 = [userA, userC];

//     console.log(
//       `Action: startCompetition (Comp2) for ${JSON.stringify(participants2)} from ${startDate2} to ${endDate2}`,
//     );
//     const res2 = await concept.startCompetition({
//       participants: participants2,
//       startDateStr: startDate2,
//       endDateStr: endDate2,
//     });
//     console.log(`Result: ${JSON.stringify(res2)}`);
//     assertEquals("competitionId" in res2, true, "Second (overlapping) competition should start successfully.");
//     const compId2 = (res2 as { competitionId: ID }).competitionId;
//     let comp2InDb = await concept.competitions.findOne({ _id: compId2 });
//     assertEquals(comp2InDb?.active, true, `Competition ${compId2} should be active.`);
//     console.log(`Competition ${compId2} (overlapping) started successfully.`);

//     // Verify both competitions are active and exist with correct participants
//     assertEquals(comp1InDb?.participants.includes(userA), true, `Comp1 should include ${userA}.`);
//     assertEquals(comp1InDb?.participants.includes(userB), true, `Comp1 should include ${userB}.`);
//     assertEquals(comp2InDb?.participants.includes(userA), true, `Comp2 should include ${userA}.`);
//     assertEquals(comp2InDb?.participants.includes(userC), true, `Comp2 should include ${userC}.`);

//     // Verify scores exist for userA in both competitions (as per I3)
//     const userAScoresComp1 = await concept.scores.findOne({ u: userA, competition: compId1 });
//     const userAScoresComp2 = await concept.scores.findOne({ u: userA, competition: compId2 });
//     assertEquals(userAScoresComp1 !== null, true, `User ${userA} should have scores for ${compId1}.`);
//     assertEquals(userAScoresComp2 !== null, true, `User ${userA} should have scores for ${compId2}.`);
//     console.log(`User ${userA} has score entries in both overlapping competitions, as expected.`);

//     console.log("\n--- Scenario 1 Test Complete ---");
//   });

//   // Scenario 2: Score Update Outside Competition Period
//   // Tests if `recordStat` correctly rejects events outside the competition's defined date range.
//   await t.step("Scenario 2: Score Update Outside Competition Period", async () => {
//     console.log("\n--- Starting Scenario 2 Test (Score Update Outside Period) ---");

//     const userX = user("Xavier");
//     const userY = user("Yara");

//     const startDate = "2023-03-05";
//     const endDate = "2023-03-10";
//     const participants = [userX, userY];

//     const startRes = await concept.startCompetition({
//       participants,
//       startDateStr: startDate,
//       endDateStr: endDate,
//     });
//     assertEquals("competitionId" in startRes, true, "Competition should start successfully.");
//     const compId = (startRes as { competitionId: ID }).competitionId;
//     console.log(`Competition ${compId} started from ${startDate} to ${endDate}.`);

//     // Attempt to record stat BEFORE start date
//     const beforeStartDate = "2023-03-01";
//     console.log(
//       `Action: recordStat for ${userX} on ${beforeStartDate} (before start date)`,
//     );
//     const recordResult1 = await concept.recordStat({
//       u: userX,
//       dateStr: beforeStartDate,
//       eventType: SleepEventType.BEDTIME,
//       success: true,
//     });
//     console.log(`Result: ${JSON.stringify(recordResult1)}`);
//     assertEquals("error" in recordResult1, true, "Recording before start date should return an error.");
//     assertEquals(
//       (recordResult1 as { error: string }).error,
//       "User is not part of any active competition for the specified date, or the event date is outside the competition range.",
//       "Error message for before-start-date should match expected.",
//     );
//     console.log("Record stat before start date correctly failed.");

//     // Attempt to record stat AFTER end date
//     const afterEndDate = "2023-03-12";
//     console.log(
//       `Action: recordStat for ${userX} on ${afterEndDate} (after end date)`,
//     );
//     const recordResult2 = await concept.recordStat({
//       u: userX,
//       dateStr: afterEndDate,
//       eventType: SleepEventType.WAKETIME,
//       success: false,
//     });
//     console.log(`Result: ${JSON.stringify(recordResult2)}`);
//     assertEquals("error" in recordResult2, true, "Recording after end date should return an error.");
//     assertEquals(
//       (recordResult2 as { error: string }).error,
//       "User is not part of any active competition for the specified date, or the event date is outside the competition range.",
//       "Error message for after-end-date should match expected.",
//     );
//     console.log("Record stat after end date correctly failed.");

//     // Verify scores remain 0 for userX in competition compId
//     const userXScore = await concept.scores.findOne({ u: userX, competition: compId });
//     assertEquals(userXScore?.bedTimeScore, 0, `User ${userX}'s bedTimeScore should still be 0.`);
//     assertEquals(userXScore?.wakeUpScore, 0, `User ${userX}'s wakeUpScore should still be 0.`);
//     console.log(`Scores for user ${userX} remained 0, as expected.`);

//     console.log("\n--- Scenario 2 Test Complete ---");
//   });

//   // Scenario 3: Tie Across All Participants at End
//   // Tests `endCompetition` behavior when all participants have the same total score.
//   await t.step("Scenario 3: Tie Across All Participants at End", async () => {
//     console.log("\n--- Starting Scenario 3 Test (Full Tie) ---");

//     const userP = user("Paul");
//     const userQ = user("Quinn");

//     const startDate = "2023-04-01";
//     const endDate = "2023-04-05"; // In the past for immediate ending
//     const participants = [userP, userQ];

//     const startRes = await concept.startCompetition({
//       participants,
//       startDateStr: startDate,
//       endDateStr: endDate,
//     });
//     assertEquals("competitionId" in startRes, true, "Competition should start successfully.");
//     const compId = (startRes as { competitionId: ID }).competitionId;
//     console.log(`Competition ${compId} started.`);

//     // Record stats to ensure a tie (both get a total score of 2)
//     // Paul: +1 BT, +1 WT (Total 2)
//     await concept.recordStat({ u: userP, dateStr: "2023-04-02", eventType: SleepEventType.BEDTIME, success: true });
//     await concept.recordStat({ u: userP, dateStr: "2023-04-03", eventType: SleepEventType.WAKETIME, success: true });

//     // Quinn: +1 BT, +1 WT (Total 2)
//     await concept.recordStat({ u: userQ, dateStr: "2023-04-02", eventType: SleepEventType.BEDTIME, success: true });
//     await concept.recordStat({ u: userQ, dateStr: "2023-04-03", eventType: SleepEventType.WAKETIME, success: true });
//     console.log("Scores recorded to create a tie situation (Paul: 2, Quinn: 2).");

//     let leaderboard = await concept._getLeaderboard({ competitionId: compId });
//     console.log(`Mid-competition Leaderboard: ${JSON.stringify(leaderboard)}`);
//     assertEquals(leaderboard.length, 2, "Leaderboard should contain 2 entries.");
//     // Cast to access properties safely
//     const typedLeaderboard = leaderboard as { position: number; userId: ID; totalScore: number }[];
//     assertEquals(typedLeaderboard[0].totalScore, 2, `Leaderboard top score should be 2.`);
//     assertEquals(typedLeaderboard[1].totalScore, 2, `Leaderboard second score should be 2.`);
//     assertEquals(typedLeaderboard[0].position, 1, `Leaderboard top position should be 1 (due to tie).`);
//     assertEquals(typedLeaderboard[1].position, 1, `Leaderboard second position should be 1 (due to tie).`);

//     // End competition (assuming current date is >= endDate)
//     console.log("\n--- Ending Competition with Tie ---");
//     const endResult = await concept.endCompetition({ competitionId: compId });
//     console.log(`Result: ${JSON.stringify(endResult)}`);
//     assertEquals("winners" in endResult, true);
//     assertEquals((endResult as { winners: ID[] | null }).winners, null, "Winners should be null for a full tie.");
//     console.log("Competition ended, winners correctly null due to full tie.");

//     // Verify competition state in DB
//     const competition = await concept.competitions.findOne({ _id: compId });
//     assertEquals(competition?.active, false, `Competition ${compId} should be inactive after ending.`);
//     assertEquals(competition?.winners, null, `Competition ${compId} winners should be null in DB.`);
//     console.log("Competition active status and winners field verified in DB.");

//     // Verify post-end leaderboard still shows scores
//     leaderboard = await concept._getLeaderboard({ competitionId: compId });
//     assertEquals(leaderboard.length, 2, "Post-end leaderboard should still contain 2 entries.");
//     assertEquals(typedLeaderboard[0].totalScore, 2, `Post-end leaderboard top score should be 2.`);
//     assertEquals(typedLeaderboard[1].totalScore, 2, `Post-end leaderboard second score should be 2.`);
//     console.log("Post-competition leaderboard still reflects tied scores.");

//     console.log("\n--- Scenario 3 Test Complete ---");
//   });

//   // Scenario 4: Removing Participant to Invalidate Competition
//   // Tests `removeParticipant` leading to competition deactivation and edge cases with participant counts.
//   await t.step("Scenario 4: Removing Participant to Invalidate Competition", async () => {
//     console.log("\n--- Starting Scenario 4 Test (Removing Participant) ---");

//     const userR = user("Rita");
//     const userS = user("Sam");
//     const userT = user("Tom");

//     // Start a competition with 3 participants
//     const startRes1 = await concept.startCompetition({
//       participants: [userR, userS, userT],
//       startDateStr: "2023-05-01",
//       endDateStr: "2023-05-07",
//     });
//     assertEquals("competitionId" in startRes1, true, "First competition should start successfully.");
//     const compId1 = (startRes1 as { competitionId: ID }).competitionId;
//     console.log(`Competition ${compId1} started with 3 participants (${userR}, ${userS}, ${userT}).`);

//     // Record some stats for userT to ensure their score exists before removal
//     await concept.recordStat({ u: userT, dateStr: "2023-05-02", eventType: SleepEventType.BEDTIME, success: true });
//     let userTScoreBeforeRemoval = await concept.scores.findOne({ u: userT, competition: compId1 });
//     assertEquals(userTScoreBeforeRemoval?.bedTimeScore, 1, "User T's score initialized correctly.");

//     // Remove one participant (userT) - competition should remain active as 2 participants are left
//     console.log(`Action: removeParticipant for ${userT} from ${compId1} (leaving 2 participants)`);
//     const removeRes1 = await concept.removeParticipant({
//       competitionId: compId1,
//       userId: userT,
//     });
//     console.log(`Result: ${JSON.stringify(removeRes1)}`);
//     assertEquals("error" in removeRes1, false, "Removing userT should not return an error.");
//     console.log(`User ${userT} removed. Competition ${compId1} should still be active with 2 participants.`);

//     let competition1 = await concept.competitions.findOne({ _id: compId1 });
//     assertEquals(competition1?.active, true, `Competition ${compId1} should still be active.`);
//     assertEquals(competition1?.participants.length, 2, `Competition ${compId1} should have 2 participants.`);
//     assertEquals(competition1?.participants.includes(userT), false, `Competition ${compId1} should not include ${userT}.`);
//     // Verify userT's score is gone
//     const userTScoreAfterRemoval = await concept.scores.findOne({ u: userT, competition: compId1 });
//     assertEquals(userTScoreAfterRemoval, null, `User ${userT}'s score entry should be removed.`);
//     console.log("User T's score entry correctly removed.");

//     // Now remove another participant (userS), leaving only 1, which should deactivate the competition
//     console.log(`Action: removeParticipant for ${userS} from ${compId1} (leaving 1 participant)`);
//     const removeRes2 = await concept.removeParticipant({
//       competitionId: compId1,
//       userId: userS,
//     });
//     console.log(`Result: ${JSON.stringify(removeRes2)}`);
//     assertEquals("error" in removeRes2, false, "Removing userS should not return an error.");
//     console.log(`User ${userS} removed. Competition ${compId1} should now be inactive.`);

//     competition1 = await concept.competitions.findOne({ _id: compId1 });
//     assertEquals(competition1?.active, false, `Competition ${compId1} should now be inactive.`); // Expect inactive
//     assertEquals(competition1?.winners, null, `Competition ${compId1} winners should be null.`); // Expect winners null
//     assertEquals(competition1?.participants.length, 1, `Competition ${compId1} should have 1 participant remaining.`); // Only userR remains
//     assertEquals(competition1?.participants.includes(userS), false, `Competition ${compId1} should not include ${userS}.`);
//     const userSScoreAfterRemoval = await concept.scores.findOne({ u: userS, competition: compId1 });
//     assertEquals(userSScoreAfterRemoval, null, `User ${userS}'s score entry should be removed.`);
//     console.log("User S removed, competition correctly deactivated and winners null.");

//     // Attempt to remove the last participant (userR) from the now 1-participant competition
//     console.log(`Action: removeParticipant for ${userR} from ${compId1} (should fail as only 1 participant)`);
//     const removeRes3 = await concept.removeParticipant({
//       competitionId: compId1,
//       userId: userR,
//     });
//     console.log(`Result: ${JSON.stringify(removeRes3)}`);
//     assertEquals("error" in removeRes3, true, "Attempt to remove last participant should return an error.");
//     assertEquals(
//       (removeRes3 as { error: string }).error,
//       `Cannot remove participant from competition ${compId1}: it must have more than 1 participant.`,
//       "Error message for removing last participant should match.",
//     );
//     console.log("Removing the last participant correctly failed as per requirement.");

//     // Start a fresh competition with exactly 2 participants, then remove one to see immediate deactivation
//     const userU = user("Uma");
//     const userV = user("Victor");
//     const startRes2 = await concept.startCompetition({
//       participants: [userU, userV],
//       startDateStr: "2023-06-01",
//       endDateStr: "2023-06-05",
//     });
//     assertEquals("competitionId" in startRes2, true, "Second competition should start successfully.");
//     const compId2 = (startRes2 as { competitionId: ID }).competitionId;
//     console.log(`Competition ${compId2} started with 2 participants (${userU}, ${userV}).`);

//     // Remove one participant (userU) - should deactivate immediately as only 1 remains
//     console.log(`Action: removeParticipant for ${userU} from ${compId2} (leaving 1 participant)`);
//     const removeRes4 = await concept.removeParticipant({
//       competitionId: compId2,
//       userId: userU,
//     });
//     console.log(`Result: ${JSON.stringify(removeRes4)}`);
//     assertEquals("error" in removeRes4, false, "Removing userU should not return an error.");
//     console.log(`User ${userU} removed. Competition ${compId2} should now be inactive.`);

//     let competition2 = await concept.competitions.findOne({ _id: compId2 });
//     assertEquals(competition2?.active, false, `Competition ${compId2} should be inactive.`); // Expect inactive
//     assertEquals(competition2?.winners, null, `Competition ${compId2} winners should be null.`); // Expect winners null
//     assertEquals(competition2?.participants.length, 1, `Competition ${compId2} should have 1 participant remaining.`); // Only userV remains
//     assertEquals(competition2?.participants.includes(userU), false, `Competition ${compId2} should not include ${userU}.`);
//     console.log(
//       "From 2 participants, removing one correctly deactivated competition as expected.",
//     );

//     console.log("\n--- Scenario 4 Test Complete ---");
//   });

//   // Scenario 5: Repeated or Conflicting Actions (recordStat)
//   // Tests if `recordStat` correctly accumulates scores with repeated or mixed success/failure events for the same day.
//   await t.step("Scenario 5: Repeated or Conflicting RecordStat Actions", async () => {
//     console.log("\n--- Starting Scenario 5 Test (Repeated RecordStat) ---");

//     const userM = user("Mike");
//     const userN = user("Nancy");

//     const startDate = "2023-07-01";
//     const endDate = "2023-07-07";
//     const eventDate = "2023-07-03"; // A date within the competition period

//     const startRes = await concept.startCompetition({
//       participants: [userM, userN],
//       startDateStr: startDate,
//       endDateStr: endDate,
//     });
//     assertEquals("competitionId" in startRes, true, "Competition should start successfully.");
//     const compId = (startRes as { competitionId: ID }).competitionId;
//     console.log(`Competition ${compId} started.`);

//     // Initial state: Mike's scores are 0, 0
//     let mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
//     assertEquals(mikeScore?.bedTimeScore, 0, "Initial bedTimeScore for Mike should be 0.");
//     assertEquals(mikeScore?.wakeUpScore, 0, "Initial wakeUpScore for Mike should be 0.");
//     console.log("Initial scores for Mike verified.");

//     // 1. Record BEDTIME success (+1)
//     console.log(
//       `Action: recordStat for ${userM} on ${eventDate}, BEDTIME success (+1)`,
//     );
//     await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true });
//     mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
//     assertEquals(mikeScore?.bedTimeScore, 1, "Mike's bedTimeScore should be 1 after first success.");
//     assertEquals(mikeScore?.wakeUpScore, 0, "Mike's wakeUpScore should remain 0.");
//     console.log("Bedtime +1 verified (Mike's scores: BT=1, WT=0).");

//     // 2. Repeat BEDTIME success (+1)
//     console.log(
//       `Action: recordStat for ${userM} on ${eventDate}, BEDTIME success (+1 again)`,
//     );
//     await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true });
//     mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
//     assertEquals(mikeScore?.bedTimeScore, 2, "Mike's bedTimeScore should be 2 after second success.");
//     assertEquals(mikeScore?.wakeUpScore, 0, "Mike's wakeUpScore should remain 0.");
//     console.log("Bedtime +1 (repeated) verified (Mike's scores: BT=2, WT=0).");

//     // 3. Record BEDTIME failure (-1)
//     console.log(
//       `Action: recordStat for ${userM} on ${eventDate}, BEDTIME failure (-1)`,
//     );
//     await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: false });
//     mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
//     assertEquals(mikeScore?.bedTimeScore, 1, "Mike's bedTimeScore should be 1 after failure (2-1=1).");
//     assertEquals(mikeScore?.wakeUpScore, 0, "Mike's wakeUpScore should remain 0.");
//     console.log("Bedtime -1 verified (Mike's scores: BT=1, WT=0).");

//     // 4. Record WAKETIME success (+1)
//     console.log(
//       `Action: recordStat for ${userM} on ${eventDate}, WAKETIME success (+1)`,
//     );
//     await concept.recordStat({ u: userM, dateStr: eventDate, eventType: SleepEventType.WAKETIME, success: true });
//     mikeScore = await concept.scores.findOne({ u: userM, competition: compId });
//     assertEquals(mikeScore?.bedTimeScore, 1, "Mike's bedTimeScore should remain 1.");
//     assertEquals(mikeScore?.wakeUpScore, 1, "Mike's wakeUpScore should be 1 after waketime success.");
//     console.log("Waketime +1 verified (Mike's scores: BT=1, WT=1).");

//     console.log("\n--- Scenario 5 Test Complete ---");
//   });
// });





// import { assertEquals, assertNotEquals, assertArrayIncludes } from "jsr:@std/assert";
// import { testDb } from "@utils/database.ts";
// import { ID } from "@utils/types.ts";
// import CompetitionManagerConcept, { SleepEventType } from "./CompetitionManagerConcept.ts";

// // Helper function to create consistent date strings for testing (YYYY-MM-DD)
// const createDate = (year: number, month: number, day: number) => {
//   const date = new Date(year, month - 1, day); // Month is 0-indexed in Date constructor
//   return date.toISOString().split("T")[0]; // Get YYYY-MM-DD part
// };

// function expectCompetition(comp: unknown): asserts comp is {
//   _id: ID;
//   participants: ID[];
//   startDate: Date;
//   endDate: Date;
//   active: boolean;
//   winners: ID[] | null;
// } {
//   if (
//     !comp ||
//     typeof comp !== "object" ||
//     !("_id" in comp) ||
//     !("participants" in comp) ||
//     !("startDate" in comp) ||
//     !("endDate" in comp) ||
//     !("active" in comp) ||
//     !("winners" in comp)
//   ) {
//     throw new Error(`Expected Competition, got: ${JSON.stringify(comp)}`);
//   }
// }

// Deno.test("CompetitionManager Concept Tests", async (test) => {
//   const [db, client] = await testDb();
//   const concept = new new CompetitionManagerConcept(db);

//   // Define some generic User IDs for testing
//   const userA = "user:Alice" as ID;
//   const userB = "user:Bob" as ID;
//   const userC = "user:Charlie" as ID;
//   const userD = "user:David" as ID;

//   // --- trace: Operational Principle - Basic Competition Lifecycle with a clear winner ---
//   await test.step("trace: Operational Principle - Basic Competition Lifecycle with a clear winner", async () => {
//     console.log("\n--- Trace: Operational Principle ---");

//     // 1. Users initiate a competition with one or more other users, specifying a start and end date.
//     const startDateStr = createDate(2023, 1, 1); // Jan 1, 2023
//     const endDateStr = createDate(2023, 1, 3); // Jan 3, 2023

//     console.log(`Action: startCompetition with participants: [${userA}, ${userB}], start: ${startDateStr}, end: ${endDateStr}`);
//     const competitionResult = await concept.startCompetition({
//       participants: [userA, userB],
//       startDateStr: startDateStr,
//       endDateStr: endDateStr,
//     });

//     // Confirm the competition started successfully
//     assertNotEquals((competitionResult as { error?: string }).error, undefined, "Expected successful competition start (no error).");
//     const competitionId = (competitionResult as { competitionId: ID }).competitionId;
//     console.log(`Output: Competition started successfully with ID: ${competitionId}`);

//     // Verify initial state: competition is active, no winners, scores are 0
//     const initialCompetition = await concept.competitions.findOne({ _id: competitionId });
//     assertEquals(initialCompetition?.active, true, "Competition should be active immediately after creation.");
//     assertEquals(initialCompetition?.winners, null, "Competition winners should be null at the start.");

//     const initialScores = await concept.scores.find({ competitionId: competitionId }).toArray();
//     assertEquals(initialScores.length, 2, "There should be initial score entries for both participants.");
//     initialScores.forEach(score => {
//       assertEquals(score.wakeUpScore, 0, "Initial wakeUpScore for participants should be 0.");
//       assertEquals(score.bedTimeScore, 0, "Initial bedTimeScore for participants should be 0.");
//     });
//     console.log("State verification: Competition is active, no winners set, and all participant scores are initialized to zero.");

//     // 2. Throughout the competition duration, participants' sleep adherence events are recorded.
//     // Based on the success or failure of these events, individual scores are accumulated.

//     // Day 1: January 1, 2023
//     console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 1, 1)}`);
//     await concept.recordStat({ u: userA, dateStr: createDate(2023, 1, 1), eventType: SleepEventType.BEDTIME, success: true });
//     console.log(`Action: recordStat - ${userA} WAKETIME success on ${createDate(2023, 1, 1)}`);
//     await concept.recordStat({ u: userA, dateStr: createDate(2023, 1, 1), eventType: SleepEventType.WAKETIME, success: true }); // userA total: +2

//     console.log(`Action: recordStat - ${userB} BEDTIME success on ${createDate(2023, 1, 1)}`);
//     await concept.recordStat({ u: userB, dateStr: createDate(2023, 1, 1), eventType: SleepEventType.BEDTIME, success: true });
//     console.log(`Action: recordStat - ${userB} WAKETIME failure on ${createDate(2023, 1, 1)}`);
//     await concept.recordStat({ u: userB, dateStr: createDate(2023, 1, 1), eventType: SleepEventType.WAKETIME, success: false }); // userB total: 1 + (-1) = 0

//     // Day 2: January 2, 2023
//     console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 1, 2)}`);
//     await concept.recordStat({ u: userA, dateStr: createDate(2023, 1, 2), eventType: SleepEventType.BEDTIME, success: true });
//     console.log(`Action: recordStat - ${userA} WAKETIME success on ${createDate(2023, 1, 2)}`);
//     await concept.recordStat({ u: userA, dateStr: createDate(2023, 1, 2), eventType: SleepEventType.WAKETIME, success: true }); // userA total: +2 (from day1) + 2 = 4

//     console.log(`Action: recordStat - ${userB} BEDTIME failure on ${createDate(2023, 1, 2)}`);
//     await concept.recordStat({ u: userB, dateStr: createDate(2023, 1, 2), eventType: SleepEventType.BEDTIME, success: false });
//     console.log(`Action: recordStat - ${userB} WAKETIME success on ${createDate(2023, 1, 2)}`);
//     await concept.recordStat({ u: userB, dateStr: createDate(2023, 1, 2), eventType: SleepEventType.WAKETIME, success: true }); // userB total: 0 (from day1) + (-1) + 1 = 0

//     // Verify intermediate scores after recording events
//     const scoresAfterRecording = await concept.scores.find({ competitionId: competitionId }).toArray();
//     const scoreA = scoresAfterRecording.find(s => s.u === userA);
//     const scoreB = scoresAfterRecording.find(s => s.u === userB);

//     assertEquals(scoreA?.bedTimeScore, 2, `User ${userA}'s bedtime score should be 2.`);
//     assertEquals(scoreA?.wakeUpScore, 2, `User ${userA}'s waketime score should be 2.`); // Total score for UserA: 4

//     assertEquals(scoreB?.bedTimeScore, 0, `User ${userB}'s bedtime score should be 0 (1 success, 1 failure).`);
//     assertEquals(scoreB?.wakeUpScore, 0, `User ${userB}'s waketime score should be 0 (1 success, 1 failure).`); // Total score for UserB: 0
//     console.log("State verification: Intermediate scores updated correctly based on events.");

//     // 3. Upon the competition's conclusion, these scores are tallied, and a winner is determined.
//     // To ensure `endCompetition` can be called, we must update the competition's `endDate` to be today or earlier.
//     const today = new Date();
//     const todayStr = createDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
//     await concept.competitions.updateOne({ _id: competitionId }, { $set: { endDate: new Date(todayStr) } });
//     console.log(`Competition ${competitionId}'s end date updated to ${todayStr} to allow immediate ending.`);

//     console.log(`Action: endCompetition for ID: ${competitionId}`);
//     const endResult = await concept.endCompetition({ competitionId: competitionId });

//     // Confirm the competition ended successfully and a winner was returned
//     assertNotEquals((endResult as { error?: string }).error, undefined, "Expected successful competition end (no error).");
//     const winners = (endResult as { winners: ID[] | null }).winners;
//     console.log(`Output: Competition ended. Winners: ${winners}`);

//     // Verify final state: competition is inactive, and the correct winner is recorded
//     const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
//     assertEquals(finalCompetition?.active, false, "Competition should be inactive after being ended.");
//     assertEquals(finalCompetition?.winners, [userA], "The winner should be UserA based on scores.");
//     assertEquals(winners, [userA], "The returned winners from endCompetition should be UserA.");
//     console.log("State verification: Competition is inactive, and the correct single winner is determined and recorded.");
//   });

//   // --- Interesting Scenario 1: Invalid Competition Start ---
//   await test.step("Scenario 1: Invalid Competition Start", async () => {
//     console.log("\n--- Scenario 1: Invalid Competition Start ---");

//     // Test case: Less than two distinct participants
//     console.log(`Action: startCompetition with 1 participant: [${userA}]`);
//     const result1 = await concept.startCompetition({
//       participants: [userA],
//       startDateStr: createDate(2023, 2, 1),
//       endDateStr: createDate(2023, 2, 5),
//     });
//     assertEquals((result1 as { error: string }).error, "Participants must contain at least two distinct users.", "Should return an error for less than 2 participants.");
//     console.log(`Output: Error - ${result1.error}`);

//     // Test case: Invalid date strings
//     console.log(`Action: startCompetition with invalid startDateStr`);
//     const result2 = await concept.startCompetition({
//       participants: [userA, userB],
//       startDateStr: "not-a-date",
//       endDateStr: createDate(2023, 2, 5),
//     });
//     assertEquals((result2 as { error: string }).error, "Invalid startDateStr or endDateStr.", "Should return an error for invalid startDate string.");
//     console.log(`Output: Error - ${result2.error}`);

//     // Test case: End date logically precedes start date
//     console.log(`Action: startCompetition with endDate before startDate`);
//     const result3 = await concept.startCompetition({
//       participants: [userA, userB],
//       startDateStr: createDate(2023, 2, 5),
//       endDateStr: createDate(2023, 2, 1),
//     });
//     assertEquals((result3 as { error: string }).error, "Start date cannot be after end date.", "Should return an error for endDate before startDate.");
//     console.log(`Output: Error - ${result3.error}`);
//   });

//   // --- Interesting Scenario 2: Recording Stats outside competition dates or for an inactive competition ---
//   await test.step("Scenario 2: Recording Stats outside competition dates / inactive competition", async () => {
//     console.log("\n--- Scenario 2: Record Stat outside competition dates / inactive competition ---");

//     const compStartDate = createDate(2023, 3, 5);
//     const compEndDate = createDate(2023, 3, 10);
//     const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: compStartDate, endDateStr: compEndDate });
//     const competitionId = (compResult as { competitionId: ID }).competitionId;
//     console.log(`Competition started for ${userA}, ${userB} from ${compStartDate} to ${compEndDate}. ID: ${competitionId}`);

//     // Record stat for a date before the competition's start date
//     console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 3, 4)} (before competition start)`);
//     await concept.recordStat({ u: userA, dateStr: createDate(2023, 3, 4), eventType: SleepEventType.BEDTIME, success: true });

//     // Record stat for a date after the competition's end date
//     console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 3, 11)} (after competition end)`);
//     await concept.recordStat({ u: userA, dateStr: createDate(2023, 3, 11), eventType: SleepEventType.BEDTIME, success: true });

//     // Verify scores remain 0 for UserA, as events were outside the valid date range
//     const scores = await concept.scores.findOne({ u: userA, competitionId: competitionId });
//     assertEquals(scores?.bedTimeScore, 0, "Bedtime score should remain 0 for events outside the competition's date range.");
//     assertEquals(scores?.wakeUpScore, 0, "Wakeup score should remain 0 for events outside the competition's date range.");
//     console.log("State verification: Scores for UserA are unchanged (0) as events occurred outside valid competition dates.");

//     // Now, mark the competition as inactive and try to record a stat
//     await concept.competitions.updateOne({ _id: competitionId }, { $set: { active: false } });
//     console.log(`Competition ${competitionId} explicitly set to inactive.`);

//     console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 3, 6)} for an inactive competition`);
//     const recordInactiveResult = await concept.recordStat({ u: userA, dateStr: createDate(2023, 3, 6), eventType: SleepEventType.BEDTIME, success: true });
//     assertEquals((recordInactiveResult as { error: string }).error, "User is not part of any active competition.", "Should return an error when trying to record stats for an inactive competition.");
//     console.log(`Output: Error - ${recordInactiveResult.error}`);
//   });

//   // --- Interesting Scenario 3: Tie condition among all participants ---
//   await test.step("Scenario 3: Tie condition among all participants", async () => {
//     console.log("\n--- Scenario 3: Tie condition among all participants ---");

//     const startDate = createDate(2023, 4, 1);
//     const endDate = createDate(2023, 4, 2);
//     const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: startDate, endDateStr: endDate });
//     const competitionId = (compResult as { competitionId: ID }).competitionId;
//     console.log(`Competition started for ${userA}, ${userB}. ID: ${competitionId}`);

//     // Ensure both users have identical scores
//     console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 4, 1)}`);
//     await concept.recordStat({ u: userA, dateStr: createDate(2023, 4, 1), eventType: SleepEventType.BEDTIME, success: true }); // userA total: +1
//     console.log(`Action: recordStat - ${userB} BEDTIME success on ${createDate(2023, 4, 1)}`);
//     await concept.recordStat({ u: userB, dateStr: createDate(2023, 4, 1), eventType: SleepEventType.BEDTIME, success: true }); // userB total: +1

//     // Update competition end date to allow ending
//     await concept.competitions.updateOne({ _id: competitionId }, { $set: { endDate: new Date(createDate(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())) } });
//     console.log(`Action: endCompetition for ID: ${competitionId}`);
//     const endResult = await concept.endCompetition({ competitionId: competitionId });

//     assertEquals(endResult.winners, null, "Winners should be null if all participants tie with the highest score.");
//     console.log(`Output: Winners: ${endResult.winners}`);

//     const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
//     assertEquals(finalCompetition?.winners, null, "Competition winners field should be null in case of a tie among all participants.");
//     console.log("State verification: Winners field is null, correctly indicating a tie among all participants.");
//   });

//   // --- Interesting Scenario 4: Single winner ---
//   await test.step("Scenario 4: Single winner", async () => {
//     console.log("\n--- Scenario 4: Single winner ---");

//     const startDate = createDate(2023, 5, 1);
//     const endDate = createDate(2023, 5, 2);
//     const compResult = await concept.startCompetition({ participants: [userA, userB, userC], startDateStr: startDate, endDateStr: endDate });
//     const competitionId = (compResult as { competitionId: ID }).competitionId;
//     console.log(`Competition started for ${userA}, ${userB}, ${userC}. ID: ${competitionId}`);

//     // UserA: total 2 (highest score)
//     await concept.recordStat({ u: userA, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.BEDTIME, success: true });
//     await concept.recordStat({ u: userA, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.WAKETIME, success: true });
//     // UserB: total 1
//     await concept.recordStat({ u: userB, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.BEDTIME, success: true });
//     // UserC: total 0
//     await concept.recordStat({ u: userC, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.BEDTIME, success: false });

//     // Update competition end date to allow ending
//     await concept.competitions.updateOne({ _id: competitionId }, { $set: { endDate: new Date(createDate(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())) } });
//     console.log(`Action: endCompetition for ID: ${competitionId}`);
//     const endResult = await concept.endCompetition({ competitionId: competitionId });

//     assertEquals(endResult.winners, [userA], "The winner should be UserA, as they have the highest score.");
//     console.log(`Output: Winners: ${endResult.winners}`);

//     const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
//     assertEquals(finalCompetition?.winners, [userA], "Competition winners field should correctly store UserA as the single winner.");
//     console.log("State verification: A single winner is correctly identified and recorded.");
//   });

//   // --- Interesting Scenario 5: Multiple Winners (subset tie) ---
//   await test.step("Scenario 5: Multiple Winners (subset tie)", async () => {
//     console.log("\n--- Scenario 5: Multiple Winners (subset tie) ---");

//     const startDate = createDate(2023, 6, 1);
//     const endDate = createDate(2023, 6, 2);
//     const compResult = await concept.startCompetition({ participants: [userA, userB, userC, userD], startDateStr: startDate, endDateStr: endDate });
//     const competitionId = (compResult as { competitionId: ID }).competitionId;
//     console.log(`Competition started for ${userA}, ${userB}, ${userC}, ${userD}. ID: ${competitionId}`);

//     // UserA: total 2 (tied for highest)
//     await concept.recordStat({ u: userA, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.BEDTIME, success: true });
//     await concept.recordStat({ u: userA, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.WAKETIME, success: true });
//     // UserB: total 2 (tied for highest)
//     await concept.recordStat({ u: userB, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.BEDTIME, success: true });
//     await concept.recordStat({ u: userB, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.WAKETIME, success: true });
//     // UserC: total 1
//     await concept.recordStat({ u: userC, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.BEDTIME, success: true });
//     // UserD: total 0
//     await concept.recordStat({ u: userD, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.BEDTIME, success: false });

//     // Update competition end date to allow ending
//     await concept.competitions.updateOne({ _id: competitionId }, { $set: { endDate: new Date(createDate(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())) } });
//     console.log(`Action: endCompetition for ID: ${competitionId}`);
//     const endResult = await concept.endCompetition({ competitionId: competitionId });

//     assertArrayIncludes(endResult.winners as ID[], [userA, userB], "Winners should include UserA and UserB.");
//     assertEquals(endResult.winners?.length, 2, "There should be exactly two winners.");
//     console.log(`Output: Winners: ${endResult.winners}`);

//     const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
//     assertArrayIncludes(finalCompetition?.winners as ID[], [userA, userB], "Competition winners field should correctly store UserA and UserB as winners.");
//     assertEquals(finalCompetition?.winners?.length, 2, "Competition winners field should have two winners.");
//     console.log("State verification: Multiple winners (subset tie) are correctly identified and recorded.");
//   });

//   // --- Interesting Scenario 6: End competition before its end date ---
//   await test.step("Scenario 6: End competition before end date", async () => {
//     console.log("\n--- Scenario 6: End competition before end date ---");

//     const futureEndDate = createDate(2025, 1, 1); // Set end date far in the future
//     const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: createDate(2024, 1, 1), endDateStr: futureEndDate });
//     const competitionId = (compResult as { competitionId: ID }).competitionId;
//     console.log(`Competition started with future end date: ${futureEndDate}. ID: ${competitionId}`);

//     console.log(`Action: endCompetition for ID: ${competitionId}`);
//     const endResult = await concept.endCompetition({ competitionId: competitionId });

//     assertEquals((endResult as { error: string }).error, `Competition ${competitionId} has not ended yet. End date is ${new Date(futureEndDate).toDateString()}.`, "Should return an error if endCompetition is called before the competition's end date.");
//     console.log(`Output: Error - ${endResult.error}`);

//     const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
//     assertEquals(finalCompetition?.active, true, "Competition should still be active as it hasn't genuinely ended.");
//     assertEquals(finalCompetition?.winners, null, "Competition winners should still be null as no winner has been determined.");
//     console.log("State verification: Competition state remains unchanged (still active, no winner determined).");
//   });

//   // --- Interesting Scenario 7: Recording multiple stats for the same day and event type ---
//   await test.step("Scenario 7: Recording multiple stats for the same day and event type", async () => {
//     console.log("\n--- Scenario 7: Recording multiple stats for the same day and event type ---");

//     const startDate = createDate(2023, 7, 1);
//     const endDate = createDate(2023, 7, 3);
//     const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: startDate, endDateStr: endDate });
//     const competitionId = (compResult as { competitionId: ID }).competitionId;
//     console.log(`Competition started for ${userA}, ${userB}. ID: ${competitionId}`);

//     const eventDate = createDate(2023, 7, 2); // Mid-competition date

//     console.log(`Action: recordStat - ${userA} BEDTIME success on ${eventDate}`);
//     await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true }); // +1
//     console.log(`Action: recordStat - ${userA} BEDTIME success on ${eventDate}`);
//     await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true }); // +1
//     console.log(`Action: recordStat - ${userA} BEDTIME failure on ${eventDate}`);
//     await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: false }); // -1
//     // Expected bedtime score for userA: 1 + 1 - 1 = 1

//     console.log(`Action: recordStat - ${userA} WAKETIME success on ${eventDate}`);
//     await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.WAKETIME, success: true }); // +1
//     console.log(`Action: recordStat - ${userA} WAKETIME failure on ${eventDate}`);
//     await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.WAKETIME, success: false }); // -1
//     // Expected waketime score for userA: 1 - 1 = 0

//     const scores = await concept.scores.findOne({ u: userA, competitionId: competitionId });
//     assertEquals(scores?.bedTimeScore, 1, "Bedtime score should be 1 after multiple updates for same day/event type.");
//     assertEquals(scores?.wakeUpScore, 0, "Wakeup score should be 0 after multiple updates for same day/event type.");
//     console.log("State verification: Scores correctly accumulated for multiple status updates on the same day and event type.");
//   });

//   // Ensure client is closed after all tests
//   await client.close();
// });
