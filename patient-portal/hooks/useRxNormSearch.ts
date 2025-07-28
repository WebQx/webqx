/**
 * Custom hook for managing RxNorm search functionality
 * 
 * This hook encapsulates all the logic for medication search, including:
 * - State management for search results, loading, and errors
 * - Retry mechanism for failed API calls
 * - EHR integration tracking
 * - Notification management
 */

import { useState, useCallback, useRef } from 'react';
import { MedicationItem, SearchState, UseRxNormSearchReturn } from '../types/prescription';
import { rxNormService } from '../services/rxnorm';

/**
 * Initial search state
 */
const INITIAL_STATE: SearchState = {
  query: '',
  isLoading: false,
  results: [],
  error: null,
  retryCount: 0,
  notification: null,
};

/**
 * Custom hook for RxNorm medication search
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Object containing search state and control functions
 */
export const useRxNormSearch = (maxRetries: number = 3): UseRxNormSearchReturn => {
  const [searchState, setSearchState] = useState<SearchState>(INITIAL_STATE);
  const lastQueryRef = useRef<string>('');
  const addedMedicationsRef = useRef<Set<string>>(new Set());

  /**
   * Perform a medication search
   * @param query - Search term for medications
   */
  const performSearch = useCallback(async (query: string): Promise<void> => {
    if (!query || query.trim().length < 2) {
      setSearchState(prev => ({
        ...prev,
        error: 'Please enter at least 2 characters to search for medications.',
        results: [],
        retryCount: 0,
      }));
      return;
    }

    const trimmedQuery = query.trim();
    lastQueryRef.current = trimmedQuery;

    setSearchState(prev => ({
      ...prev,
      query: trimmedQuery,
      isLoading: true,
      error: null,
      retryCount: 0,
      notification: null,
    }));

    try {
      const results = await rxNormService.searchMedications(trimmedQuery);
      
      // Mark medications as added if they were previously added
      const resultsWithAddedState = results.map(med => ({
        ...med,
        isAdded: addedMedicationsRef.current.has(med.rxcui),
      }));

      setSearchState(prev => ({
        ...prev,
        isLoading: false,
        results: resultsWithAddedState,
        error: null,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred while searching medications.';

      setSearchState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        results: [],
      }));
    }
  }, []);

  /**
   * Retry the last failed search
   */
  const retrySearch = useCallback(async (): Promise<void> => {
    if (!lastQueryRef.current) {
      return;
    }

    setSearchState(prev => {
      if (prev.retryCount >= maxRetries) {
        return {
          ...prev,
          error: `Maximum retry attempts (${maxRetries}) exceeded. Please try a different search term or check your connection.`,
        };
      }

      return {
        ...prev,
        isLoading: true,
        error: null,
        retryCount: prev.retryCount + 1,
      };
    });

    try {
      const results = await rxNormService.searchMedications(lastQueryRef.current);
      
      // Mark medications as added if they were previously added
      const resultsWithAddedState = results.map(med => ({
        ...med,
        isAdded: addedMedicationsRef.current.has(med.rxcui),
      }));

      setSearchState(prev => ({
        ...prev,
        isLoading: false,
        results: resultsWithAddedState,
        error: null,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred during retry.';

      setSearchState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        results: [],
      }));
    }
  }, [maxRetries]);

  /**
   * Add a medication to EHR
   * @param medication - Medication to add to EHR
   */
  const addToEHR = useCallback((medication: MedicationItem): void => {
    if (addedMedicationsRef.current.has(medication.rxcui)) {
      setSearchState(prev => ({
        ...prev,
        notification: `${medication.name} is already in your EHR.`,
      }));
      return;
    }

    // Add to tracking set
    addedMedicationsRef.current.add(medication.rxcui);

    // Update the results to reflect the added state
    setSearchState(prev => ({
      ...prev,
      results: prev.results.map(med => 
        med.rxcui === medication.rxcui 
          ? { ...med, isAdded: true }
          : med
      ),
      notification: `✅ ${medication.name} has been successfully added to your EHR.`,
    }));

    // Console log for debugging/future API integration
    console.log('Medication added to EHR:', {
      rxcui: medication.rxcui,
      name: medication.name,
      synonym: medication.synonym,
      strength: medication.strength,
      doseForm: medication.doseForm,
      timestamp: new Date().toISOString(),
    });

    // Auto-clear notification after 5 seconds
    setTimeout(() => {
      setSearchState(prev => ({
        ...prev,
        notification: null,
      }));
    }, 5000);
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback((): void => {
    setSearchState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  /**
   * Clear notification
   */
  const clearNotification = useCallback((): void => {
    setSearchState(prev => ({
      ...prev,
      notification: null,
    }));
  }, []);

  /**
   * Reset search state to initial values
   */
  const resetSearch = useCallback((): void => {
    setSearchState(INITIAL_STATE);
    lastQueryRef.current = '';
    // Don't clear addedMedicationsRef to maintain EHR state across searches
  }, []);

  return {
    searchState,
    performSearch,
    retrySearch,
    addToEHR,
    clearError,
    clearNotification,
    resetSearch,
  };
};