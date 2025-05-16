// LocationController.cls
public with sharing class LocationController {

    // Inner class to structure results for LWC
    public class SearchResult {
        @AuraEnabled public String place_id;
        @AuraEnabled public String name; // Name of the place
        @AuraEnabled public String formatted_address; // Address of the place
        @AuraEnabled public Double latitude;
        @AuraEnabled public Double longitude;
    }

    @AuraEnabled
    public static List<SearchResult> searchLocations(String searchTerm) {
        // Prevent callout if search term is blank
        if (String.isBlank(searchTerm)) {
            return new List<SearchResult>();
        }

        try {
            String apiKey = GoogleMapsRepository.getGoogleMapsApiKey();
            // --- Endpoint changed to Places API - Find Place From Text ---
            String endpoint = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';

            // --- Fields needed from the Places API ---
            String fieldsToRequest = 'place_id,name,formatted_address,geometry';

            // --- URL Parameters adjusted for Find Place API ---
            String urlParams = '?input=' + EncodingUtil.urlEncode(searchTerm.trim(), 'UTF-8') +
                               '&inputtype=textquery' + // Required parameter for Find Place
                               '&fields=' + EncodingUtil.urlEncode(fieldsToRequest, 'UTF-8') +
                               '&key=' + apiKey;

            Http http = new Http();
            HttpRequest request = new HttpRequest();
            request.setEndpoint(endpoint + urlParams);
            request.setMethod('GET');
            request.setTimeout(10000); // 10 second timeout

            HttpResponse response = http.send(request);
            List<SearchResult> searchResults = new List<SearchResult>();

            if (response.getStatusCode() == 200) {
                Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                String status = (String) responseBody.get('status');

                // --- Check Google API status inside the response ---
                if ('OK'.equals(status)) {
                    // --- Results are under the 'candidates' key for Find Place ---
                    List<Object> candidates = (List<Object>) responseBody.get('candidates');

                    if (candidates != null) {
                        for (Object candidate : candidates) {
                            Map<String, Object> c = (Map<String, Object>) candidate;
                            Map<String, Object> geometry = (Map<String, Object>) c.get('geometry');
                            Map<String, Object> location = (Map<String, Object>) geometry.get('location');

                            if (location != null && c.get('place_id') != null) { // Check location and place_id exist
                                SearchResult sr = new SearchResult();
                                sr.place_id = (String) c.get('place_id');
                                sr.name = (String) c.get('name'); // Get the place name
                                sr.formatted_address = (String) c.get('formatted_address');
                                sr.latitude = (Double) location.get('lat');
                                sr.longitude = (Double) location.get('lng');
                                searchResults.add(sr);
                            }
                        }
                    }
                } else if ('ZERO_RESULTS'.equals(status)) {
                    // It's not an error, just no results found. Return empty list.
                    System.debug('Google Places API returned ZERO_RESULTS for term: ' + searchTerm);
                } else {
                    // Other Google API error (INVALID_REQUEST, OVER_QUERY_LIMIT, etc.)
                    System.debug('Google Places API Error Status: ' + status + ' - Response: ' + response.getBody());
                    throw new AuraHandledException('Google Places API Error: ' + status);
                }
            } else {
                // HTTP error
                System.debug('HTTP Error calling Google Places API: ' + response.getStatusCode() + ' ' + response.getStatus() + ' - Body: ' + response.getBody());
                throw new AuraHandledException('Failed to search locations. HTTP Error: ' + response.getStatusCode());
            }

            return searchResults;

        } catch (Exception e) {
            // Catch callout exceptions, JSON exceptions, AuraHandledExceptions, etc.
            System.debug('Error searching locations: ' + e.getMessage() + ' at line ' + e.getLineNumber() + ' Stack: ' + e.getStackTraceString());
            // Re-throw as AuraHandledException so it's displayed nicely in LWC
             if (!(e instanceof AuraHandledException)) {
                 throw new AuraHandledException('An unexpected error occurred: ' + e.getMessage());
             } else {
                 throw e;
             }
        }
    }


    @AuraEnabled
    public static void createItineraryItem(String name, String notes, String category,
                                         DateTime plannedDateTime, 
                                         Decimal durationHours,   
                                         Double latitude, Double longitude, Id tripId) {
        // Validate required fields that aren't handled by <lightning-input required>
        if(latitude == null || longitude == null || tripId == null) {
             throw new AuraHandledException('Missing required location or trip information.');
        }

        try {
            Itinerary_Item__c item = new Itinerary_Item__c(
                Name = String.isBlank(name) ? 'Unnamed Item' : name, // Add default if blank
                Notes__c = notes,
                Category__c = category,
                Planned_Date_Time__c = plannedDateTime, 
                Duration_Hours__c = durationHours,     
                Location__Latitude__s = latitude,
                Location__Longitude__s = longitude,
                Trip__c = tripId,
                Order__c = getNextOrderNumber(tripId)
            );

            insert item;

        } catch (Exception e) {
            System.debug('Error creating itinerary item: ' + e.getMessage() + ' Stack: ' + e.getStackTraceString());
            // Ensure it's always an AuraHandledException going back to LWC
            if (!(e instanceof AuraHandledException)) {
                 throw new AuraHandledException('Error creating itinerary item: ' + e.getMessage());
             } else {
                 throw e;
             }
        }
    }

    private static Decimal getNextOrderNumber(Id tripId) {
        // Handle potential null tripId defensively
        if(tripId == null) return 1;

        AggregateResult[] result = [
            SELECT MAX(Order__c) maxOrder
            FROM Itinerary_Item__c
            WHERE Trip__c = :tripId
        ];

        Decimal maxOrder = 0;
        // Check if result is not null and the aggregation is not null
        if (result != null && !result.isEmpty() && result[0].get('maxOrder') != null) {
             maxOrder = (Decimal) result[0].get('maxOrder');
        }
        // Ensure we don't return null if maxOrder was null
        return (maxOrder == null ? 0 : maxOrder) + 1;
    }

}