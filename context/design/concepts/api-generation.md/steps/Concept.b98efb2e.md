---
timestamp: 'Mon Oct 20 2025 02:11:16 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_021116.a08c1f9d.md]]'
content_id: b98efb2e1cc5a83db8b0e944321ec30bde604fa19e7bd3e7d78d67fa38df7fe0
---

# Concept: Accountability

* **concept** Accountability \[User]

* **purpose**     Enable structured accountability between users by recording their partnerships, adherence tracking preferences, and report frequencies. The concept maintains only the data required to support external systems in generating notifications or summaries—it does not send or deliver messages itself. By storing which types of adherence failures are monitored and when reports should be produced, the concept ensures that each partnership’s accountability data remains accurate, consistent, and ready for use by reporting or notification services.

* **principle**     If a user establishes an accountability partnership with a partner and configures notification preferences (e.g., daily reports for specific adherence failures), and the user then records adherence failures, then the concept will, at the defined frequency, enable the generation of a report for the partner detailing those failures, marking them as reported and updating the partnership's last report date.

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
  * addPartner(user:User, partner:User, notifyTypes: FailureType\[], reportFrequency:FrequencyType,):
    * **requires**: user and partner are not equal and (user, partner) is not in Partnerships
    * **effects**: add (user, partner, notifyTypes, reportFrequency, null) to Partnerships
  * removePartner(user: User, partner:User)
    * **requires**: (user, partner) in Partnerships
    * **effects**: remove the pairing user, partner in Partnerships
  * updatePreferences(user: User, partner: User, notifyTypes: set of FailureType, reportFrequency: FrequencyType)
    * requires: (user, partner) in Partnerships
    * effects: modify that partnership’s notifyTypes and reportFrequency
  * recordFailure(user: User, date:string, failureType:SleepEvent):
    * requires: date can be parsed into a Date object and same exact failure is not in AdherenceFailures
    * effects:
      * parse date into a Date object
      * if user is not in AdherenceFailures add (user, date, failureType) to AdherenceFailures
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
    * requires:
      * The user has at least one partnership recorded in Partnerships.
      * date is parseable into a Date object
    * effects:

      * parse date into Date object
      * For each partnership where the user is the main user:
        * If reportFrequency is Immediate:
          report all unreported failures from the past 7 days and mark them as reported in AdherenceFailures

        * If reportFrequency is Daily:
          • Let previousDay = current date minus one day
          • If the last report date is before the current date:
          \- report all unreported failures from the past 7 days and mark them as reported in AdherenceFailures

        * If reportFrequency is Weekly:
          • If seven or more days have passed since the last report date:
          \- report all unreported failures from the past 7 days and mark them as reported in AdherenceFailures

      If there are no new messages to send, return an empty string.
