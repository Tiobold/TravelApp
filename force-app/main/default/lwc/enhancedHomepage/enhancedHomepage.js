// revisedHomepage.js
import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getUserTrips from '@salesforce/apex/TripDashboardController.getUserTrips';
import getTripStats from '@salesforce/apex/TripDashboardController.getTripStats';
import getVisitedCountries from '@salesforce/apex/TripDashboardController.getVisitedCountries';

export default class RevisedHomepage extends NavigationMixin(LightningElement) {
    @track trips = [];
    @track upcomingTrips = [];
    @track isLoading = true;
    @track error;
    @track showPlanTripModal = false;
    @track tripStats = {};
    @track countries = [];
    
    countriesVisited = 0;
    
    wiredTripsResult;
    
    @wire(getUserTrips)
    wiredTrips(result) {
        this.wiredTripsResult = result;
        if (result.data) {
            this.processTrips(result.data);
            this.error = undefined;
        } else if (result.error) {
            this.error = result.error;
            this.trips = [];
            this.upcomingTrips = [];
            this.showToast('Error', 'Error loading trips', 'error');
        }
        this.isLoading = false;
    }

    @wire(getTripStats)
    wiredStats({ error, data }) {
        if (data) {
            this.tripStats = data;
        } else if (error) {
            this.showToast('Error', 'Error loading trip statistics', 'error');
        }
    }
    
    @wire(getVisitedCountries)
    wiredCountries({ error, data }) {
        if (data) {
            // Process countries and add flag emojis
            this.countries = data.map(country => {
                return {
                    ...country,
                    flagEmoji: this.getFlagEmoji(country.countryCode)
                };
            });
            this.countriesVisited = data.length;
        } else if (error) {
            this.showToast('Error', 'Error loading country data', 'error');
        }
    }

    processTrips(tripsData) {
        const today = new Date();
        const upcomingTrips = [];
        
        this.trips = tripsData.map(trip => {
            // Format dates
            const startDate = new Date(trip.Start_Date__c);
            const endDate = new Date(trip.End_Date__c);
            
            // Formatted dates for display
            const options = { month: 'short', day: 'numeric', year: 'numeric' };
            const formattedStartDate = startDate.toLocaleDateString(undefined, options);
            const formattedEndDate = endDate.toLocaleDateString(undefined, options);
            
            // Format currency values
            const formatter = new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: 'EUR'
            });
            const formattedBudget = formatter.format(trip.Budget__c || 0);
            const formattedSpent = formatter.format(trip.Total_Spent__c || 0);
            
            // Calculate days until start
            const timeDiff = startDate.getTime() - today.getTime();
            const daysUntil = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            // Determine trip status
            const isUpcoming = startDate > today;
            const isInProgress = today >= startDate && today <= endDate;
            const isCompleted = today > endDate;
            
            let status = 'Planned';
            let statusClass = 'badge-planned';
            let timelineClass = 'trip-upcoming';
            
            if (isInProgress) {
                status = 'In Progress';
                statusClass = 'badge-in-progress';
                timelineClass = 'trip-in-progress';
            } else if (isCompleted) {
                status = 'Completed';
                statusClass = 'badge-completed';
                timelineClass = 'trip-completed';
            }
            
            // Create style for badge background
            const badgeStyle = isInProgress 
                ? 'background-color: #ffab00' 
                : isCompleted 
                    ? 'background-color: #34a853' 
                    : 'background-color: #1a73e8';
            
            // Calculate budget percentage for progress bar
            const budgetPercentage = this.calculateBudgetPercentage(trip);
            
            // Determine color based on percentage
            let progressColor = '#1a73e8'; // Default blue
            if (budgetPercentage > 90) {
                progressColor = '#ea4335'; // Red for > 90%
            } else if (budgetPercentage > 70) {
                progressColor = '#fbbc04'; // Yellow for > 70%
            }
            
            // Create style for progress bar
            const progressStyle = `width: ${budgetPercentage}%; background-color: ${progressColor};`;
            
            const enhancedTrip = {
                ...trip,
                isUpcoming,
                isInProgress,
                isCompleted,
                daysUntil,
                status,
                statusClass,
                timelineClass,
                badgeStyle,
                budgetPercentage,
                progressStyle,
                formattedStartDate,
                formattedEndDate,
                formattedBudget,
                formattedSpent
            };
            
            // Add to upcoming trips list if it's not completed
            if (isUpcoming || isInProgress) {
                upcomingTrips.push(enhancedTrip);
            }
            
            return enhancedTrip;
        });
        
        // Sort upcoming trips by start date
        upcomingTrips.sort((a, b) => {
            return new Date(a.Start_Date__c) - new Date(b.Start_Date__c);
        });
        
        this.upcomingTrips = upcomingTrips;
    }
    
    calculateBudgetPercentage(trip) {
        if (!trip.Budget__c || trip.Budget__c === 0) return 0;
        const percentage = ((trip.Total_Spent__c || 0) / trip.Budget__c) * 100;
        return Math.min(Math.max(percentage, 0), 100); // Clamp between 0-100%
    }
    
    // Get flag emoji from country code
    getFlagEmoji(countryCode) {
        if (!countryCode || countryCode === 'XX' || countryCode.length !== 2) {
            return '🌍'; // Default globe for unknown countries
        }
        
        try {
            const codePoints = countryCode
                .toUpperCase()
                .split('')
                .map(char => 127397 + char.charCodeAt(0));
            return String.fromCodePoint(...codePoints);
        } catch (e) {
            console.warn(`Could not create flag emoji for ${countryCode}`, e);
            return '🌍'; // Fallback
        }
    }
    
    // Event Handlers
    handlePlanNewTrip() {
        this.showPlanTripModal = true;
    }

    handleClosePlanModal() {
        this.showPlanTripModal = false;
        this.refreshData();
    }
    
    handleViewTrip(event) {
        const tripId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: tripId,
                objectApiName: 'Trip__c',
                actionName: 'view'
            }
        });
    }

    handleViewMap(event) {
        event.stopPropagation(); // Prevent trip card click
        const tripId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: tripId,
                objectApiName: 'Trip__c',
                actionName: 'view'
            },
            state: {
                tab: 'map'
            }
        });
    }

    handleViewExpenses(event) {
        event.stopPropagation(); // Prevent trip card click
        const tripId = event.currentTarget.dataset.id;
        
        // Navigate to trip record page with focus on expenses
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: tripId,
                objectApiName: 'Trip__c',
                actionName: 'view'
            },
            state: {
                tab: 'expenses'
            }
        });
    }

    refreshData() {
        this.isLoading = true;
        return refreshApex(this.wiredTripsResult)
            .finally(() => {
                this.isLoading = false;
            });
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(event);
    }
    
    // Getters
    get hasUpcomingTrips() {
        return this.upcomingTrips && this.upcomingTrips.length > 0;
    }
    
    get hasVisitedCountries() {
        return this.countries && this.countries.length > 0;
    }
    
    get totalBudget() {
        return this.tripStats.totalBudget || 0;
    }

    get totalSpent() {
        return this.tripStats.totalSpent || 0;
    }

    get averageTripCost() {
        return this.tripStats.averageTripCost || 0;
    }

    get upcomingTripsCount() {
        return this.tripStats.upcomingTrips || 0;
    }
}