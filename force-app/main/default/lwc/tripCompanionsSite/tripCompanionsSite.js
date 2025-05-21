import { LightningElement, api, track } from 'lwc';
import getTripCompanionsForExternal from '@salesforce/apex/TripAccessController.getTripCompanionsForExternal';

const DEFAULT_PHOTO_URL = '/img/icon/t4v35/standard/user_120.png';

export default class TripCompanionsSite extends LightningElement {
    @api token;
    
    @track isLoading = true;
    @track error = '';
    @track confirmedCompanions = [];
    @track interestedCompanions = [];
    @track invitedCompanions = [];
    @track currentUser = null;
    
    connectedCallback() {
        if (this.token) {
            this.loadCompanions();
        } else {
            this.error = 'No token provided to load companions';
            this.isLoading = false;
        }
    }
    
    @api
    refreshData(newToken) {
        if (newToken) {
            this.token = newToken;
        }
        
        if (this.token) {
            this.loadCompanions();
        }
    }
    
    loadCompanions() {
        this.isLoading = true;
        this.error = '';
        
        getTripCompanionsForExternal({ token: this.token })
            .then(result => {
                if (result.success) {
                    // Process companions
                    this.processCompanions(result);
                } else {
                    this.error = result.error || 'Error loading companions';
                }
            })
            .catch(error => {
                this.error = error.message || 'Unknown error loading companions';
                console.error('Error loading companions:', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
    processCompanions(result) {
        // Helper function to prepare companions with necessary computed properties
        const processCompanionList = (list) => {
            if (!list) return [];
            return list.map(companion => ({
                ...companion,
                photoUrl: companion.photoUrl || DEFAULT_PHOTO_URL,
                // Pre-compute status class for template
                statusClass: this.getStatusClassForCompanion(companion)
            }));
        };
        
        // Process each companion list
        this.confirmedCompanions = processCompanionList(result.confirmed);
        this.interestedCompanions = processCompanionList(result.interested);
        this.invitedCompanions = processCompanionList(result.invited);
        
        // Process current user if included in the result
        if (result.currentUser) {
            this.currentUser = {
                ...result.currentUser,
                photoUrl: result.currentUser.photoUrl || DEFAULT_PHOTO_URL,
                statusClass: this.getStatusClassForCompanion(result.currentUser)
            };
            console.log('Current user set from server:', this.currentUser);
        } else {
            // Find current user from all companions as fallback
            const allCompanions = [
                ...this.confirmedCompanions, 
                ...this.interestedCompanions, 
                ...this.invitedCompanions
            ];
            
            this.currentUser = allCompanions.find(companion => companion.isCurrentUser);
            console.log('Current user found from all companions:', this.currentUser);
        }
    }
    
    // Helper method to determine status class (only used in JS, not in template)
    getStatusClassForCompanion(companion) {
        if (companion.isOwner) return 'status-label owner';
        if (companion.status === 'Confirmed') return 'status-label confirmed';
        if (companion.status === 'Interested') return 'status-label interested';
        return 'status-label invited';
    }
    
    // Computed properties
    get hasCurrentUser() {
        return !!this.currentUser;
    }
    
    get hasConfirmedCompanions() {
        return this.confirmedCompanions && this.confirmedCompanions.length > 0;
    }
    
    get hasInterestedCompanions() {
        return this.interestedCompanions && this.interestedCompanions.length > 0;
    }
    
    get hasInvitedCompanions() {
        return this.invitedCompanions && this.invitedCompanions.length > 0;
    }
    
    get confirmedCount() {
        return this.confirmedCompanions ? this.confirmedCompanions.length : 0;
    }
    
    get interestedCount() {
        return this.interestedCompanions ? this.interestedCompanions.length : 0;
    }
    
    get invitedCount() {
        return this.invitedCompanions ? this.invitedCompanions.length : 0;
    }
    
    get noCompanions() {
        return !this.hasConfirmedCompanions && !this.hasInterestedCompanions && !this.hasInvitedCompanions;
    }
    
    // New computed property for current user status class
    get currentUserStatusClass() {
        if (!this.currentUser) return '';
        
        if (this.currentUser.isOwner) return 'status-label owner';
        if (this.currentUser.status === 'Confirmed') return 'status-label confirmed';
        if (this.currentUser.status === 'Interested') return 'status-label interested';
        return 'status-label invited';
    }
}