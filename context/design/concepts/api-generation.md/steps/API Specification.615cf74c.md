---
timestamp: 'Mon Oct 20 2025 01:45:01 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_014501.b2fb4428.md]]'
content_id: 615cf74c8dcadce990c0ce7ced289cfb8a78f047ab212aee17a6fb9f9c9e3b72
---

# API Specification: SleepSchedule Concept

**Purpose:** Let users set bedtime/wake goals, log sleep and wake events, and record daily adherence (did the user follow their targets).

***

## API Endpoints

### POST /api/SleepSchedule/addSleepSlot

**Description:** Creates a new daily sleep schedule (a "sleep slot") for a user with specific bedtime and wake-up targets.

**Requirements:**

* All input strings (`dateStr`, `bedTimeStr`, `wakeTimeStr`) must be valid and parseable.
* A sleep slot must not already exist for the user on the specified date.

**Effects:**

* Creates a new `SleepSlot` record for the user on the given date, storing the target bedtime and wake-up time.
* The `wakeUpSuccess` and `bedTimeSuccess` fields are initialized to `null`.

**Request Body:**

```json
{
  "u": "ID",
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

**Description:** Deletes a user's sleep schedule for a specific date.

**Requirements:**

* The `dateStr` must be a valid date string.
* A `SleepSlot` must exist for the user on the specified date.

**Effects:**

* The `SleepSlot` record for the user on the specified date is removed from the database.

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

**Description:** Records a user's actual bedtime and evaluates if it met the scheduled target.

**Requirements:**

* `reportedTimeStr` and `dateStr` must be valid time/date strings.
* A `SleepSlot` must exist for the user on the specified `dateStr`.

**Effects:**

* The `bedTimeSuccess` field of the corresponding `SleepSlot` is updated to `true` if the reported time was on or before the target bedtime, and `false` otherwise.
* Returns the boolean success status.

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

**Description:** Records a user's actual wake-up time and evaluates if it met the scheduled target.

**Requirements:**

* `reportedTimeStr` and `dateStr` must be valid time/date strings.
* A `SleepSlot` must exist for the user on the specified `dateStr`.

**Effects:**

* The `wakeUpSuccess` field of the corresponding `SleepSlot` is updated to `true` if the reported time was within five minutes of the target wake-up time, and `false` otherwise.
* Returns the boolean success status.

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
