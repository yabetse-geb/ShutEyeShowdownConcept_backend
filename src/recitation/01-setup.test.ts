import { assertEquals, assertExists } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import LeaderboardConcept from "./LeaderboardConcept.ts";
import { Collection } from "npm:mongodb";

Deno.test("Leaderboard Concept - 01 Setup", async (t) => {
  const [db, client] = await testDb();

  await t.step("It should initialize the concept class", () => {
    // This step confirms our basic setup is correct and the class can be instantiated.
    const leaderboard = new LeaderboardConcept(db);

    // This assertion checks that our `leaderboard` object was created successfully.
    assertExists(leaderboard, "The LeaderboardConcept instance should be created.");
  });

  await t.step("It should correctly initialize its collections", () => {
    // This is a more meaningful test: does our constructor work as expected?
    // We want to ensure that the class properties `players` and `scores` are
    // valid MongoDB Collection objects, ready to be used.
    const leaderboard = new LeaderboardConcept(db);

    // Check that the `players` collection is a valid Collection object.
    assertExists(leaderboard.players);
    assertEquals(leaderboard.players instanceof Collection, true);
    assertEquals(leaderboard.players.collectionName, "Leaderboard.players");

    // Check that the `scores` collection is also set up correctly.
    assertExists(leaderboard.scores);
    assertEquals(leaderboard.scores instanceof Collection, true);
    assertEquals(leaderboard.scores.collectionName, "Leaderboard.scores");
  });

  // It's important to close the database connection after tests are done.
  await client.close();
});