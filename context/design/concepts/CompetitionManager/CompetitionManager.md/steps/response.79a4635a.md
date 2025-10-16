---
timestamp: 'Wed Oct 15 2025 01:14:24 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_011424.b2e15a80.md]]'
content_id: 79a4635a25affa866216d903e4a01ce089d5035e7e5f19f3a87aaa186b351c55
---

# response:

Here's an updated and expanded `CompetitionManager` concept specification, incorporating your requested additions for a leaderboard and participant removal, along with clarifications and consistency improvements based on the concept design principles.

***

## Concept: CompetitionManager

* **concept**: CompetitionManager \[UserId]
* **purpose**: To orchestrate and oversee multiple sleep-adherence competitions among users. It is responsible for tracking daily bedtime and wake-up performance for each participant over a defined period, calculating cumulative scores, and declaring a winner(s). A key functional constraint is ensuring that no user participates in more than one *active* competition during any overlapping time period.
* **principle**: Users initiate competitions with one or more other users, specifying a start and end date. Throughout the competition duration, participants' sleep adherence events (bedtime and wake-up) are recorded. Based on the success or failure of these events, individual scores are accumulated. Upon the competition's conclusion, these scores are tallied, and a winner (or set of tied winners) is determined, with provisions for handling cases where all participants tie. During or after a competition, a ranked leaderboard can be generated, and participants can be removed from active competitions under certain conditions.

***

* **types**:
  * `UserId`: A unique identifier for a user (e.g., String, UUID, or Integer).
  * `CompetitionId`: A unique identifier for a competition (e.g., String, UUID, or Integer).
  * `SleepEventType`: An enumeration representing the type of sleep event.
    * `BEDTIME`: Represents the event of going to bed.
    * `WAKETIME`: Represents the event of waking up.
  * `Date`: A standard date object, capable of representing a specific calendar day (e.g., `java.time.LocalDate` in Java, `Date` in Swift/JS, or equivalent). Time components are generally ignored for daily performance tracking.

***

* **state**:
  The `CompetitionManager` maintains the following collections of data:

  * `competitions: Set<Competition>`: A collection of all defined sleep-adherence competitions.

    * **Competition**: Represents the metadata and status of a single sleep-adherence competition.
      * `id: CompetitionId`: A unique identifier for this competition.
      * `participants: Set<UserId>`: The set of unique users involved in this competition.
      * `startDate: Date`: The inclusive start date of the competition.
      * `endDate: Date`: The inclusive end date of the competition.
      * `active: Boolean`: A flag indicating if the competition is currently ongoing or pending resolution (`true`) or if it has been concluded (`false`).
      * `winners: Set<UserId>?`: The set of `UserId`s of the declared winners. This is `null` if the competition is not yet ended or if all participants achieved the same maximum score (a "total tie"). Otherwise, it contains the `UserId`s of all participants who achieved the highest score.

  * `competitionScores: Set<CompetitionScore>`: A collection of score entries, each representing a participant's cumulative performance within a specific competition.

    * **CompetitionScore**: Represents the current scoring state for a specific user within a specific competition.
      * `userId: UserId`: The identifier of the user whose score is being tracked.
      * `competitionId: CompetitionId`: The identifier of the competition this score pertains to.
      * `wakeUpScore: Number` (initial value: 0): A cumulative integer score reflecting adherence to wake-up times.
      * `bedTimeScore: Number` (initial value: 0): A cumulative integer score reflecting adherence to bedtime.

***

