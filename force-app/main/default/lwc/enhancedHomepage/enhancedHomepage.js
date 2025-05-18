// enhancedHomepage.js
import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getUserTrips from '@salesforce/apex/TripDashboardController.getUserTrips';
import getTripStats from '@salesforce/apex/TripDashboardController.getTripStats';
import getVisitedCountries from '@salesforce/apex/TripDashboardController.getVisitedCountries';
import getExpenseBreakdown from '@salesforce/apex/TripDashboardController.getExpenseBreakdown';
import getTripCompanions from '@salesforce/apex/TripCompanionController.getTripCompanions';
import getTravelStats from '@salesforce/apex/TravelStatsController.getTravelStats';

export default class EnhancedHomepage extends NavigationMixin(LightningElement) {
    @track trips = [];
    @track filteredTrips = [];
    @track currentFilter = 'upcoming';
    @track isLoading = true;
    @track error;
    @track showPlanTripModal = false;
    @track tripStats = {};
    @track countries = [];
    @track hasFilterApplied = false;
    @track showExpandedStats = false;
    
    // Enhanced travel statistics
    @track travelStats = {};
    @track animatedStats = {
        totalTrips: 0,
        countriesVisited: 0,
        totalDaysAbroad: 0,
        totalDistance: 0,
        carbonFootprint: 0,
        travelStreak: 0
    };
    
    // Animation control
    animationDuration = 2000;
    animationStartTime = null;
    
    // Expense overview data
    @track currentMonthExpenses = 0;
    @track lastMonthExpenses = 0;
    @track topExpenseCategories = [];
    
    // Enhanced travel statistics
    @track totalDaysTravel = 0;
    @track averageTripDuration = 0;
    countriesVisited = 0;
    
    wiredTripsResult;
    wiredTravelStatsResult;
    
    @wire(getTravelStats)
    wiredTravelStats(result) {
        this.wiredTravelStatsResult = result;
        if (result.data) {
            this.travelStats = result.data;
            this.startStatsAnimations();
        } else if (result.error) {
            console.error('Error loading travel stats:', result.error);
        }
    }

    @wire(getUserTrips)
    wiredTrips(result) {
        this.wiredTripsResult = result;
        if (result.data) {
            this.processTrips(result.data);
            // Load companions for each trip after processing
            this.loadTripCompanions(result.data);
            this.error = undefined;
        } else if (result.error) {
            this.error = result.error;
            this.trips = [];
            this.filteredTrips = [];
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
            this.countries = data;
            this.countriesVisited = data.length;
        } else if (error) {
            this.showToast('Error', 'Error loading country data', 'error');
        }
    }
    
    connectedCallback() {
        // Load sample expense data
        this.loadSampleExpenseData();
    }

    renderedCallback() {
        if (this.travelStats && Object.keys(this.travelStats).length > 0 && !this.animationStartTime) {
            this.startStatsAnimations();
        }
    }

    startStatsAnimations() {
        if (this.animationStartTime || !this.travelStats.totalTrips) return;
        
        this.animationStartTime = Date.now();
        this.animateCounters();
        this.animateProgressBars();
    }

