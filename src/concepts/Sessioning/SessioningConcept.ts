import { Collection, Db } from "npm:mongodb";
import { freshID } from "@utils/database.ts";
import { Empty, ID } from "@utils/types.ts";

// Collection prefix, using the concept name for namespacing.
const PREFIX = "Sessioning" + ".";

// Generic type parameters for the concept.
type User = ID;
type Session = ID;

/**
 * Represents the state for the Sessioning concept.
 *
 * a set of `Session`s with
 *   a `user` User
 */
interface SessionDoc {
  _id: Session;
  user: User;
}

/**
 * @concept Sessioning
 * @purpose To maintain a user's logged-in state across multiple requests without re-sending credentials.
 */
export default class SessioningConcept {
  private readonly sessions: Collection<SessionDoc>;

  constructor(private readonly db: Db) {
    this.sessions = this.db.collection(PREFIX + "sessions");
  }

  /**
   * create (user: User): (session: Session)
   *
   * **requires**: true.
   * **effects**: creates a new Session `s`; associates it with the given `user`; returns `s` as `session`.
   */
  async create({ user }: { user: User }): Promise<{ session: Session }> {
    const newSessionId = freshID() as Session;
    const sessionDoc: SessionDoc = {
      _id: newSessionId,
      user: user,
    };
    await this.sessions.insertOne(sessionDoc);
    return { session: newSessionId };
  }

  /**
   * delete (session: Session): ()
   *
   * **requires**: the given `session` exists.
   * **effects**: removes the session `s`.
   */
  async delete({ session }: { session: Session }): Promise<Empty | { error: string }> {
    const result = await this.sessions.deleteOne({ _id: session });

    if (result.deletedCount === 0) {
      return { error: "Session not found." };
    }

    return {};
  }

  /**
   * _getUser (session: Session): (user: User)
   *
   * **requires**: the given `session` exists.
   * **effects**: returns the user associated with the session.
   */
  async _getUser({ session }: { session: Session }): Promise<{ user: User }[]> {
    const sessionDoc = await this.sessions.findOne({ _id: session });

    if (!sessionDoc) {
      // If the session does not exist, return an empty array as per query conventions.
      return [];
    }

    return [{ user: sessionDoc.user }];
  }
}
