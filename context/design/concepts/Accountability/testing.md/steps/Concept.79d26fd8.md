---
timestamp: 'Thu Oct 16 2025 11:43:30 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_114330.b64fd25d.md]]'
content_id: 79d26fd840813675f3033531a800c985719c94e311a60bf095f71e0486bff76c
---

# Concept: Accountability

* **concept** Accountability \[User]

* **purpose**     Record accountability partnerships between users and their associated notification preferences. The concept does not send messages or access contact information — it only stores user IDs and preference data.

* **principle**     After a user designates a partner, the system tracks that relationship and stores which types of adherence failures and reporting frequency apply. External notification or email components use this data separately.

* types:
  * `SleepEventType`: An enumeration representing the type of sleep event.
    * `BEDTIME`: Represents the event of going to bed.
    * `WAKETIME`: Represents the event of waking up.
  * `Date`: A standard date object, capable of representing a specific calendar day (e.g., `java.time.LocalDate` in Java, `Date` in Swift/JS, or equivalent). Time components are generally ignored for daily performance tracking.

* **state**
  * a set of Partnerships with
    * a user:User
    * a partner:User
    * notifyTypes: set of FailureType // e.g., {MissedBedtime, MissedWake}
    * reportFrequency: FrequencyType // Immediate | Daily | Weekly
    * lastReportDate:Date
  * a set of AdherenceFailures with
    * a failingUser:User
    * a date:Date
    * a failType: SleepEventType
    * reported:Boolean

* **actions**
  * addPartner(user:User, partner:User):
    * **requires**: user and partner are not equal and (user, partner) is not in Partnerships
    * **effects**: add (user, partner, notifyTypes, reportFrequency, null) to Partnerships
  * removePartner(user: User, partner:User)
    * **requires**: (user, partner) in Partnerships
    * **effects**: remove the pairing user, partner in Partnerships
  * updatePreferences(user: User, partner: User, notifyTypes: set of FailureType, reportFrequency: FrequencyType)
    * requires: (user, partner) in Partnerships
    * effects: modify that partnership’s notifyTypes and reportFrequency
  * recordFailure(user: User, date:string, failureType:SleepEvent):
    * effects: if user is not in AdherenceFailures add (user, date, failureType) to AdherenceFailures
  * reportAllFailuresFromStartToEnd(user:User, startDate:string, endDate:string):String
    * requires:
      * startDate<=endDate
      * `startDateStr` and `endDateStr` must be valid date strings parseable into `Date` objects.
    * effects:
      * parse startDate and endDate into Date objects
      * Find all adherence failures for the given user whose date is between startDate and endDate (inclusive) and whose reported flag is false.
      * if there are any failures:
        * Return a string listing each failure’s type and date in readable form.
      * otherwise:
        * Return the string "No adherence failures for this period."
  * generateNotificationMessage(user: User, date: String): String
    * requires: The user has at least one partnership recorded in Partnerships.
    * effects:

      * For each partnership where the user is the main user:
        * If reportFrequency is Immediate:
          • Let message = reportAllFailuresFromStartToEnd(user, date, date)
          • If message does not equal "No adherence failures for this period.":
          * Mark those failures as reported.
          * Return "Immediate Alert for " + partner + ": " + message

        * If reportFrequency is Daily:
          • Let previousDay = date minus one day
          • If the last report date is before the current date:
          \- Let message = reportAllFailuresFromStartToEnd(user, previousDay, previousDay)
          \- Mark those failures as reported.
          \- Update the last report date to the current date.
          \- Return "Daily Report for " + partner + ":\n" + message

        * If reportFrequency is Weekly:
          • If seven or more days have passed since the last report date:
          \- Let startDate = date minus seven days
          \- Let message = reportAllFailuresFromStartToEnd(user, startDate, date)
          \- Mark those failures as reported.
          \- Update the last report date to the current date.
          \- Return "Weekly Report for " + partner + ":\n" + message

      If there are no new messages to send, return an empty string.
