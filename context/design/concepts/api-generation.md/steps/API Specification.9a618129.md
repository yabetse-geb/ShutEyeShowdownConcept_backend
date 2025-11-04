---
timestamp: 'Mon Nov 03 2025 17:22:45 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_172245.54c5266e.md]]'
content_id: 9a618129419374eecf9e1d2d07134cf5e145f9355393745913724b60e7b80a7d
---

# API Specification: PasswordAuth Concept

**Purpose:** Limit access to known users and establish a point of contact.

***

## API Endpoints

### POST /api/PasswordAuth/register

**Description:** Creates a new user account with a username, password, and email.

**Requirements:**

* The chosen `username` must not already be in use.

**Effects:**

* A new `User` and a corresponding `Credential` record are created.
* Returns the ID of the newly created user.

**Request Body:**

```json
{
  "username": "string",
  "password": "string",
  "email": "string"
}
```

**Success Response Body (Action):**

```json
{
  "user": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/PasswordAuth/authenticate

**Description:** Authenticates a user with their username and password.

**Requirements:**

* A `Credential` must exist that matches the provided `username` and `password`.

**Effects:**

* If authentication is successful, returns the corresponding user ID.

**Request Body:**

```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response Body (Action):**

```json
{
  "user": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/PasswordAuth/changePassword

**Description:** Changes a user's password after verifying their current password.

**Requirements:**

* A `Credential` must exist that matches the provided `username` and `currentPassword`.

**Effects:**

* The user's password is updated to `newPassword`.

**Request Body:**

```json
{
  "username": "string",
  "currentPassword": "string",
  "newPassword": "string"
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

### POST /api/PasswordAuth/changeEmail

**Description:** Changes the email address associated with a user's account.

**Requirements:**

* A `Credential` must exist that matches the provided `username` and `password`.

**Effects:**

* The `email` field of the corresponding `User` record is updated to `newEmail`.

**Request Body:**

```json
{
  "username": "string",
  "password": "string",
  "newEmail": "string"
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

### POST /api/PasswordAuth/\_getEmail

**Description:** Retrieves the email address for a given username.

**Requirements:**

* A user with the given `username` must exist.

**Effects:**

* Returns the email address of the specified user.

**Request Body:**

```json
{
  "username": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "email": "string"
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

### POST /api/PasswordAuth/\_isRegistered

**Description:** Checks if a username is already registered.

**Requirements:**

* None.

**Effects:**

* Returns `true` if a user exists with the given `username`, otherwise returns `false`.

**Request Body:**

```json
{
  "username": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "isRegistered": "boolean"
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

### POST /api/PasswordAuth/deactivateAccount

**Description:** Deletes a user's account and all associated credentials.

**Requirements:**

* A `Credential` must exist that matches the provided `username` and `password`.

**Effects:**

* The `User` record and the `Credential` record for the specified user are permanently removed.

**Request Body:**

```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response Body (Action):**

```json
{}
```

**Error Response Body:**

````json
{
  "error": "string"
}

# response:


# response:

# API Specification: CompetitionManager Concept

**Purpose:** manage multiple named sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores.

---

## API Endpoints

### POST /api/CompetitionManager/startCompetition

**Description:** Creates a new competition for a set of users with a specified name, start date, and end date.

**Requirements:**
- `name` must be a non-empty string.
- `participants` must contain at least two distinct User IDs.
- `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
- The parsed `startDate` must logically precede or be equal to the parsed `endDate`.

**Effects:**
- Parses `startDateStr` and `endDateStr` into `Date` objects.
- Creates a `Competition` with the provided `name`, `participants`, `startDate`, `endDate`, a true `active` flag, and a null `winner`.
- For each `User` in `participants`, creates a corresponding `Score` entry with `wakeUpScore` and `bedTimeScore` initialized to zero.
- Returns the id of the created `Competition`.

**Request Body:**
```json
{
  "name": "string",
  "participants": ["string"],
  "startDateStr": "string",
  "endDateStr": "string"
}
````

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

### POST /api/PasswordAuth/\_getUsername

**Description:** Retrieves the username for a given user ID.

**Requirements:**

* A user with the given `userId` must exist.

**Effects:**

* Returns the `username` of the specified user.

**Request Body:**

```json
{
  "userId": "string"
}
```

**Success Response Body (Query):**

```json
{
  "username": "string"
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

**Description:** Records a user's sleep adherence statistic for a specific date and event type within active competitions.

**Requirements:**

* `u` is a part of at least one active `Competition`.
* `dateStr` is a valid date string parseable into a `Date`.

**Effects:**

* Parses `dateStr` into a `Date` object: `eventDate`.
* Calculates `scoreChange`: if `success` is `true`, `scoreChange = 1`; if `success` is `false`, `scoreChange = 0` (no change to score).
* For each active competition that `u` is a part of and where `eventDate` is within the competition's date range:
  * If `eventType` is `BEDTIME`, increments `bedTimeScore` by `scoreChange` and adds the date string (in YYYY-MM-DD format) to `reportedBedtimeDates` if not already present.
  * If `eventType` is `WAKETIME`, increments `wakeUpScore` by `scoreChange` and adds the date string (in YYYY-MM-DD format) to `reportedWakeUpDates` if not already present.

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

**Description:** Concludes an active competition, determines the winners, and marks it as inactive.

**Requirements:**

* The current date is on or after the `endDate` of the competition.
* The competition's `active` flag must be `true`.

**Effects:**

* Sets the competition's `active` flag to `false`.
* Calculates the total score for each participant.
* Identifies the set of users with the highest total score and sets them as `winners`.
* If all participants tie, `winners` remains `null`.
* Returns the set of winning `User` IDs, or `null` for a full tie.

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

### POST /api/CompetitionManager/removeParticipant

**Description:** Removes a user from an active competition and clears their associated scores.

**Requirements:**

* `competitionId` must refer to an existing `Competition`.
* The competition must be `active`.
* `userId` must be a member of the competition's participants.

**Effects:**

* Removes `userId` from the competition's `participants`.
* Removes the `Score` entry for the user in that competition.
* If the number of participants drops below 2, the competition is deactivated and `winners` is set to `null`.

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

### POST /api/CompetitionManager/\_getLeaderboard

**Description:** Retrieves a ranked leaderboard of participants for a given competition.

**Requirements:**

* `competitionId` must refer to an existing `Competition`.

**Effects:**

* Retrieves all `Score` entries for the competition.
* Calculates the total score for each user.
* Returns a list of objects, each containing a user's ID, their total score, and their rank, sorted in descending order of `totalScore`.

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

### POST /api/CompetitionManager/\_getCompetitionsForUser

**Description:** Retrieves all competitions a user is participating in.

**Requirements:**

* None

**Effects:**

* Returns all `Competition` objects where the specified user is a participant.

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

***

### POST /api/CompetitionManager/\_getReportedDates

**Description:** Retrieves the list of dates on which a user has reported a specific sleep event type for a competition.

**Requirements:**

* `competitionId` must refer to an existing `Competition`.
* `userId` must be a member of the competition's participants.

**Effects:**

* Returns the list of reported dates for the specified user, competition, and event type.

**Request Body:**

```json
{
  "competitionId": "string",
  "userId": "string",
  "eventType": "string"
}
```

**Success Response Body (Query):**

```json
[
  "string"
]
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***
