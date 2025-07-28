import React, { useState } from 'react';
import { FormStepProps } from './types';

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  available: boolean;
}

// Mock pharmacy data
const PHARMACIES: Pharmacy[] = [
  {
    id: 'pharmacy-001',
    name: 'WebQX Community Pharmacy',
    address: '123 Health St, Medical Plaza, Suite 100',
    phone: '(555) 123-MEDS',
    hours: 'Mon-Fri: 8AM-8PM, Sat: 9AM-6PM, Sun: 10AM-4PM',
    available: true
  },
  {
    id: 'pharmacy-002',
    name: 'MediCare Plus Pharmacy',
    address: '456 Wellness Ave, Downtown Health Center',
    phone: '(555) 456-DRUG',
    hours: 'Mon-Sat: 9AM-9PM, Sun: 10AM-6PM',
    available: true
  },
  {
    id: 'pharmacy-003',
    name: 'HealthFirst Pharmacy',
    address: '789 Care Blvd, Neighborhood Medical Building',
    phone: '(555) 789-CARE',
    hours: 'Mon-Fri: 8AM-7PM, Sat: 9AM-5PM, Sun: Closed',
    available: false
  },
  {
    id: 'pharmacy-004',
    name: 'Express Scripts Pharmacy',
    address: '321 Quick Dr, Fast Fill Plaza',
    phone: '(555) 321-FAST',
    hours: '24/7 Service Available',
    available: true
  }
];

/**
 * PharmacySelector component for choosing pharmacy and refill details
 */
