---
timestamp: 'Tue Nov 04 2025 15:16:31 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251104_151631.7617a424.md]]'
content_id: 9c10c7b014563e916293af88c837dad6a4d79201ee153a1f70448f26889447e4
---

# API Specification: Sessioning Concept

**Purpose:** To maintain a user's logged-in state across multiple requests without re-sending credentials.

***

## API Endpoints

### POST /api/Sessioning/create

**Description:** Creates a new session for an authenticated user.

**Requirements:**

* None.

**Effects:**

* A new session is created and associated with the provided user ID.
* Returns the unique ID of the new session.

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

***

### POST /api/Sessioning/delete

**Description:** Deletes a session, effectively logging the user out.

**Requirements:**

* The provided session must exist.

**Effects:**

* The session record is removed.

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

***

### POST /api/Sessioning/\_getUser

**Description:** Retrieves the user ID associated with a given session.

**Requirements:**

* The provided session must exist.

**Effects:**

* Returns the user ID linked to the session.

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
{
  "error": "string"
}
```

***
