@isTest
private class TripControllerTest {
    
    @isTest
    static void testGetItineraryItems() {
        // Setup test data
        Trip__c trip = createTestTrip();
        createTestItineraryItem(trip.Id);
        
        Test.startTest();
        List<Itinerary_Item__c> items = TripController.getItineraryItems(trip.Id);
        Test.stopTest();
        
        // Verify results
        System.assertEquals(1, items.size(), 'Should return one itinerary item');
        System.assertEquals('Test Item', items[0].Name, 'Item name should match');
        System.assertEquals('Test Notes', items[0].Notes__c, 'Notes should match');
    }
    
    @isTest
    static void testGetVisitedPlaces() {
        // Setup test data
        Trip__c trip = createTestTrip();
        createTestVisitedPlace(trip.Id);
        
        Test.startTest();
        List<Visited_Place__c> places = TripController.getVisitedPlaces(trip.Id);
        Test.stopTest();
        
        // Verify results
        System.assertEquals(1, places.size(), 'Should return one visited place');
        System.assertEquals('Test Visited Place', places[0].Name, 'Place name should match');
    }
    
    @isTest
    static void testCalculateDistance() {
        // Setup test data
        Trip__c trip = createTestTrip();
        
        // Create multiple itinerary items with different locations
        Itinerary_Item__c item1 = new Itinerary_Item__c(
            Name = 'Location 1',
            Trip__c = trip.Id,
            Location__Latitude__s = 48.8566, // Paris
            Location__Longitude__s = 2.3522,
            Order__c = 1
        );
        
        Itinerary_Item__c item2 = new Itinerary_Item__c(
            Name = 'Location 2',
            Trip__c = trip.Id,
            Location__Latitude__s = 51.5074, // London
            Location__Longitude__s = -0.1278,
            Order__c = 2
        );
        
        insert new List<Itinerary_Item__c>{item1, item2};
        
        Test.startTest();
        Decimal distance = TripController.calculateDistance(trip.Id);
        Test.stopTest();
        
        // Verify results
        System.assert(distance > 0, 'Distance should be greater than 0');
        // The distance between Paris and London is about 334 km (as the crow flies)
        System.assert(distance > 300 && distance < 350, 
                     'Distance should be approximately 334 km (got ' + distance + ')');
        
        // Verify the trip was updated with the distance
        Trip__c updatedTrip = [SELECT Total_Distance__c FROM Trip__c WHERE Id = :trip.Id];
        System.assertEquals(distance, updatedTrip.Total_Distance__c, 
                           'Trip total distance should be updated');
    }
    
    @isTest
    static void testCalculateDistanceWithEmptyOrSingleItem() {
        // Setup test data
        Trip__c trip = createTestTrip();
        
        Test.startTest();
        // Test with no items
        Decimal emptyDistance = TripController.calculateDistance(trip.Id);
        
        // Now add just one item
        Itinerary_Item__c item = new Itinerary_Item__c(
            Name = 'Single Location',
            Trip__c = trip.Id,
            Location__Latitude__s = 48.8566,
            Location__Longitude__s = 2.3522,
            Order__c = 1
        );
        insert item;
        
        // Test with a single item
        Decimal singleDistance = TripController.calculateDistance(trip.Id);
        Test.stopTest();
        
        // Verify results
        System.assertEquals(0, emptyDistance, 'Distance should be 0 with no items');
        System.assertEquals(0, singleDistance, 'Distance should be 0 with only one item');
    }
    
    @isTest
    static void testGetExpenses() {
        // Setup test data
        Trip__c trip = createTestTrip();
        createTestExpense(trip.Id);
        
        Test.startTest();
        List<Expense__c> expenses = TripController.getExpenses(trip.Id);
        Test.stopTest();
        
        // Verify results
        System.assertEquals(1, expenses.size(), 'Should return one expense');
        System.assertEquals('Test Expense', expenses[0].Name, 'Expense name should match');
        System.assertEquals(100.0, expenses[0].Amount__c, 'Amount should match');
    }
    
    @isTest
    static void testUpdateTripTotalSpent() {
        // Setup test data
        Trip__c trip = createTestTrip();
        trip.Description__c = 'edit;';
        update trip;
        
        // Create multiple expenses
        Expense__c expense1 = new Expense__c(
            Name = 'Expense 1',
            Trip__c = trip.Id,
            Amount__c = 100.0,
            Date__c = Date.today(),
            Category__c = 'Food'
        );
        
        Expense__c expense2 = new Expense__c(
            Name = 'Expense 2',
            Trip__c = trip.Id,
            Amount__c = 200.0,
            Date__c = Date.today(),
            Category__c = 'Accommodation'
        );
        
        insert new List<Expense__c>{expense1, expense2};
        
        Test.startTest();
        TripController.updateTripTotalSpent(trip.Id);
        Test.stopTest();
        
        // Verify results
        Trip__c updatedTrip = [SELECT Total_Spent__c FROM Trip__c WHERE Id = :trip.Id];
        
        // Total expenses are 300, divided by 2 travelers = 150 per person
        System.assertEquals(150.0, updatedTrip.Total_Spent__c, 
                           'Trip total spent should be updated to 150 (300/2 travelers)');
    }
    
