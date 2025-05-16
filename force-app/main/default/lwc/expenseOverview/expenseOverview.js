import { LightningElement, api, track, wire } from 'lwc';
import getExpenseBreakdown from '@salesforce/apex/TripDashboardController.getExpenseBreakdown';

export default class ExpenseOverview extends LightningElement {
    @api recordId; // Optional - to filter expenses by trip if needed
    
    @track currentMonthExpenses = 0;
    @track lastMonthExpenses = 0;
    @track topExpenseCategories = [];
    @track isLoading = false;
    @track error;
    

    @wire(getExpenseBreakdown)
    wiredExpenses({ error, data }) {
        this.isLoading = true;
        if (data) {
            this.processExpenseData(data);
            this.error = undefined;
        } else if (error) {
            console.error('Error loading expense data:', error);
            this.error = error;
            // Load sample data if API call fails
            this.loadSampleExpenseData();
        }
        this.isLoading = false;
    }
    
    connectedCallback() {
        // For demo purposes, load sample data
        this.loadSampleExpenseData();
    }
    
    // Process expense data from API
    processExpenseData(data) {
        if (data.currentMonth) {
            this.currentMonthExpenses = data.currentMonth;
        }
        
        if (data.lastMonth) {
            this.lastMonthExpenses = data.lastMonth;
        }
        
        if (data.categories && data.categories.length > 0) {
            this.topExpenseCategories = data.categories.map(cat => {
                // Calculate percentage for width
                const percentage = cat.percentage || (cat.amount / data.total * 100);
                return {
                    ...cat,
                    style: `width: ${percentage}%; background-color: ${this.getCategoryColor(cat.name)};`
                };
            });
        }
    }
    
    // Load sample expense data for demonstration
    loadSampleExpenseData() {
        this.currentMonthExpenses = 587.50;
        this.lastMonthExpenses = 943.25;
        
        this.topExpenseCategories = [
            {
                id: 'cat1',
                name: 'Accommodation',
                amount: 620.00,
                percentage: 40.5,
                style: 'width: 40.5%; background-color: #1a73e8;'
            },
            {
                id: 'cat2',
                name: 'Food',
                amount: 350.50,
                percentage: 22.9,
                style: 'width: 22.9%; background-color: #34a853;'
            },
            {
                id: 'cat3',
                name: 'Transportation',
                amount: 285.25,
                percentage: 18.6,
                style: 'width: 18.6%; background-color: #fbbc04;'
            },
            {
                id: 'cat4',
                name: 'Activities',
                amount: 215.00,
                percentage: 14.0,
                style: 'width: 14.0%; background-color: #ea4335;'
            },
            {
                id: 'cat5',
                name: 'Shopping',
                amount: 60.00,
                percentage: 3.9,
                style: 'width: 3.9%; background-color: #9334e6;'
            }
        ];
    }
    
    // Get color for expense category
    getCategoryColor(category) {
        const colorMap = {
            'Accommodation': '#1a73e8',
            'Food': '#34a853',
            'Transportation': '#fbbc04',
            'Activities': '#ea4335',
            'Shopping': '#9334e6',
            'Other': '#5f6368'
        };
        
        return colorMap[category] || '#5f6368';
    }
}