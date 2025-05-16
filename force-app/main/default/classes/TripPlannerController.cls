public with sharing class TripPlannerController {
    
    @AuraEnabled
    public static List<Contact> getContacts() {
        try {
            return [
                SELECT Id, Name, Email, Phone
                FROM Contact
                WHERE Email != null
                ORDER BY Name ASC
                LIMIT 100
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving contacts: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static String getTripPlannerSurveyId() {
        try {
            // Get the Trip Planner survey
            Survey survey = [
                SELECT Id 
                FROM Survey 
                WHERE Name = 'Trip Planner' 
                LIMIT 1
            ];
            
            return survey.Id;
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving Trip Planner survey: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static TripCreationResult createTripWithSurvey(String tripData) {
        try {
            // Parse the incoming JSON data
            Map<String, Object> params = (Map<String, Object>) JSON.deserializeUntyped(tripData);
            
            // Handle selectedContacts with proper type conversion
            List<Object> selectedContactsRaw = (List<Object>) params.get('selectedContacts');
            List<String> selectedContacts = new List<String>();
            
            // Convert each object to string to ensure type consistency
            if (selectedContactsRaw != null) {
                for (Object obj : selectedContactsRaw) {
                    selectedContacts.add(String.valueOf(obj));
                }
            }
            
            // Create the trip record
            Trip__c newTrip = new Trip__c(
                Name = (String) params.get('name'),
                Start_Date__c = Date.valueOf((String) params.get('startDate')),
                End_Date__c = Date.valueOf((String) params.get('endDate')),
                Budget__c = (Decimal) params.get('budget'),
                Total_Spent__c = 0,
                CurrencyIsoCode = (String) params.get('currency'),
                Country__c = (String) params.get('destination'),
                Destination__c = (String) params.get('destination'),
                Description__c = (String) params.get('notes'),
                Status__c = 'Draft'
            );
            
            insert newTrip;
            
            // Return success without creating a survey invitation
            // We'll simulate survey functionality without using the actual Survey feature
            return new TripCreationResult(true, newTrip.Id, null, null, null);
            
        } catch (Exception e) {
            return new TripCreationResult(false, null, null, null, e.getMessage());
        }
    }
    
    @AuraEnabled
    public static InvitationResult sendInvitations(Id tripId, Id surveyId, Id surveyInvitationId, List<String> contactIds) {
        try {
            // Convert string IDs to Salesforce IDs
            List<Id> contactIdList = new List<Id>();
            for(String strId : contactIds) {
                contactIdList.add((Id)strId);
            }
            
            Trip__c trip = [SELECT Id, Name, Start_Date__c, End_Date__c FROM Trip__c WHERE Id = :tripId];
            List<Contact> contacts = [SELECT Id, Name, Email FROM Contact WHERE Id IN :contactIdList];
            
            List<Messaging.SingleEmailMessage> emails = new List<Messaging.SingleEmailMessage>();
            List<Travel_Companion__c> companions = new List<Travel_Companion__c>();
            
            for (Contact contact : contacts) {
                // Create a companion record as 'Invited'
                Travel_Companion__c companion = new Travel_Companion__c(
                    Trip__c = tripId,
                    Contact__c = contact.Id,
                    Name = contact.Name,
                    Status__c = 'Invited'
                );
                companions.add(companion);
                
                // Create a reference to the trip without using URL.getSalesforceBaseUrl()
                String tripReference = 'Trip: ' + trip.Name + ' (Ref: ' + tripId + ')';
                
                // Create email
                Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
                email.setTargetObjectId(contact.Id);
                email.setSubject('You\'re Invited: ' + trip.Name);
                
                String emailBody = 'Hello ' + contact.Name + ',\n\n' +
                                   'You\'ve been invited to participate in ' + trip.Name + '.\n' +
                                   'Dates: ' + trip.Start_Date__c.format() + ' to ' + trip.End_Date__c.format() + '\n\n' +
                                   'Please respond to the invitation by replying to this email or contacting the organizer directly.\n\n' +
                                   'Reference: ' + tripReference + '\n\n' +
                                   'Best regards,\nThe Travel Team';
                
                email.setPlainTextBody(emailBody);
                email.setHtmlBody(emailBody.replace('\n', '<br>'));
                emails.add(email);
            }
            
            if (!companions.isEmpty()) {
                insert companions;
            }
            
            if (!emails.isEmpty()) {
                Messaging.sendEmail(emails);
            }
            
            return new InvitationResult(true, null);
            
        } catch (Exception e) {
            return new InvitationResult(false, e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void processResponses() {
        // Process all Travel_Companion__c records with status 'Invited'
        List<Travel_Companion__c> companions = [
            SELECT Id, Status__c, Contact__c, Trip__c
            FROM Travel_Companion__c
            WHERE Status__c = 'Invited'
        ];
        
        if (companions.isEmpty()) return;
        
        // For demo purposes, we're setting all to 'Confirmed'
        // In a real implementation, you would check survey responses
        for (Travel_Companion__c companion : companions) {
            companion.Status__c = 'Confirmed';
        }
        
        update companions;
    }
    
    public class TripCreationResult {
        @AuraEnabled public Boolean success {get; set;}
        @AuraEnabled public Id tripId {get; set;}
        @AuraEnabled public Id surveyId {get; set;}
        @AuraEnabled public Id surveyInvitationId {get; set;}
        @AuraEnabled public String error {get; set;}
        
        public TripCreationResult(Boolean success, Id tripId, Id surveyId, Id surveyInvitationId, String error) {
            this.success = success;
            this.tripId = tripId;
            this.surveyId = surveyId;
            this.surveyInvitationId = surveyInvitationId;
            this.error = error;
        }
    }
    
    public class InvitationResult {
        @AuraEnabled public Boolean success {get; set;}
        @AuraEnabled public String error {get; set;}
        
        public InvitationResult(Boolean success, String error) {
            this.success = success;
            this.error = error;
        }
    }
}