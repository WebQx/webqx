/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React, { useState } from 'react';
import { MedCardProps } from '../types/prescription';

/**
 * MedCard component displays individual medication information
 * Optimized for accessibility and user interaction
 */
export const MedCard: React.FC<MedCardProps> = ({
  medication,
  translations = {},
  onRefillRequest,
  onViewDetails,
  className = '',
  isLoading = false
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Default translations with fallbacks
  const t = {
    dosageLabel: translations.dosageLabel || 'Dosage',
    frequencyLabel: translations.frequencyLabel || 'Frequency',
    refillsLabel: translations.refillsLabel || 'Refills remaining',
    prescriberLabel: translations.prescriberLabel || 'Prescribed by',
    refillButton: translations.refillButton || 'Request Refill',
    viewDetailsButton: translations.viewDetailsButton || 'View Details',
    pharmacyLabel: translations.pharmacyLabel || 'Pharmacy'
  };

  const handleRefillRequest = () => {
    if (onRefillRequest && !isLoading) {
      onRefillRequest(medication.id);
    }
  };

  const handleViewDetails = () => {
    if (onViewDetails && !isLoading) {
      onViewDetails(medication.id);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  if (isLoading) {
    return (
      <div 
        className={`med-card loading ${className}`}
        role="article"
        aria-label="Loading medication information"
        aria-busy="true"
      >
        <div className="med-card-skeleton">
          <div className="skeleton-line skeleton-title"></div>
          <div className="skeleton-line skeleton-text"></div>
          <div className="skeleton-line skeleton-text"></div>
          <div className="skeleton-buttons">
            <div className="skeleton-button"></div>
            <div className="skeleton-button"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article
      className={`med-card ${!medication.isActive ? 'inactive' : ''} ${className}`}
      role="article"
      aria-labelledby={`med-${medication.id}-name`}
      aria-describedby={`med-${medication.id}-details`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        boxShadow: isHovered 
          ? '0 4px 12px rgba(0, 0, 0, 0.15)' 
          : '0 2px 6px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* Medication Header */}
      <header className="med-card-header">
        <h3 
          id={`med-${medication.id}-name`}
          className="med-name"
        >
          💊 {medication.name}
        </h3>
        <div 
          className={`med-status ${medication.isActive ? 'active' : 'inactive'}`}
          role="status"
          aria-label={`Medication status: ${medication.isActive ? 'Active' : 'Inactive'}`}
        >
          {medication.isActive ? '🟢 Active' : '🔴 Inactive'}
        </div>
      </header>

      {/* Medication Details */}
      <div 
        id={`med-${medication.id}-details`}
        className="med-card-body"
      >
        <dl className="med-details" role="group" aria-label="Medication details">
          <div className="med-detail-item">
            <dt className="med-detail-label">{t.dosageLabel}:</dt>
            <dd className="med-detail-value" aria-describedby={`dosage-${medication.id}`}>
              <span id={`dosage-${medication.id}`}>{medication.dosage}</span>
            </dd>
          </div>

          <div className="med-detail-item">
            <dt className="med-detail-label">{t.frequencyLabel}:</dt>
            <dd className="med-detail-value" aria-describedby={`frequency-${medication.id}`}>
              <span id={`frequency-${medication.id}`}>{medication.frequency}</span>
            </dd>
          </div>

          <div className="med-detail-item">
            <dt className="med-detail-label">{t.prescriberLabel}:</dt>
            <dd className="med-detail-value" aria-describedby={`prescriber-${medication.id}`}>
              <span id={`prescriber-${medication.id}`}>{medication.prescriber}</span>
            </dd>
          </div>

          <div className="med-detail-item">
            <dt className="med-detail-label">{t.refillsLabel}:</dt>
            <dd 
              className={`med-detail-value ${medication.refillsRemaining === 0 ? 'no-refills' : ''}`}
              aria-describedby={`refills-${medication.id}`}
            >
              <span 
                id={`refills-${medication.id}`}
                aria-label={`${medication.refillsRemaining} refills remaining`}
              >
                {medication.refillsRemaining}
                {medication.refillsRemaining === 0 && ' ⚠️'}
              </span>
            </dd>
          </div>

          {medication.instructions && (
            <div className="med-detail-item med-instructions">
              <dt className="med-detail-label">Instructions:</dt>
              <dd className="med-detail-value" aria-describedby={`instructions-${medication.id}`}>
                <span id={`instructions-${medication.id}`}>{medication.instructions}</span>
              </dd>
            </div>
          )}

          {medication.pharmacy && (
            <div className="med-detail-item">
              <dt className="med-detail-label">{t.pharmacyLabel}:</dt>
              <dd className="med-detail-value" aria-describedby={`pharmacy-${medication.id}`}>
                <span id={`pharmacy-${medication.id}`}>
                  {medication.pharmacy.name}
                  {medication.pharmacy.isPreferred && ' ⭐'}
                </span>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Action Buttons */}
      <footer className="med-card-actions" role="group" aria-label="Medication actions">
        <button
          type="button"
          className={`med-action-btn refill-btn ${medication.refillsRemaining === 0 ? 'disabled' : ''}`}
          onClick={handleRefillRequest}
          onKeyPress={(e) => handleKeyPress(e, handleRefillRequest)}
          disabled={medication.refillsRemaining === 0 || !medication.isActive}
          aria-label={`Request refill for ${medication.name}`}
          aria-describedby={`refill-help-${medication.id}`}
        >
          🔄 {t.refillButton}
        </button>
        <div 
          id={`refill-help-${medication.id}`} 
          className="sr-only"
        >
          {medication.refillsRemaining === 0 
            ? 'No refills remaining. Contact your doctor for a new prescription.'
            : `${medication.refillsRemaining} refills available`
          }
        </div>

        <button
          type="button"
          className="med-action-btn details-btn"
          onClick={handleViewDetails}
          onKeyPress={(e) => handleKeyPress(e, handleViewDetails)}
          aria-label={`View detailed information for ${medication.name}`}
        >
          📋 {t.viewDetailsButton}
        </button>
      </footer>
    </article>
  );
};

export default MedCard;