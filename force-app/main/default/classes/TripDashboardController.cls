public with sharing class TripDashboardController {
    
    @AuraEnabled(cacheable=true)
    public static List<Trip__c> getAllTrips() {
        return [
            SELECT Id, Name, Start_Date__c, End_Date__c, Budget__c, Total_Spent__c, 
                   Country__c, Status__c, Total_Distance__c, Number_of_Travellers__c
            FROM Trip__c
            ORDER BY Start_Date__c DESC
        ];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Trip__c> getUserTrips() {
        // In a real implementation, you would filter by the current user
        // For now, return all trips
        return [
            SELECT Id, Name, Start_Date__c, End_Date__c, Budget__c, Total_Spent__c, 
                   Country__c, Status__c, Total_Distance__c, Number_of_Travellers__c
            FROM Trip__c
            ORDER BY Start_Date__c DESC
        ];
    }
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getTripStats() {
        Map<String, Object> stats = new Map<String, Object>();
        
        // Calculate total budget
        AggregateResult budgetResult = [
            SELECT SUM(Budget__c) totalBudget
            FROM Trip__c
        ];
        stats.put('totalBudget', budgetResult.get('totalBudget'));
        
        // Calculate total spent
        AggregateResult spentResult = [
            SELECT SUM(Total_Spent__c) totalSpent
            FROM Trip__c
        ];
        stats.put('totalSpent', spentResult.get('totalSpent'));
        
        // Calculate average trip cost
        AggregateResult avgResult = [
            SELECT AVG(Total_Spent__c) avgCost
            FROM Trip__c
            WHERE Total_Spent__c > 0
        ];
        stats.put('averageTripCost', avgResult.get('avgCost'));
        
        // Count upcoming trips
        Date today = Date.today();
        Integer upcomingCount = [
            SELECT COUNT()
            FROM Trip__c
            WHERE Start_Date__c > :today
        ];
        stats.put('upcomingTrips', upcomingCount);
        
        return stats;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<CountryWrapper> getVisitedCountries() {
        // Get unique countries from trips
        Set<String> uniqueCountries = new Set<String>();
        List<CountryWrapper> countryList = new List<CountryWrapper>();
        
        for (Trip__c trip : [
            SELECT Id, Country__c 
            FROM Trip__c 
            WHERE Country__c != null
        ]) {
            if (!uniqueCountries.contains(trip.Country__c)) {
                uniqueCountries.add(trip.Country__c);
                
                // Convert country name to ISO code if needed
                String countryCode = getCountryCode(trip.Country__c);
                
                countryList.add(new CountryWrapper(
                    trip.Country__c,
                    countryCode
                ));
            }
        }
        
        return countryList;
    }
    
    // Helper method to convert country names to ISO codes
    private static String getCountryCode(String countryName) {
        Map<String, String> countryToCode = new Map<String, String>();
        
        countryToCode.put('United States', 'US');
        countryToCode.put('France', 'FR');
        countryToCode.put('Italy', 'IT');
        countryToCode.put('Spain', 'ES');
        countryToCode.put('Japan', 'JP');
        countryToCode.put('Hungary', 'HU');
        countryToCode.put('Vietnam', 'VN');
        countryToCode.put('Singapore', 'SG');
        countryToCode.put('Netherlands', 'NL');
        countryToCode.put('Indonesia', 'ID');
        // Add more mappings as needed
        
        if (countryToCode.containsKey(countryName)) {
            return countryToCode.get(countryName);
        } else {
            // Fallback - use first two letters (if length allows)
            if (countryName != null && countryName.length() >= 2) {
                return countryName.substring(0, 2).toUpperCase();
            } else {
                return 'XX'; // Default code if no mapping exists
            }
        }
    }
    
    // Wrapper class for country data
    public class CountryWrapper {
        @AuraEnabled public String countryName { get; set; }
        @AuraEnabled public String countryCode { get; set; }
        
        public CountryWrapper(String name, String code) {
            this.countryName = name;
            this.countryCode = code;
        }
    }
}