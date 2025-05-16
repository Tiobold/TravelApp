import { LightningElement, api, track, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import TRIP_COUNTRY_FIELD from '@salesforce/schema/Trip__c.Country__c';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const TRIP_FIELDS = [TRIP_COUNTRY_FIELD];
const API_KEY = '3A4A5FFCBE79431F88E0D41FDE4F78EA';
const API_BASE_URL = 'https://api.content.tripadvisor.com/api/v1';

export default class TripArticles extends LightningElement {
    @api recordId; // Trip Id
    @track isLoading = true;
    @track error;
    @track errorMessage = 'An error occurred while loading content.';
    
    // TripAdvisor API data
    @track countryName;
    @track searchResults = [];
    @track selectedLocation;
    @track locationDetails;
    @track showDetails = false;
    @track formattedRating = [];
    
    @wire(getRecord, { recordId: '$recordId', fields: TRIP_FIELDS })
    tripRecord({ error, data }) {
        if (data) {
            this.countryName = data.fields.Country__c.value;
            this.searchLocations();
        } else if (error) {
            this.error = error;
            this.errorMessage = error.message || 'Could not load trip details';
            this.isLoading = false;
            this.showToast('Error', this.errorMessage, 'error');
        }
    }
    
    // Location Search API Call
    async searchLocations() {
        if (!this.countryName) {
            this.isLoading = false;
            return;
        }
        
        try {
            // Step 1: Search for locations based on country
            const searchUrl = `${API_BASE_URL}/location/search?key=${API_KEY}&searchQuery=${encodeURIComponent(this.countryName)}&language=en&category=attractions`;
            
            const response = await fetch(searchUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data.data && data.data.length > 0) {
                this.searchResults = data.data.map(location => ({
                    id: location.location_id,
                    name: location.name,
                    type: location.location_type || 'Unknown',
                    address: location.address_obj ? location.address_obj.address_string : '',
                    rating: location.rating || 0,
                    numReviews: location.num_reviews || 0,
                    webUrl: location.web_url || '',
                    thumbnail: location.photo ? location.photo.images.small.url : null,
                    ratingImageUrl: location.rating_image_url || null
                }));
                
                // Automatically select the first result and load its details
                if (this.searchResults.length > 0) {
                    this.selectLocation(this.searchResults[0].id);
                }
            } else {
                // No results found
                this.searchResults = [];
                this.isLoading = false;
            }
        } catch (error) {
            console.error('Error searching locations:', error);
            this.error = error;
            this.errorMessage = error.message || 'Error searching locations';
            this.searchResults = [];
            this.isLoading = false;
            this.loadFallbackContent();
        }
    }
    
    // Location Details API Call
    async selectLocation(locationId) {
        this.isLoading = true;
        
        try {
            // Step 2: Get location details
            const detailsUrl = `${API_BASE_URL}/location/${locationId}/details?key=${API_KEY}&language=en`;
            
            const response = await fetch(detailsUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            this.locationDetails = {
                id: data.location_id,
                name: data.name,
                description: data.description || '',
                address: data.address_obj ? data.address_obj.address_string : '',
                phone: data.phone || '',
                website: data.website || '',
                rating: data.rating || 0,
                ratingImageUrl: data.rating_image_url || null,
                numReviews: data.num_reviews || 0,
                rankingData: data.ranking_data || {},
                webUrl: data.web_url || '',
                priceLevel: data.price_level || '',
                hours: data.hours ? data.hours.week_ranges : [],
                photos: data.photos || []
            };
            
            this.selectedLocation = this.searchResults.find(loc => loc.id === locationId);
            this.formattedRating = this.formatRatingAsStars(this.locationDetails.rating);
            this.showDetails = true;
        } catch (error) {
            console.error('Error fetching location details:', error);
            this.error = error;
            this.errorMessage = error.message || 'Error fetching location details';
            this.locationDetails = null;
        } finally {
            this.isLoading = false;
        }
    }
    
    // Handle selecting a different location
    handleLocationClick(event) {
        const locationId = event.currentTarget.dataset.id;
        this.selectLocation(locationId);
    }
    
    // Go back to results list
    handleBackToResults() {
        this.showDetails = false;
    }
    
    // Refresh the component
    refreshContent() {
        this.isLoading = true;
        this.error = null;
        this.errorMessage = '';
        this.searchLocations();
    }
    
    // Load fallback content if API calls fail
    loadFallbackContent() {
        // Create mock data for display
        const mockData = this.getMockDataForCountry(this.countryName);
        this.searchResults = mockData.locations || [];
        
        if (this.searchResults.length > 0) {
            this.locationDetails = mockData.details;
            this.selectedLocation = this.searchResults[0];
            this.formattedRating = this.formatRatingAsStars(this.locationDetails.rating);
            this.showDetails = true;
        }
    }
    
    // Provide mock data for demo/fallback
    getMockDataForCountry(country) {
        const mockData = {
            locations: [],
            details: null
        };
        
        if (country === 'Hungary') {
            mockData.locations = [
                {
                    id: '276868',
                    name: 'Budapest',
                    type: 'City',
                    address: 'Budapest, Central Hungary',
                    rating: 4.5,
                    numReviews: 1200,
                    webUrl: 'https://www.tripadvisor.com/Tourism-g274887-Budapest_Central_Hungary-Vacations.html'
                },
                {
                    id: '274906',
                    name: 'Lake Balaton',
                    type: 'Attraction',
                    address: 'Western Hungary',
                    rating: 4.5,
                    numReviews: 800,
                    webUrl: 'https://www.tripadvisor.com/Attraction_Review-g274906-d276866-Reviews-Lake_Balaton-Balatonfured_Veszprem_County_Central_Transdanubia.html'
                }
            ];
            
            mockData.details = {
                id: '276868',
                name: 'Budapest',
                description: 'Budapest, Hungary\'s capital, is bisected by the River Danube. Its 19th-century Chain Bridge connects the hilly Buda district with flat Pest. A funicular runs up Castle Hill to Buda\'s Old Town, where the Budapest History Museum traces city life from Roman times onward. Trinity Square is home to 13th-century Matthias Church and the turrets of the Fishermen\'s Bastion, which offer sweeping views.',
                address: 'Budapest, Central Hungary',
                phone: '',
                website: 'https://www.budapest.com/',
                rating: 4.5,
                numReviews: 1200,
                webUrl: 'https://www.tripadvisor.com/Tourism-g274887-Budapest_Central_Hungary-Vacations.html',
                photos: []
            };
        } else if (country === 'Netherlands') {
            mockData.locations = [
                {
                    id: '188590',
                    name: 'Amsterdam',
                    type: 'City',
                    address: 'Amsterdam, North Holland Province',
                    rating: 4.5,
                    numReviews: 2500,
                    webUrl: 'https://www.tripadvisor.com/Tourism-g188590-Amsterdam_North_Holland_Province-Vacations.html'
                }
            ];
            
            mockData.details = {
                id: '188590',
                name: 'Amsterdam',
                description: 'Amsterdam is the Netherlands\' capital, known for its artistic heritage, elaborate canal system and narrow houses with gabled facades, legacies of the city\'s 17th-century Golden Age. Its Museum District houses the Van Gogh Museum, works by Rembrandt and Vermeer at the Rijksmuseum, and modern art at the Stedelijk. Cycling is key to the city\'s character, and there are numerous bike paths.',
                address: 'Amsterdam, North Holland Province',
                phone: '',
                website: 'https://www.amsterdam.nl/en/',
                rating: 4.5,
                numReviews: 2500,
                webUrl: 'https://www.tripadvisor.com/Tourism-g188590-Amsterdam_North_Holland_Province-Vacations.html',
                photos: []
            };
        } else {
            // Generic fallback for any other country
            mockData.locations = [
                {
                    id: 'generic-1',
                    name: `${country} Capital`,
                    type: 'City',
                    address: country,
                    rating: 4.0,
                    numReviews: 1000,
                    webUrl: 'https://www.tripadvisor.com/'
                }
            ];
            
            mockData.details = {
                id: 'generic-1',
                name: `${country} Capital`,
                description: `Top destination in ${country} with attractions, museums, and local cuisine.`,
                address: country,
                phone: '',
                website: '',
                rating: 4.0,
                numReviews: 1000,
                webUrl: 'https://www.tripadvisor.com/',
                photos: []
            };
        }
        
        return mockData;
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
    
    // Format date
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        }).format(date);
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
    get hasSearchResults() {
        return this.searchResults && this.searchResults.length > 0;
    }
    
    get hasPhotos() {
        return this.locationDetails && this.locationDetails.photos && this.locationDetails.photos.length > 0;
    }
}