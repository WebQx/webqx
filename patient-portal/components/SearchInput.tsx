/**
 * SearchInput Component
 * 
 * Enhanced search input with keyboard navigation, accessibility features,
 * and loading state integration.
 */

import React, { useState, useRef, KeyboardEvent } from 'react';
import { SearchInputProps } from '../types/prescription';

/**
 * SearchInput - Accessible search input with enhanced keyboard support
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled = false,
  placeholder = 'Search for medications (e.g., "ibuprofen", "tylenol")...',
  ariaLabel = 'Search for medications by name'
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && !disabled && value.trim().length >= 2) {
      onSubmit();
    }
  };

  /**
   * Handle keyboard events for enhanced navigation
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        handleSubmit(e);
        break;
      case 'Escape':
        // Clear search and blur input
        onChange('');
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  /**
   * Handle input change with validation
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  const isSearchDisabled = disabled || isLoading;
  const hasMinLength = value.trim().length >= 2;
  const showClearButton = value.length > 0 && !isLoading;

  return (
    <form 
      className="search-input"
      onSubmit={handleSubmit}
      role="search"
      aria-label="Medication search form"
    >
      <div className={`search-input__wrapper ${isFocused ? 'search-input__wrapper--focused' : ''}`}>
        <div className="search-input__icon" aria-hidden="true">
          🔍
        </div>
        
        <input
          ref={inputRef}
          type="text"
          className="search-input__field"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={isSearchDisabled}
          aria-label={ariaLabel}
          aria-describedby="search-input-help search-input-status"
          autoComplete="off"
          spellCheck="false"
        />
        
        {showClearButton && (
          <button
            type="button"
            className="search-input__clear"
            onClick={() => onChange('')}
            disabled={isSearchDisabled}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
        
        <button
          type="submit"
          className={`search-input__submit ${isLoading ? 'search-input__submit--loading' : ''}`}
          disabled={isSearchDisabled || !hasMinLength}
          aria-label={isLoading ? 'Searching...' : 'Search for medications'}
        >
          {isLoading ? (
            <>
              <span className="search-input__spinner" aria-hidden="true">
                🔄
              </span>
              <span>Searching...</span>
            </>
          ) : (
            'Search'
          )}
        </button>
      </div>
      
      <div id="search-input-help" className="search-input__help">
        Enter at least 2 characters to search for medications. 
        Press Escape to clear, Enter to search.
      </div>
      
      <div 
        id="search-input-status" 
        className="search-input__status"
        aria-live="polite"
        aria-atomic="true"
      >
        {value.length > 0 && value.length < 2 && (
          <span>Enter {2 - value.length} more character{2 - value.length !== 1 ? 's' : ''} to search</span>
        )}
        {isLoading && (
          <span>Searching for medications matching "{value}"...</span>
        )}
      </div>
    </form>
  );
};

export default SearchInput;