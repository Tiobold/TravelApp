# Salesforce Travel App

A comprehensive travel management application built on the Salesforce platform to help users plan trips, track expenses, visualize itineraries, and discover destination information.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Components](#components)
  - [Trip Dashboard](#trip-dashboard)
  - [Trip Map](#trip-map)
  - [Expense Tracker](#expense-tracker)
  - [Trip Planner](#trip-planner)
  - [Trip Articles](#trip-articles)
  - [Trip Companions](#trip-companions)
- [Technical Implementation](#technical-implementation)
- [Apex Controllers](#apex-controllers)
- [External APIs](#external-apis)
- [Installation](#installation)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Trip Dashboard**: Visualize all trips with budget statistics and progress indicators
- **Interactive Mapping**: Display trip locations on an interactive map with custom markers
- **Itinerary Planning**: Create and manage detailed itineraries with location search
- **Expense Tracking**: Track expenses by category with budget visualization
- **Travel Companions**: Invite and manage travel companions
- **Destination Guides**: Get destination information from TripAdvisor
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Architecture

The app is built using a modern Salesforce tech stack:

- **Lightning Web Components (LWC)**: Fast, modular UI components
- **Apex Controllers**: Secure server-side processing
- **Custom Objects**: Storing trip data, expenses, itineraries, etc.
- **External APIs**: Google Maps, TripAdvisor for location and travel content
- **SFDX Project Structure**: Organized development workflow

## Components

### Trip Dashboard

The central hub for viewing and managing all trips. Features include:

- Overview of all trips with filterable status views
- Budget and expense statistics
- Trip cards with progress indicators for budget utilization
- Quick access to trip details, maps, and expenses

### Trip Map

Interactive map visualization for trip locations:

- Map displays all itinerary items and visited places
- Custom markers based on location category
- Dynamic zoom controls and marker selection
- Detailed daily itinerary view with activity breakdown
- Add new locations via Google Places API integration

### Expense Tracker

Complete expense management system:

- Track expenses by category
- Visualize budget consumption
- Support for shared expenses with travel companions
- Currency conversion
- Filter expenses by category
- Budget alerts when approaching limit

### Trip Planner

Guided trip creation wizard:

- Create new trips with destination, dates, and budget
- Invite contacts as travel companions
- Send automated invitations
- Track response status

### Trip Articles

Destination information and guides:

- TripAdvisor integration for destination content
- Popular attractions and articles
- Travel tips and local information
- Fallback content when API unavailable

### Trip Companions

Social features for group travel:

- Invite contacts to join trips
- Track companion status (Invited, Confirmed, Declined)
- View companion profile and trip history
- Expense sharing capabilities

## Technical Implementation

### Data Model

The app uses several custom objects:

- **Trip__c**: Stores basic trip information including destination, dates, budget
- **Itinerary_Item__c**: Individual activities, accommodations, and transportation
- **Expense__c**: Trip-related expenses with categories
- **Travel_Companion__c**: Junction object between Trip and Contact
- **Visited_Place__c**: Historical record of places visited

### Lightning Web Components

The UI is built using Lightning Web Components (LWC):

- **tripDashboard**: Main landing page showing all trips
- **tripMap**: Map visualization with itinerary
- **expenseTracker**: Expense management module
- **tripPlanner**: Trip creation wizard
- **tripArticles**: Destination information module
- **tripCompanions**: Travel companion management
- **tripMapView**: Country visualization for visited places

## Apex Controllers

Server-side logic is handled by Apex controllers:

- **TripController**: Main controller for trip-related operations
- **TripDashboardController**: Dashboard-specific operations
- **LocationController**: Handles Google Places API integration
- **TripPlannerController**: Trip creation and companion invitation logic
- **TravelArticlesController**: TripAdvisor API integration
- **TripCompanionController**: Companion management
- **GoogleMapsRepository**: Manages Google Maps API keys

## External APIs

The app integrates with external services:

- **Google Maps/Places API**: Location search, geocoding, and mapping
- **TripAdvisor API**: Destination information and attractions
- **Splitwise API** (optional): Expense sharing integration

## Installation

### Prerequisites

- Salesforce org with Lightning Experience enabled
- API access to Google Maps and TripAdvisor (optional)

### Deployment

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/travel-app.git
   cd travel-app

2. Authorize your Salesforce org:
```bash
sfdx auth:web:login -a YourOrgAlias
```

3. Deploy the app:
```bash
sfdx force:source:deploy -p force-app
```

4. Create API keys:
   - Navigate to Setup > Custom Settings > Google Maps API Settings
   - Enter your Google Maps API key

5. Assign permission sets:
```bash
sfdx force:user:permset:assign -n Travel_App_Admin
```

## Development

### Setting Up Development Environment

1. Install required tools:
   - Salesforce CLI
   - Visual Studio Code
   - Salesforce Extension Pack for VS Code

2. Create a scratch org:
```bash
sfdx force:org:create -f config/project-scratch-def.json -a TravelAppDev
```

3. Push source to the scratch org:
```bash
sfdx force:source:push
```

4. Import sample data:
```bash
sfdx force:data:tree:import -p data/sample-data-plan.json
```

5. Open the scratch org:
```bash
sfdx force:org:open
```

### Development Workflow

1. Create a new feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make changes and test in your scratch org
3. Pull changes from org if needed:
```bash
sfdx force:source:pull
```

4. Run tests:
```bash
sfdx force:apex:test:run
```

5. Commit and push your changes:
```bash
git add .
git commit -m "Description of changes"
git push origin feature/your-feature-name
```