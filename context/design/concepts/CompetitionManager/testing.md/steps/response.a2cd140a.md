---
timestamp: 'Wed Oct 15 2025 02:08:03 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_020803.28df071d.md]]'
content_id: a2cd140a36a612508b64b3143342983ae9a5b689bdc2d7017b1a8dfc0b41637c
---

# response:

```typescript
// file: src/CompetitionManager/CompetitionManagerConcept.test.ts

import { assertEquals, assertNotEquals, assertArrayIncludes, assert } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import CompetitionManagerConcept, { SleepEventType } from "./CompetitionManagerConcept.ts";

// Helper function to create consistent date strings for testing (YYYY-MM-DD)
const createDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month - 1, day); // Month is 0-indexed in Date constructor
  return date.toISOString().split("T")[0]; // Get YYYY-MM-DD part
};

Deno.test("CompetitionManager Concept Tests", async (test) => {
  const [db, client] = await testDb();
  const concept = new CompetitionManagerConcept(db);

  // Define some generic User IDs for testing
  const userA = "user:Alice" as ID;
  const userB = "user:Bob" as ID;
  const userC = "user:Charlie" as ID;
  const userD = "user:David" as ID;

  // --- trace: Operational Principle - Basic Competition Lifecycle with a clear winner ---
  await test.step("trace: Operational Principle - Basic Competition Lifecycle with a clear winner", async () => {
    console.log("\n--- Trace: Operational Principle ---");

    // 1. Users initiate a competition with one or more other users, specifying a start and end date.
    const startDateStr = createDate(2023, 1, 1); // Jan 1, 2023
    const endDateStr = createDate(2023, 1, 3); // Jan 3, 2023

    console.log(`Action: startCompetition with participants: [${userA}, ${userB}], start: ${startDateStr}, end: ${endDateStr}`);
    const competitionResult = await concept.startCompetition({
      participants: [userA, userB],
      startDateStr: startDateStr,
      endDateStr: endDateStr,
    });

    // Confirm the competition started successfully
    assert("competitionId" in competitionResult, "Expected successful competition start (no error).");
    const competitionId = (competitionResult as { competitionId: ID }).competitionId;
    console.log(`Output: Competition started successfully with ID: ${competitionId}`);

    // Verify initial state: competition is active, no winners, scores are 0
    const initialCompetition = await concept.competitions.findOne({ _id: competitionId });
    assertEquals(initialCompetition?.active, true, "Competition should be active immediately after creation.");
    assertEquals(initialCompetition?.winners, null, "Competition winners should be null at the start.");

    const initialScores = await concept.scores.find({ competitionId: competitionId }).toArray();
    assertEquals(initialScores.length, 2, "There should be initial score entries for both participants.");
    initialScores.forEach(score => {
      assertEquals(score.wakeUpScore, 0, "Initial wakeUpScore for participants should be 0.");
      assertEquals(score.bedTimeScore, 0, "Initial bedTimeScore for participants should be 0.");
    });
    console.log("State verification: Competition is active, no winners set, and all participant scores are initialized to zero.");

    // 2. Throughout the competition duration, participants' sleep adherence events are recorded.
    // Based on the success or failure of these events, individual scores are accumulated.

    // Day 1: January 1, 2023
    console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 1, 1)}`);
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 1, 1), eventType: SleepEventType.BEDTIME, success: true });
    console.log(`Action: recordStat - ${userA} WAKETIME success on ${createDate(2023, 1, 1)}`);
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 1, 1), eventType: SleepEventType.WAKETIME, success: true }); // userA total: +2

    console.log(`Action: recordStat - ${userB} BEDTIME success on ${createDate(2023, 1, 1)}`);
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 1, 1), eventType: SleepEventType.BEDTIME, success: true });
    console.log(`Action: recordStat - ${userB} WAKETIME failure on ${createDate(2023, 1, 1)}`);
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 1, 1), eventType: SleepEventType.WAKETIME, success: false }); // userB total: 1 + (-1) = 0

    // Day 2: January 2, 2023
    console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 1, 2)}`);
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 1, 2), eventType: SleepEventType.BEDTIME, success: true });
    console.log(`Action: recordStat - ${userA} WAKETIME success on ${createDate(2023, 1, 2)}`);
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 1, 2), eventType: SleepEventType.WAKETIME, success: true }); // userA total: +2 (from day1) + 2 = 4

    console.log(`Action: recordStat - ${userB} BEDTIME failure on ${createDate(2023, 1, 2)}`);
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 1, 2), eventType: SleepEventType.BEDTIME, success: false });
    console.log(`Action: recordStat - ${userB} WAKETIME success on ${createDate(2023, 1, 2)}`);
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 1, 2), eventType: SleepEventType.WAKETIME, success: true }); // userB total: 0 (from day1) + (-1) + 1 = 0

    // Verify intermediate scores after recording events
    const scoresAfterRecording = await concept.scores.find({ competitionId: competitionId }).toArray();
    const scoreA = scoresAfterRecording.find(s => s.u === userA);
    const scoreB = scoresAfterRecording.find(s => s.u === userB);

    assertEquals(scoreA?.bedTimeScore, 2, `User ${userA}'s bedtime score should be 2.`);
    assertEquals(scoreA?.wakeUpScore, 2, `User ${userA}'s waketime score should be 2.`); // Total score for UserA: 4

    assertEquals(scoreB?.bedTimeScore, 0, `User ${userB}'s bedtime score should be 0 (1 success, 1 failure).`);
    assertEquals(scoreB?.wakeUpScore, 0, `User ${userB}'s waketime score should be 0 (1 success, 1 failure).`); // Total score for UserB: 0
    console.log("State verification: Intermediate scores updated correctly based on events.");

    // 3. Upon the competition's conclusion, these scores are tallied, and a winner is determined.
    // To ensure `endCompetition` can be called, we must update the competition's `endDate` to be today or earlier.
    const today = new Date();
    const todayStr = createDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
    await concept.competitions.updateOne({ _id: competitionId }, { $set: { endDate: new Date(todayStr) } });
    console.log(`Competition ${competitionId}'s end date updated to ${todayStr} to allow immediate ending.`);

    console.log(`Action: endCompetition for ID: ${competitionId}`);
    const endResult = await concept.endCompetition({ competitionId: competitionId });

    assert("winners" in endResult, "Expected successful competition end (no error).");
    const winners = (endResult as { winners: ID[] | null }).winners;
    console.log(`Output: Competition ended. Winners: ${winners}`);

    // Verify final state: competition is inactive, and the correct winner is recorded
    const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
    assertEquals(finalCompetition?.active, false, "Competition should be inactive after being ended.");
    assertEquals(finalCompetition?.winners, [userA], "The winner should be UserA based on scores.");
    assertEquals(winners, [userA], "The returned winners from endCompetition should be UserA.");
    console.log("State verification: Competition is inactive, and the correct single winner is determined and recorded.");
  });

  // --- Scenario 1: Invalid Competition Start & Overlap ---
  await test.step("Scenario 1: Invalid Competition Start Conditions", async () => {
    console.log("\n--- Scenario 1: Invalid Competition Start Conditions ---");

    // Test case: Less than two distinct participants
    console.log(`Action: startCompetition with 1 participant: [${userA}]`);
    const result1 = await concept.startCompetition({
      participants: [userA],
      startDateStr: createDate(2023, 2, 1),
      endDateStr: createDate(2023, 2, 5),
    });
    assertEquals((result1 as { error: string }).error, "Participants must contain at least two distinct users.", "Should return an error for less than 2 participants.");
    console.log(`Output: Error - ${result1.error}`);

    // Test case: Invalid date strings
    console.log(`Action: startCompetition with invalid startDateStr`);
    const result2 = await concept.startCompetition({
      participants: [userA, userB],
      startDateStr: "not-a-date",
      endDateStr: createDate(2023, 2, 5),
    });
    assertEquals((result2 as { error: string }).error, "Invalid startDateStr or endDateStr.", "Should return an error for invalid startDate string.");
    console.log(`Output: Error - ${result2.error}`);

    // Test case: End date logically precedes start date
    console.log(`Action: startCompetition with endDate before startDate`);
    const result3 = await concept.startCompetition({
      participants: [userA, userB],
      startDateStr: createDate(2023, 2, 5),
      endDateStr: createDate(2023, 2, 1),
    });
    assertEquals((result3 as { error: string }).error, "Start date cannot be after end date.", "Should return an error for endDate before startDate.");
    console.log(`Output: Error - ${result3.error}`);

    // Test case: Overlapping Competitions Violation
    // Start an initial active competition for userA
    const initialCompStartDate = createDate(2023, 8, 1);
    const initialCompEndDate = createDate(2023, 8, 10);
    const initialCompResult = await concept.startCompetition({
      participants: [userA, userC],
      startDateStr: initialCompStartDate,
      endDateStr: initialCompEndDate,
    });
    assert("competitionId" in initialCompResult, "Expected successful initial competition start.");
    const initialCompetitionId = (initialCompResult as { competitionId: ID }).competitionId;
    console.log(`Initial active competition (${initialCompetitionId}) started for ${userA}, ${userC} from ${initialCompStartDate} to ${initialCompEndDate}.`);

    // Attempt to start a second competition for userA that overlaps
    const overlappingStartDate = createDate(2023, 8, 5); // Overlaps with initialComp
    const overlappingEndDate = createDate(2023, 8, 15);
    console.log(`Action: startCompetition for [${userA}, ${userB}] with overlapping dates ${overlappingStartDate} to ${overlappingEndDate}`);
    const overlappingCompResult = await concept.startCompetition({
      participants: [userA, userB], // userA is in initialComp
      startDateStr: overlappingStartDate,
      endDateStr: overlappingEndDate,
    });
    assertEquals(
      (overlappingCompResult as { error: string }).error,
      `Participant ${userA} is already in an active competition (${initialCompetitionId}) that overlaps with the proposed dates.`,
      "Should return an error for starting an overlapping active competition for a participant."
    );
    console.log(`Output: Error - ${overlappingCompResult.error}`);

    // Test for a non-overlapping competition for userA, which *should* succeed (different time period)
    const nonOverlappingStartDate = createDate(2023, 9, 1);
    const nonOverlappingEndDate = createDate(2023, 9, 10);
    console.log(`Action: startCompetition for [${userA}, ${userB}] with non-overlapping dates ${nonOverlappingStartDate} to ${nonOverlappingEndDate}`);
    const nonOverlappingCompResult = await concept.startCompetition({
      participants: [userA, userB],
      startDateStr: nonOverlappingStartDate,
      endDateStr: nonOverlappingEndDate,
    });
    assert("competitionId" in nonOverlappingCompResult, "Expected successful start for non-overlapping competition for same user.");
    console.log(`Output: Non-overlapping competition started successfully with ID: ${(nonOverlappingCompResult as { competitionId: ID }).competitionId}`);
  });

  // --- Scenario 2: Record Stat Validation ---
  await test.step("Scenario 2: Record Stat Validation", async () => {
    console.log("\n--- Scenario 2: Record Stat Validation ---");

    const compStartDate = createDate(2023, 3, 5);
    const compEndDate = createDate(2023, 3, 10);
    const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: compStartDate, endDateStr: compEndDate });
    assert("competitionId" in compResult, "Expected successful competition start.");
    const competitionId = (compResult as { competitionId: ID }).competitionId;
    console.log(`Competition started for ${userA}, ${userB} from ${compStartDate} to ${compEndDate}. ID: ${competitionId}`);

    // Record stat for a date before the competition's start date
    console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 3, 4)} (before competition start)`);
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 3, 4), eventType: SleepEventType.BEDTIME, success: true });

    // Record stat for a date after the competition's end date
    console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 3, 11)} (after competition end)`);
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 3, 11), eventType: SleepEventType.BEDTIME, success: true });

    // Verify scores remain 0 for UserA, as events were outside the valid date range
    const scores = await concept.scores.findOne({ u: userA, competitionId: competitionId });
    assertEquals(scores?.bedTimeScore, 0, "Bedtime score should remain 0 for events outside the competition's date range.");
    assertEquals(scores?.wakeUpScore, 0, "Wakeup score should remain 0 for events outside the competition's date range.");
    console.log("State verification: Scores for UserA are unchanged (0) as events occurred outside valid competition dates.");

    // Now, mark the competition as inactive and try to record a stat
    await concept.competitions.updateOne({ _id: competitionId }, { $set: { active: false } });
    console.log(`Competition ${competitionId} explicitly set to inactive.`);

    console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 3, 6)} for an inactive competition`);
    const recordInactiveResult = await concept.recordStat({ u: userA, dateStr: createDate(2023, 3, 6), eventType: SleepEventType.BEDTIME, success: true });
    assertEquals((recordInactiveResult as { error: string }).error, "User is not part of any active competition.", "Should return an error when trying to record stats for an inactive competition.");
    console.log(`Output: Error - ${recordInactiveResult.error}`);
  });

  // --- Scenario 3: End Competition - Tie Scenarios ---
  await test.step("Scenario 3: End Competition - Tie Scenarios", async () => {
    console.log("\n--- Scenario 3: End Competition - Tie Scenarios ---");

    // Test case: Tie across all participants
    const startDateAllTie = createDate(2023, 4, 1);
    const endDateAllTie = createDate(2023, 4, 2);
    const compResultAllTie = await concept.startCompetition({ participants: [userA, userB], startDateStr: startDateAllTie, endDateStr: endDateAllTie });
    assert("competitionId" in compResultAllTie, "Expected successful competition start.");
    const competitionIdAllTie = (compResultAllTie as { competitionId: ID }).competitionId;
    console.log(`Competition started for ${userA}, ${userB} (all tie). ID: ${competitionIdAllTie}`);

    // Ensure both users have identical scores
    console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 4, 1)}`);
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 4, 1), eventType: SleepEventType.BEDTIME, success: true }); // userA total: +1
    console.log(`Action: recordStat - ${userB} BEDTIME success on ${createDate(2023, 4, 1)}`);
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 4, 1), eventType: SleepEventType.BEDTIME, success: true }); // userB total: +1

    // Update competition end date to allow ending
    await concept.competitions.updateOne({ _id: competitionIdAllTie }, { $set: { endDate: new Date(createDate(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())) } });
    console.log(`Action: endCompetition for ID: ${competitionIdAllTie}`);
    const endResultAllTie = await concept.endCompetition({ competitionId: competitionIdAllTie });

    assertEquals(endResultAllTie.winners, null, "Winners should be null if all participants tie with the highest score.");
    console.log(`Output: All-tie winners: ${endResultAllTie.winners}`);

    const finalCompetitionAllTie = await concept.competitions.findOne({ _id: competitionIdAllTie });
    assertEquals(finalCompetitionAllTie?.winners, null, "Competition winners field should be null in case of a tie among all participants.");
    console.log("State verification: Winners field is null, correctly indicating a tie among all participants.");

    // Test case: Multiple Winners (subset tie)
    const startDateSubsetTie = createDate(2023, 5, 1);
    const endDateSubsetTie = createDate(2023, 5, 2);
    const compResultSubsetTie = await concept.startCompetition({ participants: [userA, userB, userC, userD], startDateStr: startDateSubsetTie, endDateStr: endDateSubsetTie });
    assert("competitionId" in compResultSubsetTie, "Expected successful competition start.");
    const competitionIdSubsetTie = (compResultSubsetTie as { competitionId: ID }).competitionId;
    console.log(`Competition started for ${userA}, ${userB}, ${userC}, ${userD} (subset tie). ID: ${competitionIdSubsetTie}`);

    // UserA: total 2 (tied for highest)
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.WAKETIME, success: true });
    // UserB: total 2 (tied for highest)
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.WAKETIME, success: true });
    // UserC: total 1
    await concept.recordStat({ u: userC, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.BEDTIME, success: true });
    // UserD: total 0
    await concept.recordStat({ u: userD, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.BEDTIME, success: false });

    // Update competition end date to allow ending
    await concept.competitions.updateOne({ _id: competitionIdSubsetTie }, { $set: { endDate: new Date(createDate(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())) } });
    console.log(`Action: endCompetition for ID: ${competitionIdSubsetTie}`);
    const endResultSubsetTie = await concept.endCompetition({ competitionId: competitionIdSubsetTie });

    assertArrayIncludes(endResultSubsetTie.winners as ID[], [userA, userB], "Winners should include UserA and UserB for subset tie.");
    assertEquals(endResultSubsetTie.winners?.length, 2, "There should be exactly two winners for subset tie.");
    console.log(`Output: Subset-tie winners: ${endResultSubsetTie.winners}`);

    const finalCompetitionSubsetTie = await concept.competitions.findOne({ _id: competitionIdSubsetTie });
    assertArrayIncludes(finalCompetitionSubsetTie?.winners as ID[], [userA, userB], "Competition winners field should correctly store UserA and UserB as winners for subset tie.");
    assertEquals(finalCompetitionSubsetTie?.winners?.length, 2, "Competition winners field should have two winners for subset tie.");
    console.log("State verification: Multiple winners (subset tie) are correctly identified and recorded.");
  });

  // --- Scenario 4: Participant Management & Leaderboard ---
  await test.step("Scenario 4: Participant Management & Leaderboard", async () => {
    console.log("\n--- Scenario 4: Participant Management & Leaderboard ---");

    const startDate = createDate(2023, 6, 1);
    const endDate = createDate(2023, 6, 10);
    const compResult = await concept.startCompetition({ participants: [userA, userB, userC, userD], startDateStr: startDate, endDateStr: endDate });
    assert("competitionId" in compResult, "Expected successful competition start.");
    const competitionId = (compResult as { competitionId: ID }).competitionId;
    console.log(`Competition started for ${userA}, ${userB}, ${userC}, ${userD}. ID: ${competitionId}`);

    // Record some stats for leaderboard demonstration
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 6, 2), eventType: SleepEventType.BEDTIME, success: true }); // A: 1
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 6, 2), eventType: SleepEventType.BEDTIME, success: true }); // B: 1
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 6, 2), eventType: SleepEventType.WAKETIME, success: true }); // B: 2
    await concept.recordStat({ u: userC, dateStr: createDate(2023, 6, 2), eventType: SleepEventType.BEDTIME, success: true }); // C: 1
    await concept.recordStat({ u: userC, dateStr: createDate(2023, 6, 3), eventType: SleepEventType.BEDTIME, success: true }); // C: 2
    await concept.recordStat({ u: userD, dateStr: createDate(2023, 6, 2), eventType: SleepEventType.BEDTIME, success: true }); // D: 1
    await concept.recordStat({ u: userD, dateStr: createDate(2023, 6, 3), eventType: SleepEventType.BEDTIME, success: true }); // D: 2
    await concept.recordStat({ u: userD, dateStr: createDate(2023, 6, 3), eventType: SleepEventType.WAKETIME, success: true }); // D: 3 (highest)

    // Test getLeaderboard accuracy
    console.log(`Action: getLeaderboard for ID: ${competitionId}`);
    const leaderboardResult = await concept.getLeaderboard({ competitionId: competitionId });
    assert("leaderboard" in leaderboardResult, "Expected successful leaderboard retrieval.");
    const leaderboard = (leaderboardResult as { leaderboard: Array<any> }).leaderboard;
    console.log("Output: Leaderboard:", leaderboard);

    // Expected order: D (3), B (2), C (2), A (1) - C and B are tied for 2nd
    assertEquals(leaderboard.length, 4, "Leaderboard should have 4 entries.");
    assertEquals(leaderboard[0].userId, userD, "UserD should be 1st with score 3.");
    assertEquals(leaderboard[0].position, 1, "UserD's position should be 1.");
    assertArrayIncludes([userB, userC], [leaderboard[1].userId, leaderboard[2].userId], "UserB and UserC should be 2nd/3rd, tied with score 2.");
    assertEquals(leaderboard[1].position, 2, "UserB's position should be 2.");
    assertEquals(leaderboard[2].position, 2, "UserC's position should be 2."); // Tied rank
    assertEquals(leaderboard[3].userId, userA, "UserA should be 4th with score 1.");
    assertEquals(leaderboard[3].position, 4, "UserA's position should be 4.");
    console.log("State verification: Leaderboard correctly sorted and ranked, handling ties.");

    // Test case: Successful Participant Removal (from a competition with > 2 participants)
    console.log(`Action: removeParticipant - Removing ${userA} from competition ${competitionId}`);
    const removeResultSuccess = await concept.removeParticipant({ competitionId: competitionId, userId: userA });
    assertEquals("error" in removeResultSuccess, false, "Expected successful participant removal.");
    console.log(`Output: Participant ${userA} removed successfully.`);

    // Verify userA is gone from competition and scores
    const updatedCompetition = await concept.competitions.findOne({ _id: competitionId });
    assertNotEquals(updatedCompetition?.participants.includes(userA), true, "UserA should no longer be in competition participants.");
    const userAScoreAfterRemoval = await concept.scores.findOne({ u: userA, competitionId: competitionId });
    assertEquals(userAScoreAfterRemoval, null, "UserA's scores should be removed after participant removal.");
    assertEquals(updatedCompetition?.participants.length, 3, "Competition should now have 3 participants.");
    console.log("State verification: UserA successfully removed from competition and scores.");

    // Test case: Removing Participant to Invalidate Competition (from a 2-person competition)
    // First, set up a new 2-person competition
    const comp2ParticipantsStartDate = createDate(2023, 7, 1);
    const comp2ParticipantsEndDate = createDate(2023, 7, 5);
    const compResult2 = await concept.startCompetition({ participants: [userB, userC], startDateStr: comp2ParticipantsStartDate, endDateStr: comp2ParticipantsEndDate });
    assert("competitionId" in compResult2, "Expected successful 2-participant competition start.");
    const competitionId2 = (compResult2 as { competitionId: ID }).competitionId;
    console.log(`New 2-participant competition (${competitionId2}) started for ${userB}, ${userC}.`);

    console.log(`Action: removeParticipant - Attempting to remove ${userB} from 2-participant competition ${competitionId2}`);
    const removeResultFailure = await concept.removeParticipant({ competitionId: competitionId2, userId: userB });
    assertEquals((removeResultFailure as { error: string }).error, `Cannot remove participant. Competition ${competitionId2} requires at least two participants.`, "Should return an error when trying to remove a participant from a 2-person competition.");
    console.log(`Output: Error - ${removeResultFailure.error}`);

    // Verify no change to competition participants or scores
    const unchangedCompetition = await concept.competitions.findOne({ _id: competitionId2 });
    assertEquals(unchangedCompetition?.participants.includes(userB), true, "UserB should still be in competition participants.");
    assertEquals(unchangedCompetition?.participants.length, 2, "Competition should still have 2 participants.");
    const userBScoreAfterFailedRemoval = await concept.scores.findOne({ u: userB, competitionId: competitionId2 });
    assertNotEquals(userBScoreAfterFailedRemoval, null, "UserB's scores should still exist after failed removal.");
    console.log("State verification: Failed removal from 2-person competition, state unchanged.");
  });

  // --- Scenario 5: Repeated Record Stats ---
  await test.step("Scenario 5: Repeated Record Stats", async () => {
    console.log("\n--- Scenario 5: Repeated Record Stats ---");

    const startDate = createDate(2023, 7, 1);
    const endDate = createDate(2023, 7, 3);
    const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: startDate, endDateStr: endDate });
    assert("competitionId" in compResult, "Expected successful competition start.");
    const competitionId = (compResult as { competitionId: ID }).competitionId;
    console.log(`Competition started for ${userA}, ${userB}. ID: ${competitionId}`);

    const eventDate = createDate(2023, 7, 2); // Mid-competition date

    // Multiple BEDTIME stats
    console.log(`Action: recordStat - ${userA} BEDTIME success on ${eventDate}`);
    await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true }); // +1
    console.log(`Action: recordStat - ${userA} BEDTIME success on ${eventDate}`);
    await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true }); // +1
    console.log(`Action: recordStat - ${userA} BEDTIME failure on ${eventDate}`);
    await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: false }); // -1
    // Expected bedtime score for userA: 1 + 1 - 1 = 1

    // Multiple WAKETIME stats
    console.log(`Action: recordStat - ${userA} WAKETIME success on ${eventDate}`);
    await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.WAKETIME, success: true }); // +1
    console.log(`Action: recordStat - ${userA} WAKETIME failure on ${eventDate}`);
    await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.WAKETIME, success: false }); // -1
    // Expected waketime score for userA: 1 - 1 = 0

    const scores = await concept.scores.findOne({ u: userA, competitionId: competitionId });
    assertEquals(scores?.bedTimeScore, 1, "Bedtime score should be 1 after multiple updates for same day/event type.");
    assertEquals(scores?.wakeUpScore, 0, "Wakeup score should be 0 after multiple updates for same day/event type.");
    console.log("State verification: Scores correctly accumulated for multiple status updates on the same day and event type.");
  });

  // --- Scenario 6: End Competition Before End Date ---
  await test.step("Scenario 6: End Competition Before End Date", async () => {
    console.log("\n--- Scenario 6: End Competition Before End Date ---");

    const futureEndDate = createDate(2025, 1, 1); // Set end date far in the future
    const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: createDate(2024, 1, 1), endDateStr: futureEndDate });
    assert("competitionId" in compResult, "Expected successful competition start.");
    const competitionId = (compResult as { competitionId: ID }).competitionId;
    console.log(`Competition started with future end date: ${futureEndDate}. ID: ${competitionId}`);

    console.log(`Action: endCompetition for ID: ${competitionId}`);
    const endResult = await concept.endCompetition({ competitionId: competitionId });

    assertEquals((endResult as { error: string }).error, `Competition ${competitionId} has not ended yet. End date is ${new Date(futureEndDate).toDateString()}.`, "Should return an error if endCompetition is called before the competition's end date.");
    console.log(`Output: Error - ${endResult.error}`);

    const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
    assertEquals(finalCompetition?.active, true, "Competition should still be active as it hasn't genuinely ended.");
    assertEquals(finalCompetition?.winners, null, "Competition winners should still be null as no winner has been determined.");
    console.log("State verification: Competition state remains unchanged (still active, no winner determined).");
  });

  // Ensure client is closed after all tests
  await client.close();
});
```
