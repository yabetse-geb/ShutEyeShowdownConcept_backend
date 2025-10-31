import { assertEquals, assert } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import SleepScheduleConcept from "./SleepScheduleConcept.ts";
import SleepSlot from "./SleepScheduleConcept.ts"; // Import SleepSlot as default export

// Helper to normalize dates for comparison, matching how they are stored in the concept.
function normalizeDateString(dateStr: string): Date {
  const date = new Date(dateStr); // Corrected typo: new new Date() -> new Date()
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Type guard for SleepSlot
// function isSleepSlot(
//   obj: SleepSlot | null| { error: string }, // Explicitly include possible return types from _getSleepSlot
// ): obj is SleepSlot {
//   return obj !== null && typeof obj === 'object' && !('error' in obj) && '_id' in obj && 'u' in obj;
// }

function expectSleepSlot(slot: unknown): asserts slot is {
  u: ID;
  date: Date;
  bedTime: Date;
  wakeUpTime: Date;
  bedTimeSuccess: boolean | null;
  wakeUpSuccess: boolean | null;
} {
  if (
    !slot || typeof slot !== "object" || !("u" in slot) || !("date" in slot)
  ) {
    throw new Error(`Expected SleepSlot, got: ${JSON.stringify(slot)}`);
  }
}

// Helper to parse date strings in "YYYY-MM-DD" format
function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

Deno.test("SleepSchedule: Operational Principle (Success Scenario)", async () => {
  console.log("\n--- Starting Test: Operational Principle (Alice, 2023-01-01) ---");
  const [db, client] = await testDb();
  try{
    const sleepSchedule = new SleepScheduleConcept(db);

    const userAlice = "user:Alice" as ID;
    const date1 = "2023-01-01";
    const targetBedtime = "2023-01-01T22:00";
    const targetWakeup = "2023-01-02T07:00";
    const earlyBedtime = "2023-01-01T21:30"; // Success
    const earlyWakeup = "2023-01-02T06:45"; // Success

    // Alice adds a sleep slot with 15 minutes tolerance
    const addSlotResult = await sleepSchedule.addSleepSlot({
      u: userAlice,
      bedTimeStr: targetBedtime,
      wakeTimeStr: targetWakeup,
      dateStr: date1,
      toleranceMins: 15, // 15 minutes tolerance for bedtime and wake time
    });
    console.log(`Action: addSleepSlot (${userAlice}, ${date1}, ${targetBedtime}, ${targetWakeup}) -> ${JSON.stringify(addSlotResult)}`);
    assertEquals(addSlotResult, {}); // Expect Empty object

    // Verify initial state
    const slot1_initial_raw = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date1 });
    console.log(`Query: _getSleepSlot (${userAlice}, ${date1}) -> ${JSON.stringify(slot1_initial_raw)}`);
    // Use type guard to assert that the result is a SleepSlot
    expectSleepSlot(slot1_initial_raw);

    assertEquals(slot1_initial_raw.u, userAlice);
    assertEquals(slot1_initial_raw.date.getTime(), normalizeDateString(date1).getTime());
    assertEquals(formatDateTime(slot1_initial_raw.bedTime), targetBedtime);
    assertEquals(formatDateTime(slot1_initial_raw.wakeUpTime), targetWakeup);
    assertEquals(slot1_initial_raw.bedTimeSuccess, null);
    assertEquals(slot1_initial_raw.wakeUpSuccess, null);

    // Alice reports bedtime early - within tolerance
    // 22:00 target, 21:30 reported = 30 minutes early, but within 15 min tolerance = FAIL
    const reportBedtimeResult = await sleepSchedule.reportBedTime({
      u: userAlice,
      reportedTimeStr: earlyBedtime,
      dateStr: date1,
    });
    console.log(`Action: reportBedtime (${userAlice}, ${date1}, ${earlyBedtime}) -> ${JSON.stringify(reportBedtimeResult)}`);
    assertEquals(reportBedtimeResult, { bedTimeSuccess: false }); // 30 minutes off exceeds 15 minute tolerance

    // Alice reports wake-up early - within tolerance
    // 07:00 target, 06:45 reported = 15 minutes early, exactly within 15 min tolerance = SUCCESS
    const reportWakeupResult = await sleepSchedule.reportWakeUpTime({
      u: userAlice,
      reportedTimeStr: earlyWakeup,
      dateStr: date1,
    });
    console.log(`Action: reportWakeUpTime (${userAlice}, ${date1}, ${earlyWakeup}) -> ${JSON.stringify(reportWakeupResult)}`);
    assertEquals(reportWakeupResult, { wakeUpSuccess: true }); // 15 minutes off is exactly within tolerance

    // Verify final state for the principle
    const slot1_final_raw = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date1 });
    console.log(`Query: _getSleepSlot (${userAlice}, ${date1}) -> ${JSON.stringify(slot1_final_raw)}`);
    // Use type guard again
    expectSleepSlot(slot1_final_raw);


    assertEquals(slot1_final_raw.bedTimeSuccess, false);
    assertEquals(slot1_final_raw.wakeUpSuccess, true);

    console.log("--- Finished Test: Operational Principle ---");
  }finally {
    await client.close();
  }
});

