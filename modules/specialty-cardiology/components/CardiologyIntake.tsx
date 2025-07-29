/**
 * Cardiology Intake Component
 * 
 * Comprehensive cardiology intake form component implementing all enhancements:
 * - Error handling for EHR system interactions
 * - Loading states for better user experience
 * - Explicit TypeScript types for all functions, props, and state
 * - Accessibility attributes for better compliance
 * - Detailed logging for operations
 * - Code comments for maintainability
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  CardiologyIntakeData,
  CardiologySpecialtyData,
  CardiovascularSymptoms,
  CardiacRiskFactors,
  VitalSigns,
  SymptomDetails,
  SymptomFrequency,
  ExerciseTolerance,
  ExerciseLevel
} from '../types';
import { IntakeForm, IntakeFormStatus, EHRError } from '../../../ehr-integrations/types';
import { useIntakeForm } from '../../../ehr-integrations/hooks';
import { generateEHRId, formatEHRDate } from '../../../ehr-integrations/utils';

/**
 * Props interface for CardiologyIntake component
 */
export interface CardiologyIntakeProps {
  /** Patient ID for the intake form */
  patientId: string;
  /** Callback when form is successfully submitted */
  onSubmit?: (form: IntakeForm) => void;
  /** Callback when form is saved as draft */
  onDraftSaved?: (form: IntakeForm) => void;
  /** Callback when form encounters an error */
  onError?: (error: EHRError) => void;
  /** CSS class name for additional styling */
  className?: string;
  /** Whether to show progress indicator */
  showProgress?: boolean;
  /** Initial form data for editing */
  initialData?: Partial<CardiologyIntakeData>;
  /** Whether form is in read-only mode */
  readOnly?: boolean;
}

/**
 * Form validation error interface
 */
interface FormValidationError {
  /** Field name that has error */
  field: string;
  /** Error message */
  message: string;
}

/**
 * Form progress interface
 */
interface FormProgress {
  /** Current section being filled */
  currentSection: number;
  /** Total number of sections */
  totalSections: number;
  /** Percentage completion */
  completionPercentage: number;
}

/**
 * CardiologyIntake Component
 * 
 * A comprehensive intake form for cardiology patients with:
 * - Multi-section form with progress tracking
 * - Real-time validation and error handling
 * - Accessibility compliance with ARIA attributes
 * - Loading states and user feedback
 * - Auto-save draft functionality
 * - Detailed logging of user interactions
 */
