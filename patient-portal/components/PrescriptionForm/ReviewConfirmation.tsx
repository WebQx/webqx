import React from 'react';
import { FormStepProps } from './types';

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  available: boolean;
}

// Mock pharmacy data (same as PharmacySelector)
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

interface ReviewConfirmationProps extends FormStepProps {
  /** Callback when form is submitted */
  onSubmit?: () => void;
  /** Whether form is currently being submitted */
  isSubmitting?: boolean;
}

/**
 * ReviewConfirmation component for reviewing and confirming refill request
 */
export const ReviewConfirmation: React.FC<ReviewConfirmationProps> = ({
  data,
  medications,
  onPrevious,
  onSubmit,
  isSubmitting = false
}) => {
  const selectedMedication = medications.find(m => m.id === data.medicationId);
  const selectedPharmacy = PHARMACIES.find(p => p.id === data.pharmacyId);

  const handleSubmit = () => {
    if (onSubmit && !isSubmitting) {
      onSubmit();
    }
  };

  const handlePrevious = () => {
    if (onPrevious && !isSubmitting) {
      onPrevious();
    }
  };

  const formatUrgency = (urgency: string) => {
    return urgency === 'urgent' ? 'Urgent (1-2 business days)' : 'Routine (3-5 business days)';
  };

  const estimatedCost = calculateEstimatedCost(data.quantity || 30);
  const estimatedReadyDate = calculateEstimatedReadyDate(data.urgency || 'routine');

  return (
    <div 
      className="review-confirmation"
      role="group"
      aria-labelledby="review-heading"
    >
      <header className="review-confirmation__header">
        <h2 id="review-heading">
          Review Your Refill Request
        </h2>
        <p className="review-confirmation__subtitle">
          Please review the details below before submitting your prescription refill request.
        </p>
      </header>

      <div className="review-confirmation__content">
        {/* Medication Summary */}
        <section 
          className="review-section"
          role="group"
          aria-labelledby="medication-summary-heading"
        >
          <h3 id="medication-summary-heading" className="review-section__title">
            💊 Medication Information
          </h3>
          
          {selectedMedication && (
            <div className="medication-summary">
              <dl className="summary-list">
                <dt>Medication Name:</dt>
                <dd>{selectedMedication.name}</dd>
                
                <dt>Dosage:</dt>
                <dd>{selectedMedication.dosage}</dd>
                
                <dt>Frequency:</dt>
                <dd>{selectedMedication.frequency}</dd>
                
                <dt>Prescribed By:</dt>
                <dd>{selectedMedication.prescribedBy}</dd>
                
                <dt>Quantity Requested:</dt>
                <dd>{data.quantity} days supply</dd>
                
                <dt>Refills Remaining After This Request:</dt>
                <dd>{selectedMedication.refillsRemaining - 1}</dd>
              </dl>
            </div>
          )}
        </section>

        {/* Pharmacy Summary */}
        <section 
          className="review-section"
          role="group"
          aria-labelledby="pharmacy-summary-heading"
        >
          <h3 id="pharmacy-summary-heading" className="review-section__title">
            🏪 Pharmacy Information
          </h3>
          
          {selectedPharmacy && (
            <div className="pharmacy-summary">
              <dl className="summary-list">
                <dt>Pharmacy Name:</dt>
                <dd>{selectedPharmacy.name}</dd>
                
                <dt>Address:</dt>
                <dd>{selectedPharmacy.address}</dd>
                
                <dt>Phone Number:</dt>
                <dd>{selectedPharmacy.phone}</dd>
                
                <dt>Hours:</dt>
                <dd>{selectedPharmacy.hours}</dd>
              </dl>
            </div>
          )}
        </section>

        {/* Request Details */}
        <section 
          className="review-section"
          role="group"
          aria-labelledby="request-details-heading"
        >
          <h3 id="request-details-heading" className="review-section__title">
            📋 Request Details
          </h3>
          
          <div className="request-summary">
            <dl className="summary-list">
              <dt>Priority:</dt>
              <dd>{formatUrgency(data.urgency || 'routine')}</dd>
              
              <dt>Estimated Ready Date:</dt>
              <dd>{estimatedReadyDate}</dd>
              
              <dt>Estimated Cost:</dt>
              <dd className="cost-estimate">${estimatedCost.toFixed(2)}</dd>
              
              {data.instructions && (
                <>
                  <dt>Special Instructions:</dt>
                  <dd>{data.instructions}</dd>
                </>
              )}
            </dl>
          </div>
        </section>

        {/* Important Information */}
        <section 
          className="review-section review-section--notice"
          role="group"
          aria-labelledby="important-info-heading"
        >
          <h3 id="important-info-heading" className="review-section__title">
            ⚠️ Important Information
          </h3>
          
          <div className="important-notices">
            <ul>
              <li>
                You will receive a confirmation email once your request is processed.
              </li>
              <li>
                The pharmacy will contact you when your prescription is ready for pickup.
              </li>
              <li>
                Estimated costs are approximate and may vary based on your insurance coverage.
              </li>
              <li>
                If you need to cancel or modify this request, contact the pharmacy directly.
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/* Actions */}
      <div className="review-confirmation__footer">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handlePrevious}
          disabled={isSubmitting}
        >
          ← Back to Details
        </button>
        
        <button
          type="button"
          className="btn btn--primary btn--submit"
          onClick={handleSubmit}
          disabled={isSubmitting}
          aria-describedby="submit-button-help"
        >
          {isSubmitting ? (
            <>
              <span 
                className="submit-spinner"
                aria-hidden="true"
              >
                ↻
              </span>
              Submitting Request...
            </>
          ) : (
            <>
              <span aria-hidden="true">✓</span>
              Submit Refill Request
            </>
          )}
        </button>
        
        <div id="submit-button-help" className="sr-only">
          {isSubmitting 
            ? 'Your refill request is being processed'
            : 'Submit your prescription refill request'
          }
        </div>
      </div>

      {/* Live region for submission status */}
      <div 
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {isSubmitting && 'Submitting your prescription refill request. Please wait...'}
      </div>
    </div>
  );
};

// Helper functions
function calculateEstimatedCost(quantity: number): number {
  // Mock cost calculation based on quantity
  const basePrice = 25.99;
  const pricePerDay = 0.85;
  return basePrice + (quantity * pricePerDay);
}

function calculateEstimatedReadyDate(urgency: string): string {
  const now = new Date();
  const daysToAdd = urgency === 'urgent' ? 1 : 3;
  const readyDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  
  return readyDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default ReviewConfirmation;