Deno.test("SleepSchedule: Invalid Inputs & Precondition Failures", async () => {
  console.log("\n--- Starting Test: Invalid Inputs & Precondition Failures ---");
  const [db, client] = await testDb();
  const sleepSchedule = new SleepScheduleConcept(db);
  try{
    const userAlice = "user:Alice" as ID;
    const userCharlie = "user:Charlie" as ID;
    const date2 = "2023-01-02";
    const date3 = "2023-01-03";
    const targetBedtime = "2023-01-01T22:00";
    const targetWakeup = "2023-01-02T07:00";
    const earlyBedtime = "2023-01-01T21:30"; // Valid time

    // Test addSleepSlot with invalid date
    const invalidDateResult = await sleepSchedule.addSleepSlot({
      u: userAlice,
      bedTimeStr: targetBedtime,
      wakeTimeStr: targetWakeup,
      dateStr: "not-a-date",
      toleranceMins: 15,
    });
    console.log(`Action: addSleepSlot (invalid date) -> ${JSON.stringify(invalidDateResult)}`);
    assertEquals(invalidDateResult, { error: "Invalid date string provided." });

    // Test addSleepSlot with invalid time format
    const invalidBedtimeFormatResult = await sleepSchedule.addSleepSlot({
      u: userAlice,
      bedTimeStr: "22-00", // Invalid format
      wakeTimeStr: targetWakeup,
      dateStr: date2,
      toleranceMins: 15,
    });
    console.log(`Action: addSleepSlot (invalid bedtime format) -> ${JSON.stringify(invalidBedtimeFormatResult)}`);
    assertEquals(invalidBedtimeFormatResult, { error: "Invalid bedtime string format. Expected YYYY-MM-DDTHH:MM" });

    const invalidWakeupFormatResult = await sleepSchedule.addSleepSlot({
      u: userAlice,
      bedTimeStr: targetBedtime,
      wakeTimeStr: "7AM", // Invalid format
      dateStr: date3, // Using a new date to prevent collision with date2 test setup
      toleranceMins: 15,
    });
    console.log(`Action: addSleepSlot (invalid wakeup format) -> ${JSON.stringify(invalidWakeupFormatResult)}`);
    assertEquals(invalidWakeupFormatResult, { error: "Invalid wake-up time string format. Expected YYYY-MM-DDTHH:MM" });


    // Test addSleepSlot for an already existing slot (duplicate)
    const firstAddResult = await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date2, toleranceMins: 15 }); // Create it first
    console.log(`Action: addSleepSlot (${userAlice}, ${date2}) - first call successful -> ${JSON.stringify(firstAddResult)}`);
    assertEquals(firstAddResult, {});

    const duplicateSlotResult = await sleepSchedule.addSleepSlot({
      u: userAlice,
      bedTimeStr: targetBedtime,
      wakeTimeStr: targetWakeup,
      dateStr: date2,
      toleranceMins: 15,
    });
    console.log(`Action: addSleepSlot (${userAlice}, ${date2}) - duplicate call -> ${JSON.stringify(duplicateSlotResult)}`);
    // Concept replaces existing slot preserving success flags; no error expected
    assertEquals(duplicateSlotResult, {});

    // Test removeSleepSlot for a non-existent slot
    const removeNonExistentResult = await sleepSchedule.removeSleepSlot({ u: userCharlie, dateStr: date3 });
    console.log(`Action: removeSleepSlot (non-existent ${userCharlie}, ${date3}) -> ${JSON.stringify(removeNonExistentResult)}`);
    assertEquals(removeNonExistentResult, { error: `No sleep schedule found for user ${userCharlie} on ${date3} to remove.` });

    // Test reportBedTime for a non-existent slot
    const reportNonExistentBedtime = await sleepSchedule.reportBedTime({
      u: userCharlie,
      reportedTimeStr: earlyBedtime,
      dateStr: date3,
    });
    console.log(`Action: reportBedTime (non-existent ${userCharlie}, ${date3}) -> ${JSON.stringify(reportNonExistentBedtime)}`);
    assertEquals(reportNonExistentBedtime, { error: `No sleep schedule set for user ${userCharlie} on ${date3} to report bedtime.` });

    // Test reportWakeUpTime for a non-existent slot
    const reportNonExistentWakeup = await sleepSchedule.reportWakeUpTime({
      u: userCharlie,
      reportedTimeStr: earlyBedtime, // Using earlyBedtime as a valid time string, not event type
      dateStr: date3,
    });
    console.log(`Action: reportWakeUpTime (non-existent ${userCharlie}, ${date3}) -> ${JSON.stringify(reportNonExistentWakeup)}`);
    assertEquals(reportNonExistentWakeup, { error: `No sleep schedule set for user ${userCharlie} on ${date3} to report wake-up time.` });

    // Test reportBedTime with invalid reported time string for an existing slot
    const addSlotForInvalidReport = await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date3, toleranceMins: 15 });
    assertEquals(addSlotForInvalidReport, {});
    const invalidReportedBedtime = await sleepSchedule.reportBedTime({
      u: userAlice,
      reportedTimeStr: "invalid-time",
      dateStr: date3,
    });
    console.log(`Action: reportBedTime (invalid reported time) -> ${JSON.stringify(invalidReportedBedtime)}`);
    assertEquals(invalidReportedBedtime, { error: "Invalid reported bedtime string format. Expected YYYY-MM-DDTHH:MM" });

    await client.close();
    console.log("--- Finished Test: Invalid Inputs & Precondition Failures ---");
  } finally {
    await client.close();
  }
});

