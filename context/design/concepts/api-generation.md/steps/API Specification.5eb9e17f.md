---
timestamp: 'Tue Nov 04 2025 15:16:31 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251104_151631.7617a424.md]]'
content_id: 5eb9e17f5500124c3994a1ef26e2d77ebf75b5a1d0cfb56a1cae623d5ee8e91a
---

# API Specification: CompetitionManager Concept

**Purpose:** manage multiple named sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores.

***

## API Endpoints

### POST /api/CompetitionManager/startCompetition

**Description:** Creates a new sleep-adherence competition between a set of users.

**Requirements:**

* `name` must be a non-empty string.
* `participants` must contain at least two distinct users.
* `startDateStr` and `endDateStr` must be valid date strings.
* The start date must be before or the same as the end date.

**Effects:**

* Creates a new `Competition` record with the specified details and an active status.
* Initializes a `Score` record for each participant in the new competition with scores set to zero.
* Returns the ID of the newly created competition.

**Request Body:**

```json
{
  "name": "string",
  "participants": "ID[]",
  "startDateStr": "string",
e  "endDateStr": "string"
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

**Description:** Records a user's performance (success or failure) for a sleep event within their active competitions.

**Requirements:**

* The user `u` must be a participant in at least one active competition.
* `dateStr` must be a valid date string.

**Effects:**

* For each active competition the user is in, if the event date is within the competition's range:
  * If `success` is true, the user's score for the `eventType` is incremented by 1.
  * The date is recorded to track reporting adherence.

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

**Description:** Ends an active competition, applies penalties for missed reports, and determines the winner(s).

**Requirements:**

* The competition must be active.
* The current date must be on or after the competition's `endDate`.

**Effects:**

* The competition's `active` flag is set to `false`.
* Penalties are applied to each participant's score for any days they failed to report.
* The user(s) with the highest final score are calculated and stored as the `winners`.
* If all participants tie, the `winners` field is set to null.
* Returns the set of winning user IDs.

**Request Body:**

```json
{
  "competitionId": "ID"
}
```

**Success Response Body (Action):**

```json
{
  "winners": "ID[]"
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

**Description:** Removes a user from an active competition.

**Requirements:**

* The competition must be active.
* The user must be a current participant in the competition.

**Effects:**

* The specified user is removed from the competition's list of participants.
* The user's score record for that competition is deleted.
* If the competition has fewer than two participants remaining, it is deactivated.

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

### POST /api/CompetitionManager/\_getLeaderboard

**Description:** Retrieves a ranked leaderboard of participants for a given competition.

**Requirements:**

* The `competitionId` must refer to an existing competition.

**Effects:**

* Calculates the total score for each participant.
* Returns a list of participants sorted by their total score in descending order, with rank positions assigned.

**Request Body:**

```json
{
  "competitionId": "ID"
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

### POST /api/CompetitionManager/\_getCompetitionsForUser

**Description:** Retrieves all competitions that a given user is a participant in.

**Requirements:**

* None.

**Effects:**

* Returns a list of all `Competition` objects where the user is in the `participants` list.

**Request Body:**

```json
{
  "user": "ID"
}
```

**Success Response Body (Query):**

```json
[
  {
    "name": "string",
    "participants": "ID[]",
    "startDate": "Date",
    "endDate": "Date",
    "active": "boolean",
    "winners": "ID[]"
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

### POST /api/CompetitionManager/\_getReportedDates

**Description:** Retrieves the list of dates a user has reported for a specific event type in a competition.

**Requirements:**

* The `competitionId` must refer to an existing competition.
* The `userId` must be a participant in that competition.

**Effects:**

* Returns an array of date strings for which the user has submitted a report for the given `eventType`.

**Request Body:**

```json
{
  "competitionId": "ID",
  "userId": "ID",
  "eventType": "SleepEventType"
}
```

**Success Response Body (Query):**

```json
[
  {
    "date": "string"
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
