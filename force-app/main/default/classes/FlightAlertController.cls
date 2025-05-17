public with sharing class FlightAlertController {
    
    @AuraEnabled(cacheable=true)
    public static List<Flight_Price_Alert__c> getFlightAlerts(Id tripId) {
        try {
            return [
                SELECT Id, Name, Origin_Airport__c, Destination_Airport__c, 
                       Departure_Date__c, Return_Date__c, Max_Price__c, Adults__c,
                       Alert_Email__c, Is_Active__c, Last_Check_Date__c, 
                       Notification_Type__c, Created_Date__c, Last_Good_Price__c,
                       (SELECT Id, Price__c, Found_Date__c, Flight_Details__c 
                        FROM Flight_Price_Notifications__r 
                        ORDER BY Found_Date__c DESC LIMIT 5)
                FROM Flight_Price_Alert__c
                WHERE Trip__c = :tripId
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving flight alerts: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Flight_Price_Alert__c createFlightAlert(
        Id tripId, 
        String originAirport, 
        String destinationAirport,
        String departureDate,
        String returnDate,
        Decimal maxPrice,
        Integer adults,
        String alertEmail,
        String notificationType
    ) {
        try {
            // Validate required fields
            if (String.isBlank(originAirport) || String.isBlank(destinationAirport) || 
                String.isBlank(departureDate) || maxPrice == null) {
                throw new AuraHandledException('Missing required fields');
            }
            
            // Create the alert
            Flight_Price_Alert__c alert = new Flight_Price_Alert__c();
            alert.Trip__c = tripId;
            alert.Origin_Airport__c = originAirport.toUpperCase();
            alert.Destination_Airport__c = destinationAirport.toUpperCase();
            alert.Departure_Date__c = Date.valueOf(departureDate);
            
            if (String.isNotBlank(returnDate)) {
                alert.Return_Date__c = Date.valueOf(returnDate);
            }
            
            alert.Max_Price__c = maxPrice;
            alert.Adults__c = adults != null ? adults : 1;
            alert.Alert_Email__c = alertEmail;
            alert.Notification_Type__c = notificationType;
            alert.Is_Active__c = true;
            
            // Generate a name for the alert
            alert.Name = originAirport + ' to ' + destinationAirport + ' - €' + maxPrice;
            
            insert alert;
            
            return alert;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating flight alert: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void updateFlightAlert(Id alertId, Map<String, Object> updates) {
        try {
            Flight_Price_Alert__c alert = [
                SELECT Id FROM Flight_Price_Alert__c 
                WHERE Id = :alertId 
                LIMIT 1
            ];
            
            // Apply updates
            if (updates.containsKey('maxPrice')) {
                alert.Max_Price__c = (Decimal) updates.get('maxPrice');
            }
            if (updates.containsKey('isActive')) {
                alert.Is_Active__c = (Boolean) updates.get('isActive');
            }
            if (updates.containsKey('alertEmail')) {
                alert.Alert_Email__c = (String) updates.get('alertEmail');
            }
            if (updates.containsKey('notificationType')) {
                alert.Notification_Type__c = (String) updates.get('notificationType');
            }
            
            update alert;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating flight alert: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void deleteFlightAlert(Id alertId) {
        try {
            delete [SELECT Id FROM Flight_Price_Alert__c WHERE Id = :alertId];
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting flight alert: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void toggleFlightAlert(Id alertId, Boolean isActive) {
        try {
            Flight_Price_Alert__c alert = [
                SELECT Id, Is_Active__c 
                FROM Flight_Price_Alert__c 
                WHERE Id = :alertId 
                LIMIT 1
            ];
            
            alert.Is_Active__c = isActive;
            update alert;
        } catch (Exception e) {
            throw new AuraHandledException('Error toggling flight alert: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void testFlightAlert(Id alertId) {
        try {
            // Run the monitoring job for this specific alert
            List<Flight_Price_Alert__c> alerts = [
                SELECT Id, Name, Trip__c, Trip__r.Name, Trip__r.Start_Date__c, 
                       Origin_Airport__c, Destination_Airport__c, Max_Price__c, 
                       Departure_Date__c, Return_Date__c, Adults__c, 
                       Alert_Email__c, Last_Check_Date__c, Is_Active__c,
                       Trip__r.OwnerId, Notification_Type__c
                FROM Flight_Price_Alert__c 
                WHERE Id = :alertId
            ];
            
            if (!alerts.isEmpty()) {
                FlightPriceMonitor monitor = new FlightPriceMonitor();
                monitor.execute(null, alerts);
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error testing flight alert: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static String scheduleFlightMonitoring() {
        try {
            // First, abort any existing scheduled jobs
            List<CronTrigger> existingJobs = [
                SELECT Id, CronJobDetail.Name
                FROM CronTrigger 
                WHERE CronJobDetail.Name LIKE 'Flight Price Monitor%'
                AND State = 'WAITING'
            ];
            
            for (CronTrigger job : existingJobs) {
                System.abortJob(job.Id);
            }
            
            // Schedule the new job
            String jobId = FlightPriceMonitor.scheduleFlightPriceMonitor();
            return jobId;
        } catch (Exception e) {
            throw new AuraHandledException('Error scheduling flight monitoring: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void runFlightMonitoringNow() {
        try {
            FlightPriceMonitor.runFlightPriceMonitorNow();
        } catch (Exception e) {
            throw new AuraHandledException('Error running flight monitoring: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getFlightMonitoringStatus() {
        try {
            Map<String, Object> status = new Map<String, Object>();
            
            // Check for scheduled jobs
            List<CronTrigger> scheduledJobs = [
                SELECT Id, CronJobDetail.Name, NextFireTime, PreviousFireTime, State
                FROM CronTrigger 
                WHERE CronJobDetail.Name LIKE 'Flight Price Monitor%'
                ORDER BY CreatedDate DESC
                LIMIT 1
            ];
            
            if (!scheduledJobs.isEmpty()) {
                CronTrigger job = scheduledJobs[0];
                status.put('isScheduled', true);
                status.put('nextRun', job.NextFireTime);
                status.put('lastRun', job.PreviousFireTime);
                status.put('status', job.State);
                status.put('jobId', job.Id);
            } else {
                status.put('isScheduled', false);
            }
            
            // Count active alerts
            Integer activeAlerts = [
                SELECT COUNT() 
                FROM Flight_Price_Alert__c 
                WHERE Is_Active__c = true
            ];
            status.put('activeAlerts', activeAlerts);
            
            // Get recent notifications
            List<Flight_Price_Notification__c> recentNotifications = [
                SELECT Id, Flight_Price_Alert__r.Name, Price__c, Found_Date__c
                FROM Flight_Price_Notification__c
                ORDER BY Found_Date__c DESC
                LIMIT 5
            ];
            status.put('recentNotifications', recentNotifications);
            
            return status;
        } catch (Exception e) {
            throw new AuraHandledException('Error getting flight monitoring status: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getAirportSuggestions(String searchTerm) {
        try {
            // First try to get suggestions from Amadeus API
            List<AmadeusService.LocationSuggestion> apiSuggestions = 
                AmadeusService.getLocationSuggestions(searchTerm);
            
            List<Map<String, String>> suggestions = new List<Map<String, String>>();
            
            for (AmadeusService.LocationSuggestion suggestion : apiSuggestions) {
                if (suggestion.subType == 'AIRPORT') {
                    suggestions.add(new Map<String, String>{
                        'code' => suggestion.iataCode,
                        'name' => suggestion.name,
                        'city' => suggestion.cityName,
                        'country' => suggestion.countryName
                    });
                }
            }
            
            // If API doesn't return enough results, add some common airports
            if (suggestions.size() < 5) {
                Map<String, Map<String, String>> commonAirports = new Map<String, Map<String, String>>{
                    'BUD' => new Map<String, String>{
                        'code' => 'BUD',
                        'name' => 'Budapest Ferenc Liszt International Airport',
                        'city' => 'Budapest',
                        'country' => 'Hungary'
                    },
                    'AMS' => new Map<String, String>{
                        'code' => 'AMS',
                        'name' => 'Amsterdam Airport Schiphol',
                        'city' => 'Amsterdam',
                        'country' => 'Netherlands'
                    },
                    'CDG' => new Map<String, String>{
                        'code' => 'CDG',
                        'name' => 'Charles de Gaulle Airport',
                        'city' => 'Paris',
                        'country' => 'France'
                    },
                    'LHR' => new Map<String, String>{
                        'code' => 'LHR',
                        'name' => 'Heathrow Airport',
                        'city' => 'London',
                        'country' => 'United Kingdom'
                    },
                    'FCO' => new Map<String, String>{
                        'code' => 'FCO',
                        'name' => 'Leonardo da Vinci Airport',
                        'city' => 'Rome',
                        'country' => 'Italy'
                    }
                };
                
                String searchLower = searchTerm.toLowerCase();
                for (String code : commonAirports.keySet()) {
                    Map<String, String> airport = commonAirports.get(code);
                    if (code.toLowerCase().contains(searchLower) || 
                        airport.get('city').toLowerCase().contains(searchLower) ||
                        airport.get('name').toLowerCase().contains(searchLower)) {
                        
                        // Check if we already have this airport
                        Boolean alreadyAdded = false;
                        for (Map<String, String> existing : suggestions) {
                            if (existing.get('code') == code) {
                                alreadyAdded = true;
                                break;
                            }
                        }
                        
                        if (!alreadyAdded) {
                            suggestions.add(airport);
                        }
                    }
                }
            }
            
            return suggestions;
        } catch (Exception e) {
            // Return fallback suggestions on error
            return new List<Map<String, String>>{
                new Map<String, String>{
                    'code' => 'BUD',
                    'name' => 'Budapest Ferenc Liszt International Airport',
                    'city' => 'Budapest',
                    'country' => 'Hungary'
                }
            };
        }
    }
}