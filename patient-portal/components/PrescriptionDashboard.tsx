import React, { useState, useMemo, useCallback } from 'react';
import { PrescriptionDashboardProps, Medication } from '../types/prescription';
import MedCard from './MedCard';

/**
 * PrescriptionDashboard component provides comprehensive medication management
 * Features accessibility, performance optimization, error handling, and loading states
 */
export const PrescriptionDashboard: React.FC<PrescriptionDashboardProps> = ({
  patientData,
  translations = {},
  isLoading = false,
  error,
  onRefillRequest,
  onViewDetails,
  onPharmacySelect,
  className = '',
  showInactive = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactiveMeds, setShowInactiveMeds] = useState(showInactive);

  // Default translations with comprehensive fallbacks
  const t = {
    title: translations.title || 'Prescription Dashboard',
    loadingMessage: translations.loadingMessage || 'Loading your medications...',
    noDataMessage: translations.noDataMessage || 'No medication data available. Please contact your healthcare provider.',
    noMedicationsFound: translations.noMedicationsFound || 'No medications found matching your search.',
    activeMedications: translations.activeMedications || 'Active Medications',
    allMedications: translations.allMedications || 'All Medications',
    searchPlaceholder: translations.searchPlaceholder || 'Search medications...',
    errorMessage: translations.errorMessage || 'Unable to load medication information. Please try again later.',
    medicationListLabel: translations.medicationListLabel || 'List of medications',
    pharmacyLabel: translations.pharmacyLabel || 'Preferred Pharmacy'
  };

  // Memoized filtered medications for performance optimization
  const filteredMedications = useMemo(() => {
    if (!patientData?.medications) return [];

    let medications = patientData.medications;

    // Filter by active/inactive status
    if (!showInactiveMeds) {
      medications = medications.filter(med => med.isActive);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      medications = medications.filter(med =>
        med.name.toLowerCase().includes(searchLower) ||
        med.prescriber.toLowerCase().includes(searchLower) ||
        med.instructions?.toLowerCase().includes(searchLower)
      );
    }

    return medications;
  }, [patientData?.medications, showInactiveMeds, searchTerm]);

  // Memoized medication count for performance
  const medicationCounts = useMemo(() => {
    if (!patientData?.medications) {
      return { active: 0, total: 0, needingRefill: 0 };
    }

    const active = patientData.medications.filter(med => med.isActive).length;
    const total = patientData.medications.length;
    const needingRefill = patientData.medications.filter(
      med => med.isActive && med.refillsRemaining === 0
    ).length;

    return { active, total, needingRefill };
  }, [patientData?.medications]);

  // Optimized search handler with useCallback
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // Optimized filter toggle handler
  const handleFilterToggle = useCallback(() => {
    setShowInactiveMeds(prev => !prev);
  }, []);

  // Handle keyboard navigation for search
  const handleSearchKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchTerm('');
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`prescription-dashboard loading ${className}`}
        role="main"
        aria-label={t.title}
        aria-busy="true"
      >
        <header className="dashboard-header">
          <h1 className="dashboard-title">
            <div className="skeleton-line skeleton-title"></div>
          </h1>
        </header>
        <div className="loading-content">
          <div className="loading-indicator" role="status" aria-label={t.loadingMessage}>
            <div className="spinner" aria-hidden="true"></div>
            <span className="loading-text">{t.loadingMessage}</span>
          </div>
          <div className="skeleton-grid">
            {[...Array(3)].map((_, index) => (
              <MedCard
                key={`skeleton-${index}`}
                medication={{} as Medication}
                isLoading={true}
                className="skeleton-med-card"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`prescription-dashboard error ${className}`}
        role="main"
        aria-label={t.title}
      >
        <header className="dashboard-header">
          <h1 className="dashboard-title">💊 {t.title}</h1>
        </header>
        <div 
          className="error-content"
          role="alert"
          aria-live="polite"
        >
          <div className="error-icon" aria-hidden="true">⚠️</div>
          <h2 className="error-title">Error Loading Medications</h2>
          <p className="error-message">{error || t.errorMessage}</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
            aria-label="Retry loading medications"
          >
            🔄 Try Again
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!patientData || !patientData.medications || patientData.medications.length === 0) {
    return (
      <div
        className={`prescription-dashboard no-data ${className}`}
        role="main"
        aria-label={t.title}
      >
        <header className="dashboard-header">
          <h1 className="dashboard-title">💊 {t.title}</h1>
        </header>
        <div 
          className="no-data-content"
          role="region"
          aria-label="No medication data"
        >
          <div className="no-data-icon" aria-hidden="true">📋</div>
          <h2 className="no-data-title">No Medications Found</h2>
          <p className="no-data-message">{t.noDataMessage}</p>
          <div className="no-data-actions">
            <button 
              className="contact-provider-button"
              aria-label="Contact healthcare provider"
            >
              👩‍⚕️ Contact Provider
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main
      className={`prescription-dashboard ${className}`}
      role="main"
      aria-label={t.title}
    >
      {/* Dashboard Header */}
      <header className="dashboard-header" role="banner">
        <h1 className="dashboard-title">💊 {t.title}</h1>
        
        {/* Patient Info */}
        <div 
          className="patient-info"
          role="region"
          aria-labelledby="patient-info-heading"
        >
          <h2 id="patient-info-heading" className="sr-only">Patient Information</h2>
          <div className="patient-name">
            <strong>{patientData.name}</strong>
          </div>
          
          {/* Preferred Pharmacy */}
          {patientData.preferredPharmacy && (
            <div 
              className="preferred-pharmacy"
              aria-labelledby="pharmacy-info"
            >
              <span id="pharmacy-info" className="pharmacy-label">
                {t.pharmacyLabel}:
              </span>
              <span className="pharmacy-name">
                ⭐ {patientData.preferredPharmacy.name}
              </span>
            </div>
          )}
        </div>

        {/* Medication Summary */}
        <div 
          className="medication-summary"
          role="region"
          aria-labelledby="summary-heading"
        >
          <h2 id="summary-heading" className="sr-only">Medication Summary</h2>
          <div className="summary-stats">
            <div className="stat-item" role="group" aria-label="Active medications count">
              <span className="stat-number">{medicationCounts.active}</span>
              <span className="stat-label">Active</span>
            </div>
            <div className="stat-item" role="group" aria-label="Total medications count">
              <span className="stat-number">{medicationCounts.total}</span>
              <span className="stat-label">Total</span>
            </div>
            {medicationCounts.needingRefill > 0 && (
              <div 
                className="stat-item alert" 
                role="group" 
                aria-label="Medications needing refill"
              >
                <span className="stat-number">{medicationCounts.needingRefill}</span>
                <span className="stat-label">Need Refill ⚠️</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Search and Filter Controls */}
      <section 
        className="dashboard-controls"
        role="region"
        aria-labelledby="controls-heading"
      >
        <h2 id="controls-heading" className="sr-only">Search and Filter Controls</h2>
        
        <div className="search-container">
          <label htmlFor="medication-search" className="sr-only">
            {t.searchPlaceholder}
          </label>
          <input
            id="medication-search"
            type="search"
            className="search-input"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyPress}
            aria-describedby="search-help"
          />
          <div id="search-help" className="sr-only">
            Search by medication name, prescriber, or instructions. Press Escape to clear.
          </div>
          {searchTerm && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="filter-controls" role="group" aria-label="Medication filters">
          <button
            className={`filter-btn ${!showInactiveMeds ? 'active' : ''}`}
            onClick={handleFilterToggle}
            aria-pressed={!showInactiveMeds}
            aria-describedby="filter-help"
          >
            {showInactiveMeds ? t.allMedications : t.activeMedications}
          </button>
          <div id="filter-help" className="sr-only">
            Toggle between showing only active medications or all medications including inactive ones
          </div>
        </div>
      </section>

      {/* Medications List */}
      <section
        className="medications-section"
        role="region"
        aria-labelledby="medications-heading"
      >
        <h2 id="medications-heading" className="sr-only">
          {t.medicationListLabel}
        </h2>
        
        {filteredMedications.length === 0 ? (
          <div 
            className="no-results"
            role="status"
            aria-live="polite"
          >
            <div className="no-results-icon" aria-hidden="true">🔍</div>
            <p className="no-results-text">{t.noMedicationsFound}</p>
            {searchTerm && (
              <button
                className="clear-filters-btn"
                onClick={() => {
                  setSearchTerm('');
                  setShowInactiveMeds(false);
                }}
                aria-label="Clear all filters"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div 
            className="medications-grid"
            role="list"
            aria-label={`${filteredMedications.length} medications found`}
          >
            {filteredMedications.map((medication, index) => (
              <MedCard
                key={medication.id}
                medication={medication}
                translations={translations}
                onRefillRequest={onRefillRequest}
                onViewDetails={onViewDetails}
                className={`medication-card-${index}`}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default PrescriptionDashboard;