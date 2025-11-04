---
timestamp: 'Tue Nov 04 2025 15:16:31 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251104_151631.7617a424.md]]'
content_id: de251f81f26c33d7da2370924165512c606fe72bf42d3209d1abc096661c7132
---

# API Specification: Accountability Concept

**Purpose:** Enable structured accountability between users by recording their partnerships, adherence tracking preferences, and report frequencies. The concept maintains only the data required to support external systems in generating notifications or summaries—it does not send or deliver messages itself. By storing which types of adherence failures are monitored and when reports should be produced, the concept ensures that each partnership’s accountability data remains accurate, consistent, and ready for use by reporting or notification services.

***

## API Endpoints

### POST /api/Accountability/addPartner

**Description:** Establishes a new accountability partnership between two users with specified notification preferences.

**Requirements:**

* user and partner are not equal.
* A partnership between the user and partner must not already exist.

**Effects:**

* Adds a new partnership record with the given user, partner, notification types, and report frequency.
* Creates a corresponding report entry for the partner to receive reports about the user.

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

***

### POST /api/Accountability/removePartner

**Description:** Removes an existing accountability partnership between two users.

**Requirements:**

* A partnership must exist between the specified user and partner.

**Effects:**

* Removes the partnership record for the user and partner.
* Removes the associated report entry.

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

* A partnership must exist between the specified user and partner.

**Effects:**

* Modifies the `notifyTypes` and `reportFrequency` for the existing partnership.

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

***

### POST /api/Accountability/recordFailure

**Description:** Records an instance of a user failing to adhere to their sleep schedule.

**Requirements:**

* `date` must be a string that can be parsed into a Date object.
* The exact same failure (user, date, type) must not already be recorded.

**Effects:**

* Creates a new `AdherenceFailure` record for the user on the specified date and failure type.

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

**Description:** Generates a string summary of all unreported adherence failures for a user within a specified date range.

**Requirements:**

* `startDate` must be less than or equal to `endDate`.
* `startDate` and `endDate` must be valid date strings.

**Effects:**

* Finds all unreported adherence failures for the user within the date range.
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

### POST /api/Accountability/updateReports

**Description:** Generates and appends new reports for a user's partners based on their configured frequency and recent failures.

**Requirements:**

* The user must have at least one active partnership.

**Effects:**

* For each of the user's partnerships, it checks if a report should be generated based on the `reportFrequency`.
* If a report is generated, it includes all unreported failures, marks them as reported, updates the partnership's `lastReportedDate`, and appends the report string to the partner's report log.

**Request Body:**

```json
{
  "user": "ID"
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

### POST /api/Accountability/\_getPartnerships

**Description:** Retrieves all accountability partnerships associated with a given user.

**Requirements:**

* None.

**Effects:**

* Returns all partnerships where the user is either the primary user or the partner.

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
{
  "error": "string"
}
```

***
