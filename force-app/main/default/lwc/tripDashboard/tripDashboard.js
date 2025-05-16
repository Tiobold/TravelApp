// tripDashboard.js
import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getAllTrips from '@salesforce/apex/TripDashboardController.getAllTrips';
import getTripStats from '@salesforce/apex/TripDashboardController.getTripStats';
import getUserTrips from '@salesforce/apex/TripDashboardController.getUserTrips';

export default class TripDashboard extends NavigationMixin(LightningElement) {
    @track allTrips = [];
    @track filteredTrips = [];
    @track selectedFilter = 'all';
    @track isLoading = true;
    @track error;
    @track showPlanTripModal = false;
    @track tripStats = {};
    @track activeTab = 'planned'; // Default active tab is 'planned'
    
    wiredTripsResult;
    
    filterOptions = [
        { label: 'All Trips', value: 'all' },
        { label: 'Planned', value: 'planned' },
        { label: 'In Progress', value: 'inprogress' },
        { label: 'Completed', value: 'completed' }
    ];

    tabs = [
        { label: 'Planned', value: 'planned', count: 0 },
        { label: 'Recent', value: 'recent', count: 0 },
        { label: 'Completed', value: 'completed', count: 0 },
        { label: 'All Trips', value: 'all', count: 0 }
    ];

