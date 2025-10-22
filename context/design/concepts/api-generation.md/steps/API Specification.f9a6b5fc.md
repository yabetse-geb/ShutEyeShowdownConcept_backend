---
timestamp: 'Tue Oct 21 2025 16:34:38 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_163438.27443f2b.md]]'
content_id: f9a6b5fc9b63ba4267f2b09c5d3dc11e261765325b2d7931131cc4b6c4e11b67
---

# API Specification: PasswordAuth Concept

**Purpose:** Limit access to known users and establish a point of contact.

***

## API Endpoints

### POST /api/PasswordAuth/register

**Description:** Creates a new user account with a username, password, and email.

**Requirements:**

* The chosen `username` must not already be in use.

**Effects:**

* A new `User` and a corresponding `Credential` record are created.
* Returns the ID of the newly created user.

**Request Body:**

```json
{
  "username": "string",
  "password": "string",
  "email": "string"
}
```

**Success Response Body (Action):**

```json
{
  "user": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/PasswordAuth/authenticate

**Description:** Authenticates a user with their username and password.

**Requirements:**

* A `Credential` must exist that matches the provided `username` and `password`.

**Effects:**

* If authentication is successful, returns the corresponding user ID.

**Request Body:**

```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response Body (Action):**

```json
{
  "user": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/PasswordAuth/changePassword

**Description:** Changes a user's password after verifying their current password.

**Requirements:**

* A `Credential` must exist that matches the provided `username` and `currentPassword`.

**Effects:**

* The user's password is updated to `newPassword`.

**Request Body:**

```json
{
  "username": "string",
  "currentPassword": "string",
  "newPassword": "string"
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

### POST /api/PasswordAuth/changeEmail

**Description:** Changes the email address associated with a user's account.

**Requirements:**

* A `Credential` must exist that matches the provided `username` and `password`.

**Effects:**

* The `email` field of the corresponding `User` record is updated to `newEmail`.

**Request Body:**

```json
{
  "username": "string",
  "password": "string",
  "newEmail": "string"
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

### POST /api/PasswordAuth/\_getEmail

**Description:** Retrieves the email address for a given username.

**Requirements:**

* A user with the given `username` must exist.

**Effects:**

* Returns the email address of the specified user.

**Request Body:**

```json
{
  "username": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "email": "string"
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

### POST /api/PasswordAuth/\_isRegistered

**Description:** Checks if a username is already registered.

**Requirements:**

* None.

**Effects:**

* Returns `true` if a user exists with the given `username`, otherwise returns `false`.

**Request Body:**

```json
{
  "username": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "isRegistered": "boolean"
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

### POST /api/PasswordAuth/deactivateAccount

**Description:** Deletes a user's account and all associated credentials.

**Requirements:**

* A `Credential` must exist that matches the provided `username` and `password`.

**Effects:**

* The `User` record and the `Credential` record for the specified user are permanently removed.

**Request Body:**

```json
{
  "username": "string",
  "password": "string"
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
