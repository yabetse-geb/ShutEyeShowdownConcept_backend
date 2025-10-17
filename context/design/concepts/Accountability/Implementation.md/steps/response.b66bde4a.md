---
timestamp: 'Thu Oct 16 2025 11:15:28 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_111528.b060210f.md]]'
content_id: b66bde4a1ba957548a9bb3da4c82d3e4dc72fd43c0bd1c64a40aeaa57798f1a6
---

# response:

To ensure concepts are independent, the key principles highlighted in the "Concept Design Background" are crucial:

1. **No direct dependencies on other concepts:** A concept should not import, reference, or directly interact with the internal state or specific methods of another concept class. It should manage its own state and provide its own complete set of actions and queries for its single purpose.
2. **Generic Parameters:** Concepts must work off generic parameters (e.g., `User`, `Item`, `Target` as `ID`s). They cannot assume specific properties or internal structures of these types. They only treat them as opaque identifiers that can be compared for equality. This forces loose coupling.
3. **Clear, User-Relevant Purpose & Encapsulated State:** Each concept has a single, well-defined, user-centric purpose. Its state should be entirely dedicated to fulfilling this purpose, avoiding aggregation of data that belongs to other concerns. This "separation of concerns" prevents a single concept from becoming a monolithic entity that implicitly depends on, or dictates, the behavior of other parts of the system.

In practice, for the TypeScript implementation guidelines provided:

* **No `import` statements referencing another concept class.**
* **State is prefixed** with the concept name (e.g., `Accountability.partnerships`, `Accountability.adherenceFailures`) to ensure unique collection names in the shared database, preventing direct state clashes.
* **Generic IDs (`ID` type)** are used for external entities, enforcing polymorphism and preventing type-specific assumptions.
* **Methods return generic dictionary objects or errors**, rather than custom concept-specific objects from other concepts.

By adhering strictly to these rules, concepts remain self-contained, testable in isolation, and can be composed flexibly without creating tight, brittle dependencies.

***

### Implementation of Accountability Concept (addPartner and removePartner actions)

**# file: src/Accountability/AccountabilityConcept.ts**

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "../../utils/types.ts"; // Adjust path as necessary for your project
import { freshID } from "../../utils/database.ts"; // Adjust path as necessary for your project

// Declare collection prefix, use concept name
const PREFIX = "Accountability" + ".";

// Generic types of this concept
type User = ID;

// --- Types from concept specification ---

/**
 * An enumeration representing the type of sleep event.
 */
enum SleepEventType {
  BEDTIME = "BEDTIME",
  WAKETIME = "WAKETIME",
}

/**
 * An enumeration representing the frequency of reports.
 */
enum FrequencyType {
  Immediate = "Immediate",
  Daily = "Daily",
  Weekly = "Weekly",
}

/**
 * Alias for SleepEventType for clarity as per notifyTypes in the state.
 */
type FailureType = SleepEventType;

/**
 * Represents a partnership between two users, including notification preferences.
 * Corresponds to "a set of Partnerships" in the concept state.
 */
interface PartnershipDoc {
  _id: ID; // Unique ID for this partnership record
  user: User;
  partner: User;
  notifyTypes: FailureType[]; // Default to empty array if not specified
  reportFrequency: FrequencyType; // Default to Immediate if not specified
  lastReportDate: Date | null; // Null initially as per concept spec
}

/**
 * Represents a recorded adherence failure for a user.
 * Corresponds to "a set of AdherenceFailures" in the concept state.
 */
interface AdherenceFailureDoc {
  _id: ID; // Unique ID for this failure record
  failingUser: User;
  date: string; // Stored as a string (e.g., "YYYY-MM-DD")
  failType: SleepEventType;
  reported: boolean;
}

/**
 * Accountability concept
 * purpose: Record accountability partnerships between users and their associated notification preferences.
 * The concept does not send messages or access contact information — it only stores user IDs and preference data.
 */
export default class AccountabilityConcept {
  partnerships: Collection<PartnershipDoc>;
  adherenceFailures: Collection<AdherenceFailureDoc>;

  constructor(private readonly db: Db) {
    this.partnerships = this.db.collection(PREFIX + "partnerships");
    this.adherenceFailures = this.db.collection(PREFIX + "adherenceFailures");
    this._initializeIndexes();
  }

  /**
   * Private method to initialize MongoDB indexes.
   * Ensures that a unique partnership exists for a given (user, partner) pair.
   */
  private async _initializeIndexes() {
    // Ensures that a user can only have one partnership with a specific partner.
    // The index is on `user` and `partner` fields, with a `unique: true` constraint.
    await this.partnerships.createIndex({ user: 1, partner: 1 }, { unique: true });
  }

  /**
   * addPartner action
   * @param {object} params - The action parameters.
   * @param {User} params.user - The ID of the user initiating the partnership.
   * @param {User} params.partner - The ID of the user being partnered with.
   * @returns {Promise<Empty | { error: string }>} An empty object on success, or an error object.
   *
   * requires: user and partner are not equal and (user, partner) is not in Partnerships
   * effects: add (user, partner, notifyTypes, reportFrequency, null) to Partnerships
   */
  async addPartner({ user, partner }: { user: User; partner: User }): Promise<Empty | { error: string }> {
    // Requires check 1: user and partner are not equal
    if (user === partner) {
      return { error: "A user cannot partner with themselves." };
    }

    // Requires check 2: (user, partner) is not in Partnerships
    // The unique index handles this implicitly, but checking beforehand provides a cleaner error message.
    const existingPartnership = await this.partnerships.findOne({ user, partner });
    if (existingPartnership) {
      return { error: `Partnership already exists between user '${user}' and partner '${partner}'.` };
    }

    // Effects: add new partnership to Partnerships
    // Default values for notifyTypes and reportFrequency are set.
    const newPartnership: PartnershipDoc = {
      _id: freshID(), // Generate a unique ID for this partnership document
      user,
      partner,
      notifyTypes: [], // Default: no specific failure types to notify for initially
      reportFrequency: FrequencyType.Immediate, // Default: immediate reporting
      lastReportDate: null, // As specified in the concept
    };

    try {
      await this.partnerships.insertOne(newPartnership);
      return {}; // Success
    } catch (e: any) {
      // In case of a rare race condition or other database error not caught by findOne.
      if (e.code === 11000) { // MongoDB duplicate key error code
         return { error: `Partnership already exists between user '${user}' and partner '${partner}'.` };
      }
      return { error: `Failed to add partner: ${e.message}` };
    }
  }

  /**
   * removePartner action
   * @param {object} params - The action parameters.
   * @param {User} params.user - The ID of the user whose partnership is being removed.
   * @param {User} params.partner - The ID of the partner to be removed.
   * @returns {Promise<Empty | { error: string }>} An empty object on success, or an error object.
   *
   * requires: (user, partner) in Partnerships
   * effects: remove the pairing user, partner in Partnerships
   */
  async removePartner({ user, partner }: { user: User; partner: User }): Promise<Empty | { error: string }> {
    // Requires check: (user, partner) in Partnerships
    const deleteResult = await this.partnerships.deleteOne({ user, partner });

    // If no document was deleted, it means the partnership did not exist.
    if (deleteResult.deletedCount === 0) {
      return { error: `Partnership between user '${user}' and partner '${partner}' not found.` };
    }

    // Effects: partnership removed
    return {}; // Success
  }
}
```
