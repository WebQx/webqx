import React from 'react';
import { TooltipContent } from '../types';

/**
 * FormField component for consistent form field styling and accessibility
 */
interface FormFieldProps {
  /** Field label text */
  label: string;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Warning message to display */
  warning?: string;
  /** Tooltip configuration */
  tooltip?: TooltipContent;
  /** Additional CSS classes */
  className?: string;
  /** Field children (input, select, etc.) */
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  error,
  warning,
  tooltip,
  className = '',
  children
}) => {
  const fieldId = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hasError = !!error;
  const hasWarning = !!warning;

  return (
    <div className={`form-field ${hasError ? 'has-error' : ''} ${hasWarning ? 'has-warning' : ''} ${className}`}>
      <label htmlFor={fieldId} className="form-label">
        {label}
        {required && <span className="required-indicator" aria-label="required">*</span>}
        {tooltip && (
          <button
            type="button"
            className="tooltip-trigger"
            aria-label={`More information about ${label}`}
            title={tooltip.content}
          >
            ℹ️
          </button>
        )}
      </label>
      
      <div className="form-input-wrapper">
        {children}
      </div>
      
      {error && (
        <div className="field-error" role="alert" aria-live="polite">
          ❌ {error}
        </div>
      )}
      
      {warning && (
        <div className="field-warning" role="alert" aria-live="polite">
          ⚠️ {warning}
        </div>
      )}
    </div>
  );
};

export default FormField;