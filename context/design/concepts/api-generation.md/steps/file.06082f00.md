---
timestamp: 'Mon Nov 03 2025 17:22:45 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_172245.54c5266e.md]]'
content_id: 06082f001dec74e3d6a10b23d21ae902194cc29964e39238bf8349eeac5cc306
---

# file: src/PasswordAuth/PasswordAuthConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * @concept PasswordAuth [User]
 * @purpose limit access to known users and establish point of contact.
 * @principle after a user registers with username and password they can authenticate with that same username and password and be treated as the same user. Users can also change their password and "deactivate/delete their account".
 * @invariant no two Users have the same username
 */

// Declare collection prefix, use concept name
const PREFIX = "PasswordAuth" + ".";

/**
 * A unique identifier for a User. This is a generic parameter for the concept.
 */
type UserID = ID;

/**
 * A set of Users with
 *   a `username`: String
 *   a `password`: String
 */
interface User {
  _id: UserID;
  username: string;
  password: string; // In a real application, this should be a securely hashed password.
}

export default class PasswordAuthConcept {
  private users: Collection<User>;

  constructor(private readonly db: Db) {
    this.users = this.db.collection(PREFIX + "users");
  }

  /**
   * register(username:String, password:String): (user:User)
   *
   * @requires no User exists with username
   * @effects
   *   - adds a new User(username, password) to Users, user
   *   - returns the new User's ID, user
   */
  async register(
    { username, password }: { username: string; password: string },
  ): Promise<{ user: UserID } | { error: string }> {
    // Requires: no User exists with username
    const existingUser = await this.users.findOne({ username });
    if (existingUser) {
      return { error: "Username already exists." };
    }

    // Effects: adds a new User and returns their ID
    const newUserId: UserID = freshID();
    await this.users.insertOne({
      _id: newUserId,
      username,
      password,
    });

    return { user: newUserId };
  }

  /**
   * authenticate(username: String, password: String): (user:User)
   *
   * @requires there exists a User with username and password
   * @effects returns the corresponding user's ID
   */
  async authenticate(
    { username, password }: { username: string; password: string },
  ): Promise<{ user: UserID } | { error: string }> {
    // Requires: there exists a User with username and password
    const user = await this.users.findOne({ username, password });
    if (!user) {
      return { error: "Invalid username or password." };
    }

    // Effects: returns the corresponding user's ID
    return { user: user._id };
  }

  /**
   * changePassword(username:String, currentPassword:String, newPassword:String)
   *
   * @requires there exists a User u with username and currentPassword
   * @effects sets u.password to newPassword
   */
  async changePassword(
    { username, currentPassword, newPassword }: {
      username: string;
      currentPassword: string;
      newPassword: string;
    },
  ): Promise<Empty | { error: string }> {
    // Requires: there exists a User u with username and currentPassword
    const result = await this.users.updateOne(
      { username, password: currentPassword },
      { $set: { password: newPassword } },
    );

    if (result.matchedCount === 0) {
      return { error: "Invalid username or current password." };
    }

    return {};
  }

  /**
   * _isRegistered(username:String): (isRegistered: boolean)
   *
   * @effects returns true if a User exists with the given username, otherwise false
   */
  async _isRegistered(
    { username }: { username: string },
  ): Promise<Array<{ isRegistered: boolean }>> {
    const user = await this.users.findOne({ username });
    return { isRegistered: !!user };
  }

  /**
   * deactivateAccount(username:String, password:String)
   *
   * @requires there exists a User u with username and password
   * @effects removes the User with username and password
   */
  async deactivateAccount(
    { username, password }: { username: string; password: string },
  ): Promise<Empty | { error: string }> {
    // Requires: there exists a User u with username and password
    const result = await this.users.deleteOne({ username, password });

    if (result.deletedCount === 0) {
      return { error: "Invalid username or password." };
    }

    return {};
  }
}
```

## API Endpoints

### POST /api/Accountability/\_getAccountabilitySeekersForUser

**Description:** Retrieves the list of users who have designated the given mentor as their partner.

**Requirements:**

* `mentor` must be a valid user ID.

**Effects:**

* Returns the list of `user` IDs from `Partnerships` where `{ partner: mentor }`.

**Request Body:**

```json
{
  "mentor": "string"
}
```

**Success Response Body (Query):**

```json
[
  "string"
]
```

**Error Response Body:**

````json
{
  "error": "string"
}

### POST /api/Accountability/addPartner

**Description:** Creates a new accountability partnership between two users with specified notification settings.

**Requirements:**
- The `user` and `partner` must not be the same.
- A partnership between this `user` and `partner` must not already exist.

**Effects:**
- A new `Partnership` record is created with the given `user`, `partner`, `notifyTypes`, `reportFrequency`, and a `lastReportDate` of null.
 - A new `Reports` record is created with `(user: partner, accountabilitySeeker: user, allReports: [])`.

**Request Body:**
```json
{
  "user": "string",
  "partner": "string",
  "notifyTypes": ["string"],
  "reportFrequency": "string"
}
````

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

