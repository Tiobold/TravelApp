import { LightningElement, wire } from 'lwc';
import getVisitedCountries from '@salesforce/apex/TripDashboardController.getVisitedCountries';

// Map of country names to coordinates (latitude, longitude)
const COUNTRY_COORDINATES = {
    'France': { latitude: 46.603354, longitude: 1.888334 },
    'Hungary': { latitude: 47.162494, longitude: 19.503304 },
    'Vietnam': { latitude: 14.058324, longitude: 108.277199 },
    'Singapore': { latitude: 1.352083, longitude: 103.819836 },
    'Japan': { latitude: 36.204824, longitude: 138.252924 },
    'Indonesia': { latitude: -0.789275, longitude: 113.921327 },
    'Italy': { latitude: 41.87194, longitude: 12.56738 },
    'Spain': { latitude: 40.463667, longitude: -3.74922 },
    'Netherlands': { latitude: 52.132633, longitude: 5.291266 },
    'United States': { latitude: 37.09024, longitude: -95.712891 }
    // Add more as needed
};

export default class TripMapView extends LightningElement {
    countryList = [];
    mapMarkers = [];
    error;
    
    // Map configuration - setting to show the entire world map
    mapCenter = {
        location: {
            // Center point that shows the entire world map
            Latitude: 8,
            Longitude: 30
        }
    };
    
    mapOptions = {
        zoomLevel: 1,          // Lower zoom level to see the entire world
        listView: 'hidden',
        markerTitleField: 'title',
        markerDescriptionField: 'description'
    };
    
    @wire(getVisitedCountries)
    wiredCountries({ error, data }) {
        if (data) {
            this.processCountryData(data);
            this.error = undefined;
        } else if (error) {
            this.error = 'Error loading country data: ' + error.body.message;
            console.error('Error loading country data:', error);
        }
    }
    
    processCountryData(data) {
        // Process countries for the list display
        this.countryList = data.map(country => {
            return {
                code: country.countryCode,
                name: country.countryName,
                flag: this.getFlagEmoji(country.countryCode),
                id: country.countryCode
            };
        });
        
        // Process countries for the map markers with red marker styling
        this.mapMarkers = data.map(country => {
            const coordinates = COUNTRY_COORDINATES[country.countryName];
            
            if (coordinates) {
                return {
                    location: {
                        Latitude: coordinates.latitude,
                        Longitude: coordinates.longitude
                    },
                    title: country.countryName,
                    description: `You've visited ${country.countryName}`,
                    // Use standard pins that will appear in red like in Image 2
                    icon: 'standard:location'
                };
            }
            return null;
        }).filter(marker => marker !== null);
    }
    
    getFlagEmoji(countryCode) {
        if (!countryCode || countryCode === 'XX' || countryCode.length !== 2) {
            return '🌍'; // Default globe for unknown countries
        }
        
        try {
            const codePoints = countryCode
                .toUpperCase()
                .split('')
                .map(char => 127397 + char.charCodeAt(0));
            return String.fromCodePoint(...codePoints);
        } catch (e) {
            console.warn(`Could not create flag emoji for ${countryCode}`, e);
            return '🌍'; // Fallback
        }
    }
}