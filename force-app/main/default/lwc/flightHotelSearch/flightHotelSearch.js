import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import searchFlights from '@salesforce/apex/AmadeusService.searchFlights';
import searchHotels from '@salesforce/apex/AmadeusService.searchHotels';
import getLocationSuggestions from '@salesforce/apex/AmadeusService.getLocationSuggestions';

export default class FlightHotelSearch extends LightningElement {
    @api recordId; // Trip record ID
    
    // Tab management
    @track activeTab = 'flights';
    
    // Search form data
    @track searchData = {
        origin: '',
        destination: '',
        departureDate: '',
        returnDate: '',
        checkInDate: '',
        checkOutDate: '',
        adults: 1
    };
    
    // Location suggestions
    @track originSuggestions = [];
    @track destinationSuggestions = [];
    @track showOriginSuggestions = false;
    @track showDestinationSuggestions = false;
    
    // Search results
    @track flightResults = [];
    @track hotelResults = [];
    @track isSearching = false;
    @track hasSearched = false;
    @track error;
    
    // Selected items and booking modal
    @track selectedFlight = null;
    @track selectedHotel = null;
    @track showBookingModal = false;
    @track bookingType = ''; // 'flight' or 'hotel'
    @track isBooking = false;
    
    // Manual city/airport mapping for better suggestions
    cityAirportMap = new Map([
        ['budapest', { iataCode: 'BUD', name: 'Budapest Ferenc Liszt International Airport', cityName: 'Budapest', countryName: 'Hungary' }],
        ['bud', { iataCode: 'BUD', name: 'Budapest Ferenc Liszt International Airport', cityName: 'Budapest', countryName: 'Hungary' }],
        ['hanoi', { iataCode: 'HAN', name: 'Noi Bai International Airport', cityName: 'Hanoi', countryName: 'Vietnam' }],
        ['han', { iataCode: 'HAN', name: 'Noi Bai International Airport', cityName: 'Hanoi', countryName: 'Vietnam' }],
        ['amsterdam', { iataCode: 'AMS', name: 'Amsterdam Airport Schiphol', cityName: 'Amsterdam', countryName: 'Netherlands' }],
        ['ams', { iataCode: 'AMS', name: 'Amsterdam Airport Schiphol', cityName: 'Amsterdam', countryName: 'Netherlands' }],
        ['paris', { iataCode: 'CDG', name: 'Charles de Gaulle Airport', cityName: 'Paris', countryName: 'France' }],
        ['cdg', { iataCode: 'CDG', name: 'Charles de Gaulle Airport', cityName: 'Paris', countryName: 'France' }],
        ['london', { iataCode: 'LHR', name: 'Heathrow Airport', cityName: 'London', countryName: 'United Kingdom' }],
        ['lhr', { iataCode: 'LHR', name: 'Heathrow Airport', cityName: 'London', countryName: 'United Kingdom' }],
        ['vienna', { iataCode: 'VIE', name: 'Vienna International Airport', cityName: 'Vienna', countryName: 'Austria' }],
        ['vie', { iataCode: 'VIE', name: 'Vienna International Airport', cityName: 'Vienna', countryName: 'Austria' }],
        ['prague', { iataCode: 'PRG', name: 'Václav Havel Airport Prague', cityName: 'Prague', countryName: 'Czech Republic' }],
        ['prg', { iataCode: 'PRG', name: 'Václav Havel Airport Prague', cityName: 'Prague', countryName: 'Czech Republic' }],
        ['rome', { iataCode: 'FCO', name: 'Leonardo da Vinci Airport', cityName: 'Rome', countryName: 'Italy' }],
        ['fco', { iataCode: 'FCO', name: 'Leonardo da Vinci Airport', cityName: 'Rome', countryName: 'Italy' }],
        ['madrid', { iataCode: 'MAD', name: 'Adolfo Suárez Madrid-Barajas Airport', cityName: 'Madrid', countryName: 'Spain' }],
        ['mad', { iataCode: 'MAD', name: 'Adolfo Suárez Madrid-Barajas Airport', cityName: 'Madrid', countryName: 'Spain' }],
        ['berlin', { iataCode: 'BER', name: 'Berlin Brandenburg Airport', cityName: 'Berlin', countryName: 'Germany' }],
        ['ber', { iataCode: 'BER', name: 'Berlin Brandenburg Airport', cityName: 'Berlin', countryName: 'Germany' }]
    ]);
    
