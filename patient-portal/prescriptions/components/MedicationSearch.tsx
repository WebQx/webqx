/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Medication, SearchResult, SearchFilters, SelectOption } from '../types';
import { rxnormService } from '../services/rxnormService';
import { whisperTranslator } from '../services/whisperTranslator';

/**
 * Reusable MedicationSearch component
 * Provides comprehensive medication search with autocomplete, filters, and accessibility
 */
interface MedicationSearchProps {
  /** Callback when a medication is selected */
  onMedicationSelect: (medication: Medication) => void;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Whether the search is disabled */
  disabled?: boolean;
  /** Initial search value */
  initialValue?: string;
  /** Additional CSS classes */
  className?: string;
  /** Show search filters */
  showFilters?: boolean;
  /** Current language for translations */
  language?: string;
  /** Show recent searches */
  showRecentSearches?: boolean;
  /** Maximum number of results to display */
  maxResults?: number;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Accessibility label */
  'aria-label'?: string;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  selectedIndex: number;
  showDropdown: boolean;
  filters: SearchFilters;
}

export const MedicationSearch: React.FC<MedicationSearchProps> = ({
  onMedicationSelect,
  placeholder = "Search medications...",
  disabled = false,
  initialValue = "",
  className = "",
  showFilters = false,
  language = 'en',
  showRecentSearches = true,
  maxResults = 10,
  'data-testid': testId = 'medication-search',
  'aria-label': ariaLabel = 'Search for medications'
}) => {
  const [state, setState] = useState<SearchState>({
    query: initialValue,
    results: [],
    isLoading: false,
    error: null,
    selectedIndex: -1,
    showDropdown: false,
    filters: {}
  });

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setState(prev => ({ ...prev, results: [], showDropdown: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Translate search query if needed
      let translatedQuery = searchQuery;
      if (language !== 'en') {
        const translation = await whisperTranslator.translate(searchQuery, language, 'en');
        translatedQuery = translation.translatedText;
      }

      const drugs = await rxnormService.searchDrugs(translatedQuery);
      
      // Convert to search results with relevance scoring
      const searchResults: SearchResult[] = drugs
        .slice(0, maxResults)
        .map(drug => {
          const relevanceScore = calculateRelevanceScore(drug.name, searchQuery);
          return {
            medication: {
              id: drug.rxcui,
              name: drug.name,
              rxcui: drug.rxcui,
              genericName: drug.synonym,
              brandNames: [],
              dosageForm: drug.tty || 'Unknown',
              strength: 'Variable',
              route: 'Oral',
              category: 'Other'
            },
            relevanceScore,
            matchedFields: ['name']
          };
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      setState(prev => ({
        ...prev,
        results: searchResults,
        isLoading: false,
        showDropdown: true,
        selectedIndex: -1
      }));

      // Add to recent searches
      if (searchQuery.trim() && !recentSearches.includes(searchQuery)) {
        setRecentSearches(prev => [searchQuery, ...prev.slice(0, 4)]);
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Search failed',
        results: [],
        showDropdown: false
      }));
    }
  }, [language, maxResults, recentSearches]);

  // Handle input change with debouncing
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setState(prev => ({ ...prev, query: value }));

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timeout for debounced search
    debounceRef.current = setTimeout(() => {
      debouncedSearch(value);
    }, 300);
  }, [debouncedSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!state.showDropdown) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, prev.results.length - 1)
        }));
        break;

      case 'ArrowUp':
        event.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, -1)
        }));
        break;

      case 'Enter':
        event.preventDefault();
        if (state.selectedIndex >= 0 && state.results[state.selectedIndex]) {
          handleMedicationSelect(state.results[state.selectedIndex].medication);
        }
        break;

      case 'Escape':
        event.preventDefault();
        setState(prev => ({ ...prev, showDropdown: false, selectedIndex: -1 }));
        break;
    }
  }, [state.showDropdown, state.selectedIndex, state.results]);

  // Handle medication selection
  const handleMedicationSelect = useCallback((medication: Medication) => {
    setState(prev => ({
      ...prev,
      query: medication.name,
      showDropdown: false,
      selectedIndex: -1
    }));
    onMedicationSelect(medication);
  }, [onMedicationSelect]);

  // Handle filter changes
  const handleFilterChange = useCallback((filterKey: keyof SearchFilters, value: any) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, [filterKey]: value }
    }));
    
    // Re-search with new filters
    if (state.query.trim()) {
      debouncedSearch(state.query);
    }
  }, [state.query, debouncedSearch]);

  // Handle recent search selection
  const handleRecentSearchSelect = useCallback((searchTerm: string) => {
    setState(prev => ({ ...prev, query: searchTerm }));
    debouncedSearch(searchTerm);
  }, [debouncedSearch]);

  // Calculate relevance score for search results
  const calculateRelevanceScore = (medicationName: string, query: string): number => {
    const lowerName = medicationName.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    if (lowerName === lowerQuery) return 100;
    if (lowerName.startsWith(lowerQuery)) return 90;
    if (lowerName.includes(lowerQuery)) return 70;
    
    // Calculate Levenshtein distance for fuzzy matching
    const distance = levenshteinDistance(lowerName, lowerQuery);
    const maxLength = Math.max(lowerName.length, lowerQuery.length);
    return Math.max(0, 50 - (distance / maxLength) * 50);
  };

  // Simple Levenshtein distance implementation
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        searchInputRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setState(prev => ({ ...prev, showDropdown: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`medication-search ${className}`} data-testid={testId}>
      <div className="search-input-container">
        <input
          ref={searchInputRef}
          type="text"
          value={state.query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (state.results.length > 0) {
              setState(prev => ({ ...prev, showDropdown: true }));
            } else if (showRecentSearches && recentSearches.length > 0) {
              setState(prev => ({ ...prev, showDropdown: true }));
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-expanded={state.showDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-describedby={`${testId}-status`}
          role="combobox"
          className="search-input"
        />
        
        {state.isLoading && (
          <div className="search-loading" aria-label="Searching">
            ⏳
          </div>
        )}
        
        <div
          id={`${testId}-status`}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {state.isLoading && "Searching for medications..."}
          {state.error && `Search error: ${state.error}`}
          {state.results.length > 0 && `${state.results.length} results found`}
        </div>
      </div>

      {/* Search Filters */}
      {showFilters && (
        <div className="search-filters" role="group" aria-label="Search filters">
          <select
            value={state.filters.category || ''}
            onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            <option value="ANALGESIC">Pain Relief</option>
            <option value="ANTIBIOTIC">Antibiotics</option>
            <option value="CARDIOVASCULAR">Heart & Blood</option>
            <option value="RESPIRATORY">Respiratory</option>
          </select>
          
          <select
            value={state.filters.dosageForm || ''}
            onChange={(e) => handleFilterChange('dosageForm', e.target.value || undefined)}
            aria-label="Filter by dosage form"
          >
            <option value="">All Forms</option>
            <option value="TABLET">Tablets</option>
            <option value="CAPSULE">Capsules</option>
            <option value="LIQUID">Liquids</option>
            <option value="INJECTION">Injections</option>
          </select>
        </div>
      )}

      {/* Dropdown Results */}
      {state.showDropdown && (
        <ul
          ref={dropdownRef}
          className="search-dropdown"
          role="listbox"
          aria-label="Medication search results"
        >
          {/* Recent Searches */}
          {showRecentSearches && recentSearches.length > 0 && state.results.length === 0 && (
            <>
              <li className="dropdown-section-header" role="presentation">
                Recent Searches
              </li>
              {recentSearches.map((search, index) => (
                <li
                  key={`recent-${index}`}
                  className="dropdown-item recent-search"
                  onClick={() => handleRecentSearchSelect(search)}
                  role="option"
                  aria-selected={false}
                >
                  🕐 {search}
                </li>
              ))}
            </>
          )}

          {/* Search Results */}
          {state.results.map((result, index) => (
            <li
              key={result.medication.id}
              className={`dropdown-item ${index === state.selectedIndex ? 'selected' : ''}`}
              onClick={() => handleMedicationSelect(result.medication)}
              role="option"
              aria-selected={index === state.selectedIndex}
              aria-describedby={`result-${index}-details`}
            >
              <div className="medication-main">
                <strong>{result.medication.name}</strong>
                {result.medication.genericName && (
                  <span className="generic-name">({result.medication.genericName})</span>
                )}
              </div>
              <div
                id={`result-${index}-details`}
                className="medication-details"
              >
                <span className="dosage-form">{result.medication.dosageForm}</span>
                <span className="relevance-score" aria-label={`Relevance: ${Math.round(result.relevanceScore)}%`}>
                  {Math.round(result.relevanceScore)}% match
                </span>
              </div>
            </li>
          ))}

          {/* No Results */}
          {state.query && !state.isLoading && state.results.length === 0 && (
            <li className="dropdown-item no-results" role="option" aria-selected={false}>
              No medications found for "{state.query}"
            </li>
          )}

          {/* Error State */}
          {state.error && (
            <li className="dropdown-item error" role="alert">
              Error: {state.error}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default MedicationSearch;