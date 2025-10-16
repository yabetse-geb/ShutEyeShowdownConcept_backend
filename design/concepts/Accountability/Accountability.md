[@concept-design-brief](../../background/concept-design-brief.md)

[@concept-design-overview](../../background/concept-design-overview.md)

[@concept-specifications](../../background/concept-specifications.md)

# Concept: Accountability

- **concept** Accountability [User]
- **purpose**     Record accountability partnerships between users and their associated notification preferences. The concept does not send messages or access contact information — it only stores user IDs and preference data.
- **principle**     After a user designates a partner, the system tracks that relationship and stores which types of adherence failures and reporting frequency apply. External notification or email components use this data separately.
- types:
	- `SleepEventType`: An enumeration representing the type of sleep event.
		- `BEDTIME`: Represents the event of going to bed.
		- `WAKETIME`: Represents the event of waking up.
	- `Date`: A standard date object, capable of representing a specific calendar day (e.g., `java.time.LocalDate` in Java, `Date` in Swift/JS, or equivalent). Time components are generally ignored for daily performance tracking.
- **state**
    - a set of Partnerships with
        - a user:User
        - a partner:User
        - notifyTypes: set of FailureType // e.g., {MissedBedtime, MissedWake}
        - reportFrequency: FrequencyType // Immediate | Daily | Weekly
        - lastReportDate:Date
    - a set of AdherenceFailures with
	    - a failingUser:User
	    - a date:Date
	    - a failType: SleepEventType 
	    - reported:Boolean

- **actions**
    - addPartner(user:User, partner:User):
        - **requires**: user and partner are not equal and (user, partner) is not in Partnerships
        - **effects**: add (user, partner, notifyTypes, reportFrequency, null) to Partnerships
    - updatePreferences(user: User, partner: User, notifyTypes: set of FailureType, reportFrequency: FrequencyType)
	    - requires: (user, partner) in Partnerships
	    - effects: modify that partnership’s notifyTypes and reportFrequency
    - removePartner(user: User, partner:User)
        - **requires**: (user, partner) in Partnerships
        - **effects**: remove the pairing user, partner in Partnerships
    - recordFailure(user: User, date:string, failureType:SleepEvent):
	    - effects: if user is not in AdherenceFailures add (user, date, failureType) to AdherenceFailures
	- reportAllFailuresFromStartToEnd(user:User, startDate:string, endDate:string):String
		- requires:
			- startDate<=endDate
		- effects:
			- Find all adherence failures for the given user whose date is between startDate and endDate (inclusive) and whose reported flag is false.
			- if there are any failures:
				- Return a string listing each failure’s type and date in readable form.
			- otherwise:
				- Return the string "No adherence failures for this period."
	- generateNotificationMessage(user: User, date: String): String
		- requires: The user has at least one partnership recorded in Partnerships.
		- effects:
			- For each partnership where the user is the main user:
	            - If reportFrequency is Immediate:
	                • Let message = reportAllFailuresFromStartToEnd(user, date, date)
	                • If message does not equal "No adherence failures for this period.":
                    - Mark those failures as reported.
                    - Return "Immediate Alert for " + partner + ": " + message

	            - If reportFrequency is Daily:
	                • Let previousDay = date minus one day
	                • If the last report date is before the current date:
	                    - Let message = reportAllFailuresFromStartToEnd(user, previousDay, previousDay)
	                    - Mark those failures as reported.
	                    - Update the last report date to the current date.
	                    - Return "Daily Report for " + partner + ":\n" + message

	            - If reportFrequency is Weekly:
	                • If seven or more days have passed since the last report date:
	                    - Let startDate = date minus seven days
	                    - Let message = reportAllFailuresFromStartToEnd(user, startDate, date)
	                    - Mark those failures as reported.
	                    - Update the last report date to the current date.
	                    - Return "Weekly Report for " + partner + ":\n" + message
	
	        If there are no new messages to send, return an empty string.

	

    
# response:

Here's an updated version of the `Accountability` concept that includes more interesting behavior, addressing the initial concern that it was "essentially nothing more than a data structure."

The key changes involve:
1.  **Refined Purpose and Principle**: To accurately reflect the concept's generic nature and its role in *generating* notifications rather than *sending* them directly (which would involve specific types like email).
2.  **Extended State**: To track adherence failures and which partners have been notified for those failures.
3.  **New Actions**:
    *   `recordFailure`: To log when a user fails to meet their schedule.
    *   `generateAndLogNotifications` (a system action): To automatically detect un-notified failures, identify relevant partners, mark them as notified, and output a set of generic notification requests that an external service could then process (e.g., send as emails).

---

