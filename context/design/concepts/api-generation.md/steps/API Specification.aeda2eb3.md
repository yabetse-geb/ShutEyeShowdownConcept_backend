---
timestamp: 'Tue Oct 21 2025 18:39:42 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_183942.c29716f2.md]]'
content_id: aeda2eb33ef6d4d4b1940a95c399736739f95c6a3351a2190a7363a8a138a5d6
---

# API Specification: CompetitionManager Concept

**Purpose:** manage multiple named sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores.

***

## API Endpoints

### POST /api/CompetitionManager/startCompetition

**Description:** Creates a new named competition for a set of users with a defined start and end date.

**Requirements:**

* `name` must be a non-empty string.
* `participants` must contain at least two distinct user IDs.
* `startDateStr` and `endDateStr` must be valid date strings.
* The start date must be on or before the end date.

**Effects:**

* A new `Competition` is created with the given name, participants, and dates, marked as active.
* A `Score` record is created for each participant, initialized to zero.
* Returns the ID of the newly created competition.

**Request Body:**

```json
{
  "name": "string",
  "participants": ["string"],
  "startDateStr": "string",
  "endDateStr": "string"
}
```

**Success Response Body (Action):**

```json
{
  "competitionId": "string"
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
* The `dateStr` must be a valid date string that falls within the active competition's date range.

**Effects:**

* The user's score is updated (+1 for success, -1 for failure) in every active competition they are part of where the event date falls within the competition's date range.
* The score for either `wakeUpScore` or `bedTimeScore` is adjusted based on the `eventType`.

**Request Body:**

```json
{
  "u": "string",
  "dateStr": "string",
  "eventType": "string",
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

**Description:** Ends an active competition, determines the winner(s), and marks the competition as inactive.

**Requirements:**

* The current date must be on or after the competition's `endDate`.
* The competition must be active.

**Effects:**

* The competition's `active` flag is set to `false`.
* The `winners` field is set to the user(s) with the highest total score.
* If all participants tie, `winners` is set to `null`.
* Returns the set of winning user IDs.

**Request Body:**

```json
{
  "competitionId": "string"
}
```

**Success Response Body (Action):**

```json
{
  "winners": ["string"]
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/CompetitionManager/\_getLeaderboard

**Description:** Retrieves a ranked leaderboard for a specific competition.

**Requirements:**

* `competitionId` must refer to an existing competition.

**Effects:**

* Retrieves all score entries for the competition.
* Calculates the total score for each user.
* Returns a ranked list of all participants in the competition, including their position, user ID, and total score.

**Request Body:**

```json
{
  "competitionId": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "position": "number",
    "userId": "string",
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

**Description:** Removes a user from an active competition and deletes their score.

**Requirements:**

* `competitionId` must refer to an existing, active competition.
* `userId` must be a current member of the competition's participants.

**Effects:**

* The specified user is removed from the competition's `participants` list.
* The user's `Score` record for that competition is deleted.
* If the number of participants drops below two, the competition is deactivated.

**Request Body:**

```json
{
  "competitionId": "string",
  "userId": "string"
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

***

### POST /api/CompetitionManager/\_getCompetitionsForUser

**Description:** Retrieves all competitions that a specific user is a participant in.

**Requirements:**

* A user with the given ID `u` must exist.

**Effects:**

* Returns a list of all `Competition` objects where the user is listed as a participant.

**Request Body:**

```json
{
  "u": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "_id": "string",
    "name": "string",
    "participants": ["string"],
    "startDate": "string",
    "endDate": "string",
    "active": "boolean",
    "winners": ["string"]
  }
]
```

**Error Response Body:**

```json
{
  "error": "string"
}
```
