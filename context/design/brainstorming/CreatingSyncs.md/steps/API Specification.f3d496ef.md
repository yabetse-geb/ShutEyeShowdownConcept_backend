---
timestamp: 'Tue Nov 04 2025 17:03:16 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251104_170316.d1fa87f4.md]]'
content_id: f3d496ef58e92545b8c5bb7c0e56794701fbc931801254fb4835b07ac5849b46
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
[]
```

***
