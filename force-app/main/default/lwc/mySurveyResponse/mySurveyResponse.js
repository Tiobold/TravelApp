import { LightningElement, api, track } from 'lwc';
import getMySurveyResponse from '@salesforce/apex/TripAccessController.getMySurveyResponse';

export default class MySurveyResponse extends LightningElement {
    @api token;
    
    @track isLoading = true;
    @track error = '';
    @track surveyResponse = null;
    @track responseDate = null;
    @track formattedResponses = [];
    
    connectedCallback() {
        if (this.token) {
            this.loadResponse();
        } else {
            this.error = 'No token provided to load survey response';
            this.isLoading = false;
        }
    }
    
    @api
    refreshData(newToken) {
        if (newToken) {
            this.token = newToken;
        }
        
        if (this.token) {
            this.loadResponse();
        }
    }
    
    loadResponse() {
        this.isLoading = true;
        this.error = '';
        
        getMySurveyResponse({ token: this.token })
            .then(result => {
                if (result.success) {
                    this.surveyResponse = result.response;
                    this.responseDate = result.completedDate ? new Date(result.completedDate) : null;
                    this.processResponseData();
                } else {
                    this.error = result.error || 'Error loading survey response';
                }
            })
            .catch(error => {
                this.error = error.message || 'Unknown error loading survey response';
                console.error('Error loading survey response:', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
    processResponseData() {
        if (!this.surveyResponse) {
            this.formattedResponses = [];
            return;
        }
        
        // Format each response item
        const responseItems = [];
        
        // Handle "wantsToParticipate"
        if (this.surveyResponse.hasOwnProperty('wantsToParticipate')) {
            responseItems.push({
                question: 'Are you interested in participating in this trip?',
                answer: this.formatYesNo(this.surveyResponse.wantsToParticipate)
            });
        }
        
        // Handle "preferredDuration"
        if (this.surveyResponse.hasOwnProperty('preferredDuration')) {
            responseItems.push({
                question: 'For how long would you be able to travel?',
                answer: this.surveyResponse.preferredDuration
            });
        }
        
        // Handle "budget"
        if (this.surveyResponse.hasOwnProperty('budget')) {
            responseItems.push({
                question: 'What is your budget (in Euro)?',
                answer: this.formatCurrency(this.surveyResponse.budget)
            });
        }
        
        // Handle "earliestDepartureDate"
        if (this.surveyResponse.hasOwnProperty('earliestDepartureDate')) {
            responseItems.push({
                question: 'What is your earliest available departure date?',
                answer: this.formatDate(this.surveyResponse.earliestDepartureDate)
            });
        }
        
        // Handle "latestReturnDate"
        if (this.surveyResponse.hasOwnProperty('latestReturnDate')) {
            responseItems.push({
                question: 'What is the latest date you need to be back home?',
                answer: this.formatDate(this.surveyResponse.latestReturnDate)
            });
        }
        
        // Handle "additionalNotes"
        if (this.surveyResponse.hasOwnProperty('additionalNotes')) {
            responseItems.push({
                question: 'Any additional notes or special requirements?',
                answer: this.surveyResponse.additionalNotes || 'None provided'
            });
        }
        
        this.formattedResponses = responseItems;
    }
    
    formatYesNo(value) {
        if (value === true || value === 'true' || value === 'Yes' || value === 'yes') {
            return 'Yes';
        }
        return 'No';
    }
    
    formatDate(dateString) {
        if (!dateString) return 'Not specified';
        
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }).format(date);
        } catch (e) {
            console.error('Error formatting date:', e);
            return dateString;
        }
    }
    
    formatCurrency(value) {
        if (!value) return 'Not specified';
        
        try {
            return new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'EUR',
                maximumFractionDigits: 0
            }).format(value);
        } catch (e) {
            console.error('Error formatting currency:', e);
            return value;
        }
    }
    
    get hasResponse() {
        return this.formattedResponses && this.formattedResponses.length > 0;
    }
    
    get formattedResponseDate() {
        if (!this.responseDate) return '';
        
        try {
            return new Intl.DateTimeFormat('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(this.responseDate);
        } catch (e) {
            console.error('Error formatting response date:', e);
            return '';
        }
    }
}