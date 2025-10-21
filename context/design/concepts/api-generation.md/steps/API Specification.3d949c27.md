---
timestamp: 'Mon Oct 20 2025 01:45:01 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_014501.b2fb4428.md]]'
content_id: 3d949c27606034d112d4759446aee096a0405d90f818242235de427276ebd699
---

# API Specification: CompetitionManager Concept

**Purpose:** Manage multiple sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores.

***

## API Endpoints

### POST /api/CompetitionManager/startCompetition

**Description:** Creates a new sleep adherence competition for a set of users.

**Requirements:**

* `participants` must contain at least two distinct user IDs.
* `startDateStr` and `endDateStr` must be valid date strings.
* The start date must be before or the same as the end date.

**Effects:**

* A new `Competition` record is created with the specified participants and dates.
* A new `Score` record is created for each participant in the competition, initialized to zero.
* Returns the ID of the newly created competition.

**Request Body:**

```json
{
  "participants": ["ID"],
  "startDateStr": "string",
  "endDateStr": "string"
}
```

**Success Response Body (Action):**

```json
{
  "competitionId": "ID"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/CompetitionManager/recordStat

**Description:** Records a sleep adherence event (success or failure) for a user, updating their score in all relevant active competitions.

**Requirements:**

* The user `u` must be a participant in at least one active competition.
* The `dateStr` must be a valid date string.

**Effects:**

* For every active competition that the user is a part of and where the event date is within the competition's range:
  * The user's score (`wakeUpScore` or `bedTimeScore`) is incremented by 1 for a success or decremented by 1 for a failure.

**Request Body:**

```json
{
  "u": "ID",
  "dateStr": "string",
  "eventType": "SleepEventType",
  "success": "boolean"
}
```

**Success Response Body (Action):**

```json
{}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/CompetitionManager/endCompetition

**Description:** Ends an active competition, determines the winner(s), and marks it as inactive.

**Requirements:**

* The competition identified by `c` (ID) must be active.
* The current date must be on or after the competition's `endDate`.

**Effects:**

* The competition's `active` flag is set to `false`.
* The total score for each participant is calculated.
* The user(s) with the highest score are determined and stored as the `winners`. If all participants tie, the `winners` field remains null.
* Returns the set of winning user IDs.

**Request Body:**

```json
{
  "c": "ID"
}
```

**Success Response Body (Action):**

```json
{
  "winners": ["ID"]
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/CompetitionManager/getLeaderboard

**Description:** Retrieves a ranked leaderboard of participants for a specific competition.

**Requirements:**

* The `competitionId` must refer to an existing competition.

**Effects:**

* Retrieves all scores for the given competition.
* Calculates the total score for each participant.
* Returns a list of participants ranked by their total score, from highest to lowest. Each entry includes their rank, user ID, and total score.

**Request Body:**

```json
{
  "c": "ID"
}
```

**Success Response Body (Query):**

```json
[
  {
    "position": "number",
    "userId": "ID",
    "totalScore": "number"
  }
]
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/CompetitionManager/removeParticipant

**Description:** Removes a user from an active competition.

**Requirements:**

* The competition must exist and be active.
* The user must be a current participant in the competition.

**Effects:**

* The user is removed from the competition's list of participants.
* The user's score record for that competition is deleted.
* If the number of remaining participants drops below two, the competition is deactivated.

**Request Body:**

```json
{
  "competitionId": "ID",
  "userId": "ID"
}
```

**Success Response Body (Action):**

```json
{}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***
