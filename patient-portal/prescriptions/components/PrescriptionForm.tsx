/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { PrescriptionForm as PrescriptionFormData, Medication, ValidationResult, TooltipContent } from '../types';
import MedicationSearch from './MedicationSearch';
import { LanguageToggle } from './LanguageToggle';
import { FormField } from './FormField';
import { Tooltip } from './Tooltip';
import { whisperTranslator } from '../services/whisperTranslator';

/**
 * Modular PrescriptionForm component broken down into smaller components
 * Provides comprehensive prescription creation with validation and accessibility
 */
interface PrescriptionFormProps {
  /** Initial form data */
  initialData?: Partial<PrescriptionFormData>;
  /** Callback when form is submitted */
  onSubmit: (prescription: PrescriptionFormData) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Whether the form is in edit mode */
  isEditing?: boolean;
  /** Current language */
  language?: string;
  /** Whether to show language toggle */
  showLanguageToggle?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

interface FormState {
  formData: PrescriptionFormData;
  selectedMedication: Medication | null;
  isSubmitting: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  isDirty: boolean;
  currentLanguage: string;
}

const defaultFormData: PrescriptionFormData = {
  patientId: '',
  medicationId: '',
  dosage: '',
  frequency: '',
  duration: '',
  quantity: 0,
  refills: 0,
  instructions: '',
  substitutionAllowed: true,
  priority: 'ROUTINE',
  language: 'en'
};

export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  isEditing = false,
  language = 'en',
  showLanguageToggle = true,
  className = '',
  'data-testid': testId = 'prescription-form'
}) => {
  const [state, setState] = useState<FormState>({
    formData: { ...defaultFormData, ...initialData, language },
    selectedMedication: null,
    isSubmitting: false,
    errors: {},
    warnings: {},
    isDirty: false,
    currentLanguage: language
  });

  // Tooltips content for form fields
  const tooltips: Record<string, TooltipContent> = {
    dosage: {
      id: 'dosage-tooltip',
      title: 'Dosage Information',
      content: 'Specify the amount of medication to be taken (e.g., 10mg, 1 tablet)',
      position: 'top',
      trigger: 'hover'
    },
    frequency: {
      id: 'frequency-tooltip',
      title: 'Frequency',
      content: 'How often the medication should be taken (e.g., twice daily, every 8 hours)',
      position: 'top',
      trigger: 'hover'
    },
    duration: {
      id: 'duration-tooltip',
      title: 'Duration',
      content: 'How long the medication should be taken (e.g., 7 days, 2 weeks)',
      position: 'top',
      trigger: 'hover'
    },
    instructions: {
      id: 'instructions-tooltip',
      title: 'Special Instructions',
      content: 'Additional instructions for the patient (e.g., take with food, avoid alcohol)',
      position: 'top',
      trigger: 'hover'
    }
  };

  // Validation function
  const validateForm = useCallback((formData: PrescriptionFormData): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!formData.patientId.trim()) errors.push('Patient ID is required');
    if (!formData.medicationId.trim()) errors.push('Medication selection is required');
    if (!formData.dosage.trim()) errors.push('Dosage is required');
    if (!formData.frequency.trim()) errors.push('Frequency is required');
    if (!formData.duration.trim()) errors.push('Duration is required');
    if (formData.quantity <= 0) errors.push('Quantity must be greater than 0');

    // Business logic validation
    if (formData.refills > 5) warnings.push('High number of refills (>5) may require additional approval');
    if (formData.quantity > 90) warnings.push('Quantity exceeds typical 90-day supply');
    
    // Dosage format validation
    const dosagePattern = /^\d+(\.\d+)?\s*(mg|g|ml|units?|tablets?|capsules?)$/i;
    if (formData.dosage && !dosagePattern.test(formData.dosage)) {
      warnings.push('Dosage format may be unclear (e.g., use "10mg" or "1 tablet")');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, []);

  // Handle form field changes
  const handleFieldChange = useCallback((field: keyof PrescriptionFormData, value: any) => {
    setState(prev => {
      const newFormData = { ...prev.formData, [field]: value };
      const validation = validateForm(newFormData);
      
      return {
        ...prev,
        formData: newFormData,
        isDirty: true,
        errors: field in prev.errors ? { ...prev.errors, [field]: '' } : prev.errors,
        warnings: validation.warnings.reduce((acc, warning) => {
          if (warning.includes(field)) acc[field] = warning;
          return acc;
        }, {} as Record<string, string>)
      };
    });
  }, [validateForm]);

  // Handle medication selection
  const handleMedicationSelect = useCallback((medication: Medication) => {
    setState(prev => ({
      ...prev,
      selectedMedication: medication,
      formData: {
        ...prev.formData,
        medicationId: medication.id
      },
      isDirty: true,
      errors: { ...prev.errors, medicationId: '' }
    }));
  }, []);

  // Handle language change
  const handleLanguageChange = useCallback(async (newLanguage: string) => {
    setState(prev => ({ ...prev, currentLanguage: newLanguage }));
    
    // Translate form instructions if they exist
    if (state.formData.instructions && newLanguage !== 'en') {
      try {
        const translation = await whisperTranslator.translate(
          state.formData.instructions,
          state.currentLanguage,
          newLanguage
        );
        handleFieldChange('instructions', translation.translatedText);
      } catch (error) {
        console.warn('Failed to translate instructions:', error);
      }
    }
  }, [state.formData.instructions, state.currentLanguage, handleFieldChange]);

  // Handle form submission
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    const validation = validateForm(state.formData);
    if (!validation.isValid) {
      setState(prev => ({
        ...prev,
        errors: validation.errors.reduce((acc, error) => {
          const field = error.toLowerCase().includes('patient') ? 'patientId' :
                       error.toLowerCase().includes('medication') ? 'medicationId' :
                       error.toLowerCase().includes('dosage') ? 'dosage' :
                       error.toLowerCase().includes('frequency') ? 'frequency' :
                       error.toLowerCase().includes('duration') ? 'duration' :
                       error.toLowerCase().includes('quantity') ? 'quantity' : 'general';
          acc[field] = error;
          return acc;
        }, {} as Record<string, string>)
      }));
      return;
    }

    setState(prev => ({ ...prev, isSubmitting: true }));
    
    try {
      await onSubmit(state.formData);
      setState(prev => ({ ...prev, isDirty: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        errors: { general: error instanceof Error ? error.message : 'Submission failed' }
      }));
    } finally {
      setState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [state.formData, validateForm, onSubmit]);

  // Handle form reset
  const handleReset = useCallback(() => {
    setState({
      formData: { ...defaultFormData, language: state.currentLanguage },
      selectedMedication: null,
      isSubmitting: false,
      errors: {},
      warnings: {},
      isDirty: false,
      currentLanguage: state.currentLanguage
    });
  }, [state.currentLanguage]);

  // Prevent data loss on unload
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (state.isDirty) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.isDirty]);

  return (
    <div className={`prescription-form ${className}`} data-testid={testId}>
      {/* Form Header */}
      <div className="form-header">
        <h2>
          {isEditing ? 'Edit Prescription' : 'New Prescription'}
        </h2>
        
        {showLanguageToggle && (
          <LanguageToggle
            currentLanguage={state.currentLanguage}
            onLanguageChange={handleLanguageChange}
            className="form-language-toggle"
          />
        )}
      </div>

      {/* Error/Warning Summary */}
      {Object.keys(state.errors).length > 0 && (
        <div className="form-errors" role="alert" aria-label="Form errors">
          <h3>Please correct the following errors:</h3>
          <ul>
            {Object.values(state.errors).map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Patient Information */}
        <fieldset className="form-section">
          <legend>Patient Information</legend>
          
          <FormField
            label="Patient ID"
            required
            error={state.errors.patientId}
          >
            <input
              type="text"
              value={state.formData.patientId}
              onChange={(e) => handleFieldChange('patientId', e.target.value)}
              aria-describedby="patient-id-help"
              disabled={state.isSubmitting}
              placeholder="Enter patient ID"
            />
            <div id="patient-id-help" className="field-help">
              Enter the unique patient identifier
            </div>
          </FormField>
        </fieldset>

        {/* Medication Selection */}
        <fieldset className="form-section">
          <legend>Medication</legend>
          
          <FormField
            label="Search and Select Medication"
            required
            error={state.errors.medicationId}
          >
            <MedicationSearch
              onMedicationSelect={handleMedicationSelect}
              placeholder="Search for medication..."
              language={state.currentLanguage}
              showFilters={true}
              showRecentSearches={true}
              disabled={state.isSubmitting}
              aria-label="Search and select medication"
            />
          </FormField>

          {state.selectedMedication && (
            <div className="selected-medication" role="region" aria-label="Selected medication">
              <h4>Selected Medication:</h4>
              <div className="medication-details">
                <strong>{state.selectedMedication.name}</strong>
                {state.selectedMedication.genericName && (
                  <span className="generic">({state.selectedMedication.genericName})</span>
                )}
                <div className="medication-meta">
                  <span>Form: {state.selectedMedication.dosageForm}</span>
                  <span>Route: {state.selectedMedication.route}</span>
                </div>
              </div>
            </div>
          )}
        </fieldset>

        {/* Prescription Details */}
        <fieldset className="form-section">
          <legend>Prescription Details</legend>
          
          <div className="form-row">
            <FormField
              label="Dosage"
              required
              error={state.errors.dosage}
              warning={state.warnings.dosage}
              tooltip={tooltips.dosage}
            >
              <input
                type="text"
                value={state.formData.dosage}
                onChange={(e) => handleFieldChange('dosage', e.target.value)}
                placeholder="e.g., 10mg, 1 tablet"
                disabled={state.isSubmitting}
              />
            </FormField>

            <FormField
              label="Frequency"
              required
              error={state.errors.frequency}
              tooltip={tooltips.frequency}
            >
              <select
                value={state.formData.frequency}
                onChange={(e) => handleFieldChange('frequency', e.target.value)}
                disabled={state.isSubmitting}
              >
                <option value="">Select frequency</option>
                <option value="once daily">Once daily</option>
                <option value="twice daily">Twice daily</option>
                <option value="three times daily">Three times daily</option>
                <option value="four times daily">Four times daily</option>
                <option value="every 4 hours">Every 4 hours</option>
                <option value="every 6 hours">Every 6 hours</option>
                <option value="every 8 hours">Every 8 hours</option>
                <option value="every 12 hours">Every 12 hours</option>
                <option value="as needed">As needed</option>
              </select>
            </FormField>
          </div>

          <div className="form-row">
            <FormField
              label="Duration"
              required
              error={state.errors.duration}
              tooltip={tooltips.duration}
            >
              <input
                type="text"
                value={state.formData.duration}
                onChange={(e) => handleFieldChange('duration', e.target.value)}
                placeholder="e.g., 7 days, 2 weeks"
                disabled={state.isSubmitting}
              />
            </FormField>

            <FormField
              label="Quantity"
              required
              error={state.errors.quantity}
              warning={state.warnings.quantity}
            >
              <input
                type="number"
                min="1"
                value={state.formData.quantity}
                onChange={(e) => handleFieldChange('quantity', parseInt(e.target.value) || 0)}
                disabled={state.isSubmitting}
              />
            </FormField>

            <FormField
              label="Refills"
              error={state.errors.refills}
              warning={state.warnings.refills}
            >
              <input
                type="number"
                min="0"
                max="11"
                value={state.formData.refills}
                onChange={(e) => handleFieldChange('refills', parseInt(e.target.value) || 0)}
                disabled={state.isSubmitting}
              />
            </FormField>
          </div>
        </fieldset>

        {/* Additional Information */}
        <fieldset className="form-section">
          <legend>Additional Information</legend>
          
          <FormField
            label="Special Instructions"
            error={state.errors.instructions}
            tooltip={tooltips.instructions}
          >
            <textarea
              value={state.formData.instructions}
              onChange={(e) => handleFieldChange('instructions', e.target.value)}
              placeholder="Additional instructions for the patient..."
              rows={3}
              disabled={state.isSubmitting}
            />
          </FormField>

          <div className="form-row">
            <FormField label="Priority">
              <select
                value={state.formData.priority}
                onChange={(e) => handleFieldChange('priority', e.target.value as 'ROUTINE' | 'URGENT' | 'STAT')}
                disabled={state.isSubmitting}
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">STAT</option>
              </select>
            </FormField>

            <FormField label="Substitution Allowed">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={state.formData.substitutionAllowed}
                  onChange={(e) => handleFieldChange('substitutionAllowed', e.target.checked)}
                  disabled={state.isSubmitting}
                />
                <span>Allow generic substitution</span>
              </label>
            </FormField>
          </div>
        </fieldset>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            onClick={handleReset}
            disabled={state.isSubmitting || !state.isDirty}
            className="btn btn-secondary"
          >
            Reset
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={state.isSubmitting}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          )}
          
          <button
            type="submit"
            disabled={state.isSubmitting || Object.keys(state.errors).length > 0}
            className="btn btn-primary"
          >
            {state.isSubmitting ? 'Submitting...' : isEditing ? 'Update Prescription' : 'Create Prescription'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PrescriptionForm;