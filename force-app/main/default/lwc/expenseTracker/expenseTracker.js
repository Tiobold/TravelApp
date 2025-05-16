// expenseTracker.js
import { LightningElement, api, track, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi'; // Import getFieldValue
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { createRecord } from 'lightning/uiRecordApi';
import { NavigationMixin } from 'lightning/navigation'; // Import NavigationMixin
import { refreshApex } from '@salesforce/apex';
import getExpenses from '@salesforce/apex/TripController.getExpenses';
import updateTripTotalSpent from '@salesforce/apex/TripController.updateTripTotalSpent';
import EXPENSE_OBJECT from '@salesforce/schema/Expense__c';
import NAME_FIELD from '@salesforce/schema/Expense__c.Name';
import AMOUNT_FIELD from '@salesforce/schema/Expense__c.Amount__c';
import CATEGORY_FIELD from '@salesforce/schema/Expense__c.Category__c';
import DATE_FIELD from '@salesforce/schema/Expense__c.Date__c';
import TRIP_FIELD from '@salesforce/schema/Expense__c.Trip__c';
import NUM_OF_TRAVELERS_FIELD from '@salesforce/schema/Trip__c.Number_of_Travellers__c';

// Import schema fields for Trip Budget and Total Spent
import TRIP_BUDGET_FIELD from '@salesforce/schema/Trip__c.Budget__c';
import TRIP_TOTAL_SPENT_FIELD from '@salesforce/schema/Trip__c.Total_Spent__c';

const TRIP_FIELDS = [TRIP_BUDGET_FIELD, TRIP_TOTAL_SPENT_FIELD, NUM_OF_TRAVELERS_FIELD]; // Use imported fields

const columns = [
    { label: 'Expense Name', fieldName: 'Name', type: 'text' },
    { label: 'Amount', fieldName: 'Amount__c', type: 'currency' },
    { label: 'Category', fieldName: 'Category__c', type: 'text' },
    { label: 'Date', fieldName: 'Date__c', type: 'date-local', typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric'} }, // Use date-local for better display
    {
        label: 'Actions',
        type: 'action',
        typeAttributes: { rowActions: [
            { label: 'View', name: 'view' }
            // Removed sync for simplicity based on your code, add back if needed
            // { label: 'Sync with Splitwise', name: 'sync' }
        ]}
    }
];

// --- Use NavigationMixin ---
export default class ExpenseTracker extends NavigationMixin(LightningElement) {
    @api recordId; // Trip record Id
    @track allExpenses = []; // Store all fetched expenses
    @track filteredExpenses = []; // Store expenses to display in datatable
    @track error;
    @track showNewExpenseModal = false;
    @track isLoading = false;
    @track selectedCategory = ''; // Initialize selectedCategory
    @track selectedExpenseId;

    // Trip data properties
    trip; // To store the wired trip record

    // Form fields
    @track expenseName = '';
    @track expenseAmount = null; // Initialize as null for number input
    @track expenseDate = new Date().toISOString().split('T')[0];
    @track expenseCategory = '';

    // Datatable columns
    columns = columns;

    // Category options - Ensure these match your Expense__c.Category__c picklist values
    categoryOptions = [
        { label: 'All Categories', value: '' }, // Add 'All Categories' option
        { label: 'Transportation', value: 'Transportation' },
        { label: 'Accommodation', value: 'Accommodation' },
        { label: 'Food', value: 'Food' }, // Ensure value matches picklist API name
        { label: 'Entertainment', value: 'Entertainment' },
        { label: 'Shopping', value: 'Shopping' },
        { label: 'Other', value: 'Other' }
        // Add more categories as needed
    ];

    // Wire Trip Data
    @wire(getRecord, { recordId: '$recordId', fields: TRIP_FIELDS })
    wiredTripData({ error, data }) {
         if (data) {
            this.trip = data;
            this.error = undefined;
            this.loadExpenses(); // Load expenses once trip data is available
        } else if (error) {
            this.error = error;
            this.trip = undefined;
            console.error('Error loading trip:', JSON.stringify(error));
            this.showToast('Error', 'Could not load trip details.', 'error');
        }
    }

    connectedCallback() {
        // Load expenses initially if recordId is already available
        // The wire service might load after connectedCallback, so loading in the wire handler is safer
         if (this.recordId) {
             // this.loadExpenses(); // Moved to wire handler
         }
    }

    async loadExpenses() {
        this.isLoading = true;
        this.error = undefined; // Clear previous errors
        try {
            const result = await getExpenses({ tripId: this.recordId });
            this.allExpenses = result || []; // Store all expenses
            this.filterExpenses(); // Apply current filter (initially shows all)
        } catch (error) {
            this.error = error;
            this.allExpenses = []; // Clear data on error
            this.filteredExpenses = [];
            console.error('Error loading expenses:', JSON.stringify(error));
            this.showToast('Error', 'Error loading expenses.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleExpenseChange() {
        try {            
            this.isLoading = true;
            await updateTripTotalSpent({ tripId: this.recordId });
            
            // Refresh the trip data to get updated total spent
            await refreshApex(this.wiredTripData);
        } catch (error) {
            console.error('Error updating trip total spent:', JSON.stringify(error));
            this.showToast('Error', 'Failed to update trip total.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // New Expense Modal Handlers
    handleNewExpense() {
        this.resetForm(); // Reset form before showing
        this.showNewExpenseModal = true;
    }

    handleCloseModal() {
        this.showNewExpenseModal = false;
    }

    // Form Field Handlers
    handleNameChange(event) { this.expenseName = event.target.value; }
    handleAmountChange(event) {
        // Ensure amount is stored as a number or null
        const val = event.target.value;
        this.expenseAmount = (val === '' || isNaN(parseFloat(val))) ? null : parseFloat(val);
    }
    handleDateChange(event) { this.expenseDate = event.target.value; }
    handleCategoryChange(event) { this.expenseCategory = event.detail.value; }

    // Save Expense Handler
    async handleSaveExpense() {
        if (!this.validateForm()) {
            return;
        }
    
        this.isLoading = true;
        const fields = {};
        fields[NAME_FIELD.fieldApiName] = this.expenseName;
        fields[AMOUNT_FIELD.fieldApiName] = this.expenseAmount;
        fields[CATEGORY_FIELD.fieldApiName] = this.expenseCategory;
        fields[DATE_FIELD.fieldApiName] = this.expenseDate;
        fields[TRIP_FIELD.fieldApiName] = this.recordId;
    
        const recordInput = { apiName: EXPENSE_OBJECT.objectApiName, fields };
    
        try {
            await createRecord(recordInput);
            this.showToast('Success', 'Expense added successfully', 'success');
            this.handleCloseModal(); // Close modal first
            await this.loadExpenses(); // Then reload expenses
            
            // Update trip total spent
            await this.handleExpenseChange();
        } catch (error) {
            console.error('Error saving expense:', JSON.stringify(error));
            this.error = error; // Store error object
            this.showToast('Error Saving Expense', this.errorText, 'error'); // Use getter for message
        } finally {
            this.isLoading = false;
        }
    }

    // Form Validation
    validateForm() {
        const allValid = [...this.template.querySelectorAll('lightning-input, lightning-combobox')]
            .reduce((validSoFar, inputCmp) => {
                 // Check validity only for inputs inside the modal
                 if(inputCmp.closest('.slds-modal')) {
                     inputCmp.reportValidity();
                     return validSoFar && inputCmp.checkValidity();
                 }
                 return validSoFar;
            }, true);

        if (!allValid) {
            this.showToast('Error', 'Please fill all required fields correctly.', 'error');
        }
        return allValid;
    }

    // Reset Form Fields
    resetForm() {
        this.expenseName = '';
        this.expenseAmount = null; // Reset to null
        this.expenseDate = new Date().toISOString().split('T')[0]; // Default to today
        this.expenseCategory = ''; // Reset category
        this.error = undefined; // Clear any previous save errors
    }

    // Datatable Row Action Handler
    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        switch (actionName) {
            case 'view':
                this.navigateToExpense(row.Id);
                break;
            // Add other actions like 'edit', 'delete' if needed
            default:
                console.warn(`Unhandled row action: ${actionName}`);
        }
    }

    // Navigation to Expense Record
    navigateToExpense(expenseId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: expenseId,
                objectApiName: EXPENSE_OBJECT.objectApiName, // Use schema import
                actionName: 'view'
            }
        });
    }

    // Filter Expenses Logic
    handleCategoryFilter(event) {
        this.selectedCategory = event.detail.value;
        this.filterExpenses();
    }

    filterExpenses() {
         if (this.selectedCategory) {
            // Filter from the master list
            this.filteredExpenses = this.allExpenses.filter(expense =>
                expense.Category__c === this.selectedCategory
            );
        } else {
            // If no category selected, show all
            this.filteredExpenses = [...this.allExpenses]; // Use spread to create a shallow copy
        }
    }

    // Toast Utility
    showToast(title, message, variant = 'info', mode = 'dismissable') {
        const event = new ShowToastEvent({ title, message, variant, mode });
        this.dispatchEvent(event);
    }

    // --- Getters for Budget Overview ---

    // Use getFieldValue for wired data access (safer)
    get budget() {
        return getFieldValue(this.trip, TRIP_BUDGET_FIELD) ?? 0; // Default to 0 if null/undefined
    }

    // Calculate total spent from the *original* unfiltered list
    get totalSpent() {
        // Use the value from the Trip record directly, which is already calculated as personal share
        return getFieldValue(this.trip, TRIP_TOTAL_SPENT_FIELD) ?? 0;
    }

    get numberOfTravelers() {
        return getFieldValue(this.trip, NUM_OF_TRAVELERS_FIELD) ?? 1; // Default to 1 if null
    }
    
    get totalGroupExpenses() {
        // Calculate the total expenses before dividing by travelers
        return this.allExpenses.reduce((total, expense) => {
            const amount = expense.Amount__c ?? 0;
            return total + amount;
        }, 0);
    }

    get budgetProgress() {
        const budgetVal = this.budget; // Use getter which defaults to 0
        if (!budgetVal || budgetVal === 0) return 0; // Avoid division by zero
        const progress = (this.totalSpent / budgetVal) * 100;
        return Math.min(Math.max(progress, 0), 100); // Clamp between 0 and 100
    }

    get budgetProgressVariant() {
        const progress = this.budgetProgress;
        // Instead of using 'success', 'warning', 'expired', use direct class names
        if (progress > 90) return 'danger';        // Red
        if (progress > 70) return 'warning';       // Yellow
        return 'base-blue';                        // Blue (custom class we'll add)
    }

    get isOverBudget() {
        return this.totalSpent > this.budget;
    }

    // --- NEW GETTER ---
    get isWithinBudget() {
        // Provides the negation needed for the template
        return !this.isOverBudget;
    }
    // --- END NEW GETTER ---

    get remainingBudget() {
        // Calculate remaining, ensuring it's not negative
        return Math.max(this.budget - this.totalSpent, 0);
    }

    // Getter for error message display
     get errorText() {
        if (!this.error) return '';
        if (this.error.body?.message) { return this.error.body.message; }
        if (this.error.message) { return this.error.message; }
        if (typeof this.error === 'string') { return this.error; }
        try { return JSON.stringify(this.error); } catch(e) { return 'An unknown error occurred.'; }
    }

    // Getter for the data passed to lightning-datatable
    get expensesForDataTable() {
        return this.filteredExpenses; // Pass the filtered list to the datatable
    }
    get progressBarStyle() {
    return `height: 8px; width: 100%; background-color: #e0e5ee; border-radius: 4px; overflow: hidden;`;
}

    get progressBarValueStyle() {
        const progress = this.budgetProgress;
        let color = 'rgb(21, 137, 238)'; // Blue for < 70%
        
        if (progress > 90) {
            color = 'rgb(254, 92, 76)'; // Red
        } else if (progress > 70) {
            color = 'rgb(255, 183, 93)'; // Yellow
        }
        
        return `display: block; height: 100%; width: ${progress}%; background-color: ${color};`;
    }
}