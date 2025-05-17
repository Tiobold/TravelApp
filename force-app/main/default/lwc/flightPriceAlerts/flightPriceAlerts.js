import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

// Apex methods
import getFlightAlerts from '@salesforce/apex/FlightAlertController.getFlightAlerts';
import createFlightAlert from '@salesforce/apex/FlightAlertController.createFlightAlert';
import updateFlightAlert from '@salesforce/apex/FlightAlertController.updateFlightAlert';
import deleteFlightAlert from '@salesforce/apex/FlightAlertController.deleteFlightAlert';
import toggleFlightAlert from '@salesforce/apex/FlightAlertController.toggleFlightAlert';
import testFlightAlert from '@salesforce/apex/FlightAlertController.testFlightAlert';
import scheduleFlightMonitoring from '@salesforce/apex/FlightAlertController.scheduleFlightMonitoring';
import runFlightMonitoringNow from '@salesforce/apex/FlightAlertController.runFlightMonitoringNow';
import getFlightMonitoringStatus from '@salesforce/apex/FlightAlertController.getFlightMonitoringStatus';
import getAirportSuggestions from '@salesforce/apex/FlightAlertController.getAirportSuggestions';

export default class FlightPriceAlerts extends LightningElement {
    @api recordId; // Trip record ID
    
    // Data properties
    @track alerts = [];
    @track error;
    @track isLoading = true;
    
    // Modal states
    @track showCreateModal = false;
    @track showMonitoringModal = false;
    @track isCreating = false;
    
    // Monitoring status
    @track monitoringStatus = {};
    @track isMonitoringScheduled = false;
    @track nextRunTime = '';
    @track lastRunTime = '';
    
    // Alert form
    @track alertForm = {
        originAirport: '',
        destinationAirport: '',
        departureDate: '',
        returnDate: '',
        maxPrice: null,
        adults: 1,
        alertEmail: '',
        notificationType: 'Email'
    };
    
    // Airport suggestions
    @track originSuggestions = [];
    @track destinationSuggestions = [];
    @track showOriginSuggestions = false;
    @track showDestinationSuggestions = false;
    @track isSearchingOrigin = false;
    @track isSearchingDestination = false;
    
    // Cached results for refresh
    wiredAlertsResult;
    
    // Wire flight alerts
    @wire(getFlightAlerts, { tripId: '$recordId' })
    wiredAlerts(result) {
        this.wiredAlertsResult = result;
        this.isLoading = true;
        
        if (result.data) {
            this.alerts = result.data.map(alert => ({
                ...alert,
                // Format dates for display
                formattedDepartureDate: this.formatDate(alert.Departure_Date__c),
                formattedReturnDate: alert.Return_Date__c ? this.formatDate(alert.Return_Date__c) : null,
                formattedLastCheck: alert.Last_Check_Date__c ? this.formatDate(alert.Last_Check_Date__c) : 'Never'
            }));
            this.error = undefined;
        } else if (result.error) {
            this.error = result.error;
            this.alerts = [];
        }
        
        this.isLoading = false;
    }
    
    // Options for form fields
    get adultOptions() {
        return [
            { label: '1 Adult', value: 1 },
            { label: '2 Adults', value: 2 },
            { label: '3 Adults', value: 3 },
            { label: '4 Adults', value: 4 },
            { label: '5 Adults', value: 5 },
            { label: '6 Adults', value: 6 }
        ];
    }
    
    get notificationTypeOptions() {
        return [
            { label: 'Email Only', value: 'Email' },
            { label: 'In-App Only', value: 'In-App' },
            { label: 'Both Email & In-App', value: 'Both' }
        ];
    }
    
    // Date constraints
    get minDepartureDate() {
        return new Date().toISOString().split('T')[0];
    }
    
    get minReturnDate() {
        return this.alertForm.departureDate || this.minDepartureDate;
    }
    
    // Component state getters
    get hasAlerts() {
        return this.alerts && this.alerts.length > 0;
    }
    
    get activeAlertsCount() {
        return this.alerts.filter(alert => alert.Is_Active__c).length;
    }
    
    // Monitoring status getters
    get monitoringStatusClass() {
        return this.isMonitoringScheduled ? 'summary-value status-active' : 'summary-value status-inactive';
    }
    
    get monitoringStatusText() {
        return this.isMonitoringScheduled ? 'Scheduled' : 'Not Scheduled';
    }
    
    // Lifecycle methods
    connectedCallback() {
        // Set default departure date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.alertForm.departureDate = tomorrow.toISOString().split('T')[0];
        
        // Load monitoring status
        this.loadMonitoringStatus();
        
        // Add document click listener to close suggestions
        document.addEventListener('click', this.handleDocumentClick.bind(this));
    }
    
    disconnectedCallback() {
        document.removeEventListener('click', this.handleDocumentClick.bind(this));
    }
    