    @wire(getUserTrips)
    wiredTrips(result) {
        this.wiredTripsResult = result;
        if (result.data) {
            this.processTripData(result.data);
            this.error = undefined;
        } else if (result.error) {
            this.error = result.error;
            this.allTrips = [];
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

    connectedCallback() {
        this.refreshData();
    }

    renderedCallback() {
        // Apply tab styling - make active tab appear selected
        const tabItems = this.template.querySelectorAll('.slds-tabs_default__item');
        tabItems.forEach(item => {
            const link = item.querySelector('a');
            if (link) {
                const tabValue = link.dataset.value;
                
                if (tabValue === this.activeTab) {
                    item.classList.add('slds-is-active');
                } else {
                    item.classList.remove('slds-is-active');
                }
            }
        });
        
        // Update progress bar colors for all trip cards
        this.updateProgressBarColors();
    }

    // Apply correct colors to progress bars based on percentage
    updateProgressBarColors() {
        setTimeout(() => {
            const tripCards = this.template.querySelectorAll('.trip-card');
            
            tripCards.forEach(card => {
                const progressValue = card.querySelector('.custom-progress-value');
                if (progressValue) {
                    const cardContent = card.querySelector('[data-id]');
                    if (cardContent) {
                        const tripId = cardContent.dataset.id;
                        const trip = this.filteredTrips.find(t => t.Id === tripId);
                        
                        if (trip && progressValue) {
                            // The style is already set via data binding
                            // Just ensure proper rendering
                        }
                    }
                }
            });
        }, 10);
    }

    processTripData(trips) {
        this.allTrips = trips.map(trip => {
            // Format dates for display
            const startDate = new Date(trip.Start_Date__c);
            const endDate = new Date(trip.End_Date__c);
            
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            const startDateFormatted = startDate.toLocaleDateString('en-US', options);
            const endDateFormatted = endDate.toLocaleDateString('en-US', options);
            
            // Calculate budget percentage
            const budgetPercentage = this.calculateBudgetPercentage(trip);
            
            // Determine color based on percentage
            let progressColor = '#1589ee'; // Default blue
            if (budgetPercentage > 90) {
                progressColor = '#fe5c4c'; // Red for > 90%
            } else if (budgetPercentage > 70) {
                progressColor = '#ffb75d'; // Yellow for > 70%
            }
            
            // Create style for progress bar
            const progressStyle = `display: block; height: 100%; width: ${budgetPercentage}%; background-color: ${progressColor};`;
            
            // Add computed properties to the trip object
            return {
                ...trip,
                isInProgress: this.isTripInProgress(trip),
                isCompleted: this.isTripCompleted(trip),
                isPlanned: this.isTripPlanned(trip),
                budgetPercentage: budgetPercentage,
                progressStyle: progressStyle,
                formattedCurrency: trip.Budget__c,
                startDateFormatted: startDateFormatted,
                endDateFormatted: endDateFormatted
            };
        });
        
        // Update tab counts
        this.updateTabCounts();
        
        // Apply initial filter
        this.applyFilter();
    }

    // Determine trip status based on dates
    isTripInProgress(trip) {
        const today = new Date();
        const startDate = new Date(trip.Start_Date__c);
        const endDate = new Date(trip.End_Date__c);
        return today >= startDate && today <= endDate;
    }

    isTripCompleted(trip) {
        const today = new Date();
        const endDate = new Date(trip.End_Date__c);
        return today > endDate;
    }

    isTripPlanned(trip) {
        const today = new Date();
        const startDate = new Date(trip.Start_Date__c);
        return today < startDate;
    }

    calculateBudgetPercentage(trip) {
        if (!trip.Budget__c || trip.Budget__c === 0) return 0;
        const percentage = ((trip.Total_Spent__c || 0) / trip.Budget__c) * 100;
        return Math.min(Math.max(percentage, 0), 100); // Clamp between 0-100%
    }

    // Count trips by category and update tab counts
    updateTabCounts() {
        const planned = this.allTrips.filter(t => t.isPlanned).length;
        const recent = this.getRecentTrips(this.allTrips).length;
        const completed = this.allTrips.filter(t => t.isCompleted).length;
        const all = this.allTrips.length;
        
        this.tabs = [
            { label: 'Planned', value: 'planned', count: planned },
            { label: 'Recent', value: 'recent', count: recent },
            { label: 'Completed', value: 'completed', count: completed },
            { label: 'All Trips', value: 'all', count: all }
        ];
    }

    // Get trips from the last 3 months
    getRecentTrips(trips) {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        return trips.filter(trip => {
            const endDate = new Date(trip.End_Date__c);
            return endDate >= threeMonthsAgo;
        });
    }

    // Handle tab click - apply filtering by tab
    handleTabChange(event) {
        this.activeTab = event.currentTarget.dataset.value;
        this.applyFilter();
        
        // Update UI after tab change
        setTimeout(() => {
            this.renderedCallback();
        }, 10);
    }

    // Handle secondary filter dropdown changes
    handleFilterChange(event) {
        this.selectedFilter = event.detail.value;
        this.applyFilter();
    }

    // Apply both tab and dropdown filters
    applyFilter() {
        // Start with all trips
        let filtered = [...this.allTrips];
        
        // Apply tab filter first
        switch(this.activeTab) {
            case 'recent':
                filtered = this.getRecentTrips(filtered);
                break;
            case 'planned':
                filtered = filtered.filter(t => t.isPlanned);
                break;
            case 'completed':
                filtered = filtered.filter(t => t.isCompleted);
                break;
            // 'all' tab shows everything, so no filtering needed
        }
        
        // Then apply secondary filter dropdown if it's not 'all'
        if (this.selectedFilter !== 'all') {
            switch(this.selectedFilter) {
                case 'planned':
                    filtered = filtered.filter(t => t.isPlanned);
                    break;
                case 'inprogress':
                    filtered = filtered.filter(t => t.isInProgress);
                    break;
                case 'completed':
                    filtered = filtered.filter(t => t.isCompleted);
                    break;
            }
        }
        
        // Update filtered trips
        this.filteredTrips = filtered;
        
        // Update UI after filter change
        if (!this.isLoading) {
            setTimeout(() => {
                this.updateProgressBarColors();
            }, 10);
        }
    }

    // Modal and navigation handlers
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

    // Refresh data from server
    refreshData() {
        this.isLoading = true;
        return refreshApex(this.wiredTripsResult)
            .finally(() => {
                this.isLoading = false;
            });
    }

    // Toast notification utility
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(event);
    }

    // Getters for stats and UI state
    get hasTripStats() {
        return Object.keys(this.tripStats).length > 0;
    }

    get noTripsFound() {
        return !this.isLoading && this.filteredTrips.length === 0;
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

    get upcomingTrips() {
        return this.tripStats.upcomingTrips || 0;
    }

    get progressBarStyle() {
        return `height: 8px; width: 100%; background-color: #e0e5ee; border-radius: 4px; overflow: hidden;`;
    }
}