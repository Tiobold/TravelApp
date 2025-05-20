import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import analyzeTripResponses from '@salesforce/apex/TripPlannerController.analyzeTripResponses';

export default class TripSurveyAnalytics extends LightningElement {
    @api tripId;
    @api recordId; // For flexibility - will use this if tripId is not provided
    
    @track isLoading = false;
    @track error;
    @track analysisData;
    @track showDetails = false;
    
    // Tracked metrics
    @track responseRate = 0;
    @track participationRate = 0;
    @track individualResponses = [];
    @track isLoadingResponses = false;
    
    // Available trip dates
    @track optimalStartDate;
    @track optimalEndDate;
    @track formattedStartDate;
    @track formattedEndDate;
    
    // Budget info
    @track averageBudget;
    @track medianBudget;
    @track minBudget;
    @track maxBudget;
    @track budgetSpread;
    @track budgetSpreadPercentage;
    
    // Duration preferences
    @track recommendedDuration;
    @track durationPreferences = [];
    
    connectedCallback() {
        this.loadAnalysisData();
    }
    
    loadAnalysisData() {
        this.isLoading = true;
        this.error = null;
        
        // Use tripId if provided, otherwise use recordId
        const idToUse = this.tripId || this.recordId;
        
        if (!idToUse) {
            this.error = 'Trip ID is required to analyze survey responses.';
            this.isLoading = false;
            return;
        }
        
        analyzeTripResponses({ tripId: idToUse })
            .then(result => {
                console.log('Analysis data received:', JSON.stringify(result));
                this.analysisData = result;
                this.processAnalysisData(result);
            })
            .catch(error => {
                console.error('Error analyzing trip responses:', error);
                this.error = 'Failed to analyze trip responses. ' + 
                            (error.body ? error.body.message : error.message);
                this.showToast('Error', this.error, 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
    processAnalysisData(data) {
        if (!data) return;
        
        // Calculate response and participation rates
        this.responseRate = data.totalInvited > 0 ? 
            Math.round((data.totalResponded / data.totalInvited) * 100) : 0;
            
        this.participationRate = data.totalResponded > 0 ? 
            Math.round((data.interestedCount / data.totalResponded) * 100) : 0;
        
        // Format dates
        if (data.optimalStartDate) {
            this.optimalStartDate = data.optimalStartDate;
            this.formattedStartDate = this.formatDate(data.optimalStartDate);
        }
        
        if (data.optimalEndDate) {
            this.optimalEndDate = data.optimalEndDate;
            this.formattedEndDate = this.formatDate(data.optimalEndDate);
        }
        
        // Process budget information
        if (data.averageBudget) {
            this.averageBudget = this.formatCurrency(data.averageBudget);
            this.medianBudget = this.formatCurrency(data.medianBudget);
            this.minBudget = this.formatCurrency(data.minBudget);
            this.maxBudget = this.formatCurrency(data.maxBudget);
            
            // Calculate budget spread
            this.budgetSpread = this.formatCurrency(data.maxBudget - data.minBudget);
            this.budgetSpreadPercentage = data.averageBudget > 0 ? 
                Math.round(((data.maxBudget - data.minBudget) / data.averageBudget) * 100) : 0;
        }
        
        // Trip duration
        this.recommendedDuration = data.recommendedDuration || 'Not enough data';
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short', 
            day: 'numeric', 
            year: 'numeric'
        }).format(date);
    }
    
    formatCurrency(value) {
        if (value === undefined || value === null) return '-';
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'EUR',
            maximumFractionDigits: 0
        }).format(value);
    }
    
    getDurationClass(duration) {
        if (duration === this.recommendedDuration) {
            return 'slds-pill slds-pill_brand';
        }
        return 'slds-pill';
    }
    
    getBudgetClass(type) {
        switch (type) {
            case 'low':
                return 'budget-pill budget-low';
            case 'medium':
                return 'budget-pill budget-medium';
            case 'high':
                return 'budget-pill budget-high';
            default:
                return 'budget-pill';
        }
    }
    
    calculateTripDuration() {
        if (!this.optimalStartDate || !this.optimalEndDate) return 'N/A';
        
        const start = new Date(this.optimalStartDate);
        const end = new Date(this.optimalEndDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end days
        
        return diffDays + (diffDays === 1 ? ' day' : ' days');
    }
    
    get hasDates() {
        return this.optimalStartDate && this.optimalEndDate;
    }
    
    get dateRange() {
        if (!this.hasDates) return 'Not enough date preferences collected';
        return `${this.formattedStartDate} - ${this.formattedEndDate}`;
    }
    
    get tripDuration() {
        return this.calculateTripDuration();
    }
    
    get hasBudgetData() {
        return this.averageBudget && this.averageBudget !== '-';
    }
    
    get responseMetrics() {
        return [
            { 
                label: 'Total Invited', 
                value: this.analysisData?.totalInvited || 0,
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
    
    handleRefresh() {
        this.loadAnalysisData();
    }
    
    toggleDetails() {
        if (!this.showDetails && this.individualResponses.length === 0) {
            // Only load responses the first time we expand the details
            this.loadIndividualResponses();
        } else {
            // Just toggle visibility if already loaded
            this.showDetails = !this.showDetails;
        }
    }

    loadIndividualResponses() {
        this.isLoadingResponses = true;
        
        // Use tripId if provided, otherwise use recordId
        const idToUse = this.tripId || this.recordId;
        
        if (!idToUse) {
            this.error = 'Trip ID is required to load responses.';
            this.isLoadingResponses = false;
            return;
        }
        
        // Create a new method in your Apex controller to get individual responses
        getIndividualResponses({ tripId: idToUse })
            .then(result => {
                console.log('Individual responses received:', JSON.stringify(result));
                this.individualResponses = this.processIndividualResponses(result);
                this.showDetails = true;
            })
            .catch(error => {
                console.error('Error loading individual responses:', error);
                this.error = 'Failed to load individual responses. ' + 
                            (error.body ? error.body.message : error.message);
                this.showToast('Error', this.error, 'error');
            })
            .finally(() => {
                this.isLoadingResponses = false;
            });
    }

    processIndividualResponses(responses) {
        if (!responses) return [];
        
        return responses.map(response => {
            // Parse JSON responses if they're stored as strings
            let parsedResponses = {};
            
            if (response.surveyResponse && typeof response.surveyResponse === 'string') {
                try {
                    parsedResponses = JSON.parse(response.surveyResponse);
                } catch (e) {
                    console.error('Error parsing response JSON:', e);
                    parsedResponses = { error: 'Could not parse response data' };
                }
            } else if (response.surveyResponse) {
                parsedResponses = response.surveyResponse;
            }
            
            // Format each response for display
            return {
                id: response.id,
                name: response.name,
                status: response.status,
                completedDate: this.formatDatetime(response.completedDate),
                parsedResponses: parsedResponses,
                responseItems: this.convertToResponseItems(parsedResponses)
            };
        });
    }
    
    
    showToast(title, message, variant) {
        if (!message) message = ''; // Ensure message is not undefined
        
        try {
            const event = new ShowToastEvent({
                title: title || '',
                message: message,
                variant: variant || 'info'
            });
            this.dispatchEvent(event);
        } catch (err) {
            console.error('Error showing toast:', err);
        }
    }
}