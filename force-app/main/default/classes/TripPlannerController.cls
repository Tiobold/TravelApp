public without sharing class TripPlannerController {
    
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
    
    // Get or create the custom trip planner survey
    @AuraEnabled
    public static String getTripPlannerSurveyId() {
        try {
            // Look for existing custom Trip Planner survey
            List<Survey__c> existingSurveys = [
                SELECT Id 
                FROM Survey__c 
                WHERE Name = 'Trip Planner Survey' 
                LIMIT 1
            ];
            
            if (!existingSurveys.isEmpty()) {
                return existingSurveys[0].Id;
            }
            
            // Create the survey if it doesn't exist
            return createTripPlannerSurvey();
            
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving Trip Planner survey: ' + e.getMessage());
        }
    }
    
    // Create the default trip planner survey with questions
    private static String createTripPlannerSurvey() {
        try {
            // Create the survey
            Survey__c survey = new Survey__c(
                Name = 'Trip Planner Survey',
                Description__c = 'Default survey for trip planning invitations',
                Status__c = 'Active'
            );
            insert survey;
            
            // Create default survey questions
            List<Survey_Question__c> questions = new List<Survey_Question__c>();
            
            questions.add(new Survey_Question__c(
                Survey__c = survey.Id,
                Question_Text__c = 'Are you interested in participating in this trip?',
                Question_Type__c = 'Single Choice',
                Order__c = 1
            ));
            
            questions.add(new Survey_Question__c(
                Survey__c = survey.Id,
                Question_Text__c = 'For how long would you be able to travel?',
                Question_Type__c = 'Single Choice',
                Order__c = 2
            ));
            
            questions.add(new Survey_Question__c(
                Survey__c = survey.Id,
                Question_Text__c = 'What is your budget (in Euro)?',
                Question_Type__c = 'Number',
                Order__c = 3
            ));
            
            questions.add(new Survey_Question__c(
                Survey__c = survey.Id,
                Question_Text__c = 'What is your earliest available departure date?',
                Question_Type__c = 'Date',
                Order__c = 4
            ));
            
            questions.add(new Survey_Question__c(
                Survey__c = survey.Id,
                Question_Text__c = 'What is the latest date you need to be back home?',
                Question_Type__c = 'Date',
                Order__c = 5
            ));
            
            questions.add(new Survey_Question__c(
                Survey__c = survey.Id,
                Question_Text__c = 'Any additional notes or special requirements?',
                Question_Type__c = 'Long Text',
                Order__c = 6
            ));
            
            if (!questions.isEmpty()) {
                insert questions;
            }
            
            return survey.Id;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error creating Trip Planner survey: ' + e.getMessage());
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
            
            // Get or create survey
            String surveyId = getTripPlannerSurveyId();
            
            // Return success with survey ID
            return new TripCreationResult(true, newTrip.Id, surveyId, null, null);
            
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
                // Generate unique survey token
                String surveyToken = generateUniqueToken();
                
                // Create a companion record as 'Invited' with survey token
                Travel_Companion__c companion = new Travel_Companion__c(
                    Trip__c = tripId,
                    Contact__c = contact.Id,
                    Name = contact.Name,
                    Status__c = 'Invited',
                    Survey_Token__c = surveyToken
                );
                companions.add(companion);
                
                // Create survey invite link
                String siteUrl = getSiteUrl();
                String surveyLink = siteUrl + '?token=' + surveyToken;
                
                // Create email
                Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
                email.setTargetObjectId(contact.Id);
                email.setSubject('You\'re Invited: Help Plan ' + trip.Name);
                
                String emailBody = buildInvitationEmail(contact.Name, trip.Name, 
                    trip.Start_Date__c, trip.End_Date__c, surveyLink);
                
                email.setHtmlBody(emailBody);
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
    
    // Get custom survey questions for display
    @AuraEnabled
    public static List<SurveyQuestionWrapper> getSurveyQuestions(String surveyId) {
        try {
            List<Survey_Question__c> questions = [
                SELECT Id, Question_Text__c, Question_Type__c, Order__c
                FROM Survey_Question__c
                WHERE Survey__c = :surveyId
                ORDER BY Order__c ASC
            ];
            
            List<SurveyQuestionWrapper> questionWrappers = new List<SurveyQuestionWrapper>();
            
            for (Survey_Question__c question : questions) {
                SurveyQuestionWrapper wrapper = new SurveyQuestionWrapper();
                wrapper.id = question.Id;
                wrapper.questionText = question.Question_Text__c;
                wrapper.questionType = question.Question_Type__c;
                wrapper.orderNumber = question.Order__c != null ? Integer.valueOf(question.Order__c) : 0;
                wrapper.isRequired = true; // Make all questions required by default
                
                // Add options for choice questions
                if (question.Question_Type__c == 'Single Choice') {
                    if (question.Question_Text__c.contains('interested in participating')) {
                        wrapper.options = new List<String>{'Yes', 'No'};
                    } else if (question.Question_Text__c.contains('how long')) {
                        wrapper.options = new List<String>{'Weekend', '1 Week', '10 Days', 'Any duration is good'};
                    }
                }
                
                questionWrappers.add(wrapper);
            }
            
            return questionWrappers;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving survey questions: ' + e.getMessage());
        }
    }
    
    // Generate unique token for survey access
    private static String generateUniqueToken() {
        Blob randomBlob = Crypto.generateAesKey(256);
        String hexString = EncodingUtil.convertToHex(randomBlob);
        return hexString.substring(0, 32); // 32 character token
    }
    
    // Get the site URL (configure this based on your community/site)
    private static String getSiteUrl() {
        // Update with your actual site URL
        return 'https://orgfarm-e65813f2a4-dev-ed.develop.my.site.com/TripSurvey123';
    }
    
    // Build invitation email HTML
    private static String buildInvitationEmail(String contactName, String tripName, 
                                             Date startDate, Date endDate, String surveyLink) {
        String emailBody = '<!DOCTYPE html>';
        emailBody += '<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">';
        emailBody += '<div style="max-width: 600px; margin: 0 auto; padding: 20px;">';
        
        // Header
        emailBody += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">';
        emailBody += '<h1 style="margin: 0; font-size: 28px;">✈️ Trip Planning Invitation</h1>';
        emailBody += '</div>';
        
        // Main content
        emailBody += '<div style="background: white; padding: 30px; margin-top: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">';
        emailBody += '<h2 style="color: #667eea;">Hello ' + contactName + '!</h2>';
        emailBody += '<p style="font-size: 16px;">You\'ve been invited to help plan an upcoming trip:</p>';
        
        emailBody += '<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">';
        emailBody += '<h3 style="color: #333; margin-top: 0;">🌍 ' + tripName + '</h3>';
        emailBody += '<p style="margin: 5px 0;"><strong>Tentative Dates:</strong> ' + startDate.format() + ' to ' + endDate.format() + '</p>';
        emailBody += '</div>';
        
        emailBody += '<p style="font-size: 16px;">We need your input to make this trip amazing! Please take a few minutes to complete our trip planning survey:</p>';
        
        // CTA Button
        emailBody += '<div style="text-align: center; margin: 30px 0;">';
        emailBody += '<a href="' + surveyLink + '" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold; display: inline-block;">Complete Survey</a>';
        emailBody += '</div>';
        
        emailBody += '<p style="font-size: 14px; color: #666;">The survey will help us understand:</p>';
        emailBody += '<ul style="color: #666;">';
        emailBody += '<li>Your interest in joining the trip</li>';
        emailBody += '<li>Your availability and preferred dates</li>';
        emailBody += '<li>Your budget preferences</li>';
        emailBody += '<li>Any special requirements or preferences</li>';
        emailBody += '</ul>';
        
        emailBody += '</div>';
        emailBody += '</div></body></html>';
        
        return emailBody;
    }
    
    // Method to validate survey token and get companion info with survey questions
    @AuraEnabled
    public static SurveyAccessResult validateSurveyToken(String token) {
        try {
            if (String.isBlank(token)) {
                return new SurveyAccessResult(false, null, 'Survey token is required');
            }
            
            List<Travel_Companion__c> companions = [
                SELECT Id, Name, Contact__c, Trip__c, Trip__r.Name, 
                    Trip__r.Start_Date__c, Trip__r.End_Date__c, Status__c
                FROM Travel_Companion__c 
                WHERE Survey_Token__c = :token.trim()
                AND Status__c = 'Invited'
                LIMIT 1 
            ];
            
            if (companions.isEmpty()) {
                return new SurveyAccessResult(false, null, 'Invalid or expired survey link. Token: ' + token);
            }
            
            Travel_Companion__c companion = companions[0];
            
            // Get the survey ID
            String surveyId;
            try {
                surveyId = getTripPlannerSurveyId();
            } catch (Exception e) {
                System.debug('Error getting survey ID: ' + e.getMessage());
                surveyId = null;
            }
            
            // Get survey questions
            List<SurveyQuestionWrapper> questions = new List<SurveyQuestionWrapper>();
            try {
                if (surveyId != null) {
                    questions = getSurveyQuestions(surveyId);
                }
            } catch (Exception e) {
                System.debug('Error getting survey questions: ' + e.getMessage());
                // Create default questions if none found
                questions = createDefaultQuestions();
            }
            
            SurveyInfo surveyInfo = new SurveyInfo();
            surveyInfo.companionId = companion.Id;
            surveyInfo.companionName = companion.Name;
            surveyInfo.tripId = companion.Trip__c;
            surveyInfo.tripName = companion.Trip__r.Name;
            surveyInfo.tentativeStartDate = companion.Trip__r.Start_Date__c;
            surveyInfo.tentativeEndDate = companion.Trip__r.End_Date__c;
            surveyInfo.surveyId = surveyId;
            surveyInfo.questions = questions;
            
            return new SurveyAccessResult(true, surveyInfo, null);
            
        } catch (Exception e) {
            System.debug('Error in validateSurveyToken: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new SurveyAccessResult(false, null, 'Error validating survey token');
        }
    }

    // Create default questions if none found
    private static List<SurveyQuestionWrapper> createDefaultQuestions() {
        List<SurveyQuestionWrapper> questions = new List<SurveyQuestionWrapper>();
        
        SurveyQuestionWrapper q1 = new SurveyQuestionWrapper();
        q1.id = 'default-q1';
        q1.questionText = 'Are you interested in participating in this trip?';
        q1.questionType = 'Single Choice';
        q1.orderNumber = 1;
        q1.isRequired = true;
        q1.options = new List<String>{'Yes', 'No'};
        questions.add(q1);
        
        SurveyQuestionWrapper q2 = new SurveyQuestionWrapper();
        q2.id = 'default-q2';
        q2.questionText = 'For how long would you be able to travel?';
        q2.questionType = 'Single Choice';
        q2.orderNumber = 2;
        q2.isRequired = true;
        q2.options = new List<String>{'Weekend', '1 Week', '10 Days', 'Any duration is good'};
        questions.add(q2);
        
        SurveyQuestionWrapper q3 = new SurveyQuestionWrapper();
        q3.id = 'default-q3';
        q3.questionText = 'What is your budget (in Euro)?';
        q3.questionType = 'Number';
        q3.orderNumber = 3;
        q3.isRequired = true;
        questions.add(q3);
        
        SurveyQuestionWrapper q4 = new SurveyQuestionWrapper();
        q4.id = 'default-q4';
        q4.questionText = 'What is your earliest available departure date?';
        q4.questionType = 'Date';
        q4.orderNumber = 4;
        q4.isRequired = true;
        questions.add(q4);
        
        SurveyQuestionWrapper q5 = new SurveyQuestionWrapper();
        q5.id = 'default-q5';
        q5.questionText = 'Any additional notes or special requirements?';
        q5.questionType = 'Long Text';
        q5.orderNumber = 5;
        q5.isRequired = false;
        questions.add(q5);
        
        return questions;
    }
    
    // Method to submit survey response
    @AuraEnabled
    public static ResponseSubmissionResult submitSurveyResponse(String token, String responseData) {
        try {
            // Validate parameters
            if (String.isBlank(token)) {
                return new ResponseSubmissionResult(false, 'Missing survey token', null);
            }
            
            if (String.isBlank(responseData)) {
                return new ResponseSubmissionResult(false, 'No response data provided', null);
            }
            
            // Validate token first
            SurveyAccessResult accessResult = validateSurveyToken(token);
            if (!accessResult.success) {
                return new ResponseSubmissionResult(false, accessResult.error, null);
            }
            
            try {
                // Parse response data (defensive)
                Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(responseData);
                
                // Update companion record with response
                Travel_Companion__c companion = new Travel_Companion__c(
                    Id = accessResult.surveyInfo.companionId,
                    Survey_Response__c = responseData,
                    Survey_Completed_Date__c = System.now()
                );
                
                // Update status based on participation response
                Boolean wantsToParticipate = false;
                Object participationObj = response.get('wantsToParticipate');
                
                if (participationObj != null) {
                    // Handle different data types
                    if (participationObj instanceof Boolean) {
                        wantsToParticipate = (Boolean) participationObj;
                    } else if (participationObj instanceof String) {
                        wantsToParticipate = 'Yes'.equalsIgnoreCase((String) participationObj) || 
                                            'true'.equalsIgnoreCase((String) participationObj);
                    }
                }
                
                if (wantsToParticipate) {
                    companion.Status__c = 'Interested';
                } else {
                    companion.Status__c = 'Declined';
                }
                
                update companion;
                
                // Create a trip details link with token
                String tripDetailsLink = null;
                
                // Only generate the link if interested
                if (wantsToParticipate) {
                    // Get or create a token for trip map access
                    String tripToken = TripAccessController.getOrCreateTripAccessToken(accessResult.surveyInfo.companionId);
                    tripDetailsLink = 'https://orgfarm-e65813f2a4-dev-ed.develop.my.site.com/TripSurvey123/tripdetails?token=' + tripToken;
                    
                    // Send confirmation email
                    sendTripSurveyConfirmationEmail(companion, accessResult.surveyInfo, tripDetailsLink);
                }
                
                return new ResponseSubmissionResult(true, 
                    'Thank you for your response! ' + 
                    (wantsToParticipate ? 'The trip organizer will review your preferences and get back to you soon.' : 'We appreciate your feedback.'), 
                    tripDetailsLink);
                
            } catch (Exception e) {
                System.debug('Error processing response: ' + e.getMessage());
                return new ResponseSubmissionResult(false, 'Error processing response: ' + e.getMessage(), null);
            }
            
        } catch (Exception e) {
            System.debug('Error in submitSurveyResponse: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new ResponseSubmissionResult(false, 'Error submitting response', null);
        }
    }
    
    // Method to analyze all responses for a trip
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
    
    // Wrapper classes
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
    
    public class SurveyQuestionWrapper {
        @AuraEnabled public String id {get; set;}
        @AuraEnabled public String questionText {get; set;}
        @AuraEnabled public String questionType {get; set;}
        @AuraEnabled public Integer orderNumber {get; set;}
        @AuraEnabled public Boolean isRequired {get; set;}
        @AuraEnabled public List<String> options {get; set;}
    }
    
    public class SurveyAccessResult {
        @AuraEnabled public Boolean success {get; set;}
        @AuraEnabled public SurveyInfo surveyInfo {get; set;}
        @AuraEnabled public String error {get; set;}
        
        public SurveyAccessResult(Boolean success, SurveyInfo surveyInfo, String error) {
            this.success = success;
            this.surveyInfo = surveyInfo;
            this.error = error;
        }
    }
    
    public class SurveyInfo {
        @AuraEnabled public String companionId {get; set;}
        @AuraEnabled public String companionName {get; set;}
        @AuraEnabled public String tripId {get; set;}
        @AuraEnabled public String tripName {get; set;}
        @AuraEnabled public Date tentativeStartDate {get; set;}
        @AuraEnabled public Date tentativeEndDate {get; set;}
        @AuraEnabled public String surveyId {get; set;}
        @AuraEnabled public List<SurveyQuestionWrapper> questions {get; set;}
    }
    
    public class ResponseSubmissionResult {
        @AuraEnabled public Boolean success {get; set;}
        @AuraEnabled public String message {get; set;}
        @AuraEnabled public String tripDetailsLink {get; set;} // New field for trip details link
        
        public ResponseSubmissionResult(Boolean success, String message, String tripDetailsLink) {
            this.success = success;
            this.message = message;
            this.tripDetailsLink = tripDetailsLink;
        }
    }

    private static void sendTripSurveyConfirmationEmail(Travel_Companion__c companion, SurveyInfo surveyInfo, String tripDetailsLink) {
        try {
            // Get the companion's contact info
            Contact contact = [SELECT Id, Name, Email FROM Contact WHERE Id = :companion.Contact__c LIMIT 1];
            
            if (contact.Email == null) {
                System.debug('Cannot send email: No email address found for contact');
                return;
            }
            
            // Create email message
            Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
            email.setTargetObjectId(contact.Id);
            email.setSubject('Thank You for Your Trip Survey Response - ' + surveyInfo.tripName);
            
            // Build email content
            String emailBody = buildSurveyConfirmationEmail(contact.Name, surveyInfo, tripDetailsLink);
            
            email.setHtmlBody(emailBody);
            
            // Send the email
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ email });
            
        } catch (Exception e) {
            System.debug('Error sending confirmation email: ' + e.getMessage());
            // We don't want to fail the whole process if just the email fails
        }
    }

    private static String buildSurveyConfirmationEmail(String contactName, SurveyInfo surveyInfo, String tripDetailsLink) {
        String emailBody = '<!DOCTYPE html>';
        emailBody += '<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">';
        emailBody += '<div style="max-width: 600px; margin: 0 auto; padding: 20px;">';
        
        // Header
        emailBody += '<div style="background: linear-gradient(135deg, #1b96ff 0%, #9058ff 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">';
        emailBody += '<h1 style="margin: 0; font-size: 28px;">✈️ Trip Survey Confirmation</h1>';
        emailBody += '</div>';
        
        // Main content
        emailBody += '<div style="background: white; padding: 30px; margin-top: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">';
        emailBody += '<h2 style="color: #1b96ff;">Hello ' + contactName + '!</h2>';
        emailBody += '<p style="font-size: 16px;">Thank you for your interest in the upcoming trip:</p>';
        
        emailBody += '<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">';
        emailBody += '<h3 style="color: #333; margin-top: 0;">🌍 ' + surveyInfo.tripName + '</h3>';
        emailBody += '<p style="margin: 5px 0;"><strong>Dates:</strong> ' + 
                    formatDate(surveyInfo.tentativeStartDate) + ' to ' + 
                    formatDate(surveyInfo.tentativeEndDate) + '</p>';
        emailBody += '</div>';
        
        emailBody += '<p style="font-size: 16px;">Your survey response has been recorded and the trip organizer will review your preferences.</p>';
        
        // CTA Button for Trip Details
        emailBody += '<div style="text-align: center; margin: 30px 0;">';
        emailBody += '<a href="' + tripDetailsLink + '" style="background: #1b96ff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold; display: inline-block;">View Trip Details</a>';
        emailBody += '</div>';
        
        emailBody += '<p style="font-size: 14px; color: #666;">You can now access and view the trip details page to see the itinerary, other travelers, and trip information. You\'ll receive further updates as the trip planning progresses.</p>';
        
        emailBody += '</div>';
        emailBody += '</div></body></html>';
        
        return emailBody;
    }

    // Helper to format date
    private static String formatDate(Date d) {
        if (d == null) return '';
        return d.month() + '/' + d.day() + '/' + d.year();
    }
    
    public class TripAnalysisResult {
        @AuraEnabled public Integer totalInvited {get; set;}
        @AuraEnabled public Integer totalResponded {get; set;}
        @AuraEnabled public Integer interestedCount {get; set;}
        @AuraEnabled public Integer declinedCount {get; set;}
        @AuraEnabled public Date optimalStartDate {get; set;}
        @AuraEnabled public Date optimalEndDate {get; set;}
        @AuraEnabled public Decimal averageBudget {get; set;}
        @AuraEnabled public Decimal medianBudget {get; set;}
        @AuraEnabled public Decimal minBudget {get; set;}
        @AuraEnabled public Decimal maxBudget {get; set;}
        @AuraEnabled public String recommendedDuration {get; set;}
        
        public TripAnalysisResult() {
            this.totalInvited = 0;
            this.totalResponded = 0;
            this.interestedCount = 0;
            this.declinedCount = 0;
            this.averageBudget = 0;
            this.medianBudget = 0;
            this.minBudget = 0;
            this.maxBudget = 0;
        }
    }
    @AuraEnabled
    public static String generateTripAccessLink(Id companionId) {
        try {
            // Get or create token
            String token = TripAccessController.getOrCreateTripAccessToken(companionId);
            
            // Get companion information
            Travel_Companion__c companion = [
                SELECT Id, Name, Contact__c, Contact__r.Email, Trip__c, Trip__r.Name, Status__c 
                FROM Travel_Companion__c 
                WHERE Id = :companionId
                LIMIT 1
            ];
            
            // Check if email exists
            if (companion.Contact__c == null || String.isBlank(companion.Contact__r.Email)) {
                throw new AuraHandledException('No email address found for this traveler');
            }
            
            // Create access link
            String siteUrl = getTripMapSiteUrl();
            String accessLink = siteUrl + '?token=' + token;
            
            // Send email with access link
            sendTripAccessEmail(companion, accessLink);
            
            return accessLink;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error generating trip access link: ' + e.getMessage());
        }
    }

    private static void sendTripAccessEmail(Travel_Companion__c companion, String accessLink) {
        try {
            // Create email
            Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
            email.setTargetObjectId(companion.Contact__c);
            email.setSubject('Access Your Trip: ' + companion.Trip__r.Name);
            
            String emailBody = buildTripAccessEmail(companion.Name, companion.Trip__r.Name, accessLink, companion.Status__c);
            
            email.setHtmlBody(emailBody);
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ email });
            
        } catch (Exception e) {
            throw new AuraHandledException('Error sending trip access email: ' + e.getMessage());
        }
    }

    private static String buildTripAccessEmail(String contactName, String tripName, String accessLink, String status) {
        String emailBody = '<!DOCTYPE html>';
        emailBody += '<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">';
        emailBody += '<div style="max-width: 600px; margin: 0 auto; padding: 20px;">';
        
        // Header
        emailBody += '<div style="background: linear-gradient(135deg, #1b96ff 0%, #9058ff 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">';
        emailBody += '<h1 style="margin: 0; font-size: 28px;">✈️ Your Trip Access</h1>';
        emailBody += '</div>';
        
        // Main content
        emailBody += '<div style="background: white; padding: 30px; margin-top: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">';
        emailBody += '<h2 style="color: #1b96ff;">Hello ' + contactName + '!</h2>';
        
        if (status == 'Confirmed') {
            emailBody += '<p style="font-size: 16px;">You are confirmed for this trip! You can now access and contribute to the trip planning:</p>';
        } else {
            emailBody += '<p style="font-size: 16px;">Thanks for your interest in this trip! You can access the trip details here:</p>';
        }
        
        emailBody += '<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">';
        emailBody += '<h3 style="color: #333; margin-top: 0;">🌍 ' + tripName + '</h3>';
        emailBody += '</div>';
        
        // CTA Button
        emailBody += '<div style="text-align: center; margin: 30px 0;">';
        emailBody += '<a href="' + accessLink + '" style="background: #1b96ff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold; display: inline-block;">Access Trip Details</a>';
        emailBody += '</div>';
        
        if (status == 'Confirmed') {
            emailBody += '<p style="font-size: 14px; color: #666;">With your confirmed status, you can:</p>';
            emailBody += '<ul style="color: #666;">';
            emailBody += '<li>View the full trip itinerary</li>';
            emailBody += '<li>Add new locations to the itinerary</li>';
            emailBody += '<li>Check trip expenses</li>';
            emailBody += '<li>Explore flight and hotel options</li>';
            emailBody += '</ul>';
        } else {
            emailBody += '<p style="font-size: 14px; color: #666;">As an interested traveler, you can:</p>';
            emailBody += '<ul style="color: #666;">';
            emailBody += '<li>View the trip itinerary</li>';
            emailBody += '<li>Explore potential destinations</li>';
            emailBody += '<li>Contact the trip organizer to confirm your participation</li>';
            emailBody += '</ul>';
        }
        
        emailBody += '</div>';
        emailBody += '</div></body></html>';
        
        return emailBody;
    }

    // Get the trip map site URL
    private static String getTripMapSiteUrl() {
        // Update with your actual site URL
        return 'https://orgfarm-e65813f2a4-dev-ed.develop.my.site.com/TripSurvey123/tripdetails';
    }
}