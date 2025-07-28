import React from 'react';
import { LoadingState } from './types';

interface LoadingIndicatorProps {
  /** Current loading state */
  loading: LoadingState;
  /** CSS class name for styling */
  className?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Whether to show progress bar */
  showProgress?: boolean;
}

/**
 * LoadingIndicator component with animations and accessibility features
 * Provides visual and screen reader feedback for loading states
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  loading,
  className = '',
  size = 'medium',
  showProgress = false
}) => {
  const { isLoading, loadingMessage, progress } = loading;

  if (!isLoading) {
    return null;
  }

  const sizeClasses = {
    small: 'loading-indicator--small',
    medium: 'loading-indicator--medium',
    large: 'loading-indicator--large'
  };

  return (
    <div 
      className={`loading-indicator ${sizeClasses[size]} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Animated spinner */}
      <div 
        className="loading-indicator__spinner"
        aria-hidden="true"
      >
        <svg 
          viewBox="0 0 50 50"
          className="loading-indicator__svg"
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            className="loading-indicator__circle"
          />
        </svg>
      </div>

      {/* Loading message */}
      <div className="loading-indicator__message">
        <span className="sr-only">Loading: </span>
        {loadingMessage}
      </div>

      {/* Progress bar if enabled and progress is available */}
      {showProgress && typeof progress === 'number' && (
        <div 
          className="loading-indicator__progress"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Loading progress: ${progress}%`}
        >
          <div 
            className="loading-indicator__progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Pulsing dots animation for reduced motion preference */}
      <div 
        className="loading-indicator__dots"
        aria-hidden="true"
      >
        <span className="loading-indicator__dot"></span>
        <span className="loading-indicator__dot"></span>
        <span className="loading-indicator__dot"></span>
      </div>
    </div>
  );
};

export default LoadingIndicator;