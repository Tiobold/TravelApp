import { LightningElement, api, wire } from 'lwc';
import getTripCompanions from '@salesforce/apex/TripCompanionController.getTripCompanions';

export default class TripCompanions extends LightningElement {
    @api recordId; // Trip__c record Id
    companions = [];
    isLoading = true;
    error;
    
    @wire(getTripCompanions, { tripId: '$recordId' })
    wiredCompanions({ error, data }) {
        this.isLoading = true;
        if (data) {
            this.companions = data.map(companion => ({
                ...companion,
                photoUrl: companion.PhotoURL || '/img/icon/t4v35/standard/user_120.png', // Default image if no URL
                key: companion.Id // Unique key for rendering
            }));
            this.error = undefined;
            this.isLoading = false;
        } else if (error) {
            this.error = 'Error loading companions: ' + error.body.message;
            this.companions = [];
            this.isLoading = false;
            console.error('Error fetching trip companions:', error);
        }
    }
    
    // Handle click on companion card
    handleCompanionClick(event) {
        const companionId = event.currentTarget.dataset.id;
        // Navigate to companion record or show more details
        this.dispatchEvent(new CustomEvent('companionselect', {
            detail: { companionId }
        }));
    }
}