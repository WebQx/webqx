/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MedCard from '../components/MedCard';
import { Medication, PrescriptionTranslations } from '../types/prescription';

describe('MedCard Component', () => {
  const mockMedication: Medication = {
    id: 'med-123',
    name: 'Aspirin',
    dosage: '81mg',
    frequency: 'Once daily',
    instructions: 'Take with food',
    prescriber: 'Dr. Smith',
    dateIssued: '2024-01-15',
    refillsRemaining: 3,
    isActive: true,
    pharmacy: {
      id: 'pharm-456',
      name: 'Main Street Pharmacy',
      address: '123 Main St',
      phone: '555-0123',
      isPreferred: true
    }
  };

  const mockTranslations: PrescriptionTranslations = {
    dosageLabel: 'Dosage',
    frequencyLabel: 'Frequency',
    refillsLabel: 'Refills remaining',
    prescriberLabel: 'Prescribed by',
    refillButton: 'Request Refill',
    viewDetailsButton: 'View Details',
    pharmacyLabel: 'Pharmacy'
  };

  const mockOnRefillRequest = jest.fn();
  const mockOnViewDetails = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders medication information correctly', () => {
      render(
        <MedCard
          medication={mockMedication}
          translations={mockTranslations}
          onRefillRequest={mockOnRefillRequest}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(screen.getByText('💊 Aspirin')).toBeInTheDocument();
      expect(screen.getByText('81mg')).toBeInTheDocument();
      expect(screen.getByText('Once daily')).toBeInTheDocument();
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
      expect(screen.getByText('Take with food')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText(/Main Street Pharmacy/)).toBeInTheDocument();
    });

    it('renders with default translations when none provided', () => {
      render(
        <MedCard
          medication={mockMedication}
          onRefillRequest={mockOnRefillRequest}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(screen.getByText('Dosage:')).toBeInTheDocument();
      expect(screen.getByText('Frequency:')).toBeInTheDocument();
      expect(screen.getByText('Prescribed by:')).toBeInTheDocument();
      expect(screen.getByText(/Request Refill/)).toBeInTheDocument();
      expect(screen.getByText(/View Details/)).toBeInTheDocument();
    });

    it('displays active status correctly', () => {
      render(
        <MedCard
          medication={mockMedication}
          translations={mockTranslations}
        />
      );

      expect(screen.getByText('🟢 Active')).toBeInTheDocument();
      expect(screen.getByLabelText('Medication status: Active')).toBeInTheDocument();
    });

    it('displays inactive status correctly', () => {
      const inactiveMedication = { ...mockMedication, isActive: false };
      
      render(
        <MedCard
          medication={inactiveMedication}
          translations={mockTranslations}
        />
      );

      expect(screen.getByText('🔴 Inactive')).toBeInTheDocument();
      expect(screen.getByLabelText('Medication status: Inactive')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and structure', () => {
      render(
        <MedCard
          medication={mockMedication}
          translations={mockTranslations}
          onRefillRequest={mockOnRefillRequest}
          onViewDetails={mockOnViewDetails}
        />
      );

      // Check article structure
      const article = screen.getByRole('article');
      expect(article).toBeInTheDocument();
      expect(article).toHaveAttribute('aria-labelledby', 'med-med-123-name');
      expect(article).toHaveAttribute('aria-describedby', 'med-med-123-details');

      // Check medication details group
      const detailsGroup = screen.getByRole('group', { name: 'Medication details' });
      expect(detailsGroup).toBeInTheDocument();

      // Check action buttons
      const refillButton = screen.getByRole('button', { name: 'Request refill for Aspirin' });
      expect(refillButton).toBeInTheDocument();
      
      const detailsButton = screen.getByRole('button', { name: 'View detailed information for Aspirin' });
      expect(detailsButton).toBeInTheDocument();

      // Check actions group
      const actionsGroup = screen.getByRole('group', { name: 'Medication actions' });
      expect(actionsGroup).toBeInTheDocument();
    });

    it('provides proper screen reader information for refills', () => {
      render(
        <MedCard
          medication={mockMedication}
          translations={mockTranslations}
        />
      );

      const refillsElement = screen.getByLabelText('3 refills remaining');
      expect(refillsElement).toBeInTheDocument();
    });

    it('handles no refills scenario with proper accessibility', () => {
      const noRefillsMedication = { ...mockMedication, refillsRemaining: 0 };
      
      render(
        <MedCard
          medication={noRefillsMedication}
          translations={mockTranslations}
        />
      );

      const refillButton = screen.getByRole('button', { name: 'Request refill for Aspirin' });
      expect(refillButton).toBeDisabled();
      
      const warningElement = screen.getByLabelText('0 refills remaining');
      expect(warningElement.textContent).toContain('⚠️');
    });
  });

  describe('Interactions', () => {
    it('calls onRefillRequest when refill button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MedCard
          medication={mockMedication}
          translations={mockTranslations}
          onRefillRequest={mockOnRefillRequest}
          onViewDetails={mockOnViewDetails}
        />
      );

      const refillButton = screen.getByRole('button', { name: 'Request refill for Aspirin' });
      await user.click(refillButton);

      expect(mockOnRefillRequest).toHaveBeenCalledWith('med-123');
      expect(mockOnRefillRequest).toHaveBeenCalledTimes(1);
    });

    it('calls onViewDetails when details button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MedCard
          medication={mockMedication}
          translations={mockTranslations}
          onRefillRequest={mockOnRefillRequest}
          onViewDetails={mockOnViewDetails}
        />
      );

      const detailsButton = screen.getByRole('button', { name: 'View detailed information for Aspirin' });
      await user.click(detailsButton);

      expect(mockOnViewDetails).toHaveBeenCalledWith('med-123');
      expect(mockOnViewDetails).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard navigation correctly', () => {
      render(
        <MedCard
          medication={mockMedication}
          translations={mockTranslations}
          onRefillRequest={mockOnRefillRequest}
          onViewDetails={mockOnViewDetails}
        />
      );

      const refillButton = screen.getByRole('button', { name: 'Request refill for Aspirin' });
      
      // Test Enter key
      fireEvent.keyPress(refillButton, { key: 'Enter', code: 'Enter', charCode: 13 });
      expect(mockOnRefillRequest).toHaveBeenCalledWith('med-123');

      // Test Space key
      fireEvent.keyPress(refillButton, { key: ' ', code: 'Space', charCode: 32 });
      expect(mockOnRefillRequest).toHaveBeenCalledTimes(2);
    });

    it('does not call handlers when disabled', async () => {
      const user = userEvent.setup();
      const noRefillsMedication = { ...mockMedication, refillsRemaining: 0 };
      
      render(
        <MedCard
          medication={noRefillsMedication}
          translations={mockTranslations}
          onRefillRequest={mockOnRefillRequest}
          onViewDetails={mockOnViewDetails}
        />
      );

      const refillButton = screen.getByRole('button', { name: 'Request refill for Aspirin' });
      expect(refillButton).toBeDisabled();

      await user.click(refillButton);
      expect(mockOnRefillRequest).not.toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('renders loading skeleton when isLoading is true', () => {
      render(
        <MedCard
          medication={mockMedication}
          isLoading={true}
        />
      );

      expect(screen.getByLabelText('Loading medication information')).toBeInTheDocument();
      expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'true');
      
      // Check for skeleton elements
      const skeletonElements = document.querySelectorAll('.skeleton-line, .skeleton-button');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });

    it('does not render actual content when loading', () => {
      render(
        <MedCard
          medication={mockMedication}
          isLoading={true}
        />
      );

      expect(screen.queryByText('💊 Aspirin')).not.toBeInTheDocument();
      expect(screen.queryByText('Request Refill')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('renders without optional properties', () => {
      const minimalMedication: Medication = {
        id: 'med-minimal',
        name: 'Basic Med',
        dosage: '10mg',
        frequency: 'Daily',
        prescriber: 'Dr. Jones',
        dateIssued: '2024-01-01',
        refillsRemaining: 1,
        isActive: true
      };

      render(
        <MedCard
          medication={minimalMedication}
        />
      );

      expect(screen.getByText('💊 Basic Med')).toBeInTheDocument();
      expect(screen.queryByText('Instructions:')).not.toBeInTheDocument();
      expect(screen.queryByText('Pharmacy:')).not.toBeInTheDocument();
    });

    it('displays pharmacy with preferred indicator', () => {
      render(
        <MedCard
          medication={mockMedication}
          translations={mockTranslations}
        />
      );

      const pharmacyElement = screen.getByText(/Main Street Pharmacy/);
      expect(pharmacyElement.textContent).toContain('⭐');
    });

    it('applies custom className correctly', () => {
      const { container } = render(
        <MedCard
          medication={mockMedication}
          className="custom-med-card"
        />
      );

      const medCard = container.querySelector('.med-card');
      expect(medCard).toHaveClass('custom-med-card');
    });

    it('applies inactive class for inactive medications', () => {
      const inactiveMedication = { ...mockMedication, isActive: false };
      const { container } = render(
        <MedCard
          medication={inactiveMedication}
        />
      );

      const medCard = container.querySelector('.med-card');
      expect(medCard).toHaveClass('inactive');
    });
  });
});