### POST /api/Accountability/\_getAllReports

**Description:** Retrieves the stored list of report strings for a given `(user, accountabilitySeeker)` pair.

**Requirements:**

* Both `user` and `accountabilitySeeker` must be valid user IDs.

**Effects:**

* Looks up the `Reports` document where `{ user, accountabilitySeeker }` and returns `allReports` (empty list if none).

**Request Body:**

```json
{
  "user": "string",
  "accountabilitySeeker": "string"
}
```

**Success Response Body (Query):**

```json
[
  "string"
]
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/Accountability/removePartner

**Description:** Removes an existing accountability partnership.

**Requirements:**

* A partnership must exist between the given `user` and `partner`.

**Effects:**

* The `Partnership` record matching the `user` and `partner` is removed.
* The corresponding `Reports` record with `(user: partner, accountabilitySeeker: user)` is removed.

**Request Body:**

```json
{
  "user": "string",
  "partner": "string"
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

### POST /api/Accountability/updatePreferences

**Description:** Updates the notification settings for an existing partnership.

**Requirements:**

* A partnership must exist between the given `user` and `partner`.

**Effects:**

* The `notifyTypes` and `reportFrequency` of the existing partnership are updated to the new values.

**Request Body:**

```json
{
  "user": "string",
  "partner": "string",
  "notifyTypes": ["string"],
  "reportFrequency": "string"
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

### POST /api/Accountability/recordFailure

**Description:** Records a specific instance of an adherence failure for a user on a given date.

**Requirements:**

* The `date` string must be in a parsable format (e.g., YYYY-MM-DD).
* The exact same failure (user, date, type) must not already be recorded.

**Effects:**

* A new `AdherenceFailure` record is created for the user with the specified date and failure type.

**Request Body:**

```json
{
  "user": "string",
  "date": "string",
  "failureType": "string"
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

### POST /api/Accountability/reportAllFailuresFromStartToEnd

**Description:** Generates a summary string of all unreported adherence failures for a user within a specified date range.

**Requirements:**

* `startDate` and `endDate` must be valid, parsable date strings.
* `startDate` must be on or before `endDate`.

**Effects:**

* Finds all unreported adherence failures for the user between the start and end dates.
* Returns a string listing each failure, or a message indicating no failures were found.

**Request Body:**

```json
{
  "user": "string",
  "startDate": "string",
  "endDate": "string"
}
```

**Success Response Body (Action):**

```json
{
  "report": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/Accountability/updateReports

**Description:** Generates failure summaries per partnership based on reporting preferences, marks included failures as reported, updates lastReportDate, and appends each summary to the corresponding Reports document.

**Requirements:**

* The user must have at least one active partnership.
* The `date` string must be a valid, parsable date.

**Effects:**

* For each of the user's partnerships, checks if a report is due based on `reportFrequency` (Immediate/Daily/Weekly).
* Compiles relevant unreported failures into a summary string when due.
* Marks those failures as reported.
* Updates the partnership's `lastReportDate`.
* Appends the summary string to `Reports.allReports` for the document with `(user: partner, accountabilitySeeker: user)` (created if missing).

**Request Body:**

```json
{
  "user": "string",
  "date": "string"
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

### POST /api/Accountability/\_getPartnerships

**Description:** Retrieves all partnerships associated with a user, where they are either the primary user or the partner.

**Requirements:**

* (None)

**Effects:**

* Returns an array of all `Partnership` objects where the specified user is either the `user` or the `partner`.

**Request Body:**

```json
{
  "user": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "_id": "string",
    "user": "string",
    "partner": "string",
    "notifyTypes": ["string"],
    "reportFrequency": "string",
    "lastReportDate": "string"
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
