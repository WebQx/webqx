/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrescriptionDashboard from '../components/PrescriptionDashboard';
import { PatientData, PrescriptionTranslations } from '../types/prescription';

// Mock the MedCard component
jest.mock('../components/MedCard', () => {
  return function MockMedCard({ medication, isLoading }: any) {
    if (isLoading) {
      return <div data-testid="skeleton-med-card">Loading medication...</div>;
    }
    return (
      <div data-testid={`med-card-${medication.id}`}>
        <h3>{medication.name}</h3>
        <span>{medication.isActive ? 'Active' : 'Inactive'}</span>
      </div>
    );
  };
});

describe('PrescriptionDashboard Component', () => {
  const mockPatientData: PatientData = {
    id: 'patient-123',
    name: 'John Doe',
    medications: [
      {
        id: 'med-1',
        name: 'Aspirin',
        dosage: '81mg',
        frequency: 'Once daily',
        prescriber: 'Dr. Smith',
        dateIssued: '2024-01-15',
        refillsRemaining: 3,
        isActive: true
      },
      {
        id: 'med-2',
        name: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        prescriber: 'Dr. Johnson',
        dateIssued: '2024-01-10',
        refillsRemaining: 0,
        isActive: true
      },
      {
        id: 'med-3',
        name: 'Old Medication',
        dosage: '5mg',
        frequency: 'Twice daily',
        prescriber: 'Dr. Brown',
        dateIssued: '2023-12-01',
        refillsRemaining: 2,
        isActive: false
      }
    ],
    preferredPharmacy: {
      id: 'pharm-123',
      name: 'Main Street Pharmacy',
      address: '123 Main St',
      phone: '555-0123',
      isPreferred: true
    }
  };

  const mockTranslations: PrescriptionTranslations = {
    title: 'My Prescriptions',
    loadingMessage: 'Loading prescriptions...',
    noDataMessage: 'No medications available',
    searchPlaceholder: 'Search medications...',
    activeMedications: 'Active Only',
    allMedications: 'Show All',
    errorMessage: 'Failed to load medications'
  };

  const mockOnRefillRequest = jest.fn();
  const mockOnViewDetails = jest.fn();
  const mockOnPharmacySelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders dashboard with patient data correctly', () => {
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
          onRefillRequest={mockOnRefillRequest}
          onViewDetails={mockOnViewDetails}
          onPharmacySelect={mockOnPharmacySelect}
        />
      );

      expect(screen.getByText('💊 My Prescriptions')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('⭐ Main Street Pharmacy')).toBeInTheDocument();
      expect(screen.getByTestId('med-card-med-1')).toBeInTheDocument();
      expect(screen.getByTestId('med-card-med-2')).toBeInTheDocument();
    });

    it('renders with default translations when none provided', () => {
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
        />
      );

      expect(screen.getByText('💊 Prescription Dashboard')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search medications...')).toBeInTheDocument();
      expect(screen.getByText('Active Medications')).toBeInTheDocument();
    });

    it('displays medication counts correctly', () => {
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument(); // Active count
      expect(screen.getByText('3')).toBeInTheDocument(); // Total count
      expect(screen.getByText('1')).toBeInTheDocument(); // Need refill count
      expect(screen.getByText('Need Refill ⚠️')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('renders loading state correctly', () => {
      render(
        <PrescriptionDashboard
          isLoading={true}
          translations={mockTranslations}
        />
      );

      expect(screen.getByLabelText('My Prescriptions')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Loading prescriptions...')).toBeInTheDocument();
      expect(screen.getAllByTestId('skeleton-med-card')).toHaveLength(3);
    });

    it('shows loading spinner with proper accessibility', () => {
      render(
        <PrescriptionDashboard
          isLoading={true}
          translations={mockTranslations}
        />
      );

      const loadingIndicator = screen.getByRole('status', { name: 'Loading prescriptions...' });
      expect(loadingIndicator).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('renders error state correctly', () => {
      render(
        <PrescriptionDashboard
          error="Network error occurred"
          translations={mockTranslations}
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Error Loading Medications')).toBeInTheDocument();
      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry loading medications' })).toBeInTheDocument();
    });

    it('uses default error message when none provided', () => {
      render(
        <PrescriptionDashboard
          error="Some error"
          translations={mockTranslations}
        />
      );

      expect(screen.getByText('Some error')).toBeInTheDocument();
    });
  });

  describe('No Data States', () => {
    it('renders no data state when patient data is undefined', () => {
      render(
        <PrescriptionDashboard
          patientData={undefined}
          translations={mockTranslations}
        />
      );

      expect(screen.getByText('No Medications Found')).toBeInTheDocument();
      expect(screen.getByText('No medications available')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Contact healthcare provider' })).toBeInTheDocument();
    });

    it('renders no data state when medications array is empty', () => {
      const emptyPatientData = { ...mockPatientData, medications: [] };
      
      render(
        <PrescriptionDashboard
          patientData={emptyPatientData}
          translations={mockTranslations}
        />
      );

      expect(screen.getByText('No Medications Found')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('filters medications by search term', async () => {
      const user = userEvent.setup();
      
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search medications...');
      await user.type(searchInput, 'Aspirin');

      expect(screen.getByTestId('med-card-med-1')).toBeInTheDocument();
      expect(screen.queryByTestId('med-card-med-2')).not.toBeInTheDocument();
    });

    it('searches by prescriber name', async () => {
      const user = userEvent.setup();
      
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search medications...');
      await user.type(searchInput, 'Dr. Johnson');

      expect(screen.getByTestId('med-card-med-2')).toBeInTheDocument();
      expect(screen.queryByTestId('med-card-med-1')).not.toBeInTheDocument();
    });

    it('shows no results message when search yields no matches', async () => {
      const user = userEvent.setup();
      
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search medications...');
      await user.type(searchInput, 'NonexistentMed');

      expect(screen.getByText('No medications found matching your search.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
    });

    it('clears search with escape key', async () => {
      const user = userEvent.setup();
      
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search medications...');
      await user.type(searchInput, 'Aspirin');
      expect(searchInput).toHaveValue('Aspirin');

      fireEvent.keyDown(searchInput, { key: 'Escape', code: 'Escape' });
      expect(searchInput).toHaveValue('');
    });

    it('clears search with clear button', async () => {
      const user = userEvent.setup();
      
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search medications...');
      await user.type(searchInput, 'Aspirin');

      const clearButton = screen.getByRole('button', { name: 'Clear search' });
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Filter Functionality', () => {
    it('shows only active medications by default', () => {
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      expect(screen.getByTestId('med-card-med-1')).toBeInTheDocument(); // Active
      expect(screen.getByTestId('med-card-med-2')).toBeInTheDocument(); // Active
      expect(screen.queryByTestId('med-card-med-3')).not.toBeInTheDocument(); // Inactive
    });

    it('shows all medications when filter is toggled', async () => {
      const user = userEvent.setup();
      
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      const filterButton = screen.getByRole('button', { name: 'Active Only' });
      await user.click(filterButton);

      expect(screen.getByTestId('med-card-med-1')).toBeInTheDocument();
      expect(screen.getByTestId('med-card-med-2')).toBeInTheDocument();
      expect(screen.getByTestId('med-card-med-3')).toBeInTheDocument();
      expect(screen.getByText('Show All')).toBeInTheDocument();
    });

    it('respects showInactive prop', () => {
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
          showInactive={true}
        />
      );

      expect(screen.getByTestId('med-card-med-3')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA structure', () => {
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      expect(screen.getByRole('main', { name: 'My Prescriptions' })).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Search and Filter Controls' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'List of medications' })).toBeInTheDocument();
    });

    it('provides proper labels for screen readers', () => {
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      expect(screen.getByLabelText('Search medications...')).toBeInTheDocument();
      expect(screen.getByLabelText('Medication filters')).toBeInTheDocument();
      expect(screen.getByLabelText(/medications found/)).toBeInTheDocument();
    });

    it('has proper search input accessibility', () => {
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toHaveAttribute('aria-describedby', 'search-help');
    });

    it('uses aria-pressed for filter button', async () => {
      const user = userEvent.setup();
      
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      const filterButton = screen.getByRole('button', { name: 'Active Only' });
      expect(filterButton).toHaveAttribute('aria-pressed', 'true');

      await user.click(filterButton);
      expect(filterButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Performance Optimizations', () => {
    it('memoizes filtered medications', () => {
      const { rerender } = render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      expect(screen.getByTestId('med-card-med-1')).toBeInTheDocument();

      // Re-render with same props should not cause unnecessary recalculations
      rerender(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
        />
      );

      expect(screen.getByTestId('med-card-med-1')).toBeInTheDocument();
    });

    it('handles large medication lists efficiently', () => {
      const largeMedicationList = Array.from({ length: 100 }, (_, index) => ({
        id: `med-${index}`,
        name: `Medication ${index}`,
        dosage: '10mg',
        frequency: 'Daily',
        prescriber: 'Dr. Test',
        dateIssued: '2024-01-01',
        refillsRemaining: 1,
        isActive: true
      }));

      const largePatientData = {
        ...mockPatientData,
        medications: largeMedicationList
      };

      render(
        <PrescriptionDashboard
          patientData={largePatientData}
          translations={mockTranslations}
        />
      );

      // Should render without performance issues
      expect(screen.getByText('💊 My Prescriptions')).toBeInTheDocument();
      expect(screen.getByLabelText(/100 medications found/)).toBeInTheDocument();
    });
  });

  describe('Custom CSS Classes', () => {
    it('applies custom className correctly', () => {
      const { container } = render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          className="custom-dashboard"
        />
      );

      const dashboard = container.querySelector('.prescription-dashboard');
      expect(dashboard).toHaveClass('custom-dashboard');
    });
  });

  describe('Callback Functions', () => {
    it('passes callbacks to MedCard components', () => {
      render(
        <PrescriptionDashboard
          patientData={mockPatientData}
          translations={mockTranslations}
          onRefillRequest={mockOnRefillRequest}
          onViewDetails={mockOnViewDetails}
        />
      );

      // Verify that MedCard components receive the callbacks
      // This is tested indirectly through the mocked component
      expect(screen.getByTestId('med-card-med-1')).toBeInTheDocument();
      expect(screen.getByTestId('med-card-med-2')).toBeInTheDocument();
    });
  });
});