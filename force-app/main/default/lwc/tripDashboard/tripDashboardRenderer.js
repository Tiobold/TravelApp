// tripDashboardRenderer.js
import { LightningElement, api } from 'lwc';

export default {
    render(cmp, helper) {
        return this.superRender();
    },

    rerender(cmp, helper) {
        this.superRerender();
        
        // Enable shadow DOM access for all lightning-progress-bar components
        // This is a workaround to access the internals of the lightning-progress-bar component
        const progressBars = cmp.template.querySelectorAll('lightning-progress-bar');
        progressBars.forEach(bar => {
            if (bar.shadowRoot) {
                bar.shadowRoot.delegatesFocus = true;
            }
        });
    }
};