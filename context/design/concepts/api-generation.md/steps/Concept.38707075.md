---
timestamp: 'Mon Oct 20 2025 01:43:55 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_014355.fa9ebe04.md]]'
content_id: 38707075207abe455690168941a88bfa1e48873cec8270f8feef75759f446f0a
---

# Concept: CompetitionManager

* **concept**: CompetitionManager \[User]
* **purpose**: manage multiple sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores.
* **principle**: Users initiate competitions with one or more other users, specifying a start and end date. Throughout the competition duration, participants' sleep adherence events (bedtime and wake-up) are recorded. Based on the success or failure of these events, individual scores are accumulated. Upon the competition's conclusion, these scores are tallied, and a winner (or set of tied winners) is determined, with provisions for handling cases where all participants tie. During or after a competition, a ranked leaderboard can be generated, and participants can be removed from active competitions under certain conditions.
* types:
  * `SleepEventType`: An enumeration representing the type of sleep event.
    * `BEDTIME`: Represents the event of going to bed.
    * `WAKETIME`: Represents the event of waking up.
  - `Date`: A standard date object, capable of representing a specific calendar day (e.g., `java.time.LocalDate` in Java, `Date` in Swift/JS, or equivalent). Time components are generally ignored for daily performance tracking.
  - `competitionId: CompetitionId`: The identifier of the competition this score pertains to.
* **state**:
  * A set of Competitions with
    * participants: a set of Users
    * a `startDate` of type `Date`
    * a `endDate` of type `Date`
    * an active flag of type Boolean
    * a winners a set of Users? (will be set to null until endCompetition establishes winner or remain null if tie among a subset of participants, otherwise if smaller subset of participants have the max score set it to the set of those winners)
  * a set of Scores with:
    * u: a User
    * competition: a Competition
    * a wakeUpScore Number
    * a bedTimeScore Number
* invariants
  * `I1 (Distinct Participants)`: For any `Competition c` in `competitions`, all `UserId`s within `c.participants` must be distinct. (This is inherently guaranteed if `participants` is modeled as a `Set`).
  * `I2 (Score Entry Existence)`: Every `Score` must correspond to an existing `Competition c` and `User u` (i.e., `cs.userId` must be one of `c.participants`).
  * `I3 (Complete Score Coverage)`: For any `Competition c` in `competitions` and any `User u` within `c.participants`, there must exist exactly one `Score s` in `Scores` such that `s.competitionId == c.id` and `s.u == u`. (Ensures all participants have a score entry for their specific competition).
  * `I4 (Score Monotonicity)`: `wakeUpScore` and `bedTimeScore` values for any `CompetitionScore` can only change via the `recordStat` action. They must be initialized to 0.
* **actions**:

  * \`startCompetition (participants: set of Users, startDateStr:String, endDateStr:String): CompetitionId
    * **requires**: 
      * participants must contain at least two distinct User's
      * `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
      - The parsed `startDate` must logically precede or be equal to the parsed `endDate`.
    * **effects**:
      * Parses `startDateStr` and `endDateStr` into `Date` objects: `startDate`, `endDate`.
      * creates a Competition with participates, startDate, endDate, a true active flag, a null winner. Also, it creates a Score for each User in participants with wakeUpScore and bedTimeScore of zero and it is associated with the created competition.
      * returns the id of the Competition

  * \`recordStat (u: User, dateStr: String, eventType:SleepEvent, success:Boolean)
    * **requires**:
      * u is a part of at least one active Competition
      * `dateStr` is a valid date string parseable into a `Date`.
    * **effects**:
      * Parses `dateStr` into a `Date` object: `eventDate`.
      * Calculates `scoreChange`: if `success` is `true`, `scoreChange = 1`; if `success` is `false`, `scoreChange = -1`.
      * for all the active competitions that u is apart of and where date is in the range of the start and end dates of the competition, and u is a member of
        * update the wakeUpScore+=scoreChange if event is "bedtime" otherwise update the bedTimeScore+=scoreChange

  * \`endCompetition (c:Competition): Set<User>?
    * **requires**: current date is greater than or equal to the endDate of Competition c
      * c.active must be true
    * **effects**: return the User IDs of the users in competition c with the greatest sum of wakeUpScore + bedTimeScore and set this ID to the winner state (if tie among all participants keep winner as null)
      * also change active flag to false for competition c

  * getLeaderboard (c: Competition): List<{position: Number, userId: UserId, totalScore: Number}>\`
    * **requires**:
      * `competitionId` must refer to an existing `Competition c` in `competitions`.
    * **effects**:
      * Retrieves the `Competition c` identified by `competitionId`.
      * returns a ranked leaderboard of users in `Competition c`

  - `removeParticipant (competitionId: CompetitionId, userId: UserId)`
    * **purpose**: To remove a specific user from an active competition and clear their associated scores. If the competition no longer has a viable number of participants, it is deactivated.
    * **requires**:
      * `competitionId` must refer to an existing `Competition c` in `competitions`.
      * `c.active` must be `true`.
      * `userId` must be a member of `c.participants`.
      * `c.participants.size()`
    * **effects**:
      * Retrieves the `Competition c` identified by `competitionId`.
      * Removes `userId` from `c.participants`.
      * Removes the `CompetitionScore cs` where `cs.competitionId == competitionId` and `cs.userId == userId` from `competitionScores`.
      * If `c.participants.size() < 2` (i.e., fewer than two participants remain after removal):
        * Sets `c.active` to `false`.
        * Sets `c.winners` to `null` (as the competition is no longer viable and cannot have meaningful winners).

Code:
