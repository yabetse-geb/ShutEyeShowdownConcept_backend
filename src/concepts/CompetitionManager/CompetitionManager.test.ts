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
