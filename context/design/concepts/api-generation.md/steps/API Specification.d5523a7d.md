---
timestamp: 'Mon Oct 20 2025 01:45:01 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_014501.b2fb4428.md]]'
content_id: d5523a7d343f208108ccdff737a7831f227a134df328f6b283ec2b07b2ddb844
---

# API Specification: PasswordAuth Concept

**Purpose:** Limit access to known users and establish a point of contact for authentication and communication.

***

## API Endpoints

### POST /api/PasswordAuth/register

**Description:** Creates a new user account with a username, password, and email.

**Requirements:**

* The `username` must not already be taken by an existing user.

**Effects:**

* A new `User` record is created with the given username and email.
* A new `Credential` record is created, linking the username to the password and the new user.
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

**Description:** Authenticates a user with their username and password.

**Requirements:**

* A `Credential` record must exist that matches the provided `username` and `password`.

**Effects:**

* If authentication is successful, returns the corresponding user's ID.

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

**Description:** Allows a user to change their password.

**Requirements:**

* A `Credential` record must exist that matches the `username` and `currentPassword`.

**Effects:**

* The password for the specified user is updated to the `newPassword`.

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

**Description:** Allows an authenticated user to change their email address.

**Requirements:**

* A `Credential` record must exist that matches the provided `username` and `password`.

**Effects:**

* The email address for the specified user is updated to `newEmail`.

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

### POST /api/PasswordAuth/getEmail

**Description:** Retrieves the email address for a given username.

**Requirements:**

* A `User` record with the given `username` must exist.

**Effects:**

* Returns the email address associated with the user.

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

### POST /api/PasswordAuth/isRegistered

**Description:** Checks if a username is already registered.

**Requirements:**

* None.

**Effects:**

* Returns `true` if a `User` with the given `username` exists, otherwise `false`.

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

* A `Credential` record must exist that matches the provided `username` and `password`.

**Effects:**

* The `Credential` record for the user is removed.
* The `User` record for the user is removed.

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
