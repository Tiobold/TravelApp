import { LightningElement, wire } from 'lwc';
import getVisitedCountries from '@salesforce/apex/TripDashboardController.getVisitedCountries';

// Map of country names to coordinates (latitude, longitude)
const COUNTRY_COORDINATES = {
    'Switzerland': { latitude: 46.818188, longitude: 8.227512 },
    'Netherlands': { latitude: 52.132633, longitude: 5.291266 },
    'United Kingdom': { latitude: 55.378051, longitude: -3.435973 },
    'Spain': { latitude: 40.463667, longitude: -3.74922 },
    'Poland': { latitude: 51.919438, longitude: 19.145136 },
    'Austria': { latitude: 47.516231, longitude: 14.550072 },
    'Slovakia': { latitude: 48.669026, longitude: 19.699024 },
    'Slovenia': { latitude: 46.151241, longitude: 14.995463 },
    'Morocco': { latitude: 31.791492, longitude: -7.09262 },
    'Belgium': { latitude: 50.850346, longitude: 4.351721 },
    'Italy': { latitude: 41.87194, longitude: 12.56738 },
    'Germany': { latitude: 51.165691, longitude: 10.451526 },
    'Ireland': { latitude: 53.41291, longitude: -8.24389 },
    'Iceland': { latitude: 64.963051, longitude: -19.020835 },
    'Croatia': { latitude: 45.1, longitude: 15.2 },
    'Czech Republic': { latitude: 49.75, longitude: 15.5 },
    'Tanzania': { latitude: -6.369028, longitude: 34.888822 },
    'Kenya': { latitude: -0.023559, longitude: 37.906193 },
    'Singapore': { latitude: 1.352083, longitude: 103.819836 },
    'China': { latitude: 35.86166, longitude: 104.195397 },
    'United States': { latitude: 37.09024, longitude: -95.712891 },
    'France': { latitude: 46.603354, longitude: 1.888334 },
    'Hungary': { latitude: 47.162494, longitude: 19.503304 },
    'Vietnam': { latitude: 14.058324, longitude: 108.277199 },
    'Japan': { latitude: 36.204824, longitude: 138.252924 },
    'Indonesia': { latitude: -0.789275, longitude: 113.921327 }
};

export default class TripMapView extends LightningElement {
    countryList = [];
    mapMarkers = [];
    error;
    
    // Remove mapCenter - let Lightning Map auto-center based on markers
    
    mapOptions = {
        zoomLevel: 2,
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
        
        // Process countries for the map markers
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
                    icon: 'standard:location'
                };
            }
            return null;
        }).filter(marker => marker !== null);
        
        console.log('Map markers created:', this.mapMarkers.length);
    }
    
    getFlagEmoji(countryCode) {
        if (!countryCode || countryCode === 'XX' || countryCode.length !== 2) {
            return '🌍';
        }
        
        try {
            const codePoints = countryCode
                .toUpperCase()
                .split('')
                .map(char => 127397 + char.charCodeAt(0));
            return String.fromCodePoint(...codePoints);
        } catch (e) {
            console.warn(`Could not create flag emoji for ${countryCode}`, e);
            return '🌍';
        }
    }
}