import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getTripCompanions from '@salesforce/apex/TripCompanionController.getTripCompanions';
import getContacts from '@salesforce/apex/TripPlannerController.getContacts';
import sendInvitations from '@salesforce/apex/TripPlannerController.sendInvitations';
import getTripPlannerSurveyId from '@salesforce/apex/TripPlannerController.getTripPlannerSurveyId';
import getCompanionDetails from '@salesforce/apex/TripCompanionController.getCompanionDetails';
import getCompanionExpenses from '@salesforce/apex/TripCompanionController.getCompanionExpenses';
import getSharedTrips from '@salesforce/apex/TripCompanionController.getSharedTrips';

export default class TripCompanions extends LightningElement {
    @api recordId; // Trip__c record Id
    
    // Constants
    currentUserContactId = '003gK000001ln7xQAA'; // Your contact ID
    
    // Main data
    confirmedCompanions = [];
    invitedCompanions = [];
    currentUserCompanion = null;
    
    // Component states
    isLoading = true;
    error;
    
    // Modal states
    showInviteModal = false;
    isContactsLoading = false;
    showProgressModal = false;
    isSending = false;
    showInvitationSuccess = false;
    
    // Companion details modal states
    showCompanionDetailsModal = false;
    isCompanionDetailsLoading = false;
    selectedCompanion = null;
    sharedTrips = [];
    companionExpenses = [];
    tripTotalExpenses = 0;
    
    // Invitation data
    allContacts = [];
    filteredContacts = [];
    selectedContacts = [];
    searchTerm = '';
    surveyId;
    progressMessage = 'Sending invitations...';
    
    // Pagination settings
    pageSize = 20;
    currentPage = 1;
    
    // Cache wired result for refreshing
    wiredCompanionsResult;
    
    @wire(getTripCompanions, { tripId: '$recordId' })
    wiredCompanions(result) {
        this.wiredCompanionsResult = result;
        const { error, data } = result;
        
        this.isLoading = true;
        if (data) {
            console.log('Data received:', JSON.stringify(data));
            
            // Handle potential error from Apex
            if (data.error) {
                this.error = 'Error loading companions: ' + data.error;
                this.confirmedCompanions = [];
                this.invitedCompanions = [];
                this.currentUserCompanion = null;
                this.isLoading = false;
                return;
            }
            
            // Process all companions and filter out current user
            const allConfirmed = [];
            const allInvited = [];
            
            // Process confirmed companions
            if (data.confirmed && Array.isArray(data.confirmed)) {
                data.confirmed.forEach(companion => {
                    // Create the base companion object with photo and key
                    const enrichedCompanion = {
                        ...companion,
                        photoUrl: companion.PhotoURL || '/img/icon/t4v35/standard/user_120.png',
                        key: companion.Id
                    };
                    
                    // Check if this is the current user
                    if (companion.ContactId === this.currentUserContactId) {
                        this.currentUserCompanion = enrichedCompanion;
                    } else {
                        allConfirmed.push(enrichedCompanion);
                    }
                });
                
                this.confirmedCompanions = allConfirmed;
            } else {
                console.log('Confirmed companions data is not an array:', data.confirmed);
                this.confirmedCompanions = [];
            }
            
            // Process invited companions and filter out current user
            if (data.invited && Array.isArray(data.invited)) {
                data.invited.forEach(companion => {
                    // Create the base companion object
                    const enrichedCompanion = {
                        ...companion,
                        photoUrl: companion.PhotoURL || '/img/icon/t4v35/standard/user_120.png',
                        key: companion.Id
                    };
                    
                    // Check if this is the current user (shouldn't normally happen)
                    if (companion.ContactId === this.currentUserContactId) {
                        // If user is in invited list, update the current user object
                        this.currentUserCompanion = enrichedCompanion;
                    } else {
                        allInvited.push(enrichedCompanion);
                    }
                });
                
                this.invitedCompanions = allInvited;
            } else {
                console.log('Invited companions data is not an array:', data.invited);
                this.invitedCompanions = [];
            }
            
            this.error = undefined;
            this.isLoading = false;
        } else if (error) {
            this.error = 'Error loading companions: ' + error.body.message;
            this.confirmedCompanions = [];
            this.invitedCompanions = [];
            this.currentUserCompanion = null;
            this.isLoading = false;
            console.error('Error fetching trip companions:', error);
        }
    }
    
