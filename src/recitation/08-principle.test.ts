import { assertEquals, assertExists } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import LeaderboardConcept from "./LeaderboardConcept.ts";
import { ID } from "@utils/types.ts";

Deno.test("Leaderboard Concept - 08 Operational Principle", async (t) => {
  const [db, client] = await testDb();
  const leaderboard = new LeaderboardConcept(db);

  await t.step(
    "should demonstrate the principle: ranking players by score",
    async () => {
      console.log("\n# Trace: Fulfilling the Leaderboard Principle");
      console.log(
        "The principle states: 'If multiple players submit scores, the leaderboard will reflect their rankings, with the highest scores appearing first.' Let's test this scenario.",
      );

      // =================================================================
      // 1. Setup: Create multiple players
      // =================================================================
      console.log("\n## 1. Setup: Creating Players");
      const { player: aliceId } =
        (await leaderboard.createPlayer({ name: "Alice" })) as { player: ID };
      console.log(
        `- Action: createPlayer({ name: "Alice" }) -> Result: Player 'Alice' created with ID: \`${aliceId}\``,
      );

      const { player: bobId } =
        (await leaderboard.createPlayer({ name: "Bob" })) as { player: ID };
      console.log(
        `- Action: createPlayer({ name: "Bob" }) -> Result: Player 'Bob' created with ID: \`${bobId}\``,
      );

      const { player: charlieId } =
        (await leaderboard.createPlayer({ name: "Charlie" })) as { player: ID };
      console.log(
        `- Action: createPlayer({ name: "Charlie" }) -> Result: Player 'Charlie' created with ID: \`${charlieId}\``,
      );

      // We create a simple map to look up player names for our trace output.
      const playerNames: Record<ID, string> = {
        [aliceId]: "Alice",
        [bobId]: "Bob",
        [charlieId]: "Charlie",
      };

      // =================================================================
      // 2. Action: Players submit scores in a mixed order
      // =================================================================
      console.log("\n## 2. Action: Submitting Scores");
      await leaderboard.submitScore({ player: bobId, value: 150 });
      console.log(`- Bob submits a score of 150.`);
      await leaderboard.submitScore({ player: aliceId, value: 300 });
      console.log(`- Alice submits a score of 300.`);
      await leaderboard.submitScore({ player: charlieId, value: 50 });
      console.log(`- Charlie submits a score of 50.`);
      await leaderboard.submitScore({ player: bobId, value: 100 });
      console.log(`- Bob submits another, lower score of 100.`);
      await leaderboard.submitScore({ player: aliceId, value: 500 });
      console.log(`- Alice submits another, much higher score of 500.`);

      // =================================================================
      // 3. Verification: Query the leaderboard for the top scores
      // =================================================================
      console.log("\n## 3. Verification: Querying the Leaderboard");
      console.log(
        "- Querying for the top 5 scores using `_getTopScores({ limit: 5 })`...\n",
      );
      const topScores = await leaderboard._getTopScores({ limit: 5 });

      console.log("### Top Scores Result:");
      console.log("| Rank | Player  | Score |");
      console.log("|------|---------|-------|");
      topScores.forEach((score, i) => {
        const rank = i + 1;
        const playerName = playerNames[score.player];
        console.log(
          `| ${rank}    | ${playerName.padEnd(7)} | ${score.value}   |`,
        );
      });

      // Programmatic assertions to confirm the test is correct.
      assertEquals(topScores.length, 5);

      const scoreValues = topScores.map((s) => s.value);
      assertEquals(
        scoreValues,
        [500, 300, 150, 100, 50],
        "Scores should be sorted in descending order.",
      );

      assertEquals(topScores[0].player, aliceId, "Alice should be ranked #1.");
      assertEquals(
        topScores[4].player,
        charlieId,
        "Charlie should be ranked #5.",
      );

      console.log(
        "\n✅ Principle successfully demonstrated: The scores are ranked correctly, fulfilling the concept's purpose.",
      );
    },
  );

  await client.close();
});
