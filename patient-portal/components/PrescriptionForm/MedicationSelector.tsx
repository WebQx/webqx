import React, { useState, useRef, useEffect } from 'react';
import { FormStepProps, Medication } from './types';

/**
 * MedicationSelector component for choosing medication to refill
 * Includes accessibility features and keyboard navigation
 */
export const MedicationSelector: React.FC<FormStepProps> = ({
  data,
  onDataChange,
  medications,
  loading,
  error,
  onNext
}) => {
  const [selectedMedication, setSelectedMedication] = useState<string>(
    data.medicationId || ''
  );
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const medicationRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter only refillable medications
  const refillableMeds = medications.filter(med => med.canRefill);

  useEffect(() => {
    // Focus first medication when component mounts
    if (refillableMeds.length > 0 && focusedIndex === -1) {
      setFocusedIndex(0);
    }
  }, [refillableMeds.length, focusedIndex]);

  const handleMedicationSelect = (medicationId: string, medication: Medication) => {
    setSelectedMedication(medicationId);
    onDataChange({ ...data, medicationId });
    
    // Announce selection to screen readers
    const announcement = `Selected ${medication.name} ${medication.dosage}`;
    announceToScreenReader(announcement);
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = Math.min(index + 1, refillableMeds.length - 1);
        setFocusedIndex(nextIndex);
        medicationRefs.current[nextIndex]?.focus();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = Math.max(index - 1, 0);
        setFocusedIndex(prevIndex);
        medicationRefs.current[prevIndex]?.focus();
        break;
        
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        medicationRefs.current[0]?.focus();
        break;
        
      case 'End':
        event.preventDefault();
        const lastIndex = refillableMeds.length - 1;
        setFocusedIndex(lastIndex);
        medicationRefs.current[lastIndex]?.focus();
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        const medication = refillableMeds[index];
        handleMedicationSelect(medication.id, medication);
        break;
    }
  };

  const handleNext = () => {
    if (selectedMedication && onNext) {
      onNext();
    }
  };

  // Utility function to announce to screen readers
  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  if (loading.isLoading) {
    return (
      <div className="medication-selector medication-selector--loading">
        <h2>Loading your medications...</h2>
        <p>Please wait while we fetch your prescription information.</p>
      </div>
    );
  }

  if (refillableMeds.length === 0) {
    return (
      <div className="medication-selector medication-selector--empty">
        <h2>No Refillable Medications</h2>
        <p>
          You don't currently have any medications that can be refilled. 
          Contact your healthcare provider if you need a new prescription.
        </p>
      </div>
    );
  }

  return (
    <div 
      className="medication-selector"
      ref={containerRef}
      role="group"
      aria-labelledby="medication-selector-heading"
    >
      <header className="medication-selector__header">
        <h2 id="medication-selector-heading">
          Select Medication to Refill
        </h2>
        <p className="medication-selector__instructions">
          Choose the medication you would like to refill. 
          Use arrow keys to navigate and Enter or Space to select.
        </p>
      </header>

      <div 
        className="medication-selector__list"
        role="radiogroup"
        aria-labelledby="medication-selector-heading"
        aria-required="true"
      >
        {refillableMeds.map((medication, index) => (
          <button
            key={medication.id}
            ref={el => { medicationRefs.current[index] = el; }}
            type="button"
            className={`medication-card ${
              selectedMedication === medication.id ? 'medication-card--selected' : ''
            }`}
            role="radio"
            aria-checked={selectedMedication === medication.id}
            tabIndex={focusedIndex === index ? 0 : -1}
            onClick={() => handleMedicationSelect(medication.id, medication)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onFocus={() => setFocusedIndex(index)}
            aria-describedby={`medication-${medication.id}-details`}
          >
            <div className="medication-card__header">
              <h3 className="medication-card__name">
                {medication.name}
              </h3>
              <span className="medication-card__dosage">
                {medication.dosage}
              </span>
            </div>
            
            <div 
              id={`medication-${medication.id}-details`}
              className="medication-card__details"
            >
              <p className="medication-card__frequency">
                <strong>Frequency:</strong> {medication.frequency}
              </p>
              <p className="medication-card__prescriber">
                <strong>Prescribed by:</strong> {medication.prescribedBy}
              </p>
              <p className="medication-card__refills">
                <strong>Refills remaining:</strong> {medication.refillsRemaining}
              </p>
              {medication.lastFilled && (
                <p className="medication-card__last-filled">
                  <strong>Last filled:</strong> {new Date(medication.lastFilled).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Selection indicator */}
            <div 
              className="medication-card__indicator"
              aria-hidden="true"
            >
              {selectedMedication === medication.id ? '✓' : '○'}
            </div>
          </button>
        ))}
      </div>

      <div className="medication-selector__footer">
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleNext}
          disabled={!selectedMedication}
          aria-describedby="next-button-help"
        >
          Continue to Pharmacy Selection
        </button>
        <div id="next-button-help" className="sr-only">
          {selectedMedication 
            ? 'Proceed to select pharmacy and complete your refill request'
            : 'Please select a medication first'
          }
        </div>
      </div>

      {/* Instructions for assistive technology */}
      <div className="sr-only" aria-live="polite">
        {refillableMeds.length} medications available for refill. 
        {selectedMedication 
          ? `Selected: ${refillableMeds.find(m => m.id === selectedMedication)?.name}`
          : 'No medication selected'
        }
      </div>
    </div>
  );
};

export default MedicationSelector;