Deno.test("SleepSchedule: Reporting Failures (Missed Targets)", async () => {
  console.log("\n--- Starting Test: Reporting Failures (Bob, 2023-01-02) ---");
  const [db, client] = await testDb();
  const sleepSchedule = new SleepScheduleConcept(db);
  try{
    const userBob = "user:Bob" as ID;
    const date2 = "2023-01-02";
    const targetBedtime = "2023-01-02T22:00";
    const targetWakeup = "2023-01-03T07:00";
    const lateBedtime = "2023-01-02T22:30";  // Failure
    const lateWakeup = "2023-01-03T07:30";  // Failure

    // Bob adds a sleep slot with 5 minutes tolerance
    const addSlotBobResult = await sleepSchedule.addSleepSlot({
      u: userBob,
      bedTimeStr: targetBedtime,
      wakeTimeStr: targetWakeup,
      dateStr: date2,
      toleranceMins: 5, // 5 minutes tolerance for bedtime and wake time
    });
    console.log(`Action: addSleepSlot (${userBob}, ${date2}) -> ${JSON.stringify(addSlotBobResult)}`);
    assertEquals(addSlotBobResult, {});

    // Bob reports bedtime late (missed target)
    // 22:00 target, 22:30 reported = 30 minutes late, exceeds 5 min tolerance
    const reportBedtimeFailResult = await sleepSchedule.reportBedTime({
      u: userBob,
      reportedTimeStr: lateBedtime,
      dateStr: date2,
    });
    console.log(`Action: reportBedtime (${userBob}, ${date2}, ${lateBedtime}) -> ${JSON.stringify(reportBedtimeFailResult)}`);
    assertEquals(reportBedtimeFailResult, { bedTimeSuccess: false });

    // Bob reports wake-up late (missed target)
    // 07:00 target, 07:30 reported = 30 minutes late, exceeds 5 min tolerance
    const reportWakeupFailResult = await sleepSchedule.reportWakeUpTime({
      u: userBob,
      reportedTimeStr: lateWakeup,
      dateStr: date2,
    });
    console.log(`Action: reportWakeUpTime (${userBob}, ${date2}, ${lateWakeup}) -> ${JSON.stringify(reportWakeupFailResult)}`);
    assertEquals(reportWakeupFailResult, { wakeUpSuccess: false });

    // Verify final state for Bob
    const slotBob_final_raw = await sleepSchedule._getSleepSlot({ u: userBob, dateStr: date2 });
    console.log(`Query: _getSleepSlot (${userBob}, ${date2}) -> ${JSON.stringify(slotBob_final_raw)}`);
    // Use type guard
    // assert(isSleepSlot(slotBob_final_raw), `Expected a SleepSlot object, but received: ${JSON.stringify(slotBob_final_raw)}`);
    expectSleepSlot(slotBob_final_raw);


    assertEquals(slotBob_final_raw.bedTimeSuccess, false);
    assertEquals(slotBob_final_raw.wakeUpSuccess, false);

    await client.close();
    console.log("--- Finished Test: Reporting Failures ---");
  } finally {
    await client.close();
  }
});

