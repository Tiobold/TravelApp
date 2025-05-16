public with sharing class TripCompanionController {
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getTripCompanions(String tripId) {
        // Create a map to store the response
        Map<String, Object> response = new Map<String, Object>();
        
        // Lists to store companions by status
        List<CompanionWrapper> confirmedCompanions = new List<CompanionWrapper>();
        List<CompanionWrapper> invitedCompanions = new List<CompanionWrapper>();
        
        try {
            // Query for all trip companions (both confirmed and invited)
            List<Travel_Companion__c> travelCompanions = [
                SELECT Id, Name, Status__c, Contact__c, Contact__r.Name, Contact__r.Photo_URL__c
                FROM Travel_Companion__c 
                WHERE Trip__c = :tripId 
                AND (Status__c = 'Confirmed' OR Status__c = 'Invited')
            ];
            
            // Get unique contacts to count trips
            Set<Id> contactIds = new Set<Id>();
            for (Travel_Companion__c companion : travelCompanions) {
                if (companion.Contact__c != null) {
                    contactIds.add(companion.Contact__c);
                }
            }
            
            // Count trips per contact
            Map<Id, Integer> tripCountByContact = new Map<Id, Integer>();
            for (AggregateResult ar : [
                SELECT Contact__c, COUNT(Id) tripCount
                FROM Travel_Companion__c
                WHERE Contact__c IN :contactIds
                AND Status__c = 'Confirmed'
                GROUP BY Contact__c
            ]) {
                Id contactId = (Id)ar.get('Contact__c');
                Integer tripCount = (Integer)ar.get('tripCount');
                tripCountByContact.put(contactId, tripCount);
            }
            
            // Create wrapper objects and add to appropriate list based on status
            for (Travel_Companion__c companion : travelCompanions) {
                CompanionWrapper wrapper = new CompanionWrapper();
                wrapper.Id = companion.Id;
                wrapper.Name = companion.Contact__r.Name;
                wrapper.Status = companion.Status__c;
                wrapper.PhotoURL = companion.Contact__r.Photo_URL__c;
                wrapper.TripCount = tripCountByContact.containsKey(companion.Contact__c) ? 
                                    tripCountByContact.get(companion.Contact__c) : 0;
                wrapper.ContactId = companion.Contact__c;
                
                if (companion.Status__c == 'Confirmed') {
                    confirmedCompanions.add(wrapper);
                } else if (companion.Status__c == 'Invited') {
                    invitedCompanions.add(wrapper);
                }
            }
            
            // Add lists to response map
            response.put('confirmed', confirmedCompanions);
            response.put('invited', invitedCompanions);
            
        } catch(Exception e) {
            // In case of error, return empty lists
            response.put('confirmed', new List<CompanionWrapper>());
            response.put('invited', new List<CompanionWrapper>());
            response.put('error', e.getMessage());
        }
        
        return response;
    }
    
    @AuraEnabled
    public static CompanionWrapper getCompanionDetails(String companionId) {
        Travel_Companion__c companion = [
            SELECT Id, Name, Status__c, Contact__c, 
                   Contact__r.Name, Contact__r.Email, Contact__r.Phone, Contact__r.Photo_URL__c
            FROM Travel_Companion__c 
            WHERE Id = :companionId
            LIMIT 1
        ];
        
        if (companion == null) {
            return null;
        }
        
        // Get the trip count for this contact
        Integer tripCount = [
            SELECT COUNT() 
            FROM Travel_Companion__c 
            WHERE Contact__c = :companion.Contact__c
            AND Status__c = 'Confirmed'
        ];
        
        CompanionWrapper wrapper = new CompanionWrapper();
        wrapper.Id = companion.Id;
        wrapper.Name = companion.Contact__r.Name;
        wrapper.Email = companion.Contact__r.Email;
        wrapper.Phone = companion.Contact__r.Phone;
        wrapper.Status = companion.Status__c;
        wrapper.PhotoURL = companion.Contact__r.Photo_URL__c;
        wrapper.TripCount = tripCount;
        wrapper.ContactId = companion.Contact__c;
        
        return wrapper;
    }
    
    @AuraEnabled
    public static Map<String, Object> getCompanionExpenses(String companionId, String tripId) {
        Map<String, Object> result = new Map<String, Object>();
        
        // Get companion contact ID
        Id contactId = [
            SELECT Contact__c 
            FROM Travel_Companion__c 
            WHERE Id = :companionId
            LIMIT 1
        ].Contact__c;
        
        // Get expenses for this trip paid by the companion
        List<Expense__c> expenses = [
            SELECT Id, Name, Amount__c, Category__c, Date__c
            FROM Expense__c
            WHERE Trip__c = :tripId
            AND Paid_By__c = :contactId
            ORDER BY Date__c DESC
        ];
        
        // Get total expenses for this trip
        AggregateResult totalResult = [
            SELECT SUM(Amount__c) total
            FROM Expense__c
            WHERE Trip__c = :tripId
        ];
        
        Decimal tripTotal = (Decimal)totalResult.get('total');
        
        result.put('expenses', expenses);
        result.put('tripTotal', tripTotal);
        
        return result;
    }
    
    @AuraEnabled
    public static List<Trip__c> getSharedTrips(String companionId) {
        // Get companion contact ID
        Id contactId = [
            SELECT Contact__c 
            FROM Travel_Companion__c 
            WHERE Id = :companionId
            LIMIT 1
        ].Contact__c;
        
        // Get trips this companion has participated in
        List<Id> tripIds = new List<Id>();
        for (Travel_Companion__c tc : [
            SELECT Trip__c
            FROM Travel_Companion__c
            WHERE Contact__c = :contactId
            AND Status__c = 'Confirmed'
        ]) {
            tripIds.add(tc.Trip__c);
        }
        
        // Return trip details
        return [
            SELECT Id, Name, Start_Date__c, End_Date__c, Destination__c, Country__c
            FROM Trip__c
            WHERE Id IN :tripIds
            ORDER BY Start_Date__c DESC
        ];
    }
    
    // Wrapper class to return to LWC
    public class CompanionWrapper {
        @AuraEnabled public String Id;
        @AuraEnabled public String Name;
        @AuraEnabled public String Email;
        @AuraEnabled public String Phone;
        @AuraEnabled public String Status;
        @AuraEnabled public String PhotoURL;
        @AuraEnabled public Integer TripCount;
        @AuraEnabled public Id ContactId;
    }
}