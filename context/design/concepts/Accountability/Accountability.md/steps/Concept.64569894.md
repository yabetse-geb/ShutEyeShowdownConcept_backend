---
timestamp: 'Fri Nov 07 2025 20:07:49 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251107_200749.cb0e8f3d.md]]'
content_id: 64569894d4b919d6b3db8c842a3f15dd9f6396e7497481365f78f40da61e7388
---

# Concept: Accountability

* **concept** Accountability \[User]

* **purpose**     Enable structured accountability between users by recording their partnerships, adherence tracking preferences. Users allocate what types of reports should be sent to accountability partners (bedtime and/or wake up time failures) and reports are generated and made visible to accountability partners.

* **principle**     If a user establishes an accountability partnership with a partner and configures notification preferences (e.g., reports for bedtime failures), and the user then records adherence failures, then the concept will, at the defined frequency, enable the generation of a report to send to the partner detailing those failures, marking them as reported and updating the partnership's last report date.

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
    * lastReportDate:Date
  * a set of AdherenceFailures with
    * a failingUser:User
    * a date:Date
    * a failType: SleepEventType
    * reported:Boolean
  * a set of Reports with
    * a user:User (person receiving reports for an accountability seeker)
    * a accountabilitySeeker:User
    * a allReports:String\[]

* **actions**
  * addPartner(user:User, partner:User, notifyTypes: FailureType\[], reportFrequency:FrequencyType,):
    * **requires**: user and partner are not equal and (user, partner) is not in Partnerships
    * **effects**: add (user, partner, notifyTypes, reportFrequency, null) to Partnerships and add (partner, user, \[]) to Reports
  * removePartner(user: User, partner:User)
    * **requires**: (user, partner) in Partnerships
    * **effects**: remove the pairing user, partner in Partnerships and Reports
  * updatePreferences(user: User, partner: User, notifyTypes: set of FailureType)
    * requires: (user, partner) in Partnerships
    * effects: modify that partnership’s notifyTypes
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
  * updateReports(user: User, currentDate:string):
    * requires:
      * The user has at least one partnership recorded in Partnerships.
    * effects:
      * For each partnership where the user is the main user and partner is the partner:
        generate a string report of all unreported failures from the current day and mark them as reported in AdherenceFailures
        * append this generated string report to allReports in Report with (user:partner, accountabilitySeeker: user) and updates lastReportedDate

* `_getPartnerships(user: User, date: String): Partnership[]`
  * effects: returns all partnerships where the user is either the primary user or the partner.
