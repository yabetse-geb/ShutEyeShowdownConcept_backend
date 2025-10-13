import { assertEquals, assertExists } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import LeaderboardConcept from "./LeaderboardConcept.ts";
import { ID } from "@utils/types.ts";

Deno.test("Leaderboard Concept - 07 Error Handling", async (t) => {
  const [db, client] = await testDb();
  const leaderboard = new LeaderboardConcept(db);

  await t.step(
    "should return an error when submitting a score for a non-existent player",
    async () => {
      const fakePlayerId = "player:fake-id" as ID;

      // INSTRUCTION: Go to the `submitScore` method in `LeaderboardConcept.ts`.
      // Before inserting a new score, add a check to ensure the player actually exists.
      // If they don't, return an error object.
      const result = await leaderboard.submitScore({
        player: fakePlayerId,
        value: 999,
      });

      assertExists(result);
      assertEquals("error" in result, true);
      assertEquals((result as { error: string }).error, "Player not found");
    },
  );

  await client.close();
});
