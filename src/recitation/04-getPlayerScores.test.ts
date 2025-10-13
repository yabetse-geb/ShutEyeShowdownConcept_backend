import { assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import LeaderboardConcept from "./LeaderboardConcept.ts";
import { ID } from "@utils/types.ts";

Deno.test("Leaderboard Concept - 04 Get Player Scores", async (t) => {
  const [db, client] = await testDb();
  const leaderboard = new LeaderboardConcept(db);

  await t.step("should retrieve all scores for a specific player", async () => {
    // Setup: Create two players
    const player1Result = await leaderboard.createPlayer({ name: "Dave" });
    const player1Id = (player1Result as { player: ID }).player;

    const player2Result = await leaderboard.createPlayer({ name: "Eve" });
    const player2Id = (player2Result as { player: ID }).player;

    // Setup: Submit scores for both players
    await leaderboard.submitScore({ player: player1Id, value: 150 });
    await leaderboard.submitScore({ player: player2Id, value: 200 });
    await leaderboard.submitScore({ player: player1Id, value: 175 });

    // INSTRUCTION: Go to `LeaderboardConcept.ts` and implement the `_getPlayerScores` query method.
    // This query should find documents based on a filter.
    const daveScores = await leaderboard._getPlayerScores({
      player: player1Id,
    });

    // Assert: We should get exactly 2 scores for Dave, and they should have the correct values.
    assertEquals(daveScores.length, 2);
    const daveValues = daveScores.map((s) => s.value).sort();
    assertEquals(daveValues, [150, 175]);
  });

  await client.close();
});
