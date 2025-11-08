## SleepSchedule Concept changes

* Changed the definition of success for adhering to bedtimes and wakeup times, [@previously](context/design/concepts/SleepSchedule/SleepSchedule.md/steps/concept.ed5954b5.md)  it was just that if the user slept before their bedtime or woke up before their wake up time it was considered a success. [@Now](steps/concept.3f668895.md) users can choose a tolerance minutes, which is how much they can differ from their bedtimes and wake up times by "tolerance minutes" before or after and it still be considered a success. Tolerance minutes can either be set to 30 minutes, 10 minutes, or 5 minutes. 
* Changes to state: 
	* added toleranceMinutes to be sotred in SleepSlots
	* SleepSlots also keep track of wakeUpSuccess and bedTimeSuccess 
* Changes to actions:
	* reportBedTime and reportWakeUpTime regard success as described above

## PasswordAuth Concept changes along with user authentication

* Added freedom for users to change their passwords
* Now Sessioning concept is used so that when a user logs in they create a session that is stored in the UI and is used to for actions requiring authentication so that once a user logs in they are provided with a session token to identify logged in users and their abilities to perform authenticated actions until they log out and that session token is deleted (resembling it "expiring")
* State changes:
	* removed email since reports for accountability partners are now kept with in the app and not emailed 
	* so now the state is just a collection of Users with a username and password 

## Accountability Concept

While working on Assignment 4b I wanted to give the user more freedom in how they were held accountable by their accountability partners [@4b Updated Accountability Concept](context/design/concepts/Accountability/Accountability.md/steps/Concept.ec55476f.md). So I allowed them to choose how frequently they wanted their accountability partner to see reports of their failures (immediately, daily, weekly) and what types of failures (wake up and/or bed time). Also kept track of failures and the last reported date to implement this functionality. However, while working on the final submission it was difficult to get a consistent behavior for daily and weekly notification frequency with different edge cases like if users reported for dates out of order. So, I removed the ability to choose daily and weekly reports which wasn't an issue because now that the app itself would hold reports, accountability partners can see all immediate reports in one place so they can look through the past weeks failures without it being different emails. But, there is slightly less freedom for the accountability seeker; however they can now still choose what types of failures they want reported. The updated concept spec [@Updated Accountability specs](steps/Concept.64569894.md)) also added a state called Reports so that these reports can be saved and rendered to the app web page for accountability partners to see. Additional actions, included recordFailure and updateReports to generate the reports. 

## CompetitionManager changes

* state and behavior changes:
	* initially a nested structure with a set of Competitions that had a nested set of userStats which included a user, the date the stat was recorded, and the score(+1 point for a successful adherence or -1 for an unsuccessful one). 
	* This was changed for [@ 4b update](context/design/concepts/CompetitionManager/CompetitionManager.md/steps/Concept.0d219fd7.md) in which now it was a collection of Competitions and a collection of Scores, with one for each user in a Competition that kept track of a running score. Additionally kept track of wake up score and bed time score separately so that their scores can give users more information on their progress specifically in waking up on time or sleeping on time. 
		* additionally this update allowed for competitions to have more than two users
	* In the most [@updated final version](steps/Concept.368e3fe2.md) I have now kept track of dates of wake up reports and sleep reports in the competition, as the way scoring has changed.
		* Now scoring is as this:
			* users get +1 point for either a wake up or bed time success
			* +0 points instead of -1 as before to not discourage failure and to prevent users from not reporting failures so that they score won't decrease
			* -1 for days not reported in the competition (this encourages honest reporting as reported failures aren't punished, and encourages consistent reporting)

# Visual design changes
In terms of differences in visual design from the initial 4b assignment there is a drask improvement in the use of relevant and appropriate colors. Initially the front end had excessive white space and the colors were not giving a calming vibe as most sleep tracking apps do. So after, the visual design study in which I saw inspiration from the Calm app and the Sleep Cycle app, as well as various media such as a YouTube video thumbnail I saw how a gradient between dark blue and lavender was associated with sleep and tranquility, and I incorporated this to my backgrounds and card colors in my app. I also used rounded font to give a calm feeling, while for the competition page I used bolded text and reduced the spacing between the users to allow the rounded text to give a sense of calmness while invoking excitement. 

