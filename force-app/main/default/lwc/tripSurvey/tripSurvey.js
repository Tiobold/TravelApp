import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import validateSurveyToken from '@salesforce/apex/TripPlannerController.validateSurveyToken';
import submitSurveyResponse from '@salesforce/apex/TripPlannerController.submitSurveyResponse';

export default class TripSurvey extends LightningElement {
    @track currentStep = 1;
    @track totalSteps = 1;
    @track isLoading = true;
    @track isSubmitting = false;
    @track surveyToken = '';
    @track surveyInfo = {};
    @track error = '';
    @track isCompleted = false;
    
    // Dynamic survey data
    @track surveyQuestions = [];
    @track responses = new Map();
    
    connectedCallback() {
        console.log('DynamicTripSurvey component connected');
        this.extractTokenFromUrl();
        this.loadSurveyInfo();
    }
    
    extractTokenFromUrl() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            this.surveyToken = urlParams.get('token') || '';
            
            // If no token in URL params, try to get from hash
            if (!this.surveyToken) {
                const hash = window.location.hash;
                if (hash && hash.includes('token=')) {
                    const hashParams = new URLSearchParams(hash.substring(1));
                    this.surveyToken = hashParams.get('token') || '';
                }
            }
            
            if (!this.surveyToken) {
                this.error = 'Invalid survey link. Please check the URL.';
                this.isLoading = false;
            }
        } catch (error) {
            console.error('Error extracting token from URL:', error);
            this.error = 'Unable to process survey link. Please try again.';
            this.isLoading = false;
        }
    }
    
    async loadSurveyInfo() {
        if (!this.surveyToken) return;
        
        try {
            const result = await validateSurveyToken({ token: this.surveyToken });
            
            if (result.success) {
                this.surveyInfo = result.surveyInfo;
                this.surveyQuestions = result.surveyInfo.questions || [];
                this.totalSteps = Math.max(1, this.surveyQuestions.length);
                
                // Initialize responses map
                this.responses = new Map();
                this.surveyQuestions.forEach(question => {
                    this.responses.set(question.id, null);
                });
                
                // Pre-fill companion name if available
                if (this.surveyInfo.companionName) {
                    const nameQuestion = this.surveyQuestions.find(q => 
                        q.questionText.toLowerCase().includes('name')
                    );
                    if (nameQuestion) {
                        this.responses.set(nameQuestion.id, this.surveyInfo.companionName);
                    }
                }
                
                this.error = '';
            } else {
                this.error = result.error || 'Invalid survey link';
            }
        } catch (error) {
            console.error('Error loading survey info:', error);
            this.error = 'Failed to load survey information';
        } finally {
            this.isLoading = false;
        }
    }
    
    // Handle response change based on question type
    handleResponseChange(event) {
        const questionId = event.target.dataset.questionId;
        const questionType = event.target.dataset.questionType;
        let value = null;
        
        switch (questionType) {
            case 'Single Choice':
                if (event.target.type === 'radio') {
                    value = event.target.value;
                } else {
                    // For clickable cards
                    value = event.currentTarget.dataset.value;
                }
                break;
            case 'Multiple Choice':
                // Handle checkbox changes
                const currentValues = this.responses.get(questionId) || [];
                if (event.target.checked) {
                    currentValues.push(event.target.value);
                } else {
                    const index = currentValues.indexOf(event.target.value);
                    if (index > -1) {
                        currentValues.splice(index, 1);
                    }
                }
                value = currentValues;
                break;
            case 'Text':
            case 'Long Text':
            case 'Email':
                value = event.target.value;
                break;
            case 'Number':
                value = parseFloat(event.target.value) || null;
                break;
            case 'Date':
                value = event.target.value;
                break;
            default:
                value = event.target.value;
        }
        
        this.responses.set(questionId, value);
        console.log('Response updated:', questionId, '=', value);
    }
    
    // Navigation
    handleNext() {
        if (this.validateCurrentStep()) {
            if (this.currentStep < this.totalSteps) {
                this.currentStep++;
            } else {
                this.handleSubmit();
            }
        }
    }
    
    handlePrevious() {
        if (this.currentStep > 1) {
            this.currentStep--;
        }
    }
    
    validateCurrentStep() {
        const currentQuestion = this.currentQuestionData;
        if (!currentQuestion) return true;
        
        const response = this.responses.get(currentQuestion.id);
        
        // Check if required question has a response
        if (currentQuestion.isRequired) {
            if (response === null || response === undefined || response === '') {
                this.showToast('Error', `Please answer: ${currentQuestion.questionText}`, 'error');
                return false;
            }
            
            // Special validation for different question types
            if (currentQuestion.questionType === 'Email' && !this.isValidEmail(response)) {
                this.showToast('Error', 'Please enter a valid email address', 'error');
                return false;
            }
            
            if (currentQuestion.questionType === 'Number' && (isNaN(response) || response <= 0)) {
                this.showToast('Error', 'Please enter a valid number', 'error');
                return false;
            }
        }
        
        return true;
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    async handleSubmit() {
        this.isSubmitting = true;
        
        try {
            // Convert Map to Object for serialization
            const responseObj = {};
            for (const [key, value] of this.responses) {
                const question = this.surveyQuestions.find(q => q.id === key);
                if (question) {
                    // Create a more readable key based on question text
                    let responseKey = this.generateResponseKey(question.questionText);
                    responseObj[responseKey] = value;
                }
            }
            
            const responseData = JSON.stringify(responseObj);
            const result = await submitSurveyResponse({
                token: this.surveyToken,
                responseData: responseData
            });
            
            if (result.success) {
                this.isCompleted = true;
                this.showToast('Success', result.message, 'success');
            } else {
                this.showToast('Error', result.message, 'error');
            }
        } catch (error) {
            console.error('Error submitting survey:', error);
            this.showToast('Error', 'Failed to submit survey. Please try again.', 'error');
        } finally {
            this.isSubmitting = false;
        }
    }
    
    generateResponseKey(questionText) {
        // Convert question text to a usable response key
        if (questionText.toLowerCase().includes('interested in participating')) {
            return 'wantsToParticipate';
        } else if (questionText.toLowerCase().includes('how long')) {
            return 'preferredDuration';
        } else if (questionText.toLowerCase().includes('budget')) {
            return 'budget';
        } else if (questionText.toLowerCase().includes('earliest') && questionText.toLowerCase().includes('departure')) {
            return 'earliestDepartureDate';
        } else if (questionText.toLowerCase().includes('latest') && questionText.toLowerCase().includes('back home')) {
            return 'latestReturnDate';
        } else if (questionText.toLowerCase().includes('additional notes')) {
            return 'additionalNotes';
        } else if (questionText.toLowerCase().includes('name')) {
            return 'fullName';
        } else if (questionText.toLowerCase().includes('email')) {
            return 'email';
        } else {
            // Generate a key from question text
            return questionText.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        }
    }
    
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
    
    // Getters
    get showSurveyForm() {
        return !this.isLoading && !this.error && !this.isCompleted && this.surveyQuestions.length > 0;
    }
    
    get progressPercentage() {
        return Math.round((this.currentStep / this.totalSteps) * 100);
    }
    
    get progressStyle() {
        return `width: ${this.progressPercentage}%;`;
    }
    
    get isFirstStep() {
        return this.currentStep === 1;
    }
    
    get isLastStep() {
        return this.currentStep === this.totalSteps;
    }
    
    get currentQuestionData() {
        return this.surveyQuestions[this.currentStep - 1] || null;
    }
    
    get formattedTentativeStartDate() {
        if (this.surveyInfo.tentativeStartDate) {
            return new Date(this.surveyInfo.tentativeStartDate).toLocaleDateString();
        }
        return '';
    }
    
    get formattedTentativeEndDate() {
        if (this.surveyInfo.tentativeEndDate) {
            return new Date(this.surveyInfo.tentativeEndDate).toLocaleDateString();
        }
        return '';
    }
    
    get minDepartureDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }
    
    get minReturnDate() {
        const currentQuestion = this.currentQuestionData;
        if (currentQuestion && currentQuestion.questionText.toLowerCase().includes('latest')) {
            // For return date questions, find the earliest departure date response
            const departureQuestion = this.surveyQuestions.find(q => 
                q.questionText.toLowerCase().includes('earliest') && 
                q.questionText.toLowerCase().includes('departure')
            );
            if (departureQuestion) {
                const departureDate = this.responses.get(departureQuestion.id);
                if (departureDate) {
                    const minReturn = new Date(departureDate);
                    minReturn.setDate(minReturn.getDate() + 1);
                    return minReturn.toISOString().split('T')[0];
                }
            }
        }
        return this.minDepartureDate;
    }
    
    // Helper methods for template
    getCurrentResponse(questionId) {
        return this.responses.get(questionId) || '';
    }
    
    isOptionSelected(questionId, optionValue) {
        const response = this.responses.get(questionId);
        if (Array.isArray(response)) {
            return response.includes(optionValue);
        }
        return response === optionValue;
    }
    
    getCardClass(questionId, optionValue) {
        const isSelected = this.isOptionSelected(questionId, optionValue);
        return isSelected ? 'option-card selected' : 'option-card';
    }
    
    isChecked(questionId, optionValue) {
        const response = this.responses.get(questionId);
        if (Array.isArray(response)) {
            return response.includes(optionValue);
        }
        return response === optionValue;
    }
    
    // Additional getters for template logic
    get currentResponse() {
        if (!this.currentQuestionData) return '';
        return this.responses.get(this.currentQuestionData.id) || '';
    }
    
    get isTextQuestion() {
        return this.currentQuestionData && this.currentQuestionData.questionType === 'Text';
    }
    
    get isEmailQuestion() {
        return this.currentQuestionData && this.currentQuestionData.questionType === 'Email';
    }
    
    get isNumberQuestion() {
        return this.currentQuestionData && this.currentQuestionData.questionType === 'Number';
    }
    
    get isDateQuestion() {
        return this.currentQuestionData && this.currentQuestionData.questionType === 'Date';
    }
    
    get isLongTextQuestion() {
        return this.currentQuestionData && this.currentQuestionData.questionType === 'Long Text';
    }
    
    get isSingleChoiceQuestion() {
        return this.currentQuestionData && 
               this.currentQuestionData.questionType === 'Single Choice' && 
               this.currentQuestionData.options && 
               this.currentQuestionData.options.length > 0;
    }
    
    get isMultipleChoiceQuestion() {
        return this.currentQuestionData && 
               this.currentQuestionData.questionType === 'Multiple Choice' && 
               this.currentQuestionData.options && 
               this.currentQuestionData.options.length > 0;
    }
    
    get hasOptionsCards() {
        // Use option cards for duration preferences to match the original design
        return this.currentQuestionData && 
               this.currentQuestionData.questionText && 
               this.currentQuestionData.questionText.toLowerCase().includes('how long');
    }
    
    get optionCardClass() {
        const questionId = this.currentQuestionData?.id;
        const response = this.responses.get(questionId);
        return response ? 'option-card selected' : 'option-card';
    }
    
    get isRadioChecked() {
        // This should be implemented in the template for each option individually
        return false;
    }
    
    get isCheckboxChecked() {
        // This should be implemented in the template for each option individually
        return false;
    }
    
    get questionMinDate() {
        if (!this.currentQuestionData) return this.minDepartureDate;
        
        const questionText = this.currentQuestionData.questionText.toLowerCase();
        if (questionText.includes('latest') && questionText.includes('back home')) {
            return this.minReturnDate;
        }
        return this.minDepartureDate;
    }
    
    get showDeclineMessage() {
        // Show decline message if user answered "No" to participation question
        const participationQuestion = this.surveyQuestions.find(q => 
            q.questionText.toLowerCase().includes('interested in participating')
        );
        
        if (participationQuestion) {
            const response = this.responses.get(participationQuestion.id);
            return response === 'No';
        }
        return false;
    }
}