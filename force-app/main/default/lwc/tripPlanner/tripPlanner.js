import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getContacts from '@salesforce/apex/TripPlannerController.getContacts';
import getTripPlannerSurveyId from '@salesforce/apex/TripPlannerController.getTripPlannerSurveyId';
import createTripWithSurvey from '@salesforce/apex/TripPlannerController.createTripWithSurvey';
import sendInvitations from '@salesforce/apex/TripPlannerController.sendInvitations';

export default class TripPlanner extends NavigationMixin(LightningElement) {
    // Use a getter/setter for isModal to avoid LWC warnings
    @api
    get isModal() {
        return this._isModal !== false;
    }
    set isModal(value) {
        this._isModal = value;
    }
    _isModal;

    // Form fields
    @track tripName = '';
    @track destinationCountry = '';
    @track startDate = '';
    @track endDate = '';
    @track budget = '';
    @track currency = 'EUR';
    @track selectedContacts = [];
    @track notes = '';

    // Component state
    @track isLoading = false;
    @track error;
    @track currentStep = 1;
    @track contacts = [];
    @track isCreating = false;
    @track showInvitationSuccess = false;
    @track surveyId;
    @track progressMessage = 'Creating trip...';

    currencyOptions = [
        { label: 'EUR - Euro', value: 'EUR' },
        { label: 'USD - US Dollar', value: 'USD' },
        { label: 'GBP - British Pound', value: 'GBP' },
        { label: 'JPY - Japanese Yen', value: 'JPY' },
        { label: 'AUD - Australian Dollar', value: 'AUD' }
    ];

    connectedCallback() {
        this.loadContacts();
        this.loadSurveyId();
    }

    async loadContacts() {
        try {
            this.isLoading = true;
            const result = await getContacts();
            this.contacts = result.map(contact => ({
                ...contact,
                isSelected: false,
                cardClass: 'contact-card'  // Add this line
            }));
            this.error = undefined;
        } catch (error) {
            this.error = error;
            this.showToast('Error', 'Failed to load contacts', 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    async loadSurveyId() {
        try {
            this.surveyId = await getTripPlannerSurveyId();
        } catch (error) {
            this.error = error;
            this.showToast('Error', 'Failed to find Trip Planner survey. Please make sure it exists.', 'error');
        }
    }

    handleFieldChange(event) {
        const field = event.target.name;
        const value = event.target.value;
        this[field] = value;
    }

    handleContactSelection(event) {
        const contactId = event.currentTarget.dataset.id;
        
        // Check if the ID is already in the selected list
        const index = this.selectedContacts.indexOf(contactId);
        
        // Update the array directly instead of manipulating through the contacts array
        if (index === -1) {
            // Not found, so add it
            this.selectedContacts.push(contactId);
        } else {
            // Found, so remove it
            this.selectedContacts.splice(index, 1);
        }
        
        // Update the visual indication
        this.contacts = this.contacts.map(contact => {
            if (contact.Id === contactId) {
                contact.isSelected = (index === -1); // true if we just added it
                contact.cardClass = contact.isSelected ? 'contact-card selected' : 'contact-card';
            }
            return contact;
        });
    }

    handleNext() {
        if (this.validateStep()) {
            this.currentStep++;
        }
    }

    handlePrevious() {
        this.currentStep--;
    }

    validateStep() {
        let isValid = true;
        let missingFields = [];

        if (this.currentStep === 1) {
            if (!this.tripName) {
                missingFields.push('Trip Name');
                isValid = false;
            }
            if (!this.destinationCountry) {
                missingFields.push('Destination Country');
                isValid = false;
            }
            if (!this.startDate) {
                missingFields.push('Start Date');
                isValid = false;
            }
            if (!this.endDate) {
                missingFields.push('End Date');
                isValid = false;
            }
            if (!this.budget) {
                missingFields.push('Budget');
                isValid = false;
            }
        }

        if (!isValid) {
            this.showToast('Error', 'Please fill out required fields: ' + missingFields.join(', '), 'error');
        }

        return isValid;
    }

    async handleCreateTrip() {
        if (!this.validateStep()) return;

        try {
            this.isCreating = true;
            this.progressMessage = 'Creating your trip...';

            const tripData = {
                name: this.tripName,
                destination: this.destinationCountry,
                startDate: this.startDate,
                endDate: this.endDate,
                budget: parseFloat(this.budget),
                currency: this.currency,
                notes: this.notes,
                selectedContacts: this.selectedContacts,
                surveyId: this.surveyId
            };

            const result = await createTripWithSurvey({tripData: JSON.stringify(tripData)});

            if (result.success) {
                // If we have contacts to invite
                if (this.selectedContacts.length > 0) {
                    this.progressMessage = 'Sending invitations...';
                    await this.sendTripInvitations(result.tripId, result.surveyId, result.surveyInvitationId);
                } else {
                    this.navigateToTrip(result.tripId);
                }
            } else {
                throw new Error(result.error || 'Failed to create trip');
            }
        } catch (error) {
            this.error = error;
            this.showToast('Error', error.message || 'Failed to create trip', 'error');
            this.isCreating = false;
        }
    }

    async sendTripInvitations(tripId, surveyId, surveyInvitationId) {
        try {
            const result = await sendInvitations({
                tripId: tripId,
                surveyId: surveyId,
                surveyInvitationId: surveyInvitationId,
                contactIds: this.selectedContacts
            });

            if (result.success) {
                this.showInvitationSuccess = true;
                // Wait 2 seconds before navigating
                setTimeout(() => {
                    this.navigateToTrip(tripId);
                }, 2000);
            } else {
                throw new Error(result.error || 'Failed to send invitations');
            }
        } catch (error) {
            this.error = error;
            this.showToast('Error', error.message || 'Failed to send invitations', 'error');
            this.isCreating = false;
        }
    }

    navigateToTrip(tripId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: tripId,
                objectApiName: 'Trip__c',
                actionName: 'view'
            }
        });
    }

    handleClose() {
        // Fire close event for modal usage
        this.dispatchEvent(new CustomEvent('close'));
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }

    get modalClass() {
        return `slds-modal ${this.isModal ? 'slds-fade-in-open' : 'slds-hide'}`;
    }

    get backdropClass() {
        return `slds-backdrop ${this.isModal ? 'slds-backdrop_open' : 'slds-hide'}`;
    }

    get containerClass() {
        return this.isModal ? 'slds-modal__container' : 'trip-planner-container';
    }

    get tripDuration() {
        if (this.startDate && this.endDate) {
            const start = new Date(this.startDate);
            const end = new Date(this.endDate);
            const diffTime = end - start;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays + (diffDays === 1 ? ' day' : ' days');
        }
        return null;
    }

    get isStep1() {
        return this.currentStep === 1;
    }

    get isStep2() {
        return this.currentStep === 2;
    }

    get selectedContactCount() {
        return this.selectedContacts.length;
    }
    
    get contactLabel() {
        return this.selectedContactCount === 1 ? 'contact' : 'contacts';  
    }

    get showProgress() {
        return this.isCreating;
    }
}