    animateCounters() {
        const animate = () => {
            const elapsed = Date.now() - this.animationStartTime;
            const progress = Math.min(elapsed / this.animationDuration, 1);
            
            // Easing function for smooth animation
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            
            this.animatedStats = {
                totalTrips: Math.floor(this.travelStats.totalTrips * easeOutCubic),
                countriesVisited: Math.floor(this.travelStats.countriesVisited * easeOutCubic),
                totalDaysAbroad: Math.floor(this.travelStats.totalDaysAbroad * easeOutCubic),
                totalDistance: Math.floor(this.travelStats.totalDistance * easeOutCubic),
                carbonFootprint: Math.floor(this.travelStats.carbonFootprint * easeOutCubic),
                travelStreak: Math.floor(this.travelStats.travelStreak * easeOutCubic)
            };

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    animateProgressBars() {
        setTimeout(() => {
            const progressBars = this.template.querySelectorAll('.progress-bar');
            progressBars.forEach((bar, index) => {
                setTimeout(() => {
                    bar.style.width = bar.dataset.progress + '%';
                }, index * 200);
            });
        }, 500);
    }

    // Toggle expanded stats view
    handleToggleExpandedStats() {
        this.showExpandedStats = !this.showExpandedStats;
        
        // Animate the expanded section
        setTimeout(() => {
            const expandedSection = this.template.querySelector('.expanded-stats-section');
            if (expandedSection && this.showExpandedStats) {
                expandedSection.classList.add('animate-in');
            }
        }, 50);
    }

    processTrips(tripsData) {
        const today = new Date();
        
        // Reset statistics
        let totalDays = 0;
        let completedTrips = 0;
        
        this.trips = tripsData.map(trip => {
            // Format dates
            const startDate = new Date(trip.Start_Date__c);
            const endDate = new Date(trip.End_Date__c);
            
            // Calculate trip duration in days
            const tripDurationMs = endDate.getTime() - startDate.getTime();
            const tripDurationDays = Math.ceil(tripDurationMs / (1000 * 3600 * 24));
            
            // Add to total days if trip is completed or in progress
            if (endDate <= today) {
                totalDays += tripDurationDays;
                completedTrips++;
            } else if (startDate <= today && endDate > today) {
                // For trips in progress, count days until today
                const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
                totalDays += Math.max(0, daysElapsed);
            }
            
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
            let progressColor = '#667eea'; // Brand blue
            if (budgetPercentage > 90) {
                progressColor = '#dc2626'; // Red for > 90%
            } else if (budgetPercentage > 70) {
                progressColor = '#f59e0b'; // Amber for > 70%
            }
            
            // Create style for progress bar
            const progressStyle = `width: ${budgetPercentage}%; background-color: ${progressColor};`;
            
            return {
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
                formattedSpent,
                durationDays: tripDurationDays,
                // Initialize companion properties
                companions: [],
                totalCompanions: 0,
                hasMoreCompanions: false
            };
        });
        
        // Update statistics
        this.totalDaysTravel = totalDays;
        this.averageTripDuration = completedTrips > 0 ? Math.round(totalDays / completedTrips) : 0;
        
        // Apply initial filter
        this.applyFilter(this.currentFilter);
    }

    // Load companions for all trips
    async loadTripCompanions(tripsData) {
        try {
            const tripIds = tripsData.map(trip => trip.Id);
            const companionPromises = tripIds.map(tripId => 
                getTripCompanions({ tripId })
                    .then(result => ({ tripId, companions: result }))
                    .catch(error => ({ tripId, companions: null, error }))
            );
            
            const companionResults = await Promise.all(companionPromises);
            
            // Update trips with companion data
            this.trips = this.trips.map(trip => {
                const companionData = companionResults.find(result => result.tripId === trip.Id);
                if (companionData && companionData.companions) {
                    const confirmedCompanions = companionData.companions.confirmed || [];
                    // Limit to first 3 companions for display
                    const displayCompanions = confirmedCompanions.slice(0, 3).map(companion => ({
                        id: companion.Id,
                        name: companion.Name,
                        photoUrl: companion.PhotoURL || '/img/icon/t4v35/standard/user_120.png'
                    }));
                    
                    return {
                        ...trip,
                        companions: displayCompanions,
                        totalCompanions: confirmedCompanions.length,
                        hasMoreCompanions: confirmedCompanions.length > 3
                    };
                }
                return {
                    ...trip,
                    companions: [],
                    totalCompanions: 0,
                    hasMoreCompanions: false
                };
            });
            
            // Re-apply current filter to update filtered trips
            this.applyFilter(this.currentFilter);
        } catch (error) {
            console.error('Error loading trip companions:', error);
            // Continue without companion data rather than failing
        }
    }
    
    calculateBudgetPercentage(trip) {
        if (!trip.Budget__c || trip.Budget__c === 0) return 0;
        const percentage = ((trip.Total_Spent__c || 0) / trip.Budget__c) * 100;
        return Math.min(Math.max(percentage, 0), 100); // Clamp between 0-100%
    }
    
    // Process expense data from API
    processExpenseData(data) {
        if (data.currentMonth) {
            this.currentMonthExpenses = data.currentMonth;
        }
        
        if (data.lastMonth) {
            this.lastMonthExpenses = data.lastMonth;
        }
        
        if (data.categories && data.categories.length > 0) {
            this.topExpenseCategories = data.categories.map(cat => {
                // Calculate percentage for width
                const percentage = cat.percentage || (cat.amount / data.total * 100);
                return {
                    ...cat,
                    style: `width: ${percentage}%; background-color: ${this.getCategoryColor(cat.name)};`
                };
            });
        }
    }
    
    // Load sample expense data for demonstration
    loadSampleExpenseData() {
        this.currentMonthExpenses = 587.50;
        this.lastMonthExpenses = 943.25;
        
        this.topExpenseCategories = [
            {
                id: 'cat1',
                name: 'Accommodation',
                amount: 620.00,
                percentage: 40.5,
                style: 'width: 40.5%; background-color: #1a73e8;'
            },
            {
                id: 'cat2',
                name: 'Food',
                amount: 350.50,
                percentage: 22.9,
                style: 'width: 22.9%; background-color: #34a853;'
            },
            {
                id: 'cat3',
                name: 'Transportation',
                amount: 285.25,
                percentage: 18.6,
                style: 'width: 18.6%; background-color: #fbbc04;'
            },
            {
                id: 'cat4',
                name: 'Activities',
                amount: 215.00,
                percentage: 14.0,
                style: 'width: 14.0%; background-color: #ea4335;'
            },
            {
                id: 'cat5',
                name: 'Shopping',
                amount: 60.00,
                percentage: 3.9,
                style: 'width: 3.9%; background-color: #9334e6;'
            }
        ];
    }
    
    // Get color for expense category
    getCategoryColor(category) {
        const colorMap = {
            'Accommodation': '#1a73e8',
            'Food': '#34a853',
            'Transportation': '#fbbc04',
            'Activities': '#ea4335',
            'Shopping': '#9334e6',
            'Other': '#5f6368'
        };
        
        return colorMap[category] || '#5f6368';
    }
    
    // Apply filter to trips
    applyFilter(filterValue) {
        this.currentFilter = filterValue;
        this.hasFilterApplied = filterValue !== 'all';
        
        let filtered;
        const today = new Date();
        const currentYear = today.getFullYear();
        
        switch(filterValue) {
            case 'upcoming':
                filtered = this.trips.filter(trip => trip.isUpcoming);
                break;
            case 'inprogress':
                filtered = this.trips.filter(trip => trip.isInProgress);
                break;
            case 'completed':
                filtered = this.trips.filter(trip => trip.isCompleted);
                break;
            case 'year':
                filtered = this.trips.filter(trip => {
                    const tripYear = new Date(trip.Start_Date__c).getFullYear();
                    return tripYear === currentYear;
                });
                break;
            default:
                // 'all' or any other value
                filtered = [...this.trips];
                this.hasFilterApplied = false;
        }
        
        // Sort by start date (upcoming first, then in progress, then completed)
        filtered.sort((a, b) => {
            const dateA = new Date(a.Start_Date__c);
            const dateB = new Date(b.Start_Date__c);
            
            // First group by status
            if (a.isUpcoming && !b.isUpcoming) return -1;
            if (!a.isUpcoming && b.isUpcoming) return 1;
            if (a.isInProgress && !b.isInProgress && !b.isUpcoming) return -1;
            if (!a.isInProgress && b.isInProgress && !a.isUpcoming) return 1;
            
            // Then sort by date within each group
            if (a.isUpcoming || a.isInProgress) {
                // Upcoming and in-progress: earliest first
                return dateA - dateB;
            } else {
                // Completed: most recent first (reverse chronological)
                return dateB - dateA;
            }
        });
        
        this.filteredTrips = filtered;
    }
    
    // Handler for timeline filter change
    handleTimelineFilterChange(event) {
        const filterValue = event.detail.value;
        this.applyFilter(filterValue);
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
        event.stopPropagation();
        const tripId = event.currentTarget.dataset.id;
        
        // Navigate to trip record page
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: tripId,
                objectApiName: 'Trip__c',
                actionName: 'view'
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
    get hasTripsToShow() {
        return this.filteredTrips && this.filteredTrips.length > 0;
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
    
    // New getters for enhanced statistics
    get totalDaysTravelFormatted() {
        return this.animatedStats.totalDaysAbroad || this.totalDaysTravel || 0;
    }
    
    get averageTripDurationFormatted() {
        const avgDays = this.averageTripDuration;
        if (avgDays === 0) return '0 days';
        if (avgDays === 1) return '1 day';
        return `${avgDays} days`;
    }

    // Enhanced travel stats getters
    get formattedDistance() {
        return (this.animatedStats.totalDistance / 1000).toLocaleString('en-US', {
            maximumFractionDigits: 0
        }) + 'K';
    }

    get formattedCarbon() {
        return (this.animatedStats.carbonFootprint / 1000000).toLocaleString('en-US', {
            maximumFractionDigits: 1
        }) + 'T';
    }

    get nextMilestone() {
        const current = this.animatedStats.countriesVisited || this.travelStats.countriesVisited || 0;
        const nextCountryMilestone = Math.ceil(current / 5) * 5;
        return {
            type: 'countries',
            current: current,
            target: nextCountryMilestone,
            progress: nextCountryMilestone > 0 ? (current / nextCountryMilestone) * 100 : 0
        };
    }

    get achievementBadges() {
        const badges = [];
        const trips = this.animatedStats.totalTrips || this.travelStats.totalTrips || 0;
        const countries = this.animatedStats.countriesVisited || this.travelStats.countriesVisited || 0;
        const streak = this.animatedStats.travelStreak || this.travelStats.travelStreak || 0;
        const days = this.animatedStats.totalDaysAbroad || this.travelStats.totalDaysAbroad || 0;
        
        if (trips >= 5) badges.push({ name: 'Traveler', icon: 'utility:world' });
        if (trips >= 10) badges.push({ name: 'Explorer', icon: 'utility:world' });
        if (countries >= 10) badges.push({ name: 'World Citizen', icon: 'utility:map' });
        if (countries >= 20) badges.push({ name: 'Globe Trotter', icon: 'utility:location' });
        if (streak >= 6) badges.push({ name: 'Travel Addict', icon: 'utility:favorite' });
        if (days >= 100) badges.push({ name: 'Nomad', icon: 'utility:plane' });
        return badges;
    }

    get ecoRating() {
        const trips = this.animatedStats.totalTrips || this.travelStats.totalTrips || 1;
        const carbon = this.animatedStats.carbonFootprint || this.travelStats.carbonFootprint || 0;
        const avgCarbonPerTrip = carbon / trips;
        
        if (avgCarbonPerTrip < 500000) return { rating: 'A+', color: 'success' };
        if (avgCarbonPerTrip < 1000000) return { rating: 'A', color: 'success' };
        if (avgCarbonPerTrip < 2000000) return { rating: 'B', color: 'warning' };
        return { rating: 'C', color: 'error' };
    }

    get expandButtonLabel() {
        return this.showExpandedStats ? 'Show Less' : 'Show More Stats';
    }

    get expandButtonIcon() {
        return this.showExpandedStats ? 'utility:chevronup' : 'utility:chevrondown';
    }
}