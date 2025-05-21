public without sharing class TripAccessController {
    
    @AuraEnabled
    public static TripAccessResult validateTripToken(String token) {
        try {
            if (String.isBlank(token)) {
                return new TripAccessResult(false, null, 'Trip access token is required');
            }
            
            List<Travel_Companion__c> companions = [
                SELECT Id, Name, Contact__c, Trip__c, Trip__r.Name, 
                    Trip__r.Start_Date__c, Trip__r.End_Date__c, Status__c
                FROM Travel_Companion__c 
                WHERE Survey_Token__c = :token.trim()
                AND Status__c IN ('Interested', 'Confirmed')
                LIMIT 1 
            ];
            
            if (companions.isEmpty()) {
                return new TripAccessResult(false, null, 'Invalid or expired access link');
            }
            
            Travel_Companion__c companion = companions[0];
            
            // Debug log to verify companion ID
            System.debug('Valid companion ID found for token: ' + companion.Id);
            
            TripAccessInfo accessInfo = new TripAccessInfo();
            accessInfo.companionId = companion.Id;
            accessInfo.companionName = companion.Name;
            accessInfo.tripId = companion.Trip__c;
            accessInfo.tripName = companion.Trip__r.Name;
            accessInfo.startDate = companion.Trip__r.Start_Date__c;
            accessInfo.endDate = companion.Trip__r.End_Date__c;
            accessInfo.status = companion.Status__c;
            accessInfo.canEdit = companion.Status__c == 'Confirmed'; // Only confirmed travelers can edit
            
            return new TripAccessResult(true, accessInfo, null);
            
        } catch (Exception e) {
            System.debug('Error in validateTripToken: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new TripAccessResult(false, null, 'Error validating trip access token');
        }
    }
    
    // Method to get shared access token or create one if it doesn't exist
    @AuraEnabled
    public static String getOrCreateTripAccessToken(Id companionId) {
        try {
            Travel_Companion__c companion = [
                SELECT Id, Survey_Token__c, Status__c 
                FROM Travel_Companion__c 
                WHERE Id = :companionId
                LIMIT 1
            ];
            
            // Only interested or confirmed travelers can get access
            if (companion.Status__c != 'Interested' && companion.Status__c != 'Confirmed') {
                throw new AuraHandledException('Only interested or confirmed travelers can access trip details');
            }
            
            // If token exists, return it, otherwise create a new one
            if (String.isNotBlank(companion.Survey_Token__c)) {
                return companion.Survey_Token__c;
            } else {
                String newToken = generateUniqueToken();
                companion.Survey_Token__c = newToken;
                update companion;
                return newToken;
            }
            
        } catch (Exception e) {
            throw new AuraHandledException('Error getting access token: ' + e.getMessage());
        }
    }
    
    // Generate unique token for survey access
    private static String generateUniqueToken() {
        Blob randomBlob = Crypto.generateAesKey(256);
        String hexString = EncodingUtil.convertToHex(randomBlob);
        return hexString.substring(0, 32); // 32 character token
    }
    
    // Method to send trip access email
    @AuraEnabled
    public static void sendTripAccessEmail(Travel_Companion__c companion, String accessLink) {
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
    
    // Build trip access email HTML
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
    
    @AuraEnabled
    public static CompanionsResult getTripCompanionsForExternal(String token) {
        try {
            // Validate token first
            TripAccessResult accessResult = validateTripToken(token);
            if (!accessResult.success) {
                return new CompanionsResult(false, null, null, null, null, accessResult.error);
            }
            
            String tripId = accessResult.accessInfo.tripId;
            String currentCompanionId = accessResult.accessInfo.companionId;
            
            // Get all companions for this trip
            List<Travel_Companion__c> allCompanions = [
                SELECT Id, Name, Contact__c, Contact__r.Name, Status__c, 
                    Contact__r.Photo_URL__c, Trip_Count__c, IsOwner__c
                FROM Travel_Companion__c
                WHERE Trip__c = :tripId
                ORDER BY IsOwner__c DESC, Status__c ASC, Name ASC
            ];
            
            if (allCompanions.isEmpty()) {
                return new CompanionsResult(false, null, null, null, null, 'No companions found for this trip');
            }
            
            // Separate companions by status
            List<CompanionInfo> confirmed = new List<CompanionInfo>();
            List<CompanionInfo> interested = new List<CompanionInfo>();
            List<CompanionInfo> invited = new List<CompanionInfo>();
            CompanionInfo currentUser = null;
            
            for (Travel_Companion__c companion : allCompanions) {
                CompanionInfo info = new CompanionInfo();
                info.id = companion.Id;
                info.name = companion.Contact__r.Name;
                info.status = companion.Status__c;
                info.photoUrl = companion.Contact__r.Photo_URL__c;
                info.tripCount = companion.Trip_Count__c != null ? (Integer)companion.Trip_Count__c : 0;
                info.isOwner = companion.IsOwner__c;
                info.isCurrentUser = companion.Id == currentCompanionId;
                
                // Debug log to verify current user detection
                System.debug('Companion ID: ' + companion.Id + ', Current Companion ID: ' + currentCompanionId + ', Is Current User: ' + info.isCurrentUser);
                
                // Add to appropriate list
                if (companion.Id == currentCompanionId) {
                    currentUser = info;
                    System.debug('Current user found: ' + info.name + ' with status: ' + info.status);
                } else if (companion.Status__c == 'Confirmed') {
                    confirmed.add(info);
                } else if (companion.Status__c == 'Interested') {
                    interested.add(info);
                } else if (companion.Status__c == 'Invited') {
                    invited.add(info);
                }
            }
            
            // Return the result with the current user included
            return new CompanionsResult(true, confirmed, interested, invited, currentUser, null);
            
        } catch (Exception e) {
            System.debug('Error in getTripCompanionsForExternal: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new CompanionsResult(false, null, null, null, null, 'Error retrieving companions: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static SurveyAnalyticsResult getTripSurveyAnalyticsForExternal(String token) {
        try {
            // Validate token first
            TripAccessResult accessResult = validateTripToken(token);
            if (!accessResult.success) {
                return new SurveyAnalyticsResult(false, null, accessResult.error);
            }
            
            String tripId = accessResult.accessInfo.tripId;
            
            // Use the existing analyzeTripResponses method from TripPlannerController
            Object analyticsData = TripPlannerController.analyzeTripResponses(tripId);
            
            return new SurveyAnalyticsResult(true, analyticsData, null);
            
        } catch (Exception e) {
            return new SurveyAnalyticsResult(false, null, 'Error retrieving survey analytics: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static SurveyResponseResult getMySurveyResponse(String token) {
        try {
            // Validate token first
            TripAccessResult accessResult = validateTripToken(token);
            if (!accessResult.success) {
                return new SurveyResponseResult(false, null, null, accessResult.error);
            }
            
            String companionId = accessResult.accessInfo.companionId;
            
            // Get the companion's survey response
            Travel_Companion__c companion = [
                SELECT Id, Survey_Response__c, Survey_Completed_Date__c
                FROM Travel_Companion__c
                WHERE Id = :companionId
                LIMIT 1
            ];
            
            Object responseData = null;
            if (String.isNotBlank(companion.Survey_Response__c)) {
                responseData = JSON.deserializeUntyped(companion.Survey_Response__c);
            }
            
            return new SurveyResponseResult(true, responseData, companion.Survey_Completed_Date__c, null);
            
        } catch (Exception e) {
            return new SurveyResponseResult(false, null, null, 'Error retrieving survey response: ' + e.getMessage());
        }
    }
    
    // Method to send access link to a companion
    @AuraEnabled
    public static SendLinkResult sendTripAccessLink(Id companionId) {
        try {
            // Get or create token
            String token = getOrCreateTripAccessToken(companionId);
            
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
            
            return new SendLinkResult(true, 'Access link sent successfully to ' + companion.Name, null);
            
        } catch (Exception e) {
            return new SendLinkResult(false, null, 'Error sending trip access link: ' + e.getMessage());
        }
    }
    
    // Get the trip map site URL
    private static String getTripMapSiteUrl() {
        // Update with your actual site URL
        return 'https://orgfarm-e65813f2a4-dev-ed.develop.my.site.com/TripMap';
    }
    
    // Wrapper classes
    public class TripAccessResult {
        @AuraEnabled public Boolean success {get; set;}
        @AuraEnabled public TripAccessInfo accessInfo {get; set;}
        @AuraEnabled public String error {get; set;}
        
        public TripAccessResult(Boolean success, TripAccessInfo accessInfo, String error) {
            this.success = success;
            this.accessInfo = accessInfo;
            this.error = error;
        }
    }
    
    public class TripAccessInfo {
        @AuraEnabled public String companionId {get; set;}
        @AuraEnabled public String companionName {get; set;}
        @AuraEnabled public String tripId {get; set;}
        @AuraEnabled public String tripName {get; set;}
        @AuraEnabled public Date startDate {get; set;}
        @AuraEnabled public Date endDate {get; set;}
        @AuraEnabled public String status {get; set;}
        @AuraEnabled public Boolean canEdit {get; set;}
    }
    
    public class CompanionsResult {
        @AuraEnabled public Boolean success {get; set;}
        @AuraEnabled public List<CompanionInfo> confirmed {get; set;}
        @AuraEnabled public List<CompanionInfo> interested {get; set;}
        @AuraEnabled public List<CompanionInfo> invited {get; set;}
        @AuraEnabled public CompanionInfo currentUser {get; set;}
        @AuraEnabled public String error {get; set;}
        
        // Constructor with all parameters including currentUser
        public CompanionsResult(Boolean success, List<CompanionInfo> confirmed, 
                            List<CompanionInfo> interested, List<CompanionInfo> invited, 
                            CompanionInfo currentUser, String error) {
            this.success = success;
            this.confirmed = confirmed;
            this.interested = interested;
            this.invited = invited;
            this.currentUser = currentUser;
            this.error = error;
        }
        
        // Add an overload constructor for backward compatibility
        public CompanionsResult(Boolean success, List<CompanionInfo> confirmed, 
                            List<CompanionInfo> interested, List<CompanionInfo> invited, 
                            String error) {
            this(success, confirmed, interested, invited, null, error);
        }
    }
    
    public class CompanionInfo {
        @AuraEnabled public String id {get; set;}
        @AuraEnabled public String name {get; set;}
        @AuraEnabled public String status {get; set;}
        @AuraEnabled public String photoUrl {get; set;}
        @AuraEnabled public Integer tripCount {get; set;}
        @AuraEnabled public Boolean isOwner {get; set;}
        @AuraEnabled public Boolean isCurrentUser {get; set;}
    }
    
    public class SurveyAnalyticsResult {
        @AuraEnabled public Boolean success {get; set;}
        @AuraEnabled public Object analyticsData {get; set;}
        @AuraEnabled public String error {get; set;}
        
        public SurveyAnalyticsResult(Boolean success, Object analyticsData, String error) {
            this.success = success;
            this.analyticsData = analyticsData;
            this.error = error;
        }
    }
    
    public class SurveyResponseResult {
        @AuraEnabled public Boolean success {get; set;}
        @AuraEnabled public Object response {get; set;}
        @AuraEnabled public DateTime completedDate {get; set;}
        @AuraEnabled public String error {get; set;}
        
        public SurveyResponseResult(Boolean success, Object response, DateTime completedDate, String error) {
            this.success = success;
            this.response = response;
            this.completedDate = completedDate;
            this.error = error;
        }
    }
    
    public class SendLinkResult {
        @AuraEnabled public Boolean success {get; set;}
        @AuraEnabled public String message {get; set;}
        @AuraEnabled public String error {get; set;}
        
        public SendLinkResult(Boolean success, String message, String error) {
            this.success = success;
            this.message = message;
            this.error = error;
        }
    }
}