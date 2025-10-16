Changes for the SleepSchedule concept:
- First, every action in my SleepSchedule concept accepted a composite object of either Time or Date. This could be problematic because they are both mutable objects so if a reference is attached to the argument passed in, the state of the concept could be mutated. Therefore, I have changed these so that they will be passed in as strings and internally be handled with Time and Date objects. 
- SleepSlot user must exist in actions change: this would mean that there must be an action to add users to state otherwise no actions could be done. So I removed this requires clause because it is uneccessary.


Changes for CompetitionManager:
	added getLeaderBoard so users can see standings before end
	added removeParticipant so users can leave competitions if they want instead of binding them till end of competition


Interesting moments:
1. Inconsistency in representing Date in the SleepSchedule concept and CompetitionManager concept. In the CompetitionManager concept it received. For the SleepSchedule it didn't bother to parse passed in Date into the Date object, but for CompetitionManager it did which striked me as odd given that the same llm model was used for both concept refinements.
	1. for CompetitionManager[@20251013_131752.448b0a66](../../context/design/concepts/CompetitionManager/CompetitionManager.md/20251013_131752.448b0a66.md)
	2.  for SleepSchedule
		1. show multiple attempts to get it to parse as a date and time44
2. An interesting moment occured when creating tests for the SleepSchedule concept
	1. A test had failed because of a previous test case adjusting the state of the data base and a later test case not realizing this. This caused some confusion because I was unsure whether the error came from the code or a faulty test case generation. [@bad_test_case_effected_by_previous](context/design/concepts/SleepSchedule/testing.md/steps/response.2ba700cb.md) 
3. realized that participants may want to leave a competitoin early 
4. I asked ChatGpt to help generate interesting test case scenarios for CompetitionManager concept and it came up with one that I had surprisingly not thought of. It claimed that repeated recordStats on the same competition and date should keep updating the score but I realized that this was harmful and realized that I needed to keep track of a new state to ensure this didn't happen. Then I revered since I realized this could be checked at sync level and reduce duplication. It was interesting because it formed me to think as an end user using the UI, where they have the opportunity to report same thing on the same day. So if they change from success to failure it should call record failure twice to erase the first success, and it it goes from failure to success it should call record success twice to make up for the initial failure
5. allowed for idea of multiple accountability partners and also customizable as to what type of reports you want accountability partners to have this was inspired by 