/**
 * The Requesting concept exposes passthrough routes by default,
 * which allow POSTs to the route:
 *
 * /{REQUESTING_BASE_URL}/{Concept name}/{action or query}
 *
 * to passthrough directly to the concept action or query.
 * This is a convenient and natural way to expose concepts to
 * the world, but should only be done intentionally for public
 * actions and queries.
 *
 * This file allows you to explicitly set inclusions and exclusions
 * for passthrough routes:
 * - inclusions: those that you can justify their inclusion
 * - exclusions: those to exclude, using Requesting routes instead
 */

/**
 * INCLUSIONS
 *
 * Each inclusion must include a justification for why you think
 * the passthrough is appropriate (e.g. public query).
 *
 * inclusions = {"route": "justification"}
 */

export const inclusions: Record<string, string> = {
  // Feel free to delete these example inclusions
  // "/api/LikertSurvey/_getSurveyQuestions": "this is a public query",
  // "/api/LikertSurvey/_getSurveyResponses": "responses are public",
  // "/api/LikertSurvey/_getRespondentAnswers": "answers are visible",
  // "/api/LikertSurvey/submitResponse": "allow anyone to submit response",
  // "/api/LikertSurvey/updateResponse": "allow anyone to update their response",
  "/api/PasswordAuth/_isRegistered": "public utility to check if username is registered",
  "/api/PasswordAuth/_getUsername": "public lookup of username, low sensitivity",
  "/api/PasswordAuth/_getUserByUsername": "public lookup, useful for admin/frontend lookup",
  "/api/Sessioning/_getUser": "utility to get user from session, commonly needed by frontend",
  "/api/CompetitionManager/_getReportedDates": "read-only schedule data",
  "/api/SleepSchedule/_getSleepSlot": "simple query for user's own sleep slot",
  "/api/Accountability/_getAllReports": "read-only report retrieval for UI",
  "/api/Accountability/_getAccountabilitySeekersForUser": "allows discovering potential partners",
};

/**
 * EXCLUSIONS
 *
 * Excluded routes fall back to the Requesting concept, and will
 * instead trigger the normal Requesting.request action. As this
 * is the intended behavior, no justification is necessary.
 *
 * exclusions = ["route"]
 */

export const exclusions: Array<string> = [
  // Feel free to delete these example exclusions
  // "/api/LikertSurvey/createSurvey",
  // "/api/LikertSurvey/addQuestion",
    // PasswordAuth & Sessioning
  "/api/PasswordAuth/register",
  "/api/PasswordAuth/authenticate",
  "/api/PasswordAuth/changePassword",
  "/api/PasswordAuth/deactivateAccount",
  "/api/Sessioning/create",
  "/api/Sessioning/delete",

  // SleepSchedule
  "/api/SleepSchedule/addSleepSlot",
  "/api/SleepSchedule/removeSleepSlot",
  "/api/SleepSchedule/reportBedTime",
  "/api/SleepSchedule/reportWakeUpTime",
  "/api/SleepSchedule/_getAllSleepSlotsForUser",

  // CompetitionManager
  "/api/CompetitionManager/startCompetition",
  "/api/CompetitionManager/recordStat",
  "/api/CompetitionManager/endCompetition",
  "/api/CompetitionManager/removeParticipant",
  "/api/CompetitionManager/_getCompetitionsForUser",
  "/api/CompetitionManager/_getLeaderboard",

  // Accountability
  "/api/Accountability/addPartner",
  "/api/Accountability/removePartner",
  "/api/Accountability/updatePreferences", // Handled by sync
  "/api/Accountability/recordFailure",
  "/api/Accountability/reportAllFailuresFromStartToEnd",
  "/api/Accountability/updateReports",
  "/api/Accountability/_getPartnerships",
];
