/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

/**
 * Example usage of PrescriptionDashboard component
 * This file shows how to integrate the component into a React application
 */

import React, { useState, useEffect } from 'react';
import PrescriptionDashboard from '../components/PrescriptionDashboard';
import { PatientData, PrescriptionTranslations } from '../types/prescription';

const PrescriptionExample: React.FC = () => {
  const [patientData, setPatientData] = useState<PatientData | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  // Example translations
  const translations: PrescriptionTranslations = {
    title: 'My Medications',
    loadingMessage: 'Loading your prescription information...',
    noDataMessage: 'No medications found. Please contact your healthcare provider.',
    searchPlaceholder: 'Search medications, doctors, or instructions...',
    activeMedications: 'Active Only',
    allMedications: 'Show All',
    refillButton: 'Request Refill',
    viewDetailsButton: 'View Details',
    pharmacyLabel: 'Preferred Pharmacy'
  };

  // Simulate data loading
  useEffect(() => {
    const loadPatientData = async () => {
      try {
        setIsLoading(true);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Example patient data
        const mockData: PatientData = {
          id: 'patient-example',
          name: 'Alex Johnson',
          medications: [
            {
              id: 'med-aspirin-daily',
              name: 'Aspirin',
              dosage: '81mg',
              frequency: 'Once daily',
              instructions: 'Take with food in the morning',
              prescriber: 'Dr. Sarah Williams',
              dateIssued: '2024-02-01',
              refillsRemaining: 5,
              isActive: true,
              pharmacy: {
                id: 'pharm-central',
                name: 'Central Pharmacy',
                address: '456 Health Ave',
                phone: '(555) 987-6543',
                isPreferred: true
              }
            },
            {
              id: 'med-metformin',
              name: 'Metformin HCl',
              dosage: '500mg',
              frequency: 'Twice daily',
              instructions: 'Take with meals to reduce stomach upset',
              prescriber: 'Dr. Michael Chen',
              dateIssued: '2024-01-15',
              refillsRemaining: 2,
              isActive: true
            },
            {
              id: 'med-lisinopril',
              name: 'Lisinopril',
              dosage: '10mg',
              frequency: 'Once daily',
              instructions: 'Take at the same time each day',
              prescriber: 'Dr. Emily Rodriguez',
              dateIssued: '2024-01-20',
              refillsRemaining: 0,
              isActive: true
            }
          ],
          preferredPharmacy: {
            id: 'pharm-central',
            name: 'Central Pharmacy',
            address: '456 Health Ave',
            phone: '(555) 987-6543',
            isPreferred: true
          }
        };

        setPatientData(mockData);
        setError(undefined);
      } catch (err) {
        setError('Failed to load prescription data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPatientData();
  }, []);

  // Handle refill request
  const handleRefillRequest = async (medicationId: string) => {
    try {
      console.log('Requesting refill for medication:', medicationId);
      
      // Simulate API call
      alert(`Refill request submitted for medication ${medicationId}. You will receive a confirmation email shortly.`);
      
      // In a real app, you would make an API call here
      // await refillMedicationAPI(medicationId);
      
    } catch (error) {
      alert('Failed to submit refill request. Please try again or contact your pharmacy.');
    }
  };

  // Handle view details
  const handleViewDetails = (medicationId: string) => {
    console.log('Viewing details for medication:', medicationId);
    
    // In a real app, you might navigate to a details page
    // or open a modal with detailed medication information
    alert(`Opening detailed view for medication ${medicationId}`);
  };

  // Handle pharmacy selection
  const handlePharmacySelect = (pharmacyId: string) => {
    console.log('Selecting pharmacy:', pharmacyId);
    
    // In a real app, you would update the patient's preferred pharmacy
    alert(`Pharmacy preference updated to ${pharmacyId}`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🏥 Healthcare Portal - Prescription Management</h1>
      
      <PrescriptionDashboard
        patientData={patientData}
        translations={translations}
        isLoading={isLoading}
        error={error}
        onRefillRequest={handleRefillRequest}
        onViewDetails={handleViewDetails}
        onPharmacySelect={handlePharmacySelect}
        showInactive={false}
        className="main-prescription-dashboard"
      />
    </div>
  );
};

export default PrescriptionExample;