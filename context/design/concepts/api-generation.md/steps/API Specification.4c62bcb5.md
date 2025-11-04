---
timestamp: 'Tue Nov 04 2025 15:16:31 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251104_151631.7617a424.md]]'
content_id: 4c62bcb54597200d36386955b40495a537dc05b6a5ad3c8ecf3615e3f3a69300
---

# API Specification: SleepSchedule Concept

**Purpose:** Let users set bedtime/wake goals, log sleep and wake events, and record daily adherence (did the user follow their targets).

***

## API Endpoints

### POST /api/SleepSchedule/addSleepSlot

**Description:** Creates or updates a user's sleep schedule for a specific date.

**Requirements:**

* `dateStr`, `bedTimeStr`, and `wakeTimeStr` must be valid date and time strings.
* `toleranceMins` must be a positive number.

**Effects:**

* If a sleep slot already exists for the user on the given date, it is replaced.
* A new `SleepSlot` is created with the user's target bedtime, wake-up time, and tolerance.
* Adherence flags (`wakeUpSuccess`, `bedTimeSuccess`) are initialized to null.

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

***

### POST /api/SleepSchedule/removeSleepSlot

**Description:** Removes a user's sleep schedule for a specific date.

**Requirements:**

* `dateStr` must be a valid date string.
* A sleep slot must exist for the user on the specified date.

**Effects:**

* The `SleepSlot` record for the user on the given date is deleted.

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

***

### POST /api/SleepSchedule/reportBedTime

**Description:** Records a user's actual bedtime and evaluates adherence against their scheduled target.

**Requirements:**

* `reportedTimeStr` and `dateStr` must be valid date/time strings.
* A sleep slot must exist for the user on the specified date.

**Effects:**

* The `bedTimeSuccess` flag for the sleep slot is set to `true` if the reported time is within the tolerance of the target bedtime, and `false` otherwise.
* Returns the boolean success value.

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

***

### POST /api/SleepSchedule/reportWakeUpTime

**Description:** Records a user's actual wake-up time and evaluates adherence against their scheduled target.

**Requirements:**

* `reportedTimeStr` and `dateStr` must be valid date/time strings.
* A sleep slot must exist for the user on the specified date.

**Effects:**

* The `wakeUpSuccess` flag for the sleep slot is set to `true` if the reported time is within the tolerance of the target wake-up time, and `false` otherwise.
* Returns the boolean success value.

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

***

### POST /api/SleepSchedule/\_getSleepSlot

**Description:** Retrieves the sleep schedule for a user on a specific date.

**Requirements:**

* None.

**Effects:**

* Returns the `SleepSlot` object for the user and date if it exists.

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
{
  "error": "string"
}
```

***

### POST /api/SleepSchedule/\_getAllSleepSlotsForUser

**Description:** Retrieves all sleep schedules for a given user.

**Requirements:**

* None.

**Effects:**

* Returns all `SleepSlot` objects associated with the specified user.

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
{
  "error": "string"
}
```

***
