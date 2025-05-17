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
    
    // Map configuration - better centered for world view
    mapCenter = {
        location: {
            // Better center point for world map - slightly more north and centered
            Latitude: 20,
            Longitude: 0
        }
    };
    
    mapOptions = {
        zoomLevel: 1,          // Better zoom level for full world view
        listView: 'hidden',
        markerTitleField: 'title',
        markerDescriptionField: 'description',
        // Additional options to improve map display
        disableDefaultUI: false,
        showCompass: false,
        showTraffic: false
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
                    // Use standard pins that will appear in red
                    icon: 'standard:location'
                };
            }
            return null;
        }).filter(marker => marker !== null);
        
        // If we have markers, adjust the center to better fit the visited countries
        if (this.mapMarkers.length > 0) {
            this.adjustMapCenter();
        }
    }
    
    // Adjust map center based on visited countries
    adjustMapCenter() {
        if (this.mapMarkers.length === 0) return;
        
        // Calculate the center point of all visited countries
        let totalLat = 0;
        let totalLng = 0;
        
        this.mapMarkers.forEach(marker => {
            totalLat += marker.location.Latitude;
            totalLng += marker.location.Longitude;
        });
        
        const avgLat = totalLat / this.mapMarkers.length;
        const avgLng = totalLng / this.mapMarkers.length;
        
        // Use the calculated center but keep it reasonable for world view
        this.mapCenter = {
            location: {
                Latitude: Math.max(-60, Math.min(60, avgLat)), // Clamp between -60 and 60
                Longitude: avgLng
            }
        };
        
        // Adjust zoom level based on spread of countries
        const latSpread = Math.max(...this.mapMarkers.map(m => m.location.Latitude)) - 
                         Math.min(...this.mapMarkers.map(m => m.location.Latitude));
        const lngSpread = Math.max(...this.mapMarkers.map(m => m.location.Longitude)) - 
                         Math.min(...this.mapMarkers.map(m => m.location.Longitude));
        
        // Adjust zoom based on spread
        if (latSpread > 100 || lngSpread > 150) {
            this.mapOptions.zoomLevel = 1; // World view
        } else if (latSpread > 50 || lngSpread > 80) {
            this.mapOptions.zoomLevel = 2; // Continental view
        } else {
            this.mapOptions.zoomLevel = 3; // Regional view
        }
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