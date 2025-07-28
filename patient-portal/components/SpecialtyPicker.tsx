import React, { useState, useEffect } from 'react';
import { Specialty, fetchSpecialties, getSpecialtyById } from '../data/specialties';

/**
 * Props for the SpecialtyPicker component
 */
interface SpecialtyPickerProps {
  /** The currently selected specialty ID */
  selectedSpecialtyId?: string;
  /** Callback function when specialty selection changes */
  onSpecialtyChange?: (specialtyId: string) => void;
  /** Label text for the dropdown */
  label?: string;
  /** CSS class name for additional styling */
  className?: string;
  /** Whether to show the selected specialty below the dropdown */
  showSelectedSpecialty?: boolean;
  /** Loading state override for testing */
  loadingOverride?: boolean;
  /** Error state override for testing */
  errorOverride?: string;
  /** Specialties override for testing */
  specialtiesOverride?: Specialty[];
}

/**
 * SpecialtyPicker Component
 * 
 * A dropdown component for selecting medical specialties with:
 * - Dynamic options fetched from configuration/API
 * - Full accessibility compliance with ARIA attributes
 * - Display of currently selected specialty
 * - Responsive design and styling
 */
export const SpecialtyPicker: React.FC<SpecialtyPickerProps> = ({
  selectedSpecialtyId = '',
  onSpecialtyChange,
  label = 'Select Medical Specialty',
  className = '',
  showSelectedSpecialty = true,
  loadingOverride,
  errorOverride,
  specialtiesOverride
}) => {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [currentSelectedId, setCurrentSelectedId] = useState<string>(selectedSpecialtyId || '');

  const selectId = 'specialty-picker-select';
  const labelId = 'specialty-picker-label';

  /**
   * Load specialties from the API/configuration
   */
  useEffect(() => {
    const loadSpecialties = async () => {
      try {
        // Handle error override first
        if (errorOverride) {
          setError(errorOverride);
          setLoading(false);
          setSpecialties([]);
          return;
        }

        // Handle loading override
        if (loadingOverride !== undefined) {
          setLoading(loadingOverride);
          setError('');
          if (!loadingOverride) {
            setSpecialties(specialtiesOverride || []);
          } else {
            setSpecialties([]);
          }
          return;
        }

        // Use override for testing, otherwise fetch from API
        if (specialtiesOverride) {
          setSpecialties(specialtiesOverride);
          setLoading(false);
          setError('');
          return;
        }

        setLoading(true);
        setError('');
        const fetchedSpecialties = await fetchSpecialties();
        setSpecialties(fetchedSpecialties);
        setLoading(false);
      } catch (err) {
        setError('Failed to load medical specialties. Please try again.');
        setLoading(false);
        setSpecialties([]);
      }
    };

    loadSpecialties();
  }, [loadingOverride, errorOverride, specialtiesOverride]);

  /**
   * Update currentSelectedId when prop changes
   */
  useEffect(() => {
    setCurrentSelectedId(selectedSpecialtyId || '');
  }, [selectedSpecialtyId]);

  /**
   * Update selected specialty when selectedSpecialtyId prop changes
   */
  useEffect(() => {
    if (currentSelectedId && specialties.length > 0) {
      const specialty = getSpecialtyById(currentSelectedId) || 
                       specialties.find(s => s.id === currentSelectedId);
      setSelectedSpecialty(specialty || null);
    } else {
      setSelectedSpecialty(null);
    }
  }, [currentSelectedId, specialties]);

  /**
   * Handle specialty selection change
   */
  const handleSpecialtyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const specialtyId = event.target.value;
    const specialty = specialties.find(s => s.id === specialtyId);
    
    setCurrentSelectedId(specialtyId);
    setSelectedSpecialty(specialty || null);
    
    if (onSpecialtyChange) {
      onSpecialtyChange(specialtyId);
    }
  };

  return (
    <div 
      className={`specialty-picker ${className}`}
      role="group"
      aria-labelledby={labelId}
    >
      {/* Label */}
      <label 
        id={labelId}
        htmlFor={selectId}
        className="specialty-picker-label"
      >
        {label}
      </label>

      {/* Loading State */}
      {loading && (
        <div 
          className="specialty-picker-loading"
          role="status"
          aria-live="polite"
          aria-label="Loading medical specialties"
        >
          <span className="loading-spinner" aria-hidden="true">⏳</span>
          Loading medical specialties...
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div 
          className="specialty-picker-error"
          role="alert"
          aria-live="assertive"
        >
          <span className="error-icon" aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      {/* Dropdown */}
      {!loading && !error && (
        <>
          <select
            id={selectId}
            value={currentSelectedId}
            onChange={handleSpecialtyChange}
            className="specialty-picker-select"
            aria-describedby={showSelectedSpecialty ? 'selected-specialty-display' : undefined}
            aria-label={`${specialties.length} specialty options available`}
          >
            <option value="" disabled>
              Choose a medical specialty...
            </option>
            {specialties.map((specialty) => (
              <option 
                key={specialty.id} 
                value={specialty.id}
                title={specialty.description}
              >
                {specialty.name}
              </option>
            ))}
          </select>

          {/* Selected Specialty Display */}
          {showSelectedSpecialty && (
            <div 
              id="selected-specialty-display"
              className="specialty-picker-selected"
              role="status"
              aria-live="polite"
            >
              {selectedSpecialty ? (
                <div className="selected-specialty-info">
                  <strong>Selected Specialty:</strong>
                  <span className="selected-specialty-name">
                    {selectedSpecialty.name}
                  </span>
                  {selectedSpecialty.description && (
                    <span className="selected-specialty-description">
                      {selectedSpecialty.description}
                    </span>
                  )}
                </div>
              ) : (
                <span className="no-specialty-selected">
                  No specialty selected
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SpecialtyPicker;