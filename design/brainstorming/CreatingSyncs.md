[@concept-design-overview](../background/concept-design-overview.md)

[@concept-specifications](../background/concept-specifications.md)

[@implementing-synchronizations](../background/implementing-synchronizations.md)

[@architecture](../background/architecture.md)

[@README](../../src/concepts/Requesting/README.md)

[@api-generation](../concepts/api-generation.md)
# Create Synchronizations

I am creating an which allows users to set up sleep schedules, like their bedtimes and wakeup times each day along with a minute tolerance so if they go to sleep/wake up within x minutes before or after their bedtime/wake up time it is counted as a success otherwise it is considered a failure. Users can also set up competitions in which they're successes will add 1 to their scores, their failures will not increment or decrement their scores, and failure to report sleep events before the end of a competition will lead to decrementing their scores by 1 for each missed reported sleep event. Users also can add accountability partners, in which their failures will be reported to their accountability partners. 



## Accountability:

Specification:

[@Accountability](Accountability/Accountability.md)

Code:

[@Implementation](Accountability/Implementation.md)


## CompetitionManager:

Specification:

[@CompetitionManager](CompetitionManager/CompetitionManager.md)

Code:

[@implementation](CompetitionManager/implementation.md)

## PasswordAuth

Specification:

[@PasswordAuth](PasswordAuth/PasswordAuth.md)

Code:

[@implementation](PasswordAuth/implementation.md)


## Sessioning

Specification:

[@Sessioning](Sessioning/Sessioning.md)

Code:

[@implementation](Sessioning/implementation.md)

## SleepSchedule

Specification:

[@SleepSchedule](SleepSchedule/SleepSchedule.md)

Code:

[@implementation](SleepSchedule/implementation.md)


Here are some necessary syncs:

## Sleep Report flow: 
After calling reportBedTime() or reportWakeUpTime() from SleepSchedule it should also call recordStat() if that user is apart of any competitions, and if reportBedTime() or reportWakeUpTime() returned false it must call recordFailure() in the Accountability concept, and must call updateReports() in Accountability concept. 

## User authentication:
make sure that when users authenticate in PasswordAuth, a session must be created using create in Sessioning that will be used until the user logs out. 


Great, now create the complete set of synchronizations that generates the app. For requests that are similar to passthrough routes, keep the path in the form of `/{Concept}/{action or query}`. Start by defining the synchronization specifications, then create the implementation.
