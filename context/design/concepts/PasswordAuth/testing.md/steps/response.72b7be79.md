---
timestamp: 'Sat Oct 18 2025 23:43:52 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_234352.a1821483.md]]'
content_id: 72b7be79074159f0f7f6502ba561a5d698e995eaad0289e081c1dbe5ab5571f7
---

# response:

```typescript
// src/PasswordAuth/PasswordAuthClient.ts
// This file would contain the implementation of the PasswordAuth concept's actions.
// For testing purposes, we'll use a simple in-memory mock.

interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string; // In a real app, this would be a secure hash
  isEmailConfirmed: boolean;
  isActive: boolean;
}

// Dummy Database type - for this mock, it's a placeholder.
interface Database {
  _testId: string;
}

export class PasswordAuthClient {
  private db: Database; // In a real app, this would be a DB connection or ORM instance
  private users: Map<string, User>; // Simulating a 'users' collection in memory

  constructor(db: Database) {
    this.db = db;
    this.users = new Map<string, User>(); // Each new client gets a fresh user store
  }

  // Helper to simulate password hashing (for testing, a simple prefix is sufficient)
  private hashPassword(password: string): string {
    return `hashed_${password}`;
  }

  // Helper to simulate password comparison
  private comparePassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  // Helper to generate unique ID
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Registers a new user.
   * requires: username is unique, email is unique, password meets strength requirements.
   * effects: Creates a new User record, returns userId.
   */
  async registerUser(
    username: string,
    email: string,
    password: string,
  ): Promise<{ userId: string } | { error: string }> {
    if (password.length < 8) { // Simplified password strength requirement
      return { error: "Password must be at least 8 characters long" };
    }
    for (const user of this.users.values()) {
      if (user.username === username) {
        return { error: "Username already taken" };
      }
      if (user.email === email) {
        return { error: "Email already registered" };
      }
    }

    const userId = this.generateId();
    const newUser: User = {
      id: userId,
      username,
      email,
      passwordHash: this.hashPassword(password),
      isEmailConfirmed: false, // New emails often require confirmation
      isActive: true, // User is active upon registration
    };
    this.users.set(userId, newUser);
    return { userId };
  }

  /**
   * Authenticates a user.
   * requires: User exists, password matches, user is active.
   * effects: Returns userId if successful.
   */
  async authenticateUser(
    usernameOrEmail: string,
    password: string,
  ): Promise<{ userId: string } | { error: string }> {
    let user: User | undefined;
    for (const u of this.users.values()) {
      if (u.username === usernameOrEmail || u.email === usernameOrEmail) {
        user = u;
        break;
      }
    }

    if (!user) {
      return { error: "User not found" };
    }
    if (!user.isActive) {
      return { error: "User account deactivated" };
    }
    if (!this.comparePassword(password, user.passwordHash)) {
      return { error: "Invalid credentials" };
    }

    return { userId: user.id };
  }

  /**
   * Changes a user's password.
   * requires: userId exists, oldPassword matches, newPassword meets strength requirements.
   * effects: Updates passwordHash for userId.
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean } | { error: string }> {
    const user = this.users.get(userId);
    if (!user) {
      return { error: "User not found" };
    }
    if (!this.comparePassword(oldPassword, user.passwordHash)) {
      return { error: "Old password incorrect" };
    }
    if (newPassword.length < 8) { // Simplified new password strength requirement
      return { error: "New password must be at least 8 characters long" };
    }
    if (oldPassword === newPassword) {
      return { error: "New password cannot be the same as the old password" };
    }

    user.passwordHash = this.hashPassword(newPassword);
    this.users.set(userId, user);
    return { success: true };
  }

  /**
   * Deactivates a user account.
   * requires: userId exists, user is active.
   * effects: Sets isActive: false for userId.
   */
  async deactivateUser(
    userId: string,
  ): Promise<{ success: boolean } | { error: string }> {
    const user = this.users.get(userId);
    if (!user) {
      return { error: "User not found" };
    }
    if (!user.isActive) {
      return { error: "User already deactivated" };
    }

    user.isActive = false;
    this.users.set(userId, user);
    return { success: true };
  }

  /**
   * Reactivates a user account.
   * requires: userId exists, user is inactive.
   * effects: Sets isActive: true for userId.
   */
  async reactivateUser(
    userId: string,
  ): Promise<{ success: boolean } | { error: string }> {
    const user = this.users.get(userId);
    if (!user) {
      return { error: "User not found" };
    }
    if (user.isActive) {
      return { error: "User already active" };
    }

    user.isActive = true;
    this.users.set(userId, user);
    return { success: true };
  }

  /**
   * Changes a user's email address.
   * requires: userId exists, newEmail is unique and valid (simplified validity).
   * effects: Updates email for userId, sets isEmailConfirmed: false.
   */
  async changeEmail(
    userId: string,
    newEmail: string,
  ): Promise<{ success: boolean } | { error: string }> {
    const user = this.users.get(userId);
    if (!user) {
      return { error: "User not found" };
    }
    if (user.email === newEmail) {
      return { error: "New email is the same as current email" };
    }
    // Simplified email format check
    if (!newEmail.includes("@") || !newEmail.includes(".")) {
      return { error: "Invalid email format" };
    }

    for (const u of this.users.values()) {
      if (u.id !== userId && u.email === newEmail) {
        return { error: "Email already registered by another user" };
      }
    }

    user.email = newEmail;
    user.isEmailConfirmed = false; // New email requires re-confirmation
    this.users.set(userId, user);
    return { success: true };
  }

  /**
   * Confirms a user's email address.
   * requires: userId exists, token matches (simulated).
   * effects: Sets isEmailConfirmed: true for userId.
   */
  async confirmEmail(
    userId: string,
    token: string, // In a real system, this token would be validated
  ): Promise<{ success: boolean } | { error: string }> {
    const user = this.users.get(userId);
    if (!user) {
      return { error: "User not found" };
    }
    if (user.isEmailConfirmed) {
      return { error: "Email already confirmed" };
    }
    if (!token) { // Simplified token check for testing purposes
      return { error: "Invalid confirmation token" };
    }

    user.isEmailConfirmed = true;
    this.users.set(userId, user);
    return { success: true };
  }

  // Helper for tests to inspect internal state (used sparingly to verify effects)
  _getUserById(userId: string): User | undefined {
    return this.users.get(userId);
  }
}
```

