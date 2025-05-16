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
    @track selectedFilter = 'planned';
    @track isLoading = true;
    @track error;
    @track showPlanTripModal = false;
    @track tripStats = {};
    @track activeTab = 'planned'; 
    
    wiredTripsResult;
    
    filterOptions = [
        { label: 'All Trips', value: 'all' },
        { label: 'Planned', value: 'planned' },
        { label: 'In Progress', value: 'inprogress' },
        { label: 'Completed', value: 'completed' }
    ];

    tabs = [
        { label: 'All Trips', value: 'all', count: 0 },
        { label: 'Recent', value: 'recent', count: 0 },
        { label: 'Planned', value: 'planned', count: 0 },
        { label: 'Completed', value: 'completed', count: 0 }
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
        // Tab styling code remains the same
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
        
        // More aggressive approach for progress bars
        setTimeout(() => {
            const progressBars = this.template.querySelectorAll('lightning-progress-bar');
            progressBars.forEach(bar => {
                const tripElement = bar.closest('.trip-card');
                if (tripElement) {
                    const tripId = tripElement.querySelector('[data-id]').dataset.id;
                    const trip = this.filteredTrips.find(t => t.Id === tripId);
                    
                    if (trip) {
                        // Direct DOM manipulation - find the actual progress bar value element
                        // We're using querySelector extensively to get to the actual element
                        const shadowRoot = bar.shadowRoot;
                        if (shadowRoot) {
                            const progressBarValue = shadowRoot.querySelector('.slds-progress-bar__value');
                            if (progressBarValue) {
                                // Direct style manipulation
                                if (trip.budgetPercentage > 90) {
                                    progressBarValue.style.backgroundColor = '#fe5c4c'; // Red
                                } else if (trip.budgetPercentage > 70) {
                                    progressBarValue.style.backgroundColor = '#ffb75d'; // Yellow
                                } else {
                                    progressBarValue.style.backgroundColor = '#1589ee'; // Blue
                                }
                            }
                        }
                    }
                }
            });
        }, 100); // Small delay to ensure DOM is fully rendered
    }

    processTripData(trips) {
        this.allTrips = trips.map(trip => {
            // Format dates
            const startDate = new Date(trip.Start_Date__c);
            const endDate = new Date(trip.End_Date__c);
            
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            const startDateFormatted = startDate.toLocaleDateString('en-US', options);
            const endDateFormatted = endDate.toLocaleDateString('en-US', options);
            
            // Calculate budget percentage and determine color
            const budgetPercentage = this.calculateBudgetPercentage(trip);
            let progressBarColor = '#1589ee'; // Default blue
            
            if (budgetPercentage > 90) {
                progressBarColor = '#fe5c4c'; // Red
            } else if (budgetPercentage > 70) {
                progressBarColor = '#ffb75d'; // Yellow
            }
            
            return {
                ...trip,
                isInProgress: this.isTripInProgress(trip),
                isCompleted: this.isTripCompleted(trip),
                isPlanned: this.isTripPlanned(trip),
                budgetPercentage: budgetPercentage,
                progressBarColor: progressBarColor, // Added color property
                formattedCurrency: trip.Budget__c,
                startDateFormatted: startDateFormatted,
                endDateFormatted: endDateFormatted
            };
        });
        
        this.updateTabCounts();
        this.applyFilter();
    }

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
        return ((trip.Total_Spent__c || 0) / trip.Budget__c) * 100;
    }

    updateTabCounts() {
        const recent = this.getRecentTrips(this.allTrips).length;
        const planned = this.allTrips.filter(t => t.isPlanned).length;
        const completed = this.allTrips.filter(t => t.isCompleted).length;
        
        this.tabs = [
            { label: 'Planned', value: 'planned', count: planned },
            { label: 'Recent', value: 'recent', count: recent },
            { label: 'Completed', value: 'completed', count: completed },
            { label: 'All Trips', value: 'all', count: this.allTrips.length }
        ];
    }

    getRecentTrips(trips) {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        return trips.filter(trip => {
            const endDate = new Date(trip.End_Date__c);
            return endDate >= threeMonthsAgo;
        });
    }

    handleTabChange(event) {
        this.activeTab = event.currentTarget.dataset.value;
        this.applyFilter();
        
        // Update UI after tab change
        setTimeout(() => {
            this.renderedCallback();
        }, 0);
    }

    handleFilterChange(event) {
        this.selectedFilter = event.detail.value;
        this.applyFilter();
    }

    applyFilter() {
        let filtered = [...this.allTrips];
        
        // Apply tab filter
        switch(this.activeTab) {
            case 'recent':
                filtered = this.getRecentTrips(filtered);
                break;
            case 'all':
                break;
            case 'completed':
                filtered = filtered.filter(t => t.isCompleted);
                break;
            default:
                filtered = filtered.filter(t => t.isPlanned);
                break;
        }
        
        // Apply status filter
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
        
        this.filteredTrips = filtered;
        
        // Update UI after filter change
        if (!this.isLoading) {
            setTimeout(() => {
                this.renderedCallback();
            }, 0);
        }
    }

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
        event.stopPropagation();
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
        event.stopPropagation();
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

    refreshData() {
        return refreshApex(this.wiredTripsResult);
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(event);
    }

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

    get progressBarValueStyle() {
        const progress = this.budgetProgress;
        let color = 'rgb(21, 137, 238)'; // Blue for < 70%
        
        if (progress > 90) {
            color = 'rgb(254, 92, 76)'; // Red
        } else if (progress > 70) {
            color = 'rgb(255, 183, 93)'; // Yellow
        }
        
        return `display: block; height: 100%; width: ${progress}%; background-color: ${color};`;
    }
}