import { actions, Sync, Frames } from "@engine";
import {
  Accountability,
  CompetitionManager,
  PasswordAuth,
  Requesting,
  Sessioning,
  SleepSchedule,
} from "@concepts";

// ============================================================================
// 1. User Authentication & Session Management
// ============================================================================

// --- Registration ---
export const RegisterRequest: Sync = ({ request, username, password }) => ({
  when: actions([Requesting.request, { path: "/PasswordAuth/register", username, password }, { request }]),
  then: actions([PasswordAuth.register, { username, password }]),
});

export const RegisterResponse: Sync = ({ request, user }) => ({
  when: actions(
    [Requesting.request, { path: "/PasswordAuth/register" }, { request }],
    [PasswordAuth.register, {}, { user }],
  ),
  then: actions([Requesting.respond, { request, user }]),
});

export const RegisterErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/PasswordAuth/register" }, { request }],
    [PasswordAuth.register, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// --- Login & Session Creation ---
export const LoginRequest: Sync = ({ request, username, password }) => ({
  when: actions([Requesting.request, { path: "/PasswordAuth/authenticate", username, password }, { request }]),
  then: actions([PasswordAuth.authenticate, { username, password }]),
});

export const CreateSessionOnLogin: Sync = ({ user, request }) => ({
  when: actions(
    [Requesting.request, { path: "/PasswordAuth/authenticate" }, { request }],
    [PasswordAuth.authenticate, {}, { user }],
  ),
  then: actions([Sessioning.create, { user }]),
});

export const LoginResponse: Sync = ({ request, session }) => ({
  when: actions(
    [Requesting.request, { path: "/PasswordAuth/authenticate" }, { request }],
    [Sessioning.create, {}, { session }],
  ),
  then: actions([Requesting.respond, { request, session }]),
});

export const LoginErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/PasswordAuth/authenticate" }, { request }],
    [PasswordAuth.authenticate, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// --- Logout ---
export const LogoutRequest: Sync = ({ request, session }) => ({
  when: actions([Requesting.request, { path: "/Sessioning/delete", session }, { request }]),
  then: actions([Sessioning.delete, { session }]),
});

export const LogoutResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/Sessioning/delete" }, { request }],
    [Sessioning.delete, {}, {}],
  ),
  then: actions([Requesting.respond, { request, status: "logged_out" }]),
});

export const LogoutErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/Sessioning/delete" }, { request }],
    [Sessioning.delete, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// 2. Core Logic: Reacting to Sleep Reports
// ============================================================================

// When a user reports bedtime, update their competition stats.
export const UpdateCompetitionStatOnBedTime: Sync = ({ u, dateStr, bedTimeSuccess }) => ({
  when: actions([SleepSchedule.reportBedTime, { u, dateStr }, { bedTimeSuccess }]),
  then: actions([CompetitionManager.recordStat, { u, dateStr, eventType: "BEDTIME", success: bedTimeSuccess }]),
});

// When a user reports wake-up time, update their competition stats.
export const UpdateCompetitionStatOnWakeTime: Sync = ({ u, dateStr, wakeUpSuccess }) => ({
  when: actions([SleepSchedule.reportWakeUpTime, { u, dateStr }, { wakeUpSuccess }]),
  then: actions([CompetitionManager.recordStat, { u, dateStr, eventType: "WAKETIME", success: wakeUpSuccess }]),
});

// When a user FAILS a bedtime report, record it for accountability and trigger an update.
export const RecordFailureOnBedTime: Sync = ({ u, dateStr }) => ({
  when: actions([SleepSchedule.reportBedTime, { u, dateStr }, { bedTimeSuccess: false }]),
  then: actions(
    [Accountability.recordFailure, { user: u, date: dateStr, failureType: "BEDTIME" }],
    [Accountability.updateReports, { user: u, date: dateStr }],
  ),
});

// When a user FAILS a wake-up time report, record it for accountability and trigger an update.
export const RecordFailureOnWakeTime: Sync = ({ u, dateStr }) => ({
  when: actions([SleepSchedule.reportWakeUpTime, { u, dateStr }, { wakeUpSuccess: false }]),
  then: actions(
    [Accountability.recordFailure, { user: u, date: dateStr, failureType: "WAKETIME" }],
    [Accountability.updateReports, { user: u, date: dateStr }],
  ),
});

// ============================================================================
// 3. API Endpoints (Authenticated Requests)
// ============================================================================

// --- SleepSchedule Endpoints ---

export const ReportBedTimeRequest: Sync = ({ request, session, user, reportedTimeStr, dateStr }) => ({
  when: actions([Requesting.request, { path: "/SleepSchedule/reportBedTime", session, reportedTimeStr, dateStr }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([SleepSchedule.reportBedTime, { u: user, reportedTimeStr, dateStr }]),
});
export const ReportBedTimeResponse: Sync = ({ request, bedTimeSuccess }) => ({
  when: actions(
    [Requesting.request, { path: "/SleepSchedule/reportBedTime" }, { request }],
    [SleepSchedule.reportBedTime, {}, { bedTimeSuccess }],
  ),
  then: actions([Requesting.respond, { request, bedTimeSuccess }]),
});

export const ReportWakeUpTimeRequest: Sync = ({ request, session, user, reportedTimeStr, dateStr }) => ({
  when: actions([Requesting.request, { path: "/SleepSchedule/reportWakeUpTime", session, reportedTimeStr, dateStr }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([SleepSchedule.reportWakeUpTime, { u: user, reportedTimeStr, dateStr }]),
});
export const ReportWakeUpTimeResponse: Sync = ({ request, wakeUpSuccess }) => ({
  when: actions(
    [Requesting.request, { path: "/SleepSchedule/reportWakeUpTime" }, { request }],
    [SleepSchedule.reportWakeUpTime, {}, { wakeUpSuccess }],
  ),
  then: actions([Requesting.respond, { request, wakeUpSuccess }]),
});

export const AddSleepSlotRequest: Sync = ({ request, session, user, bedTimeStr, wakeTimeStr, toleranceMins, dateStr }) => ({
  when: actions([Requesting.request, { path: "/SleepSchedule/addSleepSlot", session, bedTimeStr, wakeTimeStr, toleranceMins, dateStr }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([SleepSchedule.addSleepSlot, { u: user, bedTimeStr, wakeTimeStr, toleranceMins, dateStr }]),
});
export const AddSleepSlotResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/SleepSchedule/addSleepSlot" }, { request }],
    [SleepSchedule.addSleepSlot, {}, {}],
  ),
  then: actions([Requesting.respond, { request, success: true }]),
});

export const RemoveSleepSlotRequest: Sync = ({ request, session, user, dateStr }) => ({
  when: actions([Requesting.request, { path: "/SleepSchedule/removeSleepSlot", session, dateStr }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([SleepSchedule.removeSleepSlot, { u: user, dateStr }]),
});
export const RemoveSleepSlotResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/SleepSchedule/removeSleepSlot" }, { request }],
    [SleepSchedule.removeSleepSlot, {}, {}],
  ),
  then: actions([Requesting.respond, { request, success: true }]),
});
export const RemoveSleepSlotErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/SleepSchedule/removeSleepSlot" }, { request }],
    [SleepSchedule.removeSleepSlot, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// --- CompetitionManager Endpoints ---

export const StartCompetitionRequest: Sync = ({ request, session, user, name, participants, startDateStr, endDateStr }) => ({
  when: actions([Requesting.request, { path: "/CompetitionManager/startCompetition", session, name, participants, startDateStr, endDateStr }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([CompetitionManager.startCompetition, { name, participants, startDateStr, endDateStr }]),
});
export const StartCompetitionResponse: Sync = ({ request, competitionId }) => ({
  when: actions(
    [Requesting.request, { path: "/CompetitionManager/startCompetition" }, { request }],
    [CompetitionManager.startCompetition, {}, { competitionId }],
  ),
  then: actions([Requesting.respond, { request, competitionId }]),
});
export const StartCompetitionErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/CompetitionManager/startCompetition" }, { request }],
    [CompetitionManager.startCompetition, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// --- Accountability Endpoints ---

export const AddPartnerRequest: Sync = ({ request, session, user, partner, notifyTypes, reportFrequency }) => ({
  when: actions([Requesting.request, { path: "/Accountability/addPartner", session, partner, notifyTypes, reportFrequency }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([Accountability.addPartner, { user, partner, notifyTypes, reportFrequency }]),
});
export const AddPartnerResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/Accountability/addPartner" }, { request }],
    [Accountability.addPartner, {}, {}],
  ),
  then: actions([Requesting.respond, { request, success: true }]),
});
export const AddPartnerErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/Accountability/addPartner" }, { request }],
    [Accountability.addPartner, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

export const UpdatePreferencesRequest: Sync = ({ request, session, user, partner, notifyTypes, reportFrequency }) => ({
  when: actions([Requesting.request, { path: "/Accountability/updatePreferences", session, partner, notifyTypes, reportFrequency }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([Accountability.updatePreferences, { user, partner, notifyTypes, reportFrequency }]),
});
export const UpdatePreferencesResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/Accountability/updatePreferences" }, { request }],
    [Accountability.updatePreferences, {}, {}],
  ),
  then: actions([Requesting.respond, { request, success: true }]),
});
export const UpdatePreferencesErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/Accountability/updatePreferences" }, { request }],
    [Accountability.updatePreferences, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

export const RemovePartnerRequest: Sync = ({ request, session, user, partner }) => ({
  when: actions([Requesting.request, { path: "/Accountability/removePartner", session, partner }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([Accountability.removePartner, { user, partner }]),
});
export const RemovePartnerResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/Accountability/removePartner" }, { request }],
    [Accountability.removePartner, {}, {}],
  ),
  then: actions([Requesting.respond, { request, success: true }]),
});
export const RemovePartnerErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/Accountability/removePartner" }, { request }],
    [Accountability.removePartner, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// 4. API Endpoints for Queries (Authenticated)
// ============================================================================

export const GetMyCompetitionsRequest: Sync = ({ request, session, user, competitions }) => ({
  when: actions([Requesting.request, { path: "/CompetitionManager/_getCompetitionsForUser", session }, { request }]),
  where: async (frames: Frames) => {
    frames = await frames.query(Sessioning._getUser, { session }, { user });
    return await frames.query(CompetitionManager._getCompetitionsForUser, { user }, { competitions });
  },
  then: actions([Requesting.respond, { request, competitions }]),
});

export const GetLeaderboardRequest: Sync = ({ request, session, competitionId, leaderboard }) => ({
  when: actions([Requesting.request, { path: "/CompetitionManager/_getLeaderboard", session, competitionId }, { request }]),
  where: async (frames: Frames) => {
    frames = await frames.query(Sessioning._getUser, { session }, {}); // Auth check
    return await frames.query(CompetitionManager._getLeaderboard, { competitionId }, { leaderboard });
  },
  then: actions([Requesting.respond, { request, leaderboard }]),
});

export const GetMySleepSlotsRequest: Sync = ({ request, session, user, sleepSlots }) => ({
  when: actions([Requesting.request, { path: "/SleepSchedule/_getAllSleepSlotsForUser", session }, { request }]),
  where: async (frames: Frames) => {
    frames = await frames.query(Sessioning._getUser, { session }, { user });
    const resultFrames = await frames.query(SleepSchedule._getAllSleepSlotsForUser, { u: user }, { sleepSlots });
    // The query returns an array of slots in a single 'sleepSlots' binding. We need to respond with that array.
    if (resultFrames.length > 0) {
      const allSlots = resultFrames.flatMap(frame => frame[sleepSlots] || []);
      return new Frames({ ...resultFrames[0], [sleepSlots]: allSlots });
    }
    return new Frames({ ...frames[0], [sleepSlots]: [] });
  },
  then: actions([Requesting.respond, { request, results: sleepSlots }]), // Respond with the collected array
});

export const GetMyPartnershipsRequest: Sync = ({ request, session, user, partnership, partnerships }) => ({
  when: actions([Requesting.request, { path: "/Accountability/_getPartnerships", session }, { request }]),
  where: async (frames: Frames) => {
    const originalFrame = frames[0];
    frames = await frames.query(Sessioning._getUser, { session }, { user });
    if (frames.length === 0) {
      return new Frames({ ...originalFrame, [partnerships]: [] });
    }
    // Query now returns Array<{partnership: Partnership}> - each becomes a separate frame
    // Use collectAs to collect all partnerships into a single array
    const resultFrames = await frames.query(Accountability._getPartnerships, { user }, { partnership });
    if (resultFrames.length > 0) {
      const collected = resultFrames.collectAs([partnership], partnerships);
      return new Frames({ ...originalFrame, ...frames[0], ...collected[0] });
    }
    // No partnerships found - return empty array
    return new Frames({ ...originalFrame, ...frames[0], [partnerships]: [] });
  },
  then: actions([Requesting.respond, { request, results: partnerships }]),
});