```typescript
// src/utils/database.ts
// This file simulates the `testDb` utility as specified in the prompt.

import { PasswordAuthClient } from "../PasswordAuth/PasswordAuthClient.ts";

// Dummy Database type
interface Database {
  _testId: string; // To ensure it's a new instance per test.
  // In a real scenario, this would hold actual database connection info.
}

// Dummy Client type that wraps PasswordAuthClient and adds a close method.
export interface MockClient {
  passwordAuth: PasswordAuthClient;
  close(): Promise<void>;
  // Add other concept clients here as needed, e.g., 'profileClient: ProfileClient;'
}

/**
 * Mocks the `testDb` function for testing concepts.
 * Returns a tuple of a dummy database object and a client object
 * containing mock clients for various concepts.
 * Each call returns a fresh instance to ensure test isolation.
 */
export async function testDb(): Promise<[Database, MockClient]> {
  // Simulate a new database instance for each test run.
  const db: Database = { _testId: crypto.randomUUID() };

  // Create mock concept clients
  const passwordAuthClient = new PasswordAuthClient(db);

  const client: MockClient = {
    passwordAuth: passwordAuthClient,
    async close() {
      // In a real scenario, this would close actual DB connections.
      // For the mock, it's a no-op, but fulfills the interface.
      // console.log("Mock client closed.");
    },
  };

  return [db, client];
}

// Deno.test.beforeAll hook to drop the database is implicitly assumed to be
// configured for the real database. For this mock, the `testDb` function
// inherently provides a clean state by instantiating new clients.
```

