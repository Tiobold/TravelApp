public with sharing class TravelStatsController {
    
    @AuraEnabled(cacheable=true)
    public static TravelStats getTravelStats() {
        try {
            TravelStats stats = new TravelStats();
            
            // Get all completed trips
            List<Trip__c> completedTrips = [
                SELECT Id, Name, Country__c, Start_Date__c, End_Date__c, 
                       Budget__c, Total_Spent__c
                FROM Trip__c 
                WHERE Status__c = 'Completed' 
                AND Start_Date__c != null 
                AND End_Date__c != null
                ORDER BY End_Date__c DESC
            ];
            
            // Calculate basic stats
            stats.totalTrips = completedTrips.size();
            stats.countriesVisited = calculateCountriesVisited(completedTrips);
            stats.totalDaysAbroad = calculateTotalDaysAbroad(completedTrips);
            stats.totalDistance = calculateTotalDistance(completedTrips);
            stats.carbonFootprint = calculateCarbonFootprint(completedTrips);
            stats.travelStreak = calculateTravelStreak(completedTrips);
            
            // Calculate derived stats
            stats.worldCircles = Math.round(stats.totalDistance / 40075.0 * 100) / 100.0; // Earth circumference
            stats.worldPercentage = Math.round((Decimal.valueOf(stats.countriesVisited) / 195.0) * 100 * 100) / 100.0; // 195 countries in world
            
            return stats;
        } catch (Exception e) {
            System.debug('Error in getTravelStats: ' + e.getMessage());
            throw new AuraHandledException('Error retrieving travel statistics: ' + e.getMessage());
        }
    }
    
    private static Integer calculateCountriesVisited(List<Trip__c> trips) {
        Set<String> countries = new Set<String>();
        for (Trip__c trip : trips) {
            if (String.isNotBlank(trip.Country__c)) {
                countries.add(trip.Country__c);
            }
        }
        return countries.size();
    }
    
    private static Integer calculateTotalDaysAbroad(List<Trip__c> trips) {
        Integer totalDays = 0;
        for (Trip__c trip : trips) {
            if (trip.Start_Date__c != null && trip.End_Date__c != null) {
                Integer days = trip.Start_Date__c.daysBetween(trip.End_Date__c) + 1; // Include both start and end date
                totalDays += days;
            }
        }
        return totalDays;
    }
    
    private static Integer calculateTotalDistance(List<Trip__c> trips) {
        Integer totalDistance = 0;
        
        // Map of countries to approximate distance from home (Budapest, Hungary)
        // In a real implementation, you could use a more sophisticated distance calculation
        Map<String, Integer> countryDistances = new Map<String, Integer>{
            'France' => 1200,
            'Germany' => 800,
            'Italy' => 900,
            'Spain' => 1800,
            'Netherlands' => 1100,
            'United Kingdom' => 1500,
            'Japan' => 9000,
            'Thailand' => 8500,
            'Singapore' => 10500,
            'Vietnam' => 9500,
            'Indonesia' => 11000,
            'Australia' => 16000,
            'United States' => 7500,
            'Canada' => 8000,
            'Brazil' => 11000,
            'Argentina' => 12000,
            'South Africa' => 8000,
            'Egypt' => 2800,
            'Morocco' => 2500,
            'India' => 6000,
            'China' => 7000,
            'South Korea' => 8500,
            'Mexico' => 10000,
            'Peru' => 12000,
            'Chile' => 13000,
            'Norway' => 1300,
            'Sweden' => 1000,
            'Finland' => 1200,
            'Iceland' => 2500,
            'Greenland' => 4000,
            'Russia' => 2000,
            'Turkey' => 1200,
            'Greece' => 1000,
            'Portugal' => 2200,
            'Switzerland' => 700,
            'Austria' => 300,
            'Czech Republic' => 200,
            'Poland' => 300,
            'Slovakia' => 200,
            'Slovenia' => 400,
            'Croatia' => 350,
            'Serbia' => 300,
            'Romania' => 350,
            'Bulgaria' => 500,
            'Ukraine' => 500
        };
        
        for (Trip__c trip : trips) {
            if (String.isNotBlank(trip.Country__c) && countryDistances.containsKey(trip.Country__c)) {
                // Round trip distance
                totalDistance += countryDistances.get(trip.Country__c) * 2;
            } else if (String.isNotBlank(trip.Country__c)) {
                // Default distance for unknown countries
                totalDistance += 2000;
            }
        }
        
        return totalDistance;
    }
    
    private static Integer calculateCarbonFootprint(List<Trip__c> trips) {
        Integer totalCarbon = 0; // in grams of CO2
        
        // Map of countries to distance (reusing logic from distance calculation)
        Map<String, Integer> countryDistances = new Map<String, Integer>{
            'France' => 1200,
            'Germany' => 800,
            'Italy' => 900,
            'Spain' => 1800,
            'Netherlands' => 1100,
            'United Kingdom' => 1500,
            'Japan' => 9000,
            'Thailand' => 8500,
            'Singapore' => 10500,
            'Vietnam' => 9500,
            'Indonesia' => 11000,
            'Australia' => 16000,
            'United States' => 7500,
            'Canada' => 8000,
            'Brazil' => 11000,
            'Argentina' => 12000,
            'South Africa' => 8000,
            'Egypt' => 2800,
            'Morocco' => 2500,
            'India' => 6000,
            'China' => 7000,
            'South Korea' => 8500,
            'Mexico' => 10000,
            'Peru' => 12000,
            'Chile' => 13000,
            'Norway' => 1300,
            'Sweden' => 1000,
            'Finland' => 1200,
            'Iceland' => 2500,
            'Greenland' => 4000,
            'Russia' => 2000,
            'Turkey' => 1200,
            'Greece' => 1000,
            'Portugal' => 2200,
            'Switzerland' => 700,
            'Austria' => 300,
            'Czech Republic' => 200,
            'Poland' => 300,
            'Slovakia' => 200,
            'Slovenia' => 400,
            'Croatia' => 350,
            'Serbia' => 300,
            'Romania' => 350,
            'Bulgaria' => 500,
            'Ukraine' => 500
        };
        
        for (Trip__c trip : trips) {
            if (String.isNotBlank(trip.Country__c) && countryDistances.containsKey(trip.Country__c)) {
                Integer distance = countryDistances.get(trip.Country__c) * 2; // Round trip
                
                // Estimate transportation based on distance
                Integer carbonPerKm;
                if (distance > 3000) {
                    carbonPerKm = 200; // Long distance = plane
                } else if (distance > 1000) {
                    carbonPerKm = 180; // Medium distance = likely plane
                } else {
                    carbonPerKm = 120; // Short distance = car/train mix
                }
                
                totalCarbon += distance * carbonPerKm;
            }
        }
        
        return totalCarbon; // Return in grams, will be converted to tonnes in frontend
    }
    
    private static Integer calculateTravelStreak(List<Trip__c> trips) {
        if (trips.isEmpty()) return 0;
        
        // Sort trips by end date descending
        trips.sort(new TripDateComparator());
        
        Date lastTripEnd = trips[0].End_Date__c;
        Date currentDate = Date.today();
        
        // Check if there's been a trip in the last 60 days (to account for current month)
        if (lastTripEnd.daysBetween(currentDate) > 60) {
            return 0;
        }
        
        Integer streak = 0;
        Set<String> monthsWithTrips = new Set<String>();
        
        // Collect months with trips
        for (Trip__c trip : trips) {
            String monthKey = String.valueOf(trip.End_Date__c.year()) + '-' + String.valueOf(trip.End_Date__c.month());
            monthsWithTrips.add(monthKey);
        }
        
        // Count consecutive months with trips starting from current month
        Date checkDate = currentDate;
        while (true) {
            String monthKey = String.valueOf(checkDate.year()) + '-' + String.valueOf(checkDate.month());
            if (monthsWithTrips.contains(monthKey)) {
                streak++;
                checkDate = checkDate.addMonths(-1);
            } else {
                break;
            }
            
            // Safety break to prevent infinite loop
            if (streak > 24) break;
        }
        
        return streak;
    }
    
    // Helper class for sorting trips by date
    private class TripDateComparator implements Comparator<Trip__c> {
        public Integer compare(Trip__c trip1, Trip__c trip2) {
            if (trip1.End_Date__c == trip2.End_Date__c) return 0;
            if (trip1.End_Date__c > trip2.End_Date__c) return -1;
            return 1;
        }
    }
    
    // Method to get detailed travel analytics
    @AuraEnabled(cacheable=true)
    public static TravelAnalytics getTravelAnalytics() {
        try {
            TravelAnalytics analytics = new TravelAnalytics();
            
            // Get trips with expenses
            List<Trip__c> trips = [
                SELECT Id, Name, Country__c, Start_Date__c, End_Date__c, 
                       Budget__c, Total_Spent__c,
                       (SELECT Id, Amount__c, Category__c, Date__c FROM Expenses__r)
                FROM Trip__c 
                WHERE Status__c = 'Completed'
                ORDER BY End_Date__c DESC
                LIMIT 50
            ];
            
            // Calculate monthly travel patterns
            analytics.monthlyTravelPattern = calculateMonthlyTravelPattern(trips);
            
            // Calculate expense trends
            analytics.averageExpensePerTrip = calculateAverageExpensePerTrip(trips);
            analytics.averageExpensePerDay = calculateAverageExpensePerDay(trips);
            
            // Calculate country statistics
            analytics.countryExpenseBreakdown = calculateCountryExpenseBreakdown(trips);
            analytics.favoriteDestinations = calculateFavoriteDestinations(trips);
            
            // Calculate seasonal trends
            analytics.seasonalTrends = calculateSeasonalTrends(trips);
            
            return analytics;
        } catch (Exception e) {
            System.debug('Error in getTravelAnalytics: ' + e.getMessage());
            throw new AuraHandledException('Error retrieving travel analytics: ' + e.getMessage());
        }
    }
    
    private static List<MonthlyTravelData> calculateMonthlyTravelPattern(List<Trip__c> trips) {
        Map<String, MonthlyTravelData> monthlyData = new Map<String, MonthlyTravelData>();
        
        for (Trip__c trip : trips) {
            if (trip.End_Date__c != null) {
                String monthKey = String.valueOf(trip.End_Date__c.year()) + '-' + 
                                String.format('{0:00}', new Object[]{ trip.End_Date__c.month() });
                
                if (!monthlyData.containsKey(monthKey)) {
                    MonthlyTravelData data = new MonthlyTravelData();
                    data.month = monthKey;
                    data.tripCount = 0;
                    data.totalExpenses = 0;
                    monthlyData.put(monthKey, data);
                }
                
                MonthlyTravelData data = monthlyData.get(monthKey);
                data.tripCount++;
                data.totalExpenses += trip.Total_Spent__c != null ? trip.Total_Spent__c.intValue() : 0;
            }
        }
        
        return monthlyData.values();
    }
    
    private static Decimal calculateAverageExpensePerTrip(List<Trip__c> trips) {
        Decimal totalExpenses = 0;
        Integer tripCount = 0;
        
        for (Trip__c trip : trips) {
            if (trip.Total_Spent__c != null) {
                totalExpenses += trip.Total_Spent__c;
                tripCount++;
            }
        }
        
        return tripCount > 0 ? totalExpenses / tripCount : 0;
    }
    
    private static Decimal calculateAverageExpensePerDay(List<Trip__c> trips) {
        Decimal totalExpenses = 0;
        Integer totalDays = 0;
        
        for (Trip__c trip : trips) {
            if (trip.Total_Spent__c != null && trip.Start_Date__c != null && trip.End_Date__c != null) {
                totalExpenses += trip.Total_Spent__c;
                totalDays += trip.Start_Date__c.daysBetween(trip.End_Date__c) + 1;
            }
        }
        
        return totalDays > 0 ? totalExpenses / totalDays : 0;
    }
    
    private static Map<String, Decimal> calculateCountryExpenseBreakdown(List<Trip__c> trips) {
        Map<String, Decimal> countryExpenses = new Map<String, Decimal>();
        
        for (Trip__c trip : trips) {
            if (String.isNotBlank(trip.Country__c) && trip.Total_Spent__c != null) {
                if (!countryExpenses.containsKey(trip.Country__c)) {
                    countryExpenses.put(trip.Country__c, 0);
                }
                countryExpenses.put(trip.Country__c, 
                    countryExpenses.get(trip.Country__c) + trip.Total_Spent__c);
            }
        }
        
        return countryExpenses;
    }
    
    private static List<DestinationData> calculateFavoriteDestinations(List<Trip__c> trips) {
        Map<String, DestinationData> destinationMap = new Map<String, DestinationData>();
        
        for (Trip__c trip : trips) {
            if (String.isNotBlank(trip.Country__c)) {
                if (!destinationMap.containsKey(trip.Country__c)) {
                    DestinationData data = new DestinationData();
                    data.country = trip.Country__c;
                    data.visitCount = 0;
                    data.totalExpenses = 0;
                    data.lastVisit = trip.End_Date__c;
                    destinationMap.put(trip.Country__c, data);
                }
                
                DestinationData data = destinationMap.get(trip.Country__c);
                data.visitCount++;
                data.totalExpenses += trip.Total_Spent__c != null ? trip.Total_Spent__c.intValue() : 0;
                
                if (trip.End_Date__c > data.lastVisit) {
                    data.lastVisit = trip.End_Date__c;
                }
            }
        }
        
        List<DestinationData> destinations = destinationMap.values();
        destinations.sort(new DestinationComparator());
        
        // Return top 10
        List<DestinationData> topDestinations = new List<DestinationData>();
        Integer count = 0;
        for (DestinationData dest : destinations) {
            if (count >= 10) break;
            topDestinations.add(dest);
            count++;
        }
        return topDestinations;  
    }
    
    private static List<SeasonalTrendData> calculateSeasonalTrends(List<Trip__c> trips) {
        Map<String, SeasonalTrendData> seasonalData = new Map<String, SeasonalTrendData>{
            'Spring' => new SeasonalTrendData('Spring', 0, 0),
            'Summer' => new SeasonalTrendData('Summer', 0, 0),
            'Autumn' => new SeasonalTrendData('Autumn', 0, 0),
            'Winter' => new SeasonalTrendData('Winter', 0, 0)
        };
        
        for (Trip__c trip : trips) {
            if (trip.Start_Date__c != null) {
                String season = getSeason(trip.Start_Date__c);
                SeasonalTrendData data = seasonalData.get(season);
                data.tripCount++;
                data.totalExpenses += trip.Total_Spent__c != null ? trip.Total_Spent__c.intValue() : 0;
            }
        }
        
        return seasonalData.values();
    }
    
    private static String getSeason(Date tripDate) {
        Integer month = tripDate.month();
        if (month >= 3 && month <= 5) return 'Spring';
        if (month >= 6 && month <= 8) return 'Summer';
        if (month >= 9 && month <= 11) return 'Autumn';
        return 'Winter';
    }
    
    // Helper class for sorting destinations
    private class DestinationComparator implements Comparator<DestinationData> {
        public Integer compare(DestinationData dest1, DestinationData dest2) {
            if (dest1.visitCount == dest2.visitCount) return 0;
            if (dest1.visitCount > dest2.visitCount) return -1;
            return 1;
        }
    }
    
    // Wrapper classes for response data
    public class TravelStats {
        @AuraEnabled public Integer totalTrips = 0;
        @AuraEnabled public Integer countriesVisited = 0;
        @AuraEnabled public Integer totalDaysAbroad = 0;
        @AuraEnabled public Integer totalDistance = 0; // in kilometers
        @AuraEnabled public Integer carbonFootprint = 0; // in grams
        @AuraEnabled public Integer travelStreak = 0; // consecutive months with travel
        @AuraEnabled public Decimal worldCircles = 0; // times around the world
        @AuraEnabled public Decimal worldPercentage = 0; // percentage of world visited
    }
    
    public class TravelAnalytics {
        @AuraEnabled public List<MonthlyTravelData> monthlyTravelPattern;
        @AuraEnabled public Decimal averageExpensePerTrip;
        @AuraEnabled public Decimal averageExpensePerDay;
        @AuraEnabled public Map<String, Decimal> countryExpenseBreakdown;
        @AuraEnabled public List<DestinationData> favoriteDestinations;
        @AuraEnabled public List<SeasonalTrendData> seasonalTrends;
    }
    
    public class MonthlyTravelData {
        @AuraEnabled public String month;
        @AuraEnabled public Integer tripCount;
        @AuraEnabled public Integer totalExpenses;
    }
    
    public class DestinationData {
        @AuraEnabled public String country;
        @AuraEnabled public Integer visitCount;
        @AuraEnabled public Integer totalExpenses;
        @AuraEnabled public Date lastVisit;
    }
    
    public class SeasonalTrendData {
        @AuraEnabled public String season;
        @AuraEnabled public Integer tripCount;
        @AuraEnabled public Integer totalExpenses;
        
        public SeasonalTrendData(String season, Integer tripCount, Integer totalExpenses) {
            this.season = season;
            this.tripCount = tripCount;
            this.totalExpenses = totalExpenses;
        }
    }
}