    get tabs() {
        return [
            { 
                value: 'flights', 
                label: 'Flights', 
                icon: 'utility:airplane',
                class: this.activeTab === 'flights' ? 'slds-is-active' : '' 
            },
            { 
                value: 'hotels', 
                label: 'Hotels', 
                icon: 'utility:home',
                class: this.activeTab === 'hotels' ? 'slds-is-active' : '' 
            }
        ];
    }
    
    get isFlightsTab() {
        return this.activeTab === 'flights';
    }
    
    get isHotelsTab() {
        return this.activeTab === 'hotels';
    }
    
    get hasFlightResults() {
        return this.flightResults && this.flightResults.length > 0;
    }
    
    get hasHotelResults() {
        return this.hotelResults && this.hotelResults.length > 0;
    }
    
    get adultOptions() {
        const options = [];
        for (let i = 1; i <= 8; i++) {
            options.push({ label: i.toString(), value: i });
        }
        return options;
    }
    
    get minDepartureDate() {
        return new Date().toISOString().split('T')[0];
    }
    
    get minReturnDate() {
        return this.searchData.departureDate || this.minDepartureDate;
    }
    
    get minCheckInDate() {
        return new Date().toISOString().split('T')[0];
    }
    
    get minCheckOutDate() {
        return this.searchData.checkInDate || this.minCheckInDate;
    }
    
    get bookingTitle() {
        return this.bookingType === 'flight' ? 'Book Flight' : 'Book Hotel';
    }
    
    get selectedItem() {
        return this.bookingType === 'flight' ? this.selectedFlight : this.selectedHotel;
    }
    
    // Tab switching
    handleTabClick(event) {
        this.activeTab = event.target.dataset.tab;
        this.clearSearchResults();
    }
    
    // Input handlers with improved logic
    handleOriginChange(event) {
        this.searchData.origin = event.target.value;
        this.searchLocationSuggestions(event.target.value, 'origin');
    }
    
    handleDestinationChange(event) {
        this.searchData.destination = event.target.value;
        this.searchLocationSuggestions(event.target.value, 'destination');
    }
    
    handleDepartureDateChange(event) {
        this.searchData.departureDate = event.target.value;
        // Auto-set return date to 1 week later if not set
        if (!this.searchData.returnDate) {
            const departureDate = new Date(event.target.value);
            departureDate.setDate(departureDate.getDate() + 7);
            this.searchData.returnDate = departureDate.toISOString().split('T')[0];
        }
        // Auto-set check-in date for hotels
        if (!this.searchData.checkInDate) {
            this.searchData.checkInDate = event.target.value;
        }
    }
    
    handleReturnDateChange(event) {
        this.searchData.returnDate = event.target.value;
    }
    
    handleCheckInDateChange(event) {
        this.searchData.checkInDate = event.target.value;
        // Auto-set check out date to 3 days later if not set
        if (!this.searchData.checkOutDate) {
            const checkInDate = new Date(event.target.value);
            checkInDate.setDate(checkInDate.getDate() + 3);
            this.searchData.checkOutDate = checkInDate.toISOString().split('T')[0];
        }
    }
    
    handleCheckOutDateChange(event) {
        this.searchData.checkOutDate = event.target.value;
    }
    
    handleAdultsChange(event) {
        this.searchData.adults = parseInt(event.detail.value);
    }
    
