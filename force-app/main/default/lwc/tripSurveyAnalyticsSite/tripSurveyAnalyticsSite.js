import { LightningElement, api, track } from 'lwc';
import getTripSurveyAnalyticsForExternal from '@salesforce/apex/TripAccessController.getTripSurveyAnalyticsForExternal';

export default class TripSurveyAnalyticsSite extends LightningElement {
    @api token;
    
    @track isLoading = true;
    @track error = '';
    @track analyticsData = null;
    
    // Tracked metrics
    @track totalInvited = 0;
    @track totalResponded = 0;
    @track responseRate = 0;
    @track participationRate = 0;
    
    // Date metrics
    @track optimalStartDate;
    @track optimalEndDate;
    @track formattedStartDate = '';
    @track formattedEndDate = '';
    @track recommendedDuration = '';
    
    // Budget metrics
    @track averageBudget = '-';
    @track medianBudget = '-';
    @track minBudget = '-';
    @track maxBudget = '-';
    
    connectedCallback() {
        if (this.token) {
            this.loadAnalytics();
        } else {
            this.error = 'No token provided to load analytics';
            this.isLoading = false;
        }
    }
    
    @api
    refreshData(newToken) {
        if (newToken) {
            this.token = newToken;
        }
        
        if (this.token) {
            this.loadAnalytics();
        }
    }
    
    loadAnalytics() {
        this.isLoading = true;
        this.error = '';
        
        getTripSurveyAnalyticsForExternal({ token: this.token })
            .then(result => {
                if (result.success && result.analyticsData) {
                    this.analyticsData = result.analyticsData;
                    this.processAnalyticsData();
                } else {
                    this.error = result.error || 'Error loading analytics data';
                }
            })
            .catch(error => {
                this.error = error.message || 'Unknown error loading analytics';
                console.error('Error loading analytics:', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
    processAnalyticsData() {
        const data = this.analyticsData;
        
        if (!data) return;
        
        // Process basic metrics
        this.totalInvited = data.totalInvited || 0;
        this.totalResponded = data.totalResponded || 0;
        this.interestedCount = data.interestedCount || 0;
        this.declinedCount = data.declinedCount || 0;
        
        // Calculate percentages
        this.responseRate = this.totalInvited > 0 ? 
            Math.round((this.totalResponded / this.totalInvited) * 100) : 0;
            
        this.participationRate = this.totalResponded > 0 ? 
            Math.round((this.interestedCount / this.totalResponded) * 100) : 0;
        
        // Process dates
        if (data.optimalStartDate) {
            this.optimalStartDate = new Date(data.optimalStartDate);
            this.formattedStartDate = this.formatDate(this.optimalStartDate);
        }
        
        if (data.optimalEndDate) {
            this.optimalEndDate = new Date(data.optimalEndDate);
            this.formattedEndDate = this.formatDate(this.optimalEndDate);
        }
        
        // Process budget data
        if (data.averageBudget) {
            this.averageBudget = this.formatCurrency(data.averageBudget);
            this.medianBudget = this.formatCurrency(data.medianBudget);
            this.minBudget = this.formatCurrency(data.minBudget);
            this.maxBudget = this.formatCurrency(data.maxBudget);
        }
        
        // Process recommended duration
        this.recommendedDuration = data.recommendedDuration || 'Not enough data';
    }
    
    formatDate(dateObj) {
        if (!dateObj) return '';
        
        try {
            return new Intl.DateTimeFormat('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            }).format(dateObj);
        } catch (e) {
            console.error('Error formatting date:', e);
            return '';
        }
    }
    
    formatCurrency(value) {
        if (value === undefined || value === null) return '-';
        
        try {
            return new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'EUR',
                maximumFractionDigits: 0
            }).format(value);
        } catch (e) {
            console.error('Error formatting currency:', e);
            return '-';
        }
    }
    
    calculateTripDuration() {
        if (!this.optimalStartDate || !this.optimalEndDate) {
            return 'N/A';
        }
        
        try {
            const diffTime = Math.abs(this.optimalEndDate - this.optimalStartDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end days
            
            return diffDays + (diffDays === 1 ? ' day' : ' days');
        } catch (e) {
            console.error('Error calculating trip duration:', e);
            return 'N/A';
        }
    }
    
    // Computed properties
    get tripDuration() {
        return this.calculateTripDuration();
    }
    
    get hasDates() {
        return this.formattedStartDate && this.formattedEndDate;
    }
    
    get hasBudgetData() {
        return this.averageBudget !== '-';
    }
    
    get responseMetrics() {
        return [
            { 
                label: 'Total Invited', 
                value: this.totalInvited,
                icon: 'utility:user'
            },
            { 
                label: 'Response Rate', 
                value: this.responseRate + '%',
                icon: 'utility:reply'
            },
            { 
                label: 'Participation Rate', 
                value: this.participationRate + '%',
                icon: 'utility:check'
            }
        ];
    }
}