---
timestamp: 'Mon Oct 13 2025 15:03:57 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251013_150357.0a8c1bcb.md]]'
content_id: b5619dd5ca75a6cc67a9a9a03268a6ceafdc37653b74089d638d080a2077479a
---

# concept:  refine SleepSchedule concept to handle Date object internally in the same way as CompetitionManager

* **concept**: SleepSchedule \[User]
* **purpose**: Let users set bedtime/wake goals, log sleep and wake events, and record daily adherence (did the user follow their targets).
* **principle**: Users set bedtime and wake targets. When the app receives sleep/wake logs, the concept computes whether the user met the bedtime/wake targets for that date and records adherence. Missed-adherence events are tracked for notifications/reports.
* **state**:
  * A set of SleepSlots with
    * a `bedTime` of type Time
    * a `wakeUpTime` of type `Time`
    * a `a user` of type `User`
    * a `date` of type `Date`
    * a wakeUpSucccess of type Bool
    * a bedTimeSuccess of type Bool
* **actions**:
  * \`addSleepSlot (u: User, bedTime:String , wakeTime: String, Time: Number):
    * **requires**: there doesn't already exist a SleepSlot at
    * **effects**: Creates a new survey with the given author, title, and scale.
  * \`removeSleepSlot (u: User, date: String)
    * **requires**: there exists a SleepSlot with user u and set of Date, dates
    * **effects**: removes this SleepSlot
  * \`reportBedTime (u:User, t:Time, d:Date): Boolean
    * **requires**:  SleepSlot with u:User and d:Date exists
    * **effects**: sets bedTimeSuccess=t < bedTime for the sleep slot with (u, d)
  * \`reportWakeUpTime (u:User, t:Time, d:Date): Boolean
    * **requires**: SleepSlot with u:User and d:Date exists
    * **effects**: set wakeUpSuccess= t < wakeUpTime for the sleep slot with (u, d)