    // Improved location suggestions with fallback
    async searchLocationSuggestions(keyword, type) {
        if (keyword.length < 2) {
            this.clearSuggestions(type);
            return;
        }
        
        // First try manual mapping for common cities
        const manualSuggestions = this.getManualSuggestions(keyword);
        
        try {
            // Then try API for additional suggestions
            const apiSuggestions = await getLocationSuggestions({ keyword });
            
            // Combine manual and API suggestions, removing duplicates
            const allSuggestions = [...manualSuggestions];
            apiSuggestions.forEach(apiSugg => {
                if (!allSuggestions.find(manualSugg => manualSugg.iataCode === apiSugg.iataCode)) {
                    allSuggestions.push(apiSugg);
                }
            });
            
            if (type === 'origin') {
                this.originSuggestions = allSuggestions.slice(0, 8); // Limit to 8 suggestions
                this.showOriginSuggestions = this.originSuggestions.length > 0;
                this.showDestinationSuggestions = false;
            } else {
                this.destinationSuggestions = allSuggestions.slice(0, 8);
                this.showDestinationSuggestions = this.destinationSuggestions.length > 0;
                this.showOriginSuggestions = false;
            }
        } catch (error) {
            console.error('Error fetching location suggestions:', error);
            // Fall back to manual suggestions only
            if (type === 'origin') {
                this.originSuggestions = manualSuggestions;
                this.showOriginSuggestions = manualSuggestions.length > 0;
            } else {
                this.destinationSuggestions = manualSuggestions;
                this.showDestinationSuggestions = manualSuggestions.length > 0;
            }
        }
    }
    
    // Get manual suggestions from predefined mapping
    getManualSuggestions(keyword) {
        const suggestions = [];
        const searchTerm = keyword.toLowerCase();
        
        for (let [key, value] of this.cityAirportMap) {
            if (key.includes(searchTerm) || value.cityName.toLowerCase().includes(searchTerm)) {
                suggestions.push(value);
            }
        }
        
        return suggestions;
    }
    
    clearSuggestions(type) {
        if (type === 'origin') {
            this.originSuggestions = [];
            this.showOriginSuggestions = false;
        } else {
            this.destinationSuggestions = [];
            this.showDestinationSuggestions = false;
        }
    }
    
    clearSearchResults() {
        this.flightResults = [];
        this.hotelResults = [];
        this.hasSearched = false;
        this.error = null;
        this.selectedFlight = null;
        this.selectedHotel = null;
    }
    
    handleSuggestionClick(event) {
        const suggestion = JSON.parse(event.target.dataset.suggestion);
        const type = event.target.dataset.type;
        
        if (type === 'origin') {
            this.searchData.origin = suggestion.iataCode;
            this.clearSuggestions('origin');
        } else {
            this.searchData.destination = suggestion.iataCode;
            this.clearSuggestions('destination');
        }
        
        // Update the input field display
        const inputField = this.template.querySelector(`lightning-input[data-field="${type}"]`);
        if (inputField) {
            inputField.value = `${suggestion.iataCode} - ${suggestion.cityName}`;
        }
    }
    
    // Search functions
    async handleFlightSearch() {
        if (!this.validateFlightSearchForm()) {
            return;
        }
        
        this.isSearching = true;
        this.error = null;
        this.flightResults = [];
        
        // Clear suggestions after search
        this.clearSuggestions('origin');
        this.clearSuggestions('destination');
        
        try {
            const result = await searchFlights({
                origin: this.extractIataCode(this.searchData.origin),
                destination: this.extractIataCode(this.searchData.destination),
                departureDate: this.searchData.departureDate,
                returnDate: this.searchData.returnDate,
                adults: this.searchData.adults
            });
            
            this.flightResults = this.processFlightResults(result.flights || []);
            this.hasSearched = true;
            
            if (this.flightResults.length === 0) {
                this.showToast('No Results', 'No flights found for your search criteria.', 'info');
            }
        } catch (error) {
            console.error('Error searching flights:', error);
            this.error = error.body?.message || error.message || 'Error searching flights';
            this.showToast('Error', this.error, 'error');
        } finally {
            this.isSearching = false;
        }
    }
    
    async handleHotelSearch() {
        if (!this.validateHotelSearchForm()) {
            return;
        }
        
        this.isSearching = true;
        this.error = null;
        this.hotelResults = [];
        
        // Clear suggestions after search
        this.clearSuggestions('destination');
        
        try {
            const result = await searchHotels({
                cityCode: this.extractIataCode(this.searchData.destination),
                checkInDate: this.searchData.checkInDate,
                checkOutDate: this.searchData.checkOutDate,
                adults: this.searchData.adults
            });
            
            this.hotelResults = result.hotels || [];
            this.hasSearched = true;
            
            if (this.hotelResults.length === 0) {
                this.showToast('No Results', 'No hotels found for your search criteria.', 'info');
            }
        } catch (error) {
            console.error('Error searching hotels:', error);
            this.error = error.body?.message || error.message || 'Error searching hotels';
            this.showToast('Error', this.error, 'error');
        } finally {
            this.isSearching = false;
        }
    }
    
