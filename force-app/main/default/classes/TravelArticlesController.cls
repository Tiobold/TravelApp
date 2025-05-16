public with sharing class TravelArticlesController {
    
    // Cache duration in seconds (1 hour)
    private static final Integer CACHE_DURATION = 3600;
    
    // Cache to store results
    private static Map<String, CachedArticles> articlesCache = new Map<String, CachedArticles>();
    
    @AuraEnabled
    public static List<TripAdvisorAPI.TravelArticle> getTravelArticles(String country) {
        try {
            System.debug('Getting travel articles for country: ' + country);
            
            // Check cache first
            String cacheKey = (country != null) ? country.toLowerCase() : 'default';
            if (articlesCache.containsKey(cacheKey)) {
                CachedArticles cache = articlesCache.get(cacheKey);
                if (cache.isValid()) {
                    System.debug('Returning cached articles for ' + country);
                    return cache.articles;
                }
            }
            
            // Get articles from TripAdvisor
            System.debug('Calling TripAdvisor API for articles');
            List<TripAdvisorAPI.TravelArticle> articles = TripAdvisorAPI.getArticlesByLocation(country);
            
            // If no articles found, use default content for demo
            if (articles == null || articles.isEmpty()) {
                System.debug('No articles found, using fallback content');
                articles = getDefaultArticles(country);
            }
            
            // Cache the results
            articlesCache.put(cacheKey, new CachedArticles(articles));
            System.debug('Cached ' + articles.size() + ' articles for ' + country);
            
            return articles;
        } catch (Exception e) {
            System.debug('Error in getTravelArticles: ' + e.getMessage() + '\n' + e.getStackTraceString());
            
            // On error, return fallback content rather than crashing
            List<TripAdvisorAPI.TravelArticle> fallbackArticles = getDefaultArticles(country);
            System.debug('Returning ' + fallbackArticles.size() + ' fallback articles due to error');
            return fallbackArticles;
        }
    }
    
    // Fallback method to provide default content if API fails
    private static List<TripAdvisorAPI.TravelArticle> getDefaultArticles(String country) {
        List<TripAdvisorAPI.TravelArticle> articles = new List<TripAdvisorAPI.TravelArticle>();
        
        // Create default articles based on country
        if (country == 'Netherlands') {
            articles.add(createArticle(
                'nl-1',
                'Amsterdam\'s Most Iconic Canal Experiences',
                'Discover the best ways to explore Amsterdam\'s UNESCO-listed canal ring, from boutique boat tours to waterside dining.',
                'https://www.tripadvisor.com/Tourism-g188590-Amsterdam_North_Holland_Province-Vacations.html',
                'TripAdvisor Editorial',
                System.now(),
                'https://media-cdn.tripadvisor.com/media/photo-s/15/33/fc/f0/amsterdam.jpg'
            ));
            
            articles.add(createArticle(
                'nl-2',
                'Rotterdam: Europe\'s Most Innovative Architectural City',
                'From the Cube Houses to the Markthal, Rotterdam\'s bold architectural statements make it a must-visit for design enthusiasts.',
                'https://www.tripadvisor.com/Tourism-g188632-Rotterdam_South_Holland_Province-Vacations.html',
                'TripAdvisor Editorial',
                System.now().addDays(-2),
                'https://media-cdn.tripadvisor.com/media/photo-s/13/39/e6/64/rotterdam-centraal-station.jpg'
            ));
        } else if (country == 'France') {
            articles.add(createArticle(
                'fr-1',
                'Beyond the Louvre: Paris\'s Hidden Museum Gems',
                'Escape the crowds and discover Paris\'s lesser-known but equally fascinating museums that locals love.',
                'https://www.tripadvisor.com/Tourism-g187147-Paris_Ile_de_France-Vacations.html',
                'TripAdvisor Editorial',
                System.now().addDays(-1),
                'https://media-cdn.tripadvisor.com/media/photo-s/16/4c/45/cf/photo0jpg.jpg'
            ));
        } else {
            // Generic travel articles
            articles.add(createArticle(
                'gen-1',
                'Top Travel Trends for 2025: Sustainable and Immersive Experiences',
                'Travelers are increasingly seeking authentic, sustainable experiences that connect them more deeply with local cultures and environments.',
                'https://www.tripadvisor.com/TravelersChoice',
                'TripAdvisor Editorial',
                System.now(),
                'https://media-cdn.tripadvisor.com/media/photo-s/1a/59/14/34/caption.jpg'
            ));
        }
        
        return articles;
    }
    
    // Helper method to create article
    private static TripAdvisorAPI.TravelArticle createArticle(String id, String title, String description, 
                                                             String link, String source, DateTime pubDate, 
                                                             String imageUrl) {
        TripAdvisorAPI.TravelArticle article = new TripAdvisorAPI.TravelArticle();
        article.id = id;
        article.title = title;
        article.description = description;
        article.link = link;
        article.source = source;
        article.pubDate = pubDate.format('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'');
        article.imageUrl = imageUrl;
        return article;
    }
    
    // Cache wrapper class
    private class CachedArticles {
        public List<TripAdvisorAPI.TravelArticle> articles;
        public Long timestamp;
        
        public CachedArticles(List<TripAdvisorAPI.TravelArticle> articles) {
            this.articles = articles;
            this.timestamp = System.currentTimeMillis();
        }
        
        public Boolean isValid() {
            // Check if cache is still valid
            Long currentTime = System.currentTimeMillis();
            Long age = (currentTime - timestamp) / 1000; // Convert to seconds
            return age < CACHE_DURATION;
        }
    }
}