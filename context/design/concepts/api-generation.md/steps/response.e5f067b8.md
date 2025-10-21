---
timestamp: 'Mon Oct 20 2025 01:43:55 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_014355.fa9ebe04.md]]'
content_id: e5f067b86092de25d16a431a39cba807753e70b5b9dcc82746aaaeb3036f24ad
---

# response:

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * @concept PasswordAuth
 * @purpose limit access to known users and establish point of contact.
 * @principle after a user registers with username, password, and establishes an email they can authenticate with that same username and password and be treated as the same user.
 *            Can also be contacted with the provided email address. Users can also change their password or email.
 *            Lastly users can "deactivate/delete their account".
 *
 * @invariant no two Users have the same username
 * @invariant Every Credential corresponds to exactly one User with the same username
 * @invariant Every User has at most one Credential
 */

// Declare collection prefix, use concept name
const PREFIX = "PasswordAuth" + ".";

/**
 * A unique identifier for a User.
 */
type UserID = ID;

/**
 * A unique identifier for a Credential.
 */
type CredentialID = ID;

/**
 * A set of Users with
 *   a `username`: String
 *   an `email`: String
 */
interface User {
  _id: UserID;
  username: string;
  email: string;
}

/**
 * A set of Credentials with
 *   a `username`: String
 *   a `password`: String
 *   a `userId`: UserID (reference to the User)
 */
interface Credential {
  _id: CredentialID;
  username: string;
  password: string; // In a real app, this would be hashed.
  userId: UserID;
}

export default class PasswordAuthConcept {
  private users: Collection<User>;
  private credentials: Collection<Credential>;

  constructor(private readonly db: Db) {
    this.users = this.db.collection(PREFIX + "users");
    this.credentials = this.db.collection(PREFIX + "credentials");
  }

  /**
   * register(username:String, password:String, email:String): (user:User)
   *
   * @requires: no User or Credential exists with username
   * @effects:
   *   - adds a new User(username, email) to Users, user
   *   - adds a new Credential(username, password, user) to Credentials
   *   - returns the new User, user
   */
  async register(
    { username, password, email }: { username: string; password: string; email: string },
  ): Promise<{ user: UserID } | { error: string }> {
    // Check precondition: no User or Credential exists with username
    const existingUser = await this.users.findOne({ username });
    if (existingUser) {
      return { error: "Username already taken." };
    }

    const newUserId: UserID = freshID();
    const newCredentialId: CredentialID = freshID();

    await this.users.insertOne({ _id: newUserId, username, email });
    await this.credentials.insertOne({
      _id: newCredentialId,
      username,
      password,
      userId: newUserId,
    });

    return { user: newUserId };
  }

  /**
   * authenticate(username: String, password: String): (user:User)
   *
   * @requires: there exists a Credential with username and password
   * @effects: returns the corresponding user
   */
  async authenticate(
    { username, password }: { username: string; password: string },
  ): Promise<{ user: UserID } | { error: string }> {
    // Check precondition: there exists a Credential with username and password
    const credential = await this.credentials.findOne({ username, password });
    if (!credential) {
      return { error: "Invalid username or password." };
    }

    return { user: credential.userId };
  }

  /**
   * changePassword(username:String, currentPassword:String, newPassword:String)
   *
   * @requires: there exists a Credential c with username and currentPassword
   * @effects: sets c.password to newPassword
   */
  async changePassword(
    { username, currentPassword, newPassword }: {
      username: string;
      currentPassword: string;
      newPassword: string;
    },
  ): Promise<Empty | { error: string }> {
    // Check precondition: there exists a Credential c with username and currentPassword
    const result = await this.credentials.updateOne(
      { username, password: currentPassword },
      { $set: { password: newPassword } },
    );

    if (result.matchedCount === 0) {
      return { error: "Invalid username or current password." };
    }

    return {};
  }

  /**
   * changeEmail(username:String, password:String, newEmail:String)
   *
   * @requires: there exists a Credential c with username and password
   * @effects: sets the email for the User of Credential c to newEmail
   */
  async changeEmail(
    { username, password, newEmail }: {
      username: string;
      password: string;
      newEmail: string;
    },
  ): Promise<Empty | { error: string }> {
    // Check precondition: there exists a Credential c with username and password
    const credential = await this.credentials.findOne({ username, password });
    if (!credential) {
      return { error: "Invalid username or password." };
    }

    // Effect: sets the email for the User of Credential c to newEmail
    const result = await this.users.updateOne(
      { _id: credential.userId },
      { $set: { email: newEmail } },
    );

    if (result.matchedCount === 0) {
      // This case should ideally not happen if credential exists and is valid
      return { error: "Associated user not found, inconsistency detected." };
    }

    return {};
  }

  /**
   * getEmail(username: String): String
   *
   * @requires: there exists a User with the given username
   * @effects: returns the email field of the User with that username
   */
  async _getEmail(
    { username }: { username: string },
  ): Promise<{ email: string } | { error: string }> {
    // Check precondition: there exists a User with the given username
    const user = await this.users.findOne({ username });
    if (!user) {
      return { error: "User not found." };
    }

    // Effect: returns the email field of the User with that username
    return { email: user.email };
  }

  /**
   * isRegistered(username:String): Bool
   *
   * @effects: returns true if a User exists with the given username, otherwise false
   */
  async _isRegistered(
    { username }: { username: string },
  ): Promise<{ isRegistered: boolean }> {
    const user = await this.users.findOne({ username });
    return { isRegistered: !!user };
  }

  /**
   * deactivateAccount(username:String, password:String):
   *
   * @requires: there exists a Credential c with username and password
   * @effects: remove the Credential with username and removes the User with username
   */
  async deactivateAccount(
    { username, password }: { username: string; password: string },
  ): Promise<Empty | { error: string }> {
    // Check precondition: there exists a Credential c with username and password
    const credential = await this.credentials.findOne({ username, password });
    if (!credential) {
      return { error: "Invalid username or password." };
    }

    // Effects: remove the Credential and the associated User
    await this.credentials.deleteOne({ _id: credential._id });
    await this.users.deleteOne({ _id: credential.userId });

    return {};
  }
}
```
