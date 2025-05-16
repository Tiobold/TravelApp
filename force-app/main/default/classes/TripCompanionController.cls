public with sharing class TripCompanionController {
    
    @AuraEnabled(cacheable=true)
    public static List<CompanionWrapper> getTripCompanions(String tripId) {
        // Get companions for the current trip with status "Confirmed"
        List<CompanionWrapper> companions = new List<CompanionWrapper>();
        
        // Query for trip companions
        List<Travel_Companion__c> travelCompanions = [
            SELECT Id, Name, Status__c, Contact__c, Contact__r.Name, Contact__r.Photo_URL__c
            FROM Travel_Companion__c 
            WHERE Trip__c = :tripId AND Status__c = 'Confirmed'
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
        
        // Create wrapper objects
        for (Travel_Companion__c companion : travelCompanions) {
            CompanionWrapper wrapper = new CompanionWrapper();
            wrapper.Id = companion.Id;
            wrapper.Name = companion.Contact__r.Name;
            wrapper.Status = companion.Status__c;
            wrapper.PhotoURL = companion.Contact__r.Photo_URL__c;
            wrapper.TripCount = tripCountByContact.containsKey(companion.Contact__c) ? 
                                tripCountByContact.get(companion.Contact__c) : 0;
            companions.add(wrapper);
        }
        
        return companions;
    }
    
    // Wrapper class to return to LWC
    public class CompanionWrapper {
        @AuraEnabled public String Id;
        @AuraEnabled public String Name;
        @AuraEnabled public String Status;
        @AuraEnabled public String PhotoURL;
        @AuraEnabled public Integer TripCount;
    }
}