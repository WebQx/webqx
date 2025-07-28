/**
 * ErrorMessage Component
 * 
 * Displays error messages with retry functionality and accessibility features.
 * Includes detailed error information and retry mechanisms.
 */

import React from 'react';
import { ErrorMessageProps } from '../types/prescription';

/**
 * ErrorMessage - Accessible error display with retry functionality
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  retryCount = 0,
  maxRetries = 3,
  showRetry = true
}) => {
  if (!error) {
    return null;
  }

  const canRetry = showRetry && onRetry && retryCount < maxRetries;
  const retryText = retryCount > 0 ? ` (Attempt ${retryCount + 1}/${maxRetries})` : '';

  return (
    <div 
      className="error-message"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="error-message__content">
        <div className="error-message__icon" aria-hidden="true">
          ⚠️
        </div>
        <div className="error-message__text">
          <h4 className="error-message__title">
            Search Error
          </h4>
          <p className="error-message__description">
            {error}
          </p>
          {retryCount > 0 && (
            <p className="error-message__retry-info">
              Retry attempt: {retryCount}/{maxRetries}
            </p>
          )}
        </div>
      </div>
      
      {canRetry && (
        <div className="error-message__actions">
          <button
            type="button"
            className="error-message__retry-button"
            onClick={onRetry}
            aria-label={`Retry medication search${retryText}`}
          >
            🔄 Try Again{retryText}
          </button>
        </div>
      )}
      
      {retryCount >= maxRetries && (
        <div className="error-message__max-retries">
          <p>
            Maximum retry attempts reached. Please:
          </p>
          <ul>
            <li>Check your internet connection</li>
            <li>Try a different search term</li>
            <li>Contact support if the problem persists</li>
          </ul>
        </div>
      )}
      
      <div className="error-message__help">
        <details>
          <summary>Troubleshooting Tips</summary>
          <ul>
            <li>Ensure your search term is at least 2 characters long</li>
            <li>Try searching for generic medication names</li>
            <li>Check your spelling and try common abbreviations</li>
            <li>If searching for brand names, try the generic equivalent</li>
          </ul>
        </details>
      </div>
    </div>
  );
};

export default ErrorMessage;