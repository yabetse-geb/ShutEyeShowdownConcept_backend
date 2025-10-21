---
timestamp: 'Mon Oct 20 2025 01:43:55 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_014355.fa9ebe04.md]]'
content_id: c79df36ef832495bbbfe2af130622a9cf94aca070a70f9254f22bbd037a05fee
---

# concept: SleepSchedule

* **concept**: SleepSchedule \[User]
* **purpose**: Let users set bedtime/wake goals, log sleep and wake events, and record daily adherence (did the user follow their targets).
* **principle**: Users set bedtime and wake targets. When the app receives sleep/wake logs, the concept computes whether the user met the bedtime/wake targets for that date and records adherence. Missed-adherence events are tracked for notifications/reports.
* **types**:
  * `Date`: A standard date object, capable of representing a specific calendar day (e.g., `java.time.LocalDate` in Java, `Date` in Swift/JS, or equivalent). Time components are generally ignored for daily performance tracking.
  * `Time`: A standard time object, capable of representing a specific time of day (e.g., `java.time.LocalTime` in Java, `Date` in Swift/JS storing only time, or `HH:MM` string). Date components are ignored.
* **state**:
  * A set of SleepSlots with
    * a `bedTime` of type Date
    * a `wakeUpTime` of type `Date`
    * a `a user` of type `User`
    * a `date` of type `Date`
    * a wakeUpSucccess of type Boolean? (null initially)
    * a bedTimeSuccess of type Boolean? (null initially)
* **actions**:
  * \`addSleepSlot (u: User, bedTimeStr:String , wakeTimeStr: String, dateStr:String):

    * **requires**: 
      * `dateStr`, `bedTimeStr`, and `wakeTimeStr` must be valid strings parseable into `Date` and `Time` objects respectively.
      - There doesn't already exist a `SleepSlot` for `u` on the parsed `date`.
    * **effects**:
      * Parses `dateStr` into a `Date` object: `date`.
      - Parses `bedTimeStr` into a `Time` object: `bedTime`.
      - Parses `wakeTimeStr` into a `Time` object: `wakeUpTime`.
      - Creates a new `SleepSlot` for `u` on `date` with `bedTime` and `wakeUpTime` targets.
      - Initializes `wakeUpSuccess` and `bedTimeSuccess` to `false` for the new `SleepSlot`.

    - `removeSleepSlot (u: User, dateStr: String)`:
    - **requires**:
      * `dateStr` must be a valid date string parseable into a `Date`.
      * There exists a `SleepSlot` with `user u` and the parsed `date`.
    - **effects**:
      * Parses `dateStr` into a `Date` object: `date`.
      * Removes the `SleepSlot` for `u` on `date`.
  - `reportBedTime (u: User, reportedTimeStr: String, dateStr: String): Boolean`:
    * **requires**:
      * `reportedTimeStr` and `dateStr` must be valid strings parseable into `Time` and `Date` objects respectively.
      * A `SleepSlot` with `user u` and the parsed `date` exists.
    * **effects**:
      * Parses `reportedTimeStr` into a `Time` object: `reportedTime`.
      * Parses `dateStr` into a `Date` object: `date`.
      * Sets `bedTimeSuccess = reportedTime < bedTime` for the `SleepSlot` with (`u`, `date`).
      * Returns `bedTimeSuccess`.

  - `reportWakeUpTime (u: User, reportedTimeStr: String, dateStr: String): Boolean`:
    * **requires**:
      * `reportedTimeStr` and `dateStr` must be valid strings parseable into `Time` and `Date` objects respectively.
      * A `SleepSlot` with `user u` and the parsed `date` exists.
    * **effects**:
      * Sets \`wakeUpSuccess = if the reported time passed in is within five minutes of wakeUpTime
      * Returns `wakeUpSuccess`.

Code:
