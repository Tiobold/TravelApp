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
    @track isDesignMode = false;
    @track finalResponses = new Map();
    
    // Dynamic survey data
    @track surveyQuestions = [];
    @track responses = new Map();
    
    connectedCallback() {
        console.log('TripSurvey component connected');
        
        // Check if we're in Experience Builder design mode
        this.checkDesignMode();
        
        // If in design mode, show sample data
        if (this.isDesignMode) {
            this.loadSampleData();
            return;
        }
        
        // Normal runtime flow
        this.extractTokenFromUrl();
        
        if (this.surveyToken) {
            this.loadSurveyInfo();
        } else {
            this.error = 'No survey token found in URL. Please check the link.';
            this.isLoading = false;
        }
    }

    renderedCallback() {
        // Only run once
        if (this.hasRendered) return;
        this.hasRendered = true;
        
        // Force a reload
        if (this.surveyToken) {
            console.log('Forcing reload with token:', this.surveyToken);
            this.loadSurveyInfo();
        }
    }
    
    checkDesignMode() {
        // Check for Experience Builder environment
        try {
            // Various ways to detect if we're in the builder
            this.isDesignMode = (
                window.location.href.indexOf('sitepreview') > -1 || 
                window.location.href.indexOf('livepreview') > -1 || 
                window.location.href.indexOf('live-preview') > -1 ||
                window.location.href.indexOf('site-builder') > -1 ||
                document.documentElement.classList.contains('siteforce-Builder')
            );
            
            console.log('Design mode detected:', this.isDesignMode);
        } catch (err) {
            console.log('Error detecting design mode:', err);
            this.isDesignMode = false;
        }
    }
    
    loadSampleData() {
        // Create sample data for Experience Builder preview
        this.isLoading = false;
        this.error = '';
        
        // Sample survey info
        this.surveyInfo = {
            tripName: 'Sample Trip to Paris',
            tentativeStartDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            tentativeEndDate: new Date(new Date().getTime() + 37 * 24 * 60 * 60 * 1000)    // 37 days from now
        };
        
        // Sample questions
        this.surveyQuestions = [
            {
                id: 'q1',
                questionText: 'Are you interested in participating in this trip?',
                questionType: 'Single Choice',
                isRequired: true,
                orderNumber: 1,
                options: ['Yes', 'No']
            },
            {
                id: 'q2',
                questionText: 'For how long would you be able to travel?',
                questionType: 'Single Choice',
                isRequired: true,
                orderNumber: 2,
                options: ['Weekend', '1 Week', '10 Days', 'Any duration is good']
            },
            {
                id: 'q3',
                questionText: 'What is your budget (in Euro)?',
                questionType: 'Number',
                isRequired: true,
                orderNumber: 3
            }
        ];
        
        this.totalSteps = this.surveyQuestions.length;
        
        // Initialize response map
        this.surveyQuestions.forEach(question => {
            this.responses.set(question.id, null);
        });
    }
    
    extractTokenFromUrl() {
        try {
            // First try from URLSearchParams
            const urlParams = new URLSearchParams(window.location.search);
            this.surveyToken = urlParams.get('token') || '';
            
            // If no token in URL params, try to get from hash
            if (!this.surveyToken && window.location.hash) {
                const hash = window.location.hash;
                if (hash && hash.includes('token=')) {
                    const hashParams = new URLSearchParams(hash.substring(1));
                    this.surveyToken = hashParams.get('token') || '';
                }
            }
            
            console.log('Extracted token:', this.surveyToken ? 'Found' : 'Not found');
        } catch (err) {
            console.error('Error extracting token from URL:', err);
            this.error = 'Unable to process survey link. Please try again.';
            this.isLoading = false;
        }
    }
    
    loadSurveyInfo() {
        if (!this.surveyToken) {
            this.error = 'Survey token is missing.';
            this.isLoading = false;
            return;
        }
        
        console.log('Loading survey info with token:', this.surveyToken);
        
        validateSurveyToken({ token: this.surveyToken })
            .then(result => {
                console.log('Survey validation result received:', JSON.stringify(result));
                
                if (result && result.success) {
                    console.log('Survey info object:', JSON.stringify(result.surveyInfo));
                    console.log('Survey questions:', result.surveyInfo && result.surveyInfo.questions ? 
                        JSON.stringify(result.surveyInfo.questions) : 'No questions found');
                    
                    this.surveyInfo = result.surveyInfo || {};
                    this.surveyQuestions = (result.surveyInfo && result.surveyInfo.questions) ? 
                                        result.surveyInfo.questions : [];
                    
                    // Debug after assignment
                    console.log('Component surveyInfo after assignment:', JSON.stringify(this.surveyInfo));
                    console.log('Component surveyQuestions after assignment:', JSON.stringify(this.surveyQuestions));
                    
                    this.totalSteps = Math.max(1, this.surveyQuestions.length);
                    
                    // Initialize responses map
                    this.responses = new Map();
                    this.surveyQuestions.forEach(question => {
                        this.responses.set(question.id, null);
                    });
                    
                    // Debug responses map
                    console.log('Responses initialized for questions:', 
                        Array.from(this.responses.keys()).join(', '));
                    
                    this.error = '';
                } else {
                    this.error = (result && result.error) ? result.error : 'Invalid survey link';
                    console.error('Error in survey result:', this.error);
                }
            })
            .catch(err => {
                console.error('Error in validateSurveyToken:', err);
                this.error = 'Failed to load survey information. Please try again later.';
            })
            .finally(() => {
                this.isLoading = false;
            });
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
        // Skip validation in design mode
        if (this.isDesignMode) {
            return true;
        }
        
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
    
    handleSubmit() {
        // If in design mode, just show completion
        if (this.isDesignMode) {
            this.isCompleted = true;
            return;
        }
        
        if (this.isSubmitting) return;
        
        this.isSubmitting = true;
        
        // Store the final responses before converting to object
        // This creates a copy of responses that will persist after submission
        this.finalResponses = new Map(this.responses);
        
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
        
        console.log('Submitting responses:', JSON.stringify(responseObj));
        
        submitSurveyResponse({
            token: this.surveyToken,
            responseData: JSON.stringify(responseObj)
        })
        .then(result => {
            console.log('Submit result received:', result);
            
            if (result && result.success) {
                // Set isCompleted to true to show the confirmation page
                this.isCompleted = true;
                const message = result.message || 'Thank you for your response!';
                this.showToast('Success', message, 'success');
            } else {
                const errorMsg = (result && result.message) ? result.message : 'Failed to submit survey';
                this.showToast('Error', errorMsg, 'error');
            }
        })
        .catch(err => {
            console.error('Error in submitSurveyResponse:', err);
            this.showToast('Error', 'Failed to submit survey. Please try again later.', 'error');
        })
        .finally(() => {
            this.isSubmitting = false;
        });
    }
    formatResponseForDisplay(questionType, value) {
        if (!value) return 'Not provided';
        
        // Format the response based on question type
        switch (questionType) {
            case 'Number':
                return value + ' Euro';
            case 'Date':
                try {
                    return new Date(value).toLocaleDateString();
                } catch (e) {
                    return value;
                }
            case 'Yes/No':
                return value === true || value === 'true' || value === 'Yes' ? 'Yes' : 'No';
            default:
                return value;
        }
    }
    
    generateResponseKey(questionText) {
        // Defensive check
        if (!questionText) return 'question';
        
        // Convert question text to a usable response key
        const lowerText = questionText.toLowerCase();
        
        if (lowerText.includes('interested in participating')) {
            return 'wantsToParticipate';
        } else if (lowerText.includes('how long')) {
            return 'preferredDuration';
        } else if (lowerText.includes('budget')) {
            return 'budget';
        } else if (lowerText.includes('earliest') && lowerText.includes('departure')) {
            return 'earliestDepartureDate';
        } else if (lowerText.includes('latest') && lowerText.includes('back home')) {
            return 'latestReturnDate';
        } else if (lowerText.includes('additional notes')) {
            return 'additionalNotes';
        } else if (lowerText.includes('name')) {
            return 'fullName';
        } else if (lowerText.includes('email')) {
            return 'email';
        } else {
            // Generate a key from question text
            return questionText.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        }
    }
    
    showToast(title, message, variant) {
        // Skip showing toast in design mode
        if (this.isDesignMode) {
            console.log(`[Toast ${variant}]: ${title} - ${message}`);
            return;
        }
        
        if (!message) message = ''; // Ensure message is not undefined
        
        try {
            const event = new ShowToastEvent({
                title: title || '',
                message: message,
                variant: variant || 'info'
            });
            this.dispatchEvent(event);
        } catch (err) {
            console.error('Error showing toast:', err);
        }
    }
    
    // Getters
    get showSurveyForm() {
        return (!this.isLoading && !this.error && !this.isCompleted && this.surveyQuestions.length > 0) || 
               (this.isDesignMode && !this.isCompleted);
    }
    
    get progressPercentage() {
        return Math.round((this.currentStep / Math.max(1, this.totalSteps)) * 100);
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
        if (this.surveyQuestions.length === 0) return null;
        return this.surveyQuestions[Math.min(this.currentStep - 1, this.surveyQuestions.length - 1)];
    }
    
    get formattedTentativeStartDate() {
        if (this.surveyInfo && this.surveyInfo.tentativeStartDate) {
            return new Date(this.surveyInfo.tentativeStartDate).toLocaleDateString();
        }
        return '';
    }
    
    get formattedTentativeEndDate() {
        if (this.surveyInfo && this.surveyInfo.tentativeEndDate) {
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
        if (currentQuestion && currentQuestion.questionText && 
            currentQuestion.questionText.toLowerCase().includes('latest')) {
            // For return date questions, find the earliest departure date response
            const departureQuestion = this.surveyQuestions.find(q => {
                return q.questionText && 
                       q.questionText.toLowerCase().includes('earliest') && 
                       q.questionText.toLowerCase().includes('departure');
            });
            
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
        console.log('Checking if option is selected:', questionId, optionValue);
        const response = this.responses.get(questionId);
        console.log('Current response:', response);
        
        if (Array.isArray(response)) {
            return response.includes(optionValue);
        }
        return response === optionValue;
    }
    
    getCardClass(questionId, optionValue) {
        const isSelected = this.isOptionSelected(questionId, optionValue);
        return isSelected ? 'option-card selected' : 'option-card';
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
            (this.currentQuestionData.questionType === 'Single Choice' || 
                this.currentQuestionData.questionType === 'Yes/No');
    }
    
    get isMultipleChoiceQuestion() {
        return this.currentQuestionData && 
               this.currentQuestionData.questionType === 'Multiple Choice' && 
               this.currentQuestionData.options && 
               this.currentQuestionData.options.length > 0;
    }
    
    get hasOptionsCards() {
        // Check both question and questionText exist
        if (!this.currentQuestionData || !this.currentQuestionData.questionText) {
            return false;
        }
        
        // Use option cards for duration preferences to match the original design
        return this.currentQuestionData.questionText.toLowerCase().includes('how long');
    }
    
    get showDeclineMessage() {
        // Show decline message if user answered "No" to participation question
        const participationQuestion = this.surveyQuestions.find(q => {
            return q.questionText && q.questionText.toLowerCase().includes('interested in participating');
        });
        
        if (participationQuestion) {
            const response = this.responses.get(participationQuestion.id);
            return response === 'No';
        }
        return false;
    }
    
    // Design mode display text
    get designModeText() {
        return this.isDesignMode ? '(Preview Mode)' : '';
    }

    // Debug mode toggle (set to true during development, false in production)
    get isDebugMode() {
        return false; // Set to true to show debug panel
    }

    // Helper for showing options in debug panel
    get optionsDebugText() {
        if (this.currentQuestionData && this.currentQuestionData.options) {
            return JSON.stringify(this.currentQuestionData.options);
        }
        return 'No options';
    }

    // Helper for showing responses in debug panel
    get responsesDebugText() {
        const responseObj = {};
        for (const [key, value] of this.responses) {
            responseObj[key] = value;
        }
        return JSON.stringify(responseObj, null, 2);
    }

    get finalResponsesDebugText() {
        const responseObj = {};
        for (const [key, value] of this.finalResponses) {
            responseObj[key] = value;
        }
        return JSON.stringify(responseObj, null, 2);
    }

    // Check if current question is about participation
    get isParticipationQuestion() {
        return this.currentQuestionData && 
            this.currentQuestionData.questionText && 
            this.currentQuestionData.questionText.toLowerCase().includes('interested in participating');
    }

    // Check if current question is about duration
    get isDurationQuestion() {
        return this.currentQuestionData && 
            this.currentQuestionData.questionType === 'Single Choice' &&
            this.currentQuestionData.questionText && 
            this.currentQuestionData.questionText.toLowerCase().includes('how long');
    }

    // Helpers for radio options
    get isYesSelected() {
        return this.currentResponse === 'Yes';
    }

    get isNoSelected() {
        return this.currentResponse === 'No';
    }

    get generateOptionId() {
        return `option-${this.currentQuestionData.id}-${Math.random().toString(36).substring(2, 8)}`;
    }

    get generateCheckboxId() {
        return `checkbox-${this.currentQuestionData.id}-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Helpers for duration cards
    get getWeekendCardClass() {
        return this.currentResponse === 'Weekend' ? 'option-card selected' : 'option-card';
    }

    get getWeekCardClass() {
        return this.currentResponse === '1 Week' ? 'option-card selected' : 'option-card';
    }

    get get10DaysCardClass() {
        return this.currentResponse === '10 Days' ? 'option-card selected' : 'option-card';
    }

    get getAnyDurationCardClass() {
        return this.currentResponse === 'Any duration is good' ? 'option-card selected' : 'option-card';
    }

    // Card click handler
    handleCardClick(event) {
        const questionId = event.currentTarget.dataset.questionId;
        const value = event.currentTarget.dataset.value;
        
        // Store the response
        this.responses.set(questionId, value);
        console.log('Card selected:', questionId, value);
    }

    // Helper for multiple choice checkboxes
    isOptionInArray(questionId, optionValue) {
        const response = this.responses.get(questionId);
        if (Array.isArray(response)) {
            return response.includes(optionValue);
        }
        return false;
    }
    // Update these getters to use finalResponses when completed
    get participationResponse() {
        const responsesMap = this.isCompleted ? this.finalResponses : this.responses;
        const participationQuestion = this.surveyQuestions.find(q => 
            q.questionText && q.questionText.toLowerCase().includes('interested in participating')
        );
        return participationQuestion && responsesMap.has(participationQuestion.id) ? 
            responsesMap.get(participationQuestion.id) : null;
    }

    get durationResponse() {
        const responsesMap = this.isCompleted ? this.finalResponses : this.responses;
        const durationQuestion = this.surveyQuestions.find(q => 
            q.questionText && q.questionText.toLowerCase().includes('how long')
        );
        return durationQuestion && responsesMap.has(durationQuestion.id) ? 
            responsesMap.get(durationQuestion.id) : null;
    }

    get budgetResponse() {
        const responsesMap = this.isCompleted ? this.finalResponses : this.responses;
        const budgetQuestion = this.surveyQuestions.find(q => 
            q.questionText && q.questionText.toLowerCase().includes('budget')
        );
        return budgetQuestion && responsesMap.has(budgetQuestion.id) ? 
            responsesMap.get(budgetQuestion.id) : null;
    }
    get hasResponses() {
        return this.formattedResponses.length > 0;
    }

    get formattedResponses() {
        if (!this.surveyQuestions || !this.finalResponses) {
            return [];
        }
        
        const formatted = [];
        for (const question of this.surveyQuestions) {
            if (this.finalResponses.has(question.id)) {
                const response = this.finalResponses.get(question.id);
                // Skip null or empty responses
                if (response !== null && response !== '') {
                    formatted.push({
                        id: question.id,
                        question: question.questionText,
                        answer: this.formatResponseForDisplay(question.questionType, response)
                    });
                }
            }
        }
        
        return formatted;
    }
    get getWeekendCardClass() {
        return this.currentResponse === 'Weekend' ? 'option-card selected' : 'option-card';
    }

    get getWeekCardClass() {
        return this.currentResponse === '1 Week' ? 'option-card selected' : 'option-card';
    }

    get get10DaysCardClass() {
        return this.currentResponse === '10 Days' ? 'option-card selected' : 'option-card';
    }

    get getAnyDurationCardClass() {
        return this.currentResponse === 'Any duration is good' ? 'option-card selected' : 'option-card';
    }
}