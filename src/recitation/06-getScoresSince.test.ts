import { assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import LeaderboardConcept from "./LeaderboardConcept.ts";
import { ID } from "@utils/types.ts";

Deno.test("Leaderboard Concept - 06 Get Scores Since Date", async (t) => {
  const [db, client] = await testDb();
  const leaderboard = new LeaderboardConcept(db);

  await t.step(
    "should retrieve scores submitted on or after a given date",
    async () => {
      // Setup: Create a player and submit scores with a delay in between.
      const playerResult = await leaderboard.createPlayer({ name: "Grace" });
      const playerId = (playerResult as { player: ID }).player;

      await leaderboard.submitScore({ player: playerId, value: 50 }); // Old score
      await new Promise((resolve) => setTimeout(resolve, 20)); // Wait 20ms
      const midwayPoint = new Date();
      await new Promise((resolve) => setTimeout(resolve, 20)); // Wait another 20ms
      await leaderboard.submitScore({ player: playerId, value: 60 }); // Recent score 1
      await leaderboard.submitScore({ player: playerId, value: 70 }); // Recent score 2

      // INSTRUCTION: Go to `LeaderboardConcept.ts` and implement `_getScoresSince`.
      // This requires using a comparison operator ($gte) in your find query.
      const recentScores = await leaderboard._getScoresSince({
        date: midwayPoint,
      });

      // Assert: We should only get the two scores submitted after the midway point.
      assertEquals(recentScores.length, 2);
      const recentValues = recentScores.map((s) => s.value).sort();
      assertEquals(recentValues, [60, 70]);
    },
  );

  await client.close();
});
