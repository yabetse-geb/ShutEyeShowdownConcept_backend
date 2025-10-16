---
timestamp: 'Wed Oct 15 2025 15:35:04 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_153504.10d6fdf2.md]]'
content_id: abfc5b925953b0f7f9f118c96c699ceec439c359ee1bd1c264f4fa64ad334aa7
---

# Concept: update Accountability with additional interesting behavior

* **concept** Accountability \[User]

* **purpose** Inform accountability partners when a user fails to meet their schedule, using their registered email addresses.

* **principle** After a user designates a partner, whenever an adherence failure is recorded for a date, a notification for that partner is sent

* **state**
  * a set of Partnerships with
    * a user:User
    * a partner:User
  * a set of AdherenceFailures with
    * id: FailureID (unique per failure)
    * a failingUser:User
    * a date:Date
    * a failType: SleepEvent (DEFINE AS TYPE LATER)
  * a set of NotificationsSent with
    * failureID: FailureID (links to an Adherence failure)
    * a partner: User (the specific partner for whom the notification was generated)

* **actions**
  * addPartner(user:User, partner:User):
    * **requires**: user and partner are not equal and (user, partner) is not in Partnerships
    * **effects**: add user and partner to Partnerships
  * removePartner(user: User, partner:User)
    * **requires**: user and partner is not in Partnerships
    * **effects**: remove the pairing user, partner in Partnerships
  * recordFailure()
