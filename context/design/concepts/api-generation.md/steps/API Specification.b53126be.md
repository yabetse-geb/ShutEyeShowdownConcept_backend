---
timestamp: 'Mon Oct 20 2025 02:12:16 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_021216.cc8e1c6d.md]]'
content_id: b53126bed459be844fc870bf77b93163710ce7b723d448f8f1b75ddca45b440b
---

# API Specification: SleepSchedule Concept

**Purpose:** Let users set bedtime/wake goals, log sleep and wake events, and record daily adherence (did the user follow their targets).

***

## API Endpoints

### POST /api/SleepSchedule/addSleepSlot

**Description:** Creates a new daily sleep schedule (a "slot") for a user with target bedtime and wake-up times.

**Requirements:**

* `dateStr`, `bedTimeStr`, and `wakeTimeStr` must be valid, parsable date/time strings.
* A `SleepSlot` must not already exist for the given user on the specified date.

**Effects:**

* A new `SleepSlot` is created for the user on the given date with the specified time targets.
* The adherence status (`wakeUpSuccess`, `bedTimeSuccess`) is initialized to null.

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

* The `bedTimeSuccess` status is updated for the user's `SleepSlot` on the given date. Success is true if the reported time is before or at the target bedtime.
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

* The `wakeUpSuccess` status is updated for the user's `SleepSlot`. Success is true if the reported time is within five minutes of the target wake-up time.
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
