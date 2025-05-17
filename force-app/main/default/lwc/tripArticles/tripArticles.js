import { LightningElement, api, track, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import TRIP_COUNTRY_FIELD from '@salesforce/schema/Trip__c.Country__c';
import TRIP_DESTINATION_FIELD from '@salesforce/schema/Trip__c.Destination__c';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import searchActivitiesByCity from '@salesforce/apex/AmadeusService.searchActivitiesByCity';
import getActivityDetails from '@salesforce/apex/AmadeusService.getActivityDetails';

const TRIP_FIELDS = [TRIP_COUNTRY_FIELD, TRIP_DESTINATION_FIELD];

export default class TripArticles extends LightningElement {
    @api recordId; // Trip Id
    @track isLoading = true;
    @track error;
    @track errorMessage = 'An error occurred while loading content.';
    
    // Activities data
    @track countryName;
    @track destinationCity;
    @track activities = [];
    @track selectedActivity;
    @track showDetails = false;
    @track formattedRating = [];
    
    @wire(getRecord, { recordId: '$recordId', fields: TRIP_FIELDS })
    tripRecord({ error, data }) {
        if (data) {
            this.countryName = data.fields.Country__c.value;
            this.destinationCity = data.fields.Destination__c?.value;
            this.searchActivities();
        } else if (error) {
            this.error = error;
            this.errorMessage = error.message || 'Could not load trip details';
            this.isLoading = false;
            this.showToast('Error', this.errorMessage, 'error');
        }
    }
    
    // Search for activities in the destination
    async searchActivities() {
        const searchLocation = this.destinationCity || this.countryName;
        
        if (!searchLocation) {
            this.isLoading = false;
            return;
        }
        
        try {
            const result = await searchActivitiesByCity({
                cityName: searchLocation,
                radius: 25 // 25km radius
            });
            
            if (result && result.activities && result.activities.length > 0) {
                this.activities = result.activities.map(activity => ({
                    id: activity.id,
                    name: activity.name,
                    description: activity.shortDescription || `Discover ${activity.name} in ${searchLocation}`,
                    rating: activity.rating || 0,
                    reviewCount: activity.reviewCount || 0,
                    priceAmount: activity.priceAmount,
                    priceCurrency: activity.priceCurrency,
                    category: activity.category || 'Activity',
                    pictures: activity.pictures || [],
                    bookingUrl: activity.bookingUrl,
                    type: 'Tour & Activity'
                }));
                
                // Automatically select the first activity
                if (this.activities.length > 0) {
                    await this.selectActivity(this.activities[0].id);
                }
            } else {
                // No activities found
                this.activities = [];
                this.loadFallbackContent();
            }
        } catch (error) {
            console.error('Error searching activities:', error);
            this.error = error;
            this.errorMessage = error.message || 'Error searching activities';
            this.activities = [];
            this.loadFallbackContent();
        } finally {
            this.isLoading = false;
        }
    }
    
    // Get detailed information for an activity
    async selectActivity(activityId) {
        this.isLoading = true;
        
        try {
            const activityDetails = await getActivityDetails({
                activityId: activityId
            });
            
            this.selectedActivity = {
                id: activityDetails.id,
                name: activityDetails.name,
                description: activityDetails.shortDescription || '',
                rating: activityDetails.rating || 0,
                reviewCount: activityDetails.reviewCount || 0,
                priceAmount: activityDetails.priceAmount,
                priceCurrency: activityDetails.priceCurrency,
                category: activityDetails.category || 'Activity',
                pictures: activityDetails.pictures || [],
                bookingUrl: activityDetails.bookingUrl,
                latitude: activityDetails.latitude,
                longitude: activityDetails.longitude
            };
            
            this.formattedRating = this.formatRatingAsStars(this.selectedActivity.rating);
            this.showDetails = true;
        } catch (error) {
            console.error('Error fetching activity details:', error);
            // Fallback to the activity from the list
            this.selectedActivity = this.activities.find(act => act.id === activityId);
            if (this.selectedActivity) {
                this.formattedRating = this.formatRatingAsStars(this.selectedActivity.rating);
                this.showDetails = true;
            }
        } finally {
            this.isLoading = false;
        }
    }
    
    // Handle selecting a different activity
    handleActivityClick(event) {
        const activityId = event.currentTarget.dataset.id;
        this.selectActivity(activityId);
    }
    
    // Go back to activities list
    handleBackToResults() {
        this.showDetails = false;
    }
    
    // Refresh the component
    refreshContent() {
        this.isLoading = true;
        this.error = null;
        this.errorMessage = '';
        this.searchActivities();
    }
    
    // Load fallback content if API calls fail
    loadFallbackContent() {
        const searchLocation = this.destinationCity || this.countryName;
        
        // Create mock activities based on destination
        if (searchLocation === 'Budapest' || this.countryName === 'Hungary') {
            this.activities = [
                {
                    id: 'bud-1',
                    name: 'Budapest Parliament Building Tour',
                    description: 'Explore the magnificent Hungarian Parliament Building with guided tours showcasing Neo-Gothic architecture.',
                    rating: 4.6,
                    reviewCount: 2340,
                    priceAmount: '25',
                    priceCurrency: 'EUR',
                    category: 'SIGHTSEEING',
                    type: 'Tour & Activity'
                },
                {
                    id: 'bud-2',
                    name: 'Széchenyi Thermal Baths Experience',
                    description: 'Relax in one of Europe\'s largest thermal bath complexes with healing waters and beautiful architecture.',
                    rating: 4.4,
                    reviewCount: 1890,
                    priceAmount: '20',
                    priceCurrency: 'EUR',
                    category: 'ENTERTAINMENT',
                    type: 'Tour & Activity'
                }
            ];
        } else if (searchLocation === 'Amsterdam' || this.countryName === 'Netherlands') {
            this.activities = [
                {
                    id: 'ams-1',
                    name: 'Anne Frank House Guided Tour',
                    description: 'Visit the historic house where Anne Frank wrote her famous diary during World War II.',
                    rating: 4.7,
                    reviewCount: 5670,
                    priceAmount: '16',
                    priceCurrency: 'EUR',
                    category: 'MUSEUMS',
                    type: 'Tour & Activity'
                },
                {
                    id: 'ams-2',
                    name: 'Canal Cruise with Audio Guide',
                    description: 'Explore Amsterdam\'s UNESCO World Heritage canals from the water with multilingual audio commentary.',
                    rating: 4.3,
                    reviewCount: 3450,
                    priceAmount: '18',
                    priceCurrency: 'EUR',
                    category: 'SIGHTSEEING',
                    type: 'Tour & Activity'
                }
            ];
        } else {
            // Generic activities
            this.activities = [
                {
                    id: 'gen-1',
                    name: `${searchLocation} City Walking Tour`,
                    description: `Discover the highlights of ${searchLocation} with a professional local guide.`,
                    rating: 4.2,
                    reviewCount: 890,
                    priceAmount: '20',
                    priceCurrency: 'EUR',
                    category: 'SIGHTSEEING',
                    type: 'Tour & Activity'
                }
            ];
        }
        
        if (this.activities.length > 0) {
            this.selectedActivity = this.activities[0];
            this.formattedRating = this.formatRatingAsStars(this.selectedActivity.rating);
            this.showDetails = true;
        }
    }
    
    // Format rating as stars
    formatRatingAsStars(rating) {
        const roundedRating = Math.round(rating * 2) / 2; // Round to nearest 0.5
        const fullStars = Math.floor(roundedRating);
        const hasHalfStar = roundedRating % 1 !== 0;
        
        const stars = [];
        
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars.push({ index: i, class: 'star-full' });
            } else if (i === fullStars && hasHalfStar) {
                stars.push({ index: i, class: 'star-half' });
            } else {
                stars.push({ index: i, class: 'star-empty' });
            }
        }
        
        return stars;
    }
    
    // Toast notification helper
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant || 'info'
            })
        );
    }
    
    // Getters
    get hasActivities() {
        return this.activities && this.activities.length > 0;
    }
    
    get displayTitle() {
        const location = this.destinationCity || this.countryName;
        return `Tours & Activities in ${location}`;
    }
    
    get priceDisplay() {
        if (this.selectedActivity && this.selectedActivity.priceAmount) {
            return `${this.selectedActivity.priceCurrency} ${this.selectedActivity.priceAmount}`;
        }
        return 'Price on request';
    }
    
    get hasImages() {
        return this.selectedActivity && this.selectedActivity.pictures && this.selectedActivity.pictures.length > 0;
    }
    
    get primaryImage() {
        if (this.hasImages) {
            return this.selectedActivity.pictures[0];
        }
        return null;
    }
}