import { assertEquals, assertExists } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import LeaderboardConcept from "./LeaderboardConcept.ts";
import { ID } from "@utils/types.ts";

Deno.test("Leaderboard Concept - 03 Submit Score", async (t) => {
  const [db, client] = await testDb();
  const leaderboard = new LeaderboardConcept(db);

  await t.step("should submit a score for an existing player", async () => {
    // First, create a player to submit a score for.
    const playerResult = await leaderboard.createPlayer({ name: "Charlie" });
    const playerId = (playerResult as { player: ID }).player;

    // INSTRUCTION: Go to `LeaderboardConcept.ts` and implement the `submitScore` method.
    const scoreResult = await leaderboard.submitScore({
      player: playerId,
      value: 100,
    });
    assertExists(scoreResult);
    assertEquals("error" in scoreResult, false);

    const { score } = scoreResult as { score: ID };
    assertExists(score);

    // Verify the score exists in the database with the correct data.
    const newScore = await leaderboard.scores.findOne({ _id: score });
    assertExists(newScore);
    assertEquals(newScore.player, playerId);
    assertEquals(newScore.value, 100);
    assertExists(newScore.submittedAt);
  });

  await client.close();
});
