import React from 'react';
import { SubmitButtonProps } from './types';

/**
 * Submit Button Component
 * Accessible button with loading state for form submissions
 */
const SubmitButton: React.FC<SubmitButtonProps> = ({ 
  onClick, 
  isLoading = false,
  'aria-label': ariaLabel = "Submit", 
  disabled = false 
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      aria-label={isLoading ? "Submitting..." : ariaLabel}
      className="submit-button"
      style={{
        backgroundColor: isDisabled ? '#ccc' : '#2196F3',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '12px 24px',
        fontSize: '16px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      {isLoading && (
        <span
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid #ffffff',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
          aria-hidden="true"
        />
      )}
      {isLoading ? 'Submitting...' : 'Submit Note'}
    </button>
  );
};

export default SubmitButton;