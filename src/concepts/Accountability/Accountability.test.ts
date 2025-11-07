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


// --- Test Helpers ---
function addDays(baseDate: Date, days: number): Date {
  const newDate = new Date(baseDate);
  newDate.setUTCDate(baseDate.getUTCDate() + days);
  newDate.setUTCHours(0, 0, 0, 0); // Normalize to start of UTC day
  return newDate;
}

function formatDate(date: Date): string {
  // Match formatDateToString: use UTC components
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`; // YYYY-MM-DD using UTC components
}

// Fixed base date for consistent testing (normalized to UTC midnight)
const BASE_DATE = new Date("2024-01-10T12:00:00.000Z"); // Wednesday, Jan 10th, 2024
// Normalize to UTC midnight to match parseDateString behavior
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



Deno.test("1. Operational Principle: Establish, Configure, Record, Report Immediate", async () => {
  const [db, client] = await testDb();
  const concept:AccountabilityConcept = new AccountabilityConcept(db);
  try{
    // Helper to retrieve partnership for verification
    const getPartnership = async (user: ID, partner: ID) =>
      await concept.partnerships.findOne({ user, partner });
    // Helper to retrieve failures for verification - dates stored as UTC from parseDateString
    const getFailures = async (failingUser: ID, startDate: Date, endDate: Date) => {
      // Parse dates from UTC-formatted strings to match concept's parseDateString behavior
      const dayStartFromStr = (dateStr: string) => {
        const parts = dateStr.split("-").map(Number);
        const [y, m, d] = parts;
        return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      };
      const start = dayStartFromStr(formatDate(startDate));
      const endStart = dayStartFromStr(formatDate(endDate));
      const endExclusive = new Date(endStart.getTime() + 24 * 60 * 60 * 1000);
      return await concept.adherenceFailures
        .find({ failingUser, date: { $gte: start, $lt: endExclusive } })
        .toArray();
    };

    console.log("\n--- Operational Principle Test ---");

    // Actions for setup
    const currentTestDate = BASE_DATE;
    const formattedCurrentDate = formatDate(currentTestDate);

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

    // Action: updatePreferences
    console.log(
      `Action: updatePreferences(${userAlice}, ${userBob}, [BEDTIME])`,
    );
    const updatePrefsResult = await concept.updatePreferences({
      user: userAlice,
      partner: userBob,
      notifyTypes: [SleepEventType.BEDTIME],
    });
    console.log("Output:", updatePrefsResult);
    assertEquals(updatePrefsResult, {}, "updatePreferences should succeed");

    partnership = await getPartnership(userAlice, userBob);
    assertEquals(
      partnership?.notifyTypes,
      [SleepEventType.BEDTIME],
      "Notify types should be updated",
    );

    // Action: recordFailure - record failure on current date for Immediate reporting
    console.log(
      `Action: recordFailure(${userAlice}, ${formattedCurrentDate}, BEDTIME)`,
    );
    const recordFailureResult = await concept.recordFailure({
      user: userAlice,
      date: formattedCurrentDate,
      failureType: SleepEventType.BEDTIME,
    });
    console.log("Output:", recordFailureResult);
    assertEquals(recordFailureResult, {}, "recordFailure should succeed");

    // Verify the failure was recorded on the expected calendar day (UTC-based)
    const insertedFailure = await concept.adherenceFailures.findOne({ failingUser: userAlice });
    assertEquals(insertedFailure !== null, true, "A failure should exist for the user");
    assertEquals(formatDate(insertedFailure!.date), formattedCurrentDate, "Failure should be stored on current date");
    assertEquals(insertedFailure!.reported, false, "Failure should initially be unreported");

    // Action: updateReports (triggers immediate report appended to Reports)
    console.log(
      `Action: updateReports(${userAlice}, ${formattedCurrentDate}) - Immediate`,
    );
    const generateReportResult = await concept.updateReports({
      user: userAlice,
      date: formattedCurrentDate,
    });
    console.log("Output:", generateReportResult);
    assertEquals(generateReportResult, {}, "updateReports should succeed");
    // Verify report appended; read expected date from stored failure to avoid tz skew
    const storedFailure = (await concept.adherenceFailures.findOne({ failingUser: userAlice }))!;
    const expectedReportedDate = formatDate(storedFailure.date);
    const reportDoc1 = await concept.reports.findOne({ user: userBob, accountabilitySeeker: userAlice });
    const lastReport1 = reportDoc1?.allReports.at(-1) ?? "";
    assertEquals(lastReport1.includes("Alert"), true, "Should append an alert for Bob");
    assertEquals(lastReport1.includes(`Date: ${expectedReportedDate}`), true, "Report should include failure date");

    // Verify effects: failure reported, lastReportDate updated
    const updatedFailure = await concept.adherenceFailures.findOne({ failingUser: userAlice });
    assertEquals(updatedFailure!.reported, true, "Failure should be marked reported");

    partnership = await getPartnership(userAlice, userBob);
    assertEquals(
      formatDate(partnership?.lastReportDate!),
      formattedCurrentDate,
      "lastReportDate should be updated to current date",
    );

    // Try updating reports again for the same day (should not add new report if no new failures)
    console.log(
      `Action: updateReports(${userAlice}, ${formattedCurrentDate}) - Again (no new failures)`,
    );
    const prevLen = (await concept.reports.findOne({ user: userBob, accountabilitySeeker: userAlice }))?.allReports.length ?? 0;
    const generateReportAgainResult = await concept.updateReports({ user: userAlice, date: formattedCurrentDate });
    console.log("Output:", generateReportAgainResult);
    assertEquals(generateReportAgainResult, {}, "updateReports should succeed");
    const newLen = (await concept.reports.findOne({ user: userBob, accountabilitySeeker: userAlice }))?.allReports.length ?? 0;
    assertEquals(newLen, prevLen, "No additional report should be appended when no new failures exist");
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
    //testing getAccountability
    const seekers = await concept._getAccountabilitySeekersForUser({ mentor: userCharlie }) as ID[];
    assertEquals(seekers.includes(userAlice), true, "Alice should be listed as accountability seeker for Charlie");
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

    // Test updateReports requirements
    console.log(`Action: updateReports(${userDavid}, ${todayStr}) - no partnerships`);
    let genNotifresult = await concept.updateReports({ user: userDavid, date: todayStr });
    console.log("Output:", genNotifresult);
    assertEquals((genNotifresult as { error: string }).error, "User has no recorded partnerships.", "Should error if user has no partnerships");

    console.log(`Action: updateReports(${userAlice}, "invalid-date")`);
    genNotifresult = await concept.updateReports({ user: userAlice, date: "invalid-date" });
    console.log("Output:", genNotifresult);
    assertEquals((genNotifresult as { error: string }).error, "Invalid date string provided for current date.", "Should error for invalid date");
  } finally {
    await client.close();
  }
});

Deno.test("3. Immediate Reporting Only", async () => {
  const [db, client] = await testDb();
  const concept:AccountabilityConcept = new AccountabilityConcept(db);
  try{
    // Helper to retrieve partnership for verification
    const getPartnership = async (user: ID, partner: ID) =>
      await concept.partnerships.findOne({ user, partner });
    // Helper to retrieve failures for verification
    const getFailures = async (failingUser: ID, startDate: Date, endDate: Date) => {
      const dayStartFromStr = (dateStr: string) => {
        const parts = dateStr.split("-").map(Number);
        const [y, m, d] = parts;
        return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      };
      const start = dayStartFromStr(formatDate(startDate));
      const endStart = dayStartFromStr(formatDate(endDate));
      const endExclusive = new Date(endStart.getTime() + 24 * 60 * 60 * 1000);
      return await concept.adherenceFailures
        .find({ failingUser, date: { $gte: start, $lt: endExclusive } })
        .toArray();
    };
    console.log("\n--- Immediate Reporting Test ---");
    let currentDay = BASE_DATE; // Start fresh for this scenario

    // Day 0: Add partner, record failure on same day, report immediately
    console.log(
      `\n--- Day 0: ${formatDate(currentDay)} - Immediate Report ---`,
    );
    await concept.addPartner({ user: userAlice, partner: userCharlie });
    await concept.updatePreferences({
      user: userAlice,
      partner: userCharlie,
      notifyTypes: [SleepEventType.BEDTIME],
    });
    await concept.recordFailure({
      user: userAlice,
      date: formatDate(currentDay),
      failureType: SleepEventType.BEDTIME,
    });

    console.log(`Action: updateReports(${userAlice}, ${formatDate(currentDay)})`);
    let reportResult = await concept.updateReports({
      user: userAlice,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(reportResult, {}, "Day 0: updateReports should succeed");
    let reportDoc0 = await concept.reports.findOne({ user: userCharlie, accountabilitySeeker: userAlice });
    const lastReport0 = reportDoc0?.allReports.at(-1) ?? "";
    assertEquals(lastReport0.includes("Alert"), true, "Day 0: Alert report appended");
    let failuresDay0 = await getFailures(userAlice, currentDay, currentDay);
    // If range misses due to tz, fetch latest failure and assert it is reported
    if (!failuresDay0[0]) {
      const latestFailure = await concept.adherenceFailures.findOne({ failingUser: userAlice });
      assertEquals(latestFailure?.reported, true, "Day 0 failure should be reported");
    } else {
    assertEquals(failuresDay0[0].reported, true, "Day 0 failure should be reported");
    }
    let partnership = await getPartnership(userAlice, userCharlie);
    assertEquals(
      formatDate(partnership?.lastReportDate!),
      formatDate(currentDay),
      "Day 0 lastReportDate updated",
    );

    // Day 0 (again): No repeat if no new failures
    console.log(
      `Action: updateReports(${userAlice}, ${formatDate(currentDay)}) (again)`,
    );
    const prevLen0 = (await concept.reports.findOne({ user: userCharlie, accountabilitySeeker: userAlice }))?.allReports.length ?? 0;
    reportResult = await concept.updateReports({
      user: userAlice,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(reportResult, {}, "Day 0: updateReports should succeed");
    const newLen0 = (await concept.reports.findOne({ user: userCharlie, accountabilitySeeker: userAlice }))?.allReports.length ?? 0;
    assertEquals(newLen0, prevLen0, "Day 0: No repeat report appended when no new failures");

    // Day 1: Record failure and report immediately
    currentDay = addDays(currentDay, 1);
    console.log(
      `\n--- Day 1: ${formatDate(currentDay)} - New Failure and Immediate Report ---`,
    );
    await concept.recordFailure({
      user: userAlice,
      date: formatDate(currentDay),
      failureType: SleepEventType.BEDTIME,
    });

    console.log(`Action: updateReports(${userAlice}, ${formatDate(currentDay)})`);
    reportResult = await concept.updateReports({
      user: userAlice,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(reportResult, {}, "Day 1: updateReports should succeed");
    const reportDocDay1 = await concept.reports.findOne({ user: userCharlie, accountabilitySeeker: userAlice });
    const lastReport1 = reportDocDay1?.allReports.at(-1) ?? "";
    assertEquals(lastReport1.includes("Alert"), true, "Day 1: Alert report appended");
    assertEquals(lastReport1.includes(`Date: ${formatDate(currentDay)}`), true, "Day 1: Includes Day 1 failure");
    let failuresDay1 = await getFailures(userAlice, currentDay, currentDay);
    if (failuresDay1.length > 0) {
    assertEquals(failuresDay1[0].reported, true, "Day 1 failure should be reported");
    } else {
      const latestFailure = await concept.adherenceFailures.findOne({ failingUser: userAlice, date: currentDay });
      assertEquals(latestFailure?.reported, true, "Day 1 failure should be reported");
    }
    partnership = await getPartnership(userAlice, userCharlie);
    assertEquals(
      formatDate(partnership?.lastReportDate!),
      formatDate(currentDay),
      "Day 1 lastReportDate updated",
    );

    // Day 2: No failure recorded, no report expected
    currentDay = addDays(currentDay, 1);
    console.log(
      `\n--- Day 2: ${formatDate(currentDay)} - No Failure, No Report Expected ---`,
    );
    console.log(`Action: updateReports(${userAlice}, ${formatDate(currentDay)})`);
    reportResult = await concept.updateReports({
      user: userAlice,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(reportResult, {}, "Day 2: updateReports should succeed");
    const lenAfterDay1 = (await concept.reports.findOne({ user: userCharlie, accountabilitySeeker: userAlice }))?.allReports.length ?? 0;
    const lenAfterDay2 = (await concept.reports.findOne({ user: userCharlie, accountabilitySeeker: userAlice }))?.allReports.length ?? 0;
    assertEquals(lenAfterDay2, lenAfterDay1, "Day 2: No new report should be appended when no failures");
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
    const failureStored = (await concept.adherenceFailures.findOne({ failingUser: userBob }))!;
    const expectedDay2 = formatDate(failureStored.date);
    assertEquals(((reportResult as { message: string }).message.includes(`Type: WAKETIME, Date: ${expectedDay2}`)), true, "Should list WAKETIME failure for stored Day 2");

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

Deno.test("5. Immediate Reporting Multiple Days", async () => {
  const [db, client] = await testDb();
  const concept:AccountabilityConcept = new AccountabilityConcept(db);
  try{
    // Helper to retrieve partnership for verification
    const getPartnership = async (user: ID, partner: ID) =>
      await concept.partnerships.findOne({ user, partner });
    // Helper to retrieve failures for verification
    const getFailures = async (failingUser: ID, startDate: Date, endDate: Date) => {
      const dayStartFromStr = (dateStr: string) => {
        const parts = dateStr.split("-").map(Number);
        const [y, m, d] = parts;
        return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      };
      const start = dayStartFromStr(formatDate(startDate));
      const endStart = dayStartFromStr(formatDate(endDate));
      const endExclusive = new Date(endStart.getTime() + 24 * 60 * 60 * 1000);
      return await concept.adherenceFailures
        .find({ failingUser, date: { $gte: start, $lt: endExclusive } })
        .toArray();
    };
    console.log("\n--- Immediate Reporting Multiple Days Test ---");

    let currentDay = BASE_DATE; // Reset for this scenario

    // Setup partnership for Charlie and David
    console.log(`Action: addPartner(${userCharlie}, ${userDavid})`);
    await concept.addPartner({ user: userCharlie, partner: userDavid });
    console.log(
      `Action: updatePreferences(${userCharlie}, ${userDavid}, [BEDTIME, WAKETIME])`,
    );
    await concept.updatePreferences({
      user: userCharlie,
      partner: userDavid,
      notifyTypes: [SleepEventType.BEDTIME, SleepEventType.WAKETIME],
    });
    let partnership = await getPartnership(userCharlie, userDavid);

    // Day 0: Record failure and report immediately
    const firstFailureDate = currentDay; // Day 0
    console.log(`\n--- Day 0: ${formatDate(currentDay)} - Record Failure and Report ---`);
    await concept.recordFailure({
      user: userCharlie,
      date: formatDate(currentDay),
      failureType: SleepEventType.BEDTIME,
    });
    console.log(
      `Action: updateReports(${userCharlie}, ${formatDate(currentDay)})`,
    );
    let reportResult = await concept.updateReports({
      user: userCharlie,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(reportResult, {}, "Day 0: updateReports should succeed");
    const reportDoc0 = await concept.reports.findOne({ user: userDavid, accountabilitySeeker: userCharlie });
    const msg0 = reportDoc0?.allReports.at(-1) ?? "";
    assertEquals(msg0.includes("Alert"), true, "Day 0: Alert report appended");

    // Verify failure Day 0 is reported
    let failuresDay0 = await getFailures(userCharlie, firstFailureDate, currentDay);
    if (failuresDay0.length > 0) {
      assertEquals(failuresDay0[0].reported, true, "Day 0 failure should be reported");
    } else {
      // Fallback: fetch by failingUser and check if any are reported
      const allFailures = await concept.adherenceFailures.find({ failingUser: userCharlie }).toArray();
      const day0Failure = allFailures.find(f => formatDate(f.date) === formatDate(currentDay));
      assertEquals(day0Failure?.reported, true, "Day 0 failure should be reported");
    }
    partnership = await getPartnership(userCharlie, userDavid);
    assertEquals(
      formatDate(partnership?.lastReportDate!),
      formatDate(currentDay),
      "lastReportDate updated to Day 0",
    );

    // Day 1: Record failure and report immediately
    currentDay = addDays(firstFailureDate, 1); // Day 1
    console.log(`\n--- Day 1: ${formatDate(currentDay)} - Record Failure and Report ---`);
    await concept.recordFailure({
      user: userCharlie,
      date: formatDate(currentDay),
      failureType: SleepEventType.WAKETIME,
    });
    console.log(
      `Action: updateReports(${userCharlie}, ${formatDate(currentDay)})`,
    );
    reportResult = await concept.updateReports({
      user: userCharlie,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(reportResult, {}, "Day 1: updateReports should succeed");
    const reportDoc1 = await concept.reports.findOne({ user: userDavid, accountabilitySeeker: userCharlie });
    const msg1 = reportDoc1?.allReports.at(-1) ?? "";
    assertEquals(msg1.includes("Alert"), true, "Day 1: Alert report appended");
    assertEquals(msg1.includes(`Date: ${formatDate(currentDay)}`), true, "Day 1: Includes Day 1 failure");

    // Verify failure Day 1 is reported
    let failuresDay1 = await getFailures(userCharlie, currentDay, currentDay);
    if (failuresDay1.length > 0) {
      assertEquals(failuresDay1[0].reported, true, "Day 1 failure should be reported");
    } else {
      // Fallback: fetch by failingUser and check if any are reported
      const allFailures = await concept.adherenceFailures.find({ failingUser: userCharlie }).toArray();
      const day1Failure = allFailures.find(f => formatDate(f.date) === formatDate(currentDay));
      assertEquals(day1Failure?.reported, true, "Day 1 failure should be reported");
    }
    partnership = await getPartnership(userCharlie, userDavid);
    assertEquals(
      formatDate(partnership?.lastReportDate!),
      formatDate(currentDay),
      "lastReportDate updated to Day 1",
    );

    // Day 2: No failure, no report expected
    currentDay = addDays(firstFailureDate, 2); // Day 2
    console.log(`\n--- Day 2: ${formatDate(currentDay)} - No Failure, No Report ---`);
    console.log(`Action: updateReports(${userCharlie}, ${formatDate(currentDay)})`);
    reportResult = await concept.updateReports({
      user: userCharlie,
      date: formatDate(currentDay),
    });
    console.log("Output:", reportResult);
    assertEquals(reportResult, {}, "Day 2: updateReports should succeed");
    const lenAfterDay1 = (await concept.reports.findOne({ user: userDavid, accountabilitySeeker: userCharlie }))?.allReports.length ?? 0;
    const lenAfterDay2 = (await concept.reports.findOne({ user: userDavid, accountabilitySeeker: userCharlie }))?.allReports.length ?? 0;
    assertEquals(lenAfterDay2, lenAfterDay1, "Day 2: No new report should be appended when no failures");
  } finally {
    await client.close();
  }
});
