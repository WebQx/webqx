/**
 * MedicationResults Component
 * 
 * Displays search results for medications with accessibility features,
 * keyboard navigation, and EHR integration buttons.
 */

import React, { KeyboardEvent } from 'react';
import { MedicationResultsProps, MedicationItem } from '../types/prescription';

/**
 * Individual medication result item component
 */
const MedicationResultItem: React.FC<{
  medication: MedicationItem;
  onAddToEHR: (medication: MedicationItem) => void;
  disabled?: boolean;
}> = ({ medication, onAddToEHR, disabled = false }) => {
  
  const handleAddToEHR = () => {
    if (!disabled && !medication.isAdded) {
      onAddToEHR(medication);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAddToEHR();
    }
  };

  const buttonDisabled = disabled || medication.isAdded;
  const buttonText = medication.isAdded ? '✅ Added to EHR' : '+ Add to EHR';
  const buttonAriaLabel = medication.isAdded 
    ? `${medication.name} has been added to your Electronic Health Record`
    : `Add ${medication.name} to your Electronic Health Record`;

  return (
    <div 
      className={`medication-result ${medication.isAdded ? 'medication-result--added' : ''}`}
      role="article"
      aria-labelledby={`med-name-${medication.rxcui}`}
      aria-describedby={`med-details-${medication.rxcui}`}
    >
      <div className="medication-result__content">
        <div className="medication-result__header">
          <h3 
            id={`med-name-${medication.rxcui}`}
            className="medication-result__name"
          >
            {medication.name}
          </h3>
          {medication.synonym && (
            <p className="medication-result__synonym">
              Also known as: {medication.synonym}
            </p>
          )}
        </div>
        
        <div 
          id={`med-details-${medication.rxcui}`}
          className="medication-result__details"
        >
          <div className="medication-result__info">
            {medication.strength && (
              <span className="medication-result__strength">
                <strong>Strength:</strong> {medication.strength}
              </span>
            )}
            {medication.doseForm && (
              <span className="medication-result__dose-form">
                <strong>Form:</strong> {medication.doseForm}
              </span>
            )}
            <span className="medication-result__rxcui">
              <strong>RxCUI:</strong> {medication.rxcui}
            </span>
          </div>
        </div>
      </div>
      
      <div className="medication-result__actions">
        <button
          type="button"
          className={`medication-result__add-button ${
            medication.isAdded ? 'medication-result__add-button--added' : ''
          }`}
          onClick={handleAddToEHR}
          onKeyDown={handleKeyDown}
          disabled={buttonDisabled}
          aria-label={buttonAriaLabel}
          aria-describedby={`med-details-${medication.rxcui}`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

/**
 * MedicationResults - Displays list of medication search results
 */
export const MedicationResults: React.FC<MedicationResultsProps> = ({
  results,
  isLoading,
  onAddToEHR,
  disabled = false
}) => {
  
  if (isLoading) {
    return (
      <div 
        className="medication-results medication-results--loading"
        role="status"
        aria-live="polite"
        aria-label="Loading medication search results"
      >
        <div className="medication-results__loading">
          <div className="medication-results__skeleton">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="medication-skeleton">
                <div className="medication-skeleton__name"></div>
                <div className="medication-skeleton__details"></div>
                <div className="medication-skeleton__button"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div 
        className="medication-results medication-results--empty"
        role="status"
        aria-live="polite"
      >
        <div className="medication-results__empty">
          <div className="medication-results__empty-icon" aria-hidden="true">
            🔍
          </div>
          <h3 className="medication-results__empty-title">
            No medications found
          </h3>
          <p className="medication-results__empty-description">
            Try searching with:
          </p>
          <ul className="medication-results__empty-suggestions">
            <li>Generic medication names (e.g., "ibuprofen" instead of "Advil")</li>
            <li>Common abbreviations or alternate spellings</li>
            <li>Partial medication names (e.g., "amox" for "Amoxicillin")</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="medication-results"
      role="region"
      aria-label={`${results.length} medication${results.length !== 1 ? 's' : ''} found`}
    >
      <div className="medication-results__header">
        <h3 className="medication-results__title">
          Search Results
        </h3>
        <p className="medication-results__count">
          Found {results.length} medication{results.length !== 1 ? 's' : ''}
        </p>
      </div>
      
      <div 
        className="medication-results__list"
        role="list"
        aria-label="Medication search results"
      >
        {results.map((medication) => (
          <div key={medication.rxcui} role="listitem">
            <MedicationResultItem
              medication={medication}
              onAddToEHR={onAddToEHR}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
      
      <div className="medication-results__footer">
        <p className="medication-results__disclaimer">
          <strong>Important:</strong> Always consult with your healthcare provider 
          before making changes to your medications. This information is for 
          reference purposes only.
        </p>
      </div>
    </div>
  );
};

export default MedicationResults;