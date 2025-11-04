---
timestamp: 'Tue Nov 04 2025 15:16:31 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251104_151631.7617a424.md]]'
content_id: fa3c3708e996f3dc2ace0d64d7cb55a84cbcbd747c94521105419c808f839170
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
{
  "error": "string"
}
```

***
