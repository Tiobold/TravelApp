public class FlightPriceMonitor implements Database.Batchable<SObject>, Database.AllowsCallouts, Schedulable {
    
    public void execute(SchedulableContext context) {
        // Execute the batch job when scheduled
        Database.executeBatch(new FlightPriceMonitor(), 10);
    }
    
    public Database.QueryLocator start(Database.BatchableContext context) {
        // Get all active flight price alerts
        return Database.getQueryLocator([
            SELECT Id, Name, Trip__c, Trip__r.Name, Trip__r.Start_Date__c, 
                   Origin_Airport__c, Destination_Airport__c, Max_Price__c, 
                   Departure_Date__c, Return_Date__c, Adults__c, 
                   Alert_Email__c, Last_Check_Date__c, Is_Active__c,
                   Trip__r.OwnerId, Notification_Type__c
            FROM Flight_Price_Alert__c 
            WHERE Is_Active__c = true 
            AND (Last_Check_Date__c = null OR Last_Check_Date__c < TODAY)
            AND Departure_Date__c >= TODAY
        ]);
    }
    
    public void execute(Database.BatchableContext context, List<Flight_Price_Alert__c> alerts) {
        List<Flight_Price_Alert__c> alertsToUpdate = new List<Flight_Price_Alert__c>();
        List<Messaging.SingleEmailMessage> emailsToSend = new List<Messaging.SingleEmailMessage>();
        
        for (Flight_Price_Alert__c alert : alerts) {
            try {
                // Search for flights matching the alert criteria
                AmadeusService.FlightSearchResult result = AmadeusService.searchFlights(
                    alert.Origin_Airport__c,
                    alert.Destination_Airport__c,
                    String.valueOf(alert.Departure_Date__c),
                    alert.Return_Date__c != null ? String.valueOf(alert.Return_Date__c) : null,
                    Integer.valueOf(alert.Adults__c)
                );
                
                if (result != null && result.flights != null && !result.flights.isEmpty()) {
                    // Check if any flights are below the max price
                    List<AmadeusService.FlightOffer> goodFlights = new List<AmadeusService.FlightOffer>();
                    
                    for (AmadeusService.FlightOffer flight : result.flights) {
                        Decimal flightPrice = extractPriceFromString(flight.price);
                        if (flightPrice != null && flightPrice <= alert.Max_Price__c) {
                            goodFlights.add(flight);
                        }
                    }
                    
                    // Send notification if good flights found
                    if (!goodFlights.isEmpty()) {
                        sendNotification(alert, goodFlights);
                    }
                }
                
                // Update the alert's last check date
                alert.Last_Check_Date__c = Date.today();
                alertsToUpdate.add(alert);
                
            } catch (Exception e) {
                System.debug('Error checking flight prices for alert ' + alert.Id + ': ' + e.getMessage());
                // Continue with other alerts even if one fails
                alert.Last_Check_Date__c = Date.today();
                alertsToUpdate.add(alert);
            }
        }
        
        // Update all alerts
        if (!alertsToUpdate.isEmpty()) {
            try {
                update alertsToUpdate;
            } catch (Exception e) {
                System.debug('Error updating flight price alerts: ' + e.getMessage());
            }
        }
        
        // Send all emails
        if (!emailsToSend.isEmpty()) {
            try {
                Messaging.sendEmail(emailsToSend);
            } catch (Exception e) {
                System.debug('Error sending notification emails: ' + e.getMessage());
            }
        }
    }
    
    public void finish(Database.BatchableContext context) {
        System.debug('Flight price monitoring batch completed at: ' + System.now());
    }
    
    /**
     * Send notification for good flights found
     */
    private void sendNotification(Flight_Price_Alert__c alert, List<AmadeusService.FlightOffer> goodFlights) {
        try {
            // Determine notification method
            if (alert.Notification_Type__c == 'Email' || alert.Notification_Type__c == 'Both') {
                sendEmailNotification(alert, goodFlights);
            }
            
            if (alert.Notification_Type__c == 'In-App' || alert.Notification_Type__c == 'Both') {
                sendInAppNotification(alert, goodFlights);
            }
        } catch (Exception e) {
            System.debug('Error sending notification: ' + e.getMessage());
        }
    }
    
    /**
     * Send email notification
     */
    private void sendEmailNotification(Flight_Price_Alert__c alert, List<AmadeusService.FlightOffer> goodFlights) {
        String recipientEmail = String.isNotBlank(alert.Alert_Email__c) ? alert.Alert_Email__c : null;
        
        // If no email specified, try to get user's email
        if (String.isBlank(recipientEmail)) {
            try {
                User tripOwner = [SELECT Email FROM User WHERE Id = :alert.Trip__r.OwnerId LIMIT 1];
                recipientEmail = tripOwner.Email;
            } catch (Exception e) {
                System.debug('Could not get trip owner email: ' + e.getMessage());
                return;
            }
        }
        
        if (String.isBlank(recipientEmail)) {
            return;
        }
        
        // Build email content
        String subject = 'Flight Alert: Cheap Flights Found for ' + alert.Trip__r.Name;
        String htmlBody = buildEmailBody(alert, goodFlights);
        
        // Create email
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(new String[]{recipientEmail});
        email.setSubject(subject);
        email.setHtmlBody(htmlBody);
        email.setSaveAsActivity(false);
        
        // Send email
        try {
            Messaging.sendEmail(new Messaging.SingleEmailMessage[]{email});
        } catch (Exception e) {
            System.debug('Error sending email notification: ' + e.getMessage());
        }
    }
    
    /**
     * Send in-app notification (Custom Notification)
     */
    private void sendInAppNotification(Flight_Price_Alert__c alert, List<AmadeusService.FlightOffer> goodFlights) {
        try {
            // Get the custom notification type
            CustomNotificationType notificationType = [
                SELECT Id, DeveloperName 
                FROM CustomNotificationType 
                WHERE DeveloperName = 'Flight_Price_Alert' 
                LIMIT 1
            ];
            
            // Create notification
            Messaging.CustomNotification notification = new Messaging.CustomNotification();
            notification.setTitle('Flight Alert: Cheap Flights Found!');
            notification.setBody(goodFlights.size() + ' flights found below €' + alert.Max_Price__c + ' for ' + alert.Trip__r.Name);
            notification.setNotificationTypeId(notificationType.Id);
            notification.setTargetId(alert.Trip__c);
            
            // Send to trip owner
            Set<String> recipientsIds = new Set<String>{alert.Trip__r.OwnerId};
            notification.send(recipientsIds);
            
        } catch (Exception e) {
            System.debug('Error sending in-app notification: ' + e.getMessage());
        }
    }
    
    /**
     * Build HTML email body - UPDATED to use new URL method
     */
    private String buildEmailBody(Flight_Price_Alert__c alert, List<AmadeusService.FlightOffer> goodFlights) {
        // Updated to use the new method for getting base URL
        String baseUrl = URL.getOrgDomainUrl().toExternalForm();
        
        String htmlBody = '<!DOCTYPE html><html><head><style>';
        htmlBody += 'body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }';
        htmlBody += '.container { max-width: 600px; margin: 0 auto; padding: 20px; }';
        htmlBody += '.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }';
        htmlBody += '.flight-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 15px; margin: 10px 0; background: #f9f9f9; }';
        htmlBody += '.price { font-size: 1.5em; font-weight: bold; color: #0176d3; }';
        htmlBody += '.route { font-size: 1.1em; margin: 10px 0; }';
        htmlBody += '.btn { background: #0176d3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0; }';
        htmlBody += '</style></head><body>';
        
        htmlBody += '<div class="container">';
        htmlBody += '<div class="header">';
        htmlBody += '<h1>✈️ Flight Alert: Great Deals Found!</h1>';
        htmlBody += '<p>We found ' + goodFlights.size() + ' flights below your price limit of €' + alert.Max_Price__c + '</p>';
        htmlBody += '</div>';
        
        htmlBody += '<div style="padding: 20px; background: white; border-radius: 0 0 8px 8px;">';
        htmlBody += '<h2>Trip: ' + alert.Trip__r.Name + '</h2>';
        htmlBody += '<p><strong>Route:</strong> ' + alert.Origin_Airport__c + ' → ' + alert.Destination_Airport__c + '</p>';
        htmlBody += '<p><strong>Departure:</strong> ' + alert.Departure_Date__c.format() + '</p>';
        if (alert.Return_Date__c != null) {
            htmlBody += '<p><strong>Return:</strong> ' + alert.Return_Date__c.format() + '</p>';
        }
        
        htmlBody += '<h3>Flights Found:</h3>';
        
        for (AmadeusService.FlightOffer flight : goodFlights) {
            htmlBody += '<div class="flight-card">';
            htmlBody += '<div class="price">' + flight.price + '</div>';
            
            if (flight.itineraries != null && !flight.itineraries.isEmpty()) {
                for (AmadeusService.FlightItinerary itinerary : flight.itineraries) {
                    if (itinerary.segments != null && !itinerary.segments.isEmpty()) {
                        AmadeusService.FlightSegment firstSegment = itinerary.segments[0];
                        AmadeusService.FlightSegment lastSegment = itinerary.segments[itinerary.segments.size() - 1];
                        
                        htmlBody += '<div class="route">';
                        htmlBody += firstSegment.departureCode + ' → ' + lastSegment.arrivalCode;
                        htmlBody += ' (' + formatDuration(itinerary.duration) + ')';
                        htmlBody += '</div>';
                    }
                }
            }
            htmlBody += '</div>';
        }
        
        htmlBody += '<a href="' + baseUrl + '/lightning/r/Trip__c/' + alert.Trip__c + '/view" class="btn">View Trip</a>';
        htmlBody += '<p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #666; font-size: 0.9em;">';
        htmlBody += 'This is an automated alert from your Travel App. To manage your flight alerts, visit your trip page.';
        htmlBody += '</p>';
        htmlBody += '</div></div></body></html>';
        
        return htmlBody;
    }
    
    /**
     * Extract numeric price from flight price string
     */
    private Decimal extractPriceFromString(String priceStr) {
        if (String.isBlank(priceStr)) {
            return null;
        }
        
        try {
            // Remove currency symbols and extract numbers
            String numericPart = priceStr.replaceAll('[^0-9.]', '');
            return Decimal.valueOf(numericPart);
        } catch (Exception e) {
            System.debug('Error parsing price: ' + priceStr + ' - ' + e.getMessage());
            return null;
        }
    }
    
    /**
     * Format flight duration
     */
    private String formatDuration(String duration) {
        if (String.isBlank(duration)) {
            return '';
        }
        
        try {
            // Duration is in ISO 8601 format (PT1H30M)
            Pattern p = Pattern.compile('PT(\\d+H)?(\\d+M)?');
            Matcher m = p.matcher(duration);
            
            if (m.matches()) {
                String hoursStr = m.group(1);
                String minutesStr = m.group(2);
                
                Integer hours = hoursStr != null ? Integer.valueOf(hoursStr.replace('H', '')) : 0;
                Integer minutes = minutesStr != null ? Integer.valueOf(minutesStr.replace('M', '')) : 0;
                
                return hours + 'h ' + minutes + 'm';
            }
        } catch (Exception e) {
            System.debug('Error formatting duration: ' + duration + ' - ' + e.getMessage());
        }
        
        return duration;
    }
    
    /**
     * Static method to schedule the job
     */
    public static String scheduleFlightPriceMonitor() {
        // Schedule to run daily at 8 AM
        String cronExpression = '0 0 8 * * ?';
        String jobName = 'Flight Price Monitor - ' + Datetime.now().format('yyyy-MM-dd HH:mm');
        
        return System.schedule(jobName, cronExpression, new FlightPriceMonitor());
    }
    
    /**
     * Static method to run the job immediately (for testing)
     */
    public static void runFlightPriceMonitorNow() {
        Database.executeBatch(new FlightPriceMonitor(), 10);
    }
}