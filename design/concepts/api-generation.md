# API Specification: Password Concept


[@api-extraction-from-code](../tools/api-extraction-from-code.md)

[@api-extraction-from-spec](../tools/api-extraction-from-spec.md)

Please extract an API specs for all these concepts Accountability, CompetitionManager, PasswordAuth, Sessioning, and SleepSchedule

## Accountability:

Specification:

[@Accountability](Accountability/Accountability.md)

Code:

[@Implementation](Accountability/Implementation.md)


## CompetitionManager:

Specification:

[@CompetitionManager](CompetitionManager/CompetitionManager.md)

Code:

[@implementation](CompetitionManager/implementation.md)

## PasswordAuth

Specification:

[@PasswordAuth](PasswordAuth/PasswordAuth.md)

Code:

[@implementation](PasswordAuth/implementation.md)


## Sessioning

Specification:

[@Sessioning](Sessioning/Sessioning.md)

Code:

[@implementation](Sessioning/implementation.md)

## SleepSchedule

Specification:

[@SleepSchedule](SleepSchedule/SleepSchedule.md)

Code:

[@implementation](SleepSchedule/implementation.md)




# response:

# API Specification: Accountability Concept

**Purpose:** Enable structured accountability between users by recording their partnerships, adherence tracking preferences, and report frequencies. The concept maintains only the data required to support external systems in generating notifications or summaries—it does not send or deliver messages itself. By storing which types of adherence failures are monitored and when reports should be produced, the concept ensures that each partnership’s accountability data remains accurate, consistent, and ready for use by reporting or notification services.

---

## API Endpoints

### POST /api/Accountability/addPartner

**Description:** Establishes a new accountability partnership between two users with specified notification preferences.

**Requirements:**
- user and partner are not equal.
- A partnership between the user and partner must not already exist.

**Effects:**
- Adds a new partnership record with the given user, partner, notification types, and report frequency.
- Creates a corresponding report entry for the partner to receive reports about the user.

