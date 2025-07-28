/**
 * PrescriptionForm Component
 * 
 * A comprehensive medication search and EHR integration component with:
 * - TypeScript type safety
 * - Error handling with retry mechanisms
 * - Loading states with animations
 * - Enhanced accessibility features
 * - Modular sub-component architecture
 * - Comprehensive keyboard navigation
 */

import React, { useEffect } from 'react';
import { PrescriptionFormProps } from '../types/prescription';
import { useRxNormSearch } from '../hooks/useRxNormSearch';
import SearchInput from './SearchInput';
import MedicationResults from './MedicationResults';
import LoadingIndicator from './LoadingIndicator';
import ErrorMessage from './ErrorMessage';
import NotificationMessage from './NotificationMessage';

/**
 * PrescriptionForm - Main prescription management component
 */
export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({
  className = '',
  onMedicationAdded,
  onSearch,
  debug = false,
  maxRetries = 3,
  initialQuery = '',
  disabled = false
}) => {
  const {
    searchState,
    performSearch,
    retrySearch,
    addToEHR,
    clearError,
    clearNotification,
    resetSearch
  } = useRxNormSearch(maxRetries);

  // Local state for input value
  const [inputValue, setInputValue] = React.useState(initialQuery);

  // Initialize with initial query if provided
  useEffect(() => {
    if (initialQuery && initialQuery.trim().length >= 2) {
      setInputValue(initialQuery);
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  /**
   * Handle search input change
   */
  const handleSearchChange = (query: string) => {
    setInputValue(query);
  };

  /**
   * Handle search submission
   */
  const handleSearchSubmit = async () => {
    const query = inputValue.trim();
    
    if (query.length < 2) {
      return;
    }

    try {
      await performSearch(query);
      onSearch?.(query);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  /**
   * Handle adding medication to EHR
   */
  const handleAddToEHR = (medication: typeof searchState.results[0]) => {
    addToEHR(medication);
    onMedicationAdded?.(medication);
  };

  /**
   * Handle retry search
   */
  const handleRetrySearch = async () => {
    try {
      await retrySearch();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  // Debug information (only in development)
  useEffect(() => {
    if (debug && typeof window !== 'undefined') {
      console.group('PrescriptionForm Debug Info');
      console.log('Search State:', searchState);
      console.log('Input Value:', inputValue);
      console.log('Props:', {
        className,
        maxRetries,
        disabled,
        initialQuery
      });
      console.groupEnd();
    }
  }, [debug, searchState, inputValue, className, maxRetries, disabled, initialQuery]);

  const formClassName = [
    'prescription-form',
    className,
    disabled ? 'prescription-form--disabled' : '',
    searchState.isLoading ? 'prescription-form--loading' : ''
  ].filter(Boolean).join(' ');

  return (
    <section 
      className={formClassName}
      role="region"
      aria-labelledby="prescription-form-title"
      aria-describedby="prescription-form-description"
    >
      {/* Header */}
      <div className="prescription-form__header">
        <h2 
          id="prescription-form-title"
          className="prescription-form__title"
        >
          💊 Prescription Management
        </h2>
        <p 
          id="prescription-form-description"
          className="prescription-form__description"
        >
          Search for medications using the RxNorm database and add them to your 
          Electronic Health Record. All searches are secure and HIPAA-compliant.
        </p>
      </div>

      {/* Main Content */}
      <div className="prescription-form__content">
        
        {/* Search Section */}
        <div className="prescription-form__search">
          <SearchInput
            value={inputValue}
            onChange={handleSearchChange}
            onSubmit={handleSearchSubmit}
            isLoading={searchState.isLoading}
            disabled={disabled}
            ariaLabel="Search medications in RxNorm database"
          />
        </div>

        {/* Notifications */}
        {searchState.notification && (
          <div className="prescription-form__notification">
            <NotificationMessage
              message={searchState.notification}
              type="success"
              onDismiss={clearNotification}
              autoHideDelay={5000}
            />
          </div>
        )}

        {/* Error Messages */}
        {searchState.error && (
          <div className="prescription-form__error">
            <ErrorMessage
              error={searchState.error}
              onRetry={handleRetrySearch}
              retryCount={searchState.retryCount}
              maxRetries={maxRetries}
              showRetry={true}
            />
          </div>
        )}

        {/* Loading Indicator */}
        {searchState.isLoading && (
          <div className="prescription-form__loading">
            <LoadingIndicator
              isLoading={searchState.isLoading}
              message="Searching RxNorm database..."
              animated={true}
              size="medium"
            />
          </div>
        )}

        {/* Results Section */}
        {!searchState.error && (searchState.results.length > 0 || searchState.isLoading) && (
          <div className="prescription-form__results">
            <MedicationResults
              results={searchState.results}
              isLoading={searchState.isLoading}
              onAddToEHR={handleAddToEHR}
              disabled={disabled}
            />
          </div>
        )}

        {/* Help Information */}
        <div className="prescription-form__help">
          <details className="prescription-form__help-details">
            <summary className="prescription-form__help-summary">
              How to search for medications
            </summary>
            <div className="prescription-form__help-content">
              <h4>Search Tips:</h4>
              <ul>
                <li><strong>Generic names work best:</strong> Try "ibuprofen" instead of "Advil"</li>
                <li><strong>Use partial names:</strong> "amox" will find "Amoxicillin"</li>
                <li><strong>Include strength:</strong> "ibuprofen 200mg" for specific dosages</li>
                <li><strong>Try synonyms:</strong> Both brand and generic names are searchable</li>
              </ul>
              
              <h4>About RxNorm:</h4>
              <p>
                RxNorm is a normalized naming system for generic and branded drugs 
                maintained by the National Library of Medicine. It provides unique 
                identifiers for medications to ensure accuracy in healthcare systems.
              </p>
            </div>
          </details>
        </div>
      </div>

      {/* Footer */}
      <footer className="prescription-form__footer">
        <div className="prescription-form__footer-content">
          <p className="prescription-form__disclaimer">
            <strong>Medical Disclaimer:</strong> This tool is for informational 
            purposes only. Always consult your healthcare provider before making 
            any changes to your medications.
          </p>
          
          {debug && (
            <button
              type="button"
              className="prescription-form__debug-reset"
              onClick={() => {
                resetSearch();
                setInputValue('');
              }}
              aria-label="Reset search state (debug mode)"
            >
              🔄 Reset Search State
            </button>
          )}
        </div>
      </footer>
    </section>
  );
};

export default PrescriptionForm;