    handleDocumentClick(event) {
        const component = this.template.querySelector('.flight-price-alerts');
        if (component && !component.contains(event.target)) {
            this.clearAllSuggestions();
        }
    }
    
    // Alert management handlers
    handleToggleAlert(event) {
        const alertId = event.target.dataset.id;
        const isActive = event.target.checked;
        
        toggleFlightAlert({ alertId, isActive })
            .then(() => {
                this.showToast('Success', 
                    `Alert ${isActive ? 'activated' : 'deactivated'} successfully`, 
                    'success');
                return refreshApex(this.wiredAlertsResult);
            })
            .catch(error => {
                this.showToast('Error', 'Failed to update alert: ' + error.body.message, 'error');
                // Reset the toggle on error
                event.target.checked = !isActive;
            });
    }
    
    handleDeleteAlert(event) {
        const alertId = event.target.dataset.id;
        
        if (confirm('Are you sure you want to delete this alert?')) {
            deleteFlightAlert({ alertId })
                .then(() => {
                    this.showToast('Success', 'Alert deleted successfully', 'success');
                    return refreshApex(this.wiredAlertsResult);
                })
                .catch(error => {
                    this.showToast('Error', 'Failed to delete alert: ' + error.body.message, 'error');
                });
        }
    }
    
    handleTestAlert(event) {
        const alertId = event.target.dataset.id;
        
        testFlightAlert({ alertId })
            .then(() => {
                this.showToast('Success', 'Alert test initiated. You will be notified if flights are found.', 'success');
            })
            .catch(error => {
                this.showToast('Error', 'Failed to test alert: ' + error.body.message, 'error');
            });
    }
    
    // Modal handlers
    handleCreateAlert() {
        this.resetForm();
        this.showCreateModal = true;
    }
    
    handleCloseCreateModal() {
        this.showCreateModal = false;
        this.clearAllSuggestions();
    }
    
    handleOpenMonitoring() {
        this.loadMonitoringStatus();
        this.showMonitoringModal = true;
    }
    
    handleCloseMonitoring() {
        this.showMonitoringModal = false;
    }
    
    // Form handlers
    resetForm() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        this.alertForm = {
            originAirport: '',
            destinationAirport: '',
            departureDate: tomorrow.toISOString().split('T')[0],
            returnDate: '',
            maxPrice: null,
            adults: 1,
            alertEmail: '',
            notificationType: 'Email'
        };
        
