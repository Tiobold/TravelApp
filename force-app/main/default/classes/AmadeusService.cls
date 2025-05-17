// Complete fixed AmadeusService.cls
public with sharing class AmadeusService {
    // Use Custom Settings for better security
    private static Amadeus_API__c getAmadeusSettings() {
        Amadeus_API__c settings = Amadeus_API__c.getInstance();
        if (settings == null) {
            throw new AmadeusException('Amadeus API settings not configured. Please contact your administrator.');
        }
        return settings;
    }
    
    private static final String TOKEN_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
    private static final String BASE_URL = 'https://test.api.amadeus.com';
    
    // Cache for access token (valid for 24 hours)
    private static String accessToken;
    private static Long tokenExpiry;
    
    /**
     * Get access token for Amadeus API
     */
    private static String getAccessToken() {
        // Check if we have a valid cached token
        if (accessToken != null && tokenExpiry != null && System.currentTimeMillis() < tokenExpiry) {
            return accessToken;
        }
        
        // Get credentials from Custom Settings
        Amadeus_API__c settings = getAmadeusSettings();
        String apiKey = settings.API_Key__c;
        String apiSecret = settings.API_Secret__c;
        
        // Get new token
        Http http = new Http();
        HttpRequest request = new HttpRequest();
        request.setEndpoint(TOKEN_URL);
        request.setMethod('POST');
        request.setHeader('Content-Type', 'application/x-www-form-urlencoded');
        
        String body = 'grant_type=client_credentials&client_id=' + apiKey + '&client_secret=' + apiSecret;
        request.setBody(body);
        request.setTimeout(120000);
        
        try {
            HttpResponse response = http.send(request);
            
            if (response.getStatusCode() == 200) {
                Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                accessToken = (String) responseBody.get('access_token');
                Integer expiresIn = (Integer) responseBody.get('expires_in');
                
                // Set expiry time (subtract 5 minutes for safety)
                tokenExpiry = System.currentTimeMillis() + ((expiresIn - 300) * 1000);
                
                System.debug('Successfully obtained access token. Expires in: ' + expiresIn + ' seconds');
                return accessToken;
            } else {
                System.debug('Error getting access token: ' + response.getStatusCode() + ' - ' + response.getBody());
                throw new AmadeusException('Failed to get access token: ' + response.getStatusCode());
            }
        } catch (Exception e) {
            System.debug('Exception getting access token: ' + e.getMessage());
            throw new AmadeusException('Error getting access token: ' + e.getMessage());
        }
    }
    
    /**
     * Make authenticated API call to Amadeus
     */
    private static HttpResponse makeApiCall(String endpoint, Map<String, String> parameters) {
        String token = getAccessToken();
        
        // Build URL with parameters
        String url = BASE_URL + endpoint;
        if (parameters != null && !parameters.isEmpty()) {
            List<String> params = new List<String>();
            for (String key : parameters.keySet()) {
                params.add(key + '=' + EncodingUtil.urlEncode(parameters.get(key), 'UTF-8'));
            }
            url += '?' + String.join(params, '&');
        }
        
        Http http = new Http();
        HttpRequest request = new HttpRequest();
        request.setEndpoint(url);
        request.setMethod('GET');
        request.setHeader('Authorization', 'Bearer ' + token);
        request.setHeader('Accept', 'application/json');
        request.setTimeout(120000);
        
        try {
            HttpResponse response = http.send(request);
            System.debug('API Call: ' + request.getMethod() + ' ' + url);
            System.debug('API Response: ' + response.getStatusCode() + ' - ' + response.getBody().substring(0, Math.min(1000, response.getBody().length())));
            return response;
        } catch (Exception e) {
            System.debug('Exception making API call: ' + e.getMessage());
            throw new AmadeusException('Error making API call: ' + e.getMessage());
        }
    }
    
    /**
     * Search for flights
     */
    @AuraEnabled
    public static FlightSearchResult searchFlights(String origin, String destination, String departureDate, String returnDate, Integer adults) {
        try {
            Map<String, String> parameters = new Map<String, String>();
            parameters.put('originLocationCode', origin);
            parameters.put('destinationLocationCode', destination);
            parameters.put('departureDate', departureDate);
            parameters.put('adults', String.valueOf(adults != null ? adults : 1));
            parameters.put('max', '10'); // Limit results for better performance
            
            if (String.isNotBlank(returnDate)) {
                parameters.put('returnDate', returnDate);
            }
            
            // Use flight offers search endpoint
            HttpResponse response = makeApiCall('/v2/shopping/flight-offers', parameters);
            
            if (response.getStatusCode() == 200) {
                Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                return parseFlightResults(responseBody);
            } else {
                throw new AmadeusException('Flight search failed: ' + response.getStatusCode() + ' - ' + response.getBody());
            }
        } catch (Exception e) {
            System.debug('Exception in searchFlights: ' + e.getMessage());
            throw new AuraHandledException('Error searching flights: ' + e.getMessage());
        }
    }
    
    /**
     * Search for hotels
     */
    @AuraEnabled
    public static HotelSearchResult searchHotels(String cityCode, String checkInDate, String checkOutDate, Integer adults) {
        try {
            Map<String, String> parameters = new Map<String, String>();
            parameters.put('cityCode', cityCode);
            //parameters.put('checkInDate', checkInDate);
            //parameters.put('checkOutDate', checkOutDate);
            parameters.put('radius', String.valueOf(adults != null ? adults : 1));
            
            // First, get hotel list for the city
            HttpResponse response = makeApiCall('/v1/reference-data/locations/hotels/by-city', parameters);
            
            if (response.getStatusCode() == 200) {
                Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                return parseHotelResults(responseBody);
            } else {
                throw new AmadeusException('Hotel search failed: ' + response.getStatusCode() + ' - ' + response.getBody());
            }
        } catch (Exception e) {
            System.debug('Exception in searchHotels: ' + e.getMessage());
            throw new AuraHandledException('Error searching hotels: ' + e.getMessage());
        }
    }
    
    /**
     * Get airport/city suggestions
     */
    @AuraEnabled
    public static List<LocationSuggestion> getLocationSuggestions(String keyword) {
        try {
            Map<String, String> parameters = new Map<String, String>();
            parameters.put('keyword', keyword);
            parameters.put('subType', 'AIRPORT,CITY');
            parameters.put('page%5Blimit%5D', '10');
            
            HttpResponse response = makeApiCall('/v1/reference-data/locations', parameters);
            
            if (response.getStatusCode() == 200) {
                Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                return parseLocationSuggestions(responseBody);
            } else {
                return new List<LocationSuggestion>();
            }
        } catch (Exception e) {
            System.debug('Exception in getLocationSuggestions: ' + e.getMessage());
            return new List<LocationSuggestion>();
        }
    }
    
    /**
     * Get flight destination inspiration from a given origin
     * @param origin Origin airport code (e.g., 'BUD')
     * @param maxPrice Maximum price filter
     * @param departureDate Departure date in YYYY-MM-DD format (optional)
     * @return FlightInspirationResult with list of affordable destinations
     */
    @AuraEnabled
    public static FlightInspirationResult getFlightInspiration(String origin, Integer maxPrice, String departureDate) {
        try {
            Map<String, String> parameters = new Map<String, String>();
            parameters.put('origin', origin);
            parameters.put('maxPrice', String.valueOf(maxPrice != null ? maxPrice : 200));
            
            if (String.isNotBlank(departureDate)) {
                parameters.put('departureDate', departureDate);
            }
            
            // Use flight inspiration endpoint
            HttpResponse response = makeApiCall('/v1/shopping/flight-destinations', parameters);
            
            if (response.getStatusCode() == 200) {
                Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                return parseFlightInspirationResults(responseBody);
            } else {
                throw new AmadeusException('Flight inspiration search failed: ' + response.getStatusCode() + ' - ' + response.getBody());
            }
        } catch (Exception e) {
            System.debug('Exception in getFlightInspiration: ' + e.getMessage());
            throw new AuraHandledException('Error getting flight inspiration: ' + e.getMessage());
        }
    }
    
    // Parse flight search results
    private static FlightSearchResult parseFlightResults(Map<String, Object> responseBody) {
        FlightSearchResult result = new FlightSearchResult();
        result.flights = new List<FlightOffer>();
        
        List<Object> data = (List<Object>) responseBody.get('data');
        if (data != null) {
            for (Object item : data) {
                Map<String, Object> offer = (Map<String, Object>) item;
                FlightOffer flight = new FlightOffer();
                
                flight.id = (String) offer.get('id');
                flight.price = parsePrice(offer);
                flight.itineraries = parseItineraries(offer);
                
                result.flights.add(flight);
            }
        }
        
        return result;
    }
    
    // Parse hotel search results
    private static HotelSearchResult parseHotelResults(Map<String, Object> responseBody) {
        HotelSearchResult result = new HotelSearchResult();
        result.hotels = new List<HotelOffer>();
        
        List<Object> data = (List<Object>) responseBody.get('data');
        if (data != null) {
            // Properly handle list slicing for limiting results
            Integer maxResults = Math.min(data.size(), 20);
            for (Integer i = 0; i < maxResults; i++) {
                Map<String, Object> hotel = (Map<String, Object>) data[i];
                HotelOffer hotelOffer = new HotelOffer();
                
                hotelOffer.id = (String) hotel.get('hotelId');
                hotelOffer.name = (String) hotel.get('name');
                hotelOffer.chainCode = (String) hotel.get('chainCode');
                
                // Parse address
                Map<String, Object> address = (Map<String, Object>) hotel.get('address');
                if (address != null) {
                    List<Object> lines = (List<Object>) address.get('lines');
                    String addressLine = lines != null && !lines.isEmpty() ? (String) lines[0] : '';
                    String cityName = (String) address.get('cityName');
                    hotelOffer.address = (String.isNotBlank(addressLine) ? addressLine + ', ' : '') + 
                                        (String.isNotBlank(cityName) ? cityName : '');
                }
                
                // Parse geo code
                Map<String, Object> geoCode = (Map<String, Object>) hotel.get('geoCode');
                if (geoCode != null) {
                    hotelOffer.latitude = (Decimal) geoCode.get('latitude');
                    hotelOffer.longitude = (Decimal) geoCode.get('longitude');
                }
                
                result.hotels.add(hotelOffer);
            }
        }
        
        return result;
    }
    
    // Parse location suggestions
    private static List<LocationSuggestion> parseLocationSuggestions(Map<String, Object> responseBody) {
        List<LocationSuggestion> suggestions = new List<LocationSuggestion>();
        
        List<Object> data = (List<Object>) responseBody.get('data');
        if (data != null) {
            for (Object item : data) {
                Map<String, Object> location = (Map<String, Object>) item;
                LocationSuggestion suggestion = new LocationSuggestion();
                
                suggestion.iataCode = (String) location.get('iataCode');
                suggestion.name = (String) location.get('name');
                suggestion.subType = (String) location.get('subType');
                
                Map<String, Object> address = (Map<String, Object>) location.get('address');
                if (address != null) {
                    suggestion.cityName = (String) address.get('cityName');
                    suggestion.countryName = (String) address.get('countryName');
                }
                
                suggestions.add(suggestion);
            }
        }
        
        return suggestions;
    }
    
    /**
     * Parse flight inspiration results
     */
    private static FlightInspirationResult parseFlightInspirationResults(Map<String, Object> responseBody) {
        FlightInspirationResult result = new FlightInspirationResult();
        result.destinations = new List<FlightDestination>();
        
        List<Object> data = (List<Object>) responseBody.get('data');
        if (data != null) {
            for (Object item : data) {
                Map<String, Object> destData = (Map<String, Object>) item;
                FlightDestination destination = new FlightDestination();
                
                destination.type = (String) destData.get('type');
                destination.origin = (String) destData.get('origin');
                destination.destination = (String) destData.get('destination');
                destination.departureDate = (String) destData.get('departureDate');
                destination.returnDate = (String) destData.get('returnDate');
                
                // Parse price
                Map<String, Object> price = (Map<String, Object>) destData.get('price');
                if (price != null) {
                    destination.price = parseFlightPrice(price);
                }
                
                // Parse links for additional info
                Map<String, Object> links = (Map<String, Object>) destData.get('links');
                if (links != null) {
                    destination.flightOffersLink = (String) links.get('flightOffers');
                }
                
                result.destinations.add(destination);
            }
        }
        
        return result;
    }
    
    // Helper methods
    private static String parsePrice(Map<String, Object> offer) {
        Map<String, Object> price = (Map<String, Object>) offer.get('price');
        if (price != null) {
            String total = (String) price.get('total');
            // Use 'currencyCode' instead of reserved keyword 'currency'
            String currencyCode = (String) price.get('currency');
            return currencyCode + ' ' + total;
        }
        return '';
    }
    
    /**
     * Parse flight price from inspiration API - FIXED
     */
    private static FlightPrice parseFlightPrice(Map<String, Object> priceData) {
        FlightPrice price = new FlightPrice();
        price.total = (String) priceData.get('total');
        // FIX: Use 'currencyCode' instead of reserved keyword 'currency'
        price.currencyCode = (String) priceData.get('currency');
        return price;
    }
    
    private static List<FlightItinerary> parseItineraries(Map<String, Object> offer) {
        List<FlightItinerary> itineraries = new List<FlightItinerary>();
        List<Object> itineraryList = (List<Object>) offer.get('itineraries');
        
        if (itineraryList != null) {
            for (Object item : itineraryList) {
                Map<String, Object> itinerary = (Map<String, Object>) item;
                FlightItinerary flightItinerary = new FlightItinerary();
                
                flightItinerary.duration = (String) itinerary.get('duration');
                flightItinerary.segments = parseSegments(itinerary);
                
                itineraries.add(flightItinerary);
            }
        }
        
        return itineraries;
    }
    
    private static List<FlightSegment> parseSegments(Map<String, Object> itinerary) {
        List<FlightSegment> segments = new List<FlightSegment>();
        List<Object> segmentList = (List<Object>) itinerary.get('segments');
        
        if (segmentList != null) {
            for (Object item : segmentList) {
                Map<String, Object> segment = (Map<String, Object>) item;
                FlightSegment flightSegment = new FlightSegment();
                
                Map<String, Object> departure = (Map<String, Object>) segment.get('departure');
                Map<String, Object> arrival = (Map<String, Object>) segment.get('arrival');
                
                if (departure != null) {
                    flightSegment.departureCode = (String) departure.get('iataCode');
                    flightSegment.departureTime = (String) departure.get('at');
                }
                
                if (arrival != null) {
                    flightSegment.arrivalCode = (String) arrival.get('iataCode');
                    flightSegment.arrivalTime = (String) arrival.get('at');
                }
                
                flightSegment.carrierCode = (String) segment.get('carrierCode');
                
                segments.add(flightSegment);
            }
        }
        
        return segments;
    }
    
    // Wrapper classes for API results
    public class FlightSearchResult {
        @AuraEnabled public List<FlightOffer> flights;
    }
    
    public class FlightOffer {
        @AuraEnabled public String id;
        @AuraEnabled public String price;
        @AuraEnabled public List<FlightItinerary> itineraries;
    }
    
    public class FlightItinerary {
        @AuraEnabled public String duration;
        @AuraEnabled public List<FlightSegment> segments;
    }
    
    public class FlightSegment {
        @AuraEnabled public String departureCode;
        @AuraEnabled public String departureTime;
        @AuraEnabled public String arrivalCode;
        @AuraEnabled public String arrivalTime;
        @AuraEnabled public String carrierCode;
    }
    
    public class HotelSearchResult {
        @AuraEnabled public List<HotelOffer> hotels;
    }
    
    public class HotelOffer {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String chainCode;
        @AuraEnabled public String address;
        @AuraEnabled public Decimal latitude;
        @AuraEnabled public Decimal longitude;
    }
    
    public class LocationSuggestion {
        @AuraEnabled public String iataCode;
        @AuraEnabled public String name;
        @AuraEnabled public String subType;
        @AuraEnabled public String cityName;
        @AuraEnabled public String countryName;
    }
    
    // Flight inspiration wrapper classes
    public class FlightInspirationResult {
        @AuraEnabled public List<FlightDestination> destinations;
    }
    
    public class FlightDestination {
        @AuraEnabled public String type;
        @AuraEnabled public String origin;
        @AuraEnabled public String destination;
        @AuraEnabled public String departureDate;
        @AuraEnabled public String returnDate;
        @AuraEnabled public FlightPrice price;
        @AuraEnabled public String flightOffersLink;
    }
    
    public class FlightPrice {
        @AuraEnabled public String total;
        @AuraEnabled public String currencyCode; // FIXED: Changed from 'currency' to 'currencyCode'
    }
    
    // Custom exception class
    public class AmadeusException extends Exception {}

    /**
     * Search for tours and activities in a destination
     * @param latitude Latitude of the destination
     * @param longitude Longitude of the destination 
     * @param radius Search radius in kilometers (default 20)
     * @return ActivitySearchResult with list of activities
     */
    @AuraEnabled
    public static ActivitySearchResult searchActivities(String latitude, String longitude, Integer radius) {
        try {
            Map<String, String> parameters = new Map<String, String>();
            parameters.put('latitude', latitude);
            parameters.put('longitude', longitude);
            parameters.put('radius', String.valueOf(radius != null ? radius : 20));
            
            HttpResponse response = makeApiCall('/v1/shopping/activities', parameters);
            
            if (response.getStatusCode() == 200) {
                Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                return parseActivityResults(responseBody);
            } else {
                throw new AmadeusException('Activity search failed: ' + response.getStatusCode() + ' - ' + response.getBody());
            }
        } catch (Exception e) {
            System.debug('Exception in searchActivities: ' + e.getMessage());
            throw new AuraHandledException('Error searching activities: ' + e.getMessage());
        }
    }

    /**
     * Search activities by city name
     * @param cityName Name of the city
     * @param radius Search radius in kilometers
     * @return ActivitySearchResult with list of activities
     */
    @AuraEnabled
    public static ActivitySearchResult searchActivitiesByCity(String cityName, Integer radius) {
        try {
            // First get location coordinates for the city
            List<LocationSuggestion> locations = getLocationSuggestions(cityName);
            LocationSuggestion cityLocation = null;
            
            // Find a city in the results
            for (LocationSuggestion location : locations) {
                if (location.subType == 'CITY' || location.cityName != null) {
                    cityLocation = location;
                    break;
                }
            }
            
            if (cityLocation != null) {
                // For this example, we'll use approximate coordinates
                // In a real implementation, you'd get actual coordinates from the location API
                Map<String, String> cityCoords = getCityCoordinates(cityName);
                
                if (cityCoords != null) {
                    return searchActivities(cityCoords.get('latitude'), cityCoords.get('longitude'), radius);
                }
            }
            
            // If we can't find coordinates, return empty result
            return new ActivitySearchResult();
        } catch (Exception e) {
            System.debug('Exception in searchActivitiesByCity: ' + e.getMessage());
            throw new AuraHandledException('Error searching activities by city: ' + e.getMessage());
        }
    }

    /**
     * Get activity details by ID
     * @param activityId The activity ID
     * @return Activity with detailed information
     */
    @AuraEnabled
    public static Activity getActivityDetails(String activityId) {
        try {
            HttpResponse response = makeApiCall('/v1/shopping/activities/' + activityId, null);
            
            if (response.getStatusCode() == 200) {
                Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                Map<String, Object> data = (Map<String, Object>) responseBody.get('data');
                return parseActivityDetails(data);
            } else {
                throw new AmadeusException('Activity details failed: ' + response.getStatusCode() + ' - ' + response.getBody());
            }
        } catch (Exception e) {
            System.debug('Exception in getActivityDetails: ' + e.getMessage());
            throw new AuraHandledException('Error getting activity details: ' + e.getMessage());
        }
    }

    // Helper method to get approximate coordinates for major cities
    private static Map<String, String> getCityCoordinates(String cityName) {
        Map<String, Map<String, String>> cityCoords = new Map<String, Map<String, String>>{
            'Amsterdam' => new Map<String, String>{'latitude' => '52.3676', 'longitude' => '4.9041'},
            'Budapest' => new Map<String, String>{'latitude' => '47.4979', 'longitude' => '19.0402'},
            'Paris' => new Map<String, String>{'latitude' => '48.8566', 'longitude' => '2.3522'},
            'London' => new Map<String, String>{'latitude' => '51.5074', 'longitude' => '-0.1278'},
            'Rome' => new Map<String, String>{'latitude' => '41.9028', 'longitude' => '12.4964'},
            'Madrid' => new Map<String, String>{'latitude' => '40.4168', 'longitude' => '-3.7038'},
            'Berlin' => new Map<String, String>{'latitude' => '52.5200', 'longitude' => '13.4050'},
            'Vienna' => new Map<String, String>{'latitude' => '48.2082', 'longitude' => '16.3738'}
        };
        
        return cityCoords.get(cityName);
    }

    // Parse activity search results
    private static ActivitySearchResult parseActivityResults(Map<String, Object> responseBody) {
        ActivitySearchResult result = new ActivitySearchResult();
        result.activities = new List<Activity>();
        
        List<Object> data = (List<Object>) responseBody.get('data');
        if (data != null) {
            for (Object item : data) {
                Map<String, Object> activityData = (Map<String, Object>) item;
                Activity activity = parseActivityDetails(activityData);
                result.activities.add(activity);
            }
        }
        
        return result;
    }

    // Parse individual activity details
    private static Activity parseActivityDetails(Map<String, Object> activityData) {
        Activity activity = new Activity();
        
        activity.id = (String) activityData.get('id');
        activity.name = (String) activityData.get('name');
        activity.shortDescription = (String) activityData.get('shortDescription');
        
        // Parse rating
        Map<String, Object> rating = (Map<String, Object>) activityData.get('rating');
        if (rating != null) {
            activity.rating = (Decimal) rating.get('score');
            activity.reviewCount = (Integer) rating.get('count');
        }
        
        // Parse price
        Map<String, Object> price = (Map<String, Object>) activityData.get('price');
        if (price != null) {
            activity.priceAmount = (String) price.get('amount');
            activity.priceCurrency = (String) price.get('currencyCode');
        }
        
        // Parse pictures
        List<Object> pictures = (List<Object>) activityData.get('pictures');
        if (pictures != null && !pictures.isEmpty()) {
            activity.pictures = new List<String>();
            for (Object pic : pictures) {
                activity.pictures.add((String) pic);
            }
        }
        
        // Parse booking link
        Map<String, Object> bookingLink = (Map<String, Object>) activityData.get('bookingLink');
        if (bookingLink != null) {
            activity.bookingUrl = (String) bookingLink.get('url');
        }
        
        // Parse location
        Map<String, Object> geoCode = (Map<String, Object>) activityData.get('geoCode');
        if (geoCode != null) {
            activity.latitude = (Decimal) geoCode.get('latitude');
            activity.longitude = (Decimal) geoCode.get('longitude');
        }
        
        // Parse categories
        List<Object> categories = (List<Object>) activityData.get('categories');
        if (categories != null && !categories.isEmpty()) {
            activity.category = (String) categories[0];
        }
        
        return activity;
    }

    // Wrapper classes for Activities API
    public class ActivitySearchResult {
        @AuraEnabled public List<Activity> activities;
    }

    public class Activity {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String shortDescription;
        @AuraEnabled public Decimal rating;
        @AuraEnabled public Integer reviewCount;
        @AuraEnabled public String priceAmount;
        @AuraEnabled public String priceCurrency;
        @AuraEnabled public List<String> pictures;
        @AuraEnabled public String bookingUrl;
        @AuraEnabled public Decimal latitude;
        @AuraEnabled public Decimal longitude;
        @AuraEnabled public String category;
    }
}