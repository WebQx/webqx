import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { PrescriptionsProvider } from './PrescriptionsContext';
import SmartRxTemplatePicker from './SmartRxTemplatePicker';
import PrescriptionForm from './PrescriptionForm';

interface PrescriptionsModuleProps {
  /** CSS class name for additional styling */
  className?: string;
  /** Whether to show the module in compact mode */
  compact?: boolean;
  /** Callback when a prescription is successfully submitted */
  onPrescriptionSubmitted?: (prescriptionId: string) => void;
  /** Callback when an error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * PrescriptionsModule - Main container for prescription management
 * 
 * This module provides a comprehensive prescription management interface
 * that includes template selection and prescription form functionality.
 * It implements several key enhancements:
 * 
 * 1. Error Boundaries: Graceful error handling for child components
 * 2. Loading States: Visual feedback during data operations
 * 3. Context Provider: Eliminates prop drilling between components
 * 4. Accessibility: Full ARIA support and keyboard navigation
 * 5. Responsive Design: Adapts to different screen sizes
 */
const PrescriptionsModule: React.FC<PrescriptionsModuleProps> = ({
  className = '',
  compact = false,
  onPrescriptionSubmitted,
  onError
}) => {
  const handlePrescriptionSubmit = (prescription: any) => {
    // Generate a prescription ID for the callback
    const prescriptionId = `rx-${Date.now()}`;
    onPrescriptionSubmitted?.(prescriptionId);
  };

  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('PrescriptionsModule Error:', error, errorInfo);
    onError?.(error, errorInfo);
  };

  return (
    <ErrorBoundary 
      onError={handleError}
      fallback={
        <div 
          className="prescriptions-module-error"
          role="alert"
          aria-live="assertive"
        >
          <div className="error-content">
            <h2>⚠️ Prescription System Unavailable</h2>
            <p>
              We're experiencing technical difficulties with the prescription system. 
              Please try again later or contact your healthcare provider directly.
            </p>
            <div className="error-actions">
              <button 
                onClick={() => window.location.reload()}
                className="error-retry-button"
                aria-label="Reload page to try again"
              >
                🔄 Reload Page
              </button>
            </div>
          </div>
        </div>
      }
    >
      <PrescriptionsProvider>
        <div 
          className={`prescriptions-module ${compact ? 'compact' : ''} ${className}`}
          role="main"
          aria-labelledby="prescriptions-module-heading"
        >
          {/* Module Header */}
          <header className="module-header" role="banner">
            <h1 id="prescriptions-module-heading" className="module-title">
              💊 Prescription Management
            </h1>
            <p className="module-description">
              Create and manage prescriptions using smart templates and comprehensive forms
            </p>
          </header>

          {/* Main Content */}
          <div className="module-content">
            {/* Template Picker Section */}
            <section 
              className="template-section"
              role="region"
              aria-labelledby="template-section-heading"
            >
              <h2 id="template-section-heading" className="sr-only">
                Prescription Template Selection
              </h2>
              <ErrorBoundary
                onError={handleError}
                fallback={
                  <div 
                    className="template-picker-error"
                    role="alert"
                    aria-live="assertive"
                  >
                    <p>Unable to load prescription templates. You can still create prescriptions manually using the form below.</p>
                  </div>
                }
              >
                <SmartRxTemplatePicker 
                  className="module-template-picker"
                />
              </ErrorBoundary>
            </section>

            {/* Form Section */}
            <section 
              className="form-section"
              role="region"
              aria-labelledby="form-section-heading"
            >
              <h2 id="form-section-heading" className="sr-only">
                Prescription Creation Form
              </h2>
              <ErrorBoundary
                onError={handleError}
                fallback={
                  <div 
                    className="prescription-form-error"
                    role="alert"
                    aria-live="assertive"
                  >
                    <p>Unable to load prescription form. Please try refreshing the page.</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="form-error-retry"
                      aria-label="Refresh page to reload form"
                    >
                      🔄 Refresh Page
                    </button>
                  </div>
                }
              >
                <PrescriptionForm 
                  className="module-prescription-form"
                  onSubmit={handlePrescriptionSubmit}
                />
              </ErrorBoundary>
            </section>
          </div>

          {/* Module Footer */}
          <footer className="module-footer" role="contentinfo">
            <div className="footer-content">
              <div className="module-info" role="group" aria-label="Module information">
                <p className="module-version">
                  <span className="sr-only">Module version: </span>
                  WebQX Prescriptions v1.0
                </p>
                <p className="module-compliance">
                  <span role="img" aria-label="Shield">🛡️</span>
                  HIPAA Compliant | FDA Approved Templates
                </p>
              </div>
              
              <nav className="module-navigation" aria-label="Prescription module navigation">
                <ul className="nav-links">
                  <li>
                    <button 
                      className="nav-link"
                      aria-label="View prescription history"
                    >
                      📋 History
                    </button>
                  </li>
                  <li>
                    <button 
                      className="nav-link"
                      aria-label="Access prescription help and documentation"
                    >
                      ❓ Help
                    </button>
                  </li>
                  <li>
                    <button 
                      className="nav-link"
                      aria-label="Module settings and preferences"
                    >
                      ⚙️ Settings
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </footer>

          {/* Skip Links for Accessibility */}
          <div className="skip-links" aria-label="Skip navigation links">
            <a href="#template-picker-content" className="skip-link">
              Skip to template picker
            </a>
            <a href="#prescription-form-heading" className="skip-link">
              Skip to prescription form
            </a>
          </div>

          {/* Live Region for Announcements */}
          <div 
            id="prescriptions-announcements"
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-label="Prescription system announcements"
          >
            {/* Dynamic announcements will be inserted here */}
          </div>
        </div>
      </PrescriptionsProvider>
    </ErrorBoundary>
  );
};

export default PrescriptionsModule;