* **invariants**:
  These conditions must always hold true for the system's state, ensuring data integrity and adherence to the concept's principles.

  * `I1 (Distinct Participants)`: For any `Competition c` in `competitions`, all `UserId`s within `c.participants` must be distinct. (This is inherently guaranteed if `participants` is modeled as a `Set`).
  * `I2 (No Overlapping Active Competitions)`: For any `UserId u`, and any two distinct `Competition c1` and `c2` in `competitions` where `u` is a participant in both, if both `c1.active` and `c2.active` are `true`, then their respective time periods `[c1.startDate, c1.endDate]` and `[c2.startDate, c2.endDate]` must not overlap.
  * `I3 (Score Entry Existence)`: Every `CompetitionScore cs` in `competitionScores` must correspond to an existing `Competition c` in `competitions` (i.e., `cs.competitionId == c.id`) and `UserId u` (i.e., `cs.userId` must be one of `c.participants`).
  * `I4 (Complete Score Coverage)`: For any `Competition c` in `competitions` and any `userId` within `c.participants`, there must exist exactly one `CompetitionScore cs` in `competitionScores` such that `cs.competitionId == c.id` and `cs.userId == userId`. (Ensures all participants have a score entry for their specific competition).
  * `I5 (Score Monotonicity)`: `wakeUpScore` and `bedTimeScore` values for any `CompetitionScore` can only change via the `recordStat` action. They must be initialized to 0.

***

