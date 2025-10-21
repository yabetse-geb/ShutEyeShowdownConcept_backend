---
timestamp: 'Sat Oct 18 2025 23:46:08 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_234608.6a397ae0.md]]'
content_id: 6c86f859f970ecb0adfebc7171215498fbc3cfe1f1c9ec540ed024e4232472cd
---

# response:

```typescript
// file: src/PasswordAuth/PasswordAuthConcept.test.ts
import { testDb } from "@utils/database.ts";
import { assertEquals } from "jsr:@std/assert";
import PasswordAuthConcept, { UserID } from "./PasswordAuthConcept.ts"; // Import UserID for type safety

Deno.test("PasswordAuthConcept Tests", async (t) => {
  const [db, client] = await testDb();
  const concept = new PasswordAuthConcept(db);

  try {
    // # trace: Operational principle
    await t.step("Operational principle: Register, authenticate, change, deactivate", async () => {
      console.log("\n--- Operational Principle Trace ---");

      // 1. Register a user
      const registerInput = { username: "Alice", password: "password123", email: "alice@example.com" };
      console.log("Action: register", registerInput);
      const registerResult = await concept.register(registerInput);
      assertEquals("user" in registerResult, true, "Register should succeed");
      const aliceId = (registerResult as { user: UserID }).user;
      console.log("Result:", registerResult);

      // 2. Authenticate with correct credentials
      const authInput = { username: "Alice", password: "password123" };
      console.log("Action: authenticate", authInput);
      const authResult = await concept.authenticate(authInput);
      assertEquals("user" in authResult, true, "Authenticate with correct password should succeed");
      assertEquals((authResult as { user: UserID }).user, aliceId, "Authenticated user ID should match");
      console.log("Result:", authResult);

      // 3. Change the user's email
      const changeEmailInput = { username: "Alice", password: "password123", newEmail: "alice.new@example.com" };
      console.log("Action: changeEmail", changeEmailInput);
      const changeEmailResult = await concept.changeEmail(changeEmailInput);
      assertEquals("error" in changeEmailResult, false, "changeEmail should succeed");
      console.log("Result:", changeEmailResult);

      // 4. Verify the email has changed using the query
      const getEmailInput = { username: "Alice" };
      console.log("Query: _getEmail", getEmailInput);
      const getEmailResult = await concept._getEmail(getEmailInput);
      assertEquals("email" in getEmailResult, true, "_getEmail should succeed");
      assertEquals((getEmailResult as { email: string }).email, "alice.new@example.com", "Email should be updated to alice.new@example.com");
      console.log("Result:", getEmailResult);

      // 5. Change the user's password
      const changePasswordInput = { username: "Alice", currentPassword: "password123", newPassword: "newPassword456" };
      console.log("Action: changePassword", changePasswordInput);
      const changePasswordResult = await concept.changePassword(changePasswordInput);
      assertEquals("error" in changePasswordResult, false, "changePassword should succeed");
      console.log("Result:", changePasswordResult);

      // 6. Attempt to authenticate with the old password (expected to fail)
      const authOldPassInput = { username: "Alice", password: "password123" };
      console.log("Action: authenticate (old password)", authOldPassInput);
      const authOldPassResult = await concept.authenticate(authOldPassInput);
      assertEquals("error" in authOldPassResult, true, "Authenticate with old password should fail");
      assertEquals((authOldPassResult as { error: string }).error, "Invalid username or password.", "Correct error message for old password");
      console.log("Result:", authOldPassResult);

      // 7. Authenticate with the new password (expected to succeed)
      const authNewPassInput = { username: "Alice", password: "newPassword456" };
      console.log("Action: authenticate (new password)", authNewPassInput);
      const authNewPassResult = await concept.authenticate(authNewPassInput);
      assertEquals("user" in authNewPassResult, true, "Authenticate with new password should succeed");
      assertEquals((authNewPassResult as { user: UserID }).user, aliceId, "Authenticated user ID should match after password change");
      console.log("Result:", authNewPassResult);

      // 8. Deactivate the user's account
      const deactivateInput = { username: "Alice", password: "newPassword456" };
      console.log("Action: deactivateAccount", deactivateInput);
      const deactivateResult = await concept.deactivateAccount(deactivateInput);
      assertEquals("error" in deactivateResult, false, "deactivateAccount should succeed");
      console.log("Result:", deactivateResult);

      // 9. Verify the user is no longer registered using the query
      const isRegisteredInput = { username: "Alice" };
      console.log("Query: _isRegistered", isRegisteredInput);
      const isRegisteredResult = await concept._isRegistered(isRegisteredInput);
      assertEquals(isRegisteredResult.isRegistered, false, "User should no longer be registered after deactivation");
      console.log("Result:", isRegisteredResult);
    });

    await t.step("Scenario 1: Duplicate registration should fail", async () => {
      console.log("\n--- Scenario 1: Duplicate Registration ---");

      // Register a user successfully
      const userBob = { username: "Bob", password: "bobPass", email: "bob@example.com" };
      console.log("Action: register (first time)", userBob);
      const res1 = await concept.register(userBob);
      assertEquals("user" in res1, true, "First registration should succeed");
      const bobId = (res1 as { user: UserID }).user;
      console.log("Result:", res1);

      // Attempt to register another user with the same username but different details (expected to fail)
      const userBobDuplicate = { username: "Bob", password: "differentPass", email: "different@example.com" };
      console.log("Action: register (duplicate username)", userBobDuplicate);
      const res2 = await concept.register(userBobDuplicate);
      assertEquals("error" in res2, true, "Duplicate registration should fail");
      assertEquals((res2 as { error: string }).error, "Username already taken.", "Correct error message for duplicate username");
      console.log("Result:", res2);

      // Verify the original user can still authenticate
      const authRes = await concept.authenticate({ username: "Bob", password: "bobPass" });
      assertEquals("user" in authRes, true, "Original user should still be able to authenticate");
      assertEquals((authRes as { user: UserID }).user, bobId, "Authenticated ID should match original user ID");
      console.log("Verification Result (original auth):", authRes);
    });

    await t.step("Scenario 2: Authentication with wrong password fails, correct succeeds", async () => {
      console.log("\n--- Scenario 2: Authentication Fail/Success ---");

      // Register a user
      const userCharlie = { username: "Charlie", password: "charliePass", email: "charlie@example.com" };
      console.log("Action: register", userCharlie);
      const res1 = await concept.register(userCharlie);
      assertEquals("user" in res1, true, "Registration should succeed");
      const charlieId = (res1 as { user: UserID }).user;
      console.log("Result:", res1);

      // Attempt to authenticate with the wrong password (expected to fail)
      const authWrongInput = { username: "Charlie", password: "wrongPass" };
      console.log("Action: authenticate (wrong password)", authWrongInput);
      const authWrongResult = await concept.authenticate(authWrongInput);
      assertEquals("error" in authWrongResult, true, "Authentication with wrong password should fail");
      assertEquals((authWrongResult as { error: string }).error, "Invalid username or password.", "Correct error for wrong password");
      console.log("Result:", authWrongResult);

      // Authenticate with the correct password (expected to succeed)
      const authCorrectInput = { username: "Charlie", password: "charliePass" };
      console.log("Action: authenticate (correct password)", authCorrectInput);
      const authCorrectResult = await concept.authenticate(authCorrectInput);
      assertEquals("user" in authCorrectResult, true, "Authentication with correct password should succeed");
      assertEquals((authCorrectResult as { user: UserID }).user, charlieId, "Authenticated user ID should match");
      console.log("Result:", authCorrectResult);
    });

    await t.step("Scenario 3: Change password and verify old fails, new succeeds", async () => {
      console.log("\n--- Scenario 3: Change Password Verification ---");

      // Register a user
      const userDavid = { username: "David", password: "davidPass", email: "david@example.com" };
      console.log("Action: register", userDavid);
      const res1 = await concept.register(userDavid);
      assertEquals("user" in res1, true, "Registration should succeed");
      const davidId = (res1 as { user: UserID }).user;
      console.log("Result:", res1);

      // Change password
      const changePassInput = { username: "David", currentPassword: "davidPass", newPassword: "davidNewPass" };
      console.log("Action: changePassword", changePassInput);
      const changePassResult = await concept.changePassword(changePassInput);
      assertEquals("error" in changePassResult, false, "changePassword should succeed");
      console.log("Result:", changePassResult);

      // Attempt to authenticate with the old password (expected to fail)
      const authOldInput = { username: "David", password: "davidPass" };
      console.log("Action: authenticate (old password)", authOldInput);
      const authOldResult = await concept.authenticate(authOldInput);
      assertEquals("error" in authOldResult, true, "Authentication with old password should fail");
      assertEquals((authOldResult as { error: string }).error, "Invalid username or password.", "Correct error for old password");
      console.log("Result:", authOldResult);

      // Authenticate with the new password (expected to succeed)
      const authNewInput = { username: "David", password: "davidNewPass" };
      console.log("Action: authenticate (new password)", authNewInput);
      const authNewResult = await concept.authenticate(authNewInput);
      assertEquals("user" in authNewResult, true, "Authentication with new password should succeed");
      assertEquals((authNewResult as { user: UserID }).user, davidId, "Authenticated user ID should match");
      console.log("Result:", authNewResult);
    });

    await t.step("Scenario 4: Deactivate account and re-register with same username", async () => {
      console.log("\n--- Scenario 4: Deactivate & Re-Register ---");

      // Register a user
      const userEve = { username: "Eve", password: "evePass", email: "eve@example.com" };
      console.log("Action: register (first time)", userEve);
      const res1 = await concept.register(userEve);
      assertEquals("user" in res1, true, "First registration should succeed");
      const eveId1 = (res1 as { user: UserID }).user;
      console.log("Result:", res1);

      // Deactivate the account
      const deactivateInput = { username: "Eve", password: "evePass" };
      console.log("Action: deactivateAccount", deactivateInput);
      const deactivateResult = await concept.deactivateAccount(deactivateInput);
      assertEquals("error" in deactivateResult, false, "Deactivation should succeed");
      console.log("Result:", deactivateResult);

      // Verify user is no longer registered
      const isRegisteredInput = { username: "Eve" };
      console.log("Query: _isRegistered (after deactivation)", isRegisteredInput);
      const isRegisteredResult = await concept._isRegistered(isRegisteredInput);
      assertEquals(isRegisteredResult.isRegistered, false, "User should not be registered after deactivation");
      console.log("Result:", isRegisteredResult);

      // Re-register with the same username (expected to succeed now)
      const userEveReRegister = { username: "Eve", password: "eveNewPass", email: "eve_new@example.com" };
      console.log("Action: register (re-register)", userEveReRegister);
      const res2 = await concept.register(userEveReRegister);
      assertEquals("user" in res2, true, "Re-registration should succeed");
      const eveId2 = (res2 as { user: UserID }).user;
      assertEquals(eveId1 !== eveId2, true, "Re-registered user should have a new ID, not reuse old one");
      console.log("Result:", res2);

      // Authenticate the newly re-registered user
      const authNewRegisterInput = { username: "Eve", password: "eveNewPass" };
      console.log("Action: authenticate (re-registered)", authNewRegisterInput);
      const authNewRegisterResult = await concept.authenticate(authNewRegisterInput);
      assertEquals("user" in authNewRegisterResult, true, "Authentication with re-registered user should succeed");
      assertEquals((authNewRegisterResult as { user: UserID }).user, eveId2, "Authenticated ID should match new user ID");
      console.log("Result:", authNewRegisterResult);
    });

    await t.step("Scenario 5: Confirming email change", async () => {
      console.log("\n--- Scenario 5: Email Change Confirmation ---");

      // Register a user
      const userFrank = { username: "Frank", password: "frankPass", email: "frank@example.com" };
      console.log("Action: register", userFrank);
      const res1 = await concept.register(userFrank);
      assertEquals("user" in res1, true, "Registration should succeed");
      console.log("Result:", res1);

      // Get and verify initial email
      const initialGetEmailInput = { username: "Frank" };
      console.log("Query: _getEmail (initial)", initialGetEmailInput);
      const initialGetEmailResult = await concept._getEmail(initialGetEmailInput);
      assertEquals("email" in initialGetEmailResult, true, "getEmail should return an email");
      assertEquals((initialGetEmailResult as { email: string }).email, "frank@example.com", "Initial email should be correct");
      console.log("Result:", initialGetEmailResult);

      // Change email
      const changeEmailInput = { username: "Frank", password: "frankPass", newEmail: "frank.updated@example.com" };
      console.log("Action: changeEmail", changeEmailInput);
      const changeEmailResult = await concept.changeEmail(changeEmailInput);
      assertEquals("error" in changeEmailResult, false, "changeEmail should succeed");
      console.log("Result:", changeEmailResult);

      // Confirm email has been updated
      const confirmGetEmailInput = { username: "Frank" };
      console.log("Query: _getEmail (after change)", confirmGetEmailInput);
      const confirmGetEmailResult = await concept._getEmail(confirmGetEmailInput);
      assertEquals("email" in confirmGetEmailResult, true, "getEmail should return an email after change");
      assertEquals((confirmGetEmailResult as { email: string }).email, "frank.updated@example.com", "Email should be updated and confirmed");
      console.log("Result:", confirmGetEmailResult);
    });
  } finally {
    // Ensure the database client is closed even if tests fail
    await client.close();
  }
});
```
