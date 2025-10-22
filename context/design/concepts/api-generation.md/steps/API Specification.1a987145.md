---
timestamp: 'Tue Oct 21 2025 18:40:35 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_184035.d6e9d267.md]]'
content_id: 1a9871451884858c08d2c3daf53610fdf4e40361dae3b710cba3e2f8745f2a76
---

# API Specification: Accountability Concept

**Purpose:** Enable structured accountability between users by recording their partnerships, adherence tracking preferences, and report frequencies. The concept maintains only the data required to support external systems in generating notifications or summaries—it does not send or deliver messages itself. By storing which types of adherence failures are monitored and when reports should be produced, the concept ensures that each partnership’s accountability data remains accurate, consistent, and ready for use by reporting or notification services.

***

## API Endpoints

### POST /api/Accountability/addPartner

**Description:** Creates a new accountability partnership between two users with specified notification settings.

**Requirements:**

* The `user` and `partner` must not be the same.
* A partnership between this `user` and `partner` must not already exist.

**Effects:**

* A new `Partnership` record is created with the given `user`, `partner`, `notifyTypes`, `reportFrequency`, and a `lastReportDate` of null.

**Request Body:**

```json
{
  "user": "string",
  "partner": "string",
  "notifyTypes": ["BEDTIME" | "WAKETIME"],
  "reportFrequency": "Immediate" | "Daily" | "Weekly"
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

### POST /api/Accountability/removePartner

**Description:** Removes an existing accountability partnership.

**Requirements:**

* A partnership must exist between the given `user` and `partner`.

**Effects:**

* The `Partnership` record matching the `user` and `partner` is removed.

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

***

### POST /api/Accountability/updatePreferences

**Description:** Updates the notification settings for an existing partnership.

**Requirements:**

* A partnership must exist between the given `user` and `partner`.

**Effects:**

* The `notifyTypes` and `reportFrequency` of the existing partnership are updated to the new values.

**Request Body:**

```json
{
  "user": "string",
  "partner": "string",
  "notifyTypes": ["BEDTIME" | "WAKETIME"],
  "reportFrequency": "Immediate" | "Daily" | "Weekly"
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

### POST /api/Accountability/recordFailure

**Description:** Records a specific instance of an adherence failure for a user on a given date.

**Requirements:**

* The `date` string must be in a parsable format (e.g., YYYY-MM-DD).
* The exact same failure (user, date, type) must not already be recorded.

**Effects:**

* A new `AdherenceFailure` record is created for the user with the specified date and failure type.

**Request Body:**

```json
{
  "user": "string",
  "date": "string",
  "failureType": "BEDTIME" | "WAKETIME"
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

### POST /api/Accountability/reportAllFailuresFromStartToEnd

**Description:** Generates a summary string of all unreported adherence failures for a user within a specified date range.

**Requirements:**

* `startDate` and `endDate` must be valid, parsable date strings.
* `startDate` must be on or before `endDate`.

**Effects:**

* Finds all unreported adherence failures for the user between the start and end dates.
* Returns a string listing each failure, or a message indicating no failures were found.

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

***

### POST /api/Accountability/generateNotificationMessage

**Description:** Generates notification messages for a user's partners based on their reporting preferences and marks the included failures as reported.

**Requirements:**

* The user must have at least one active partnership.
* The `date` string must be a valid, parsable date.

**Effects:**

* For each of the user's partnerships, it checks if a report is due based on the `reportFrequency`.
* If a report is due, it compiles all relevant unreported failures into a message string.
* The failures included in the message are marked as reported.
* The partnership's `lastReportDate` is updated.
* Returns the compiled message(s) or an empty string if no notifications are due.

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

***

### POST /api/Accountability/\_getPartnerships

**Description:** Retrieves all partnerships associated with a user, where they are either the primary user or the partner.

**Requirements:**

* (None)

**Effects:**

* Returns an array of all `Partnership` objects where the specified user is either the `user` or the `partner`.

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

***
