/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React from 'react';
import PrescriptionsModule from '../components/prescriptions/PrescriptionsModule';

/**
 * Demo page for testing the PrescriptionsModule component
 * This allows for manual verification of all features
 */
const PrescriptionsDemo: React.FC = () => {
  const handlePrescriptionSubmitted = (prescriptionId: string) => {
    console.log('Prescription submitted:', prescriptionId);
    alert(`Prescription ${prescriptionId} submitted successfully!`);
  };

  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Prescription module error:', error, errorInfo);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>WebQX Prescriptions Module Demo</h1>
      <p>This page demonstrates the PrescriptionsModule with all its features:</p>
      <ul>
        <li>Error Boundaries with graceful fallback UI</li>
        <li>Loading States during data operations</li>
        <li>React Context for shared state management</li>
        <li>Full accessibility with ARIA roles and keyboard navigation</li>
        <li>Smart template picker with search and filtering</li>
        <li>Comprehensive prescription form with validation</li>
      </ul>

      <hr style={{ margin: '20px 0' }} />

      <PrescriptionsModule
        onPrescriptionSubmitted={handlePrescriptionSubmitted}
        onError={handleError}
      />

      <hr style={{ margin: '20px 0' }} />

      <h2>Compact Mode</h2>
      <PrescriptionsModule
        compact={true}
        className="demo-compact"
        onPrescriptionSubmitted={handlePrescriptionSubmitted}
        onError={handleError}
      />
    </div>
  );
};

export default PrescriptionsDemo;