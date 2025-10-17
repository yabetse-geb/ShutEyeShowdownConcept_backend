import { assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import AccountabilityConcept from "./AccountabilityConcept.ts"; // Import the concept
/**
 * SleepEventType: An enumeration representing the type of sleep event.
 * BEDTIME: Represents the event of going to bed.
 * WAKETIME: Represents the event of waking up.
 */
enum SleepEventType {
  BEDTIME = "BEDTIME",
  WAKETIME = "WAKETIME",
}

/**
 * FailureType: Represents the type of adherence failure.
 * Corresponds to SleepEventType for this concept.
 */
type FailureType = SleepEventType;

/**
 * FrequencyType: Defines how often notifications should be reported.
 * Immediate | Daily | Weekly
 */
enum FrequencyType {
  IMMEDIATE = "Immediate",
  DAILY = "Daily",
  WEEKLY = "Weekly",
}

// --- Test Helpers ---
function addDays(baseDate: Date, days: number): Date {
  const newDate = new Date(baseDate);
  newDate.setDate(baseDate.getDate() + days);
  newDate.setUTCHours(0, 0, 0, 0); // Normalize to start of day UTC
  return newDate;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

// Fixed base date for consistent testing
const BASE_DATE = new Date("2024-01-10T12:00:00.000Z"); // Wednesday, Jan 10th, 2024
BASE_DATE.setUTCHours(0, 0, 0, 0);

// User IDs (type branded as ID)
const userAlice = "user:Alice" as ID;
const userBob = "user:Bob" as ID;
const userCharlie = "user:Charlie" as ID;
const userDavid = "user:David" as ID;

// Deno.test("Accountability Concept Tests", async () => {
  // const [db, client] = await testDb();
  // const concept = new AccountabilityConcept(db);

  // Close the client after all tests in this suite
  // test.afterAll(async () => {
  //   if (client) await client.close();
  // });



Deno.test("1. Operational Principle: Establish, Configure, Record, Report Daily", async () => {
  const [db, client] = await testDb();
  const concept:AccountabilityConcept = new AccountabilityConcept(db);
  try{
    // Helper to retrieve partnership for verification
    const getPartnership = async (user: ID, partner: ID) =>
      await concept.partnerships.findOne({ user, partner });
    // Helper to retrieve failures for verification
    const getFailures = async (failingUser: ID, startDate: Date, endDate: Date) =>
      await concept.adherenceFailures
        .find({ failingUser, date: { $gte: startDate, $lte: endDate } })
        .toArray();

    console.log("\n--- Operational Principle Test ---");

    // Actions for setup
    const currentTestDate = BASE_DATE;
    const yesterdayDate = addDays(currentTestDate, -1);
    const formattedCurrentDate = formatDate(currentTestDate);
    const formattedYesterdayDate = formatDate(yesterdayDate);

    // Action: addPartner
    console.log(`Action: addPartner(${userAlice}, ${userBob})`);
    const addPartnerResult = await concept.addPartner({
      user: userAlice,
      partner: userBob,
    });
    console.log("Output:", addPartnerResult);
    assertEquals(addPartnerResult, {}, "addPartner should succeed");

    let partnership = await getPartnership(userAlice, userBob);
    assertEquals(
      partnership?.user,
      userAlice,
      "Partnership should exist for Alice",
    );
    assertEquals(
      partnership?.partner,
      userBob,
      "Partnership should exist for Bob",
    );
    assertEquals(
      partnership?.reportFrequency,
      FrequencyType.IMMEDIATE,
      "Default frequency should be Immediate",
    );

    // Action: updatePreferences
    console.log(
      `Action: updatePreferences(${userAlice}, ${userBob}, [BEDTIME], DAILY)`,
    );
    const updatePrefsResult = await concept.updatePreferences({
      user: userAlice,
      partner: userBob,
      notifyTypes: [SleepEventType.BEDTIME],
      reportFrequency: FrequencyType.DAILY,
    });
    console.log("Output:", updatePrefsResult);
    assertEquals(updatePrefsResult, {}, "updatePreferences should succeed");

    partnership = await getPartnership(userAlice, userBob);
    assertEquals(
      partnership?.reportFrequency,
      FrequencyType.DAILY,
      "Frequency should be updated to Daily",
    );
    assertEquals(
      partnership?.notifyTypes,
      [SleepEventType.BEDTIME],
      "Notify types should be updated",
    );

    // Action: recordFailure
    console.log(
      `Action: recordFailure(${userAlice}, ${formattedYesterdayDate}, BEDTIME)`,
    );
    const recordFailureResult = await concept.recordFailure({
      user: userAlice,
      date: formattedYesterdayDate,
      failureType: SleepEventType.BEDTIME,
    });
    console.log("Output:", recordFailureResult);
    assertEquals(recordFailureResult, {}, "recordFailure should succeed");

    let failures = await getFailures(userAlice, yesterdayDate, yesterdayDate);
    assertEquals(failures.length, 1, "One failure should be recorded");
    assertEquals(
      failures[0].reported,
      false,
      "Failure should initially be unreported",
    );

    // Action: generateNotificationMessage (triggers daily report)
    console.log(
      `Action: generateNotificationMessage(${userAlice}, ${formattedCurrentDate}) - Day 0`,
    );
    const generateReportResult = await concept.generateNotificationMessage({
      user: userAlice,
      date: formattedCurrentDate,
    });
    console.log("Output:", generateReportResult);
    assertEquals(
      (generateReportResult as { message: string }).message.includes(
        "Daily Report for user:Bob",
      ),
      true,
      "Should generate a daily report for Bob",
    );
    assertEquals(
      (generateReportResult as { message: string }).message.includes(
        `Date: ${formattedYesterdayDate}`,
      ),
      true,
      "Report should include yesterday's failure",
    );

    // Verify effects: failure reported, lastReportDate updated
    failures = await getFailures(userAlice, yesterdayDate, yesterdayDate);
    assertEquals(failures[0].reported, true, "Failure should be marked reported");

    partnership = await getPartnership(userAlice, userBob);
    assertEquals(
      formatDate(partnership?.lastReportDate!),
      formattedCurrentDate,
      "lastReportDate should be updated to current date",
    );

    // Try generating report again for the same day (should be empty as daily already sent)
    console.log(
      `Action: generateNotificationMessage(${userAlice}, ${formattedCurrentDate}) - Day 0 (again)`,
    );
    const generateReportAgainResult = await concept.generateNotificationMessage(
      { user: userAlice, date: formattedCurrentDate },
    );
    console.log("Output:", generateReportAgainResult);
    assertEquals(
      (generateReportAgainResult as { message: string }).message,
      "",
      "Second call on same day should return empty message for daily report",
    );
  } finally {
    await client.close();
  }
});

Deno.test("2. Error Handling and Basic Action edge cases", async () => {
  const [db, client] = await testDb();
  const concept:AccountabilityConcept = new AccountabilityConcept(db);
  try{
    // Helper to retrieve partnership for verification
    const getPartnership = async (user: ID, partner: ID) =>
      await concept.partnerships.findOne({ user, partner });
    // Helper to retrieve failures for verification
    const getFailures = async (failingUser: ID, startDate: Date, endDate: Date) =>
      await concept.adherenceFailures
        .find({ failingUser, date: { $gte: startDate, $lte: endDate } })
        .toArray();
    console.log("\n--- Error Handling and Basic Action Edge Cases ---");
    const todayStr = formatDate(BASE_DATE);

    // Test addPartner requirements
    console.log(`Action: addPartner(${userAlice}, ${userAlice}) - self partner`);
    let result = await concept.addPartner({ user: userAlice, partner: userAlice });
    console.log("Output:", result);
    assertEquals((result as { error: string }).error, "User cannot partner with themselves.", "Should prevent self-partnering");

    console.log(`Action: addPartner(${userAlice}, ${userCharlie}) - success`);
    result = await concept.addPartner({ user: userAlice, partner: userCharlie });
    console.log("Output:", result);
    assertEquals(result, {}, "addPartner should succeed for new pair");

    console.log(`Action: addPartner(${userAlice}, ${userCharlie}) - duplicate`);
    result = await concept.addPartner({ user: userAlice, partner: userCharlie });
    console.log("Output:", result);
    assertEquals((result as { error: string }).error, "Partnership already exists.", "Should prevent duplicate partnership");

    // Test removePartner requirements
    console.log(`Action: removePartner(${userAlice}, ${userDavid}) - non-existent`);
    let removeResult = await concept.removePartner({ user: userAlice, partner: userDavid });
    console.log("Output:", removeResult);
    assertEquals((removeResult as { error: string }).error, "Partnership does not exist.", "Should error for non-existent partnership");

    console.log(`Action: removePartner(${userAlice}, ${userCharlie}) - success`);
    removeResult = await concept.removePartner({ user: userAlice, partner: userCharlie });
    console.log("Output:", removeResult);
    assertEquals(removeResult, {}, "removePartner should succeed");

    // Test recordFailure requirements
    console.log(`Action: recordFailure(${userDavid}, "invalid-date", BEDTIME)`);
    let recordFailureResult = await concept.recordFailure({ user: userDavid, date: "invalid-date", failureType: SleepEventType.BEDTIME });
    console.log("Output:", recordFailureResult);
    assertEquals((recordFailureResult as { error: string }).error, "Invalid date string provided.", "Should error for invalid date");

    console.log(`Action: recordFailure(${userDavid}, ${todayStr}, BEDTIME) - success`);
    recordFailureResult = await concept.recordFailure({ user: userDavid, date: todayStr, failureType: SleepEventType.BEDTIME });
    console.log("Output:", recordFailureResult);
    assertEquals(recordFailureResult, {}, "recordFailure should succeed");

    console.log(`Action: recordFailure(${userDavid}, ${todayStr}, BEDTIME) - duplicate`);
    recordFailureResult = await concept.recordFailure({ user: userDavid, date: todayStr, failureType: SleepEventType.BEDTIME });
    console.log("Output:", recordFailureResult);
    assertEquals((recordFailureResult as { error: string }).error, "Failure already recorded for this user, date, and type.", "Should prevent duplicate failure");

    // Test generateNotificationMessage requirements
    console.log(`Action: generateNotificationMessage(${userDavid}, ${todayStr}) - no partnerships`);
    let genNotifresult = await concept.generateNotificationMessage({ user: userDavid, date: todayStr });
    console.log("Output:", genNotifresult);
    assertEquals((genNotifresult as { error: string }).error, "User has no recorded partnerships.", "Should error if user has no partnerships");

    console.log(`Action: generateNotificationMessage(${userAlice}, "invalid-date")`);
    genNotifresult = await concept.generateNotificationMessage({ user: userAlice, date: "invalid-date" });
    console.log("Output:", genNotifresult);
    assertEquals((genNotifresult as { error: string }).error, "Invalid date string provided for current date.", "Should error for invalid date");
  } finally {
    await client.close();
  }
});

Deno.test("3. Frequency Transition (Immediate → Daily → Weekly) with reporting", async () => {
  const [db, client] = await testDb();
  const concept:AccountabilityConcept = new AccountabilityConcept(db);
  try{
    // Helper to retrieve partnership for verification
    const getPartnership = async (user: ID, partner: ID) =>
      await concept.partnerships.findOne({ user, partner });
    // Helper to retrieve failures for verification
    const getFailures = async (failingUser: ID, startDate: Date, endDate: Date) =>
      await concept.adherenceFailures
        .find({ failingUser, date: { $gte: startDate, $lte: endDate } })
        .toArray();
    console.log("\n--- Frequency Transition Test ---");
    let currentDay = BASE_DATE; // Start fresh for this scenario

    // Day 0: Add partner, set IMMEDIATE
    console.log(
      `\n--- Day 0: ${formatDate(currentDay)} - Immediate Report ---`,
    );
    await concept.addPartner({ user: userAlice, partner: userCharlie });
    await concept.updatePreferences({
      user: userAlice,
      partner: userCharlie,
      notifyTypes: [SleepEventType.BEDTIME],
      reportFrequency: FrequencyType.IMMEDIATE,
    });
    await concept.recordFailure({
      user: userAlice,
      date: formatDate(currentDay),
      failureType: SleepEventType.BEDTIME,
    });

    console.log(`Action: generateNotificationMessage(${userAlice}, ${formatDate(currentDay)})`);
    let reportResult = await concept.generateNotificationMessage({
      user: userAlice,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { message: string }).message.includes("Immediate Alert"),
      true,
      "Day 0: Immediate report expected",
    );
    let failuresDay0 = await getFailures(userAlice, currentDay, currentDay);
    assertEquals(failuresDay0[0].reported, true, "Day 0 failure should be reported");
    let partnership = await getPartnership(userAlice, userCharlie);
    assertEquals(
      formatDate(partnership?.lastReportDate!),
      formatDate(currentDay),
      "Day 0 lastReportDate updated",
    );

    // Day 0 (again): No repeat for Immediate
    console.log(
      `Action: generateNotificationMessage(${userAlice}, ${formatDate(currentDay)}) (again)`,
    );
    reportResult = await concept.generateNotificationMessage({
      user: userAlice,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { message: string }).message,
      "",
      "Day 0: No repeat immediate report",
    );

    // Day 1: Update to DAILY, record failure
    currentDay = addDays(currentDay, 1);
    console.log(
      `\n--- Day 1: ${formatDate(currentDay)} - Daily Transition ---`,
    );
    await concept.updatePreferences({
      user: userAlice,
      partner: userCharlie,
      notifyTypes: [SleepEventType.BEDTIME],
      reportFrequency: FrequencyType.DAILY,
    });
    await concept.recordFailure({
      user: userAlice,
      date: formatDate(currentDay),
      failureType: SleepEventType.BEDTIME,
    }); // Failure on Day 1

    // Report on Day 1 (should be empty as daily reports yesterday)
    console.log(`Action: generateNotificationMessage(${userAlice}, ${formatDate(currentDay)})`);
    reportResult = await concept.generateNotificationMessage({
      user: userAlice,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { message: string }).message,
      "",
      "Day 1: No daily report expected (reports previous day)",
    );

    // Day 2: Daily report for Day 1's failure
    currentDay = addDays(currentDay, 1);
    console.log(
      `\n--- Day 2: ${formatDate(currentDay)} - Daily Report for Day 1 ---`,
    );
    console.log(`Action: generateNotificationMessage(${userAlice}, ${formatDate(currentDay)})`);
    reportResult = await concept.generateNotificationMessage({
      user: userAlice,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { message: string }).message.includes("Daily Report"),
      true,
      "Day 2: Daily report expected for Day 1 failure",
    );
    assertEquals(
      (reportResult as { message: string }).message.includes(
        `Date: ${formatDate(addDays(currentDay, -1))}`,
      ),
      true,
      "Report should include Day 1 failure",
    );
    let failuresDay1 = await getFailures(
      userAlice,
      addDays(currentDay, -1),
      addDays(currentDay, -1),
    );
    assertEquals(failuresDay1[0].reported, true, "Day 1 failure should be reported");
    partnership = await getPartnership(userAlice, userCharlie);
    assertEquals(
      formatDate(partnership?.lastReportDate!),
      formatDate(currentDay),
      "Day 2 lastReportDate updated",
    );

    // Day 3-8: Record failures for weekly testing, fast forward
    console.log("\n--- Days 3-8: Record failures for Weekly Report ---");
    for (let i = 0; i < 6; i++) { // Record failures for Day 3, 4, 5, 6, 7, 8
      currentDay = addDays(currentDay, 1);
      await concept.recordFailure({
        user: userAlice,
        date: formatDate(currentDay),
        failureType: SleepEventType.BEDTIME,
      });
      console.log(`Recorded failure for Alice on ${formatDate(currentDay)}`);
    }
    // Last record was on Day 8 (BASE_DATE + 8 days). Last report was on Day 2.
    // Now, update to WEEKLY
    await concept.updatePreferences({
      user: userAlice,
      partner: userCharlie,
      notifyTypes: [SleepEventType.BEDTIME],
      reportFrequency: FrequencyType.WEEKLY,
    });
    console.log(
      `Partnership updated to Weekly reporting. lastReportDate: ${
        formatDate(partnership?.lastReportDate!)
      }`,
    );

    // Day 9: Call generateNotificationMessage. Should trigger weekly report.
    // (Day 9 - Day 2 = 7 days difference).
    currentDay = addDays(currentDay, 1); // This is Day 9
    console.log(
      `\n--- Day 9: ${formatDate(currentDay)} - Weekly Report Trigger ---`,
    );
    console.log(`Action: generateNotificationMessage(${userAlice}, ${formatDate(currentDay)})`);
    reportResult = await concept.generateNotificationMessage({
      user: userAlice,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { message: string }).message.includes("Weekly Report"),
      true,
      "Day 9: Weekly report expected",
    );

    // Verify failures from Day 3-9 are included and marked reported
    const sevenDaysAgoForDay9 = addDays(currentDay, -7); // Day 2
    const failuresReportedWeekly = await getFailures(
      userAlice,
      sevenDaysAgoForDay9,
      currentDay,
    );
    const unreportedFailures = failuresReportedWeekly.filter((f) => !f.reported);
    assertEquals(unreportedFailures.length, 0, "All failures from Day 3-9 should be reported");

    partnership = await getPartnership(userAlice, userCharlie);
    assertEquals(
      formatDate(partnership?.lastReportDate!),
      formatDate(currentDay),
      "Day 9 lastReportDate updated for weekly",
    );

    // Day 10: No new failures, no new report expected
    currentDay = addDays(currentDay, 1); // This is Day 10
    console.log(
      `\n--- Day 10: ${formatDate(currentDay)} - No new Weekly Report Expected ---`,
    );
    console.log(`Action: generateNotificationMessage(${userAlice}, ${formatDate(currentDay)})`);
    reportResult = await concept.generateNotificationMessage({
      user: userAlice,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { message: string }).message,
      "",
      "Day 10: No new weekly report expected (less than 7 days since last report)",
    );
  } finally {
    await client.close();
  }
});

Deno.test("4. Empty vs. Non-Empty Reporting (reportAllFailuresFromStartToEnd)", async () => {
  const [db, client] = await testDb();
  const concept:AccountabilityConcept = new AccountabilityConcept(db);
  try{
    // Helper to retrieve partnership for verification
    const getPartnership = async (user: ID, partner: ID) =>
      await concept.partnerships.findOne({ user, partner });
    // Helper to retrieve failures for verification
    const getFailures = async (failingUser: ID, startDate: Date, endDate: Date) =>
      await concept.adherenceFailures
        .find({ failingUser, date: { $gte: startDate, $lte: endDate } })
        .toArray();
    console.log("\n--- Empty vs. Non-Empty Reporting Test ---");
    const day1 = addDays(BASE_DATE, 1);
    const day2 = addDays(BASE_DATE, 2);
    const day3 = addDays(BASE_DATE, 3);
    const formattedDay1 = formatDate(day1);
    const formattedDay2 = formatDate(day2);
    const formattedDay3 = formatDate(day3);

    // Action: recordFailure
    console.log(
      `Action: recordFailure(${userBob}, ${formattedDay2}, WAKETIME)`,
    );
    const recordResult = await concept.recordFailure({
      user: userBob,
      date: formattedDay2,
      failureType: SleepEventType.WAKETIME,
    });
    console.log("Output:", recordResult);
    assertEquals(recordResult, {}, "recordFailure should succeed");

    // Scenario 1: No failures in range
    console.log(
      `Action: reportAllFailuresFromStartToEnd(${userBob}, ${formattedDay1}, ${formattedDay1})`,
    );
    let reportResult = await concept.reportAllFailuresFromStartToEnd({
      user: userBob,
      startDate: formattedDay1,
      endDate: formattedDay1,
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { message: string }).message,
      "No adherence failures for this period.",
      "Should report no failures",
    );

    // Scenario 2: Failures in range
    console.log(
      `Action: reportAllFailuresFromStartToEnd(${userBob}, ${formattedDay1}, ${formattedDay3})`,
    );
    reportResult = await concept.reportAllFailuresFromStartToEnd({
      user: userBob,
      startDate: formattedDay1,
      endDate: formattedDay3,
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { message: string }).message.includes(
        `Type: WAKETIME, Date: ${formattedDay2}`,
      ),
      true,
      "Should list WAKETIME failure for Day 2",
    );

    // Verify failures are NOT marked reported by this action
    const failures = await getFailures(userBob, day2, day2);
    assertEquals(
      failures[0].reported,
      false,
      "reportAllFailuresFromStartToEnd should NOT mark failures as reported",
    );

    // Scenario 3: Invalid dates
    console.log(
      `Action: reportAllFailuresFromStartToEnd(${userBob}, "invalid", ${formattedDay1})`,
    );
    reportResult = await concept.reportAllFailuresFromStartToEnd({
      user: userBob,
      startDate: "invalid",
      endDate: formattedDay1,
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { error: string }).error,
      "Invalid start or end date string provided.",
      "Should error for invalid start date",
    );

    console.log(
      `Action: reportAllFailuresFromStartToEnd(${userBob}, ${formattedDay3}, ${formattedDay1}) - start > end`,
    );
    reportResult = await concept.reportAllFailuresFromStartToEnd({
      user: userBob,
      startDate: formattedDay3,
      endDate: formattedDay1,
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { error: string }).error,
      "Start date cannot be after end date.",
      "Should error if start date is after end date",
    );
  } finally {
    await client.close();
  }
});

Deno.test("5. Weekly Reporting Skipping Period", async () => {
  const [db, client] = await testDb();
  const concept:AccountabilityConcept = new AccountabilityConcept(db);
  try{
    // Helper to retrieve partnership for verification
    const getPartnership = async (user: ID, partner: ID) =>
      await concept.partnerships.findOne({ user, partner });
    // Helper to retrieve failures for verification
    const getFailures = async (failingUser: ID, startDate: Date, endDate: Date) =>
      await concept.adherenceFailures
        .find({ failingUser, date: { $gte: startDate, $lte: endDate } })
        .toArray();
    console.log("\n--- Weekly Reporting Skipping Period Test ---");

    let currentDay = BASE_DATE; // Reset for this scenario

    // Setup partnership for Charlie and David, Weekly reports
    console.log(`Action: addPartner(${userCharlie}, ${userDavid})`);
    await concept.addPartner({ user: userCharlie, partner: userDavid });
    console.log(
      `Action: updatePreferences(${userCharlie}, ${userDavid}, [BEDTIME, WAKETIME], WEEKLY)`,
    );
    await concept.updatePreferences({
      user: userCharlie,
      partner: userDavid,
      notifyTypes: [SleepEventType.BEDTIME, SleepEventType.WAKETIME],
      reportFrequency: FrequencyType.WEEKLY,
    });
    let partnership = await getPartnership(userCharlie, userDavid);
    assertEquals(
      partnership?.reportFrequency,
      FrequencyType.WEEKLY,
      "Partnership should be set to Weekly",
    );

    // Record failures for 10 consecutive days (Day 0 to Day 9)
    console.log("\nRecording 10 failures for Charlie (Day 0 - Day 9)...");
    const firstFailureDate = currentDay; // Day 0
    for (let i = 0; i < 10; i++) {
      const date = addDays(firstFailureDate, i);
      await concept.recordFailure({
        user: userCharlie,
        date: formatDate(date),
        failureType: SleepEventType.BEDTIME,
      });
      console.log(`Recorded failure on ${formatDate(date)}`);
    }

    // Day 6: Generate weekly report (should cover Day 0 - Day 6)
    currentDay = addDays(firstFailureDate, 6); // This is Day 6
    console.log(
      `\n--- Day 6: ${formatDate(currentDay)} - First Weekly Report ---`,
    );
    console.log(
      `Action: generateNotificationMessage(${userCharlie}, ${formatDate(currentDay)})`,
    );
    let reportResult = await concept.generateNotificationMessage({
      user: userCharlie,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { message: string }).message.includes("Weekly Report"),
      true,
      "Day 6: Weekly report expected",
    );
    assertEquals(
      (reportResult as { message: string }).message.split("\n").length - 2, // count lines with "- Type:" (subracting first two lines "Weekly Report..." and "Failures:")
      7,
      "Report should list 7 failures (Day 0-6)",
    );

    // Verify failures Day 0-6 are reported
    let failuresFirstWeek = await getFailures(userCharlie, firstFailureDate, currentDay);
    let unreportedFirstWeek = failuresFirstWeek.filter((f) => !f.reported);
    assertEquals(
      unreportedFirstWeek.length,
      0,
      "All failures from Day 0-6 should be reported",
    );
    partnership = await getPartnership(userCharlie, userDavid);
    assertEquals(
      formatDate(partnership?.lastReportDate!),
      formatDate(currentDay),
      "lastReportDate updated to Day 6",
    );

    // Day 9: Generate weekly report again (should cover Day 7 - Day 9, excluding Day 0-6)
    // The previous report was on Day 6. Current Day is Day 9.
    // 9 - 6 = 3 days, which is less than 7 days, so no report should be generated based on the logic.
    // Let's adjust the expectation: The action logic for Weekly is:
    // If 7 or more days have passed since lastReportDate.
    // LastReportDate is Day 6. If we call on Day 9, 3 days have passed, so it should NOT report.
    // Let's advance to Day 13 to ensure a report (9 + 7 = 16. So call on Day 13, it looks for 7 days before Day 13, i.e., Day 6 - Day 12.
    // Failures exist on Day 7, Day 8, Day 9 that are unreported.
    // So, let's call on Day 13.
    const lastReportDay = currentDay; // Day 6
    currentDay = addDays(lastReportDay, 7); // This is Day 13
    console.log(
      `\n--- Day 13: ${formatDate(currentDay)} - Second Weekly Report (Day 7-12 period) ---`,
    );
    console.log(
      `Action: generateNotificationMessage(${userCharlie}, ${formatDate(currentDay)})`,
    );
    reportResult = await concept.generateNotificationMessage({
      user: userCharlie,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { message: string }).message.includes("Weekly Report"),
      true,
      "Day 13: Second Weekly report expected (7 days after Day 6 report)",
    );

    // Failures recorded were Day 0 to Day 9.
    // First report covered Day 0 to Day 6.
    // This report on Day 13 should cover from Day 6 (7 days ago) to Day 13.
    // Unreported failures in this range are Day 7, Day 8, Day 9.
    assertEquals(
      (reportResult as { message: string }).message.split("\n").length - 2, // count lines with "- Type:" (subracting first two lines "Weekly Report..." and "Failures:")
      3,
      "Report should list 3 failures (Day 7-9)",
    );
    assertEquals(
      (reportResult as { message: string }).message.includes(
        `Date: ${formatDate(addDays(firstFailureDate, 7))}`,
      ),
      true,
      "Report includes Day 7 failure",
    );
    assertEquals(
      (reportResult as { message: string }).message.includes(
        `Date: ${formatDate(addDays(firstFailureDate, 8))}`,
      ),
      true,
      "Report includes Day 8 failure",
    );
    assertEquals(
      (reportResult as { message: string }).message.includes(
        `Date: ${formatDate(addDays(firstFailureDate, 9))}`,
      ),
      true,
      "Report includes Day 9 failure",
    );

    // Verify failures Day 7-9 are reported
    let failuresSecondWeek = await getFailures(
      userCharlie,
      addDays(firstFailureDate, 7),
      addDays(firstFailureDate, 9),
    );
    let unreportedSecondWeek = failuresSecondWeek.filter((f) => !f.reported);
    assertEquals(
      unreportedSecondWeek.length,
      0,
      "All failures from Day 7-9 should be reported",
    );
    partnership = await getPartnership(userCharlie, userDavid);
    assertEquals(
      formatDate(partnership?.lastReportDate!),
      formatDate(currentDay),
      "lastReportDate updated to Day 13",
    );

    // Day 14: No new failures, no new report expected
    currentDay = addDays(currentDay, 1); // This is Day 14
    console.log(
      `\n--- Day 14: ${formatDate(currentDay)} - No new Weekly Report Expected ---`,
    );
    console.log(`Action: generateNotificationMessage(${userCharlie}, ${formatDate(currentDay)})`);
    reportResult = await concept.generateNotificationMessage({
      user: userCharlie,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(
      (reportResult as { message: string }).message,
      "",
      "Day 14: No new weekly report expected",
    );
  } finally {
    await client.close();
  }
});
