---
timestamp: 'Mon Oct 13 2025 15:33:39 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251013_153339.12fbfca0.md]]'
content_id: 6f641af5b6864266ddc644fb045327f470e2111d5d6ea50a46f05fffbfae3b70
---

# implement: SleepSchedule

Here's the implementation for the `SleepSchedule` concept, addressing the requirements and following the concept design principles.

**Design Choices and Clarifications:**

1. **Date and Time Representation:**
   * `DateString` is used as `string` in "YYYY-MM-DD" format.
   * `TimeString` is used as `string` in "HH:MM" (24-hour) format.
   * For adherence checks (`reportedTimeStr <= bedTimeGoal` and `reportedTimeStr >= wakeUpTimeGoal`), lexicographical string comparison is sufficient and accurate for these fixed formats, avoiding the need to parse into `Date` objects when only time components are relevant. This aligns with the "Time components are generally ignored for daily performance tracking" comment in the `CompetitionManager` types, and simplifies the `SleepSchedule` logic where only time-of-day matters for goals.
2. **`addSleepSlot` Return Type:** The original spec's return type `(survey: Survey)` was ambiguous. Following the pattern of `CompetitionManager`'s `startCompetition` and the guideline that actions creating entities should return their ID, `addSleepSlot` now returns `{ sleepSlotId: ID }` on success.
3. **`wakeUpSuccess` and `bedTimeSuccess` Initialization:** These are initialized to `false` (Boolean) instead of `null` (Boolean?), which is a more practical default for adherence flags that will eventually be `true` or `false`.
4. **Action Return Types for Success/Error:** All actions that have a potential error path (e.g., `SleepSlot` not found, invalid input) return a union type like `Promise<{ someResult: Type } | { error: string }>`. This ensures that successful outcomes return a non-empty dictionary, as required by the "Empty results" rule when an overloaded error version exists.
5. **Queries:** `_getSleepAdherence` and `_getUserSleepSlots` have been added to allow inspection of the concept's state, adhering to the guideline that "straightforward queries of the state do not need to be defined in advance" but "it can be useful... to define queries for particularly significant and non-trivial observations."

***
