---
timestamp: 'Mon Oct 27 2025 13:15:33 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251027_131533.24ddd12b.md]]'
content_id: 7aae78f96aadcfe47521dd60e2d7d444bdf315785e4fbb7e5cd9a85665381bcb
---

# API Specification: Accountability Concept

**Purpose:** Enable structured accountability between users by recording their partnerships, adherence tracking preferences, and report frequencies. The concept maintains only the data required to support external systems in generating notifications or summaries—it does not send or deliver messages itself. By storing which types of adherence failures are monitored and when reports should be produced, the concept ensures that each partnership’s accountability data remains accurate, consistent, and ready for use by reporting or notification services.

***

## API Endpoints

### POST /api/Accountability/addPartner

**Description:** Creates a new accountability partnership between two users with specified preferences.

**Requirements:**

* The `user` and `partner` IDs must not be the same.
* A partnership from `user` to `partner` must not already exist.

**Effects:**

* Adds a new Partnership record to the database with the provided `user`, `partner`, `notifyTypes`, `reportFrequency`, and sets `lastReportDate` to null.

**Request Body:**

```json
{
  "user": "ID",
  "partner": "ID",
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

**Description:** Removes an existing accountability partnership between two users.

**Requirements:**

* A partnership from `user` to `partner` must exist.

**Effects:**

* Removes the Partnership record that matches the given `user` and `partner`.

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

**Description:** Modifies the notification preferences for an existing partnership.

**Requirements:**

* A partnership from `user` to `partner` must exist.

**Effects:**

* Updates the `notifyTypes` and `reportFrequency` for the specified partnership.

**Request Body:**

```json
{
  "user": "ID",
  "partner": "ID",
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

**Description:** Records an instance of a user failing to adhere to their sleep schedule.

**Requirements:**

* `date` must be a valid string that can be parsed into a Date object.
* The same exact failure (same user, date, and type) must not already be recorded.

**Effects:**

* Creates and stores a new AdherenceFailure record with the `reported` flag set to `false`.

**Request Body:**

```json
{
  "user": "ID",
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

**Description:** Generates a summary of all unreported adherence failures for a user within a specified date range.

**Requirements:**

* `startDate` and `endDate` must be valid date strings.
* `startDate` must be on or before `endDate`.

**Effects:**

* Finds all unreported adherence failures for the given user within the date range.
* Returns a formatted string listing each failure, or a message indicating no failures were found. This action does *not* mark the failures as reported.

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

### POST /api/Accountability/generateNotificationMessage

**Description:** Generates a notification message for a user's partners based on their reporting preferences and recorded failures.

**Requirements:**

* The user must have at least one partnership.
* `date` must be a valid date string representing the current date for evaluation.

**Effects:**

* Evaluates each of the user's partnerships based on its `reportFrequency`.
* If a report is due, it finds unreported failures that match the partnership's `notifyTypes`.
* If failures are found, it generates a message string, marks the failures as `reported`, and updates the partnership's `lastReportDate`.
* Returns the generated message(s) or an empty string if no reports are due.

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

### POST /api/Accountability/\_getPartnerships

**Description:** Retrieves all partnerships where the specified user is either the primary user or the partner.

**Requirements:**

* None.

**Effects:**

* Returns an array of Partnership objects associated with the user.

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
    "_id": "ID",
    "user": "ID",
    "partner": "ID",
    "notifyTypes": ["BEDTIME", "WAKETIME"],
    "reportFrequency": "Immediate",
    "lastReportDate": "string | null"
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
