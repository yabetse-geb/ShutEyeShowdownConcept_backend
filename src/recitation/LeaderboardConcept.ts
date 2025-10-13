import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Collection prefix to avoid name clashes
const PREFIX = "Leaderboard" + ".";

// Define the types for our entities based on the concept state
type Player = ID;
type Score = ID;

/**
 * a set of Players with
 *   a name String
 */
interface PlayerDoc {
  _id: Player;
  name: string;
}

/**
 * a set of Scores with
 *   a player Player
 *   a value Number
 *   a submittedAt Date
 */
interface ScoreDoc {
  _id: Score;
  player: Player;
  value: number;
  submittedAt: Date;
}

/**
 * Interface for our player stats query.
 */
export interface PlayerStats {
  totalScores: number;
  highestScore: number;
  averageScore: number;
}

/**
 * @concept Leaderboard
 * @purpose To rank players based on scores they achieve.
 */
export default class LeaderboardConcept {
  players: Collection<PlayerDoc>;
  scores: Collection<ScoreDoc>;

  constructor(private readonly db: Db) {
    this.players = this.db.collection(PREFIX + "players");
    this.scores = this.db.collection(PREFIX + "scores");
  }

  /**
   * Creates a new player.
   * @requires A player with the given name does not already exist.
   * @effects A new player is created with the given name and a unique ID.
   */
  async createPlayer(
    { name }: { name: string },
  ): Promise<{ player: Player } | { error: string }> {
    // TODO (from 02-createPlayer.test.ts)
    // 1. Check if a player with the given name already exists. Use `findOne`.
    //    If they do, return an error: { error: "Player with this name already exists" }
    // 2. If not, create a new player document with a fresh ID and the given name.
    // 3. Insert the new document into the `players` collection using `insertOne`.
    // 4. Return the new player's ID: { player: newPlayerId }
    // throw new Error("Not implemented");
    const existingPlayer= await this.players.findOne({name: name});
    if (existingPlayer) {
      return {error: "Player with this name already exists"};
    }
    //create a new player document with a fresh ID and the given name
    this.players.insertOne({_id:freshID(), name:name});
    const newPlayer= await this.players.findOne({name: name});

    return {player: newPlayer._id};

  }

  /**
   * Submits a new score for a player.
   * @requires The player with the given ID exists.
   * @effects A new score is recorded for the player.
   */
  async submitScore(
    { player, value }: { player: Player; value: number },
  ): Promise<{ score: Score } | { error: string }> {
    // TODO (from 07-errorHandling.test.ts)
    // Add a check here: before inserting a score, verify the player exists.
    // Use `findOne` on the `players` collection with the player's ID.
    // If no player is found, return { error: "Player not found" }.

    // TODO (from 03-submitScore.test.ts)
    // 1. Create a new score document with a fresh ID.
    // 2. The document should include the player's ID, the score value, and the current date (`new Date()`).
    // 3. Insert the document into the `scores` collection.
    // 4. Return the new score's ID: { score: newScoreId }
    throw new Error("Not implemented");
  }

  /**
   * Fetches all scores for a specific player.
   */
  async _getPlayerScores({ player }: { player: Player }): Promise<ScoreDoc[]> {
    // TODO (from 04-getPlayerScores.test.ts)
    // 1. Use the `find` method on the `scores` collection.
    // 2. Your filter should find all documents where the `player` field matches the given player ID.
    // 3. Convert the result to an array and return it.
    throw new Error("Not implemented");
  }

  /**
   * Fetches the top scores across all players.
   */
  async _getTopScores({ limit }: { limit: number }): Promise<ScoreDoc[]> {
    const query = this.scores.find();

    // TODO (from 05-getTopScores.test.ts - Part 1: Sorting)
    // 1. Chain the `sort` method to the query.
    // 2. The sort criteria should be on the `value` field in descending order.
    //    Hint: In MongoDB, -1 means descending.

    // TODO (from 05-getTopScores.test.ts - Part 2: Limiting)
    // 1. Chain the `limit` method to the query.
    // 2. Pass the `limit` argument to this method.

    return await query.toArray();
  }

  /**
   * Fetches all scores submitted since a given date.
   */
  async _getScoresSince({ date }: { date: Date }): Promise<ScoreDoc[]> {
    // TODO (from 06-getScoresSince.test.ts)
    // 1. Use the `find` method on the `scores` collection.
    // 2. The filter should look at the `submittedAt` field.
    // 3. Use the "greater than or equal to" ($gte) operator to find scores submitted on or after the given `date`.
    // 4. Convert the result to an array and return it.
    throw new Error("Not implemented");
  }

  async _getPlayerStats(
    { player }: { player: Player },
  ): Promise<PlayerStats | null> {
    // TODO (from 09-twist.test.ts)
    // Use the `aggregate` method on the `scores` collection.
    // The aggregation pipeline should be an array of stages.
    //
    // Stage 1: $match
    //   - Filter the documents to only include scores from the specified `player`.
    //
    // Stage 2: $group
    //   - This stage groups documents together to perform calculations.
    //   - Set `_id: null` to group all matched documents into a single result.
    //   - Use aggregation operators to compute the stats:
    //     - `totalScores`: Use `$count: {}` (or `$sum: 1`).
    //     - `highestScore`: Use `$max: "$value"` to find the max value.
    //     - `averageScore`: Use `$avg: "$value"` to calculate the average.
    //
    // The result of `aggregate` is a cursor. Convert it to an array.
    // If the array is empty (player has no scores), return `null`.
    // Otherwise, return the first (and only) element of the array.
    throw new Error("Not implemented");
  }
}
