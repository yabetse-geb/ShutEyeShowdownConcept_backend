---
timestamp: 'Tue Nov 04 2025 17:05:03 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251104_170503.373f2e80.md]]'
content_id: a0df4c2ababf000da72cd6d11f1c2466549a8e3b4c40ab6121852f85d86e93a2
---

# response:

Here are the complete synchronizations that generate the application based on your concepts and requirements.

The synchronizations are divided into two parts:

1. **Synchronization Specifications**: A high-level, declarative overview of each rule in a `.sync`-like format.
2. **TypeScript Implementation**: The complete, executable code that implements these specifications.

***

### 1. Synchronization Specifications

This section describes the "cause and effect" rules that connect your concepts.

#### User Authentication & Session Management

```sync
// Handles user registration requests and responds with the new user's ID or an error.
sync RegisterUser
when
  Requesting.request(path: "/PasswordAuth/register", username, password): (request)
then
  PasswordAuth.register(username, password)

sync RegisterUserResponse
when
  Requesting.request(path: "/PasswordAuth/register"): (request)
  PasswordAuth.register(): (user)
then
  Requesting.respond(request, user)

sync RegisterUserError
when
  Requesting.request(path: "/PasswordAuth/register"): (request)
  PasswordAuth.register(): (error)
then
  Requesting.respond(request, error)

// Handles login requests, creates a session upon success, and responds with the session ID.
sync Login
when
  Requesting.request(path: "/PasswordAuth/authenticate", username, password): (request)
then
  PasswordAuth.authenticate(username, password)

sync CreateSessionOnLogin
when
  PasswordAuth.authenticate(): (user)
then
  Sessioning.create(user)

sync LoginResponse
when
  Requesting.request(path: "/PasswordAuth/authenticate"): (request)
  Sessioning.create(): (session)
then
  Requesting.respond(request, session)

sync LoginError
when
  Requesting.request(path: "/PasswordAuth/authenticate"): (request)
  PasswordAuth.authenticate(): (error)
then
  Requesting.respond(request, error)

// Handles logout requests by deleting the session.
sync Logout
when
  Requesting.request(path: "/Sessioning/delete", session): (request)
then
  Sessioning.delete(session)

sync LogoutResponse
when
    Requesting.request(path: "/Sessioning/delete"): (request)
    Sessioning.delete(): ()
then
    Requesting.respond(request, status: "logged_out")
```

#### Core Logic: Sleep Adherence Flow

This is the central logic where reporting a sleep event triggers updates in the `CompetitionManager` and `Accountability` concepts.

```sync
// When any sleep time is reported, update the user's score in their competitions.
sync UpdateCompetitionStatOnBedTimeReport
when
  SleepSchedule.reportBedTime(u, dateStr, bedTimeSuccess): ()
then
  CompetitionManager.recordStat(u, dateStr, eventType: "BEDTIME", success: bedTimeSuccess)

sync UpdateCompetitionStatOnWakeTimeReport
when
  SleepSchedule.reportWakeUpTime(u, dateStr, wakeUpSuccess): ()
then
  CompetitionManager.recordStat(u, dateStr, eventType: "WAKETIME", success: wakeUpSuccess)

// When a sleep time report results in a FAILURE, record it for accountability partners.
sync RecordAccountabilityFailureOnBedTime
when
  SleepSchedule.reportBedTime(u, dateStr, bedTimeSuccess: false): ()
then
  // Record the specific failure.
  Accountability.recordFailure(user: u, date: dateStr, failureType: "BEDTIME")
  // Immediately trigger the report generation process for partners.
  Accountability.updateReports(user: u, currentDate: dateStr)

sync RecordAccountabilityFailureOnWakeTime
when
  SleepSchedule.reportWakeUpTime(u, dateStr, wakeUpSuccess: false): ()
then
  Accountability.recordFailure(user: u, date: dateStr, failureType: "WAKETIME")
  Accountability.updateReports(user: u, currentDate: dateStr)
```

#### Authenticated API Endpoints

