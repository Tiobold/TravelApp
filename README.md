# Salesforce Travel Management App

A comprehensive travel management application built on the Salesforce platform that helps users plan trips, track expenses, manage itineraries, and analyze travel statistics with integrated external APIs and advanced visualizations.

## 🌟 Features

### Core Travel Management
- **Enhanced Trip Dashboard**: Visualize all trips with advanced filtering, budget statistics, and animated progress indicators
- **Interactive Trip Mapping**: Display trip locations on Google Maps with custom markers, detailed itineraries, and location search
- **Intelligent Itinerary Planning**: Create and manage detailed itineraries with drag-and-drop functionality and duration tracking
- **Comprehensive Expense Tracking**: Track expenses by category with real-time budget visualization and multi-currency support
- **Travel Companion Management**: Invite contacts, track RSVP status, and manage group travel dynamics

### Advanced Features
- **Flight Price Alerts**: Set up automated price monitoring with email/in-app notifications via Amadeus API
- **Flight & Hotel Search**: Real-time search and booking integration with Amadeus API
- **Travel Statistics Dashboard**: Advanced analytics with animated counters, achievement badges, and eco-ratings
- **Destination Content**: TripAdvisor integration for activities, attractions, and travel guides
- **World Map Visualization**: Interactive world map showing visited countries with flag emojis
- **Splitwise Integration**: Automatic expense sharing and sync with Splitwise for group expenses

### Technical Capabilities
- **Google Location Services**: Places API integration for location search and geocoding
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Real-time Data Sync**: Live updates across all components with proper error handling
- **Advanced Animations**: Smooth transitions and progressive loading for enhanced UX
- **Multi-currency Support**: Handle expenses in different currencies with conversion
- **Import/Export Features**: Google Timeline import for visited places

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Lightning Web Components (LWC) with modern CSS animations
- **Backend**: Apex controllers with secure server-side processing
- **Database**: Salesforce custom objects with relationships and roll-up summaries
- **External APIs**: 
 - Google Maps/Places API for location services
 - Amadeus API for flight/hotel search and price monitoring
 - TripAdvisor API for destination content
 - Splitwise API for expense sharing (optional)

### Data Model
The application uses a sophisticated data model with the following key objects:

- **Trip__c**: Core trip information (dates, budget, destination, status)
- **Itinerary_Item__c**: Detailed trip activities with location, timing, and duration
- **Expense__c**: Trip-related expenses with categories and sharing capabilities
- **Travel_Companion__c**: Junction object managing trip participants and invitations
- **Visited_Place__c**: Historical record of places visited (Google Timeline integration)
- **Flight_Price_Alert__c**: Automated flight monitoring configurations
- **Flight_Price_Notification__c**: Price alert history and notifications

## 🚀 Components Overview

### Dashboard Components
- **enhancedHomepage**: Main landing page with trip overview and quick stats
- **tripDashboard**: Comprehensive trip management with filtering and search
- **travelStats**: Advanced travel analytics with animated visualizations
- **expenseOverview**: Monthly expense breakdown with category insights

### Trip Management
- **tripMap**: Interactive map with itinerary visualization and location management
- **expenseTracker**: Complete expense management with budget monitoring
- **tripPlanner**: Guided trip creation wizard with companion invitations
- **tripCompanions**: Social features for group travel coordination

### Discovery & Search
- **tripArticles**: Destination guides and activities from TripAdvisor
- **flightHotelSearch**: Real-time flight and hotel search with booking
- **flightPriceAlerts**: Automated price monitoring and notifications
- **tripMapView**: World map showing all visited countries

## 🔧 Installation

### Prerequisites
- Salesforce org with Lightning Experience enabled
- API access for external services (Google Maps, Amadeus, TripAdvisor)
- Salesforce CLI for deployment

### Quick Start

1. **Clone the repository**
  ```bash
  git clone https://github.com/your-username/salesforce-travel-app.git
  cd salesforce-travel-app
  ```
2. **Authorize your Salesforce org**
  ```bash
  sfdx auth:web:login -a YourOrgAlias
  ```
3. **Deploy the application**
  ```bash
  sfdx force:source:deploy -p force-app --wait 10
  ```
4. **Configure API Settings**
   - Navigate to Setup → Custom Settings
   - Configure Google Maps API Settings with your API key
   - Configure Amadeus API Settings with client credentials
   - Set up TripAdvisor API key (if available)

5. **Assign Permissions**
  ```bash
   sfdx force:user:permset:assign -n Travel_App_User
   ```
6. **Import Sample Data** (optional)
  ```bash
   sfdx force:data:tree:import -p data/sample-data-plan.json
   ```

## 🔑 API Configuration

### Google Maps API
Required for location search and mapping features:
- Places API (location search)
- Maps JavaScript API (map visualization)
- Geocoding API (address conversion)

### Amadeus API
Required for flight/hotel search and price monitoring:
- Flight Offers Search
- Hotel Search
- Flight Price Alerts
- Location suggestions

### TripAdvisor API (Optional)
For destination content and travel recommendations:
- Attractions API
- Restaurant data
- Travel articles

## 🧪 Development

### Setting Up Development Environment

1. **Create a scratch org**
  ```bash
   sfdx force:org:create -f config/project-scratch-def.json -a TravelAppDev
   ```
2. **Push source to scratch org**
   ```bash
   sfdx force:source:push
   ```
3. **Run tests**
   ```bash
   sfdx force:apex:test:run --testlevel RunLocalTests
   ```
### Development Workflow
- Use Visual Studio Code with Salesforce Extension Pack
- Follow Salesforce best practices for LWC development
- Implement proper error handling and loading states
- Use @wire adapters for reactive data binding
- Follow the component design patterns established in the codebase

## 📊 Features Deep Dive

### Trip Dashboard
- Advanced filtering (upcoming, in progress, completed, yearly view)
- Real-time budget tracking with visual indicators
- Companion avatars and trip statistics
- Quick action buttons for common tasks

### Interactive Maps
- Custom category-based markers with SVG icons
- Dynamic zoom levels with responsive marker sizing
- Drag-and-drop itinerary management
- Google Places integration for location search
- Support for both planned and visited places

### Expense Management
- Multi-category expense tracking
- Automatic budget calculation and alerts
- Splitwise integration for group expense sharing
- Visual budget consumption with progress bars
- Export capabilities for expense reports

### Travel Analytics
- Animated statistics with smooth transitions
- Achievement badges and milestones
- Carbon footprint tracking and eco-ratings
- Monthly/seasonal travel patterns
- Favorite destinations analysis

## 🔐 Security Considerations

- All external API calls are server-side through Apex
- Custom settings protect API keys from exposure
- `with sharing` enforced on all controllers
- Input validation and error handling throughout
- Secure handling of user location data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Known Issues & Roadmap

### Current Limitations
- TripAdvisor API has limited free tier
- Google Maps API requires billing account for production
- Splitwise integration requires webhook configuration

### Planned Features
- Offline mode with sync capabilities
- Advanced travel recommendations using AI
- Calendar integration for automatic trip creation
- Travel document management
- Weather integration for trip planning

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Check the [Salesforce Developer Documentation](https://developer.salesforce.com/docs)
- Review the component-specific documentation in the source code

## 🙏 Acknowledgments

- Salesforce Lightning Design System for UI components
- Google Maps Platform for location services
- Amadeus for travel API integration
- TripAdvisor for destination content
- Open source community for inspiration and best practices

---

**Built with ❤️ on the Salesforce Platform**