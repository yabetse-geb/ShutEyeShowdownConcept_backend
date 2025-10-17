---
timestamp: 'Thu Oct 16 2025 11:44:53 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_114453.49c07487.md]]'
content_id: 2d3a1fc3ad3ae64a8e3d80215d47ae8014b4243986fea7400e105173006997a4
---

# response:

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
  notifyTypes: FailureType[]; // e.g., {MissedBedtime, MissedWake}
  reportFrequency: FrequencyType; // Immediate | Daily | Weekly
  lastReportDate: Date | null;
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
    // This handles the "user and partner are not equal and (user, partner) is not in Partnerships" part implicitly
    // for uniqueness, but explicit checks provide clearer error messages.
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
    // Default values for notifyTypes and reportFrequency are set as per typical usage,
    // and lastReportDate is null as specified.
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
      // Catch potential race conditions where another identical partnership was inserted
      // between the findOne and insertOne calls (unlikely with strict unique index, but robust).
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
    // Effects: remove the pairing user, partner in Partnerships
    // This operation implicitly checks the "requires" condition.
    // If no document is found, deleteResult.deletedCount will be 0.
    const deleteResult = await this.partnerships.deleteOne({ user, partner });

    // Requires check: (user, partner) in Partnerships
    // If no document was deleted, it means the partnership did not exist.
    if (deleteResult.deletedCount === 0) {
      return { error: `Partnership between user '${user}' and partner '${partner}' not found.` };
    }

    // Success
    return {};
  }
}
```

**# file: src/Accountability/AccountabilityConcept.test.ts**

```typescript
import { assertEquals } from "jsr:@std/assert";
import { testDb } from "../../utils/database.ts";
import { ID } from "../../utils/types.ts";
import AccountabilityConcept from "./AccountabilityConcept.ts";