These synchronizations expose concept actions as API endpoints, guarded by a session check.

```sync
// Exposes SleepSchedule.addSleepSlot, requiring a valid session.
sync AddSleepSlotRequest
when
  Requesting.request(path: "/SleepSchedule/addSleepSlot", session, ...): (request)
where
  in Sessioning: _getUser(session) gets user
then
  SleepSchedule.addSleepSlot(u: user, ...)

// Exposes CompetitionManager.startCompetition, requiring a valid session.
sync StartCompetitionRequest
when
  Requesting.request(path: "/CompetitionManager/startCompetition", session, ...): (request)
where
  in Sessioning: _getUser(session) gets user
then
  CompetitionManager.startCompetition(...)

// Exposes Accountability.addPartner, requiring a valid session.
sync AddPartnerRequest
when
  Requesting.request(path: "/Accountability/addPartner", session, partner, ...): (request)
where
  in Sessioning: _getUser(session) gets user
then
  Accountability.addPartner(user, partner, ...)

// Exposes a query to get a user's competitions, requiring a valid session.
sync GetMyCompetitionsRequest
when
  Requesting.request(path: "/CompetitionManager/_getCompetitionsForUser", session): (request)
where
  in Sessioning: _getUser(session) gets user
  in CompetitionManager: _getCompetitionsForUser(user) gets competitions
then
  Requesting.respond(request, competitions)
```

***

### 2. TypeScript Implementation

This file should be placed in `src/syncs/app.sync.ts`. It contains the complete implementation for all the synchronizations described above.

```typescript
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
    [Accountability.updateReports, { user: u, currentDate: dateStr }],
  ),
});

// When a user FAILS a wake-up time report, record it for accountability and trigger an update.
export const RecordFailureOnWakeTime: Sync = ({ u, dateStr }) => ({
  when: actions([SleepSchedule.reportWakeUpTime, { u, dateStr }, { wakeUpSuccess: false }]),
  then: actions(
    [Accountability.recordFailure, { user: u, date: dateStr, failureType: "WAKETIME" }],
    [Accountability.updateReports, { user: u, currentDate: dateStr }],
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

// ============================================================================
// 4. API Endpoints for Queries (Authenticated)
// ============================================================================

export const GetMyCompetitionsRequest: Sync = ({ request, session, user, competitions }) => ({
  when: actions([Requesting.request, { path: "/CompetitionManager/_getCompetitionsForUser", session }, { request }]),
  where: async (frames: Frames) => {
    frames = await frames.query(Sessioning._getUser, { session }, { user });
    return frames.query(CompetitionManager._getCompetitionsForUser, { user }, { competitions });
  },
  then: actions([Requesting.respond, { request, competitions }]),
});

export const GetLeaderboardRequest: Sync = ({ request, session, competitionId, leaderboard }) => ({
  when: actions([Requesting.request, { path: "/CompetitionManager/_getLeaderboard", session, competitionId }, { request }]),
  where: async (frames: Frames) => {
    frames = await frames.query(Sessioning._getUser, { session }, {}); // Auth check
    return frames.query(CompetitionManager._getLeaderboard, { competitionId }, { leaderboard });
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

export const GetMyPartnershipsRequest: Sync = ({ request, session, user, partnerships }) => ({
  when: actions([Requesting.request, { path: "/Accountability/_getPartnerships", session }, { request }]),
  where: async (frames: Frames) => {
    frames = await frames.query(Sessioning._getUser, { session }, { user });
    const resultFrames = await frames.query(Accountability._getPartnerships, { user }, { partnerships });
     // The query returns an array of partnerships. We need to collect them.
     if (resultFrames.length > 0) {
        const allPartnerships = resultFrames.flatMap(frame => frame[partnerships] || []);
        return new Frames({ ...resultFrames[0], [partnerships]: allPartnerships });
      }
      return new Frames({ ...frames[0], [partnerships]: [] });
  },
  then: actions([Requesting.respond, { request, results: partnerships }]),
});
```