    // Extract IATA code from input (handles "BUD - Budapest" format)
    extractIataCode(input) {
        if (!input) return '';
        
        // If input contains " - ", take the part before it
        if (input.includes(' - ')) {
            return input.split(' - ')[0].trim();
        }
        
        // Otherwise, return the input as-is
        return input.trim();
    }
    
    // Process flight results to add formatted data
    processFlightResults(flights) {
        return flights.map(flight => ({
            ...flight,
            formattedPrice: flight.price,
            itineraries: flight.itineraries.map(itinerary => ({
                ...itinerary,
                formattedDuration: this.formatDuration(itinerary.duration),
                segments: itinerary.segments.map(segment => ({
                    ...segment,
                    formattedDepartureTime: this.formatDateTime(segment.departureTime),
                    formattedArrivalTime: this.formatDateTime(segment.arrivalTime)
                }))
            }))
        }));
    }
    
    // Validation
    validateFlightSearchForm() {
        const origin = this.extractIataCode(this.searchData.origin);
        const destination = this.extractIataCode(this.searchData.destination);
        const departureDate = this.searchData.departureDate;
        
        if (!origin || !destination || !departureDate) {
            this.showToast('Missing Information', 'Please fill in origin, destination, and departure date.', 'error');
            return false;
        }
        
        if (origin === destination) {
            this.showToast('Invalid Search', 'Origin and destination cannot be the same.', 'error');
            return false;
        }
        
        return true;
    }
    
    validateHotelSearchForm() {
        const destination = this.extractIataCode(this.searchData.destination);
        const checkInDate = this.searchData.checkInDate;
        const checkOutDate = this.searchData.checkOutDate;
        
        if (!destination || !checkInDate || !checkOutDate) {
            this.showToast('Missing Information', 'Please fill in destination, check-in, and check-out dates.', 'error');
            return false;
        }
        
        if (checkInDate >= checkOutDate) {
            this.showToast('Invalid Dates', 'Check-out date must be after check-in date.', 'error');
            return false;
        }
        
        return true;
    }
    
    // Flight and hotel selection
    handleFlightSelect(event) {
        const flightId = event.target.dataset.flightId;
        this.selectedFlight = this.flightResults.find(flight => flight.id === flightId);
        this.bookingType = 'flight';
        this.showBookingModal = true;
    }
    
    handleHotelSelect(event) {
        const hotelId = event.target.dataset.hotelId;
        this.selectedHotel = this.hotelResults.find(hotel => hotel.id === hotelId);
        this.bookingType = 'hotel';
        this.showBookingModal = true;
    }
    
    // Booking modal handlers
    handleCloseBookingModal() {
        this.showBookingModal = false;
        this.selectedFlight = null;
        this.selectedHotel = null;
        this.bookingType = '';
    }
    
    async handleConfirmBooking() {
        this.isBooking = true;
        
        try {
            // Simulate booking process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // In a real implementation, you would:
            // 1. Create a booking record
            // 2. Possibly redirect to payment
            // 3. Save booking details to the Trip
            
            this.showToast('Success', 
                `${this.bookingType === 'flight' ? 'Flight' : 'Hotel'} booking confirmed! Details will be added to your trip.`, 
                'success');
            
            this.handleCloseBookingModal();
        } catch (error) {
            console.error('Error booking:', error);
            this.showToast('Error', 'Booking failed. Please try again.', 'error');
        } finally {
            this.isBooking = false;
        }
    }
    
    // Utility functions
    formatDateTime(dateTimeString) {
        if (!dateTimeString) return '';
        const date = new Date(dateTimeString);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(date);
    }
    
    formatDuration(duration) {
        if (!duration) return '';
        // Duration is in ISO 8601 format (PT1H30M)
        const matches = duration.match(/PT(\d+H)?(\d+M)?/);
        if (!matches) return duration;
        
        const hours = matches[1] ? parseInt(matches[1]) : 0;
        const minutes = matches[2] ? parseInt(matches[2]) : 0;
        
        return `${hours}h ${minutes}m`;
    }
    
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
}