Deno.test("SleepSchedule: Multiple Users and Dates", async () => {
  console.log("\n--- Starting Test: Multiple Users and Dates ---");
  const [db, client] = await testDb();
  const sleepSchedule = new SleepScheduleConcept(db);
  try{
    const userAlice = "user:Alice" as ID;
    const userBob = "user:Bob" as ID;
    const date3 = "2023-01-03";

    // Alice adds a slot for date3 with 15 minutes tolerance
    const aliceAdd3 = await sleepSchedule.addSleepSlot({
      u: userAlice,
      bedTimeStr: "2023-01-03T23:00",
      wakeTimeStr: "2023-01-04T08:00",
      dateStr: date3,
      toleranceMins: 15, // 15 minutes tolerance
    });
    console.log(`Action: addSleepSlot (${userAlice}, ${date3}) -> ${JSON.stringify(aliceAdd3)}`);
    assertEquals(aliceAdd3, {});

    // Bob adds a slot for date3 with 5 minutes tolerance
    const bobAdd3 = await sleepSchedule.addSleepSlot({
      u: userBob,
      bedTimeStr: "2023-01-03T21:00",
      wakeTimeStr: "2023-01-04T06:00",
      dateStr: date3,
      toleranceMins: 5, // 5 minutes tolerance
    });
    console.log(`Action: addSleepSlot (${userBob}, ${date3}) -> ${JSON.stringify(bobAdd3)}`);
    assertEquals(bobAdd3, {});

    // Alice reports for date3 (success - within 15 min tolerance)
    // 23:00 target, 22:45 reported = 15 minutes early, exactly within 15 min tolerance
    const aliceReportBedtime3 = await sleepSchedule.reportBedTime({
      u: userAlice,
      reportedTimeStr: "2023-01-03T22:45",
      dateStr: date3,
    });
    console.log(`Action: reportBedtime (${userAlice}, ${date3}) -> ${JSON.stringify(aliceReportBedtime3)}`);
    assertEquals(aliceReportBedtime3, { bedTimeSuccess: true });

    // Bob reports for date3 (failure - exceeds 5 min tolerance)
    // 06:00 target, 06:15 reported = 15 minutes late, exceeds 5 min tolerance
    const bobReportWakeup3 = await sleepSchedule.reportWakeUpTime({
      u: userBob,
      reportedTimeStr: "2023-01-04T06:15", // After target 06:00
      dateStr: date3,
    });
    console.log(`Action: reportWakeUpTime (${userBob}, ${date3}) -> ${JSON.stringify(bobReportWakeup3)}`);
    assertEquals(bobReportWakeup3, { wakeUpSuccess: false });

    // Verify Alice's slot for date3
    const aliceSlot3_raw = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date3 });
    console.log(`Query: _getSleepSlot (${userAlice}, ${date3}) -> ${JSON.stringify(aliceSlot3_raw)}`);
    // Use type guard
    expectSleepSlot(aliceSlot3_raw);

    assertEquals(aliceSlot3_raw.bedTimeSuccess, true);
    assertEquals(aliceSlot3_raw.wakeUpSuccess, null); // Not reported yet

    // Verify Bob's slot for date3
    const bobSlot3_raw = await sleepSchedule._getSleepSlot({ u: userBob, dateStr: date3 });
    console.log(`Query: _getSleepSlot (${userBob}, ${date3}) -> ${JSON.stringify(bobSlot3_raw)}`);
    // Use type guard
    expectSleepSlot(bobSlot3_raw);


    assertEquals(bobSlot3_raw.bedTimeSuccess, null); // Not reported yet
    assertEquals(bobSlot3_raw.wakeUpSuccess, false);

    await client.close();
    console.log("--- Finished Test: Multiple Users and Dates ---");
  }finally {
    await client.close();
  }
});

Deno.test("SleepSchedule: Remove Sleep Slot", async () => {
  console.log("\n--- Starting Test: Remove Sleep Slot ---");
  const [db, client] = await testDb();
  const sleepSchedule = new SleepScheduleConcept(db);
  try{
    const userAlice = "user:Alice" as ID;
    const date4 = "2023-01-04";
    const targetBedtime = "2023-01-04T22:00";
    const targetWakeup = "2023-01-05T07:00";

    // Alice adds a slot for date4 with 10 minutes tolerance
    const addSlotResult = await sleepSchedule.addSleepSlot({
      u: userAlice,
      bedTimeStr: targetBedtime,
      wakeTimeStr: targetWakeup,
      dateStr: date4,
      toleranceMins: 10, // 10 minutes tolerance
    });
    console.log(`Action: addSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(addSlotResult)}`);
    assertEquals(addSlotResult, {});

    // Verify it exists
    let slot4_raw = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date4 });
    console.log(`Query: _getSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(slot4_raw)}`);
    // Use type guard
    expectSleepSlot(slot4_raw);


    assertEquals(slot4_raw.u, userAlice);

    // Alice removes the sleep slot for date4
    const removeResult = await sleepSchedule.removeSleepSlot({ u: userAlice, dateStr: date4 });
    console.log(`Action: removeSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(removeResult)}`);
    assertEquals(removeResult, {});

    // Verify it's no longer present
    slot4_raw = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date4 }); // Re-query after deletion
    console.log(`Query: _getSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(slot4_raw)}`);
    assertEquals(slot4_raw, null); // Expect null after removal

    await client.close();
    console.log("--- Finished Test: Remove Sleep Slot ---");
  }
  finally {
    await client.close();
  }
});

