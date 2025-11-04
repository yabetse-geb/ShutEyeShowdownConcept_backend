---
timestamp: 'Mon Nov 03 2025 17:23:02 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_172302.5ebb3032.md]]'
content_id: 0f9e738077ace4b1a8b461ab7421d695ef79a87e1dc9d9a1a94dbb45acc1df9f
---

# API Specification: PasswordAuth Concept

**Purpose:** limit access to known users and establish point of contact.

***

## API Endpoints

### POST /api/PasswordAuth/register

**Description:** Creates a new user account with a username and password.

**Requirements:**

* No User exists with the provided `username`.

**Effects:**

* Adds a new User with the given username and password to the system.
* Returns the unique ID of the new User.

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

### POST /api/PasswordAuth/authenticate

**Description:** Authenticates a user with their username and password.

**Requirements:**

* A User must exist with the provided `username` and `password`.

**Effects:**

* Returns the corresponding user's unique ID.

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

* A User must exist with the provided `username` and `currentPassword`.

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

### POST /api/PasswordAuth/\_isRegistered

**Description:** Checks if a username is already registered in the system.

**Requirements:**

* None.

**Effects:**

* Returns `true` if a User exists with the given username, otherwise `false`.

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

**Description:** Deletes a user's account from the system.

**Requirements:**

* A User must exist with the provided `username` and `password`.

**Effects:**

* The User with the matching username and password is removed.

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
