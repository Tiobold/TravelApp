// GoogleMapsRepository.cls
public with sharing class GoogleMapsRepository {
    
    @AuraEnabled(cacheable=true)
    public static String getGoogleMapsApiKey() {
        try {
            // Using Custom Settings approach
            Google_Maps_API_Settings__c settings = Google_Maps_API_Settings__c.getInstance();
            if (settings != null && String.isNotBlank(settings.API_Key__c)) {
                return settings.API_Key__c;
            }
            
            // Fallback to default value or throw exception
            throw new AuraHandledException('Google Maps API key not configured');
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving Google Maps API key: ' + e.getMessage());
        }
    }
}