Deno.test("SleepSchedule: _getAllSleepSlotsForUser Query", async () => {
  console.log("\n--- Starting Test: _getAllSleepSlotsForUser Query ---");
  const [db, client] = await testDb();
  const sleepSchedule = new SleepScheduleConcept(db);
  try{
    const userAlice = "user:Alice" as ID;
    const userBob = "user:Bob" as ID;
    const userCharlie = "user:Charlie" as ID;

    const date1 = "2023-01-01";
    const date2 = "2023-01-02";
    const date3 = "2023-01-03";
    const date5 = "2023-01-05";

    const targetBedtime = "2023-01-04T22:00";
    const targetWakeup = "2023-01-05T07:00";

    // Setup: Add multiple slots for Alice with 10 minutes tolerance
    await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date1, toleranceMins: 10 });
    await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date2, toleranceMins: 10 });
    await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: "2023-01-03T23:00", wakeTimeStr: "2023-01-04T08:00", dateStr: date3, toleranceMins: 10 });
    await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date5, toleranceMins: 10 });
    console.log(`Setup: Added 4 sleep slots for ${userAlice}`);

    // Setup: Add multiple slots for Bob with 15 minutes tolerance
    await sleepSchedule.addSleepSlot({ u: userBob, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date2, toleranceMins: 15 });
    await sleepSchedule.addSleepSlot({ u: userBob, bedTimeStr: "2023-01-03T21:00", wakeTimeStr: "2023-01-04T06:00", dateStr: date3, toleranceMins: 15 });
    console.log(`Setup: Added 2 sleep slots for ${userBob}`);


    // Get all slots for Alice (should have date1, date2, date3, date5)
    const aliceSlots = await sleepSchedule._getAllSleepSlotsForUser({ u: userAlice });
    console.log(`Query: _getAllSleepSlotsForUser (${userAlice}) -> Found ${aliceSlots.length} slots.`);

    const expectedAliceDates = [date1, date2, date3, date5].map(normalizeDateString);
    const foundAliceDates = aliceSlots.map(slot => slot.date); // aliceSlots is SleepSlot[]

    assertEquals(foundAliceDates.length, expectedAliceDates.length);
    for (const expectedDate of expectedAliceDates) {
      assertEquals(foundAliceDates.some(fd => fd.getTime() === expectedDate.getTime()), true, `Expected date ${expectedDate.toISOString()} not found for Alice.`);
    }
    console.log(`Verified all expected dates for ${userAlice}`);

    // Get all slots for Bob (should have date2, date3)
    const bobSlots = await sleepSchedule._getAllSleepSlotsForUser({ u: userBob });
    console.log(`Query: _getAllSleepSlotsForUser (${userBob}) -> Found ${bobSlots.length} slots.`);
    const expectedBobDates = [date2, date3].map(normalizeDateString);
    const foundBobDates = bobSlots.map(slot => slot.date); // bobSlots is SleepSlot[]

    assertEquals(foundBobDates.length, expectedBobDates.length);
    for (const expectedDate of expectedBobDates) {
      assertEquals(foundBobDates.some(fd => fd.getTime() === expectedDate.getTime()), true, `Expected date ${expectedDate.toISOString()} not found for Bob.`);
    }
    console.log(`Verified all expected dates for ${userBob}`);

    // Get all slots for Charlie (should have none)
    const charlieSlots = await sleepSchedule._getAllSleepSlotsForUser({ u: userCharlie });
    console.log(`Query: _getAllSleepSlotsForUser (${userCharlie}) -> Found ${charlieSlots.length} slots.`);
    assertEquals(charlieSlots.length, 0);

    await client.close();
    console.log("--- Finished Test: _getAllSleepSlotsForUser Query ---");
  }finally {
    await client.close();
  }
});

// import { assertEquals } from "jsr:@std/assert";
// import { testDb } from "@utils/database.ts";
// import { ID } from "@utils/types.ts";
// import SleepScheduleConcept from "./SleepScheduleConcept.ts";

// /**
//  * Helper function to normalize date strings for comparison.
//  */
// function normalizeDateString(dateStr: string): Date {
//   const d = new Date(dateStr);
//   return new Date(d.getFullYear(), d.getMonth(), d.getDate());
// }

// /**
//  * Runtime type assertion helper for narrowing unknown values to SleepSlot.
//  */
// function expectSleepSlot(slot: unknown): asserts slot is {
//   u: ID;
//   date: Date;
//   bedTime: string;
//   wakeUpTime: string;
//   bedTimeSuccess: boolean | null;
//   wakeUpSuccess: boolean | null;
// } {
//   if (
//     !slot || typeof slot !== "object" || !("u" in slot) || !("date" in slot)
//   ) {
//     throw new Error(`Expected SleepSlot, got: ${JSON.stringify(slot)}`);
//   }
// }

// const userAlice = "user:Alice" as ID;
// const userBob = "user:Bob" as ID;
// const userCharlie = "user:Charlie" as ID;

// const date1 = "2023-01-01";
// const date2 = "2023-01-02";
// const date3 = "2023-01-03";
// const date4 = "2023-01-04";
// const date5 = "2023-01-05";

// const targetBedtime = "22:00";
// const targetWakeup = "07:00";

// const earlyBedtime = "21:30"; //success
// const lateBedtime = "22:30"; //failure
// const earlyWakeup = "06:45"; //success
// const lateWakeup = "07:30";  //failure


// Deno.test("Operational Principle (Alice, 2023-01-01)", async () => {
//   const [db, client] = await testDb();
//   const sleepSchedule = new SleepScheduleConcept(db);

//   try {
//     // === Trace: Operational Principle ===
//     const addResult = await sleepSchedule.addSleepSlot({
//       u: userAlice,
//       bedTimeStr: targetBedtime,
//       wakeTimeStr: targetWakeup,
//       dateStr: date1,
//     });
//     assertEquals(addResult, {});

//     //Verify initial state
//     const slot1_initial = await sleepSchedule._getSleepSlot({
//       u: userAlice,
//       dateStr: date1,
//     });

//     expectSleepSlot(slot1_initial);
//     console.log(`Query: _getSleepSlot (${userAlice}, ${date1}) -> ${JSON.stringify(slot1_initial)}`);
//     assertEquals(slot1_initial.u, userAlice);
//     assertEquals(slot1_initial.date.getTime(), normalizeDateString(date1).getTime());
//     assertEquals(slot1_initial.bedTime, targetBedtime);
//     assertEquals(slot1_initial.wakeUpTime, targetWakeup);
//     assertEquals(slot1_initial.bedTimeSuccess, null);
//     assertEquals(slot1_initial.wakeUpSuccess, null);