    // Load Survey ID for invitation process
    async loadSurveyId() {
        try {
            this.surveyId = await getTripPlannerSurveyId();
        } catch (error) {
            console.error('Error loading survey ID:', error);
            this.showToast('Error', 'Failed to find Trip Planner survey. Please make sure it exists.', 'error');
        }
    }
    
    // Load contacts for invitation modal
    async loadContacts() {
        try {
            this.isContactsLoading = true;
            this.error = undefined;
            
            // Get contacts from apex
            const contacts = await getContacts();
            
            // Map and prepare contacts for display
            this.allContacts = contacts.map(contact => ({
                ...contact,
                isSelected: false,
                cardClass: 'contact-card'
            }));
            
            // Apply initial filter (shows first page)
            this.applyContactFilter();
            
        } catch (error) {
            console.error('Error loading contacts:', error);
            this.error = 'Failed to load contacts: ' + (error.body?.message || error.message || 'Unknown error');
            this.allContacts = [];
            this.filteredContacts = [];
        } finally {
            this.isContactsLoading = false;
        }
    }
    
    // Apply filter to contacts based on search term
    applyContactFilter() {
        // First filter by search term
        let filteredResults = this.allContacts;
        
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filteredResults = this.allContacts.filter(contact => 
                (contact.Name && contact.Name.toLowerCase().includes(term)) || 
                (contact.Email && contact.Email.toLowerCase().includes(term))
            );
        }
        
        // Only show first page of results
        const startIndex = 0;
        const endIndex = this.pageSize * this.currentPage;
        