    @isTest
    static void testUpdateTripTotalSpentNoTravelers() {
        // Setup test data with no travelers specified
        Trip__c trip = createTestTrip();
        
        // Create an expense
        Expense__c expense = new Expense__c(
            Name = 'Test Expense',
            Trip__c = trip.Id,
            Amount__c = 100.0,
            Date__c = Date.today(),
            Category__c = 'Food'
        );
        insert expense;
        
        Test.startTest();
        TripController.updateTripTotalSpent(trip.Id);
        Test.stopTest();
        
        // Verify results
        Trip__c updatedTrip = [SELECT Total_Spent__c FROM Trip__c WHERE Id = :trip.Id];
        
        // If travelers is null or 0, should default to the total amount
        System.assertEquals(100.0, updatedTrip.Total_Spent__c, 
                           'Trip total spent should be the full amount with no travelers');
    }
    
    @isTest
    static void testHandleSplitWiseWebhook_ExpenseCreated() {
        // Create a test trip for reference
        Trip__c trip = createTestTrip();
        
        // Prepare test payload
        String payload = '{"type":"expense_created","expense":{"id":"123456","description":"Test Webhook Expense","cost":"150.0","category":"Food"}}';
        
        Test.startTest();
        TripController.handleSplitWiseWebhook(payload);
        Test.stopTest();
        
        // Verify results - a new expense should be created
        List<Expense__c> expenses = [
            SELECT Name, Amount__c, Category__c, Splitwise_ID__c
            FROM Expense__c 
            WHERE Splitwise_ID__c = '123456'
        ];
        
        System.assertEquals(1, expenses.size(), 'Should create one expense from webhook');
        System.assertEquals('Test Webhook Expense', expenses[0].Name, 'Expense name should match');
        System.assertEquals(150.0, expenses[0].Amount__c, 'Amount should match');
        System.assertEquals('Food', expenses[0].Category__c, 'Category should match');
    }
    
    @isTest
    static void testHandleSplitWiseWebhook_ExpenseUpdated() {
        // Create a test trip
        Trip__c trip = createTestTrip();
        
        // Create a test expense with Splitwise ID
        Expense__c expense = new Expense__c(
            Name = 'Original Expense Name',
            Trip__c = trip.Id,
            Amount__c = 100.0,
            Date__c = Date.today(),
            Category__c = 'Transportation',
            Splitwise_ID__c = '123456'
        );
        insert expense;
        
        // Prepare test payload for update
        String payload = '{"type":"expense_updated","expense":{"id":"123456","description":"Updated Expense Name","cost":"200.0","category":"Food"}}';
        
        Test.startTest();
        TripController.handleSplitWiseWebhook(payload);
        Test.stopTest();
        
        // Verify results - the expense should be updated
        Expense__c updatedExpense = [
            SELECT Name, Amount__c, Category__c
            FROM Expense__c 
            WHERE Splitwise_ID__c = '123456'
        ];
        
        System.assertEquals('Updated Expense Name', updatedExpense.Name, 'Expense name should be updated');
        System.assertEquals(200.0, updatedExpense.Amount__c, 'Amount should be updated');
        System.assertEquals('Food', updatedExpense.Category__c, 'Category should be updated');
    }
    
    @isTest
    static void testHandleSplitWiseWebhook_ExpenseDeleted() {
        // Create a test trip
        Trip__c trip = createTestTrip();
        
        // Create a test expense with Splitwise ID
        Expense__c expense = new Expense__c(
            Name = 'Expense To Delete',
            Trip__c = trip.Id,
            Amount__c = 100.0,
            Date__c = Date.today(),
            Category__c = 'Transportation',
            Splitwise_ID__c = '123456'
        );
        insert expense;
        
        // Prepare test payload for delete
        String payload = '{"type":"expense_deleted","expense_id":"123456"}';
        
        Test.startTest();
        TripController.handleSplitWiseWebhook(payload);
        Test.stopTest();
        
        // Verify results - the expense should be deleted
        List<Expense__c> expenses = [
            SELECT Id FROM Expense__c WHERE Splitwise_ID__c = '123456'
        ];
        
        System.assertEquals(0, expenses.size(), 'Expense should be deleted');
    }
    
    // Helper Methods
    
    private static Trip__c createTestTrip() {
        Trip__c trip = new Trip__c(
            Name = 'Test Trip',
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(7),
            Country__c = 'France',
            Budget__c = 1000.0
        );
        insert trip;
        return trip;
    }
    
    private static Itinerary_Item__c createTestItineraryItem(Id tripId) {
        Itinerary_Item__c item = new Itinerary_Item__c(
            Name = 'Test Item',
            Trip__c = tripId,
            Notes__c = 'Test Notes',
            Location__Latitude__s = 48.8566,
            Location__Longitude__s = 2.3522,
            Category__c = 'Sightseeing',
            Order__c = 1
        );
        insert item;
        return item;
    }
    
    private static Visited_Place__c createTestVisitedPlace(Id tripId) {
        Visited_Place__c place = new Visited_Place__c(
            Name = 'Test Visited Place',
            Trip__c = tripId,
            Location__Latitude__s = 48.8566,
            Location__Longitude__s = 2.3522,
            Visit_Date__c = Date.today()
        );
        insert place;
        return place;
    }
    
    private static Expense__c createTestExpense(Id tripId) {
        Expense__c expense = new Expense__c(
            Name = 'Test Expense',
            Trip__c = tripId,
            Amount__c = 100.0,
            Date__c = Date.today(),
            Category__c = 'Food'
        );
        insert expense;
        return expense;
    }
}