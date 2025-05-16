public with sharing class TripAdvisorAPI {
    
    private static final String API_KEY = '3A4A5FFCBE79431F88E0D41FDE4F78EA';
    private static final String BASE_URL = 'https://api.content.tripadvisor.com/api/v1';
    
    // Cache for location IDs to avoid multiple searches
    private static Map<String, String> locationIdCache = new Map<String, String>();
    
    // Method to search for location by name (country, city)
    public static String getLocationId(String locationName) {
        System.debug('Searching for location: ' + locationName);
        
        // Check cache first
        if (locationIdCache.containsKey(locationName.toLowerCase())) {
            return locationIdCache.get(locationName.toLowerCase());
        }
        
        // Construct the search endpoint
        String endpoint = BASE_URL + '/location/search';
        
        // Add parameters
        endpoint += '?key=' + API_KEY;
        endpoint += '&searchQuery=' + EncodingUtil.urlEncode(locationName, 'UTF-8');
        endpoint += '&language=en';
        endpoint += '&category=cities,countries';
        
        System.debug('Making API call to: ' + endpoint);
        
        // Make the HTTP request
        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod('GET');
        req.setHeader('Accept', 'application/json');
        req.setTimeout(20000); // 20-second timeout
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        System.debug('Response status: ' + res.getStatusCode());
        System.debug('Response body: ' + res.getBody());
        
        // Process the response
        if (res.getStatusCode() == 200) {
            Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            List<Object> data = (List<Object>) responseData.get('data');
            
            if (data != null && !data.isEmpty()) {
                Map<String, Object> firstResult = (Map<String, Object>) data[0];
                String locationId = (String) firstResult.get('location_id');
                
                System.debug('Found location ID: ' + locationId);
                
                // Cache the result
                locationIdCache.put(locationName.toLowerCase(), locationId);
                
                return locationId;
            }
        }
        
        System.debug('No location ID found for: ' + locationName);
        // Return null if location not found
        return null;
    }
    
    // Method to get articles/content for a location
    public static List<TravelArticle> getArticlesForLocation(String locationId) {
        System.debug('Fetching articles for location ID: ' + locationId);
        
        if (locationId == null) {
            return new List<TravelArticle>();
        }
        
        // Construct the endpoint for location content
        String endpoint = BASE_URL + '/location/' + locationId + '/articles';
        
        // Add parameters
        endpoint += '?key=' + API_KEY;
        endpoint += '&language=en';
        
        System.debug('Making API call to: ' + endpoint);
        
        // Make the HTTP request
        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod('GET');
        req.setHeader('Accept', 'application/json');
        req.setTimeout(20000); // 20-second timeout
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        System.debug('Response status: ' + res.getStatusCode());
        System.debug('Response body: ' + res.getBody());
        
        // Process the response
        List<TravelArticle> articles = new List<TravelArticle>();
        
        if (res.getStatusCode() == 200) {
            Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            List<Object> data = (List<Object>) responseData.get('data');
            
            if (data != null) {
                for (Object item : data) {
                    Map<String, Object> articleData = (Map<String, Object>) item;
                    
                    TravelArticle article = new TravelArticle();
                    article.id = (String) articleData.get('article_id');
                    article.title = (String) articleData.get('title');
                    
                    // Get description, may be in different fields depending on the API version
                    if (articleData.containsKey('seo_description')) {
                        article.description = (String) articleData.get('seo_description');
                    } else if (articleData.containsKey('description')) {
                        article.description = (String) articleData.get('description');
                    } else {
                        article.description = 'Read more about ' + article.title;
                    }
                    
                    article.link = (String) articleData.get('url');
                    article.source = 'TripAdvisor';
                    
                    // Format publication date
                    String publishedTime = (String) articleData.get('published_date');
                    if (publishedTime != null) {
                        article.pubDate = publishedTime;
                    } else {
                        article.pubDate = Datetime.now().format('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'');
                    }
                    
                    // Get image
                    if (articleData.containsKey('primary_image')) {
                        Map<String, Object> imageData = (Map<String, Object>) articleData.get('primary_image');
                        if (imageData != null) {
                            article.imageUrl = (String) imageData.get('url');
                        }
                    }
                    
                    articles.add(article);
                }
            }
        } else {
            // Log error for debugging
            System.debug('TripAdvisor API Error: ' + res.getStatusCode() + ' ' + res.getStatus());
            System.debug('Response Body: ' + res.getBody());
        }
        
        System.debug('Found ' + articles.size() + ' articles');
        return articles;
    }
    
    // Method to get attractions for a location (fallback if articles aren't available)
    public static List<TravelArticle> getAttractionsForLocation(String locationId) {
        System.debug('Fetching attractions for location ID: ' + locationId);
        
        if (locationId == null) {
            return new List<TravelArticle>();
        }
        
        // Construct the endpoint for attractions
        String endpoint = BASE_URL + '/location/' + locationId + '/attractions';
        
        // Add parameters
        endpoint += '?key=' + API_KEY;
        endpoint += '&language=en';
        endpoint += '&limit=5'; // Limit to 5 attractions
        
        System.debug('Making API call to: ' + endpoint);
        
        // Make the HTTP request
        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod('GET');
        req.setHeader('Accept', 'application/json');
        req.setTimeout(20000); // 20-second timeout
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        System.debug('Response status: ' + res.getStatusCode());
        System.debug('Response body: ' + res.getBody());
        
        // Process the response
        List<TravelArticle> attractions = new List<TravelArticle>();
        
        if (res.getStatusCode() == 200) {
            Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            List<Object> data = (List<Object>) responseData.get('data');
            
            if (data != null) {
                for (Object item : data) {
                    Map<String, Object> attractionData = (Map<String, Object>) item;
                    
                    TravelArticle attraction = new TravelArticle();
                    attraction.id = (String) attractionData.get('location_id');
                    attraction.title = (String) attractionData.get('name');
                    
                    // Get description if available
                    if (attractionData.containsKey('description')) {
                        attraction.description = (String) attractionData.get('description');
                    } else {
                        attraction.description = 'Popular attraction in ' + attractionData.get('name');
                    }
                    
                    // Get the web URL if available
                    if (attractionData.containsKey('web_url')) {
                        attraction.link = (String) attractionData.get('web_url');
                    } else {
                        attraction.link = 'https://www.tripadvisor.com/';
                    }
                    
                    attraction.source = 'TripAdvisor Attractions';
                    attraction.pubDate = Datetime.now().format('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'');
                    
                    // Get image
                    if (attractionData.containsKey('photo')) {
                        Map<String, Object> photoData = (Map<String, Object>) attractionData.get('photo');
                        if (photoData != null && photoData.containsKey('images')) {
                            Map<String, Object> imagesData = (Map<String, Object>) photoData.get('images');
                            if (imagesData != null && imagesData.containsKey('medium')) {
                                Map<String, Object> mediumData = (Map<String, Object>) imagesData.get('medium');
                                if (mediumData != null) {
                                    attraction.imageUrl = (String) mediumData.get('url');
                                }
                            }
                        }
                    }
                    
                    attractions.add(attraction);
                }
            }
        }
        
        System.debug('Found ' + attractions.size() + ' attractions');
        return attractions;
    }
    
    // Method to get location content directly by location name
    public static List<TravelArticle> getArticlesByLocation(String locationName) {
        System.debug('Getting articles for location name: ' + locationName);
        
        String locationId = getLocationId(locationName);
        if (locationId != null) {
            List<TravelArticle> articles = getArticlesForLocation(locationId);
            
            if (articles.isEmpty()) {
                System.debug('No articles found, trying attractions');
                articles = getAttractionsForLocation(locationId);
            }
            
            return articles;
        }
        return new List<TravelArticle>();
    }
    
    // Wrapper class for travel articles
    public class TravelArticle {
        @AuraEnabled public String id;
        @AuraEnabled public String title;
        @AuraEnabled public String description;
        @AuraEnabled public String link;
        @AuraEnabled public String source;
        @AuraEnabled public String pubDate;
        @AuraEnabled public String imageUrl;
    }
}