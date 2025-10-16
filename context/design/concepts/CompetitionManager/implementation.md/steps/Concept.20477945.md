---
timestamp: 'Wed Oct 15 2025 02:12:54 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_021254.b0a1e7e6.md]]'
content_id: 20477945fc297ae92f3d89d62dfdfb9a1897b9c90e87fe4f340d4d3f1d123309
---

# Concept: CompetitionManager

* **concept**: CompetitionManager \[User]
* **purpose**: manage multiple sleep-adherence competitions between users, each tracking daily bedtime and wake-up performance over a defined time period and establishing a winner based off of scores, while ensuring active competitions do not overlap for the same user.
* **principle**: A user sets up a competition with another user from a certain start date to an end date. Users' sleep adherences according to their set bedtimes and wake up times are reported. A score is calculated for each user at the end of the competition and a winner is established.
* **state**:
  * A set of Competitions with
    * a set of Users
    * a set of Scores
    * a `startDate` of type `Date`
    * a `endDate` of type `Date`
    * an active flag of type Bool
    * a winner of type User? (will be set to null until endCompetition establishes winner)
  * a set of Scores with:
    * a User
    * a Competition
    * a wakeUpScore Number
    * a bedTimeScore Number
* invariants
  * each competition’s user and challenger are distinct
  * dailyScore = (1 if bedtimeSuccess == true else -1 if bedtimeSuccess == false else 0) +(1 if wakeUpSuccess == true else -1 if wakeUpSuccess == false else 0)
* **actions**:
  * \`startCompetition (participants: set of Users, start:String, end:String):
    * **requires**: 
    * **effects**: creates a Competition with participates, start, end, a true active flag, a null winner. Also, it creates a Score for each User in participants with scores of zero and it is associated with the created competition.

  * \`recordStat (u: User, date: String, event:SleepEvent (enum that is either "bedtime" or "waketime", success:Boolean)
    * **requires**: u is a part of at least one Competition
    * **effects**:
      * for all the competitions that u is apart of and where date is in the range of the start and end dates of the competition
        * update the wakeUpScore if event is "bedtime" otherwise update the bedTimeScore, update scores by incrementing by `dailyScore` in the invariants.

  * \`endCompetition (c:Competition): User
    * **requires**: current date is greater than or equal to the endDate of Competition
    * **effects**: return the User ID of the user in competition c with the greatest sum of wakeUpScore + bedTimeScore and set this ID to the winner state (if tie keep winner as null)
      * also  change active flag to false for competition c
