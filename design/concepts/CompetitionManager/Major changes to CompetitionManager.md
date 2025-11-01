In my initial CompetitionManager (previously called Competition) I had a nested structure as it was:
a set of Competitions with
	-user:User
	-challenger:User
	-a set of userStats with
		-user:User
		-date:Date
		-score
Now it has been flattened with CompeititionManager having a set of Competitions with now a set of Users (allowing competitions with more than two users which is a major change). and also a set of Scores with
	- u: a User
	- competition: a Competition
	- a wakeUpScore Number
	- a bedTimeScore Number

This is because all that needs to be tracked is the ongoing scores, not the score changes per day. Furthermore since there can be more than 2 in a competition, there can also be a set of winners which was added to the Competitions. Lastly some behavorial changes include the fact that participants of a competition can leave by adding the removeParticipant action, and they can see a current leader board of a Competition by adding the getLeaderboard


# 4b major changes
Changed how scoring is done now users will get +1 point for success, 0 for failures, and -1 for failure to report sleep events. This discourages a bad practice of avoiding reporting because of a failure, and it now encourages honest reporting even if failing, but punishes neglecting to report.
