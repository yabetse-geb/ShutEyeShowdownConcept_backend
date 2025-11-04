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
    return [{ isRegistered: !!user }];
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



    /**
   * _getUsername(userId: UserID): { username: string }
   * @requires: there exists a User with the given userId
   * @effects: returns the username field of the User with that _id or empty list if no such user exists
   */
  async _getUsername(
    { userId }: { userId: UserID },
  ): Promise<Array<{ username: string }>> {
    const user = await this.users.findOne({ _id: userId });
    if (!user) {
      return [];
    }
    return [{ username: user.username }];
  }

    /**
   * _getUserByUsername (username: String): (user: User)
   *
   * **requires**: a User with the given `username` exists.
   * **effects**: returns the corresponding User.
   */
  async _getUserByUsername({ username }: { username: string }): Promise<{ user: User }[]> {
    const user = await this.users.findOne({ username });
    if (user) {
      return [{ user: user._id }];
    }
    // As per specification, queries must return an array.
    return [];
  }
}
