import React from 'react';

/**
 * ExportReview component - Confirms and exports prescriptions to WebQX™ EHR
 * 
 * This component provides prescription export functionality with proper type safety,
 * error handling, accessibility features, and dynamic provider management.
 */

// Type definitions for better type safety
export interface SelectedMedication {
  /** Unique identifier for the medication */
  id: string;
  /** Name of the medication */
  name: string;
  /** Dosage information */
  dosage: string;
  /** Frequency of administration */
  frequency: string;
  /** Duration of treatment */
  duration?: string;
  /** Additional notes about the medication */
  notes?: string;
}

export interface ExportReviewProps {
  /** Selected medication object with detailed information */
  selectedMed: SelectedMedication;
  /** Medical specialty string for ICD-10 mapping */
  specialty: string;
  /** Dynamic provider ID to replace hardcoded value */
  providerId: string;
  /** CSS class name for additional styling */
  className?: string;
  /** Callback function when export is successful */
  onExportSuccess?: (data: any) => void;
  /** Callback function when export fails */
  onExportError?: (error: string) => void;
}

/**
 * Maps specialty to appropriate ICD-10 code
 * Returns R69 as fallback for unmapped specialties
 */
export const mapICD10FromSpecialty = (specialty: string): string => {
  const specialtyMapping: Record<string, string> = {
    'cardiology': 'I25.9',
    'dermatology': 'L30.9',
    'endocrinology': 'E11.9',
    'gastroenterology': 'K59.9',
    'neurology': 'G93.9',
    'orthopedics': 'M25.9',
    'psychiatry': 'F99',
    'pulmonology': 'J98.9',
    'urology': 'N39.9',
    'general': 'Z00.00'
  };

  const normalizedSpecialty = specialty.toLowerCase().trim();
  return specialtyMapping[normalizedSpecialty] || 'R69'; // R69 as fallback
};

/**
 * ExportReview Component
 * 
 * Renders a prescription export confirmation interface with proper
 * accessibility, error handling, and type safety.
 */
export const ExportReview: React.FC<ExportReviewProps> = ({
  selectedMed,
  specialty,
  providerId,
  className = '',
  onExportSuccess,
  onExportError
}) => {
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportStatus, setExportStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  // Get ICD-10 code and check if it's the default fallback
  const icd10Code = mapICD10FromSpecialty(specialty);
  const isDefaultICD10 = icd10Code === 'R69';

  /**
   * Handles the prescription export process
   */
  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus('idle');
    setErrorMessage('');

    try {
      // Validate required data
      if (!selectedMed.name || !providerId) {
        throw new Error('Missing required medication or provider information');
      }

      // Simulate export to WebQX™ EHR
      const exportData = {
        medication: selectedMed,
        specialty,
        icd10Code,
        providerId,
        timestamp: new Date().toISOString(),
        isDefaultICD10
      };

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real implementation, this would be an actual API call
      // const response = await exportToWebQXEHR(exportData);
      
      setExportStatus('success');
      onExportSuccess?.(exportData);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Export failed';
      setErrorMessage(errorMsg);
      setExportStatus('error');
      onExportError?.(errorMsg);
    } finally {
      setIsExporting(false);
    }
  };

  // Dynamic aria-label based on medication name
  const exportButtonAriaLabel = `Export prescription for ${selectedMed.name} to WebQX EHR system`;

  return (
    <div 
      className={`export-review ${className}`}
      role="region"
      aria-label="Prescription Export Review"
    >
      <div className="export-review-header">
        <h2 id="export-review-title">Export Prescription Review</h2>
        <p className="export-review-subtitle">
          Review and confirm prescription export to WebQX™ EHR
        </p>
      </div>

      {/* Medication Information */}
      <section 
        className="medication-details"
        role="group"
        aria-labelledby="medication-details-heading"
      >
        <h3 id="medication-details-heading">Medication Details</h3>
        <dl className="medication-info">
          <dt>Medication Name:</dt>
          <dd>{selectedMed.name}</dd>
          
          <dt>Dosage:</dt>
          <dd>{selectedMed.dosage}</dd>
          
          <dt>Frequency:</dt>
          <dd>{selectedMed.frequency}</dd>
          
          {selectedMed.duration && (
            <>
              <dt>Duration:</dt>
              <dd>{selectedMed.duration}</dd>
            </>
          )}
          
          {selectedMed.notes && (
            <>
              <dt>Notes:</dt>
              <dd>{selectedMed.notes}</dd>
            </>
          )}
        </dl>
      </section>

      {/* Provider and Classification Information */}
      <section 
        className="export-details"
        role="group"
        aria-labelledby="export-details-heading"
      >
        <h3 id="export-details-heading">Export Details</h3>
        <dl className="export-info">
          <dt>Provider ID:</dt>
          <dd>{providerId}</dd>
          
          <dt>Specialty:</dt>
          <dd>{specialty}</dd>
          
          <dt>ICD-10 Code:</dt>
          <dd>
            {icd10Code}
            {isDefaultICD10 && (
              <span 
                className="icd10-warning"
                role="alert"
                aria-label="Warning: Using default ICD-10 code"
              >
                ⚠️ Default code (specialty not mapped)
              </span>
            )}
          </dd>
        </dl>
      </section>

      {/* Error Handling Display */}
      {isDefaultICD10 && (
        <div 
          className="warning-message"
          role="alert"
          aria-live="polite"
        >
          <p>
            <strong>Note:</strong> The specialty "{specialty}" is not specifically mapped. 
            Using default ICD-10 code R69 (Illness, unspecified). Please verify this is appropriate.
          </p>
        </div>
      )}

      {/* Export Status Messages */}
      {exportStatus === 'success' && (
        <div 
          className="success-message"
          role="alert"
          aria-live="polite"
        >
          <p>✅ Prescription successfully exported to WebQX™ EHR</p>
        </div>
      )}

      {exportStatus === 'error' && (
        <div 
          className="error-message"
          role="alert"
          aria-live="assertive"
        >
          <p>❌ Export failed: {errorMessage}</p>
        </div>
      )}

      {/* Export Actions */}
      <div className="export-actions">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="export-button"
          aria-label={exportButtonAriaLabel}
          aria-describedby="export-button-description"
        >
          {isExporting ? '⏳ Exporting...' : '📤 Export to WebQX™ EHR'}
        </button>
        
        <div id="export-button-description" className="sr-only">
          Click to export the prescription for {selectedMed.name} to the WebQX Electronic Health Record system.
          {isDefaultICD10 && ' Note: Using default ICD-10 code.'}
        </div>
      </div>
    </div>
  );
};

export default ExportReview;