        this.filteredContacts = filteredResults.slice(startIndex, endIndex);
    }
    
    // Handle search term change
    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        this.currentPage = 1; // Reset to first page
        this.applyContactFilter();
    }
    
    // Handle enter key on search field
    handleSearchKeyPress(event) {
        if (event.keyCode === 13) { // Enter key
            event.preventDefault();
            this.searchTerm = event.target.value;
            this.currentPage = 1; // Reset to first page
            this.applyContactFilter();
        }
    }
    
    // Load more results (pagination)
    handleLoadMore() {
        this.currentPage++;
        this.applyContactFilter();
    }
    
    // Handle contact selection
    handleContactSelection(event) {
        // Stop event propagation 
        event.stopPropagation();
        
        // Get the contact ID from data attribute
        const contactId = event.currentTarget.dataset.id;
        console.log('Selected contact ID:', contactId);
        
        // Find the contact in the master list and toggle selection
        this.allContacts = this.allContacts.map(contact => {
            if (contact.Id === contactId) {
                // Toggle selection state
                const newIsSelected = !contact.isSelected;
                console.log('Toggling selection for', contact.Name, 'to', newIsSelected);
                
                // Update contact properties
                return {
                    ...contact,
                    isSelected: newIsSelected,
                    cardClass: newIsSelected ? 'contact-card selected' : 'contact-card'
                };
            }
            return contact;
        });
        
        // Update the filtered view as well
        this.filteredContacts = this.filteredContacts.map(contact => {
            if (contact.Id === contactId) {
                const newIsSelected = !contact.isSelected;
                return {
                    ...contact,
                    isSelected: newIsSelected,
                    cardClass: newIsSelected ? 'contact-card selected' : 'contact-card'
                };
            }
            return contact;
        });
        
        // Update selected contacts list
        this.selectedContacts = this.allContacts
            .filter(contact => contact.isSelected)
            .map(contact => contact.Id);
            
        console.log('Selected contacts:', this.selectedContacts);
    }
    
    // Send invitations to selected contacts
    async handleSendInvitations() {
        if (this.selectedContacts.length === 0) {
            this.showToast('Info', 'Please select at least one contact to invite', 'info');
            return;
        }
        
        this.showProgressModal = true;
        this.isSending = true;
        this.showInvitationSuccess = false;
        
        try {
            // Send invitations using the TripPlannerController
            const result = await sendInvitations({
                tripId: this.recordId,
                surveyId: this.surveyId,
                surveyInvitationId: null, // This comes from createTripWithSurvey which we're not using here
                contactIds: this.selectedContacts
            });
            
            if (result.success) {
                // Show success screen
                this.showInvitationSuccess = true;
                this.isSending = false;
                
                // Wait 1 second and refresh data
                setTimeout(() => {
                    this.refreshCompanionsData();
                }, 1000);
            } else {
                throw new Error(result.error || 'Failed to send invitations');
            }
        } catch (error) {
            console.error('Error sending invitations:', error);
            this.showProgressModal = false;
            this.showToast('Error', 'Failed to send invitations: ' + (error.body?.message || error.message || 'Unknown error'), 'error');
        } finally {
            this.isSending = false;
        }
    }
    
    // Refresh companions data
    refreshCompanionsData() {
        return refreshApex(this.wiredCompanionsResult);
    }
    
    // Modal handling
    handleOpenInviteModal() {
        this.showInviteModal = true;
        this.selectedContacts = []; // Reset selections
        this.loadSurveyId();
        this.loadContacts();
    }
    
    handleCloseInviteModal() {
        this.showInviteModal = false;
    }
    
    handleCloseSuccessModal() {
        this.showProgressModal = false;
        this.showInviteModal = false; // Also close the invite modal
    }
    
    // Handle companion card click to show details
    handleCompanionClick(event) {
        event.stopPropagation(); // Prevent event bubbling
        const companionId = event.currentTarget.dataset.id;
        this.openCompanionDetails(companionId);
    }
    
    // Open companion details modal
    async openCompanionDetails(companionId) {
        this.showCompanionDetailsModal = true;
        this.isCompanionDetailsLoading = true;
        
        try {
            // Find companion in our existing data
            const companion = this.currentUserCompanion && this.currentUserCompanion.Id === companionId
                ? this.currentUserCompanion
                : [...this.confirmedCompanions, ...this.invitedCompanions].find(c => c.Id === companionId);
            
            if (!companion) {
                throw new Error('Companion not found');
            }
            
            // Check if this is the current user's profile
            this.isCurrentUserProfile = companion.ContactId === this.currentUserContactId;
            
            // Load additional companion details from Apex
            this.loadCompanionDetails(companionId);
            
            // Get expenses and shared trips
            await Promise.all([
                this.loadCompanionExpenses(companionId),
                this.loadSharedTrips(companionId)
            ]);
            
        } catch (error) {
            console.error('Error opening companion details:', error);
            this.showToast('Error', 'Failed to load companion details: ' + (error.message || 'Unknown error'), 'error');
            this.handleCloseCompanionDetails();
        }
    }
    
    // Load companion details
    async loadCompanionDetails(companionId) {
        try {
            // Get companion details from server
            const details = await getCompanionDetails({ companionId });
            
            if (details) {
                // Set up email and phone links
                const emailLink = details.Email ? `mailto:${details.Email}` : '';
                const phoneLink = details.Phone ? `tel:${details.Phone}` : '';
                
                // Get first name for display
                const nameParts = details.Name ? details.Name.split(' ') : [''];
                const firstName = nameParts[0];
                
                // Determine status class
                let statusClass = 'profile-status ';
                
                if (details.ContactId === this.currentUserContactId) {
                    statusClass += 'owner';
                } else {
                    statusClass += details.Status === 'Confirmed' ? 'confirmed' : 'invited';
                }
                
                // Prepare selectedCompanion object with all necessary details
                this.selectedCompanion = {
                    ...details,
                    photoUrl: details.PhotoURL || '/img/icon/t4v35/standard/user_120.png',
                    emailLink,
                    phoneLink,
                    FirstName: firstName,
                    statusClass
                };
            }
        } catch (error) {
            console.error('Error loading companion details:', error);
            throw error;
        } finally {
            this.isCompanionDetailsLoading = false;
        }
    }
    
    // Load companion expenses
    async loadCompanionExpenses(companionId) {
        try {
            // Get companion expenses
            const result = await getCompanionExpenses({ 
                companionId, 
                tripId: this.recordId 
            });
            
            this.companionExpenses = result.expenses || [];
            this.tripTotalExpenses = result.tripTotal || 0;
        } catch (error) {
            console.error('Error loading companion expenses:', error);
            this.companionExpenses = [];
            this.tripTotalExpenses = 0;
        }
    }
    
    // Load shared trips
    async loadSharedTrips(companionId) {
        try {
            // Get shared trips
            const trips = await getSharedTrips({ companionId });
            
            this.sharedTrips = trips.map(trip => ({
                ...trip,
                formattedDate: this.formatDate(trip.Start_Date__c)
            }));
        } catch (error) {
            console.error('Error loading shared trips:', error);
            this.sharedTrips = [];
        }
    }
    
    // Format date helper
    formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Intl.DateTimeFormat('en-US', options).format(date);
    }
    
    // Close companion details modal
    handleCloseCompanionDetails() {
        this.showCompanionDetailsModal = false;
        this.selectedCompanion = null;
        this.sharedTrips = [];
        this.companionExpenses = [];
    }
    
    // Toast notification utility
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
    
    // --- Getters ---
    
    // Companions data getters
    get hasCurrentUserCompanion() {
        return this.currentUserCompanion !== null;
    }
    
    get hasConfirmedCompanions() {
        return this.confirmedCompanions && this.confirmedCompanions.length > 0;
    }
    
    get hasInvitedCompanions() {
        return this.invitedCompanions && this.invitedCompanions.length > 0;
    }
    
    get hasAnyCompanions() {
        return this.hasConfirmedCompanions || this.hasInvitedCompanions;
    }
    
    get showNoCompanionsMessage() {
        // Only show the "no companions" message if we have the current user but no other companions
        return this.hasCurrentUserCompanion && !this.hasConfirmedCompanions && !this.hasInvitedCompanions;
    }
    
    get confirmedCount() {
        return this.confirmedCompanions.length;
    }
    
    get invitedCount() {
        return this.invitedCompanions.length;
    }
    
    // Invite modal getters
    get hasContacts() {
        return this.filteredContacts && this.filteredContacts.length > 0;
    }
    
    get selectedContactCount() {
        return this.selectedContacts.length;
    }
    
    get contactLabel() {
        return this.selectedContactCount === 1 ? 'contact' : 'contacts';
    }
    
    get isSendDisabled() {
        return this.selectedContacts.length === 0 || this.isSending;
    }
    
    get showLoadMore() {
        // Show "Load More" if we're not showing all contacts and have more to show
        const totalFiltered = this.searchTerm ? 
            this.allContacts.filter(c => c.Name && c.Name.toLowerCase().includes(this.searchTerm.toLowerCase())).length : 
            this.allContacts.length;
            
        return this.filteredContacts.length < totalFiltered;
    }
    
    // Companion details getters
    get hasSharedTrips() {
        return this.sharedTrips && this.sharedTrips.length > 0;
    }
    
    get hasCompanionExpenses() {
        return this.companionExpenses && this.companionExpenses.length > 0;
    }
    
    get expenseTotal() {
        return this.companionExpenses.reduce((total, expense) => total + (expense.Amount__c || 0), 0);
    }
    
    get expensePercentage() {
        if (!this.tripTotalExpenses || this.tripTotalExpenses === 0) {
            return 0;
        }
        
        const percentage = (this.expenseTotal / this.tripTotalExpenses) * 100;
        return Math.round(percentage);
    }
    
    get expenseShareStyle() {
        return `width: ${this.expensePercentage}%;`;
    }
    
    get tripCountLabel() {
        const count = this.selectedCompanion?.TripCount || 0;
        return count === 1 ? 'trip' : 'trips';
    }
}