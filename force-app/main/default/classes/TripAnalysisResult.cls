@AuraEnabled
public static TripAnalysisResult analyzeTripResponses(Id tripId) {
    try {
        List<Travel_Companion__c> responses = [
            SELECT Id, Name, Status__c, Survey_Response__c, Survey_Completed_Date__c
            FROM Travel_Companion__c
            WHERE Trip__c = :tripId
            AND Survey_Completed_Date__c != null
        ];
        
        TripAnalysisResult analysis = new TripAnalysisResult();
        analysis.totalInvited = [SELECT COUNT() FROM Travel_Companion__c WHERE Trip__c = :tripId];
        analysis.totalResponded = responses.size();
        analysis.interestedCount = 0;
        analysis.declinedCount = 0;
        
        List<Date> earliestDates = new List<Date>();
        List<Date> latestDates = new List<Date>();
        List<Decimal> budgets = new List<Decimal>();
        Map<String, Integer> durationPreferences = new Map<String, Integer>();
        
        for (Travel_Companion__c companion : responses) {
            if (companion.Status__c == 'Interested') {
                analysis.interestedCount++;
                
                // Parse individual response
                if (String.isNotBlank(companion.Survey_Response__c)) {
                    Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(companion.Survey_Response__c);
                    
                    // Collect date preferences
                    String earliestDate = (String) responseData.get('earliestDepartureDate');
                    String latestDate = (String) responseData.get('latestReturnDate');
                    String budgetStr = String.valueOf(responseData.get('budget'));
                    String duration = (String) responseData.get('preferredDuration');
                    
                    if (String.isNotBlank(earliestDate)) {
                        earliestDates.add(Date.valueOf(earliestDate));
                    }
                    if (String.isNotBlank(latestDate)) {
                        latestDates.add(Date.valueOf(latestDate));
                    }
                    if (String.isNotBlank(budgetStr) && budgetStr != 'null') {
                        try {
                            budgets.add(Decimal.valueOf(budgetStr));
                        } catch (Exception e) {
                            // Ignore invalid budget values
                        }
                    }
                    if (String.isNotBlank(duration)) {
                        if (durationPreferences.containsKey(duration)) {
                            durationPreferences.put(duration, durationPreferences.get(duration) + 1);
                        } else {
                            durationPreferences.put(duration, 1);
                        }
                    }
                }
            } else if (companion.Status__c == 'Declined') {
                analysis.declinedCount++;
            }
        }
        
        // Calculate optimal dates
        if (!earliestDates.isEmpty() && !latestDates.isEmpty()) {
            earliestDates.sort();
            latestDates.sort();
            
            // Latest possible start date (to accommodate everyone)
            analysis.optimalStartDate = earliestDates[earliestDates.size() - 1];
            // Earliest possible end date (to accommodate everyone)
            analysis.optimalEndDate = latestDates[0];
        }
        
        // Calculate budget recommendations
        if (!budgets.isEmpty()) {
            budgets.sort();
            
            Decimal sum = 0;
            for (Decimal budget : budgets) {
                sum += budget;
            }
            analysis.averageBudget = sum / budgets.size();
            analysis.medianBudget = budgets[budgets.size() / 2];
            analysis.minBudget = budgets[0];
            analysis.maxBudget = budgets[budgets.size() - 1];
        }
        
        // Most popular duration
        String mostPopularDuration = null;
        Integer maxVotes = 0;
        for (String duration : durationPreferences.keySet()) {
            if (durationPreferences.get(duration) > maxVotes) {
                maxVotes = durationPreferences.get(duration);
                mostPopularDuration = duration;
            }
        }
        analysis.recommendedDuration = mostPopularDuration;
        
        return analysis;
    } catch (Exception e) {
        throw new AuraHandledException('Error analyzing trip responses: ' + e.getMessage());
    }
}