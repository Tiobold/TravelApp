import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getTravelStats from '@salesforce/apex/TravelStatsController.getTravelStats';

export default class TravelStats extends LightningElement {
    @track isLoading = true;
    @track travelStats = {};
    @track animatedStats = {
        totalDistance: 0,
        totalTrips: 0,
        countriesVisited: 0,
        totalDaysAbroad: 0,
        carbonFootprint: 0,
        travelStreak: 0
    };

    // Animation control
    animationDuration = 2000; // 2 seconds
    animationStartTime = null;
    
    @wire(getTravelStats)
    wiredStats({ error, data }) {
        if (data) {
            this.travelStats = data;
            this.startAnimations();
            this.isLoading = false;
        } else if (error) {
            console.error('Error fetching travel stats:', error);
            this.isLoading = false;
        }
    }

    renderedCallback() {
        if (this.travelStats && Object.keys(this.travelStats).length > 0 && !this.animationStartTime) {
            this.startAnimations();
        }
    }

    startAnimations() {
        if (this.animationStartTime) return; // Prevent multiple animations
        
        this.animationStartTime = Date.now();
        this.animateCounters();
        this.animateProgressBars();
        this.animateGlobe();
    }

    animateCounters() {
        const animate = () => {
            const elapsed = Date.now() - this.animationStartTime;
            const progress = Math.min(elapsed / this.animationDuration, 1);
            
            // Easing function for smooth animation
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            
            this.animatedStats = {
                totalDistance: Math.floor(this.travelStats.totalDistance * easeOutCubic),
                totalTrips: Math.floor(this.travelStats.totalTrips * easeOutCubic),
                countriesVisited: Math.floor(this.travelStats.countriesVisited * easeOutCubic),
                totalDaysAbroad: Math.floor(this.travelStats.totalDaysAbroad * easeOutCubic),
                carbonFootprint: Math.floor(this.travelStats.carbonFootprint * easeOutCubic),
                travelStreak: Math.floor(this.travelStats.travelStreak * easeOutCubic)
            };

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    animateProgressBars() {
        const progressBars = this.template.querySelectorAll('.progress-bar');
        progressBars.forEach((bar, index) => {
            setTimeout(() => {
                bar.style.width = bar.dataset.progress + '%';
            }, index * 200);
        });
    }

    animateGlobe() {
        const globe = this.template.querySelector('.globe-icon');
        if (globe) {
            globe.classList.add('spinning');
        }
    }

    refreshStats() {
        this.isLoading = true;
        this.animationStartTime = null;
        return refreshApex(this.wiredStats);
    }

    // Getters for formatted values
    get formattedDistance() {
        return (this.animatedStats.totalDistance / 1000).toLocaleString('en-US', {
            maximumFractionDigits: 0
        }) + 'K';
    }

    get formattedCarbon() {
        return (this.animatedStats.carbonFootprint / 1000).toLocaleString('en-US', {
            maximumFractionDigits: 1
        }) + 'T';
    }

    get nextMilestone() {
        const nextCountryMilestone = Math.ceil(this.travelStats.countriesVisited / 5) * 5;
        return {
            type: 'countries',
            current: this.travelStats.countriesVisited,
            target: nextCountryMilestone,
            progress: (this.travelStats.countriesVisited / nextCountryMilestone) * 100
        };
    }

    get achievementBadges() {
        const badges = [];
        if (this.travelStats.totalTrips >= 10) badges.push({ name: 'Globe Trotter', icon: 'utility:world' });
        if (this.travelStats.countriesVisited >= 20) badges.push({ name: 'World Explorer', icon: 'utility:map' });
        if (this.travelStats.travelStreak >= 6) badges.push({ name: 'Travel Addict', icon: 'utility:favorite' });
        if (this.travelStats.totalDaysAbroad >= 100) badges.push({ name: 'Digital Nomad', icon: 'utility:plane' });
        return badges;
    }

    get ecoRating() {
        // Calculate eco-friendliness based on carbon footprint per trip
        const avgCarbonPerTrip = this.travelStats.carbonFootprint / this.travelStats.totalTrips;
        if (avgCarbonPerTrip < 500) return { rating: 'A+', color: 'success' };
        if (avgCarbonPerTrip < 1000) return { rating: 'A', color: 'success' };
        if (avgCarbonPerTrip < 2000) return { rating: 'B', color: 'warning' };
        return { rating: 'C', color: 'error' };
    }
}