```
* **concept** Accountability [User, FailureID]
* **purpose** Facilitate informing designated accountability partners about recorded adherence failures of a user for a specific date, by generating notification requests for those partners.
* **principle** After a user designates a partner, whenever an adherence failure is recorded for a date, the system generates a distinct notification request for that partner containing details of the failure. This request can then be consumed and delivered by an external notification service.
* **state**
  * a set of Partnerships with
    * a user: User
    * a partner: User
  * a set of AdherenceFailures with
    * an id: FailureID (a unique identifier for each distinct failure record)
    * a failingUser: User
    * a date: Date
  * a set of NotificationsSent with
    * a failureId: FailureID (references an `AdherenceFailure`)
    * a partner: User (the specific partner for whom the notification was generated)
    * a timestamp: Timestamp (when this specific notification was generated)
* **actions**
  * addPartner(user: User, partner: User)
    * **requires**: `user != partner` and `(user, partner)` is not in `Partnerships`
    * **effects**: Add `(user, partner)` to `Partnerships`
  * removePartner(user: User, partner: User)
    * **requires**: `(user, partner)` is in `Partnerships`
    * **effects**: Remove `(user, partner)` from `Partnerships`
  * recordFailure(failingUser: User, date: Date): (failureId: FailureID)
    * **requires**: `failingUser` is a valid User and `date` is a valid Date (e.g., in the past, or current day)
    * **effects**:
      * Generate a `newID` for the failure.
      * Add a new `AdherenceFailure` `(id: newID, failingUser, date)` to `AdherenceFailures`.
      * Return `newID`.
  * **system** generateAndLogNotifications (): (notifications: set of {recipient: User, message: String, failureDetails: {failingUser: User, date: Date}})
    * **requires**: There exists at least one `failure` in `AdherenceFailures` and at least one `partnership` in `Partnerships` such that:
                  `failure.failingUser == partnership.user` AND `(failure.id, partnership.partner)` is NOT in `NotificationsSent`.
    * **effects**:
      * Initialize an empty set `generatedNotifications`.
      * For each `failure` in `AdherenceFailures`:
        * For each `partnership` in `Partnerships` where `partnership.user == failure.failingUser`:
          * Let `partner = partnership.partner`.
          * If `(failure.id, partner)` is NOT in `NotificationsSent`:
            * Add `(failure.id, partner, currentTime)` to `NotificationsSent`.
            * Construct a notification message, e.g., `msg = "Your accountability partner ${failure.failingUser} recorded an adherence failure on ${failure.date}."`
            * Add `{recipient: partner, message: msg, failureDetails: {failingUser: failure.failingUser, date: failure.date}}` to `generatedNotifications`.
      * Return the `generatedNotifications` set.
```
# response:

Here's an updated version of the `Accountability` concept, incorporating more detailed behavior for recording failures and generating notifications, while strictly adhering to the principles of concept design (independence, generic parameters, user-relevant purpose).

The key changes include:

1.  **Generic Type Parameter for FailureID**: Making `FailureID` a generic parameter means the concept doesn't care about the internal structure or generation mechanism of failure identifiers, only that they can be used for unique identification.
2.  **Refined Purpose and Principle**: The concept's purpose is now explicitly about *generating notification requests* for partners, rather than directly sending notifications (which would imply knowledge of specific communication channels like email). This keeps the concept independent and generic.
3.  **`recordFailure` Action**: A new action is introduced for an external system or user to log a specific adherence failure, ensuring each failure has a unique ID.
4.  **`system` Action for Notification Generation**: A new `system` action, `generateAndLogNotifications`, automatically identifies un-notified failures, determines the relevant partners, and produces a set of generic notification requests. This action also updates the concept's state to prevent duplicate notifications for the same failure-partner pair.

This design elevates the concept from a mere data structure to an active component that orchestrates a specific behavioral concern: tracking accountability failure notifications.

---

*   **concept** Accountability \[User, FailureID]

*   **purpose** Facilitate informing designated accountability partners about recorded adherence failures of a user for a specific date, by generating notification requests for those partners that can be processed by an external service.

*   **principle** After a user designates a partner, whenever an adherence failure is recorded for a date, the system will identify all relevant partners and generate a distinct, traceable notification request for each, containing details of the failure. These requests are then available for an external notification service to consume and deliver.

*   **state**
    *   a set of Partnerships with
        *   a user: User
        *   a partner: User
    *   a set of AdherenceFailures with
        *   an id: FailureID (a unique identifier for each distinct failure record)
        *   a failingUser: User
        *   a date: Date
        *   a timestamp: Timestamp (when the failure was recorded)
    *   a set of NotificationsSent with
        *   a failureId: FailureID (references an `AdherenceFailure`)
        *   a partner: User (the specific partner for whom the notification was generated)
        *   a timestamp: Timestamp (when this specific notification request was generated)

*   **actions**
    *   addPartner(user: User, partner: User)
        *   **requires**: `user != partner` and `(user, partner)` is not in `Partnerships`
        *   **effects**: Add `(user, partner)` to `Partnerships`

    *   removePartner(user: User, partner: User)
        *   **requires**: `(user, partner)` is in `Partnerships`
        *   **effects**: Remove `(user, partner)` from `Partnerships`

    *   recordFailure(failingUser: User, date: Date): (failureId: FailureID)
        *   **requires**: `failingUser` is a valid `User` identifier
        *   **effects**:
            *   Generate a `newID` of type `FailureID` (globally unique).
            *   Add a new `AdherenceFailure` `(id: newID, failingUser, date, timestamp: currentTime())` to `AdherenceFailures`.
            *   Return `newID`.

    *   **system** generateAndLogNotifications (): (notifications: set of {recipient: User, message: String, failureDetails: {id: FailureID, failingUser: User, date: Date}})
        *   **requires**: There exists at least one `failure` in `AdherenceFailures` and at least one `partnership` in `Partnerships` such that:
                      `failure.failingUser == partnership.user` AND `(failure.id, partnership.partner)` is NOT in `NotificationsSent`.
        *   **effects**:
            *   Initialize an empty set `generatedNotifications`.
            *   For each `failure` in `AdherenceFailures`:
                *   For each `partnership` in `Partnerships` where `partnership.user == failure.failingUser`:
                    *   Let `partner = partnership.partner`.
                    *   If `(failure.id, partner)` is NOT in `NotificationsSent`:
                        *   Add `(failure.id, partner, currentTime())` to `NotificationsSent`.
                        *   Construct a generic notification message, e.g., `msg = "Your accountability partner ${failure.failingUser} recorded an adherence failure on ${failure.date}."`
                        *   Add `{recipient: partner, message: msg, failureDetails: {id: failure.id, failingUser: failure.failingUser, date: failure.date}}` to `generatedNotifications`.
            *   Return the `generatedNotifications` set.