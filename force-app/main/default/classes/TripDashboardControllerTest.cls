@isTest
private class TripDashboardControllerTest {
    
    @isTest
    static void testGetAllTrips() {
        // Setup test data
        createMultipleTestTrips();
        
        Test.startTest();
        List<Trip__c> trips = TripDashboardController.getAllTrips();
        Test.stopTest();
        
        // Verify results
        System.assertEquals(3, trips.size(), 'Should return all 3 test trips');
        // Verify trips are ordered by Start_Date DESC
        System.assertEquals('Future Trip', trips[0].Name, 'First trip should be the future trip');
        System.assertEquals('Current Trip', trips[1].Name, 'Second trip should be the current trip');
        System.assertEquals('Past Trip', trips[2].Name, 'Third trip should be the past trip');
    }
    
    @isTest
    static void testGetUserTrips() {
        // Setup test data
        createMultipleTestTrips();
        
        Test.startTest();
        List<Trip__c> trips = TripDashboardController.getUserTrips();
        Test.stopTest();
        
        // Verify results
        System.assertEquals(3, trips.size(), 'Should return all 3 test trips');
        // In a real implementation with user filtering, this would test that only the current user's trips are returned
    }
    
    @isTest
    static void testGetTripStats() {
        // Setup test data
        createMultipleTestTrips();
        
        Test.startTest();
        Map<String, Object> stats = TripDashboardController.getTripStats();
        Test.stopTest();
        
        // Verify results
        System.assertNotEquals(null, stats, 'Stats should not be null');
        System.assertEquals(3000.0, stats.get('totalBudget'), 'Total budget should be 3000');
        System.assertEquals(500.0, stats.get('totalSpent'), 'Total spent should be 500');
        System.assertEquals(250.0, stats.get('averageTripCost'), 'Average cost should be 250');
        System.assertEquals(1, stats.get('upcomingTrips'), 'Should have 1 upcoming trip');
    }
    
    @isTest
    static void testGetVisitedCountries() {
        // Setup test data - create trips with different countries
        Trip__c trip1 = createTestTrip('France Trip', 'France');
        Trip__c trip2 = createTestTrip('Japan Trip', 'Japan');
        Trip__c trip3 = createTestTrip('France Trip 2', 'France'); // Duplicate country
        
        Test.startTest();
        List<TripDashboardController.CountryWrapper> countries = TripDashboardController.getVisitedCountries();
        Test.stopTest();
        
        // Verify results
        System.assertEquals(2, countries.size(), 'Should return 2 unique countries');
        
        // Check country codes
        Set<String> countryCodes = new Set<String>();
        Set<String> countryNames = new Set<String>();
        
        for (TripDashboardController.CountryWrapper country : countries) {
            countryCodes.add(country.countryCode);
            countryNames.add(country.countryName);
        }
        
        System.assert(countryCodes.contains('FR'), 'Should include France with code FR');
        System.assert(countryCodes.contains('JP'), 'Should include Japan with code JP');
        System.assert(countryNames.contains('France'), 'Should include France');
        System.assert(countryNames.contains('Japan'), 'Should include Japan');
    }
    
    @isTest
    static void testGetCountryCodeUnknownCountry() {
        // Setup test data - create a trip with a country not in the mapping
        Trip__c trip = createTestTrip('Unknown Trip', 'Wakanda');
        
        Test.startTest();
        List<TripDashboardController.CountryWrapper> countries = TripDashboardController.getVisitedCountries();
        Test.stopTest();
        
        // Verify results
        System.assertEquals(1, countries.size(), 'Should return 1 country');
        System.assertEquals('WA', countries[0].countryCode, 
                           'Unknown country should use first 2 letters as code');
    }
    
    // Helper Methods
    
    private static void createMultipleTestTrips() {
        Date today = Date.today();
        
        // Past trip
        Trip__c pastTrip = new Trip__c(
            Name = 'Past Trip',
            Start_Date__c = today.addDays(-14),
            End_Date__c = today.addDays(-7),
            Country__c = 'France',
            Budget__c = 1000.0,
            Total_Spent__c = 250.0,
            Status__c = 'Completed'
        );
        
        // Current trip
        Trip__c currentTrip = new Trip__c(
            Name = 'Current Trip',
            Start_Date__c = today.addDays(-3),
            End_Date__c = today.addDays(4),
            Country__c = 'Italy',
            Budget__c = 1000.0,
            Total_Spent__c = 250.0,
            Status__c = 'In Progress'
        );
        
        // Future trip
        Trip__c futureTrip = new Trip__c(
            Name = 'Future Trip',
            Start_Date__c = today.addDays(7),
            End_Date__c = today.addDays(14),
            Country__c = 'Japan',
            Budget__c = 1000.0,
            Total_Spent__c = 0.0,
            Status__c = 'Planned'
        );
        
        insert new List<Trip__c>{pastTrip, currentTrip, futureTrip};
    }
    
    private static Trip__c createTestTrip(String name, String country) {
        Trip__c trip = new Trip__c(
            Name = name,
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(7),
            Country__c = country,
            Budget__c = 1000.0
        );
        insert trip;
        return trip;
    }
}