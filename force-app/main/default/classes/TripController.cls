// TripController.cls
public with sharing class TripController {
    
    @AuraEnabled(cacheable=true)
    public static List<Itinerary_Item__c> getItineraryItems(Id tripId) {
        try {
            return [
                SELECT Id, Name, Order__c, Location__Latitude__s, 
                       Location__Longitude__s, Planned_Date__c, Planned_Date_Time__c,
                       Duration_Hours__c,
                       End_Date_Time__c,
                       Actual_Date__c, Notes__c, Category__c
                FROM Itinerary_Item__c
                WHERE Trip__c = :tripId
                ORDER BY Order__c ASC
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving itinerary items: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Visited_Place__c> getVisitedPlaces(Id tripId) {
        try {
            return [
                SELECT Id, Name, Location__Latitude__s, 
                       Location__Longitude__s, Visit_Date__c,
                       Imported_From_Google__c
                FROM Visited_Place__c
                WHERE Trip__c = :tripId
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving visited places: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Decimal calculateDistance(Id tripId) {
        try {
            List<Itinerary_Item__c> items = [
                SELECT Location__Latitude__s, Location__Longitude__s
                FROM Itinerary_Item__c
                WHERE Trip__c = :tripId 
                AND Location__Latitude__s != null 
                AND Location__Longitude__s != null
                ORDER BY Order__c ASC
            ];
            
            if (items.size() < 2) {
                return 0;
            }
            
            Decimal totalDistance = 0;
            
            for (Integer i = 0; i < items.size() - 1; i++) {
                Itinerary_Item__c current = items[i];
                Itinerary_Item__c next = items[i + 1];
                
                // Calculate distance between consecutive points using Haversine formula
                Double distance = calculateHaversineDistance(
                    current.Location__Latitude__s,
                    current.Location__Longitude__s,
                    next.Location__Latitude__s,
                    next.Location__Longitude__s
                );
                
                totalDistance += Decimal.valueOf(distance);
            }
            
            // Update the Trip record with total distance
            Trip__c trip = new Trip__c(
                Id = tripId,
                Total_Distance__c = totalDistance
            );
            update trip;
            
            return totalDistance;
        } catch (Exception e) {
            throw new AuraHandledException('Error calculating distance: ' + e.getMessage());
        }
    }
    
    // Haversine formula to calculate distance between two points on Earth
    private static Double calculateHaversineDistance(Decimal lat1, Decimal lon1, Decimal lat2, Decimal lon2) {
        Double earthRadius = 6371; // Earth radius in kilometers
        
        Double lat1Rad = lat1 * Math.PI / 180;
        Double lat2Rad = lat2 * Math.PI / 180;
        Double deltaLat = (lat2 - lat1) * Math.PI / 180;
        Double deltaLon = (lon2 - lon1) * Math.PI / 180;
        
        Double a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                   Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                   Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
        
        Double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return earthRadius * c;
    }
    
    @AuraEnabled
    public static String getGoogleMapsApiKey() {
        return GoogleMapsRepository.getGoogleMapsApiKey();
    }
    
    @AuraEnabled
    public static void importGoogleLocations(String locationJson, Id tripId, String startDate, String endDate) {
        try {
            Map<String, Object> jsonData = (Map<String, Object>) JSON.deserializeUntyped(locationJson);
            List<Object> locations = (List<Object>) jsonData.get('locations');
            
            DateTime tripStart = startDate != null ? DateTime.valueOf(startDate) : null;
            DateTime tripEnd = endDate != null ? DateTime.valueOf(endDate) : null;
            
            List<Visited_Place__c> places = new List<Visited_Place__c>();
            
            for (Object loc : locations) {
                Map<String, Object> location = (Map<String, Object>) loc;
                
                // Parse Google's timestamp format
                String timestampMs = (String) location.get('timestampMs');
                Long timestamp = Long.valueOf(timestampMs);
                DateTime visitDateTime = DateTime.newInstance(timestamp);
                
                // Filter by trip dates if provided
                if (tripStart != null && tripEnd != null) {
                    if (visitDateTime < tripStart || visitDateTime > tripEnd) {
                        continue;
                    }
                }
                
                // Extract coordinates (Google uses E7 format)
                Long latE7 = (Long) location.get('latitudeE7');
                Long lngE7 = (Long) location.get('longitudeE7');
                
                Double latitude = latE7 / 10000000.0;
                Double longitude = lngE7 / 10000000.0;
                
                Visited_Place__c place = new Visited_Place__c(
                    Name = 'Location at ' + visitDateTime.format('MMM d, yyyy h:mm a'),
                    Trip__c = tripId,
                    Location__Latitude__s = latitude,
                    Location__Longitude__s = longitude,
                    Visit_Date__c = visitDateTime.date(),
                    Imported_From_Google__c = true
                );
                
                places.add(place);
            }
            
            if (!places.isEmpty()) {
                insert places;
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error importing Google locations: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Expense__c> getExpenses(Id tripId) {
        try {
            return [
                SELECT Id, Name, Amount__c, Category__c, Date__c, 
                       Shared_With__c, Splitwise_ID__c
                FROM Expense__c
                WHERE Trip__c = :tripId
                ORDER BY Date__c DESC
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving expenses: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void handleSplitWiseWebhook(String payload) {
        try {
            // Parse Splitwise webhook payload
            Map<String, Object> webhookData = (Map<String, Object>) JSON.deserializeUntyped(payload);
            
            // Handle different webhook events
            if (webhookData.containsKey('type')) {
                String eventType = (String) webhookData.get('type');
                
                switch on eventType {
                    when 'expense_created' {
                        // Create Expense__c record
                        Map<String, Object> expense = (Map<String, Object>) webhookData.get('expense');
                        createExpenseFromSplitwise(expense);
                    }
                    when 'expense_updated' {
                        // Update existing Expense__c record
                        Map<String, Object> expense = (Map<String, Object>) webhookData.get('expense');
                        updateExpenseFromSplitwise(expense);
                    }
                    when 'expense_deleted' {
                        // Delete Expense__c record
                        String expenseId = (String) webhookData.get('expense_id');
                        deleteExpenseFromSplitwise(expenseId);
                    }
                }
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error processing Splitwise webhook: ' + e.getMessage());
        }
    }
    
    private static void createExpenseFromSplitwise(Map<String, Object> expenseData) {
        String splitwiseId = String.valueOf(expenseData.get('id'));
        String description = (String) expenseData.get('description');
        Decimal amount = Decimal.valueOf(String.valueOf(expenseData.get('cost')));
        String category = (String) expenseData.get('category');
        
        // Find the corresponding Trip
        List<Expense__c> existingExpenses = [
            SELECT Trip__c 
            FROM Expense__c 
            WHERE Splitwise_ID__c = :splitwiseId 
            LIMIT 1
        ];
        
        Id tripId;
        if (!existingExpenses.isEmpty()) {
            tripId = existingExpenses[0].Trip__c;
        } else {
            // Find the most recent trip or default trip
            List<Trip__c> recentTrips = [
                SELECT Id 
                FROM Trip__c 
                ORDER BY CreatedDate DESC 
                LIMIT 1
            ];
            if (!recentTrips.isEmpty()) {
                tripId = recentTrips[0].Id;
            }
        }
        
        if (tripId != null) {
            Expense__c newExpense = new Expense__c(
                Name = description,
                Trip__c = tripId,
                Amount__c = amount,
                Category__c = category,
                Date__c = Date.today(),
                Splitwise_ID__c = splitwiseId
            );
            
            insert newExpense;
        }
    }
    
    private static void updateExpenseFromSplitwise(Map<String, Object> expenseData) {
        String splitwiseId = String.valueOf(expenseData.get('id'));
        
        List<Expense__c> expenses = [
            SELECT Id 
            FROM Expense__c 
            WHERE Splitwise_ID__c = :splitwiseId 
            LIMIT 1
            FOR UPDATE
        ];
        
        if (!expenses.isEmpty()) {
            Expense__c expense = expenses[0];
            expense.Name = (String) expenseData.get('description');
            expense.Amount__c = Decimal.valueOf(String.valueOf(expenseData.get('cost')));
            expense.Category__c = (String) expenseData.get('category');
            
            update expense;
        }
    }
    
    private static void deleteExpenseFromSplitwise(String splitwiseId) {
        List<Expense__c> expenses = [
            SELECT Id 
            FROM Expense__c 
            WHERE Splitwise_ID__c = :splitwiseId 
            LIMIT 1
            FOR UPDATE
        ];
        
        if (!expenses.isEmpty()) {
            delete expenses[0];
        }
    }
    
    // Method to update trip's total spent amount
    @AuraEnabled
    public static void updateTripTotalSpent(Id tripId) {
        try {
            // Calculate total spent from all expenses
            AggregateResult[] results = [
                SELECT SUM(Amount__c) total, MAX(Trip__r.Number_of_Travellers__c) travellers
                FROM Expense__c
                WHERE Trip__c = :tripId
            ];
            
            Decimal totalSpent = 0;
            Decimal personalSpent = 0;
            if (results.size() > 0 && results[0].get('total') != null) {
                totalSpent = (Decimal) results[0].get('total');
                Decimal travelers = (Decimal) results[0].get('travellers');
                if (travelers != null && travelers > 0) {
                    personalSpent = totalSpent / travelers;
                } else {
                    personalSpent = totalSpent; // Default to total if travelers is null or zero
                }
            }
            
            // Update Trip record
            Trip__c trip = new Trip__c(
                Id = tripId,
                Total_Spent__c = personalSpent
            );
            update trip;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating trip total spent: ' + e.getMessage());
        }
    }
}