---
timestamp: 'Wed Oct 15 2025 14:56:05 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_145605.c1675ef4.md]]'
content_id: a92b4191b838637f29eb39d74ecadb7a7f7f28b115f0ad55dd4bba85dc093d4e
---

# Concept: update Accountability concept so it isn't essentially nothing more than a data structure without any interesting behavior

* **concept** Accountability \[User]
* **purpose** Inform accountability partners when a user fails to meet their schedule, using their registered email addresses.
* **principle** After a user designates a partner, whenever an adherence failure is recorded for a date, a notification for that partner is sent
* **state**
  * a set of Partnerships with
    * a user:User
    * a partner:User
* **actions**
  * addPartner(user:User, partner:User):
    * **requires**: user and partner are not equal and (user, partner) is not in Partnerships
    * **effects**: add user and partner to Partnerships
  * removePartner(user: User, partner:User)
    * **requires**: user and partner is not in Partnerships
    * **effects**: remove the pairing user, partner in Partnerships
