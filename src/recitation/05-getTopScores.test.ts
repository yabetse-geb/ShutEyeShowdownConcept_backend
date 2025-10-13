import { assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import LeaderboardConcept from "./LeaderboardConcept.ts";
import { ID } from "@utils/types.ts";

Deno.test("Leaderboard Concept - 05 Get Top Scores", async (t) => {
  const [db, client] = await testDb();
  const leaderboard = new LeaderboardConcept(db);

  // Setup: Create a player and submit multiple scores
  const playerResult = await leaderboard.createPlayer({ name: "Frank" });
  const playerId = (playerResult as { player: ID }).player;
  await leaderboard.submitScore({ player: playerId, value: 100 });
  await leaderboard.submitScore({ player: playerId, value: 500 });
  await leaderboard.submitScore({ player: playerId, value: 300 });
  await leaderboard.submitScore({ player: playerId, value: 250 });

  await t.step(
    "should return scores sorted from highest to lowest",
    async () => {
      // INSTRUCTION (Part 1): In `_getTopScores`, implement the sorting logic.
      // The query should sort by the `value` field in descending order.
      const topScores = await leaderboard._getTopScores({ limit: 4 });
      const scoreValues = topScores.map((s) => s.value);
      assertEquals(scoreValues, [500, 300, 250, 100]);
    },
  );

  await t.step("should respect the limit parameter", async () => {
    // INSTRUCTION (Part 2): In `_getTopScores`, implement the limiting logic.
    // The query should only return the number of documents specified by `limit`.
    const top2Scores = await leaderboard._getTopScores({ limit: 2 });
    assertEquals(top2Scores.length, 2);
    const scoreValues = top2Scores.map((s) => s.value);
    assertEquals(scoreValues, [500, 300]);
  });

  await client.close();
});
