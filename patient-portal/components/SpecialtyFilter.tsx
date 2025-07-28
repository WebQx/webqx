import React, { useState } from 'react';

/**
 * SpecialtyFilter component provides a dropdown for selecting medical specialties
 * Includes accessibility features, error handling, and proper styling
 */
interface SpecialtyFilterProps {
  /** Array of specialty options to display in the dropdown */
  specialties?: string[];
  /** Callback function called when a specialty is selected */
  onSelect?: (selectedSpecialty: string) => void;
  /** CSS class name for styling */
  className?: string;
  /** ID for the select element (auto-generated if not provided) */
  id?: string;
  /** Label text for the dropdown */
  label?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Currently selected specialty value */
  value?: string;
}

export const SpecialtyFilter: React.FC<SpecialtyFilterProps> = ({
  specialties = [],
  onSelect,
  className = "",
  id = "specialty-filter",
  label = "Select Specialty",
  disabled = false,
  value
}) => {
  const [selectedValue, setSelectedValue] = useState(value || "");
  
  // Handle case where specialties array is empty or undefined
  const hasSpecialties = specialties && specialties.length > 0;
  const isDisabled = disabled || !hasSpecialties;
  
  // Use controlled value if provided, otherwise use internal state
  const currentValue = value !== undefined ? value : selectedValue;

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = event.target.value;
    
    // Update internal state if not controlled
    if (value === undefined) {
      setSelectedValue(newValue);
    }
    
    // Call onSelect callback if provided and value is not empty
    if (newValue && onSelect) {
      onSelect(newValue);
    }
  };

  return (
    <div 
      className={`specialty-filter ${className}`}
      role="group"
      aria-labelledby={`${id}-label`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: '300px'
      }}
    >
      <label 
        id={`${id}-label`}
        htmlFor={id}
        className="specialty-filter-label"
        style={{
          fontWeight: '600',
          color: '#374151',
          fontSize: '0.875rem'
        }}
      >
        {label}
      </label>
      
      <select
        id={id}
        value={currentValue}
        onChange={handleSelectChange}
        disabled={isDisabled}
        className="specialty-filter-select"
        aria-describedby={!hasSpecialties ? `${id}-error` : undefined}
        aria-required="false"
        style={{
          padding: '0.75rem',
          border: '2px solid #d1d5db',
          borderRadius: '0.375rem',
          backgroundColor: isDisabled ? '#f3f4f6' : 'white',
          fontSize: '1rem',
          transition: 'all 0.2s ease-in-out',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          color: isDisabled ? '#9ca3af' : 'inherit'
        }}
        onFocus={(e) => {
          const target = e.target as HTMLSelectElement;
          if (!isDisabled) {
            target.style.borderColor = '#3b82f6';
            target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
          }
        }}
        onBlur={(e) => {
          const target = e.target as HTMLSelectElement;
          target.style.borderColor = '#d1d5db';
          target.style.boxShadow = 'none';
        }}
        onMouseEnter={(e) => {
          const target = e.target as HTMLSelectElement;
          if (!isDisabled) {
            target.style.borderColor = '#9ca3af';
            target.style.backgroundColor = '#f9fafb';
          }
        }}
        onMouseLeave={(e) => {
          const target = e.target as HTMLSelectElement;
          if (!isDisabled && document.activeElement !== target) {
            target.style.borderColor = '#d1d5db';
            target.style.backgroundColor = 'white';
          }
        }}
      >
        <option value="" disabled>
          {hasSpecialties ? "Select a specialty" : "No specialties available"}
        </option>
        
        {hasSpecialties && specialties.map((specialty, index) => (
          <option key={index} value={specialty}>
            {specialty}
          </option>
        ))}
      </select>
      
      {!hasSpecialties && (
        <div 
          id={`${id}-error`}
          className="specialty-filter-error"
          role="alert"
          aria-live="polite"
          style={{
            color: '#dc2626',
            fontSize: '0.875rem',
            padding: '0.5rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.25rem',
            marginTop: '0.25rem'
          }}
        >
          No specialties are currently available for selection.
        </div>
      )}
    </div>
  );
};

export default SpecialtyFilter;