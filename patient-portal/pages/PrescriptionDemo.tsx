/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React, { useState } from 'react';
import PrescriptionDashboard from '../components/PrescriptionDashboard';
import { PatientData, PrescriptionTranslations } from '../types/prescription';

/**
 * Demo page showcasing the PrescriptionDashboard component
 * Demonstrates all features including loading, error, and various data states
 */
const PrescriptionDemo: React.FC = () => {
  const [currentDemo, setCurrentDemo] = useState<'normal' | 'loading' | 'error' | 'empty'>('normal');

  // Sample patient data for demonstration
  const samplePatientData: PatientData = {
    id: 'patient-demo-123',
    name: 'Jane Doe',
    medications: [
      {
        id: 'med-aspirin',
        name: 'Aspirin',
        dosage: '81mg',
        frequency: 'Once daily',
        instructions: 'Take with food in the morning',
        prescriber: 'Dr. Sarah Smith',
        dateIssued: '2024-01-15',
        refillsRemaining: 3,
        isActive: true,
        pharmacy: {
          id: 'pharm-main',
          name: 'Main Street Pharmacy',
          address: '123 Main St, Anytown, ST 12345',
          phone: '(555) 123-4567',
          isPreferred: true
        }
      },
      {
        id: 'med-lisinopril',
        name: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        instructions: 'Take at the same time each day',
        prescriber: 'Dr. Michael Johnson',
        dateIssued: '2024-01-10',
        refillsRemaining: 0,
        isActive: true,
        pharmacy: {
          id: 'pharm-main',
          name: 'Main Street Pharmacy',
          address: '123 Main St, Anytown, ST 12345',
          phone: '(555) 123-4567',
          isPreferred: true
        }
      },
      {
        id: 'med-metformin',
        name: 'Metformin',
        dosage: '500mg',
        frequency: 'Twice daily',
        instructions: 'Take with meals',
        prescriber: 'Dr. Emily Brown',
        dateIssued: '2024-01-05',
        refillsRemaining: 2,
        isActive: true
      },
      {
        id: 'med-old-antibiotic',
        name: 'Amoxicillin',
        dosage: '250mg',
        frequency: 'Three times daily',
        instructions: 'Completed course - 10 days',
        prescriber: 'Dr. Sarah Smith',
        dateIssued: '2023-12-15',
        refillsRemaining: 0,
        isActive: false
      }
    ],
    preferredPharmacy: {
      id: 'pharm-main',
      name: 'Main Street Pharmacy',
      address: '123 Main St, Anytown, ST 12345',
      phone: '(555) 123-4567',
      isPreferred: true
    },
    dateOfBirth: '1985-06-15',
    insurance: {
      provider: 'Blue Cross Blue Shield',
      memberId: 'BC123456789'
    }
  };

  const translations: PrescriptionTranslations = {
    title: 'My Prescription Dashboard',
    loadingMessage: 'Loading your medications...',
    noDataMessage: 'No prescription data is currently available. Please contact your healthcare provider to review your medications.',
    searchPlaceholder: 'Search by medication name, doctor, or instructions...',
    activeMedications: 'Active Medications',
    allMedications: 'All Medications',
    errorMessage: 'We encountered an error loading your prescription information. Please try again or contact support.',
    medicationListLabel: 'Your current medications',
    pharmacyLabel: 'Preferred Pharmacy'
  };

  const handleRefillRequest = (medicationId: string) => {
    alert(`Refill requested for medication ID: ${medicationId}`);
  };

  const handleViewDetails = (medicationId: string) => {
    alert(`Viewing details for medication ID: ${medicationId}`);
  };

  const handlePharmacySelect = (pharmacyId: string) => {
    alert(`Pharmacy selected: ${pharmacyId}`);
  };

  const renderDemo = () => {
    switch (currentDemo) {
      case 'loading':
        return (
          <PrescriptionDashboard
            isLoading={true}
            translations={translations}
            onRefillRequest={handleRefillRequest}
            onViewDetails={handleViewDetails}
            onPharmacySelect={handlePharmacySelect}
          />
        );
      
      case 'error':
        return (
          <PrescriptionDashboard
            error="Network connection failed. Please check your internet connection and try again."
            translations={translations}
            onRefillRequest={handleRefillRequest}
            onViewDetails={handleViewDetails}
            onPharmacySelect={handlePharmacySelect}
          />
        );
      
      case 'empty':
        return (
          <PrescriptionDashboard
            patientData={{
              id: 'patient-empty',
              name: 'John Empty',
              medications: []
            }}
            translations={translations}
            onRefillRequest={handleRefillRequest}
            onViewDetails={handleViewDetails}
            onPharmacySelect={handlePharmacySelect}
          />
        );
      
      default:
        return (
          <PrescriptionDashboard
            patientData={samplePatientData}
            translations={translations}
            onRefillRequest={handleRefillRequest}
            onViewDetails={handleViewDetails}
            onPharmacySelect={handlePharmacySelect}
            showInactive={false}
          />
        );
    }
  };

  return (
    <div className="prescription-demo" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ marginBottom: '30px', textAlign: 'center' }}>
        <h1>🏥 PrescriptionDashboard Component Demo</h1>
        <p>Showcase of all features including accessibility, error handling, and performance optimizations</p>
        
        <nav style={{ marginTop: '20px' }}>
          <button
            onClick={() => setCurrentDemo('normal')}
            style={{
              margin: '0 10px',
              padding: '10px 20px',
              backgroundColor: currentDemo === 'normal' ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
            aria-pressed={currentDemo === 'normal'}
          >
            Normal State
          </button>
          
          <button
            onClick={() => setCurrentDemo('loading')}
            style={{
              margin: '0 10px',
              padding: '10px 20px',
              backgroundColor: currentDemo === 'loading' ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
            aria-pressed={currentDemo === 'loading'}
          >
            Loading State
          </button>
          
          <button
            onClick={() => setCurrentDemo('error')}
            style={{
              margin: '0 10px',
              padding: '10px 20px',
              backgroundColor: currentDemo === 'error' ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
            aria-pressed={currentDemo === 'error'}
          >
            Error State
          </button>
          
          <button
            onClick={() => setCurrentDemo('empty')}
            style={{
              margin: '0 10px',
              padding: '10px 20px',
              backgroundColor: currentDemo === 'empty' ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
            aria-pressed={currentDemo === 'empty'}
          >
            No Data State
          </button>
        </nav>
      </header>

      <main>
        {renderDemo()}
      </main>

      <footer style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
        <h2>🎯 Features Demonstrated</h2>
        <ul style={{ textAlign: 'left', maxWidth: '800px', margin: '0 auto' }}>
          <li><strong>Accessibility:</strong> Full ARIA support, keyboard navigation, screen reader compatibility</li>
          <li><strong>Error Handling:</strong> Graceful error states with user-friendly messages</li>
          <li><strong>Loading States:</strong> Skeleton loading with proper accessibility</li>
          <li><strong>Performance:</strong> Memoized computations for large datasets</li>
          <li><strong>Localization:</strong> Fallback translations for missing keys</li>
          <li><strong>Responsive Design:</strong> Hover effects and smooth transitions</li>
          <li><strong>Search & Filter:</strong> Real-time medication search and active/inactive filtering</li>
          <li><strong>Interactive Elements:</strong> Refill requests, detail views, pharmacy selection</li>
        </ul>
      </footer>
    </div>
  );
};

export default PrescriptionDemo;