# API Specification: Accountability Concept


[@api-extraction-from-code](../tools/api-extraction-from-code.md)

[@api-extraction-from-spec](../tools/api-extraction-from-spec.md)

Please add an API spec for the `_getPartnerships` query I added to Accountability

## Accountability

Specification:

[@Accountability](Accountability/Accountability.md)

Code:

[@Implementation](Accountability/Implementation.md)




**Purpose:** Enable structured accountability between users by recording their partnerships, adherence tracking preferences, and report frequencies. The concept maintains only the data required to support external systems in generating notifications or summaries—it does not send or deliver messages itself. By storing which types of adherence failures are monitored and when reports should be produced, the concept ensures that each partnership’s accountability data remains accurate, consistent, and ready for use by reporting or notification services.

---

## API Endpoints

### POST /api/Accountability/addPartner

**Description:** Creates a new accountability partnership between two users with specified notification settings.

**Requirements:**
- The `user` and `partner` must not be the same.
- A partnership between this `user` and `partner` must not already exist.

**Effects:**
- A new `Partnership` record is created with the given `user`, `partner`, `notifyTypes`, `reportFrequency`, and a `lastReportDate` of null.

**Request Body:**
```json
{
  "user": "string",
  "partner": "string",
  "notifyTypes": ["string"],
  "reportFrequency": "string"
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
---

### POST /api/Accountability/removePartner

**Description:** Removes an existing accountability partnership.

**Requirements:**
- A partnership must exist between the given `user` and `partner`.

**Effects:**
- The `Partnership` record matching the `user` and `partner` is removed.

**Request Body:**
```json
{
  "user": "string",
  "partner": "string"
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
---

### POST /api/Accountability/updatePreferences

**Description:** Updates the notification settings for an existing partnership.

**Requirements:**
- A partnership must exist between the given `user` and `partner`.

**Effects:**
- The `notifyTypes` and `reportFrequency` of the existing partnership are updated to the new values.

**Request Body:**
```json
{
  "user": "string",
  "partner": "string",
  "notifyTypes": ["string"],
  "reportFrequency": "string"
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
---

### POST /api/Accountability/recordFailure

**Description:** Records a specific instance of an adherence failure for a user on a given date.

**Requirements:**
- The `date` string must be in a parsable format (e.g., YYYY-MM-DD).
- The exact same failure (user, date, type) must not already be recorded.

**Effects:**
- A new `AdherenceFailure` record is created for the user with the specified date and failure type.

**Request Body:**
```json
{
  "user": "string",
  "date": "string",
  "failureType": "string"
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
---

### POST /api/Accountability/reportAllFailuresFromStartToEnd

**Description:** Generates a summary string of all unreported adherence failures for a user within a specified date range.

**Requirements:**
- `startDate` and `endDate` must be valid, parsable date strings.
- `startDate` must be on or before `endDate`.

**Effects:**
- Finds all unreported adherence failures for the user between the start and end dates.
- Returns a string listing each failure, or a message indicating no failures were found.

**Request Body:**
```json
{
  "user": "string",
  "startDate": "string",
  "endDate": "string"
}
```

**Success Response Body (Action):**
```json
{
  "report": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/Accountability/generateNotificationMessage

**Description:** Generates notification messages for a user's partners based on their reporting preferences and marks the included failures as reported.

**Requirements:**
- The user must have at least one active partnership.
- The `date` string must be a valid, parsable date.

**Effects:**
- For each of the user's partnerships, it checks if a report is due based on the `reportFrequency`.
- If a report is due, it compiles all relevant unreported failures into a message string.
- The failures included in the message are marked as reported.
- The partnership's `lastReportDate` is updated.
- Returns the compiled message(s) or an empty string if no notifications are due.

**Request Body:**
```json
{
  "user": "string",
  "date": "string"
}
```

**Success Response Body (Action):**
```json
{
  "message": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/Accountability/_getPartnerships

**Description:** Retrieves all partnerships associated with a user, where they are either the primary user or the partner.

**Requirements:**
- (None)

**Effects:**
- Returns an array of all `Partnership` objects where the specified user is either the `user` or the `partner`.

**Request Body:**
```json
{
  "user": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "string",
    "user": "string",
    "partner": "string",
    "notifyTypes": ["string"],
    "reportFrequency": "string",
    "lastReportDate": "string"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
# API Specification: CompetitionManager Concept

**Purpose:** manage multiple named sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores.

---

## API Endpoints

### POST /api/CompetitionManager/startCompetition

**Description:** Creates a new named competition for a set of users with a defined start and end date.

**Requirements:**
- `name` must be a non-empty string.
- `participants` must contain at least two distinct user IDs.
- `startDateStr` and `endDateStr` must be valid date strings.
- The start date must be on or before the end date.

**Effects:**
- A new `Competition` is created with the given name, participants, and dates, marked as active.
- A `Score` record is created for each participant, initialized to zero.
- Returns the ID of the newly created competition.

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
---

### POST /api/CompetitionManager/recordStat

**Description:** Records a sleep adherence event (success or failure) for a user, updating their score in all relevant active competitions.

**Requirements:**
- The user `u` must be a participant in at least one active competition.
- The `dateStr` must be a valid date string that falls within the active competition's date range.

**Effects:**
- The user's score is updated (+1 for success, -1 for failure) in every active competition they are part of where the event date falls within the competition's date range.
- The score for either `wakeUpScore` or `bedTimeScore` is adjusted based on the `eventType`.

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
---

### POST /api/CompetitionManager/endCompetition

**Description:** Ends an active competition, determines the winner(s), and marks the competition as inactive.

**Requirements:**
- The current date must be on or after the competition's `endDate`.
- The competition must be active.

**Effects:**
- The competition's `active` flag is set to `false`.
- The `winners` field is set to the user(s) with the highest total score.
- If all participants tie, `winners` is set to `null`.
- Returns the set of winning user IDs.

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
---

### POST /api/CompetitionManager/\_getLeaderboard

**Description:** Retrieves a ranked leaderboard for a specific competition.

**Requirements:**
- `competitionId` must refer to an existing competition.

**Effects:**
- Retrieves all score entries for the competition.
- Calculates the total score for each user.
- Returns a ranked list of all participants in the competition, including their position, user ID, and total score.

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
---

### POST /api/CompetitionManager/removeParticipant

**Description:** Removes a user from an active competition and deletes their score.

**Requirements:**
- `competitionId` must refer to an existing, active competition.
- `userId` must be a current member of the competition's participants.

**Effects:**
- The specified user is removed from the competition's `participants` list.
- The user's `Score` record for that competition is deleted.
- If the number of participants drops below two, the competition is deactivated.

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
---
---
### POST /api/CompetitionManager/_getCompetitionsForUser

**Description:** Retrieves all competitions that a specific user is a participant in.

**Requirements:**
- A user with the given ID `u` must exist.

**Effects:**
- Returns a list of all `Competition` objects where the user is listed as a participant.

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


# API Specification: SleepSchedule Concept

**Purpose:** Let users set bedtime/wake goals, log sleep and wake events, and record daily adherence (did the user follow their targets).

---

## API Endpoints

### POST /api/SleepSchedule/addSleepSlot

**Description:** Creates a new daily sleep schedule (a "slot") for a user with target bedtime and wake-up times.

**Requirements:**
- `dateStr`, `bedTimeStr`, and `wakeTimeStr` must be valid, parsable date/time strings.
- A `SleepSlot` must not already exist for the given user on the specified date.

**Effects:**
- A new `SleepSlot` is created for the user on the given date with the specified time targets.
- The adherence status (`wakeUpSuccess`, `bedTimeSuccess`) is initialized to null.

**Request Body:**
```json
{
  "u": "string",
  "bedTimeStr": "string",
  "wakeTimeStr": "string",
  "dateStr": "string"
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
---

### POST /api/SleepSchedule/removeSleepSlot

**Description:** Removes a user's sleep schedule for a specific date.

**Requirements:**
- `dateStr` must be a valid, parsable date string.
- A `SleepSlot` must exist for the user on the specified date.

**Effects:**
- The `SleepSlot` for the user on the given date is removed from the system.

**Request Body:**
```json
{
  "u": "string",
  "dateStr": "string"
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
---

### POST /api/SleepSchedule/reportBedTime

**Description:** Records the actual time a user went to bed and determines if they met their goal.

**Requirements:**
- `reportedTimeStr` and `dateStr` must be valid date/time strings.
- A `SleepSlot` must exist for the user on the specified date.

**Effects:**
- The `bedTimeSuccess` status is updated for the user's `SleepSlot` on the given date. Success is true if the reported time is before or at the target bedtime.
- Returns the boolean success status.

**Request Body:**
```json
{
  "u": "string",
  "reportedTimeStr": "string",
  "dateStr": "string"
}
```

**Success Response Body (Action):**
```json
{
  "bedTimeSuccess": "boolean"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/SleepSchedule/reportWakeUpTime

**Description:** Records the actual time a user woke up and determines if they met their goal.

**Requirements:**
- `reportedTimeStr` and `dateStr` must be valid date/time strings.
- A `SleepSlot` must exist for the user on the specified date.

**Effects:**
- The `wakeUpSuccess` status is updated for the user's `SleepSlot`. Success is true if the reported time is within five minutes of the target wake-up time.
- Returns the boolean success status.

**Request Body:**
```json
{
  "u": "string",
  "reportedTimeStr": "string",
  "dateStr": "string"
}
```

**Success Response Body (Action):**
```json
{
  "wakeUpSuccess": "boolean"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/SleepSchedule/\_getSleepSlot

**Description:** Retrieves the sleep schedule for a user on a specific date.

**Requirements:**
- `dateStr` must be a valid date string.

**Effects:**
- Returns the `SleepSlot` object for the user and date if one exists.

**Request Body:**
```json
{
  "u": "string",
  "dateStr": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "string",
    "u": "string",
    "date": "string",
    "bedTime": "string",
    "wakeUpTime": "string",
    "wakeUpSuccess": "boolean",
    "bedTimeSuccess": "boolean"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/SleepSchedule/\_getAllSleepSlotsForUser

**Description:** Retrieves all sleep schedules for a given user.

**Requirements:**
- The user must exist.

**Effects:**
- Returns an array of all `SleepSlot` objects associated with the user.

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
    "u": "string",
    "date": "string",
    "bedTime": "string",
    "wakeUpTime": "string",
    "wakeUpSuccess": "boolean",
    "bedTimeSuccess": "boolean"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
# API Specification: PasswordAuth Concept

**Purpose:** Limit access to known users and establish a point of contact.

---

## API Endpoints

### POST /api/PasswordAuth/register

**Description:** Creates a new user account with a username, password, and email.

**Requirements:**
- The chosen `username` must not already be in use.

**Effects:**
- A new `User` and a corresponding `Credential` record are created.
- Returns the ID of the newly created user.

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
---

### POST /api/PasswordAuth/authenticate

**Description:** Authenticates a user with their username and password.

**Requirements:**
- A `Credential` must exist that matches the provided `username` and `password`.

**Effects:**
- If authentication is successful, returns the corresponding user ID.

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
---

### POST /api/PasswordAuth/changePassword

**Description:** Changes a user's password after verifying their current password.

**Requirements:**
- A `Credential` must exist that matches the provided `username` and `currentPassword`.

**Effects:**
- The user's password is updated to `newPassword`.

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
---

### POST /api/PasswordAuth/changeEmail

**Description:** Changes the email address associated with a user's account.

**Requirements:**
- A `Credential` must exist that matches the provided `username` and `password`.

**Effects:**
- The `email` field of the corresponding `User` record is updated to `newEmail`.

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
---

### POST /api/PasswordAuth/\_getEmail

**Description:** Retrieves the email address for a given username.

**Requirements:**
- A user with the given `username` must exist.

**Effects:**
- Returns the email address of the specified user.

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
---

### POST /api/PasswordAuth/\_isRegistered

**Description:** Checks if a username is already registered.

**Requirements:**
- None.

**Effects:**
- Returns `true` if a user exists with the given `username`, otherwise returns `false`.

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
---

### POST /api/PasswordAuth/deactivateAccount

**Description:** Deletes a user's account and all associated credentials.

**Requirements:**
- A `Credential` must exist that matches the provided `username` and `password`.

**Effects:**
- The `User` record and the `Credential` record for the specified user are permanently removed.

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
```json
{
  "error": "string"
}
