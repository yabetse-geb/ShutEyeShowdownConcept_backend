---
timestamp: 'Mon Oct 20 2025 21:57:21 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_215721.707d4765.md]]'
content_id: 016fdb7baf9165bd60c1cf6530f019fa8cf9e1cfb6e9b095b540b081fd52ddd6
---

# response:

Here is the modified `CompetitionManager` concept, updated to include a `name` field for each competition.

* **concept**: CompetitionManager \[User]
* **purpose**: manage multiple named sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores.
* **principle**: Users initiate competitions with a name and one or more other users, specifying a start and end date. Throughout the competition duration, participants' sleep adherence events (bedtime and wake-up) are recorded. Based on the success or failure of these events, individual scores are accumulated. Upon the competition's conclusion, these scores are tallied, and a winner (or set of tied winners) is determined, with provisions for handling cases where all participants tie. During or after a competition, a ranked leaderboard can be generated, and participants can be removed from active competitions under certain conditions.
* **types**:
  * `SleepEventType`: An enumeration representing the type of sleep event.
    * `BEDTIME`: Represents the event of going to bed.
    * `WAKETIME`: Represents the event of waking up.
  * `Date`: A standard date object, capable of representing a specific calendar day (e.g., `java.time.LocalDate` in Java, `Date` in Swift/JS, or equivalent). Time components are generally ignored for daily performance tracking.
  * `competitionId: CompetitionId`: The identifier of the competition this score pertains to.
* **state**:
  * A set of **Competitions** with
    * a **name String**
    * participants: a set of Users
    * a `startDate` of type `Date`
    * a `endDate` of type `Date`
    * an active flag of type Boolean
    * a winners a set of Users? (will be set to null until endCompetition establishes winner or remain null if tie among a subset of participants, otherwise if smaller subset of participants have the max score set it to the set of those winners)
  * a set of **Scores** with:
    * u: a User
    * competition: a Competition
    * a wakeUpScore Number
    * a bedTimeScore Number
* **invariants**
  * `I1 (Distinct Participants)`: For any `Competition c` in `competitions`, all `UserId`s within `c.participants` must be distinct. (This is inherently guaranteed if `participants` is modeled as a `Set`).
  * `I2 (Score Entry Existence)`: Every `Score` must correspond to an existing `Competition c` and `User u` (i.e., `cs.userId` must be one of `c.participants`).
  * `I3 (Complete Score Coverage)`: For any `Competition c` in `competitions` and any `User u` within `c.participants`, there must exist exactly one `Score s` in `Scores` such that `s.competitionId == c.id` and `s.u == u`. (Ensures all participants have a score entry for their specific competition).
  * `I4 (Score Monotonicity)`: `wakeUpScore` and `bedTimeScore` values for any `CompetitionScore` can only change via the `recordStat` action. They must be initialized to 0.
  * `I5 (Competition Name)`: For any `Competition c` in `competitions`, `c.name` must be a non-empty string.
* **actions**:

  * `startCompetition (name: String, participants: set of Users, startDateStr:String, endDateStr:String): CompetitionId`
    * **requires**: 
      * `name` must be a non-empty string.
      * participants must contain at least two distinct User's
      * `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
      * The parsed `startDate` must logically precede or be equal to the parsed `endDate`.
    * **effects**:
      * Parses `startDateStr` and `endDateStr` into `Date` objects: `startDate`, `endDate`.
      * Creates a `Competition` with the provided `name`, `participants`, `startDate`, `endDate`, a true `active` flag, and a null `winner`.
      * For each `User` in `participants`, creates a corresponding `Score` entry with `wakeUpScore` and `bedTimeScore` initialized to zero, associated with the newly created competition.
      * Returns the id of the created `Competition`.

  * `recordStat (u: User, dateStr: String, eventType:SleepEvent, success:Boolean)`
    * **requires**:
      * `u` is a part of at least one active `Competition`.
      * `dateStr` is a valid date string parseable into a `Date`.
    * **effects**:
      * Parses `dateStr` into a `Date` object: `eventDate`.
      * Calculates `scoreChange`: if `success` is `true`, `scoreChange = 1`; if `success` is `false`, `scoreChange = -1`.
      * For each active competition that `u` is a part of and where `eventDate` is within the competition's date range:
        * If `eventType` is `BEDTIME`, updates `bedTimeScore += scoreChange`.
        * If `eventType` is `WAKETIME`, updates `wakeUpScore += scoreChange`.

  * `endCompetition (c:Competition): Set<User>?`
    * **requires**:
      * The current date is on or after the `endDate` of Competition `c`.
      * `c.active` must be `true`.
    * **effects**:
      * Sets `c.active` to `false`.
      * Calculates the total score (`wakeUpScore + bedTimeScore`) for each participant in `c`.
      * Identifies the set of users with the highest total score.
      * If the set of winners includes all participants, `c.winners` remains `null`.
      * Otherwise, sets `c.winners` to the set of users with the highest score.
      * Returns the set of winning `User` IDs, or `null` if it's a tie among all participants.

  * `getLeaderboard (c: Competition): {position:number; userId: User; totalScore: number}[]`
    * **requires**:
      * `competitionId` must refer to an existing `Competition c` in `competitions`.
    * **effects**:
      * Retrieves all `Score` entries for the `Competition c`.
      * Calculates the total score for each user.
      * Returns a list of objects, each containing a user's ID, their total score, and their rank, sorted in descending order of `totalScore`.

  * `removeParticipant (competitionId: CompetitionId, userId: UserId)`
    * **purpose**: To remove a specific user from an active competition and clear their associated scores. If the competition no longer has a viable number of participants, it is deactivated.
    * **requires**:
      * `competitionId` must refer to an existing `Competition c` in `competitions`.
      * `c.active` must be `true`.
      * `userId` must be a member of `c.participants`.
    * **effects**:
      * Retrieves the `Competition c` identified by `competitionId`.
      * Removes `userId` from `c.participants`.
      * Removes the `Score` entry where `cs.competitionId == competitionId` and `cs.userId == userId`.
      * If `c.participants.size() < 2` after removal:
        * Sets `c.active` to `false`.
        * Sets `c.winners` to `null`.
