---
timestamp: 'Tue Nov 04 2025 17:03:16 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251104_170316.d1fa87f4.md]]'
content_id: 443e89b6641e8166b414c180c02ed0858bf77cd43d4c570507ddce0fad088bb3
---

# API Specification: PasswordAuth Concept

**Purpose:** limit access to known users and establish point of contact.

***

## API Endpoints

### POST /api/PasswordAuth/register

**Description:** Creates a new user account with a username and password.

**Requirements:**

* No user can already exist with the given `username`.

**Effects:**

* A new user record is created with the provided credentials.
* Returns the unique ID of the new user.

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
  "user": "ID"
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

**Description:** Authenticates a user based on their username and password.

**Requirements:**

* A user must exist with the provided `username` and `password`.

**Effects:**

* If authentication is successful, returns the unique ID of the authenticated user.

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
  "user": "ID"
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

**Description:** Allows an authenticated user to change their password.

**Requirements:**

* A user must exist with the provided `username` and `currentPassword`.

**Effects:**

* The user's password is updated to the `newPassword`.

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

### POST /api/PasswordAuth/deactivateAccount

**Description:** Deletes a user's account.

**Requirements:**

* A user must exist with the provided `username` and `password`.

**Effects:**

* The user's account and all associated authentication data are permanently removed.

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

***

### POST /api/PasswordAuth/\_isRegistered

**Description:** Checks if a username is already registered.

**Requirements:**

* None.

**Effects:**

* Returns `true` if a user exists with the given username, otherwise `false`.

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

### POST /api/PasswordAuth/\_getUsername

**Description:** Retrieves the username for a given user ID.

**Requirements:**

* A user must exist with the given `userId`.

**Effects:**

* Returns the username associated with the user ID.

**Request Body:**

```json
{
  "userId": "ID"
}
```

**Success Response Body (Query):**

```json
[
  {
    "username": "string"
  }
]
```

**Error Response Body:**

```json
[]
```

***

### POST /api/PasswordAuth/\_getUserByUsername

**Description:** Retrieves the user ID for a given username.

**Requirements:**

* A user must exist with the given `username`.

**Effects:**

* Returns the user ID associated with the username.

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
    "user": "ID"
  }
]
```

**Error Response Body:**

```json
[]
```

***
