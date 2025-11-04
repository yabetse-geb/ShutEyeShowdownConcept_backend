---
timestamp: 'Mon Nov 03 2025 17:22:45 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_172245.54c5266e.md]]'
content_id: c7069ca72128a4f640e76035be25bba652dc88b2ba2dee1a7b022fd94a2ef22d
---

# API Specification: SleepSchedule Concept

**Purpose:** Let users set bedtime/wake goals, log sleep and wake events, and record daily adherence (did the user follow their targets).

***

## API Endpoints

### POST /api/SleepSchedule/addSleepSlot

**Description:** Creates a new daily sleep schedule (a "slot") for a user with target bedtime and wake-up times.

**Requirements:**

* `dateStr`, `bedTimeStr`, and `wakeTimeStr` must be valid, parsable date/time strings.
* `toleranceMins` must be a positive number.

**Effects:**

* If a `SleepSlot` already exists for the given user on the specified date, it is removed first.
* A new `SleepSlot` is created for the user on the given date with the specified time targets and tolerance.
* The adherence status (`wakeUpSuccess`, `bedTimeSuccess`) is initialized to null.

**Request Body:**

```json
{
  "u": "string",
  "bedTimeStr": "string",
  "wakeTimeStr": "string",
  "dateStr": "string",
  "toleranceMins": "number"
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

* `dateStr` must be a valid, parsable date string.
* A `SleepSlot` must exist for the user on the specified date.

**Effects:**

* The `SleepSlot` for the user on the given date is removed from the system.

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

***

### POST /api/SleepSchedule/reportBedTime

**Description:** Records the actual time a user went to bed and determines if they met their goal.

**Requirements:**

* `reportedTimeStr` and `dateStr` must be valid date/time strings.
* A `SleepSlot` must exist for the user on the specified date.

**Effects:**

* The `bedTimeSuccess` status is updated for the user's `SleepSlot` on the given date. Success is true if the absolute difference between the reported time and target bedtime is within the tolerance (toleranceMins) specified in the SleepSlot.
* Returns the boolean success status.

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

***

### POST /api/SleepSchedule/reportWakeUpTime

**Description:** Records the actual time a user woke up and determines if they met their goal.

**Requirements:**

* `reportedTimeStr` and `dateStr` must be valid date/time strings.
* A `SleepSlot` must exist for the user on the specified date.

**Effects:**

* The `wakeUpSuccess` status is updated for the user's `SleepSlot`. Success is true if the absolute difference between the reported time and target wake-up time is within the tolerance (toleranceMins) specified in the SleepSlot.
* Returns the boolean success status.

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

***

### POST /api/SleepSchedule/\_getSleepSlot

**Description:** Retrieves the sleep schedule for a user on a specific date.

**Requirements:**

* `dateStr` must be a valid date string.

**Effects:**

* Returns the `SleepSlot` object for the user and date if one exists.

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

* The user must exist.

**Effects:**

* Returns an array of all `SleepSlot` objects associated with the user.

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
