import React, { useState, useEffect, useCallback } from 'react';
import { PrescriptionFormProps, PrescriptionFormData, LoadingState, ApiError, Medication } from './types';
import { withRetry, fetchMedications, submitPrescriptionRefill, DEFAULT_RETRY_CONFIG } from './utils';
import LoadingIndicator from './LoadingIndicator';
import ErrorHandler from './ErrorHandler';
import MedicationSelector from './MedicationSelector';
import PharmacySelector from './PharmacySelector';
import ReviewConfirmation from './ReviewConfirmation';

type FormStep = 'loading' | 'medication' | 'pharmacy' | 'review' | 'success' | 'error';

/**
 * PrescriptionForm component for managing prescription refill requests
 * Features enhanced error handling, retry mechanisms, loading indicators, and accessibility
 */
export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({
  medications: propMedications,
  onSuccess,
  onError,
  onCancel,
  initiallyVisible = false,
  className = '',
  retryConfig = {}
}) => {
  // State management
  const [isVisible, setIsVisible] = useState(initiallyVisible);
  const [currentStep, setCurrentStep] = useState<FormStep>('loading');
  const [formData, setFormData] = useState<Partial<PrescriptionFormData>>({});
  const [medications, setMedications] = useState<Medication[]>(propMedications || []);
  const [loading, setLoading] = useState<LoadingState>({
    isLoading: false,
    loadingMessage: ''
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [confirmationNumber, setConfirmationNumber] = useState<string>('');

  const finalRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

  // Initialize form - load medications if not provided
  useEffect(() => {
    if (isVisible && !propMedications) {
      loadMedications();
    } else if (isVisible && propMedications) {
      setMedications(propMedications);
      setCurrentStep('medication');
    }
  }, [isVisible, propMedications]);

  // Load medications with retry mechanism
  const loadMedications = useCallback(async () => {
    setCurrentStep('loading');
    setLoading({
      isLoading: true,
      loadingMessage: 'Loading your medications...'
    });
    setError(null);

    try {
      const meds = await withRetry(
        fetchMedications,
        finalRetryConfig,
        (attempt, err) => {
          setRetryAttempt(attempt);
          setLoading({
            isLoading: true,
            loadingMessage: `Loading medications... (Attempt ${attempt + 1})`
          });
        }
      );

      setMedications(meds);
      setCurrentStep('medication');
      setRetryAttempt(0);
    } catch (err) {
      setError(err as ApiError);
      setCurrentStep('error');
      if (onError) {
        onError(err as ApiError);
      }
    } finally {
      setLoading({
        isLoading: false,
        loadingMessage: ''
      });
    }
  }, [finalRetryConfig, onError]);

  // Submit prescription refill with retry mechanism
  const submitRefillRequest = useCallback(async () => {
    if (!isFormComplete(formData)) {
      return;
    }

    setLoading({
      isLoading: true,
      loadingMessage: 'Submitting your refill request...'
    });
    setError(null);

    try {
      const result = await withRetry(
        () => submitPrescriptionRefill(formData as PrescriptionFormData),
        finalRetryConfig,
        (attempt, err) => {
          setRetryAttempt(attempt);
          setLoading({
            isLoading: true,
            loadingMessage: `Submitting request... (Attempt ${attempt + 1})`
          });
        }
      );

      setConfirmationNumber(result.confirmationNumber);
      setCurrentStep('success');
      setRetryAttempt(0);
      
      if (onSuccess) {
        onSuccess(formData as PrescriptionFormData);
      }
    } catch (err) {
      setError(err as ApiError);
      if (onError) {
        onError(err as ApiError);
      }
    } finally {
      setLoading({
        isLoading: false,
        loadingMessage: ''
      });
    }
  }, [formData, finalRetryConfig, onSuccess, onError]);

  // Form validation
  const isFormComplete = (data: Partial<PrescriptionFormData>): boolean => {
    return !!(data.medicationId && data.pharmacyId && data.quantity && data.urgency);
  };

  // Event handlers
  const handleFormDataChange = (newData: Partial<PrescriptionFormData>) => {
    setFormData(newData);
  };

  const handleNextStep = () => {
    switch (currentStep) {
      case 'medication':
        setCurrentStep('pharmacy');
        break;
      case 'pharmacy':
        setCurrentStep('review');
        break;
      case 'review':
        submitRefillRequest();
        break;
    }
  };

  const handlePreviousStep = () => {
    switch (currentStep) {
      case 'pharmacy':
        setCurrentStep('medication');
        break;
      case 'review':
        setCurrentStep('pharmacy');
        break;
    }
  };

  const handleRetry = () => {
    setError(null);
    if (currentStep === 'error') {
      loadMedications();
    } else {
      submitRefillRequest();
    }
  };

  const handleDismissError = () => {
    setError(null);
  };

  const handleCancel = () => {
    setIsVisible(false);
    setCurrentStep('loading');
    setFormData({});
    setError(null);
    if (onCancel) {
      onCancel();
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setCurrentStep('loading');
    setFormData({});
    setError(null);
  };

  // Show/hide form
  const showForm = () => {
    setIsVisible(true);
    if (medications.length > 0) {
      setCurrentStep('medication');
    } else {
      loadMedications();
    }
  };

  // Form step props
  const stepProps = {
    data: formData,
    onDataChange: handleFormDataChange,
    medications,
    loading,
    error,
    onNext: handleNextStep,
    onPrevious: handlePreviousStep
  };

  // Render trigger button if form is not visible
  if (!isVisible) {
    return (
      <button
        type="button"
        className={`prescription-form-trigger ${className}`}
        onClick={showForm}
        aria-label="Request prescription refill"
      >
        💊 Refill Prescription
      </button>
    );
  }

  return (
    <div 
      className={`prescription-form ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prescription-form-title"
    >
      {/* Form header with progress indicator */}
      <header className="prescription-form__header">
        <div className="prescription-form__title-row">
          <h1 id="prescription-form-title" className="prescription-form__title">
            Prescription Refill Request
          </h1>
          <button
            type="button"
            className="prescription-form__close"
            onClick={handleClose}
            aria-label="Close prescription form"
          >
            ✕
          </button>
        </div>

        {/* Progress indicator */}
        {currentStep !== 'loading' && currentStep !== 'error' && currentStep !== 'success' && (
          <div className="prescription-form__progress" role="progressbar" aria-label="Form progress">
            <div className="progress-steps">
              <div className={`progress-step ${currentStep === 'medication' ? 'active' : 'completed'}`}>
                <span className="progress-step__number">1</span>
                <span className="progress-step__label">Medication</span>
              </div>
              <div className={`progress-step ${
                currentStep === 'pharmacy' ? 'active' : 
                currentStep === 'review' ? 'completed' : ''
              }`}>
                <span className="progress-step__number">2</span>
                <span className="progress-step__label">Pharmacy</span>
              </div>
              <div className={`progress-step ${currentStep === 'review' ? 'active' : ''}`}>
                <span className="progress-step__number">3</span>
                <span className="progress-step__label">Review</span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Form content */}
      <main className="prescription-form__content">
        {/* Loading state */}
        {currentStep === 'loading' && (
          <LoadingIndicator 
            loading={loading}
            size="large"
            className="prescription-form__loading"
          />
        )}

        {/* Error state */}
        {currentStep === 'error' && error && (
          <ErrorHandler
            error={error}
            onRetry={handleRetry}
            onDismiss={handleDismissError}
            isRetrying={loading.isLoading}
            showDetails={true}
            className="prescription-form__error"
          />
        )}

        {/* Form steps */}
        {currentStep === 'medication' && (
          <MedicationSelector {...stepProps} />
        )}

        {currentStep === 'pharmacy' && (
          <PharmacySelector {...stepProps} />
        )}

        {currentStep === 'review' && (
          <ReviewConfirmation 
            {...stepProps}
            onSubmit={submitRefillRequest}
            isSubmitting={loading.isLoading}
          />
        )}

        {/* Success state */}
        {currentStep === 'success' && (
          <div className="prescription-form__success">
            <div className="success-content">
              <div className="success-icon" aria-hidden="true">✅</div>
              <h2>Refill Request Submitted Successfully!</h2>
              <p>Your prescription refill request has been sent to the pharmacy.</p>
              
              <div className="confirmation-details">
                <p><strong>Confirmation Number:</strong> {confirmationNumber}</p>
                <p>You will receive a confirmation email shortly, and the pharmacy will contact you when your prescription is ready for pickup.</p>
              </div>

              <button
                type="button"
                className="btn btn--primary"
                onClick={handleClose}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Inline error display for current step */}
        {error && currentStep !== 'error' && (
          <ErrorHandler
            error={error}
            onRetry={handleRetry}
            onDismiss={handleDismissError}
            isRetrying={loading.isLoading}
            className="prescription-form__inline-error"
          />
        )}
      </main>

      {/* Form footer with cancel option */}
      {currentStep !== 'success' && currentStep !== 'loading' && (
        <footer className="prescription-form__footer">
          <button
            type="button"
            className="btn btn--tertiary"
            onClick={handleCancel}
          >
            Cancel Request
          </button>
        </footer>
      )}

      {/* Live region for announcements */}
      <div 
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {loading.isLoading && loading.loadingMessage}
        {error && `Error: ${error.message}`}
        {currentStep === 'success' && 'Prescription refill request submitted successfully'}
      </div>
    </div>
  );
};

export default PrescriptionForm;