//     //Alice reports bedtime successfully
//     const reportBedtimeResult = await sleepSchedule.reportBedTime({
//       u: userAlice,
//       reportedTimeStr: earlyBedtime,
//       dateStr: date1,
//     });
//     console.log(`Action: reportBedTime (${userAlice}, ${date1}, ${earlyBedtime}) -> ${JSON.stringify(reportBedtimeResult)}`);
//     assertEquals(reportBedtimeResult, { bedTimeSuccess: true });

//     //Alice reports wake-up time successfully
//     const reportWakeupResult = await sleepSchedule.reportWakeUpTime({
//       u: userAlice,
//       reportedTimeStr: earlyWakeup,
//       dateStr: date1,
//     });
//     console.log(`Action: reportWakeUpTime (${userAlice}, ${date1}, ${earlyWakeup}) -> ${JSON.stringify(reportWakeupResult)}`);
//     assertEquals(reportWakeupResult, { wakeUpSuccess: true });

//     // Verify final state for the principle
//     const slot1_final = await sleepSchedule._getSleepSlot({
//       u: userAlice,
//       dateStr: date1,
//     });
//     expectSleepSlot(slot1_final);
//     assertEquals(slot1_final.bedTimeSuccess, true);
//     assertEquals(slot1_final.wakeUpSuccess, true);
//   } finally{
//     await client.close();
//   }
// });

// //   // === Invalid Inputs & Preconditions ===
// // Deno.test("Invalid Inputs & Precondition Failures", async () => {
// //   const [db, client] = await testDb();
// //   const sleepSchedule = new SleepScheduleConcept(db);

// //   const userAlice = "user:Alice" as ID;
// //   const userCharlie = "user:Charlie" as ID;
// //   const date2 = "2023-01-02";
// //   const date3 = "2023-01-03";
// //   const targetBedtime = "22:00";
// //   const targetWakeup = "07:00";
// //   const earlyBedtime = "21:30";
// //   const earlyWakeup = "06:45";

// //     console.log("\n--- Interesting Scenario: Invalid Inputs & Precondition Failures ---");
// //     const badDate = await sleepSchedule.addSleepSlot({
// //       u: userAlice,
// //       bedTimeStr: targetBedtime,
// //       wakeTimeStr: targetWakeup,
// //       dateStr: "not-a-date",
// //     });
// //     console.log(`Action: addSleepSlot (invalid date) -> ${JSON.stringify(badDate)}`);
// //     assertEquals(badDate, { error: "Invalid date string provided." });

// //     // Test addSleepSlot with invalid time format
// //     const badTime = await sleepSchedule.addSleepSlot({
// //       u: userAlice,
// //       bedTimeStr: "22-00",
// //       wakeTimeStr: targetWakeup,
// //       dateStr: date2,
// //     });

// //     console.log(`Action: addSleepSlot (invalid time) -> ${JSON.stringify(badTime)}`);
// //     assertEquals(badTime, { error: "Invalid bedtime string format. Expected HH:MM." });

// //     // Test addSleepSlot for an already existing slot (duplicate)
// //     await sleepSchedule.addSleepSlot({
// //       u: userAlice,
// //       bedTimeStr: targetBedtime,
// //       wakeTimeStr: targetWakeup,
// //       dateStr: date2,
// //     });
// //     console.log(`Action: addSleepSlot (${userAlice}, ${date2}) - first call successful.`);

// //     const duplicateSlot = await sleepSchedule.addSleepSlot({
// //       u: userAlice,
// //       bedTimeStr: targetBedtime,
// //       wakeTimeStr: targetWakeup,
// //       dateStr: date2,
// //     });
// //     console.log(`Action: addSleepSlot (${userAlice}, ${date2}) - duplicate call -> ${JSON.stringify(duplicateSlot)}`);
// //     assertEquals(duplicateSlot, { error: `Sleep schedule already exists for user ${userAlice} on ${date2}.` });


// //     // Test removeSleepSlot for a non-existent slot
// //     const removeNonexistent = await sleepSchedule.removeSleepSlot({
// //       u: userCharlie,
// //       dateStr: date3,
// //     });
// //     console.log(`Action: removeSleepSlot (non-existent ${userCharlie}, ${date3}) -> ${JSON.stringify(removeNonexistent)}`);
// //     assertEquals(removeNonexistent, { error: `No sleep schedule found for user ${userCharlie} on ${date3} to remove.` });


// //     // Test reportBedTime for a non-existent slot
// //     const reportNonExistentBedtime = await sleepSchedule.reportBedTime({
// //       u: userCharlie,
// //       reportedTimeStr: earlyBedtime,
// //       dateStr: date3,
// //     });
// //     console.log(`Action: reportBedTime (non-existent ${userCharlie}, ${date3}) -> ${JSON.stringify(reportNonExistentBedtime)}`);
// //     assertEquals(reportNonExistentBedtime, { error: `No sleep schedule set for user ${userCharlie} on ${date3} to report bedtime.` });


