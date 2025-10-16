---
timestamp: 'Tue Oct 14 2025 23:08:20 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251014_230820.fe432bb9.md]]'
content_id: 9cf66a1efaee014cdcfc3c7e20637a04e9fa27c7c76a6916f1c7fac7a524c7de
---

# response:

```typescript
// file: src/SleepSchedule/SleepScheduleConcept.test.ts

import { assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import SleepScheduleConcept from "./SleepScheduleConcept.ts"; // Adjust path as needed

// Helper to normalize dates for comparison, matching how they are stored in the concept.
// This is necessary because new Date() objects might have different time components if not normalized.
function normalizeDateString(dateStr: string): Date {
  const date = new Date(dateStr); // Use `new Date()` directly, not `new new Date()`
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Common test data (can be defined once if shared across independent tests in the same file)
// For strict isolation, these would be re-declared within each test block.
// Given Deno's test setup, each Deno.test block will get a fresh DB, so re-declaring them locally is robust.

Deno.test("SleepSchedule: Operational Principle (Success Scenario)", async () => {
  console.log("\n--- Starting Test: Operational Principle (Alice, 2023-01-01) ---");
  const [db, client] = await testDb();
  const sleepSchedule = new SleepScheduleConcept(db);

  const userAlice = "user:Alice" as ID;
  const date1 = "2023-01-01";
  const targetBedtime = "22:00";
  const targetWakeup = "07:00";
  const earlyBedtime = "21:30"; // Success
  const earlyWakeup = "06:45"; // Success

  // Alice adds a sleep slot
  const addSlotResult = await sleepSchedule.addSleepSlot({
    u: userAlice,
    bedTimeStr: targetBedtime,
    wakeTimeStr: targetWakeup,
    dateStr: date1,
  });
  console.log(`Action: addSleepSlot (${userAlice}, ${date1}, ${targetBedtime}, ${targetWakeup}) -> ${JSON.stringify(addSlotResult)}`);
  assertEquals(addSlotResult, {});

  // Verify initial state
  const slot1_initial = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date1 });
  console.log(`Query: _getSleepSlot (${userAlice}, ${date1}) -> ${JSON.stringify(slot1_initial)}`);
  assertEquals(slot1_initial?.u, userAlice);
  assertEquals(slot1_initial?.date.getTime(), normalizeDateString(date1).getTime());
  assertEquals(slot1_initial?.bedTime, targetBedtime);
  assertEquals(slot1_initial?.wakeUpTime, targetWakeup);
  assertEquals(slot1_initial?.bedTimeSuccess, null);
  assertEquals(slot1_initial?.wakeUpSuccess, null);

  // Alice reports bedtime successfully
  const reportBedtimeResult = await sleepSchedule.reportBedTime({
    u: userAlice,
    reportedTimeStr: earlyBedtime,
    dateStr: date1,
  });
  console.log(`Action: reportBedTime (${userAlice}, ${date1}, ${earlyBedtime}) -> ${JSON.stringify(reportBedtimeResult)}`);
  assertEquals(reportBedtimeResult, { bedTimeSuccess: true });

  // Alice reports wake-up successfully
  const reportWakeupResult = await sleepSchedule.reportWakeUpTime({
    u: userAlice,
    reportedTimeStr: earlyWakeup,
    dateStr: date1,
  });
  console.log(`Action: reportWakeUpTime (${userAlice}, ${date1}, ${earlyWakeup}) -> ${JSON.stringify(reportWakeupResult)}`);
  assertEquals(reportWakeupResult, { wakeUpSuccess: true });

  // Verify final state for the principle
  const slot1_final = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date1 });
  console.log(`Query: _getSleepSlot (${userAlice}, ${date1}) -> ${JSON.stringify(slot1_final)}`);
  assertEquals(slot1_final?.bedTimeSuccess, true);
  assertEquals(slot1_final?.wakeUpSuccess, true);

  await client.close();
  console.log("--- Finished Test: Operational Principle ---");
});

Deno.test("SleepSchedule: Invalid Inputs & Precondition Failures", async () => {
  console.log("\n--- Starting Test: Invalid Inputs & Precondition Failures ---");
  const [db, client] = await testDb();
  const sleepSchedule = new SleepScheduleConcept(db);

  const userAlice = "user:Alice" as ID;
  const userCharlie = "user:Charlie" as ID;
  const date2 = "2023-01-02";
  const date3 = "2023-01-03";
  const targetBedtime = "22:00";
  const targetWakeup = "07:00";
  const earlyBedtime = "21:30"; // Valid time

  // Test addSleepSlot with invalid date
  const invalidDateResult = await sleepSchedule.addSleepSlot({
    u: userAlice,
    bedTimeStr: targetBedtime,
    wakeTimeStr: targetWakeup,
    dateStr: "not-a-date",
  });
  console.log(`Action: addSleepSlot (invalid date) -> ${JSON.stringify(invalidDateResult)}`);
  assertEquals(invalidDateResult, { error: "Invalid date string provided." });

  // Test addSleepSlot with invalid time format
  const invalidBedtimeFormatResult = await sleepSchedule.addSleepSlot({
    u: userAlice,
    bedTimeStr: "22-00", // Invalid format
    wakeTimeStr: targetWakeup,
    dateStr: date2,
  });
  console.log(`Action: addSleepSlot (invalid bedtime format) -> ${JSON.stringify(invalidBedtimeFormatResult)}`);
  assertEquals(invalidBedtimeFormatResult, { error: "Invalid bedtime string format. Expected HH:MM." });

  const invalidWakeupFormatResult = await sleepSchedule.addSleepSlot({
    u: userAlice,
    bedTimeStr: targetBedtime,
    wakeTimeStr: "7AM", // Invalid format
    dateStr: date2, // Different date to avoid previous error for date2
  });
  console.log(`Action: addSleepSlot (invalid wakeup format) -> ${JSON.stringify(invalidWakeupFormatResult)}`);
  assertEquals(invalidWakeupFormatResult, { error: "Invalid wake-up time string format. Expected HH:MM." });


  // Test addSleepSlot for an already existing slot (duplicate)
  await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date2 }); // Create it first
  console.log(`Action: addSleepSlot (${userAlice}, ${date2}) - first call successful.`);
  const duplicateSlotResult = await sleepSchedule.addSleepSlot({
    u: userAlice,
    bedTimeStr: targetBedtime,
    wakeTimeStr: targetWakeup,
    dateStr: date2,
  });
  console.log(`Action: addSleepSlot (${userAlice}, ${date2}) - duplicate call -> ${JSON.stringify(duplicateSlotResult)}`);
  assertEquals(duplicateSlotResult, { error: `Sleep schedule already exists for user ${userAlice} on ${date2}.` });

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
  await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date3 });
  const invalidReportedBedtime = await sleepSchedule.reportBedTime({
    u: userAlice,
    reportedTimeStr: "invalid-time",
    dateStr: date3,
  });
  console.log(`Action: reportBedTime (invalid reported time) -> ${JSON.stringify(invalidReportedBedtime)}`);
  assertEquals(invalidReportedBedtime, { error: "Invalid reported bedtime string format. Expected HH:MM." });

  await client.close();
  console.log("--- Finished Test: Invalid Inputs & Precondition Failures ---");
});

Deno.test("SleepSchedule: Reporting Failures (Missed Targets)", async () => {
  console.log("\n--- Starting Test: Reporting Failures (Bob, 2023-01-02) ---");
  const [db, client] = await testDb();
  const sleepSchedule = new SleepScheduleConcept(db);

  const userBob = "user:Bob" as ID;
  const date2 = "2023-01-02";
  const targetBedtime = "22:00";
  const targetWakeup = "07:00";
  const lateBedtime = "22:30";  // Failure
  const lateWakeup = "07:30";  // Failure

  // Bob adds a sleep slot
  const addSlotBobResult = await sleepSchedule.addSleepSlot({
    u: userBob,
    bedTimeStr: targetBedtime,
    wakeTimeStr: targetWakeup,
    dateStr: date2,
  });
  console.log(`Action: addSleepSlot (${userBob}, ${date2}) -> ${JSON.stringify(addSlotBobResult)}`);
  assertEquals(addSlotBobResult, {});

  // Bob reports bedtime late (missed target)
  const reportBedtimeFailResult = await sleepSchedule.reportBedTime({
    u: userBob,
    reportedTimeStr: lateBedtime,
    dateStr: date2,
  });
  console.log(`Action: reportBedTime (${userBob}, ${date2}, ${lateBedtime}) -> ${JSON.stringify(reportBedtimeFailResult)}`);
  assertEquals(reportBedtimeFailResult, { bedTimeSuccess: false });

  // Bob reports wake-up late (missed target)
  const reportWakeupFailResult = await sleepSchedule.reportWakeUpTime({
    u: userBob,
    reportedTimeStr: lateWakeup,
    dateStr: date2,
  });
  console.log(`Action: reportWakeUpTime (${userBob}, ${date2}, ${lateWakeup}) -> ${JSON.stringify(reportWakeupFailResult)}`);
  assertEquals(reportWakeupFailResult, { wakeUpSuccess: false });

  // Verify final state for Bob
  const slotBob_final = await sleepSchedule._getSleepSlot({ u: userBob, dateStr: date2 });
  console.log(`Query: _getSleepSlot (${userBob}, ${date2}) -> ${JSON.stringify(slotBob_final)}`);
  assertEquals(slotBob_final?.bedTimeSuccess, false);
  assertEquals(slotBob_final?.wakeUpSuccess, false);

  await client.close();
  console.log("--- Finished Test: Reporting Failures ---");
});

Deno.test("SleepSchedule: Multiple Users and Dates", async () => {
  console.log("\n--- Starting Test: Multiple Users and Dates ---");
  const [db, client] = await testDb();
  const sleepSchedule = new SleepScheduleConcept(db);

  const userAlice = "user:Alice" as ID;
  const userBob = "user:Bob" as ID;
  const date3 = "2023-01-03";

  // Alice adds a slot for date3
  const aliceAdd3 = await sleepSchedule.addSleepSlot({
    u: userAlice,
    bedTimeStr: "23:00",
    wakeTimeStr: "08:00",
    dateStr: date3,
  });
  console.log(`Action: addSleepSlot (${userAlice}, ${date3}) -> ${JSON.stringify(aliceAdd3)}`);
  assertEquals(aliceAdd3, {});

  // Bob adds a slot for date3
  const bobAdd3 = await sleepSchedule.addSleepSlot({
    u: userBob,
    bedTimeStr: "21:00",
    wakeTimeStr: "06:00",
    dateStr: date3,
  });
  console.log(`Action: addSleepSlot (${userBob}, ${date3}) -> ${JSON.stringify(bobAdd3)}`);
  assertEquals(bobAdd3, {});

  // Alice reports for date3 (success)
  const aliceReportBedtime3 = await sleepSchedule.reportBedTime({
    u: userAlice,
    reportedTimeStr: "22:45",
    dateStr: date3,
  });
  console.log(`Action: reportBedTime (${userAlice}, ${date3}) -> ${JSON.stringify(aliceReportBedtime3)}`);
  assertEquals(aliceReportBedtime3, { bedTimeSuccess: true });

  // Bob reports for date3 (failure)
  const bobReportWakeup3 = await sleepSchedule.reportWakeUpTime({
    u: userBob,
    reportedTimeStr: "06:15", // After target 06:00
    dateStr: date3,
  });
  console.log(`Action: reportWakeUpTime (${userBob}, ${date3}) -> ${JSON.stringify(bobReportWakeup3)}`);
  assertEquals(bobReportWakeup3, { wakeUpSuccess: false });

  // Verify Alice's slot for date3
  const aliceSlot3 = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date3 });
  console.log(`Query: _getSleepSlot (${userAlice}, ${date3}) -> ${JSON.stringify(aliceSlot3)}`);
  assertEquals(aliceSlot3?.bedTimeSuccess, true);
  assertEquals(aliceSlot3?.wakeUpSuccess, null); // Not reported yet

  // Verify Bob's slot for date3
  const bobSlot3 = await sleepSchedule._getSleepSlot({ u: userBob, dateStr: date3 });
  console.log(`Query: _getSleepSlot (${userBob}, ${date3}) -> ${JSON.stringify(bobSlot3)}`);
  assertEquals(bobSlot3?.bedTimeSuccess, null); // Not reported yet
  assertEquals(bobSlot3?.wakeUpSuccess, false);

  await client.close();
  console.log("--- Finished Test: Multiple Users and Dates ---");
});

Deno.test("SleepSchedule: Remove Sleep Slot", async () => {
  console.log("\n--- Starting Test: Remove Sleep Slot ---");
  const [db, client] = await testDb();
  const sleepSchedule = new SleepScheduleConcept(db);

  const userAlice = "user:Alice" as ID;
  const date4 = "2023-01-04";
  const targetBedtime = "22:00";
  const targetWakeup = "07:00";

  // Alice adds a slot for date4
  const addSlotResult = await sleepSchedule.addSleepSlot({
    u: userAlice,
    bedTimeStr: targetBedtime,
    wakeTimeStr: targetWakeup,
    dateStr: date4,
  });
  console.log(`Action: addSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(addSlotResult)}`);
  assertEquals(addSlotResult, {});

  // Verify it exists
  let slot4 = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date4 });
  console.log(`Query: _getSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(slot4)}`);
  assertEquals(slot4?.u, userAlice);

  // Alice removes the sleep slot for date4
  const removeResult = await sleepSchedule.removeSleepSlot({ u: userAlice, dateStr: date4 });
  console.log(`Action: removeSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(removeResult)}`);
  assertEquals(removeResult, {});

  // Verify it's no longer present
  slot4 = await sleepSchedule._getSleepSlot({ u: userAlice, dateStr: date4 });
  console.log(`Query: _getSleepSlot (${userAlice}, ${date4}) -> ${JSON.stringify(slot4)}`);
  assertEquals(slot4, null);

  await client.close();
  console.log("--- Finished Test: Remove Sleep Slot ---");
});

Deno.test("SleepSchedule: _getAllSleepSlotsForUser Query", async () => {
  console.log("\n--- Starting Test: _getAllSleepSlotsForUser Query ---");
  const [db, client] = await testDb();
  const sleepSchedule = new SleepScheduleConcept(db);

  const userAlice = "user:Alice" as ID;
  const userBob = "user:Bob" as ID;
  const userCharlie = "user:Charlie" as ID;

  const date1 = "2023-01-01";
  const date2 = "2023-01-02";
  const date3 = "2023-01-03";
  const date5 = "2023-01-05";

  const targetBedtime = "22:00";
  const targetWakeup = "07:00";

  // Setup: Add multiple slots for Alice
  await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date1 });
  await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date2 });
  await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: "23:00", wakeTimeStr: "08:00", dateStr: date3 });
  await sleepSchedule.addSleepSlot({ u: userAlice, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date5 });
  console.log(`Setup: Added 4 sleep slots for ${userAlice}`);

  // Setup: Add multiple slots for Bob
  await sleepSchedule.addSleepSlot({ u: userBob, bedTimeStr: targetBedtime, wakeTimeStr: targetWakeup, dateStr: date2 });
  await sleepSchedule.addSleepSlot({ u: userBob, bedTimeStr: "21:00", wakeTimeStr: "06:00", dateStr: date3 });
  console.log(`Setup: Added 2 sleep slots for ${userBob}`);


  // Get all slots for Alice (should have date1, date2, date3, date5)
  const aliceSlots = await sleepSchedule._getAllSleepSlotsForUser({ u: userAlice });
  console.log(`Query: _getAllSleepSlotsForUser (${userAlice}) -> Found ${aliceSlots.length} slots.`);

  const expectedAliceDates = [date1, date2, date3, date5].map(normalizeDateString);
  const foundAliceDates = aliceSlots.map(slot => slot.date);

  assertEquals(foundAliceDates.length, expectedAliceDates.length);
  for (const expectedDate of expectedAliceDates) {
    assertEquals(foundAliceDates.some(fd => fd.getTime() === expectedDate.getTime()), true, `Expected date ${expectedDate.toISOString()} not found for Alice.`);
  }

  // Get all slots for Bob (should have date2, date3)
  const bobSlots = await sleepSchedule._getAllSleepSlotsForUser({ u: userBob });
  console.log(`Query: _getAllSleepSlotsForUser (${userBob}) -> Found ${bobSlots.length} slots.`);
  const expectedBobDates = [date2, date3].map(normalizeDateString);
  const foundBobDates = bobSlots.map(slot => slot.date);

  assertEquals(foundBobDates.length, expectedBobDates.length);
  for (const expectedDate of expectedBobDates) {
    assertEquals(foundBobDates.some(fd => fd.getTime() === expectedDate.getTime()), true, `Expected date ${expectedDate.toISOString()} not found for Bob.`);
  }

  // Get all slots for Charlie (should have none)
  const charlieSlots = await sleepSchedule._getAllSleepSlotsForUser({ u: userCharlie });
  console.log(`Query: _getAllSleepSlotsForUser (${userCharlie}) -> Found ${charlieSlots.length} slots.`);
  assertEquals(charlieSlots.length, 0);

  await client.close();
  console.log("--- Finished Test: _getAllSleepSlotsForUser Query ---");
});
```