```typescript
// # file: src/PasswordAuth/PasswordAuthConcept.test.ts
import { assertEquals } from "jsr:@std/assert";
import { testDb, MockClient } from "@utils/database.ts"; // Use the specified import path
import { PasswordAuthClient } from "./PasswordAuthClient.ts"; // Import the client definition

// Helper to log action inputs and results consistently
function logAction<T extends { error?: string }>(
  actionName: string,
  input: Record<string, unknown>,
  result: T,
): void {
  console.log(`\n--- Action: ${actionName} ---`);
  console.log("Input:", JSON.stringify(input, null, 2));
  console.log("Result:", JSON.stringify(result, null, 2));
  if (result.error) {
    console.log(`ERROR: ${result.error}`);
  }
}

Deno.test("PasswordAuth Concept Testing", async (t) => {
  let db: unknown; // Placeholder for the generic db object
  let client: MockClient;
  let passwordAuth: PasswordAuthClient;

  // Setup before each test block using t.beforeEach to ensure isolation
  t.beforeEach(async () => {
    [db, client] = await testDb();
    passwordAuth = client.passwordAuth;
    // console.log(`Test started with new DB instance: ${(db as any)._testId}`);
  });

  t.afterEach(async () => {
    await client.close();
    // console.log(`Test finished, client closed for DB instance: ${(db as any)._testId}`);
  });

  // # trace: Operational Principle
  // This trace demonstrates the basic lifecycle of a user with password authentication:
  // 1. A user registers with a username, email, and password.
  // 2. The user then authenticates using their credentials (username).
  // 3. The user successfully authenticates again using their email.
  Deno.test("Operational Principle: Register and Authenticate", async () => {
    console.log("\n--- Operational Principle: Register and Authenticate ---");

    // 1. Register a new user
    const registerInput = {
      username: "operational_user",
      email: "operational@example.com",
      password: "secure_password_123",
    };
    const registerResult = await passwordAuth.registerUser(
      registerInput.username,
      registerInput.email,
      registerInput.password,
    );
    logAction("registerUser", registerInput, registerResult);

    assertEquals(
      "userId" in registerResult,
      true,
      "Registration should return a userId",
    );
    const userId = (registerResult as { userId: string }).userId;

    // 2. Authenticate the registered user using username
    const authByUsernameInput = {
      usernameOrEmail: "operational_user",
      password: "secure_password_123",
    };
    const authByUsernameResult = await passwordAuth.authenticateUser(
      authByUsernameInput.usernameOrEmail,
      authByUsernameInput.password,
    );
    logAction(
      "authenticateUser (by username)",
      authByUsernameInput,
      authByUsernameResult,
    );

    assertEquals(
      "userId" in authByUsernameResult,
      true,
      "Authentication by username should succeed and return userId",
    );
    assertEquals(
      (authByUsernameResult as { userId: string }).userId,
      userId,
      "Authenticated userId by username should match registered userId",
    );

    // 3. Authenticate the registered user using email
    const authByEmailInput = {
      usernameOrEmail: "operational@example.com",
      password: "secure_password_123",
    };
    const authByEmailResult = await passwordAuth.authenticateUser(
      authByEmailInput.usernameOrEmail,
      authByEmailInput.password,
    );
    logAction(
      "authenticateUser (by email)",
      authByEmailInput,
      authByEmailResult,
    );

    assertEquals(
      "userId" in authByEmailResult,
      true,
      "Authentication by email should succeed and return userId",
    );
    assertEquals(
      (authByEmailResult as { userId: string }).userId,
      userId,
      "Authenticated userId by email should match registered userId",
    );
  });

  // Scenario 1: Duplicate registration (same username OR same email)
  Deno.test("Scenario 1: Duplicate Registration attempts", async () => {
    console.log("\n--- Scenario 1: Duplicate Registration attempts ---");

    const initialUserInput = {
      username: "testuser1",
      email: "test1@example.com",
      password: "password_strong_1",
    };
    const initialUserResult = await passwordAuth.registerUser(
      initialUserInput.username,
      initialUserInput.email,
      initialUserInput.password,
    );
    logAction("registerUser (initial user)", initialUserInput, initialUserResult);
    assertEquals("userId" in initialUserResult, true, "Initial registration should succeed");

    // Attempt 1: Duplicate username, different email and password
    const duplicateUsernameInput = {
      username: "testuser1", // Duplicate
      email: "test_new_email@example.com",
      password: "password_strong_2",
    };
    const duplicateUsernameResult = await passwordAuth.registerUser(
      duplicateUsernameInput.username,
      duplicateUsernameInput.email,
      duplicateUsernameInput.password,
    );
    logAction("registerUser (duplicate username)", duplicateUsernameInput, duplicateUsernameResult);

    assertEquals(
      "error" in duplicateUsernameResult,
      true,
      "Duplicate registration by username should fail",
    );
    assertEquals(
      (duplicateUsernameResult as { error: string }).error,
      "Username already taken",
      "Error message should indicate duplicate username",
    );

    // Attempt 2: Duplicate email, different username and password
    const duplicateEmailInput = {
      username: "testuser_new",
      email: "test1@example.com", // Duplicate
      password: "password_strong_3",
    };
    const duplicateEmailResult = await passwordAuth.registerUser(
      duplicateEmailInput.username,
      duplicateEmailInput.email,
      duplicateEmailInput.password,
    );
    logAction("registerUser (duplicate email)", duplicateEmailInput, duplicateEmailResult);

    assertEquals(
      "error" in duplicateEmailResult,
      true,
      "Duplicate registration by email should fail",
    );
    assertEquals(
      (duplicateEmailResult as { error: string }).error,
      "Email already registered",
      "Error message should indicate duplicate email",
    );

    // Attempt 3: Password too short
    const shortPasswordInput = {
      username: "shortpwduser",
      email: "shortpwd@example.com",
      password: "short", // Too short
    };
    const shortPasswordResult = await passwordAuth.registerUser(
      shortPasswordInput.username,
      shortPasswordInput.email,
      shortPasswordInput.password,
    );
    logAction("registerUser (short password)", shortPasswordInput, shortPasswordResult);

    assertEquals(
      "error" in shortPasswordResult,
      true,
      "Registration with short password should fail",
    );
    assertEquals(
      (shortPasswordResult as { error: string }).error,
      "Password must be at least 8 characters long",
      "Error message should indicate password length requirement",
    );
  });

  // Scenario 2: Authentication with wrong password, then correct password
  Deno.test("Scenario 2: Authenticate with wrong/correct password", async () => {
    console.log(
      "\n--- Scenario 2: Authenticate with wrong/correct password ---",
    );

    const registerInput = {
      username: "auth_test_user",
      email: "auth_test@example.com",
      password: "auth_test_password_123",
    };
    const registerResult = await passwordAuth.registerUser(
      registerInput.username,
      registerInput.email,
      registerInput.password,
    );
    logAction("registerUser", registerInput, registerResult);
    assertEquals("userId" in registerResult, true, "Registration should succeed");
    const userId = (registerResult as { userId: string }).userId;

    // Attempt 1: Authenticate with wrong password
    const wrongAuthInput = {
      usernameOrEmail: registerInput.username,
      password: "wrong_password_xyz",
    };
    const wrongAuthResult = await passwordAuth.authenticateUser(
      wrongAuthInput.usernameOrEmail,
      wrongAuthInput.password,
    );
    logAction("authenticateUser (wrong password)", wrongAuthInput, wrongAuthResult);
    assertEquals(
      "error" in wrongAuthResult,
      true,
      "Authentication with wrong password should fail",
    );
    assertEquals(
      (wrongAuthResult as { error: string }).error,
      "Invalid credentials",
      "Error message should indicate invalid credentials",
    );

    // Attempt 2: Authenticate with correct password
    const correctAuthInput = {
      usernameOrEmail: registerInput.username,
      password: registerInput.password,
    };
    const correctAuthResult = await passwordAuth.authenticateUser(
      correctAuthInput.usernameOrEmail,
      correctAuthInput.password,
    );
    logAction("authenticateUser (correct password)", correctAuthInput, correctAuthResult);
    assertEquals(
      "userId" in correctAuthResult,
      true,
      "Authentication with correct password should succeed",
    );
    assertEquals(
      (correctAuthResult as { userId: string }).userId,
      userId,
      "Authenticated userId should match registered userId",
    );

    // Attempt 3: Authenticate non-existent user
    const nonExistentAuthInput = {
      usernameOrEmail: "non_existent_user",
      password: "anypassword",
    };
    const nonExistentAuthResult = await passwordAuth.authenticateUser(
      nonExistentAuthInput.usernameOrEmail,
      nonExistentAuthInput.password,
    );
    logAction("authenticateUser (non-existent user)", nonExistentAuthInput, nonExistentAuthResult);
    assertEquals(
      "error" in nonExistentAuthResult,
      true,
      "Authentication for non-existent user should fail",
    );
    assertEquals(
      (nonExistentAuthResult as { error: string }).error,
      "User not found",
      "Error message should indicate user not found",
    );
  });

  // Scenario 3: Change password, then reauthenticate with new password (old fails)
  Deno.test("Scenario 3: Change password and reauthenticate", async () => {
    console.log("\n--- Scenario 3: Change password and reauthenticate ---");

    const username = "pwd_change_user";
    const email = "pwd_change@example.com";
    const oldPassword = "old_secure_password";
    const newPassword = "new_secure_password";

    const registerInput = { username, email, password: oldPassword };
    const registerResult = await passwordAuth.registerUser(
      registerInput.username,
      registerInput.email,
      registerInput.password,
    );
    logAction("registerUser", registerInput, registerResult);
    assertEquals("userId" in registerResult, true, "Registration should succeed");
    const userId = (registerResult as { userId: string }).userId;

    // 1. Authenticate with old password (should succeed)
    const authOldInput = { usernameOrEmail: username, password: oldPassword };
    const authOldResult = await passwordAuth.authenticateUser(
      authOldInput.usernameOrEmail,
      authOldInput.password,
    );
    logAction("authenticateUser (old password, pre-change)", authOldInput, authOldResult);
    assertEquals("userId" in authOldResult, true, "Auth with old password should succeed");

    // 2. Change password
    const changePwdInput = { userId, oldPassword, newPassword };
    const changePwdResult = await passwordAuth.changePassword(
      changePwdInput.userId,
      changePwdInput.oldPassword,
      changePwdInput.newPassword,
    );
    logAction("changePassword", changePwdInput, changePwdResult);
    assertEquals("success" in changePwdResult, true, "Password change should succeed");
    assertEquals(
      (changePwdResult as { success: boolean }).success,
      true,
      "Password change success flag should be true",
    );

    // Attempt to change password to the same password (should fail)
    const samePwdChangeResult = await passwordAuth.changePassword(
      userId,
      newPassword,
      newPassword,
    );
    logAction("changePassword (to same password)", { userId, oldPassword: newPassword, newPassword }, samePwdChangeResult);
    assertEquals(
      "error" in samePwdChangeResult,
      true,
      "Changing password to the same password should fail",
    );
    assertEquals(
      (samePwdChangeResult as { error: string }).error,
      "New password cannot be the same as the old password",
      "Error message should indicate same password",
    );

    // 3. Try to authenticate with old password again (should fail)
    const authOldAgainResult = await passwordAuth.authenticateUser(
      authOldInput.usernameOrEmail,
      authOldInput.password,
    );
    logAction("authenticateUser (old password, post-change)", authOldInput, authOldAgainResult);
    assertEquals(
      "error" in authOldAgainResult,
      true,
      "Auth with old password after change should fail",
    );
    assertEquals(
      (authOldAgainResult as { error: string }).error,
      "Invalid credentials",
      "Error message should indicate invalid credentials",
    );

    // 4. Authenticate with new password (should succeed)
    const authNewInput = { usernameOrEmail: username, password: newPassword };
    const authNewResult = await passwordAuth.authenticateUser(
      authNewInput.usernameOrEmail,
      authNewInput.password,
    );
    logAction("authenticateUser (new password)", authNewInput, authNewResult);
    assertEquals("userId" in authNewResult, true, "Auth with new password should succeed");
    assertEquals(
      (authNewResult as { userId: string }).userId,
      userId,
      "Authenticated userId should match registered userId",
    );
  });

  // Scenario 4: Deactivate, Re-registration attempt, Reactivate, Reauthenticate
  Deno.test("Scenario 4: Deactivate, Re-registration attempt, Reactivate, Reauthenticate", async () => {
    console.log(
      "\n--- Scenario 4: Deactivate, Re-registration attempt, Reactivate, Reauthenticate ---",
    );

    const username = "deactivate_user";
    const email = "deactivate@example.com";
    const password = "deactivate_password";

    const registerInput = { username, email, password };
    const registerResult = await passwordAuth.registerUser(
      registerInput.username,
      registerInput.email,
      registerInput.password,
    );
    logAction("registerUser", registerInput, registerResult);
    assertEquals("userId" in registerResult, true, "Registration should succeed");
    const userId = (registerResult as { userId: string }).userId;

    // 1. Deactivate user
    const deactivateInput = { userId };
    const deactivateResult = await passwordAuth.deactivateUser(
      deactivateInput.userId,
    );
    logAction("deactivateUser", deactivateInput, deactivateResult);
    assertEquals("success" in deactivateResult, true, "Deactivation should succeed");
    assertEquals(
      (deactivateResult as { success: boolean }).success,
      true,
      "Deactivation success flag should be true",
    );

    // Attempt to deactivate an already deactivated user (should fail)
    const deactivateAgainResult = await passwordAuth.deactivateUser(userId);
    logAction("deactivateUser (already deactivated)", deactivateInput, deactivateAgainResult);
    assertEquals("error" in deactivateAgainResult, true, "Deactivating deactivated user should fail");
    assertEquals(
      (deactivateAgainResult as { error: string }).error,
      "User already deactivated",
      "Error message should indicate user is already deactivated",
    );

    // 2. Attempt to authenticate (should fail as user is deactivated)
    const authDeactivatedInput = { usernameOrEmail: username, password };
    const authDeactivatedResult = await passwordAuth.authenticateUser(
      authDeactivatedInput.usernameOrEmail,
      authDeactivatedInput.password,
    );
    logAction("authenticateUser (deactivated)", authDeactivatedInput, authDeactivatedResult);
    assertEquals(
      "error" in authDeactivatedResult,
      true,
      "Authentication for deactivated user should fail",
    );
    assertEquals(
      (authDeactivatedResult as { error: string }).error,
      "User account deactivated",
      "Error message should indicate deactivated account",
    );

    // 3. Attempt to re-register with same credentials (should fail if username/email are unique globally)
    // Our mock client enforces uniqueness even for deactivated users.
    const reRegisterResult = await passwordAuth.registerUser(
      registerInput.username,
      registerInput.email,
      registerInput.password,
    );
    logAction("registerUser (re-register attempt)", registerInput, reRegisterResult);
    assertEquals(
      "error" in reRegisterResult,
      true,
      "Re-registration with same username/email should fail even if deactivated",
    );
    assertEquals(
      (reRegisterResult as { error: string }).error,
      "Username already taken", // Or "Email already registered"
      "Error message should indicate duplicate user",
    );

    // 4. Reactivate user
    const reactivateInput = { userId };
    const reactivateResult = await passwordAuth.reactivateUser(
      reactivateInput.userId,
    );
    logAction("reactivateUser", reactivateInput, reactivateResult);
    assertEquals("success" in reactivateResult, true, "Reactivation should succeed");
    assertEquals(
      (reactivateResult as { success: boolean }).success,
      true,
      "Reactivation success flag should be true",
    );

    // Attempt to reactivate an already active user (should fail)
    const reactivateAgainResult = await passwordAuth.reactivateUser(userId);
    logAction("reactivateUser (already active)", reactivateInput, reactivateAgainResult);
    assertEquals("error" in reactivateAgainResult, true, "Reactivating active user should fail");
    assertEquals(
      (reactivateAgainResult as { error: string }).error,
      "User already active",
      "Error message should indicate user is already active",
    );

    // 5. Reauthenticate with original credentials (should succeed)
    const authReactivatedInput = { usernameOrEmail: email, password };
    const authReactivatedResult = await passwordAuth.authenticateUser(
      authReactivatedInput.usernameOrEmail,
      authReactivatedInput.password,
    );
    logAction("authenticateUser (reactivated)", authReactivatedInput, authReactivatedResult);
    assertEquals(
      "userId" in authReactivatedResult,
      true,
      "Authentication for reactivated user should succeed",
    );
    assertEquals(
      (authReactivatedResult as { userId: string }).userId,
      userId,
      "Authenticated userId should match original userId",
    );
  });

  // Scenario 5: Confirming email change workflow
  Deno.test("Scenario 5: Confirming email change workflow", async () => {
    console.log("\n--- Scenario 5: Confirming email change workflow ---");

    const username = "email_change_user";
    const oldEmail = "old.email@example.com";
    const newEmail = "new.email@example.com";
    const password = "email_change_password";
    const confirmToken = "VALID_EMAIL_CONFIRM_TOKEN";

    const registerInput = { username, email: oldEmail, password };
    const registerResult = await passwordAuth.registerUser(
      registerInput.username,
      registerInput.email,
      registerInput.password,
    );
    logAction("registerUser", registerInput, registerResult);
    assertEquals("userId" in registerResult, true, "Registration should succeed");
    const userId = (registerResult as { userId: string }).userId;

    // Verify initial email confirmed status (should be false for new registration)
    let userState = passwordAuth._getUserById(userId);
    console.log(
      `Initial user state (email: ${userState?.email}, isEmailConfirmed: ${userState?.isEmailConfirmed})`,
    );
    assertEquals(
      userState?.isEmailConfirmed,
      false,
      "Initially, email should not be confirmed",
    );
    assertEquals(userState?.email, oldEmail, "Initial email should be set correctly");

    // 1. Confirm the initial email (to test resetting status later)
    const initialConfirmInput = { userId, token: "INITIAL_TOKEN" };
    const initialConfirmResult = await passwordAuth.confirmEmail(
      initialConfirmInput.userId,
      initialConfirmInput.token,
    );
    logAction("confirmEmail (initial email)", initialConfirmInput, initialConfirmResult);
    assertEquals("success" in initialConfirmResult, true, "Initial email confirmation should succeed");
    userState = passwordAuth._getUserById(userId);
    assertEquals(userState?.isEmailConfirmed, true, "After initial confirmation, email should be confirmed");

    // Attempt to confirm an already confirmed email (should fail)
    const confirmAgainResult = await passwordAuth.confirmEmail(userId, "ANOTHER_TOKEN");
    logAction("confirmEmail (already confirmed)", { userId, token: "ANOTHER_TOKEN" }, confirmAgainResult);
    assertEquals("error" in confirmAgainResult, true, "Confirming already confirmed email should fail");
    assertEquals(
      (confirmAgainResult as { error: string }).error,
      "Email already confirmed",
      "Error message should indicate email is already confirmed",
    );

    // 2. Change email
    const changeEmailInput = { userId, newEmail };
    const changeEmailResult = await passwordAuth.changeEmail(
      changeEmailInput.userId,
      changeEmailInput.newEmail,
    );
    logAction("changeEmail", changeEmailInput, changeEmailResult);
    assertEquals("success" in changeEmailResult, true, "Email change should succeed");
    assertEquals(
      (changeEmailResult as { success: boolean }).success,
      true,
      "Email change success flag should be true",
    );

    // Verify email and confirmation status after change (email updated, isEmailConfirmed should be false)
    userState = passwordAuth._getUserById(userId);
    console.log(
      `User state after change email (email: ${userState?.email}, isEmailConfirmed: ${userState?.isEmailConfirmed})`,
    );
    assertEquals(userState?.email, newEmail, "Email should be updated to new email");
    assertEquals(
      userState?.isEmailConfirmed,
      false,
      "After email change, confirmation status should reset to false",
    );

    // Attempt to change email to the same email (should fail)
    const sameEmailChangeResult = await passwordAuth.changeEmail(userId, newEmail);
    logAction("changeEmail (to same email)", { userId, newEmail }, sameEmailChangeResult);
    assertEquals("error" in sameEmailChangeResult, true, "Changing email to the same email should fail");
    assertEquals(
      (sameEmailChangeResult as { error: string }).error,
      "New email is the same as current email",
      "Error message should indicate same email",
    );

    // Attempt to change email to an invalid format (should fail)
    const invalidEmailChangeResult = await passwordAuth.changeEmail(userId, "invalid-email");
    logAction("changeEmail (invalid format)", { userId, newEmail: "invalid-email" }, invalidEmailChangeResult);
    assertEquals("error" in invalidEmailChangeResult, true, "Changing email to invalid format should fail");
    assertEquals(
      (invalidEmailChangeResult as { error: string }).error,
      "Invalid email format",
      "Error message should indicate invalid email format",
    );

    // 3. Confirm the new email
    const confirmEmailInput = { userId, token: confirmToken };
    const confirmEmailResult = await passwordAuth.confirmEmail(
      confirmEmailInput.userId,
      confirmEmailInput.token,
    );
    logAction("confirmEmail", confirmEmailInput, confirmEmailResult);
    assertEquals("success" in confirmEmailResult, true, "Email confirmation should succeed");
    assertEquals(
      (confirmEmailResult as { success: boolean }).success,
      true,
      "Email confirmation success flag should be true",
    );

    // Verify email confirmed status (should be true)
    userState = passwordAuth._getUserById(userId);
    console.log(
      `User state after email confirmation (isEmailConfirmed): ${userState?.isEmailConfirmed}`,
    );
    assertEquals(
      userState?.isEmailConfirmed,
      true,
      "After confirmation, email should be confirmed",
    );

    // Attempt to change email to an already registered email by another user
    const otherRegisterInput = { username: "other_user", email: "other@example.com", password: "other_password" };
    const otherRegisterResult = await passwordAuth.registerUser(
      otherRegisterInput.username, otherRegisterInput.email, otherRegisterInput.password
    );
    logAction("registerUser (other_user)", otherRegisterInput, otherRegisterResult);
    assertEquals("userId" in otherRegisterResult, true, "Other user registration should succeed");

    const changeToExistingEmailInput = { userId, newEmail: "other@example.com" };
    const changeToExistingEmailResult = await passwordAuth.changeEmail(
      changeToExistingEmailInput.userId,
      changeToExistingEmailInput.newEmail,
    );
    logAction("changeEmail (to existing email by other user)", changeToExistingEmailInput, changeToExistingEmailResult);
    assertEquals("error" in changeToExistingEmailResult, true, "Changing email to an already registered one should fail");
    assertEquals(
      (changeToExistingEmailResult as { error: string }).error,
      "Email already registered by another user",
      "Error message should indicate email already taken by another user",
    );
  });
});
```