// //     // Test reportWakeUpTime for a non-existent slot
// //     const reportNonExistentWakeup = await sleepSchedule.reportWakeUpTime({
// //       u: userCharlie,
// //       reportedTimeStr: earlyWakeup,
// //       dateStr: date3,
// //     });
// //     console.log(`Action: reportWakeUpTime (non-existent ${userCharlie}, ${date3}) -> ${JSON.stringify(reportNonExistentWakeup)}`);
// //     assertEquals(reportNonExistentWakeup, { error: `No sleep schedule set for user ${userCharlie} on ${date3} to report wake-up time.` });


// //     // Test reportBedTime with invalid reported time string for an existing slot
// //     await sleepSchedule.addSleepSlot({
// //       u: userAlice,
// //       bedTimeStr: targetBedtime,
// //       wakeTimeStr: targetWakeup,
// //       dateStr: date3,
// //     });
// //     const invalidReportedBedtime = await sleepSchedule.reportBedTime({
// //       u: userAlice,
// //       reportedTimeStr: "bad",
// //       dateStr: date3,
// //     });
// //       console.log(`Action: reportBedTime (invalid reported time) -> ${JSON.stringify(invalidReportedBedtime)}`);
// //     assertEquals(invalidReportedBedtime, { error: "Invalid reported bedtime string format. Expected HH:MM." });

// //     await client.close()
// //   });

// //   // === Missed Targets ===
// //     await test.step("Interesting Scenario: Reporting Failures (Missed Targets)", async () => {
// //     console.log("\n--- Interesting Scenario: Reporting Failures (Bob, 2023-01-02) ---");

// //     // Bob adds a sleep slot
// //     const addSlotBobResult = await sleepSchedule.addSleepSlot({
// //       u: userBob,
// //       bedTimeStr: targetBedtime,
// //       wakeTimeStr: targetWakeup,
// //       dateStr: date2,
// //     });
// //     console.log(`Action: addSleepSlot (${userBob}, ${date2}) -> ${JSON.stringify(addSlotBobResult)}`);
// //     assertEquals(addSlotBobResult, {});

// //     // Bob reports bedtime late (missed target)
// //     const reportBedtimeFailResult = await sleepSchedule.reportBedTime({
// //       u: userBob,
// //       reportedTimeStr: lateBedtime,
// //       dateStr: date2,
// //     });
// //     console.log(`Action: reportBedTime (${userBob}, ${date2}, ${lateBedtime}) -> ${JSON.stringify(reportBedtimeFailResult)}`);
// //     assertEquals(reportBedtimeFailResult, { bedTimeSuccess: false });

// //     // Bob reports wake-up late (missed target)
// //     const reportWakeupFailResult = await sleepSchedule.reportWakeUpTime({
// //       u: userBob,
// //       reportedTimeStr: lateWakeup,
// //       dateStr: date2,
// //     });
// //     console.log(`Action: reportWakeUpTime (${userBob}, ${date2}, ${lateWakeup}) -> ${JSON.stringify(reportWakeupFailResult)}`);
// //     assertEquals(reportWakeupFailResult, { wakeUpSuccess: false });

// //     // Verify final state for Bob
// //     const slotBob_final = await sleepSchedule._getSleepSlot({ u: userBob, dateStr: date2 });
// //     expectSleepSlot(slotBob_final);
// //     console.log(`Query: _getSleepSlot (${userBob}, ${date2}) -> ${JSON.stringify(slotBob_final)}`);
// //     assertEquals(slotBob_final?.bedTimeSuccess, false);
// //     assertEquals(slotBob_final?.wakeUpSuccess, false);
// //   });

// //   await test.step("Interesting Scenario: Multiple Users and Dates", async () => {
// //     console.log("\n--- Interesting Scenario: Multiple Users and Dates ---");

// //     // Alice adds a slot for date3
// //     const aliceAdd3 = await sleepSchedule.addSleepSlot({
// //       u: userAlice,
// //       bedTimeStr: "23:00",
// //       wakeTimeStr: "08:00",
// //       dateStr: date3,
// //     });
// //     console.log(`Action: addSleepSlot (${userAlice}, ${date3}) -> ${JSON.stringify(aliceAdd3)}`);
// //     assertEquals(aliceAdd3, {});

// //     // Bob adds a slot for date3
// //     const bobAdd3 = await sleepSchedule.addSleepSlot({
// //       u: userBob,
// //       bedTimeStr: "21:00",
// //       wakeTimeStr: "06:00",
// //       dateStr: date3,
// //     });
// //     console.log(`Action: addSleepSlot (${userBob}, ${date3}) -> ${JSON.stringify(bobAdd3)}`);
// //     assertEquals(bobAdd3, {});

// //     // Alice reports for date3 (success)
// //     const aliceReportBedtime3 = await sleepSchedule.reportBedTime({
// //       u: userAlice,
// //       reportedTimeStr: "22:45",
// //       dateStr: date3,
// //     });
// //     console.log(`Action: reportBedTime (${userAlice}, ${date3}) -> ${JSON.stringify(aliceReportBedtime3)}`);
// //     assertEquals(aliceReportBedtime3, { bedTimeSuccess: true });

