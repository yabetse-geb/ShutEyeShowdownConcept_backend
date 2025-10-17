---
timestamp: 'Thu Oct 16 2025 10:29:03 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_102903.4c51c470.md]]'
content_id: 709c768d3b00d81ad673b5b603258492a067ca73d6c561736ab4582143eb30c0
---

# response:

```typescript
import { Collection, Db, IndexOptions } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "Accountability" + ".";

// Generic types of this concept
type User = ID;
type FailureID = ID; // Using ID as a generic placeholder for unique failure identifiers
type SleepEventType = "BEDTIME" | "WAKETIME"; // Or could be a generic type parameter if preferred, but string literal is specific here.

// State interfaces
// ---------------------------------------------------------------------------------------------------------------------

/**
 * a set of Partnerships with
 *   a user:User
 *   a partner:User
 */
interface PartnershipDoc {
  _id: ID; // Unique identifier for this partnership record
  user: User;
  partner: User;
}

/**
 * a set of AdherenceFailures with
 *   an id: FailureID (a unique identifier for each distinct failure record)
 *   a failingUser: User
 *   a date: Date
 *   a timestamp: Timestamp (when the failure was recorded)
 */
interface AdherenceFailureDoc {
  _id: FailureID; // The unique ID for the failure itself
  failingUser: User;
  date: string; // Storing date as string (e.g., "YYYY-MM-DD") for simplicity, as time components are ignored.
  timestamp: Date; // Actual JS Date object for recording when the failure was logged.
}

/**
 * a set of NotificationsSent with
 *   a failureId: FailureID (references an `AdherenceFailure`)
 *   a partner: User (the specific partner for whom the notification was generated)
 *   a timestamp: Timestamp (when this specific notification request was generated)
 */
interface NotificationSentDoc {
  _id: ID; // Unique ID for this specific notification event (e.g., failureId + partner + timestamp hash)
  failureId: FailureID;
  partner: User;
  timestamp: Date;
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * **concept** Accountability [User, FailureID]
 *
 * **purpose** Facilitate informing designated accountability partners about recorded adherence failures
 * of a user for a specific date, by generating notification requests for those partners that can be
 * processed by an external service.
 *
 * **principle** After a user designates a partner, whenever an adherence failure is recorded for a date,
 * the system will identify all relevant partners and generate a distinct, traceable notification request
 * for each, containing details of the failure. These requests are then available for an external
 * notification service to consume and deliver.
 */
export default class AccountabilityConcept {
  partnerships: Collection<PartnershipDoc>;
  adherenceFailures: Collection<AdherenceFailureDoc>;
  notificationsSent: Collection<NotificationSentDoc>;

  constructor(private readonly db: Db) {
    this.partnerships = this.db.collection(PREFIX + "partnerships");
    this.adherenceFailures = this.db.collection(PREFIX + "adherenceFailures");
    this.notificationsSent = this.db.collection(PREFIX + "notificationsSent");

    // Ensure unique compound index for partnerships to enforce (user, partner) uniqueness
    const partnershipIndexOptions: IndexOptions = { unique: true, name: "unique_user_partner_pair" };
    this.partnerships.createIndex({ user: 1, partner: 1 }, partnershipIndexOptions)
      .catch(console.error); // Log any errors during index creation
  }

  /**
   * **action** addPartner(user: User, partner: User)
   *
   * **requires**: `user != partner` and `(user, partner)` is not in `Partnerships`
   * **effects**: Add `(user, partner)` to `Partnerships`
   */
  async addPartner({ user, partner }: { user: User; partner: User }): Promise<Empty | { error: string }> {
    // Requires: user and partner are not equal
    if (user === partner) {
      return { error: "User cannot be their own accountability partner." };
    }

    // Requires: (user, partner) is not in Partnerships
    const existingPartnership = await this.partnerships.findOne({ user, partner });
    if (existingPartnership) {
      return { error: `Partnership already exists between ${user} and ${partner}.` };
    }

    // Effects: Add (user, partner) to Partnerships
    try {
      const newPartnership: PartnershipDoc = {
        _id: freshID(),
        user,
        partner,
      };
      await this.partnerships.insertOne(newPartnership);
      return {};
    } catch (e) {
      // Catch potential database errors, e.g., race conditions if index creation failed
      console.error("Error adding partner:", e);
      return { error: "Failed to add partner due to a database error." };
    }
  }

  /**
   * **action** removePartner(user: User, partner: User)
   *
   * **requires**: `(user, partner)` is in `Partnerships`
   * **effects**: Remove `(user, partner)` from `Partnerships`
   */
  async removePartner({ user, partner }: { user: User; partner: User }): Promise<Empty | { error: string }> {
    // Requires: (user, partner) in Partnerships
    const partnershipToDelete = await this.partnerships.findOne({ user, partner });
    if (!partnershipToDelete) {
      return { error: `No partnership found between ${user} and ${partner}.` };
    }

    // Effects: Remove the pairing user, partner in Partnerships
    try {
      await this.partnerships.deleteOne({ _id: partnershipToDelete._id });
      return {};
    } catch (e) {
      console.error("Error removing partner:", e);
      return { error: "Failed to remove partner due to a database error." };
    }
  }

  // Placeholder for other actions as per the concept specification:
  // recordFailure (failingUser: User, date: Date): (failureId: FailureID)
  // **system** generateAndLogNotifications (): (notifications: set of {recipient: User, message: String, failureDetails: {id: FailureID, failingUser: User, date: Date}})
}
```
