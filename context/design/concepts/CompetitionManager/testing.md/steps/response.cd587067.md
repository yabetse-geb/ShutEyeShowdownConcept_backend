---
timestamp: 'Wed Oct 15 2025 00:06:34 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_000634.d223d166.md]]'
content_id: cd5870677e0eac00fea9eb8b7c42c06faa55f17df4d0cefc13c4bd0c940c0e95
---

# response:

```typescript
// file: src/CompetitionManager/CompetitionManagerConcept.test.ts

import { assertEquals, assertNotEquals, assertArrayIncludes } from "jsr:@std/assert";
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
    assertNotEquals((competitionResult as { error?: string }).error, undefined, "Expected successful competition start (no error).");
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

    // Confirm the competition ended successfully and a winner was returned
    assertNotEquals((endResult as { error?: string }).error, undefined, "Expected successful competition end (no error).");
    const winners = (endResult as { winners: ID[] | null }).winners;
    console.log(`Output: Competition ended. Winners: ${winners}`);

    // Verify final state: competition is inactive, and the correct winner is recorded
    const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
    assertEquals(finalCompetition?.active, false, "Competition should be inactive after being ended.");
    assertEquals(finalCompetition?.winners, [userA], "The winner should be UserA based on scores.");
    assertEquals(winners, [userA], "The returned winners from endCompetition should be UserA.");
    console.log("State verification: Competition is inactive, and the correct single winner is determined and recorded.");
  });

  // --- Interesting Scenario 1: Invalid Competition Start ---
  await test.step("Scenario 1: Invalid Competition Start", async () => {
    console.log("\n--- Scenario 1: Invalid Competition Start ---");

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
  });

  // --- Interesting Scenario 2: Recording Stats outside competition dates or for an inactive competition ---
  await test.step("Scenario 2: Recording Stats outside competition dates / inactive competition", async () => {
    console.log("\n--- Scenario 2: Record Stat outside competition dates / inactive competition ---");

    const compStartDate = createDate(2023, 3, 5);
    const compEndDate = createDate(2023, 3, 10);
    const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: compStartDate, endDateStr: compEndDate });
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

  // --- Interesting Scenario 3: Tie condition among all participants ---
  await test.step("Scenario 3: Tie condition among all participants", async () => {
    console.log("\n--- Scenario 3: Tie condition among all participants ---");

    const startDate = createDate(2023, 4, 1);
    const endDate = createDate(2023, 4, 2);
    const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: startDate, endDateStr: endDate });
    const competitionId = (compResult as { competitionId: ID }).competitionId;
    console.log(`Competition started for ${userA}, ${userB}. ID: ${competitionId}`);

    // Ensure both users have identical scores
    console.log(`Action: recordStat - ${userA} BEDTIME success on ${createDate(2023, 4, 1)}`);
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 4, 1), eventType: SleepEventType.BEDTIME, success: true }); // userA total: +1
    console.log(`Action: recordStat - ${userB} BEDTIME success on ${createDate(2023, 4, 1)}`);
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 4, 1), eventType: SleepEventType.BEDTIME, success: true }); // userB total: +1

    // Update competition end date to allow ending
    await concept.competitions.updateOne({ _id: competitionId }, { $set: { endDate: new Date(createDate(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())) } });
    console.log(`Action: endCompetition for ID: ${competitionId}`);
    const endResult = await concept.endCompetition({ competitionId: competitionId });

    assertEquals(endResult.winners, null, "Winners should be null if all participants tie with the highest score.");
    console.log(`Output: Winners: ${endResult.winners}`);

    const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
    assertEquals(finalCompetition?.winners, null, "Competition winners field should be null in case of a tie among all participants.");
    console.log("State verification: Winners field is null, correctly indicating a tie among all participants.");
  });

  // --- Interesting Scenario 4: Single winner ---
  await test.step("Scenario 4: Single winner", async () => {
    console.log("\n--- Scenario 4: Single winner ---");

    const startDate = createDate(2023, 5, 1);
    const endDate = createDate(2023, 5, 2);
    const compResult = await concept.startCompetition({ participants: [userA, userB, userC], startDateStr: startDate, endDateStr: endDate });
    const competitionId = (compResult as { competitionId: ID }).competitionId;
    console.log(`Competition started for ${userA}, ${userB}, ${userC}. ID: ${competitionId}`);

    // UserA: total 2 (highest score)
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.WAKETIME, success: true });
    // UserB: total 1
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.BEDTIME, success: true });
    // UserC: total 0
    await concept.recordStat({ u: userC, dateStr: createDate(2023, 5, 1), eventType: SleepEventType.BEDTIME, success: false });

    // Update competition end date to allow ending
    await concept.competitions.updateOne({ _id: competitionId }, { $set: { endDate: new Date(createDate(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())) } });
    console.log(`Action: endCompetition for ID: ${competitionId}`);
    const endResult = await concept.endCompetition({ competitionId: competitionId });

    assertEquals(endResult.winners, [userA], "The winner should be UserA, as they have the highest score.");
    console.log(`Output: Winners: ${endResult.winners}`);

    const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
    assertEquals(finalCompetition?.winners, [userA], "Competition winners field should correctly store UserA as the single winner.");
    console.log("State verification: A single winner is correctly identified and recorded.");
  });

  // --- Interesting Scenario 5: Multiple Winners (subset tie) ---
  await test.step("Scenario 5: Multiple Winners (subset tie)", async () => {
    console.log("\n--- Scenario 5: Multiple Winners (subset tie) ---");

    const startDate = createDate(2023, 6, 1);
    const endDate = createDate(2023, 6, 2);
    const compResult = await concept.startCompetition({ participants: [userA, userB, userC, userD], startDateStr: startDate, endDateStr: endDate });
    const competitionId = (compResult as { competitionId: ID }).competitionId;
    console.log(`Competition started for ${userA}, ${userB}, ${userC}, ${userD}. ID: ${competitionId}`);

    // UserA: total 2 (tied for highest)
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userA, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.WAKETIME, success: true });
    // UserB: total 2 (tied for highest)
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.BEDTIME, success: true });
    await concept.recordStat({ u: userB, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.WAKETIME, success: true });
    // UserC: total 1
    await concept.recordStat({ u: userC, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.BEDTIME, success: true });
    // UserD: total 0
    await concept.recordStat({ u: userD, dateStr: createDate(2023, 6, 1), eventType: SleepEventType.BEDTIME, success: false });

    // Update competition end date to allow ending
    await concept.competitions.updateOne({ _id: competitionId }, { $set: { endDate: new Date(createDate(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())) } });
    console.log(`Action: endCompetition for ID: ${competitionId}`);
    const endResult = await concept.endCompetition({ competitionId: competitionId });

    assertArrayIncludes(endResult.winners as ID[], [userA, userB], "Winners should include UserA and UserB.");
    assertEquals(endResult.winners?.length, 2, "There should be exactly two winners.");
    console.log(`Output: Winners: ${endResult.winners}`);

    const finalCompetition = await concept.competitions.findOne({ _id: competitionId });
    assertArrayIncludes(finalCompetition?.winners as ID[], [userA, userB], "Competition winners field should correctly store UserA and UserB as winners.");
    assertEquals(finalCompetition?.winners?.length, 2, "Competition winners field should have two winners.");
    console.log("State verification: Multiple winners (subset tie) are correctly identified and recorded.");
  });

  // --- Interesting Scenario 6: End competition before its end date ---
  await test.step("Scenario 6: End competition before end date", async () => {
    console.log("\n--- Scenario 6: End competition before end date ---");

    const futureEndDate = createDate(2025, 1, 1); // Set end date far in the future
    const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: createDate(2024, 1, 1), endDateStr: futureEndDate });
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

  // --- Interesting Scenario 7: Recording multiple stats for the same day and event type ---
  await test.step("Scenario 7: Recording multiple stats for the same day and event type", async () => {
    console.log("\n--- Scenario 7: Recording multiple stats for the same day and event type ---");

    const startDate = createDate(2023, 7, 1);
    const endDate = createDate(2023, 7, 3);
    const compResult = await concept.startCompetition({ participants: [userA, userB], startDateStr: startDate, endDateStr: endDate });
    const competitionId = (compResult as { competitionId: ID }).competitionId;
    console.log(`Competition started for ${userA}, ${userB}. ID: ${competitionId}`);

    const eventDate = createDate(2023, 7, 2); // Mid-competition date

    console.log(`Action: recordStat - ${userA} BEDTIME success on ${eventDate}`);
    await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true }); // +1
    console.log(`Action: recordStat - ${userA} BEDTIME success on ${eventDate}`);
    await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: true }); // +1
    console.log(`Action: recordStat - ${userA} BEDTIME failure on ${eventDate}`);
    await concept.recordStat({ u: userA, dateStr: eventDate, eventType: SleepEventType.BEDTIME, success: false }); // -1
    // Expected bedtime score for userA: 1 + 1 - 1 = 1

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

  // Ensure client is closed after all tests
  await client.close();
});
```