**Request Body:**
```json
{
  "user": "ID",
  "partner": "ID",
  "notifyTypes": "FailureType[]",
  "reportFrequency": "FrequencyType"
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

**Description:** Removes an existing accountability partnership between two users.

**Requirements:**
- A partnership must exist between the specified user and partner.

**Effects:**
- Removes the partnership record for the user and partner.
- Removes the associated report entry.

**Request Body:**
```json
{
  "user": "ID",
  "partner": "ID"
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

**Description:** Updates the notification preferences for an existing partnership.

**Requirements:**
- A partnership must exist between the specified user and partner.

**Effects:**
- Modifies the `notifyTypes` and `reportFrequency` for the existing partnership.

**Request Body:**
```json
{
  "user": "ID",
  "partner": "ID",
  "notifyTypes": "FailureType[]",
  "reportFrequency": "FrequencyType"
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

**Description:** Records an instance of a user failing to adhere to their sleep schedule.

**Requirements:**
- `date` must be a string that can be parsed into a Date object.
- The exact same failure (user, date, type) must not already be recorded.

**Effects:**
- Creates a new `AdherenceFailure` record for the user on the specified date and failure type.

**Request Body:**
```json
{
  "user": "ID",
  "date": "string",
  "failureType": "SleepEventType"
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

**Description:** Generates a string summary of all unreported adherence failures for a user within a specified date range.

**Requirements:**
- `startDate` must be less than or equal to `endDate`.
- `startDate` and `endDate` must be valid date strings.

**Effects:**
- Finds all unreported adherence failures for the user within the date range.
- Returns a formatted string listing each failure, or a message indicating no failures were found.

**Request Body:**
```json
{
  "user": "ID",
  "startDate": "string",
  "endDate": "string"
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
### POST /api/Accountability/updateReports

**Description:** Generates and appends new reports for a user's partners based on their configured frequency and recent failures.

**Requirements:**
- The user must have at least one active partnership.
- The `date` string must be a valid, parsable date.

**Effects:**
- For each of the user's partnerships, it checks if a report should be generated based on the `reportFrequency`.
- If a report is generated, it includes all unreported failures, marks them as reported, updates the partnership's `lastReportedDate`, and appends the report string to the partner's report log.

**Request Body:**
```json
{
  "user": "ID",
  "date": "string"
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
### POST /api/Accountability/_getPartnerships

**Description:** Retrieves all accountability partnerships associated with a given user.

**Requirements:**
- None.

**Effects:**
- Returns all partnerships where the user is either the primary user or the partner.

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
    "user": "ID",
    "partner": "ID",
    "notifyTypes": "FailureType[]",
    "reportFrequency": "FrequencyType",
    "lastReportDate": "Date"
  }
]
```

**Error Response Body:**
```json
[]
```
---
# API Specification: CompetitionManager Concept

**Purpose:** manage multiple named sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores.

---

## API Endpoints

### POST /api/CompetitionManager/startCompetition

**Description:** Creates a new sleep-adherence competition between a set of users.

**Requirements:**
- `name` must be a non-empty string.
- `participants` must contain at least two distinct users.
- `startDateStr` and `endDateStr` must be valid date strings.
- The start date must be before or the same as the end date.

**Effects:**
- Creates a new `Competition` record with the specified details and an active status.
- Initializes a `Score` record for each participant in the new competition with scores set to zero.
- Returns the ID of the newly created competition.

**Request Body:**
```json
{
  "name": "string",
  "participants": "ID[]",
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
---
### POST /api/CompetitionManager/recordStat

**Description:** Records a user's performance (success or failure) for a sleep event within their active competitions.

**Requirements:**
- The user `u` must be a participant in at least one active competition.
- `dateStr` must be a valid date string.

**Effects:**
- For each active competition the user is in, if the event date is within the competition's range:
  - If `success` is true, the user's score for the `eventType` is incremented by 1.
  - The date is recorded to track reporting adherence.

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
---
### POST /api/CompetitionManager/endCompetition

**Description:** Ends an active competition, applies penalties for missed reports, and determines the winner(s).

**Requirements:**
- The competition must be active.
- The current date must be on or after the competition's `endDate`.

**Effects:**
- The competition's `active` flag is set to `false`.
- Penalties are applied to each participant's score for any days they failed to report.
- The user(s) with the highest final score are calculated and stored as the `winners`.
- If all participants tie, the `winners` field is set to null.
- Returns the set of winning user IDs.

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
---
### POST /api/CompetitionManager/removeParticipant

**Description:** Removes a user from an active competition.

**Requirements:**
- The competition must be active.
- The user must be a current participant in the competition.

**Effects:**
- The specified user is removed from the competition's list of participants.
- The user's score record for that competition is deleted.
- If the competition has fewer than two participants remaining, it is deactivated.

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
---
### POST /api/CompetitionManager/_getLeaderboard

**Description:** Retrieves a ranked leaderboard of participants for a given competition.

**Requirements:**
- The `competitionId` must refer to an existing competition.

**Effects:**
- Calculates the total score for each participant.
- Returns a list of participants sorted by their total score in descending order, with rank positions assigned.

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
[]
```
---
### POST /api/CompetitionManager/_getCompetitionsForUser

**Description:** Retrieves all competitions that a given user is a participant in.

**Requirements:**
- None.

**Effects:**
- Returns a list of all `Competition` objects where the user is in the `participants` list.

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
[]
```
---
### POST /api/CompetitionManager/_getReportedDates

**Description:** Retrieves the list of dates a user has reported for a specific event type in a competition.

**Requirements:**
- The `competitionId` must refer to an existing competition.
- The `userId` must be a participant in that competition.

**Effects:**
- Returns an array of date strings for which the user has submitted a report for the given `eventType`.

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
[]
```
---
# API Specification: PasswordAuth Concept

**Purpose:** limit access to known users and establish point of contact.

---

## API Endpoints

### POST /api/PasswordAuth/register

**Description:** Creates a new user account with a username and password.

**Requirements:**
- No user can already exist with the given `username`.

**Effects:**
- A new user record is created with the provided credentials.
- Returns the unique ID of the new user.

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
  "user": "ID"
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

**Description:** Authenticates a user based on their username and password.

**Requirements:**
- A user must exist with the provided `username` and `password`.

**Effects:**
- If authentication is successful, returns the unique ID of the authenticated user.

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
  "user": "ID"
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

**Description:** Allows an authenticated user to change their password.

**Requirements:**
- A user must exist with the provided `username` and `currentPassword`.

**Effects:**
- The user's password is updated to the `newPassword`.

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
### POST /api/PasswordAuth/deactivateAccount

**Description:** Deletes a user's account.

**Requirements:**
- A user must exist with the provided `username` and `password`.

**Effects:**
- The user's account and all associated authentication data are permanently removed.

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
```
---
### POST /api/PasswordAuth/_isRegistered

**Description:** Checks if a username is already registered.

**Requirements:**
- None.

**Effects:**
- Returns `true` if a user exists with the given username, otherwise `false`.

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
### POST /api/PasswordAuth/_getUsername

**Description:** Retrieves the username for a given user ID.

**Requirements:**
- A user must exist with the given `userId`.

**Effects:**
- Returns the username associated with the user ID.

**Request Body:**
```json
{
  "userId": "ID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "username": "string"
  }
]
```

**Error Response Body:**
```json
[]
```
---
### POST /api/PasswordAuth/_getUserByUsername

**Description:** Retrieves the user ID for a given username.

**Requirements:**
- A user must exist with the given `username`.

**Effects:**
- Returns the user ID associated with the username.

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
    "user": "ID"
  }
]
```

**Error Response Body:**
```json
[]
```
---
# API Specification: Sessioning Concept

**Purpose:** To maintain a user's logged-in state across multiple requests without re-sending credentials.

---

## API Endpoints

### POST /api/Sessioning/create

**Description:** Creates a new session for an authenticated user.

**Requirements:**
- None.

**Effects:**
- A new session is created and associated with the provided user ID.
- Returns the unique ID of the new session.

**Request Body:**
```json
{
  "user": "ID"
}
```

**Success Response Body (Action):**
```json
{
  "session": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---
### POST /api/Sessioning/delete

**Description:** Deletes a session, effectively logging the user out.

**Requirements:**
- The provided session must exist.

**Effects:**
- The session record is removed.

**Request Body:**
```json
{
  "session": "ID"
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
### POST /api/Sessioning/_getUser

**Description:** Retrieves the user ID associated with a given session.

**Requirements:**
- The provided session must exist.

**Effects:**
- Returns the user ID linked to the session.

**Request Body:**
```json
{
  "session": "ID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "user": "ID"
  }
]
```

**Error Response Body:**
```json
[]
```
---
# API Specification: SleepSchedule Concept

**Purpose:** Let users set bedtime/wake goals, log sleep and wake events, and record daily adherence (did the user follow their targets).

---

## API Endpoints

### POST /api/SleepSchedule/addSleepSlot

**Description:** Creates or updates a user's sleep schedule for a specific date.

**Requirements:**
- `dateStr`, `bedTimeStr`, and `wakeTimeStr` must be valid date and time strings.
- `toleranceMins` must be a positive number.

**Effects:**
- If a sleep slot already exists for the user on the given date, it is replaced.
- A new `SleepSlot` is created with the user's target bedtime, wake-up time, and tolerance.
- Adherence flags (`wakeUpSuccess`, `bedTimeSuccess`) are initialized to null.

**Request Body:**
```json
{
  "u": "ID",
  "bedTimeStr": "string",
  "wakeTimeStr": "string",
  "toleranceMins": "number",
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
- `dateStr` must be a valid date string.
- A sleep slot must exist for the user on the specified date.

**Effects:**
- The `SleepSlot` record for the user on the given date is deleted.

**Request Body:**
```json
{
  "u": "ID",
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

**Description:** Records a user's actual bedtime and evaluates adherence against their scheduled target.

**Requirements:**
- `reportedTimeStr` and `dateStr` must be valid date/time strings.
- A sleep slot must exist for the user on the specified date.

**Effects:**
- The `bedTimeSuccess` flag for the sleep slot is set to `true` if the reported time is within the tolerance of the target bedtime, and `false` otherwise.
- Returns the boolean success value.

**Request Body:**
```json
{
  "u": "ID",
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

**Description:** Records a user's actual wake-up time and evaluates adherence against their scheduled target.

**Requirements:**
- `reportedTimeStr` and `dateStr` must be valid date/time strings.
- A sleep slot must exist for the user on the specified date.

**Effects:**
- The `wakeUpSuccess` flag for the sleep slot is set to `true` if the reported time is within the tolerance of the target wake-up time, and `false` otherwise.
- Returns the boolean success value.

**Request Body:**
```json
{
  "u": "ID",
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
### POST /api/SleepSchedule/_getSleepSlot

**Description:** Retrieves the sleep schedule for a user on a specific date.

**Requirements:**
- None.

**Effects:**
- Returns the `SleepSlot` object for the user and date if it exists.

**Request Body:**
```json
{
  "u": "ID",
  "dateStr": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "u": "ID",
    "date": "Date",
    "bedTime": "Date",
    "wakeUpTime": "Date",
    "toleranceMins": "number",
    "wakeUpSuccess": "boolean",
    "bedTimeSuccess": "boolean"
  }
]
```

**Error Response Body:**
```json
[]
```
---
### POST /api/SleepSchedule/_getAllSleepSlotsForUser

**Description:** Retrieves all sleep schedules for a given user.

**Requirements:**
- None.

**Effects:**
- Returns all `SleepSlot` objects associated with the specified user.

**Request Body:**
```json
{
  "u": "ID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "u": "ID",
    "date": "Date",
    "bedTime": "Date",
    "wakeUpTime": "Date",
    "toleranceMins": "number",
    "wakeUpSuccess": "boolean",
    "bedTimeSuccess": "boolean"
  }
]
```

**Error Response Body:**
```json
[]
```
---
