import React from 'react';

/**
 * Interface for individual dosage option
 */
export interface Dosage {
  /** Unique identifier for the dosage */
  id: string;
  /** Dosage amount (e.g., "10", "25", "50") */
  amount: string;
  /** Unit of measurement (e.g., "mg", "ml", "tablets") */
  unit: string;
  /** Frequency of administration (e.g., "once daily", "twice daily") */
  frequency: string;
  /** Optional additional instructions */
  instructions?: string;
}

/**
 * Props interface for PrescriptionDosage component
 */
export interface PrescriptionDosageProps {
  /** Array of available dosage options */
  dosages: Dosage[];
  /** Callback function when user chooses a dosage */
  onChoose: (dosage: Dosage) => void;
  /** CSS class name for styling */
  className?: string;
  /** Title for the dosage selection section */
  title?: string;
}

/**
 * PrescriptionDosage component displays dosage options and allows users to choose a dosage
 * 
 * Features:
 * - Type-safe dosage data structure
 * - Callback for user selection handling
 * - Accessibility-compliant design with ARIA labels
 * - Empty state fallback message
 * - Responsive styling with CSS classes
 */
export const PrescriptionDosage: React.FC<PrescriptionDosageProps> = ({
  dosages,
  onChoose,
  className = "",
  title = "Available Dosage Options"
}) => {
  /**
   * Handle dosage selection
   */
  const handleChoose = (dosage: Dosage) => {
    onChoose(dosage);
  };

  return (
    <div 
      className={`prescription-dosage ${className}`}
      role="region"
      aria-label="Prescription dosage selection"
    >
      <h3 
        id="dosage-title"
        className="prescription-dosage-title"
      >
        {title}
      </h3>
      
      {dosages.length === 0 ? (
        <div 
          className="prescription-dosage-empty"
          role="status"
          aria-label="No dosage options available"
        >
          <p className="empty-message">
            No dosage options are currently available. Please contact your healthcare provider.
          </p>
        </div>
      ) : (
        <div 
          className="prescription-dosage-list"
          role="list"
          aria-labelledby="dosage-title"
        >
          {dosages.map((dosage) => (
            <div 
              key={dosage.id}
              className="prescription-dosage-item"
              role="listitem"
            >
              <div className="dosage-details">
                <div className="dosage-amount-unit">
                  <strong>{dosage.amount} {dosage.unit}</strong>
                </div>
                <div className="dosage-frequency">
                  {dosage.frequency}
                </div>
                {dosage.instructions && (
                  <div className="dosage-instructions">
                    {dosage.instructions}
                  </div>
                )}
              </div>
              <button
                className="dosage-choose-button"
                onClick={() => handleChoose(dosage)}
                aria-label={`Choose ${dosage.amount} ${dosage.unit} ${dosage.frequency} dosage option`}
                type="button"
              >
                Choose
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrescriptionDosage;