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

// When reportBedTime succeeds, call recordStat
export const RecordStatOnBedTimeSuccess: Sync = ({ u, dateStr }) => ({
  when: actions([SleepSchedule.reportBedTime, { u, dateStr }, { bedTimeSuccess: true }]),
  then: actions([CompetitionManager.recordStat, { u, dateStr, eventType: "BEDTIME", success: true }]),
});

// When reportBedTime fails, call recordStat (with false)
export const RecordStatOnBedTimeFailure: Sync = ({ u, dateStr }) => ({
  when: actions([SleepSchedule.reportBedTime, { u, dateStr }, { bedTimeSuccess: false }]),
  then: actions([CompetitionManager.recordStat, { u, dateStr, eventType: "BEDTIME", success: false }, {}]),
});

// When reportWakeUpTime succeeds, call recordStat
export const RecordStatOnWakeUpSuccess: Sync = ({ u, dateStr }) => ({
  when: actions([SleepSchedule.reportWakeUpTime, { u, dateStr }, { wakeUpSuccess: true }]),
  then: actions([CompetitionManager.recordStat, { u, dateStr, eventType: "WAKETIME", success: true }]),
});

// When reportWakeUpTime fails, call recordStat (with false)
export const RecordStatOnWakeUpFailure: Sync = ({ u, dateStr }) => ({
  when: actions([SleepSchedule.reportWakeUpTime, { u, dateStr }, { wakeUpSuccess: false }]),
  then: actions([CompetitionManager.recordStat, { u, dateStr, eventType: "WAKETIME", success: false }, {}]),
});

// When a user FAILS a bedtime report, record it for accountability (only if user has partnerships).
export const RecordFailureOnBedTime: Sync = ({ u, dateStr, partnership }) => ({
  when: actions([SleepSchedule.reportBedTime, { u, dateStr }, { bedTimeSuccess: false }]),
  where: async (frames: Frames) => {
    // Check if user has any partnerships where they are the accountability seeker
    const partnershipFrames = await frames.query(Accountability._getPartnerships, { user: u }, { partnership });
    const hasPrimaryPartnership = partnershipFrames.some((frame) => {
      const partnershipRecord = frame[partnership]?.partnership ?? frame[partnership];
      const currentUser = frame[u];
      return partnershipRecord && currentUser && partnershipRecord.user === currentUser;
    });
    return hasPrimaryPartnership ? partnershipFrames : new Frames();
  },
  then: actions([Accountability.recordFailure, { user: u, date: dateStr, failureType: "BEDTIME" }]),
});

// When a user FAILS a wake-up time report, record it for accountability (only if user has partnerships).
export const RecordFailureOnWakeTime: Sync = ({ u, dateStr, partnership }) => ({
  when: actions([SleepSchedule.reportWakeUpTime, { u, dateStr }, { wakeUpSuccess: false }]),
  where: async (frames: Frames) => {
    // Check if user has any partnerships where they are the accountability seeker
    const partnershipFrames = await frames.query(Accountability._getPartnerships, { user: u }, { partnership });
    console.log("[RecordFailureOnWakeTime] Partnership frames raw:", partnershipFrames);
    const hasPrimaryPartnership = partnershipFrames.some((frame) => {
      const partnershipRecord = frame[partnership]?.partnership ?? frame[partnership];
      const currentUser = frame[u];
      return partnershipRecord && currentUser && partnershipRecord.user === currentUser;
    });
    console.log("[RecordFailureOnWakeTime] Has primary partnership?", hasPrimaryPartnership);
    return hasPrimaryPartnership ? partnershipFrames : new Frames();
  },
  then: actions([Accountability.recordFailure, { user: u, date: dateStr, failureType: "WAKETIME" }]),
});

