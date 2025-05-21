import { LightningElement, track } from 'lwc';
import validateTripToken from '@salesforce/apex/TripAccessController.validateTripToken';

export default class TripMapSite extends LightningElement {
    @track isLoading = true;
    @track error = '';
    @track accessInfo = null;
    @track tripToken = '';
    @track isDesignMode = false;
    
    // Child components references
    companionsComponent;
    analyticsComponent;
    surveyResponseComponent;
    
    connectedCallback() {
        console.log('TripMapSite component connected');
        
        // Check if we're in Experience Builder design mode
        this.checkDesignMode();
        
        // If in design mode, skip validation
        if (this.isDesignMode) {
            this.isLoading = false;
            return;
        }
        
        // Parse token from URL
        this.extractTokenFromUrl();
        
        if (this.tripToken) {
            this.validateAccess();
        } else {
            this.error = 'No access token found in URL. Please check the link you received.';
            this.isLoading = false;
        }
    }
    
    renderedCallback() {
        // Get references to child components
        if (!this.companionsComponent) {
            this.companionsComponent = this.template.querySelector('c-trip-companions-site');
        }
        if (!this.analyticsComponent) {
            this.analyticsComponent = this.template.querySelector('c-trip-survey-analytics-site');
        }
        if (!this.surveyResponseComponent) {
            this.surveyResponseComponent = this.template.querySelector('c-my-survey-response');
        }
    }
    
    checkDesignMode() {
        // Check for Experience Builder environment
        try {
            this.isDesignMode = (
                window.location.href.indexOf('sitepreview') > -1 || 
                window.location.href.indexOf('livepreview') > -1 || 
                window.location.href.indexOf('live-preview') > -1 ||
                window.location.href.indexOf('site-builder') > -1 ||
                document.documentElement.classList.contains('siteforce-Builder')
            );
            
            console.log('Design mode detected:', this.isDesignMode);
        } catch (err) {
            console.log('Error detecting design mode:', err);
            this.isDesignMode = false;
        }
    }
    
    extractTokenFromUrl() {
        try {
            // First try from URLSearchParams
            const urlParams = new URLSearchParams(window.location.search);
            this.tripToken = urlParams.get('token') || '';
            
            // If no token in URL params, try to get from hash
            if (!this.tripToken && window.location.hash) {
                const hash = window.location.hash;
                if (hash && hash.includes('token=')) {
                    const hashParams = new URLSearchParams(hash.substring(1));
                    this.tripToken = hashParams.get('token') || '';
                }
            }
            
console.log('Extracted token:', this.tripToken ? 'Found' : 'Not found');
        } catch (err) {
            console.error('Error extracting token from URL:', err);
            this.error = 'Unable to process access link. Please try again.';
            this.isLoading = false;
        }
    }
    
    validateAccess() {
        if (!this.tripToken) {
            this.error = 'Access token is missing.';
            this.isLoading = false;
            return;
        }
        
        console.log('Validating access with token:', this.tripToken);
        
        validateTripToken({ token: this.tripToken })
            .then(result => {
                console.log('Access validation result received:', JSON.stringify(result));
                
                if (result && result.success) {
                    console.log('Access info:', JSON.stringify(result.accessInfo));
                    this.accessInfo = result.accessInfo;
                    this.error = '';
                    
                    // Update child components
                    this.updateChildComponents();
                } else {
                    this.error = (result && result.error) ? result.error : 'Invalid access link';
                    console.error('Error in access validation:', this.error);
                }
            })
            .catch(err => {
                console.error('Error in validateTripToken:', err);
                this.error = 'Failed to validate access. Please try again later.';
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
    updateChildComponents() {
        // Use setTimeout to ensure components are fully rendered
        setTimeout(() => {
            if (this.companionsComponent) {
                this.companionsComponent.refreshData(this.tripToken);
            }
            
            if (this.analyticsComponent && this.isConfirmed) {
                this.analyticsComponent.refreshData(this.tripToken);
            }
            
            if (this.surveyResponseComponent) {
                this.surveyResponseComponent.refreshData(this.tripToken);
            }
        }, 100);
    }
    
    // Computed properties
    get showTripDetails() {
        return !this.isLoading && !this.error && this.accessInfo;
    }
    
    get isReadOnly() {
        return this.accessInfo && !this.accessInfo.canEdit;
    }
    
    get isInterested() {
        return this.accessInfo && this.accessInfo.status === 'Interested';
    }
    
    get isConfirmed() {
        return this.accessInfo && this.accessInfo.status === 'Confirmed';
    }
    
    get statusClass() {
        return this.accessInfo ? `status-badge ${this.accessInfo.status.toLowerCase()}` : '';
    }
}