Deno.test("AccountabilityConcept", async (t) => {
  const [db, client] = await testDb();
  const concept = new AccountabilityConcept(db);

  // Define test users using branded ID type
  const userA = "user:Alice" as ID;
  const userB = "user:Bob" as ID;
  const userC = "user:Charlie" as ID;

  // --- Operational Principle Trace ---
  // Demonstrates the typical usage of adding and then removing a partner.
  // # trace: Add and Remove Partner
  await t.step("trace: Operational Principle - Add and Remove Partner", async () => {
    console.log(`\n--- Test Trace: Add and Remove Partner ---`);
    console.log(`Test users involved: ${userA}, ${userB}`);

    // Action: addPartner(userA, userB)
    console.log(`1. Calling addPartner({ user: "${userA}", partner: "${userB}" })`);
    const addResult = await concept.addPartner({ user: userA, partner: userB });
    console.log(`   Result: ${JSON.stringify(addResult)}`);
    assertEquals(addResult, {}, "addPartner should succeed when valid inputs are provided");

    // Verify effects: Partnership exists in the database with default values
    const partnershipAfterAdd = await concept.partnerships.findOne({ user: userA, partner: userB });
    console.log(`   Verification: State after addPartner: ${JSON.stringify(partnershipAfterAdd ? { user: partnershipAfterAdd.user, partner: partnershipAfterAdd.partner, notifyTypes: partnershipAfterAdd.notifyTypes, reportFrequency: partnershipAfterAdd.reportFrequency, lastReportDate: partnershipAfterAdd.lastReportDate } : null)}`);
    assertEquals(partnershipAfterAdd?.user, userA, "Partnership document should correctly store userA");
    assertEquals(partnershipAfterAdd?.partner, userB, "Partnership document should correctly store userB");
    assertEquals(partnershipAfterAdd?.notifyTypes, [], "Partnership should initialize with empty notifyTypes array");
    assertEquals(partnershipAfterAdd?.reportFrequency, "Immediate", "Partnership should initialize with 'Immediate' reportFrequency");
    assertEquals(partnershipAfterAdd?.lastReportDate, null, "Partnership should initialize with null lastReportDate");

    // Action: removePartner(userA, userB)
    console.log(`2. Calling removePartner({ user: "${userA}", partner: "${userB}" })`);
    const removeResult = await concept.removePartner({ user: userA, partner: userB });
    console.log(`   Result: ${JSON.stringify(removeResult)}`);
    assertEquals(removeResult, {}, "removePartner should succeed when an existing partnership is removed");

    // Verify effects: Partnership no longer exists in the database
    const partnershipAfterRemove = await concept.partnerships.findOne({ user: userA, partner: userB });
    console.log(`   Verification: State after removePartner: ${JSON.stringify(partnershipAfterRemove)}`);
    assertEquals(partnershipAfterRemove, null, "Partnership document should be removed from the database");
    console.log(`--- End Trace ---`);
  });

  // --- Interesting Scenarios ---

  await t.step("addPartner: requires user and partner are not equal", async () => {
    console.log(`\n--- Test Scenario: Self-Partnering Attempt ---`);
    console.log(`User: ${userA}`);

    // Action: Attempt to add userA as their own partner
    console.log(`1. Calling addPartner({ user: "${userA}", partner: "${userA}" })`);
    const result = await concept.addPartner({ user: userA, partner: userA });
    console.log(`   Result: ${JSON.stringify(result)}`);

    // Assert requirements check: Should return an error
    assertEquals(result, { error: "A user cannot partner with themselves." }, "addPartner should return an error for self-partnering");

    // Verify effects: No partnership should be created
    const partnership = await concept.partnerships.findOne({ user: userA, partner: userA });
    console.log(`   Verification: Partnership found: ${JSON.stringify(partnership)}`);
    assertEquals(partnership, null, "No partnership document should be created for self-partnering");
    console.log(`--- End Scenario ---`);
  });

  await t.step("addPartner: requires (user, partner) is not in Partnerships", async () => {
    console.log(`\n--- Test Scenario: Duplicate Partnership Attempt ---`);
    console.log(`Test users involved: ${userA}, ${userB}`);

    // Pre-condition: Add an initial partnership successfully
    console.log(`1. Calling addPartner({ user: "${userA}", partner: "${userB}" }) (initial add)`);
    const initialAddResult = await concept.addPartner({ user: userA, partner: userB });
    console.log(`   Result: ${JSON.stringify(initialAddResult)}`);
    assertEquals(initialAddResult, {}, "Initial addPartner should succeed");

    // Action: Attempt to add the exact same partnership again
    console.log(`2. Calling addPartner({ user: "${userA}", partner: "${userB}" }) (duplicate add)`);
    const duplicateAddResult = await concept.addPartner({ user: userA, partner: userB });
    console.log(`   Result: ${JSON.stringify(duplicateAddResult)}`);

    // Assert requirements check: Should return an error for duplicate partnership
    assertEquals(duplicateAddResult, { error: `Partnership already exists between user '${userA}' and partner '${userB}'.` }, "addPartner should return an error for an already existing partnership");

    // Verify effects: Only one partnership entry should exist
    const partnerships = await concept.partnerships.find({ user: userA, partner: userB }).toArray();
    console.log(`   Verification: Number of partnerships found for (${userA}, ${userB}): ${partnerships.length}`);
    assertEquals(partnerships.length, 1, "Only one partnership document should exist for a unique (user, partner) pair");
    console.log(`--- End Scenario ---`);
  });

  await t.step("removePartner: requires (user, partner) in Partnerships", async () => {
    console.log(`\n--- Test Scenario: Remove Non-Existent Partnership ---`);
    console.log(`Test users involved: ${userA}, ${userC}`);

    // Action: Attempt to remove a partnership that was never added
    console.log(`1. Calling removePartner({ user: "${userA}", partner: "${userC}" })`);
    const removeResult = await concept.removePartner({ user: userA, partner: userC });
    console.log(`   Result: ${JSON.stringify(removeResult)}`);

    // Assert requirements check: Should return an error as the partnership doesn't exist
    assertEquals(removeResult, { error: `Partnership between user '${userA}' and partner '${userC}' not found.` }, "removePartner should return an error if the partnership does not exist");

    // Verify effects: The database should remain unchanged (no deletions occurred)
    const partnershipCount = await concept.partnerships.countDocuments({});
    console.log(`   Verification: Total partnerships in DB: ${partnershipCount}`);
    assertEquals(partnershipCount, 0, "No partnerships should exist in the database after this test step (due to `testDb` cleanup)");
    console.log(`--- End Scenario ---`);
  });

  await t.step("addPartner: should correctly add multiple distinct partners for a single user", async () => {
    console.log(`\n--- Test Scenario: Multiple Partners for One User ---`);
    console.log(`Test user: ${userA}, Test partners: ${userB}, ${userC}`);

    // Action: Add userB as a partner for userA
    console.log(`1. Calling addPartner({ user: "${userA}", partner: "${userB}" })`);
    const addResult1 = await concept.addPartner({ user: userA, partner: userB });
    console.log(`   Result: ${JSON.stringify(addResult1)}`);
    assertEquals(addResult1, {}, "addPartner should succeed for userA and userB");

    // Action: Add userC as another partner for userA
    console.log(`2. Calling addPartner({ user: "${userA}", partner: "${userC}" })`);
    const addResult2 = await concept.addPartner({ user: userA, partner: userC });
    console.log(`   Result: ${JSON.stringify(addResult2)}`);
    assertEquals(addResult2, {}, "addPartner should succeed for userA and userC");

    // Verify effects: Both partnerships exist independently
    const partnershipsForA = await concept.partnerships.find({ user: userA }).toArray();
    console.log(`   Verification: Partnerships found for ${userA}: ${JSON.stringify(partnershipsForA.map(p => p.partner))}`);
    assertEquals(partnershipsForA.length, 2, "UserA should have two partnership documents");
    const partners = partnershipsForA.map(p => p.partner).sort(); // Sort for consistent comparison
    assertEquals(partners, [userB, userC].sort(), "UserA's partners should be userB and userC");
    console.log(`--- End Scenario ---`);
  });

  await t.step("addPartner: should treat (user, partner) and (partner, user) as distinct partnerships", async () => {
    console.log(`\n--- Test Scenario: Distinct Bidirectional Partnerships ---`);
    console.log(`Test users involved: ${userA}, ${userB}`);

    // Action: Add userB as a partner for userA
    console.log(`1. Calling addPartner({ user: "${userA}", partner: "${userB}" })`);
    const resultAB = await concept.addPartner({ user: userA, partner: userB });
    console.log(`   Result: ${JSON.stringify(resultAB)}`);
    assertEquals(resultAB, {}, "addPartner(A, B) should succeed");

    // Action: Add userA as a partner for userB (a reverse partnership)
    console.log(`2. Calling addPartner({ user: "${userB}", partner: "${userA}" })`);
    const resultBA = await concept.addPartner({ user: userB, partner: userA });
    console.log(`   Result: ${JSON.stringify(resultBA)}`);
    assertEquals(resultBA, {}, "addPartner(B, A) should succeed");

    // Verify effects: Both partnerships exist independently
    const partnershipAB = await concept.partnerships.findOne({ user: userA, partner: userB });
    const partnershipBA = await concept.partnerships.findOne({ user: userB, partner: userA });

    console.log(`   Verification: Partnership (${userA}, ${userB}) found: ${!!partnershipAB}`);
    console.log(`   Verification: Partnership (${userB}, ${userA}) found: ${!!partnershipBA}`);

    assertEquals(partnershipAB?.user, userA, "Partnership (A, B) should exist with user A");
    assertEquals(partnershipAB?.partner, userB, "Partnership (A, B) should exist with partner B");

    assertEquals(partnershipBA?.user, userB, "Partnership (B, A) should exist with user B");
    assertEquals(partnershipBA?.partner, userA, "Partnership (B, A) should exist with partner A");

    const totalPartnerships = await concept.partnerships.countDocuments({});
    console.log(`   Verification: Total partnerships in DB: ${totalPartnerships}`);
    assertEquals(totalPartnerships, 2, "Two distinct partnership documents should exist for (A,B) and (B,A)");
    console.log(`--- End Scenario ---`);
  });

  // Ensure client is closed after all tests in this file
  await client.close();
});
```