// //     // Bob reports for date3 (failure)
// //     const bobReportWakeup3 = await sleepSchedule.reportWakeUpTime({
// //       u: userBob,
// //       reportedTimeStr: "06:15",
// //       dateStr: date3,
// //     });
// //     console.log(`Action: reportWakeUpTime (${userBob}, ${date3}) -> ${JSON.stringify(bobReportWakeup3)}`);
// //     assertEquals(bobReportWakeup3, { wakeUpSuccess: false });

// //     // Verify Alice's slot for date3
// //     const aliceSlot3 = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date3 });
// //     expectSleepSlot(aliceSlot3);
// //     console.log(`Query: _getSleepSlot (${userAlice}, ${date3}) -> ${JSON.stringify(aliceSlot3)}`);
// //     assertEquals(aliceSlot3?.bedTimeSuccess, true);
// //     assertEquals(aliceSlot3?.wakeUpSuccess, null); // Not reported yet

// //     // Verify Bob's slot for date3
// //     const bobSlot3 = await sleepSchedule._getSleepSlot({ u: userBob, dateStr: date3 });
// //     expectSleepSlot(bobSlot3);
// //     console.log(`Query: _getSleepSlot (${userBob}, ${date3}) -> ${JSON.stringify(bobSlot3)}`);
// //     assertEquals(bobSlot3?.bedTimeSuccess, null); // Not reported yet
// //     assertEquals(bobSlot3?.wakeUpSuccess, false);
// //   });

// //   await test.step("Interesting Scenario: Remove Sleep Slot", async () => {
// //     console.log("\n--- Interesting Scenario: Remove Sleep Slot ---");

// //     // Alice adds a slot for date4
// //     const addSlotResult = await sleepSchedule.addSleepSlot({
// //       u: userAlice,
// //       bedTimeStr: targetBedtime,
// //       wakeTimeStr: targetWakeup,
// //       dateStr: date4,
// //     });
// //     console.log(`Action: addSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(addSlotResult)}`);
// //     assertEquals(addSlotResult, {});

// //     // Verify it exists
// //     let slot4 = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date4 });
// //     expectSleepSlot(slot4);
// //     console.log(`Query: _getSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(slot4)}`);
// //     assertEquals(slot4?.u, userAlice);

// //     // Alice removes the sleep slot for date4
// //     const removeResult = await sleepSchedule.removeSleepSlot({ u: userAlice, dateStr: date4 });
// //     console.log(`Action: removeSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(removeResult)}`);
// //     assertEquals(removeResult, {});

// //     // Verify it's no longer present
// //     slot4 = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date4 });
// //     console.log(`Query: _getSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(slot4)}`);
// //     assertEquals(slot4, null);
// //   });

// //   await test.step("Interesting Scenario: _getAllSleepSlotsForUser Query", async () => {
// //     console.log("\n--- Interesting Scenario: _getAllSleepSlotsForUser Query ---");

// //     // Add a new slot for Alice
// //     await sleepSchedule.addSleepSlot({
// //       u: userAlice,
// //       bedTimeStr: targetBedtime,
// //       wakeTimeStr: targetWakeup,
// //       dateStr: date5,
// //     });
// //     console.log(`Action: addSleepSlot (${userAlice}, ${date5}) successful.`);

// //     // Get all slots for Alice (should have date1, date2, date3, date5)
// //     const aliceSlots = await sleepSchedule._getAllSleepSlotsForUser({ u: userAlice });
// //     console.log(`Query: _getAllSleepSlotsForUser (${userAlice}) -> Found ${aliceSlots.length} slots.`);

// //     const expectedDates = [date1, date2, date3, date5].map(normalizeDateString);
// //     const foundDates = aliceSlots.map(slot => slot.date);

// //     assertEquals(foundDates.length, expectedDates.length);
// //     for (const expectedDate of expectedDates) {
// //       assertEquals(foundDates.some(fd => fd.getTime() === expectedDate.getTime()), true, `Expected date ${expectedDate.toISOString()} not found for Alice.`);
// //     }

// //     // Get all slots for Bob (should have date2, date3)
// //     const bobSlots = await sleepSchedule._getAllSleepSlotsForUser({ u: userBob });
// //     console.log(`Query: _getAllSleepSlotsForUser (${userBob}) -> Found ${bobSlots.length} slots.`);
// //     const expectedBobDates = [date2, date3].map(normalizeDateString);
// //     const foundBobDates = bobSlots.map(slot => slot.date);

// //     assertEquals(foundBobDates.length, expectedBobDates.length);
// //     for (const expectedDate of expectedBobDates) {
// //       assertEquals(foundBobDates.some(fd => fd.getTime() === expectedDate.getTime()), true, `Expected date ${expectedDate.toISOString()} not found for Bob.`);
// //     }

// //     // Get all slots for Charlie (should have none)
// //     const charlieSlots = await sleepSchedule._getAllSleepSlotsForUser({ u: userCharlie });
// //     console.log(`Query: _getAllSleepSlotsForUser (${userCharlie}) -> Found ${charlieSlots.length} slots.`);
// //     assertEquals(charlieSlots.length, 0);
// //   });

// //   await client.close();