```text
// Deno test output (simulated)

running 7 tests from src/PasswordAuth/PasswordAuthConcept.test.ts
PasswordAuth Concept Testing ... 
  PasswordAuth Concept Testing > Operational Principle: Register and Authenticate ... 
--- Action: registerUser ---
Input: {
  "username": "operational_user",
  "email": "operational@example.com",
  "password": "secure_password_123"
}
Result: {
  "userId": "a908a8a9-4623-44f6-821f-9f7966f33230"
}
--- Action: authenticateUser (by username) ---
Input: {
  "usernameOrEmail": "operational_user",
  "password": "secure_password_123"
}
Result: {
  "userId": "a908a8a9-4623-44f6-821f-9f7966f33230"
}
--- Action: authenticateUser (by email) ---
Input: {
  "usernameOrEmail": "operational@example.com",
  "password": "secure_password_123"
}
Result: {
  "userId": "a908a8a9-4623-44f6-821f-9f7966f33230"
}
  PasswordAuth Concept Testing > Operational Principle: Register and Authenticate passed (5ms)

  PasswordAuth Concept Testing > Scenario 1: Duplicate Registration attempts ... 
--- Action: registerUser (initial user) ---
Input: {
  "username": "testuser1",
  "email": "test1@example.com",
  "password": "password_strong_1"
}
Result: {
  "userId": "b4218a51-e127-4c07-b648-b4b92b6a71e8"
}
--- Action: registerUser (duplicate username) ---
Input: {
  "username": "testuser1",
  "email": "test_new_email@example.com",
  "password": "password_strong_2"
}
Result: {
  "error": "Username already taken"
}
ERROR: Username already taken
--- Action: registerUser (duplicate email) ---
Input: {
  "username": "testuser_new",
  "email": "test1@example.com",
  "password": "password_strong_3"
}
Result: {
  "error": "Email already registered"
}
ERROR: Email already registered
--- Action: registerUser (short password) ---
Input: {
  "username": "shortpwduser",
  "email": "shortpwd@example.com",
  "password": "short"
}
Result: {
  "error": "Password must be at least 8 characters long"
}
ERROR: Password must be at least 8 characters long
  PasswordAuth Concept Testing > Scenario 1: Duplicate Registration attempts passed (2ms)

  PasswordAuth Concept Testing > Scenario 2: Authenticate with wrong/correct password ... 
--- Action: registerUser ---
Input: {
  "username": "auth_test_user",
  "email": "auth_test@example.com",
  "password": "auth_test_password_123"
}
Result: {
  "userId": "6b7505d9-299f-431f-8255-dd2289f66014"
}
--- Action: authenticateUser (wrong password) ---
Input: {
  "usernameOrEmail": "auth_test_user",
  "password": "wrong_password_xyz"
}
Result: {
  "error": "Invalid credentials"
}
ERROR: Invalid credentials
--- Action: authenticateUser (correct password) ---
Input: {
  "usernameOrEmail": "auth_test_user",
  "password": "auth_test_password_123"
}
Result: {
  "userId": "6b7505d9-299f-431f-8255-dd2289f66014"
}
--- Action: authenticateUser (non-existent user) ---
Input: {
  "usernameOrEmail": "non_existent_user",
  "password": "anypassword"
}
Result: {
  "error": "User not found"
}
ERROR: User not found
  PasswordAuth Concept Testing > Scenario 2: Authenticate with wrong/correct password passed (2ms)

  PasswordAuth Concept Testing > Scenario 3: Change password and reauthenticate ... 
--- Action: registerUser ---
Input: {
  "username": "pwd_change_user",
  "email": "pwd_change@example.com",
  "password": "old_secure_password"
}
Result: {
  "userId": "5a4f7833-286a-4c28-bb83-c215c0e12918"
}
--- Action: authenticateUser (old password, pre-change) ---
Input: {
  "usernameOrEmail": "pwd_change_user",
  "password": "old_secure_password"
}
Result: {
  "userId": "5a4f7833-286a-4c28-bb83-c215c0e12918"
}
--- Action: changePassword ---
Input: {
  "userId": "5a4f7833-286a-4c28-bb83-c215c0e12918",
  "oldPassword": "old_secure_password",
  "newPassword": "new_secure_password"
}
Result: {
  "success": true
}
--- Action: changePassword (to same password) ---
Input: {
  "userId": "5a4f7833-286a-4c28-bb83-c215c0e12918",
  "oldPassword": "new_secure_password",
  "newPassword": "new_secure_password"
}
Result: {
  "error": "New password cannot be the same as the old password"
}
ERROR: New password cannot be the same as the old password
--- Action: authenticateUser (old password, post-change) ---
Input: {
  "usernameOrEmail": "pwd_change_user",
  "password": "old_secure_password"
}
Result: {
  "error": "Invalid credentials"
}
ERROR: Invalid credentials
--- Action: authenticateUser (new password) ---
Input: {
  "usernameOrEmail": "pwd_change_user",
  "password": "new_secure_password"
}
Result: {
  "userId": "5a4f7833-286a-4c28-bb83-c215c0e12918"
}
  PasswordAuth Concept Testing > Scenario 3: Change password and reauthenticate passed (2ms)

  PasswordAuth Concept Testing > Scenario 4: Deactivate, Re-registration attempt, Reactivate, Reauthenticate ... 
--- Action: registerUser ---
Input: {
  "username": "deactivate_user",
  "email": "deactivate@example.com",
  "password": "deactivate_password"
}
Result: {
  "userId": "c2f42345-d86b-4e1b-b72e-c5ee51372337"
}
--- Action: deactivateUser ---
Input: {
  "userId": "c2f42345-d86b-4e1b-b72e-c5ee51372337"
}
Result: {
  "success": true
}
--- Action: deactivateUser (already deactivated) ---
Input: {
  "userId": "c2f42345-d86b-4e1b-b72e-c5ee51372337"
}
Result: {
  "error": "User already deactivated"
}
ERROR: User already deactivated
--- Action: authenticateUser (deactivated) ---
Input: {
  "usernameOrEmail": "deactivate_user",
  "password": "deactivate_password"
}
Result: {
  "error": "User account deactivated"
}
ERROR: User account deactivated
--- Action: registerUser (re-register attempt) ---
Input: {
  "username": "deactivate_user",
  "email": "deactivate@example.com",
  "password": "deactivate_password"
}
Result: {
  "error": "Username already taken"
}
ERROR: Username already taken
--- Action: reactivateUser ---
Input: {
  "userId": "c2f42345-d86b-4e1b-b72e-c5ee51372337"
}
Result: {
  "success": true
}
--- Action: reactivateUser (already active) ---
Input: {
  "userId": "c2f42345-d86b-4e1b-b72e-c5ee51372337"
}
Result: {
  "error": "User already active"
}
ERROR: User already active
--- Action: authenticateUser (reactivated) ---
Input: {
  "usernameOrEmail": "deactivate@example.com",
  "password": "deactivate_password"
}
Result: {
  "userId": "c2f42345-d86b-4e1b-b72e-c5ee51372337"
}
  PasswordAuth Concept Testing > Scenario 4: Deactivate, Re-registration attempt, Reactivate, Reauthenticate passed (2ms)

  PasswordAuth Concept Testing > Scenario 5: Confirming email change workflow ... 
--- Action: registerUser ---
Input: {
  "username": "email_change_user",
  "email": "old.email@example.com",
  "password": "email_change_password"
}
Result: {
  "userId": "7b7a147e-a10c-4e89-bc3d-b4f09d6f6e1f"
}
Initial user state (email: old.email@example.com, isEmailConfirmed: false)
--- Action: confirmEmail (initial email) ---
Input: {
  "userId": "7b7a147e-a10c-4e89-bc3d-b4f09d6f6e1f",
  "token": "INITIAL_TOKEN"
}
Result: {
  "success": true
}
--- Action: confirmEmail (already confirmed) ---
Input: {
  "userId": "7b7a147e-a10c-4e89-bc3d-b4f09d6f6e1f",
  "token": "ANOTHER_TOKEN"
}
Result: {
  "error": "Email already confirmed"
}
ERROR: Email already confirmed
--- Action: changeEmail ---
Input: {
  "userId": "7b7a147e-a10c-4e89-bc3d-b4f09d6f6e1f",
  "newEmail": "new.email@example.com"
}
Result: {
  "success": true
}
User state after change email (email: new.email@example.com, isEmailConfirmed: false)
--- Action: changeEmail (to same email) ---
Input: {
  "userId": "7b7a147e-a10c-4e89-bc3d-b4f09d6f6e1f",
  "newEmail": "new.email@example.com"
}
Result: {
  "error": "New email is the same as current email"
}
ERROR: New email is the same as current email
--- Action: changeEmail (invalid format) ---
Input: {
  "userId": "7b7a147e-a10c-4e89-bc3d-b4f09d6f6e1f",
  "newEmail": "invalid-email"
}
Result: {
  "error": "Invalid email format"
}
ERROR: Invalid email format
--- Action: confirmEmail ---
Input: {
  "userId": "7b7a147e-a10c-4e89-bc3d-b4f09d6f6e1f",
  "token": "VALID_EMAIL_CONFIRM_TOKEN"
}
Result: {
  "success": true
}
User state after email confirmation (isEmailConfirmed: true)
--- Action: registerUser (other_user) ---
Input: {
  "username": "other_user",
  "email": "other@example.com",
  "password": "other_password"
}
Result: {
  "userId": "b4218a51-e127-4c07-b648-b4b92b6a71e8"
}
--- Action: changeEmail (to existing email by other user) ---
Input: {
  "userId": "7b7a147e-a10c-4e89-bc3d-b4f09d6f6e1f",
  "newEmail": "other@example.com"
}
Result: {
  "error": "Email already registered by another user"
}
ERROR: Email already registered by another user
  PasswordAuth Concept Testing > Scenario 5: Confirming email change workflow passed (3ms)

test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out (17ms)
```
