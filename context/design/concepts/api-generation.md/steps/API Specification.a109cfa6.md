---
timestamp: 'Tue Oct 21 2025 00:40:48 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_004048.f53da4ec.md]]'
content_id: a109cfa657a688c23f2d93df6a7cb3e08eecea45bdbf1fc7b05aef8b2191d7f9
---

# API Specification: CompetitionManager Concept

**Purpose:** Manage multiple sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores.

***

## API Endpoints

### POST /api/CompetitionManager/startCompetition

**Description:** Creates a new competition for a set of users with a defined start and end date.

**Requirements:**

* `participants` must contain at least two distinct user IDs.
* `startDateStr` and `endDateStr` must be valid date strings.
* The start date must be on or before the end date.

**Effects:**

* A new `Competition` is created with the given participants and dates, marked as active.
* A `Score` record is created for each participant, initialized to zero.
* Returns the ID of the newly created competition.

**Request Body:**

```json
{
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
* The `dateStr` must be a valid date string.

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

### POST /api/CompetitionManager/getLeaderboard

**Description:** Retrieves a ranked leaderboard for a specific competition.

**Requirements:**

* `competitionId` must refer to an existing competition.

**Effects:**

* Returns a ranked list of all participants in the competition, including their position, user ID, and total score.

**Request Body:**

```json
{
  "competitionId": "string"
}
```

**Success Response Body (Action):**

```json
{
  "leaderboard": "string"
}
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
