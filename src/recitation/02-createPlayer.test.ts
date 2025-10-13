import { assertEquals, assertExists } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import LeaderboardConcept from "./LeaderboardConcept.ts";

Deno.test("Leaderboard Concept - 02 Create Player", async (t) => {
  const [db, client] = await testDb();
  const leaderboard = new LeaderboardConcept(db);

  await t.step("should create a new player successfully", async () => {
    // INSTRUCTION: Go to `LeaderboardConcept.ts` and implement the `createPlayer` method.
    // Your goal is to make this test pass.
    const result = await leaderboard.createPlayer({ name: "Alice" });
    assertExists(result);
    assertEquals("error" in result, false);

    const { player } = result as { player: ID };
    assertExists(player);

    // Verify that the player was actually inserted into the database.
    const newPlayer = await leaderboard.players.findOne({ _id: player });
    assertExists(newPlayer);
    assertEquals(newPlayer.name, "Alice");
  });

  await t.step(
    "should prevent creating players with duplicate names",
    async () => {
      // First, create a player.
      await leaderboard.createPlayer({ name: "Bob" });

      // Then, try to create another player with the same name.
      const result = await leaderboard.createPlayer({ name: "Bob" });
      assertExists(result);
      assertEquals("error" in result, true);
      assertEquals(
        (result as { error: string }).error,
        "Player with this name already exists",
      );
    },
  );

  await client.close();
});