export const PharmacySelector: React.FC<FormStepProps> = ({
  data,
  onDataChange,
  medications,
  onNext,
  onPrevious
}) => {
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>(
    data.pharmacyId || ''
  );
  const [quantity, setQuantity] = useState<number>(data.quantity || 30);
  const [urgency, setUrgency] = useState<'routine' | 'urgent'>(
    data.urgency || 'routine'
  );
  const [instructions, setInstructions] = useState<string>(
    data.instructions || ''
  );

  const selectedMedication = medications.find(m => m.id === data.medicationId);
  const availablePharmacies = PHARMACIES.filter(p => p.available);

  const handlePharmacySelect = (pharmacyId: string) => {
    setSelectedPharmacy(pharmacyId);
    updateFormData({ pharmacyId });
  };

  const handleQuantityChange = (newQuantity: number) => {
    const validQuantity = Math.max(1, Math.min(90, newQuantity));
    setQuantity(validQuantity);
    updateFormData({ quantity: validQuantity });
  };

  const handleUrgencyChange = (newUrgency: 'routine' | 'urgent') => {
    setUrgency(newUrgency);
    updateFormData({ urgency: newUrgency });
  };

  const handleInstructionsChange = (newInstructions: string) => {
    setInstructions(newInstructions);
    updateFormData({ instructions: newInstructions });
  };

  const updateFormData = (updates: Partial<typeof data>) => {
    onDataChange({
      ...data,
      pharmacyId: selectedPharmacy,
      quantity,
      urgency,
      instructions,
      ...updates
    });
  };

  const handleNext = () => {
    if (selectedPharmacy && onNext) {
      onNext();
    }
  };

  const handlePrevious = () => {
    if (onPrevious) {
      onPrevious();
    }
  };

  const isFormValid = selectedPharmacy && quantity > 0;

  return (
    <div 
      className="pharmacy-selector"
      role="group"
      aria-labelledby="pharmacy-selector-heading"
    >
      <header className="pharmacy-selector__header">
        <h2 id="pharmacy-selector-heading">
          Choose Pharmacy & Refill Details
        </h2>
        
        {selectedMedication && (
          <div className="selected-medication-summary">
            <h3>Selected Medication:</h3>
            <p>
              <strong>{selectedMedication.name}</strong> {selectedMedication.dosage}
              <br />
              <span className="text-muted">
                {selectedMedication.frequency} • Prescribed by {selectedMedication.prescribedBy}
              </span>
            </p>
          </div>
        )}
      </header>

      <div className="pharmacy-selector__content">
        {/* Pharmacy Selection */}
        <section 
          className="pharmacy-selection"
          role="group"
          aria-labelledby="pharmacy-heading"
        >
          <h3 id="pharmacy-heading">Select Pharmacy</h3>
          
          <div 
            className="pharmacy-list"
            role="radiogroup"
            aria-labelledby="pharmacy-heading"
            aria-required="true"
          >
            {availablePharmacies.map((pharmacy) => (
              <label
                key={pharmacy.id}
                className={`pharmacy-option ${
                  selectedPharmacy === pharmacy.id ? 'pharmacy-option--selected' : ''
                }`}
              >
                <input
                  type="radio"
                  name="pharmacy"
                  value={pharmacy.id}
                  checked={selectedPharmacy === pharmacy.id}
                  onChange={() => handlePharmacySelect(pharmacy.id)}
                  className="pharmacy-option__radio"
                />
                
                <div className="pharmacy-option__content">
                  <h4 className="pharmacy-option__name">
                    {pharmacy.name}
                  </h4>
                  <p className="pharmacy-option__address">
                    📍 {pharmacy.address}
                  </p>
                  <p className="pharmacy-option__contact">
                    📞 {pharmacy.phone}
                  </p>
                  <p className="pharmacy-option__hours">
                    🕒 {pharmacy.hours}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Refill Details */}
        <section 
          className="refill-details"
          role="group"
          aria-labelledby="refill-details-heading"
        >
          <h3 id="refill-details-heading">Refill Details</h3>
          
          <div className="refill-details__grid">
            {/* Quantity Selection */}
            <div className="form-field">
              <label htmlFor="quantity-input" className="form-field__label">
                Quantity (days supply)
              </label>
              <div className="quantity-input-group">
                <button
                  type="button"
                  className="quantity-btn"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  id="quantity-input"
                  type="number"
                  min="1"
                  max="90"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                  className="quantity-input"
                  aria-describedby="quantity-help"
                />
                <button
                  type="button"
                  className="quantity-btn"
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={quantity >= 90}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <div id="quantity-help" className="form-field__help">
                Enter the number of days your medication should last (1-90 days)
              </div>
            </div>

            {/* Urgency Selection */}
            <div className="form-field">
              <fieldset className="urgency-fieldset">
                <legend className="form-field__label">
                  Request Priority
                </legend>
                <div className="urgency-options">
                  <label className="urgency-option">
                    <input
                      type="radio"
                      name="urgency"
                      value="routine"
                      checked={urgency === 'routine'}
                      onChange={() => handleUrgencyChange('routine')}
                    />
                    <span>🕒 Routine (3-5 business days)</span>
                  </label>
                  <label className="urgency-option">
                    <input
                      type="radio"
                      name="urgency"
                      value="urgent"
                      checked={urgency === 'urgent'}
                      onChange={() => handleUrgencyChange('urgent')}
                    />
                    <span>⚡ Urgent (1-2 business days)</span>
                  </label>
                </div>
              </fieldset>
            </div>
          </div>

          {/* Special Instructions */}
          <div className="form-field">
            <label htmlFor="instructions-input" className="form-field__label">
              Special Instructions (Optional)
            </label>
            <textarea
              id="instructions-input"
              value={instructions}
              onChange={(e) => handleInstructionsChange(e.target.value)}
              className="form-field__textarea"
              rows={3}
              maxLength={500}
              placeholder="Any special delivery instructions or notes..."
              aria-describedby="instructions-help"
            />
            <div id="instructions-help" className="form-field__help">
              {500 - instructions.length} characters remaining
            </div>
          </div>
        </section>
      </div>

      {/* Navigation */}
      <div className="pharmacy-selector__footer">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handlePrevious}
        >
          ← Back to Medication
        </button>
        
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleNext}
          disabled={!isFormValid}
          aria-describedby="continue-button-help"
        >
          Review & Submit Request
        </button>
        
        <div id="continue-button-help" className="sr-only">
          {isFormValid 
            ? 'Proceed to review your refill request'
            : 'Please select a pharmacy to continue'
          }
        </div>
      </div>
    </div>
  );
};

export default PharmacySelector;