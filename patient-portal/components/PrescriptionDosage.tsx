import React from 'react';

/**
 * Interface for individual dosage options
 */
interface Dosage {
  /** Unique identifier for the dosage */
  id: string;
  /** Dosage amount (e.g., "250mg", "500mg") */
  amount: string;
  /** Frequency of dosage (e.g., "twice daily", "once daily") */
  frequency: string;
  /** Instructions for taking the medication */
  instructions?: string;
  /** Whether this dosage is recommended */
  recommended?: boolean;
}

/**
 * Props for the PrescriptionDosage component
 */
interface PrescriptionDosageProps {
  /** Array of available dosage options */
  dosages: Dosage[];
  /** Callback function called when user chooses a dosage */
  onChoose: (dosage: Dosage) => void;
  /** CSS class name for styling */
  className?: string;
  /** Title for the dosage selection */
  title?: string;
}

/**
 * PrescriptionDosage component displays dosage options and allows users to choose a dosage
 * 
 * Features:
 * - Type-safe dosage props
 * - Callback functionality for dosage selection
 * - Accessibility support with ARIA labels
 * - Fallback for empty dosage lists
 * - Responsive styling
 */
export const PrescriptionDosage: React.FC<PrescriptionDosageProps> = ({
  dosages,
  onChoose,
  className = "",
  title = "Select Dosage"
}) => {
  const handleChoose = (dosage: Dosage) => {
    onChoose(dosage);
  };

  return (
    <div 
      className={`prescription-dosage ${className}`}
      role="region"
      aria-label="Prescription dosage selection"
    >
      <div className="prescription-dosage-header">
        <h3 className="prescription-dosage-title">{title}</h3>
      </div>
      
      <div className="prescription-dosage-content">
        {dosages.length === 0 ? (
          <div 
            className="prescription-dosage-empty"
            role="status"
            aria-live="polite"
          >
            <p>No dosage options available at this time.</p>
            <p>Please contact your healthcare provider for assistance.</p>
          </div>
        ) : (
          <div 
            className="prescription-dosage-list"
            role="list"
            aria-label={`${dosages.length} dosage options available`}
          >
            {dosages.map((dosage) => (
              <div 
                key={dosage.id}
                className={`prescription-dosage-item ${dosage.recommended ? 'recommended' : ''}`}
                role="listitem"
              >
                <div className="prescription-dosage-info">
                  <div className="prescription-dosage-amount">
                    <strong>{dosage.amount}</strong>
                    {dosage.recommended && (
                      <span 
                        className="prescription-dosage-recommended-badge"
                        aria-label="Recommended dosage"
                      >
                        ⭐ Recommended
                      </span>
                    )}
                  </div>
                  <div className="prescription-dosage-frequency">
                    {dosage.frequency}
                  </div>
                  {dosage.instructions && (
                    <div className="prescription-dosage-instructions">
                      {dosage.instructions}
                    </div>
                  )}
                </div>
                <div className="prescription-dosage-actions">
                  <button
                    className="prescription-dosage-choose-btn"
                    onClick={() => handleChoose(dosage)}
                    aria-label={`Choose ${dosage.amount} ${dosage.frequency} dosage${dosage.recommended ? ' (recommended)' : ''}`}
                  >
                    Choose
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrescriptionDosage;