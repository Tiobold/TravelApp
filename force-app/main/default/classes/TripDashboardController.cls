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
            WHERE Country__c != null AND Status__c = 'Completed'
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
    /**
 * Get expense breakdown data for dashboard
 * @return Map with expense summary data
 */
@AuraEnabled(cacheable=true)
public static Map<String, Object> getExpenseBreakdown() {
    Map<String, Object> result = new Map<String, Object>();
    
    try {
        // Get current month expenses
        Decimal currentMonthExpenses = getCurrentMonthExpenses();
        result.put('currentMonth', currentMonthExpenses);
        
        // Get last month expenses
        Decimal lastMonthExpenses = getLastMonthExpenses();
        result.put('lastMonth', lastMonthExpenses);
        
        // Calculate total for all expenses
        Decimal totalExpenses = currentMonthExpenses + lastMonthExpenses;
        result.put('total', totalExpenses);
        
        // Get expense categories breakdown
        List<Map<String, Object>> categories = getExpenseCategories();
        result.put('categories', categories);
        
        return result;
    } catch (Exception e) {
        throw new AuraHandledException('Error retrieving expense data: ' + e.getMessage());
    }
}

/**
 * Helper method to get current month's expenses
 * @return Decimal amount of expenses for current month
 */
private static Decimal getCurrentMonthExpenses() {
    // Get the current month's start and end dates
    Date today = Date.today();
    Date firstDayOfMonth = Date.newInstance(today.year(), today.month(), 1);
    Date lastDayOfMonth = firstDayOfMonth.addMonths(1).addDays(-1);
    
    // Query sum of expenses for current month
    AggregateResult result = [
        SELECT SUM(Amount__c) total
        FROM Expense__c
        WHERE Date__c >= :firstDayOfMonth AND Date__c <= :lastDayOfMonth
    ];
    
    return (result.get('total') != null) ? (Decimal)result.get('total') : 0;
}

    /**
     * Helper method to get last month's expenses
     * @return Decimal amount of expenses for last month
     */
    private static Decimal getLastMonthExpenses() {
        // Get last month's start and end dates
        Date today = Date.today();
        Date firstDayOfLastMonth = Date.newInstance(today.year(), today.month(), 1).addMonths(-1);
        Date lastDayOfLastMonth = Date.newInstance(today.year(), today.month(), 1).addDays(-1);
        
        // Query sum of expenses for last month
        AggregateResult result = [
            SELECT SUM(Amount__c) total
            FROM Expense__c
            WHERE Date__c >= :firstDayOfLastMonth AND Date__c <= :lastDayOfLastMonth
        ];
        
        return (result.get('total') != null) ? (Decimal)result.get('total') : 0;
    }

    /**
     * Helper method to get expense categories with amounts and percentages
     * @return List of maps with category data
     */
    private static List<Map<String, Object>> getExpenseCategories() {
        List<Map<String, Object>> categories = new List<Map<String, Object>>();
        
        // Get expenses by category
        List<AggregateResult> results = [
            SELECT Category__c, SUM(Amount__c) total
            FROM Expense__c
            GROUP BY Category__c
            ORDER BY SUM(Amount__c) DESC
            LIMIT 5
        ];
        
        // Calculate total expenses for percentage calculation
        Decimal totalAmount = 0;
        for (AggregateResult ar : results) {
            totalAmount += (Decimal)ar.get('total');
        }
        
        // Create category data objects
        if (totalAmount > 0) {
            for (Integer i = 0; i < results.size(); i++) {
                AggregateResult ar = results[i];
                String categoryName = (String)ar.get('Category__c');
                Decimal amount = (Decimal)ar.get('total');
                Decimal percentage = (amount / totalAmount * 100).setScale(1);
                
                Map<String, Object> category = new Map<String, Object>{
                    'id' => 'cat' + i,
                    'name' => categoryName != null ? categoryName : 'Other',
                    'amount' => amount,
                    'percentage' => percentage
                };
                
                categories.add(category);
            }
        }
        
        return categories;
    }
}