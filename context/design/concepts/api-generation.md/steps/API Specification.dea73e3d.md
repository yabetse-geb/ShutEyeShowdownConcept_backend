---
timestamp: 'Mon Oct 27 2025 13:08:50 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251027_130850.086ab97c.md]]'
content_id: dea73e3d04ff548d751bb4b4c1f8a540f5983e94c5f816bdbbaa75ca0bc0eed3
---

# API Specification: SleepSchedule Concept

**Purpose:** Let users set bedtime/wake goals, log sleep and wake events, and record daily adherence (did the user follow their targets).

***

## API Endpoints

### POST /api/SleepSchedule/addSleepSlot

**Description:** Creates a new daily sleep schedule for a user with target bedtime and wake-up times.

**Requirements:**

* `dateStr`, `bedTimeStr`, and `wakeTimeStr` must be valid strings parseable into `Date` and `Time` objects respectively.
* There doesn't already exist a `SleepSlot` for the user `u` on the parsed `date`.

**Effects:**

* Parses the date and time strings.
* Creates a new `SleepSlot` for the user on the specified date with the target times.
* Initializes `wakeUpSuccess` and `bedTimeSuccess` to `null`.

**Request Body:**

```json
{
  "u": "string",
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

* `dateStr` must be a valid date string parseable into a `Date`.
* A `SleepSlot` must exist for user `u` on the parsed `date`.

**Effects:**

* Parses `dateStr` into a `Date` object.
* Removes the `SleepSlot` for the user on that date.

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

**Description:** Records a user's actual bedtime and evaluates whether they met their target.

**Requirements:**

* `reportedTimeStr` and `dateStr` must be valid strings parseable into `Time` and `Date` objects respectively.
* A `SleepSlot` with user `u` and the parsed `date` must exist.

**Effects:**

* Sets `bedTimeSuccess` for the `SleepSlot` based on whether the `reportedTime` is within the defined tolerance of the target `bedTime`.
* Returns the calculated `bedTimeSuccess` status.

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

**Description:** Records a user's actual wake-up time and evaluates whether they met their target.

**Requirements:**

* `reportedTimeStr` and `dateStr` must be valid strings parseable into `Time` and `Date` objects respectively.
* A `SleepSlot` with user `u` and the parsed `date` must exist.

**Effects:**

* Sets `wakeUpSuccess` for the `SleepSlot` based on whether the `reportedTime` is within the defined tolerance of the target `wakeUpTime`.
* Returns the calculated `wakeUpSuccess` status.

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

* Returns the sleep slot for the given user and date, if it exists.

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

**Description:** Retrieves all sleep schedules for a specific user.

**Requirements:**

* None

**Effects:**

* Returns an array of all sleep slots associated with the given user.

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
