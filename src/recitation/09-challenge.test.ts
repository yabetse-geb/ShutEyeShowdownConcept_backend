import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import LeaderboardConcept from "./LeaderboardConcept.ts";
import { ID } from "@utils/types.ts";

Deno.test("Leaderboard Concept - 09 Twist: Player Statistics", async (t) => {
  const [db, client] = await testDb();
  const leaderboard = new LeaderboardConcept(db);

  // Setup: Create two players and submit several scores for the first one.
  const { player: isabelleId } =
    (await leaderboard.createPlayer({ name: "Isabelle" })) as { player: ID };
  const { player: jackId } =
    (await leaderboard.createPlayer({ name: "Jack" })) as { player: ID };

  await leaderboard.submitScore({ player: isabelleId, value: 100 });
  await leaderboard.submitScore({ player: isabelleId, value: 200 });
  await leaderboard.submitScore({ player: isabelleId, value: 300 });
  // Add a score for another player to ensure our aggregation only targets Isabelle.
  await leaderboard.submitScore({ player: jackId, value: 999 });

  await t.step("should calculate correct statistics for a player", async () => {
    // INSTRUCTION: Go to `LeaderboardConcept.ts` and implement the `_getPlayerStats` query.
    // This will require using the MongoDB Aggregation Pipeline.
    const stats = await leaderboard._getPlayerStats({ player: isabelleId });

    assertExists(
      stats,
      "The stats object should not be null for a player with scores.",
    );

    // Check if the calculated stats are correct.
    assertEquals(
      stats.totalScores,
      3,
      "Isabelle should have 3 scores counted.",
    );
    assertEquals(
      stats.highestScore,
      300,
      "Isabelle's highest score should be 300.",
    );
    assertEquals(
      stats.averageScore,
      200,
      "Isabelle's average score should be (100+200+300)/3 = 200.",
    );
  });

  await t.step("should return null for a player with no scores", async () => {
    // Setup: Create a new player who hasn't submitted any scores.
    const { player: kiloId } =
      (await leaderboard.createPlayer({ name: "Kilo" })) as { player: ID };

    const stats = await leaderboard._getPlayerStats({ player: kiloId });

    // Assert: The result should be null, indicating no data to aggregate.
    assertEquals(
      stats,
      null,
      "Should return null for a player with zero scores.",
    );
  });

  await client.close();
});
