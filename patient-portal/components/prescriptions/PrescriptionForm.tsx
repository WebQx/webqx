import React, { useState, useEffect } from 'react';
import { usePrescriptions, Prescription } from './PrescriptionsContext';

interface PrescriptionFormProps {
  className?: string;
  onSubmit?: (prescription: Omit<Prescription, 'id' | 'dateCreated'>) => void;
  onCancel?: () => void;
}

/**
 * PrescriptionForm component for creating and editing prescriptions
 * 
 * This component provides a comprehensive form interface for healthcare providers
 * to create, modify, and submit prescription orders with proper validation
 * and accessibility features.
 */
const PrescriptionForm: React.FC<PrescriptionFormProps> = ({
  className = '',
  onSubmit,
  onCancel
}) => {
  const { state, updateFormData, clearFormData, submitPrescription } = usePrescriptions();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form field state
  const [formValues, setFormValues] = useState({
    medication: '',
    dosage: '',
    frequency: '',
    duration: '',
    prescriber: '',
    instructions: '',
    refillsRemaining: 0
  });

  // Update form values when context form data changes (e.g., from template selection)
  useEffect(() => {
    if (state.formData) {
      setFormValues(prev => ({
        ...prev,
        ...state.formData
      }));
    }
  }, [state.formData]);

  // Pre-fill prescriber with default value
  useEffect(() => {
    if (!formValues.prescriber) {
      setFormValues(prev => ({
        ...prev,
        prescriber: 'Dr. Smith, MD'
      }));
    }
  }, [formValues.prescriber]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formValues.medication.trim()) {
      errors.medication = 'Medication name is required';
    }

    if (!formValues.dosage.trim()) {
      errors.dosage = 'Dosage is required';
    }

    if (!formValues.frequency.trim()) {
      errors.frequency = 'Frequency is required';
    }

    if (!formValues.duration.trim()) {
      errors.duration = 'Duration is required';
    }

    if (!formValues.prescriber.trim()) {
      errors.prescriber = 'Prescriber is required';
    }

    if (formValues.refillsRemaining < 0 || formValues.refillsRemaining > 11) {
      errors.refillsRemaining = 'Refills must be between 0 and 11';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof typeof formValues, value: string | number) => {
    const newValues = { ...formValues, [field]: value };
    setFormValues(newValues);
    updateFormData(newValues);

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const { [field]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Focus on first error field
      const firstErrorField = Object.keys(validationErrors)[0];
      const errorElement = document.getElementById(firstErrorField);
      errorElement?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      const prescriptionData = {
        medication: formValues.medication,
        dosage: formValues.dosage,
        frequency: formValues.frequency,
        duration: formValues.duration,
        prescriber: formValues.prescriber,
        instructions: formValues.instructions,
        refillsRemaining: formValues.refillsRemaining
      };

      await submitPrescription(prescriptionData);
      onSubmit?.(prescriptionData);

      // Reset form after successful submission
      setFormValues({
        medication: '',
        dosage: '',
        frequency: '',
        duration: '',
        prescriber: 'Dr. Smith, MD',
        instructions: '',
        refillsRemaining: 0
      });
      clearFormData();
    } catch (error) {
      console.error('Error submitting prescription:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormValues({
      medication: '',
      dosage: '',
      frequency: '',
      duration: '',
      prescriber: 'Dr. Smith, MD',
      instructions: '',
      refillsRemaining: 0
    });
    clearFormData();
    setValidationErrors({});
    onCancel?.();
  };

  if (state.isLoading && !isSubmitting) {
    return (
      <div 
        className={`prescription-form loading ${className}`}
        role="status"
        aria-live="polite"
        aria-label="Loading prescription form"
      >
        <div className="loading-indicator">
          <div className="loading-spinner" aria-hidden="true">⏳</div>
          <span>Loading form...</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`prescription-form ${className}`}
      role="region"
      aria-labelledby="prescription-form-heading"
    >
      <div className="form-header">
        <h3 id="prescription-form-heading" className="form-title">
          📝 Prescription Form
        </h3>
        {state.selectedTemplate && (
          <div className="template-indicator" role="status" aria-live="polite">
            <span>Using template: <strong>{state.selectedTemplate.name}</strong></span>
          </div>
        )}
      </div>

      {state.error && (
        <div 
          className="form-error" 
          role="alert" 
          aria-live="assertive"
        >
          <span role="img" aria-label="Error">❌</span>
          <span>{state.error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate aria-describedby="form-instructions">
        <div id="form-instructions" className="sr-only">
          Fill out all required fields to create a prescription. 
          Use the template picker above to auto-fill common medications.
        </div>

        {/* Medication Field */}
        <div className="form-group">
          <label htmlFor="medication" className="form-label required">
            Medication Name *
          </label>
          <input
            id="medication"
            type="text"
            value={formValues.medication}
            onChange={(e) => handleInputChange('medication', e.target.value)}
            className={`form-input ${validationErrors.medication ? 'error' : ''}`}
            placeholder="Enter medication name"
            aria-required="true"
            aria-invalid={!!validationErrors.medication}
            aria-describedby={validationErrors.medication ? 'medication-error' : 'medication-help'}
          />
          <div id="medication-help" className="form-help">
            Enter the generic or brand name of the medication
          </div>
          {validationErrors.medication && (
            <div id="medication-error" className="form-error-message" role="alert">
              {validationErrors.medication}
            </div>
          )}
        </div>

        {/* Dosage Field */}
        <div className="form-group">
          <label htmlFor="dosage" className="form-label required">
            Dosage *
          </label>
          <input
            id="dosage"
            type="text"
            value={formValues.dosage}
            onChange={(e) => handleInputChange('dosage', e.target.value)}
            className={`form-input ${validationErrors.dosage ? 'error' : ''}`}
            placeholder="e.g., 10mg, 1 tablet"
            aria-required="true"
            aria-invalid={!!validationErrors.dosage}
            aria-describedby={validationErrors.dosage ? 'dosage-error' : 'dosage-help'}
          />
          <div id="dosage-help" className="form-help">
            Specify the amount per dose (e.g., 10mg, 1 tablet, 5ml)
          </div>
          {validationErrors.dosage && (
            <div id="dosage-error" className="form-error-message" role="alert">
              {validationErrors.dosage}
            </div>
          )}
        </div>

        {/* Frequency Field */}
        <div className="form-group">
          <label htmlFor="frequency" className="form-label required">
            Frequency *
          </label>
          <select
            id="frequency"
            value={formValues.frequency}
            onChange={(e) => handleInputChange('frequency', e.target.value)}
            className={`form-select ${validationErrors.frequency ? 'error' : ''}`}
            aria-required="true"
            aria-invalid={!!validationErrors.frequency}
            aria-describedby={validationErrors.frequency ? 'frequency-error' : 'frequency-help'}
          >
            <option value="">Select frequency</option>
            <option value="Once daily">Once daily</option>
            <option value="Twice daily">Twice daily</option>
            <option value="Three times daily">Three times daily</option>
            <option value="Four times daily">Four times daily</option>
            <option value="Every 4 hours">Every 4 hours</option>
            <option value="Every 6 hours">Every 6 hours</option>
            <option value="Every 8 hours">Every 8 hours</option>
            <option value="Every 12 hours">Every 12 hours</option>
            <option value="As needed">As needed (PRN)</option>
            <option value="At bedtime">At bedtime</option>
            <option value="With meals">With meals</option>
          </select>
          <div id="frequency-help" className="form-help">
            How often the medication should be taken
          </div>
          {validationErrors.frequency && (
            <div id="frequency-error" className="form-error-message" role="alert">
              {validationErrors.frequency}
            </div>
          )}
        </div>

        {/* Duration Field */}
        <div className="form-group">
          <label htmlFor="duration" className="form-label required">
            Duration *
          </label>
          <input
            id="duration"
            type="text"
            value={formValues.duration}
            onChange={(e) => handleInputChange('duration', e.target.value)}
            className={`form-input ${validationErrors.duration ? 'error' : ''}`}
            placeholder="e.g., 30 days, 2 weeks"
            aria-required="true"
            aria-invalid={!!validationErrors.duration}
            aria-describedby={validationErrors.duration ? 'duration-error' : 'duration-help'}
          />
          <div id="duration-help" className="form-help">
            How long the medication should be taken (e.g., 30 days, 2 weeks)
          </div>
          {validationErrors.duration && (
            <div id="duration-error" className="form-error-message" role="alert">
              {validationErrors.duration}
            </div>
          )}
        </div>

        {/* Prescriber Field */}
        <div className="form-group">
          <label htmlFor="prescriber" className="form-label required">
            Prescriber *
          </label>
          <input
            id="prescriber"
            type="text"
            value={formValues.prescriber}
            onChange={(e) => handleInputChange('prescriber', e.target.value)}
            className={`form-input ${validationErrors.prescriber ? 'error' : ''}`}
            placeholder="Dr. John Smith, MD"
            aria-required="true"
            aria-invalid={!!validationErrors.prescriber}
            aria-describedby={validationErrors.prescriber ? 'prescriber-error' : 'prescriber-help'}
          />
          <div id="prescriber-help" className="form-help">
            Name and credentials of the prescribing physician
          </div>
          {validationErrors.prescriber && (
            <div id="prescriber-error" className="form-error-message" role="alert">
              {validationErrors.prescriber}
            </div>
          )}
        </div>

        {/* Refills Field */}
        <div className="form-group">
          <label htmlFor="refillsRemaining" className="form-label">
            Refills Remaining
          </label>
          <input
            id="refillsRemaining"
            type="number"
            min="0"
            max="11"
            value={formValues.refillsRemaining}
            onChange={(e) => handleInputChange('refillsRemaining', parseInt(e.target.value, 10) || 0)}
            className={`form-input ${validationErrors.refillsRemaining ? 'error' : ''}`}
            aria-invalid={!!validationErrors.refillsRemaining}
            aria-describedby={validationErrors.refillsRemaining ? 'refills-error' : 'refills-help'}
          />
          <div id="refills-help" className="form-help">
            Number of refills allowed (0-11)
          </div>
          {validationErrors.refillsRemaining && (
            <div id="refills-error" className="form-error-message" role="alert">
              {validationErrors.refillsRemaining}
            </div>
          )}
        </div>

        {/* Instructions Field */}
        <div className="form-group">
          <label htmlFor="instructions" className="form-label">
            Special Instructions
          </label>
          <textarea
            id="instructions"
            value={formValues.instructions}
            onChange={(e) => handleInputChange('instructions', e.target.value)}
            className="form-textarea"
            placeholder="Optional: Additional instructions for the patient"
            rows={3}
            aria-describedby="instructions-help"
          />
          <div id="instructions-help" className="form-help">
            Any additional instructions for taking the medication (optional)
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions" role="group" aria-label="Form actions">
          <button
            type="submit"
            disabled={isSubmitting || state.isLoading}
            className="submit-button"
            aria-describedby="submit-help"
          >
            {isSubmitting ? (
              <>
                <span className="loading-spinner" aria-hidden="true">⏳</span>
                Submitting...
              </>
            ) : (
              <>
                <span role="img" aria-hidden="true">✅</span>
                Submit Prescription
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="cancel-button"
            aria-label="Cancel and clear form"
          >
            <span role="img" aria-hidden="true">❌</span>
            Cancel
          </button>
        </div>
        <div id="submit-help" className="sr-only">
          Submit the prescription for processing
        </div>
      </form>
    </div>
  );
};

export default PrescriptionForm;