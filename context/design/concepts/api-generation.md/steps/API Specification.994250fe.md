---
timestamp: 'Mon Oct 20 2025 01:45:01 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_014501.b2fb4428.md]]'
content_id: 994250fe463710626fa6a797aa21b5ec00364a9ccb7dc3df716b4da81b026162
---

# API Specification: Accountability Concept

**Purpose:** Enable structured accountability between users by recording their partnerships, adherence tracking preferences, and report frequencies. The concept maintains only the data required to support external systems in generating notifications or summaries—it does not send or deliver messages itself. By storing which types of adherence failures are monitored and when reports should be produced, the concept ensures that each partnership’s accountability data remains accurate, consistent, and ready for use by reporting or notification services.

***

## API Endpoints

### POST /api/Accountability/addPartner

**Description:** Creates a new accountability partnership between two users.

**Requirements:**

* The `user` and `partner` must not be the same.
* A partnership between the `user` and `partner` must not already exist.

**Effects:**

* Adds a new partnership record for the `user` and `partner` with default preferences.

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

***

### POST /api/Accountability/removePartner

**Description:** Removes an existing accountability partnership.

**Requirements:**

* A partnership between the `user` and `partner` must exist.

**Effects:**

* The partnership record between the `user` and `partner` is removed.

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

***

### POST /api/Accountability/updatePreferences

**Description:** Updates the notification preferences for an existing partnership.

**Requirements:**

* A partnership between the `user` and `partner` must exist.

**Effects:**

* The `notifyTypes` and `reportFrequency` for the specified partnership are updated.

**Request Body:**

```json
{
  "user": "ID",
  "partner": "ID",
  "notifyTypes": ["FailureType"],
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

***

### POST /api/Accountability/recordFailure

**Description:** Records a single instance of an adherence failure for a user.

**Requirements:**

* The `date` must be a valid date string.
* The exact same failure (user, date, failureType) must not have been previously recorded.

**Effects:**

* A new `AdherenceFailure` record is created for the user with the specified date and failure type.

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

***

### POST /api/Accountability/reportAllFailuresFromStartToEnd

**Description:** Generates a summary string of all unreported failures for a user within a specified date range.

**Requirements:**

* `startDate` must be a date before or on the same day as `endDate`.
* Both `startDate` and `endDate` must be valid date strings.

**Effects:**

* Finds all unreported adherence failures for the user within the date range (inclusive).
* Returns a formatted string listing each failure, or a message indicating no failures were found.

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

**Description:** Generates notification messages for a user's partners based on their reporting preferences and marks failures as reported.

**Requirements:**

* The user must have at least one recorded partnership.
* The `date` string must be parseable.

**Effects:**

* For each of the user's partnerships, it checks if a report is due based on the `reportFrequency`.
* If a report is due, it compiles all relevant unreported failures into a message.
* Marks the compiled failures as `reported`.
* Updates the `lastReportDate` for the partnership.
* Returns a single formatted string containing all generated messages, or an empty string if no reports were due.

**Request Body:**

```json
{
  "user": "ID",
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
