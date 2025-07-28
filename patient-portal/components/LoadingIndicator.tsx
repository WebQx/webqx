/**
 * LoadingIndicator Component
 * 
 * Displays an animated loading indicator with accessibility features
 * including ARIA live regions and screen reader support.
 */

import React from 'react';
import { LoadingIndicatorProps } from '../types/prescription';

/**
 * LoadingIndicator - Accessible loading state component with animations
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isLoading,
  message = 'Searching medications...',
  animated = true,
  size = 'medium'
}) => {
  if (!isLoading) {
    return null;
  }

  const sizeClass = `loading-indicator--${size}`;
  const animatedClass = animated ? 'loading-indicator--animated' : '';

  return (
    <div 
      className={`loading-indicator ${sizeClass} ${animatedClass}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="loading-indicator__spinner" aria-hidden="true">
        <div className="loading-indicator__dot loading-indicator__dot--1"></div>
        <div className="loading-indicator__dot loading-indicator__dot--2"></div>
        <div className="loading-indicator__dot loading-indicator__dot--3"></div>
      </div>
      <span className="loading-indicator__message">{message}</span>
      <span className="sr-only">
        Please wait while we search for medications matching your query.
      </span>
    </div>
  );
};

export default LoadingIndicator;