export const CardiologyIntake: React.FC<CardiologyIntakeProps> = ({
  patientId,
  onSubmit,
  onDraftSaved,
  onError,
  className = '',
  showProgress = true,
  initialData,
  readOnly = false
}) => {
  // EHR integration hook for form operations
  const {
    data: submittedForm,
    loading,
    error,
    errorMessage,
    success,
    submitForm,
    saveDraft,
    clearError
  } = useIntakeForm();

  // Form state management
  const [formData, setFormData] = useState<CardiologyIntakeData>(() => ({
    chiefComplaint: initialData?.chiefComplaint || '',
    historyOfPresentIllness: initialData?.historyOfPresentIllness || '',
    medications: initialData?.medications || [],
    allergies: initialData?.allergies || [],
    familyHistory: initialData?.familyHistory || [],
    socialHistory: initialData?.socialHistory || {
      smokingStatus: 'unknown',
      alcoholUse: 'none',
      exerciseHabits: '',
      occupation: '',
      maritalStatus: ''
    },
    reviewOfSystems: initialData?.reviewOfSystems || {
      constitutional: false,
      cardiovascular: false,
      respiratory: false,
      gastrointestinal: false,
      neurological: false,
      other: {},
      notes: ''
    },
    specialtyData: initialData?.specialtyData as CardiologySpecialtyData || getDefaultCardiologyData()
  }));

  // Form validation and progress tracking
  const [validationErrors, setValidationErrors] = useState<FormValidationError[]>([]);
  const [currentSection, setCurrentSection] = useState<number>(0);
  const [formProgress, setFormProgress] = useState<FormProgress>({
    currentSection: 0,
    totalSections: 6,
    completionPercentage: 0
  });

  // Component state
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();

  // Form sections for progress tracking
  const formSections = [
    'Chief Complaint & History',
    'Cardiovascular Symptoms',
    'Risk Factors',
    'Medications & Allergies',
    'Vital Signs',
    'Review & Submit'
  ];

  /**
   * Get default cardiology specialty data
   */
  function getDefaultCardiologyData(): CardiologySpecialtyData {
    return {
      cardiovascularSymptoms: {
        chestPain: { present: false },
        shortnessOfBreath: { present: false },
        palpitations: { present: false },
        dizziness: { present: false },
        fatigue: { present: false },
        edema: { present: false },
        syncope: { present: false }
      },
      riskFactors: {
        hypertension: { present: false },
        diabetes: { present: false },
        highCholesterol: { present: false },
        smokingHistory: { present: false, status: 'never' },
        familyHeartDisease: { present: false },
        obesity: { present: false },
        physicalInactivity: { present: false },
        stress: { level: 1 }
      },
      previousProcedures: [],
      cardiacMedications: [],
      vitalSigns: {
        bloodPressure: { systolic: 0, diastolic: 0 },
        heartRate: 0,
        measurementDate: new Date()
      },
      exerciseTolerance: {
        currentLevel: ExerciseLevel.SEDENTARY,
        limitations: [],
        exerciseSymptoms: []
      }
    };
  }

  /**
   * Log user interaction for audit and analytics
   */
  const logInteraction = useCallback((action: string, data?: Record<string, any>) => {
    const logEntry = {
      timestamp: new Date(),
      patientId,
      action,
      data,
      formSection: formSections[currentSection]
    };
    
    // In a real implementation, this would send to a logging service
    console.log('[Cardiology Intake]', logEntry);
  }, [patientId, currentSection]);

  /**
   * Validate current form data
   */
  const validateForm = useCallback((): FormValidationError[] => {
    const errors: FormValidationError[] = [];

    // Basic required fields validation
    if (!formData.chiefComplaint.trim()) {
      errors.push({
        field: 'chiefComplaint',
        message: 'Chief complaint is required'
      });
    }

    if (!formData.historyOfPresentIllness.trim()) {
      errors.push({
        field: 'historyOfPresentIllness',
        message: 'History of present illness is required'
      });
    }

    // Vital signs validation
    const { vitalSigns } = formData.specialtyData;
    if (vitalSigns.bloodPressure.systolic <= 0 || vitalSigns.bloodPressure.systolic > 300) {
      errors.push({
        field: 'bloodPressure.systolic',
        message: 'Please enter a valid systolic blood pressure (1-300 mmHg)'
      });
    }

    if (vitalSigns.bloodPressure.diastolic <= 0 || vitalSigns.bloodPressure.diastolic > 200) {
      errors.push({
        field: 'bloodPressure.diastolic',
        message: 'Please enter a valid diastolic blood pressure (1-200 mmHg)'
      });
    }

    if (vitalSigns.heartRate <= 0 || vitalSigns.heartRate > 300) {
      errors.push({
        field: 'heartRate',
        message: 'Please enter a valid heart rate (1-300 bpm)'
      });
    }

    return errors;
  }, [formData]);

  /**
   * Calculate form completion percentage
   */
  const calculateProgress = useCallback((): number => {
    let completedFields = 0;
    let totalFields = 0;

    // Basic fields (2)
    totalFields += 2;
    if (formData.chiefComplaint.trim()) completedFields++;
    if (formData.historyOfPresentIllness.trim()) completedFields++;

    // Cardiovascular symptoms (7)
    const symptoms = formData.specialtyData.cardiovascularSymptoms;
    Object.values(symptoms).forEach(() => {
      totalFields++;
      completedFields++; // Count as completed since they have default values
    });

    // Risk factors (8)
    const riskFactors = formData.specialtyData.riskFactors;
    Object.values(riskFactors).forEach(() => {
      totalFields++;
      completedFields++; // Count as completed since they have default values
    });

    // Vital signs (3)
    totalFields += 3;
    const { vitalSigns } = formData.specialtyData;
    if (vitalSigns.bloodPressure.systolic > 0) completedFields++;
    if (vitalSigns.bloodPressure.diastolic > 0) completedFields++;
    if (vitalSigns.heartRate > 0) completedFields++;

    return Math.round((completedFields / totalFields) * 100);
  }, [formData]);

  /**
   * Update form data and trigger validation
   */
  const updateFormData = useCallback((updates: Partial<CardiologyIntakeData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
    
    // Log the update
    logInteraction('form_data_updated', { updatedFields: Object.keys(updates) });
  }, [logInteraction]);

  /**
   * Update cardiovascular symptoms
   */
  const updateCardiovascularSymptoms = useCallback((
    symptom: keyof CardiovascularSymptoms,
    details: Partial<SymptomDetails>
  ) => {
    const updatedSymptoms = {
      ...formData.specialtyData.cardiovascularSymptoms,
      [symptom]: {
        ...formData.specialtyData.cardiovascularSymptoms[symptom],
        ...details
      }
    };

    updateFormData({
      specialtyData: {
        ...formData.specialtyData,
        cardiovascularSymptoms: updatedSymptoms
      }
    });

    logInteraction('symptom_updated', { symptom, details });
  }, [formData.specialtyData, updateFormData, logInteraction]);

  /**
   * Update vital signs
   */
  const updateVitalSigns = useCallback((updates: Partial<VitalSigns>) => {
    const updatedVitalSigns = {
      ...formData.specialtyData.vitalSigns,
      ...updates
    };

    updateFormData({
      specialtyData: {
        ...formData.specialtyData,
        vitalSigns: updatedVitalSigns
      }
    });

    logInteraction('vital_signs_updated', updates);
  }, [formData.specialtyData, updateFormData, logInteraction]);

  /**
   * Auto-save form as draft
   */
  const autoSaveForm = useCallback(async () => {
    if (!isDirty || readOnly) return;

    const intakeForm: IntakeForm = {
      id: generateEHRId('cardiology_intake'),
      patientId,
      specialty: 'cardiology',
      status: IntakeFormStatus.DRAFT,
      data: formData
    };

    try {
      await saveDraft(intakeForm);
      setLastSaved(new Date());
      setIsDirty(false);
      logInteraction('form_auto_saved');
    } catch (error) {
      console.error('Auto-save failed:', error);
      logInteraction('auto_save_failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }, [isDirty, readOnly, patientId, formData, saveDraft, logInteraction]);

  /**
   * Submit the intake form
   */
  const handleSubmit = useCallback(async () => {
    if (readOnly) return;

    logInteraction('form_submit_attempted');

    // Validate form before submission
    const errors = validateForm();
    setValidationErrors(errors);

    if (errors.length > 0) {
      logInteraction('form_validation_failed', { errors });
      return;
    }

    const intakeForm: IntakeForm = {
      id: generateEHRId('cardiology_intake'),
      patientId,
      specialty: 'cardiology',
      status: IntakeFormStatus.SUBMITTED,
      data: formData,
      submittedAt: new Date()
    };

    try {
      await submitForm(intakeForm);
      logInteraction('form_submitted_successfully');
      if (onSubmit) {
        onSubmit(intakeForm);
      }
    } catch (submitError) {
      logInteraction('form_submission_failed', { 
        error: submitError instanceof Error ? submitError.message : 'Unknown error' 
      });
      if (onError && error) {
        onError(error);
      }
    }
  }, [
    readOnly, validateForm, patientId, formData, submitForm, logInteraction, 
    onSubmit, onError, error
  ]);

  /**
   * Navigate to next section
   */
  const nextSection = useCallback(() => {
    if (currentSection < formSections.length - 1) {
      setCurrentSection(prev => prev + 1);
      logInteraction('section_navigated', { direction: 'next', section: currentSection + 1 });
    }
  }, [currentSection, formSections.length, logInteraction]);

  /**
   * Navigate to previous section
   */
  const previousSection = useCallback(() => {
    if (currentSection > 0) {
      setCurrentSection(prev => prev - 1);
      logInteraction('section_navigated', { direction: 'previous', section: currentSection - 1 });
    }
  }, [currentSection, logInteraction]);

  // Auto-save effect
  useEffect(() => {
    if (isDirty && !readOnly) {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new timer for auto-save after 30 seconds of inactivity
      autoSaveTimerRef.current = setTimeout(autoSaveForm, 30000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isDirty, readOnly, autoSaveForm]);

  // Progress calculation effect
  useEffect(() => {
    const completionPercentage = calculateProgress();
    setFormProgress({
      currentSection,
      totalSections: formSections.length,
      completionPercentage
    });
  }, [currentSection, formSections.length, calculateProgress]);

  // Component mount logging
  useEffect(() => {
    logInteraction('component_mounted', { patientId, readOnly });
    
    return () => {
      logInteraction('component_unmounted');
    };
  }, [patientId, readOnly, logInteraction]);

  /**
   * Render cardiovascular symptoms section
   */
  const renderCardiovascularSymptoms = () => (
    <section 
      className="symptoms-section"
      role="region"
      aria-labelledby="symptoms-heading"
    >
      <h3 id="symptoms-heading" className="section-title">
        Cardiovascular Symptoms
      </h3>
      <p className="section-description">
        Please indicate if you are experiencing any of the following symptoms:
      </p>
      
      {Object.entries(formData.specialtyData.cardiovascularSymptoms).map(([symptomKey, symptomData]) => (
        <div key={symptomKey} className="symptom-group" role="group" aria-labelledby={`${symptomKey}-label`}>
          <label 
            id={`${symptomKey}-label`}
            className="symptom-label"
          >
            <input
              type="checkbox"
              checked={symptomData.present}
              onChange={(e) => updateCardiovascularSymptoms(
                symptomKey as keyof CardiovascularSymptoms, 
                { present: e.target.checked }
              )}
              disabled={readOnly}
              aria-describedby={`${symptomKey}-description`}
            />
            <span className="symptom-name">
              {symptomKey.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase())}
            </span>
          </label>

          {symptomData.present && (
            <div className="symptom-details" id={`${symptomKey}-description`}>
              <label className="detail-label">
                Severity (1-10):
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={symptomData.severity || ''}
                  onChange={(e) => updateCardiovascularSymptoms(
                    symptomKey as keyof CardiovascularSymptoms,
                    { severity: parseInt(e.target.value) || undefined }
                  )}
                  disabled={readOnly}
                  aria-label={`Severity of ${symptomKey} on scale of 1 to 10`}
                />
              </label>

              <label className="detail-label">
                Frequency:
                <select
                  value={symptomData.frequency || ''}
                  onChange={(e) => updateCardiovascularSymptoms(
                    symptomKey as keyof CardiovascularSymptoms,
                    { frequency: e.target.value as SymptomFrequency }
                  )}
                  disabled={readOnly}
                  aria-label={`Frequency of ${symptomKey}`}
                >
                  <option value="">Select frequency</option>
                  {Object.values(SymptomFrequency).map(freq => (
                    <option key={freq} value={freq}>
                      {freq.replace('_', ' ').toLowerCase().replace(/^./, str => str.toUpperCase())}
                    </option>
                  ))}
                </select>
              </label>

              <label className="detail-label">
                Description:
                <textarea
                  value={symptomData.description || ''}
                  onChange={(e) => updateCardiovascularSymptoms(
                    symptomKey as keyof CardiovascularSymptoms,
                    { description: e.target.value }
                  )}
                  disabled={readOnly}
                  placeholder="Describe the symptom in more detail..."
                  aria-label={`Detailed description of ${symptomKey}`}
                  rows={3}
                />
              </label>
            </div>
          )}
        </div>
      ))}
    </section>
  );

  /**
   * Render vital signs section
   */
  const renderVitalSigns = () => (
    <section 
      className="vital-signs-section"
      role="region"
      aria-labelledby="vital-signs-heading"
    >
      <h3 id="vital-signs-heading" className="section-title">
        Current Vital Signs
      </h3>
      <p className="section-description">
        Please enter your most recent vital sign measurements:
      </p>

      <div className="vital-signs-grid">
        <div className="vital-sign-group">
          <h4>Blood Pressure</h4>
          <div className="bp-inputs">
            <label className="bp-label">
              Systolic (mmHg):
              <input
                type="number"
                min="50"
                max="300"
                value={formData.specialtyData.vitalSigns.bloodPressure.systolic || ''}
                onChange={(e) => updateVitalSigns({
                  bloodPressure: {
                    ...formData.specialtyData.vitalSigns.bloodPressure,
                    systolic: parseInt(e.target.value) || 0
                  }
                })}
                disabled={readOnly}
                aria-label="Systolic blood pressure in mmHg"
                aria-required="true"
              />
            </label>
            <span className="bp-separator">/</span>
            <label className="bp-label">
              Diastolic (mmHg):
              <input
                type="number"
                min="30"
                max="200"
                value={formData.specialtyData.vitalSigns.bloodPressure.diastolic || ''}
                onChange={(e) => updateVitalSigns({
                  bloodPressure: {
                    ...formData.specialtyData.vitalSigns.bloodPressure,
                    diastolic: parseInt(e.target.value) || 0
                  }
                })}
                disabled={readOnly}
                aria-label="Diastolic blood pressure in mmHg"
                aria-required="true"
              />
            </label>
          </div>
        </div>

        <label className="vital-sign-group">
          Heart Rate (bpm):
          <input
            type="number"
            min="30"
            max="300"
            value={formData.specialtyData.vitalSigns.heartRate || ''}
            onChange={(e) => updateVitalSigns({
              heartRate: parseInt(e.target.value) || 0
            })}
            disabled={readOnly}
            aria-label="Heart rate in beats per minute"
            aria-required="true"
          />
        </label>

        <label className="vital-sign-group">
          Weight (lbs):
          <input
            type="number"
            min="50"
            max="1000"
            value={formData.specialtyData.vitalSigns.weight || ''}
            onChange={(e) => updateVitalSigns({
              weight: parseInt(e.target.value) || undefined
            })}
            disabled={readOnly}
            aria-label="Weight in pounds"
          />
        </label>
      </div>
    </section>
  );

  return (
    <div 
      className={`cardiology-intake ${className}`}
      role="main"
      aria-labelledby="intake-heading"
    >
      {/* Header */}
      <header className="intake-header" role="banner">
        <h1 id="intake-heading" className="intake-title">
          💗 Cardiology Intake Form
        </h1>
        <p className="intake-description">
          Please complete this form to help us provide the best cardiac care for you.
        </p>
        
        {/* Progress indicator */}
        {showProgress && (
          <div 
            className="progress-indicator"
            role="progressbar"
            aria-valuenow={formProgress.completionPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Form completion: ${formProgress.completionPercentage}%`}
          >
            <div className="progress-info">
              <span className="progress-text">
                Section {formProgress.currentSection + 1} of {formProgress.totalSections}: {formSections[currentSection]}
              </span>
              <span className="progress-percentage">
                {formProgress.completionPercentage}% Complete
              </span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${formProgress.completionPercentage}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        )}

        {/* Auto-save status */}
        {lastSaved && (
          <div className="auto-save-status" role="status" aria-live="polite">
            📝 Last saved: {formatEHRDate(lastSaved, true)}
          </div>
        )}
      </header>

      {/* Error display */}
      {(error || validationErrors.length > 0) && (
        <div 
          className="error-section"
          role="alert"
          aria-live="assertive"
        >
          <h3 className="error-title">⚠️ Please correct the following errors:</h3>
          {error && (
            <div className="ehr-error">
              <strong>System Error:</strong> {errorMessage}
              <button 
                type="button"
                onClick={clearError}
                className="error-dismiss"
                aria-label="Dismiss error message"
              >
                ✕
              </button>
            </div>
          )}
          {validationErrors.map((validationError, index) => (
            <div key={index} className="validation-error">
              <strong>{validationError.field}:</strong> {validationError.message}
            </div>
          ))}
        </div>
      )}

      {/* Loading overlay */}
      {loading.isLoading && (
        <div 
          className="loading-overlay"
          role="status"
          aria-live="polite"
          aria-label={loading.message || 'Processing...'}
        >
          <div className="loading-content">
            <div className="loading-spinner" aria-hidden="true">⏳</div>
            <span className="loading-message">
              {loading.message || 'Processing...'}
            </span>
            {loading.progress && (
              <div className="loading-progress">
                {loading.progress}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form content */}
      <form 
        className="intake-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        noValidate
      >
        {/* Chief Complaint Section */}
        {currentSection === 0 && (
          <section 
            className="chief-complaint-section"
            role="region"
            aria-labelledby="chief-complaint-heading"
          >
            <h3 id="chief-complaint-heading" className="section-title">
              Chief Complaint & History
            </h3>
            
            <label className="form-field">
              <span className="field-label">
                What is your main concern today? *
              </span>
              <textarea
                value={formData.chiefComplaint}
                onChange={(e) => updateFormData({ chiefComplaint: e.target.value })}
                disabled={readOnly}
                placeholder="Please describe your main symptoms or concerns..."
                aria-required="true"
                aria-describedby="chief-complaint-help"
                rows={4}
              />
              <span id="chief-complaint-help" className="field-help">
                Describe your primary symptoms, when they started, and what prompted this visit.
              </span>
            </label>

            <label className="form-field">
              <span className="field-label">
                History of Present Illness *
              </span>
              <textarea
                value={formData.historyOfPresentIllness}
                onChange={(e) => updateFormData({ historyOfPresentIllness: e.target.value })}
                disabled={readOnly}
                placeholder="Please provide details about your current symptoms and their progression..."
                aria-required="true"
                aria-describedby="history-help"
                rows={6}
              />
              <span id="history-help" className="field-help">
                Include timeline, severity changes, associated symptoms, and any treatments tried.
              </span>
            </label>
          </section>
        )}

        {/* Cardiovascular Symptoms Section */}
        {currentSection === 1 && renderCardiovascularSymptoms()}

        {/* Vital Signs Section */}
        {currentSection === 4 && renderVitalSigns()}

        {/* Navigation buttons */}
        <div className="form-navigation" role="navigation" aria-label="Form navigation">
          <button
            type="button"
            onClick={previousSection}
            disabled={currentSection === 0 || loading.isLoading}
            className="nav-button nav-previous"
            aria-label="Go to previous section"
          >
            ← Previous
          </button>

          {currentSection < formSections.length - 1 ? (
            <button
              type="button"
              onClick={nextSection}
              disabled={loading.isLoading}
              className="nav-button nav-next"
              aria-label="Go to next section"
            >
              Next →
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading.isLoading || readOnly}
              className="nav-button nav-submit"
              aria-label="Submit completed intake form"
            >
              {loading.isLoading ? 'Submitting...' : 'Submit Form'}
            </button>
          )}
        </div>
      </form>

      {/* Success message */}
      {success && submittedForm && (
        <div 
          className="success-message"
          role="status"
          aria-live="polite"
        >
          <h3 className="success-title">✅ Form Submitted Successfully!</h3>
          <p>
            Your cardiology intake form has been submitted and will be reviewed by our medical team.
            Reference ID: {submittedForm.id}
          </p>
        </div>
      )}
    </div>
  );
};

export default CardiologyIntake;