// When a failure is recorded successfully, update reports.
export const UpdateReportsAfterFailure: Sync = ({ u, dateStr }) => ({
  when: actions([Accountability.recordFailure, { user: u, date: dateStr }, {}]),
  then: actions([Accountability.updateReports, { user: u, date: dateStr }]),
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

export const DecrementScoreRequest: Sync = ({ request, session, user, dateStr, eventType }) => ({
  when: actions([Requesting.request, { path: "/CompetitionManager/decrementScore", session, dateStr, eventType }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([CompetitionManager.decrementScore, { u: user, dateStr, eventType }]),
});
export const DecrementScoreResponse: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/CompetitionManager/decrementScore" }, { request }],
    [CompetitionManager.decrementScore, {}, {}],
  ),
  then: actions([Requesting.respond, { request, success: true }]),
});
export const DecrementScoreErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/CompetitionManager/decrementScore" }, { request }],
    [CompetitionManager.decrementScore, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

export const EndCompetitionRequest: Sync = ({ request, session, user, competitionId }) => ({
  when: actions([Requesting.request, { path: "/CompetitionManager/endCompetition", session, competitionId }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([CompetitionManager.endCompetition, { competitionId }]),
});
export const EndCompetitionResponse: Sync = ({ request, winners }) => ({
  when: actions(
    [Requesting.request, { path: "/CompetitionManager/endCompetition" }, { request }],
    [CompetitionManager.endCompetition, {}, { winners }],
  ),
  then: actions([Requesting.respond, { request, winners }]),
});
export const EndCompetitionErrorResponse: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/CompetitionManager/endCompetition" }, { request }],
    [CompetitionManager.endCompetition, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// --- Accountability Endpoints ---

export const AddPartnerRequest: Sync = ({ request, session, user, partner, notifyTypes }) => ({
  when: actions([Requesting.request, { path: "/Accountability/addPartner", session, partner, notifyTypes }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([Accountability.addPartner, { user, partner, notifyTypes }]),
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

export const UpdatePreferencesRequest: Sync = ({ request, session, user, partner, notifyTypes }) => ({
  when: actions([Requesting.request, { path: "/Accountability/updatePreferences", session, partner, notifyTypes }, { request }]),
  where: async (frames: Frames) => frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([Accountability.updatePreferences, { user, partner, notifyTypes }]),
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

// export const GetMyCompetitionsRequest: Sync = ({ request, session, user, competition, competitions }) => ({
//   when: actions([Requesting.request, { path: "/CompetitionManager/_getCompetitionsForUser", session }, { request }]),
//   where: async (frames: Frames) => {
//     const originalFrame = frames[0];
//     frames = await frames.query(Sessioning._getUser, { session }, { user });
//     if (frames.length === 0) {
//       return new Frames({ ...originalFrame, [competitions]: [] });
//     }

//     console.log("[GetMyCompetitionsRequest] Before _getCompetitionsForUser, frames:", frames);
//     const resultFrames = await frames.query(CompetitionManager._getCompetitionsForUser, { user }, { competition });
//     console.log("[GetMyCompetitionsRequest] After _getCompetitionsForUser, resultFrames:", resultFrames);

//     if (resultFrames.length === 0) {
//       return new Frames({ ...originalFrame, ...frames[0], [competitions]: [] });
//     }

//     const collected = resultFrames.collectAs([competition], competitions);
//     console.log("[GetMyCompetitionsRequest] Collected competitions:", collected);
//     return new Frames({ ...originalFrame, ...frames[0], ...collected[0] });
//   },
//   then: actions([Requesting.respond, { request, competitions }]),
// });
export const GetMyCompetitionsRequest: Sync = ({ request, session, user, competition, results }) => ({
  when: actions([Requesting.request, { path: "/CompetitionManager/_getCompetitionsForUser", session }, { request }]),
  where: async (frames: Frames) => {
    const originalFrame = frames[0];
    console.log("[GetMyCompetitionsRequest] Received request. session:", originalFrame?.[session], "request:", originalFrame?.[request]);
    console.log("[GetMyCompetitionsRequest] Initial frames:", frames);
    // 1) Authenticate
    frames = await frames.query(Sessioning._getUser, { session }, { user });
    console.log("[GetMyCompetitionsRequest] After _getUser, frames:", frames);
    if (frames.length > 0) {
      console.log("[GetMyCompetitionsRequest] Bound user:", frames[0]?.[user]);
    }
    // 2) Query competitions per user as singular binding per frame
    const resultFrames = await frames.query(CompetitionManager._getCompetitionsForUser, { user }, { competition });
    console.log("[GetMyCompetitionsRequest] resultFrames (per competition):", resultFrames);
    if (resultFrames.length === 0) {
      console.log("[GetMyCompetitionsRequest] No competitions found. Returning empty results.");
      return new Frames({ ...originalFrame, [results]: [] });
    }
    // 3) Collect into a single array
    const collected = resultFrames.collectAs([competition], results);
    console.log("[GetMyCompetitionsRequest] Collected results:", collected);
    return new Frames({ ...originalFrame, ...collected[0] });
  },
  then: actions([Requesting.respond, { request, results }]),
});

export const GetLeaderboardRequest: Sync = ({ request, session, competitionId, entry, results }) => ({
  when: actions([Requesting.request, { path: "/CompetitionManager/_getLeaderboard", session, competitionId }, { request }]),
  where: async (frames: Frames) => {
    const original = frames[0];
    // 1) Auth
    frames = await frames.query(Sessioning._getUser, { session }, {});
    if (frames.length === 0) return new Frames({ ...original, [results]: [] });

    // 2) Query leaderboard as singular entries per frame
    const resultFrames = await frames.query(CompetitionManager._getLeaderboard, { competitionId }, { entry });
    if (resultFrames.length === 0) return new Frames({ ...original, [results]: [] });

    // 3) Collect entries into a single array and extract plain objects
    const collected = resultFrames.collectAs([entry], results);
    console.log("[GetLeaderboardRequest] Collected results:", collected);
    if (collected.length > 0 && collected[0][results]) {
      // Extract plain objects from collected array to avoid symbol-key serialization
      const plainResults = Array.from(collected[0][results] as any[])
        .map((item: any) => {
          const e = item?.entry ?? item;
          return e && typeof e === "object" ? { ...e } : item;
        });
      return new Frames({ ...original, [results]: plainResults });
    }
    return new Frames({ ...original, [results]: [] });
  },
  then: actions([Requesting.respond, { request, results }]),
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
    console.log("[GetMyPartnershipsRequest] Result frames:", resultFrames);
     if (resultFrames.length > 0) {
      const collected = resultFrames.collectAs([partnership], partnerships);
      return new Frames({ ...originalFrame, ...frames[0], ...collected[0] });
      }
    // No partnerships found - return empty array
    return new Frames({ ...originalFrame, ...frames[0], [partnerships]: [] });
  },
  then: actions([Requesting.respond, { request, results: partnerships }]),
});
