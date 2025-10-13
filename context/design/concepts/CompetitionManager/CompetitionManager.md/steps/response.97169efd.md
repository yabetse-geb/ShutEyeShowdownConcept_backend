---
timestamp: 'Mon Oct 13 2025 13:17:52 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251013_131752.448b0a66.md]]'
content_id: 97169efd99bc156aa9a7510bb4a9429800bffd700b5e6d2ffc4370d2936ee8ff
---

# response:

Here's a detailed concept for the `CompetitionManager`:

## Concept: CompetitionManager

* **concept**: CompetitionManager

* **purpose**: To manage multiple sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores, while ensuring active competitions do not overlap for the same user.

* **principle**: A user sets up a competition with another user (or multiple users) from a certain start date to an end date. Users' sleep adherences according to their set bedtimes and wake up times are reported. A score is calculated for each user at the end of the competition, and a winner is established.

* **types**:
  * `UserId`: A unique identifier for a user (e.g., String, UUID).
  * `CompetitionId`: A unique identifier for a competition (e.g., String, UUID).
  * `SleepEventType`: An enum with values: `BEDTIME`, `WAKETIME`.
  * `Date`: A standard date object (e.g., `java.util.Date`, `Date` in Swift, or equivalent).

* **state**:
  * `competitions: Set<Competition>`: A collection of all managed competitions.

  * `competitionScores: Set<CompetitionScore>`: A collection of score entries for participants within specific competitions.

  * **Competition**: Represents a single sleep-adherence competition.
    * `id: CompetitionId`
    * `participants: Set<UserId>`: The set of users participating in this competition.
    * `startDate: Date`
    * `endDate: Date`
    * `active: Boolean`: True if the competition is ongoing or pending results, false if concluded.
    * `winner: UserId?`: The `UserId` of the winner, or `null` if there's a tie or the competition is not yet ended.

  * **CompetitionScore**: Stores the cumulative scores for a specific user within a specific competition.
    * `userId: UserId`
    * `competitionId: CompetitionId`
    * `wakeUpScore: Number` (initial value: 0): Cumulative score for successful wake-up adherence.
    * `bedTimeScore: Number` (initial value: 0): Cumulative score for successful bedtime adherence.

* **invariants**:
  * `I1`: For any `Competition c`, all `UserId`s in `c.participants` are distinct. (Implicitly handled by `Set<UserId>`).
  * `I2`: For any `UserId u` and any two distinct `Competition c1` and `c2` in `competitions` where `u` is a participant in both, their time periods `[c1.startDate, c1.endDate]` and `[c2.startDate, c2.endDate]` must not overlap.
  * `I3`: Every `CompetitionScore cs` must correspond to an existing `Competition c` (i.e., `cs.competitionId` matches an `id` in `competitions`) and `UserId u` (i.e., `cs.userId` is a valid `UserId`).
  * `I4`: For any `Competition c` and any `userId` in `c.participants`, there must exist exactly one `CompetitionScore cs` such that `cs.competitionId == c.id` and `cs.userId == userId`. (Ensures all participants have a score entry for their competition).

* **actions**:

  * `startCompetition (participantIds: Set<UserId>, startDateStr: String, endDateStr: String): CompetitionId`
    * **purpose**: Initiates a new competition between the specified users for the given time frame.
    * **requires**:
      * `participantIds` must contain at least two distinct `UserId`s.
      * `startDateStr` and `endDateStr` must be valid date strings that can be parsed into `Date` objects.
      * The parsed `startDate` must be before the parsed `endDate`.
      * For each `userId` in `participantIds`, there must be no *active* competition in `competitions` that overlaps in time with the period `[parsedStartDate, parsedEndDate]`. (This upholds `I2`).
    * **effects**:
      * Parses `startDateStr` and `endDateStr` into `Date` objects: `newStartDate`, `newEndDate`.
      * Creates a new `Competition` `c_new`:
        * `c_new.id = generateUniqueCompetitionId()`
        * `c_new.participants = participantIds`
        * `c_new.startDate = newStartDate`
        * `c_new.endDate = newEndDate`
        * `c_new.active = true`
        * `c_new.winner = null`
      * Adds `c_new` to `competitions`.
      * For each `userId` in `participantIds`:
        * Creates a new `CompetitionScore` `cs_new`:
          * `cs_new.userId = userId`
          * `cs_new.competitionId = c_new.id`
          * `cs_new.wakeUpScore = 0`
          * `cs_new.bedTimeScore = 0`
        * Adds `cs_new` to `competitionScores`.
      * Returns `c_new.id`.

  * `recordStat (userId: UserId, dateStr: String, eventType: SleepEventType, success: Boolean)`
    * **purpose**: Records a sleep adherence event (bedtime or wake-up) for a user on a specific date, updating scores in relevant active competitions.
    * **requires**:
      * `userId` is a valid `UserId`.
      * `dateStr` is a valid date string parseable into a `Date`.
      * `eventType` is either `BEDTIME` or `WAKETIME`.
      * The `userId` must be a participant in at least one *active* `Competition` whose date range includes the parsed `eventDate`.
    * **effects**:
      * Parses `dateStr` into a `Date` object: `eventDate`.
      * Determines `scoreChange`: if `success` is `true`, `scoreChange = 1`; if `success` is `false`, `scoreChange = -1`.
      * Finds all `Competition` `c` in `competitions` where:
        * `c.active` is `true`.
        * `userId` is in `c.participants`.
        * `c.startDate <= eventDate <= c.endDate`.
      * For each such `competition c`:
        * Retrieves the `CompetitionScore cs` for `userId` and `c.id` from `competitionScores`. (Guaranteed to exist by `I4`).
        * If `eventType` is `BEDTIME`: `cs.bedTimeScore += scoreChange`.
        * If `eventType` is `WAKETIME`: `cs.wakeUpScore += scoreChange`.

  * `endCompetition (competitionId: CompetitionId): UserId?`
    * **purpose**: Concludes a competition, determines the winner, and deactivates it.
    * **requires**:
      * `competitionId` refers to an existing `Competition c` in `competitions`.
      * `c.active` is `true`.
      * The current date (or the date this action is triggered) is greater than or equal to `c.endDate`.
    * **effects**:
      * Retrieves `Competition c` using `competitionId`.
      * Initializes `maxTotalScore = -Infinity` and `potentialWinners: Set<UserId> = {}`.
      * For each `userId` in `c.participants`:
        * Retrieves the `CompetitionScore cs` for `userId` and `c.id`.
        * Calculates `totalScore = cs.wakeUpScore + cs.bedTimeScore`.
        * If `totalScore > maxTotalScore`:
          * `maxTotalScore = totalScore`
          * `potentialWinners = {userId}`
        * Else if `totalScore == maxTotalScore`:
          * Adds `userId` to `potentialWinners`.
      * If `potentialWinners.size()` is `1`:
        * Sets `c.winner` to the single `UserId` in `potentialWinners`.
        * Sets `c.active` to `false`.
        * Returns the winning `UserId`.
      * Else (`potentialWinners.size()` is 0 or > 1, meaning no participants or a tie):
        * Sets `c.winner` to `null`.
        * Sets `c.active` to `false`.
        * Returns `null`.
