---
timestamp: 'Thu Oct 16 2025 10:55:46 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_105546.276ba676.md]]'
content_id: c190cbd3855bea089a60989f64bba93fe94be042de9eb30b6a50bac4c4eaf76c
---

# response:

To update the `AccountabilityConcept` implementation, I will change the `SleepEventType` from a string literal union type to a TypeScript `enum` as requested.

Here's the modified TypeScript code:

```typescript
import { Collection, Db, IndexOptions } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "Accountability" + ".";

// Generic types of this concept
type User = ID;
type FailureID = ID; // Using ID as a generic placeholder for unique failure identifiers

// Changed to an enum as requested
enum SleepEventType {
  BEDTIME = "BEDTIME",
  WAKETIME = "WAKETIME",
}

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
 *   a failType: SleepEventType // Added failType as per concept state
 *   a timestamp: Timestamp (when the failure was recorded)
 */
interface AdherenceFailureDoc {
  _id: FailureID; // The unique ID for the failure itself
  failingUser: User;
  date: string; // Storing date as string (e.g., "YYYY-MM-DD") for simplicity, as time components are ignored.
  failType: SleepEventType; // Using the new enum type
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

  /**
   * **action** recordFailure(failingUser: User, date: string, failureType: SleepEventType): (failureId: FailureID)
   *
   * **requires**: `failingUser` is a valid `User` identifier and `failureType` is a valid `SleepEventType`.
   * **effects**:
   *   Generate a `newID` of type `FailureID` (globally unique).
   *   Add a new `AdherenceFailure` `(id: newID, failingUser, date, failureType, timestamp: currentTime())` to `AdherenceFailures`.
   *   Return `newID`.
   */
  async recordFailure(
    { failingUser, date, failureType }: { failingUser: User; date: string; failureType: SleepEventType },
  ): Promise<{ failureId: FailureID } | { error: string }> {
    // Requires: failingUser is a valid User identifier
    // (Assuming ID type branding handles basic validity, further checks might be in a User concept)
    // Requires: failureType is a valid SleepEventType
    if (!Object.values(SleepEventType).includes(failureType)) {
      return { error: `Invalid failure type: ${failureType}. Must be one of ${Object.values(SleepEventType).join(", ")}.` };
    }

    try {
      const newFailureId = freshID();
      const newFailure: AdherenceFailureDoc = {
        _id: newFailureId,
        failingUser,
        date,
        failType: failureType,
        timestamp: new Date(), // currentTime()
      };
      await this.adherenceFailures.insertOne(newFailure);
      return { failureId: newFailureId };
    } catch (e) {
      console.error("Error recording failure:", e);
      return { error: "Failed to record failure due to a database error." };
    }
  }

  /**
   * **system** generateAndLogNotifications (): (notifications: set of {recipient: User, message: String, failureDetails: {id: FailureID, failingUser: User, date: Date}})
   *
   * **requires**: There exists at least one `failure` in `AdherenceFailures` and at least one `partnership` in `Partnerships` such that:
   *   `failure.failingUser == partnership.user` AND `(failure.id, partnership.partner)` is NOT in `NotificationsSent`.
   * **effects**:
   *   Initialize an empty set `generatedNotifications`.
   *   For each `failure` in `AdherenceFailures`:
   *     For each `partnership` in `Partnerships` where `partnership.user == failure.failingUser`:
   *       Let `partner = partnership.partner`.
   *       If `(failure.id, partner)` is NOT in `NotificationsSent`:
   *         Add `(failure.id, partner, currentTime())` to `NotificationsSent`.
   *         Construct a generic notification message, e.g., `msg = "Your accountability partner ${failure.failingUser} recorded an adherence failure on ${failure.date} for ${failure.failType}."`
   *         Add `{recipient: partner, message: msg, failureDetails: {id: failure.id, failingUser: failure.failingUser, date: failure.date}}` to `generatedNotifications`.
   *   Return the `generatedNotifications` set.
   */
  async generateAndLogNotifications(): Promise<
    { notifications: { recipient: User; message: string; failureDetails: { id: FailureID; failingUser: User; date: string } }[] }
  > {
    const generatedNotifications: {
      recipient: User;
      message: string;
      failureDetails: { id: FailureID; failingUser: User; date: string };
    }[] = [];

    // Find all adherence failures that haven't been notified to all relevant partners yet
    const unnotifiedFailuresCursor = this.adherenceFailures.find({});
    for await (const failure of unnotifiedFailuresCursor) {
      const partnersForUser = await this.partnerships.find({ user: failure.failingUser }).toArray();

      for (const partnership of partnersForUser) {
        const partner = partnership.partner;

        // Check if this specific failure-partner notification has already been sent
        const alreadyNotified = await this.notificationsSent.findOne({
          failureId: failure._id,
          partner: partner,
        });

        if (!alreadyNotified) {
          const currentTime = new Date();
          const notificationId = freshID(); // Unique ID for this specific notification event

          // Log the notification as sent
          const newNotification: NotificationSentDoc = {
            _id: notificationId,
            failureId: failure._id,
            partner: partner,
            timestamp: currentTime,
          };
          await this.notificationsSent.insertOne(newNotification);

          // Construct the message
          const msg =
            `Your accountability partner ${failure.failingUser} recorded an adherence failure on ${failure.date} for ${failure.failType}.`;

          // Add to the list of generated notifications to return
          generatedNotifications.push({
            recipient: partner,
            message: msg,
            failureDetails: {
              id: failure._id,
              failingUser: failure.failingUser,
              date: failure.date,
            },
          });
        }
      }
    }
    return { notifications: generatedNotifications };
  }
}
```