* **actions**:

  * `startCompetition (participantIds: Set<UserId>, startDateStr: String, endDateStr: String): CompetitionId`
    * **purpose**: To initiate and register a new sleep-adherence competition between a specified group of users for a defined duration.
    * **requires**:
      * `participantIds` must contain at least two distinct `UserId`s.
      * `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
      * The parsed `startDate` must logically precede or be equal to the parsed `endDate`.
      * For each `userId` in `participantIds`, there must be no *active* competition in `competitions` that overlaps in time with the period `[parsedStartDate, parsedEndDate]`. (This enforces `I2`).
    * **effects**:
      * Parses `startDateStr` and `endDateStr` into `Date` objects: `newStartDate`, `newEndDate`.
      * Generates a unique `CompetitionId` (`newCompetitionId`).
      * Creates a new `Competition` object `c_new`:
        * `c_new.id = newCompetitionId`
        * `c_new.participants = participantIds`
        * `c_new.startDate = newStartDate`
        * `c_new.endDate = newEndDate`
        * `c_new.active = true`
        * `c_new.winners = null` (initial state, no winner yet)
      * Adds `c_new` to the `competitions` set.
      * For each `userId` in `participantIds`:
        * Creates a new `CompetitionScore` object `cs_new`:
          * `cs_new.userId = userId`
          * `cs_new.competitionId = newCompetitionId`
          * `cs_new.wakeUpScore = 0`
          * `cs_new.bedTimeScore = 0`
        * Adds `cs_new` to the `competitionScores` set.
      * Returns `newCompetitionId`.

  * `recordStat (userId: UserId, dateStr: String, eventType: SleepEventType, success: Boolean)`
    * **purpose**: To record a specific sleep adherence event (bedtime or wake-up success/failure) for a user on a given day, updating the relevant scores in all applicable active competitions.
    * **requires**:
      * `userId` is a valid `UserId`.
      * `dateStr` is a valid date string parseable into a `Date`.
      * `eventType` is either `SleepEventType.BEDTIME` or `SleepEventType.WAKETIME`.
      * The `userId` must be a participant in at least one *active* `Competition` whose date range includes the parsed `eventDate`.
    * **effects**:
      * Parses `dateStr` into a `Date` object: `eventDate`.
      * Calculates `scoreChange`: if `success` is `true`, `scoreChange = 1`; if `success` is `false`, `scoreChange = -1`.
      * Identifies all `Competition c` in `competitions` that satisfy the following conditions:
        * `c.active` is `true`.
        * `userId` is a member of `c.participants`.
        * `c.startDate <= eventDate <= c.endDate`.
      * For each identified `competition c`:
        * Retrieves the corresponding `CompetitionScore cs` for `userId` and `c.id` from `competitionScores`. (Guaranteed to exist by `I4`).
        * If `eventType` is `SleepEventType.BEDTIME`:
          * `cs.bedTimeScore += scoreChange`.
        * If `eventType` is `SleepEventType.WAKETIME`:
          * `cs.wakeUpScore += scoreChange`.

  * `endCompetition (competitionId: CompetitionId): Set<UserId>?`
    * **purpose**: To conclude a specified competition, determine its winner(s) based on accumulated scores, and mark it as inactive.
    * **requires**:
      * `competitionId` must refer to an existing `Competition c` in `competitions`.
      * `c.active` must be `true`.
      * The current date (or the system date at which this action is invoked) must be greater than or equal to `c.endDate`.
    * **effects**:
      * Retrieves the `Competition c` identified by `competitionId`.
      * Initializes `maxTotalScore = -Infinity` and `potentialWinners: Set<UserId> = {}`.
      * For each `userId` in `c.participants`:
        * Retrieves the `CompetitionScore cs` for `userId` and `c.id` from `competitionScores`.
        * Calculates `totalScore = cs.wakeUpScore + cs.bedTimeScore`.
        * If `totalScore > maxTotalScore`:
          * `maxTotalScore = totalScore`
          * `potentialWinners = {userId}` (replaces any previous potential winners)
        * Else if `totalScore == maxTotalScore`:
          * Adds `userId` to `potentialWinners`.
      * If `potentialWinners.size() == c.participants.size()` (all participants tied with the same highest score):
        * Sets `c.winners` to `null`.
        * Sets `c.active` to `false`.
        * Returns `null`.
      * Else (`potentialWinners.size()` is 1 or more, but not all participants, indicating a clear winner or a subset of tied winners):
        * Sets `c.winners` to `potentialWinners`.
        * Sets `c.active` to `false`.
        * Returns `potentialWinners`.

  * `getLeaderboard (competitionId: CompetitionId): List<{position: Number, userId: UserId, totalScore: Number}>`
    * **purpose**: To provide a ranked list of participants and their current total scores for a given competition, ordered from highest to lowest score.
    * **requires**:
      * `competitionId` must refer to an existing `Competition c` in `competitions`.
    * **effects**:
      * Retrieves the `Competition c` identified by `competitionId`.
      * Creates a temporary list `leaderboardEntries` of `{userId: UserId, totalScore: Number}`.
      * For each `userId` in `c.participants`:
        * Retrieves the `CompetitionScore cs` for `userId` and `c.id` from `competitionScores`. (Guaranteed to exist by `I4`).
        * Calculates `totalScore = cs.wakeUpScore + cs.bedTimeScore`.
        * Adds `{userId, totalScore}` to `leaderboardEntries`.
      * Sorts `leaderboardEntries` in descending order by `totalScore`.
      * Initializes `rankedLeaderboard: List<{position: Number, userId: UserId, totalScore: Number}>`.
      * Initializes `currentPosition = 1`, `lastScore = null`.
      * Iterates through sorted `leaderboardEntries` with their 0-based index:
        * Let `currentEntry = leaderboardEntries[index]`.
        * If `lastScore` is `null` or `currentEntry.totalScore < lastScore`:
          * `currentPosition = index + 1`.
        * Adds `{position: currentPosition, userId: currentEntry.userId, totalScore: currentEntry.totalScore}` to `rankedLeaderboard`.
        * `lastScore = currentEntry.totalScore`.
      * Returns `rankedLeaderboard`.

  * `removeParticipant (competitionId: CompetitionId, userId: UserId)`
    * **purpose**: To remove a specific user from an active competition and clear their associated scores, ensuring the competition remains viable.
    * **requires**:
      * `competitionId` must refer to an existing `Competition c` in `competitions`.
      * `c.active` must be `true`.
      * `userId` must be a member of `c.participants`.
    * **effects**:
      * Retrieves the `Competition c` identified by `competitionId`.
      * Removes `userId` from `c.participants` and make competition active flag false if less than 2 participants remain after removal
      * Removes the `CompetitionScore cs` where `cs.competitionId == competitionId` and `cs.userId == userId` from `competitionScores`.
