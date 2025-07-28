import React, { useState } from 'react';
import { ApiError } from './types';

interface ErrorHandlerProps {
  /** The error to display */
  error: ApiError | null;
  /** Callback when retry is requested */
  onRetry?: () => void;
  /** Callback when error is dismissed */
  onDismiss?: () => void;
  /** Whether retry is currently in progress */
  isRetrying?: boolean;
  /** CSS class name for styling */
  className?: string;
  /** Whether to show detailed error information */
  showDetails?: boolean;
}

/**
 * ErrorHandler component for displaying errors with retry functionality
 * Provides accessible error messages and retry mechanisms
 */
export const ErrorHandler: React.FC<ErrorHandlerProps> = ({
  error,
  onRetry,
  onDismiss,
  isRetrying = false,
  className = '',
  showDetails = false
}) => {
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  if (!error) {
    return null;
  }

  const handleRetry = () => {
    if (onRetry && !isRetrying) {
      onRetry();
    }
  };

  const handleDismiss = () => {
    if (onDismiss && !isRetrying) {
      onDismiss();
    }
  };

  const toggleDetails = () => {
    setDetailsExpanded(!detailsExpanded);
  };

  return (
    <div 
      className={`error-handler ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="error-handler__content">
        {/* Error icon */}
        <div 
          className="error-handler__icon"
          aria-hidden="true"
        >
          ⚠️
        </div>

        {/* Error message */}
        <div className="error-handler__message">
          <h3 className="error-handler__title">
            Something went wrong
          </h3>
          <p className="error-handler__description">
            {error.message}
          </p>

          {/* Error details toggle */}
          {showDetails && (
            <button
              type="button"
              className="error-handler__details-toggle"
              onClick={toggleDetails}
              aria-expanded={detailsExpanded}
              aria-controls="error-details"
            >
              {detailsExpanded ? 'Hide' : 'Show'} technical details
            </button>
          )}

          {/* Expanded error details */}
          {showDetails && detailsExpanded && (
            <div 
              id="error-details"
              className="error-handler__details"
            >
              <dl className="error-handler__details-list">
                <dt>Error Code:</dt>
                <dd>{error.code}</dd>
                <dt>Retryable:</dt>
                <dd>{error.retryable ? 'Yes' : 'No'}</dd>
                <dt>Timestamp:</dt>
                <dd>{new Date().toLocaleString()}</dd>
              </dl>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="error-handler__actions">
          {/* Retry button - only show if error is retryable */}
          {error.retryable && onRetry && (
            <button
              type="button"
              className="error-handler__retry-btn"
              onClick={handleRetry}
              disabled={isRetrying}
              aria-label={isRetrying ? 'Retrying...' : 'Try again'}
            >
              {isRetrying ? (
                <>
                  <span 
                    className="error-handler__retry-spinner"
                    aria-hidden="true"
                  >
                    ↻
                  </span>
                  Retrying...
                </>
              ) : (
                <>
                  <span aria-hidden="true">🔄</span>
                  Try Again
                </>
              )}
            </button>
          )}

          {/* Dismiss button */}
          {onDismiss && (
            <button
              type="button"
              className="error-handler__dismiss-btn"
              onClick={handleDismiss}
              disabled={isRetrying}
              aria-label="Dismiss error"
            >
              <span aria-hidden="true">✕</span>
              <span className="sr-only">Dismiss</span>
            </button>
          )}
        </div>
      </div>

      {/* Additional help text */}
      <div className="error-handler__help">
        {error.retryable ? (
          <p className="error-handler__help-text">
            This error can be retried. Click "Try Again" to attempt the operation once more.
          </p>
        ) : (
          <p className="error-handler__help-text">
            If this problem persists, please contact our support team or try again later.
          </p>
        )}
      </div>
    </div>
  );
};

export default ErrorHandler;