        this.clearAllSuggestions();
    }
    
    handleOriginChange(event) {
        this.alertForm.originAirport = event.target.value;
        this.searchAirportSuggestions(event.target.value, 'origin');
    }
    
    handleDestinationChange(event) {
        this.alertForm.destinationAirport = event.target.value;
        this.searchAirportSuggestions(event.target.value, 'destination');
    }
    
    handleDepartureDateChange(event) {
        this.alertForm.departureDate = event.target.value;
    }
    
    handleReturnDateChange(event) {
        this.alertForm.returnDate = event.target.value;
    }
    
    handleMaxPriceChange(event) {
        this.alertForm.maxPrice = event.target.value ? parseFloat(event.target.value) : null;
    }
    
    handleAdultsChange(event) {
        this.alertForm.adults = parseInt(event.detail.value);
    }
    
    handleNotificationTypeChange(event) {
        this.alertForm.notificationType = event.detail.value;
    }
    
    handleEmailChange(event) {
        this.alertForm.alertEmail = event.target.value;
    }
    
    // Airport suggestions
    searchAirportSuggestions(searchTerm, type) {
        if (searchTerm.length < 2) {
            this.clearSuggestions(type);
            return;
        }
        
        // Set loading state
        if (type === 'origin') {
            this.isSearchingOrigin = true;
            this.showDestinationSuggestions = false;
        } else {
            this.isSearchingDestination = true;
            this.showOriginSuggestions = false;
        }
        
        // Search with debouncing
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            getAirportSuggestions({ searchTerm })
                .then(suggestions => {
                    if (type === 'origin') {
                        this.originSuggestions = suggestions.slice(0, 6);
                        this.showOriginSuggestions = suggestions.length > 0;
                        this.isSearchingOrigin = false;
                    } else {
                        this.destinationSuggestions = suggestions.slice(0, 6);
                        this.showDestinationSuggestions = suggestions.length > 0;
                        this.isSearchingDestination = false;
                    }
                })
                .catch(error => {
                    console.error('Error fetching airport suggestions:', error);
                    this.clearSuggestions(type);
                    if (type === 'origin') {
                        this.isSearchingOrigin = false;
                    } else {
                        this.isSearchingDestination = false;
                    }
                });
        }, 300);
    }
    
    handleAirportSuggestionClick(event) {
        event.stopPropagation();
        
        const type = event.currentTarget.dataset.type;
        const code = event.currentTarget.dataset.code;
        const city = event.currentTarget.dataset.city;
        
        const displayValue = `${code} - ${city}`;
        
        if (type === 'origin') {
            this.alertForm.originAirport = code;
            // Update the input field display
            const originInput = this.template.querySelector('lightning-input[data-field="origin"]');
            if (originInput) {
                originInput.value = displayValue;
            }
            this.clearSuggestions('origin');
        } else {
            this.alertForm.destinationAirport = code;
            // Update the input field display
            const destInput = this.template.querySelector('lightning-input[data-field="destination"]');
            if (destInput) {
                destInput.value = displayValue;
            }
            this.clearSuggestions('destination');
        }
    }
    
    clearSuggestions(type) {
        if (type === 'origin') {
            this.originSuggestions = [];
            this.showOriginSuggestions = false;
            this.isSearchingOrigin = false;
        } else {
            this.destinationSuggestions = [];
            this.showDestinationSuggestions = false;
            this.isSearchingDestination = false;
        }
    }
    
    clearAllSuggestions() {
        this.clearSuggestions('origin');
        this.clearSuggestions('destination');
    }
    
    // Save alert
    handleSaveAlert() {
        if (!this.validateForm()) {
            return;
        }
        
        this.isCreating = true;
        
        createFlightAlert({
            tripId: this.recordId,
            originAirport: this.extractAirportCode(this.alertForm.originAirport),
            destinationAirport: this.extractAirportCode(this.alertForm.destinationAirport),
            departureDate: this.alertForm.departureDate,
            returnDate: this.alertForm.returnDate || null,
            maxPrice: this.alertForm.maxPrice,
            adults: this.alertForm.adults,
            alertEmail: this.alertForm.alertEmail || null,
            notificationType: this.alertForm.notificationType
        })
        .then(() => {
            this.showToast('Success', 'Flight alert created successfully!', 'success');
            this.handleCloseCreateModal();
            return refreshApex(this.wiredAlertsResult);
        })
        .catch(error => {
            this.showToast('Error', 'Failed to create alert: ' + error.body.message, 'error');
        })
        .finally(() => {
            this.isCreating = false;
        });
    }
    
    extractAirportCode(input) {
        if (!input) return '';
        // If input contains " - ", extract the part before it
        if (input.includes(' - ')) {
            return input.split(' - ')[0].trim();
        }
        return input.trim();
    }
    
    validateForm() {
        const requiredFields = [
            { field: 'originAirport', message: 'Origin airport is required' },
            { field: 'destinationAirport', message: 'Destination airport is required' },
            { field: 'departureDate', message: 'Departure date is required' },
            { field: 'maxPrice', message: 'Maximum price is required' }
        ];
        
        for (let req of requiredFields) {
            if (!this.alertForm[req.field]) {
                this.showToast('Error', req.message, 'error');
                return false;
            }
        }
        
        if (this.extractAirportCode(this.alertForm.originAirport) === 
            this.extractAirportCode(this.alertForm.destinationAirport)) {
            this.showToast('Error', 'Origin and destination must be different', 'error');
            return false;
        }
        
        if (this.alertForm.maxPrice <= 0) {
            this.showToast('Error', 'Maximum price must be greater than 0', 'error');
            return false;
        }
        
        if (this.alertForm.returnDate && this.alertForm.returnDate <= this.alertForm.departureDate) {
            this.showToast('Error', 'Return date must be after departure date', 'error');
            return false;
        }
        
        return true;
    }
    
    // Monitoring handlers
    async loadMonitoringStatus() {
        try {
            const status = await getFlightMonitoringStatus();
            this.monitoringStatus = status;
            this.isMonitoringScheduled = status.isScheduled;
            this.nextRunTime = status.nextRun ? this.formatDateTime(status.nextRun) : 'Not scheduled';
            this.lastRunTime = status.lastRun ? this.formatDateTime(status.lastRun) : 'Never';
        } catch (error) {
            console.error('Error loading monitoring status:', error);
        }
    }
    
    handleScheduleMonitoring() {
        scheduleFlightMonitoring()
            .then(() => {
                this.showToast('Success', 'Flight monitoring scheduled successfully!', 'success');
                this.loadMonitoringStatus();
            })
            .catch(error => {
                this.showToast('Error', 'Failed to schedule monitoring: ' + error.body.message, 'error');
            });
    }
    
    handleRunMonitoringNow() {
        runFlightMonitoringNow()
            .then(() => {
                this.showToast('Success', 'Flight monitoring started. You will be notified of any results.', 'success');
                this.loadMonitoringStatus();
            })
            .catch(error => {
                this.showToast('Error', 'Failed to run monitoring: ' + error.body.message, 'error');
            });
    }
    
    // Utility methods
    formatDate(dateValue) {
        if (!dateValue) return '';
        const date = new Date(dateValue);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    formatDateTime(dateTimeValue) {
        if (!dateTimeValue) return '';
        const dateTime = new Date(dateTimeValue);
        return dateTime.toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }
}