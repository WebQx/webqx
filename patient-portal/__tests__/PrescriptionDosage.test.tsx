/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrescriptionDosage from '../components/PrescriptionDosage';

describe('PrescriptionDosage Component', () => {
  const mockOnChoose = jest.fn();
  
  const sampleDosages = [
    {
      id: '1',
      amount: '250mg',
      frequency: 'twice daily',
      instructions: 'Take with food',
      recommended: true
    },
    {
      id: '2',
      amount: '500mg',
      frequency: 'once daily',
      instructions: 'Take on empty stomach'
    },
    {
      id: '3',
      amount: '125mg',
      frequency: 'three times daily'
    }
  ];

  beforeEach(() => {
    mockOnChoose.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders correctly with provided dosages', () => {
      render(
        <PrescriptionDosage 
          dosages={sampleDosages} 
          onChoose={mockOnChoose}
        />
      );
      
      expect(screen.getByText('Select Dosage')).toBeInTheDocument();
      expect(screen.getByText('250mg')).toBeInTheDocument();
      expect(screen.getByText('500mg')).toBeInTheDocument();
      expect(screen.getByText('125mg')).toBeInTheDocument();
      expect(screen.getByText('twice daily')).toBeInTheDocument();
      expect(screen.getByText('Take with food')).toBeInTheDocument();
    });

    it('renders with custom title', () => {
      render(
        <PrescriptionDosage 
          dosages={sampleDosages} 
          onChoose={mockOnChoose}
          title="Choose Your Prescription"
        />
      );
      
      expect(screen.getByText('Choose Your Prescription')).toBeInTheDocument();
    });

    it('applies custom className correctly', () => {
      const { container } = render(
        <PrescriptionDosage 
          dosages={sampleDosages} 
          onChoose={mockOnChoose}
          className="custom-class"
        />
      );
      
      const dosageContainer = container.querySelector('.prescription-dosage');
      expect(dosageContainer).toHaveClass('custom-class');
    });
  });

  describe('Empty Dosages Handling', () => {
    it('displays fallback message when dosages array is empty', () => {
      render(
        <PrescriptionDosage 
          dosages={[]} 
          onChoose={mockOnChoose}
        />
      );
      
      expect(screen.getByText('No dosage options available at this time.')).toBeInTheDocument();
      expect(screen.getByText('Please contact your healthcare provider for assistance.')).toBeInTheDocument();
    });

    it('has proper accessibility attributes for empty state', () => {
      render(
        <PrescriptionDosage 
          dosages={[]} 
          onChoose={mockOnChoose}
        />
      );
      
      const emptyState = screen.getByRole('status');
      expect(emptyState).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Accessibility Features', () => {
    it('has proper ARIA labels and roles', () => {
      render(
        <PrescriptionDosage 
          dosages={sampleDosages} 
          onChoose={mockOnChoose}
        />
      );
      
      const region = screen.getByRole('region', { name: 'Prescription dosage selection' });
      expect(region).toBeInTheDocument();
      
      const list = screen.getByRole('list', { name: '3 dosage options available' });
      expect(list).toBeInTheDocument();
      
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });

    it('has accessible choose buttons with proper labels', () => {
      render(
        <PrescriptionDosage 
          dosages={sampleDosages} 
          onChoose={mockOnChoose}
        />
      );
      
      const recommendedButton = screen.getByLabelText('Choose 250mg twice daily dosage (recommended)');
      expect(recommendedButton).toBeInTheDocument();
      
      const regularButton = screen.getByLabelText('Choose 500mg once daily dosage');
      expect(regularButton).toBeInTheDocument();
      
      const simpleButton = screen.getByLabelText('Choose 125mg three times daily dosage');
      expect(simpleButton).toBeInTheDocument();
    });

    it('shows recommended badge with accessibility label', () => {
      render(
        <PrescriptionDosage 
          dosages={sampleDosages} 
          onChoose={mockOnChoose}
        />
      );
      
      const recommendedBadge = screen.getByLabelText('Recommended dosage');
      expect(recommendedBadge).toBeInTheDocument();
      expect(recommendedBadge).toHaveTextContent('⭐ Recommended');
    });
  });

  describe('Event Handling', () => {
    it('calls onChoose callback when Choose button is clicked', () => {
      render(
        <PrescriptionDosage 
          dosages={sampleDosages} 
          onChoose={mockOnChoose}
        />
      );
      
      const chooseButton = screen.getByLabelText('Choose 250mg twice daily dosage (recommended)');
      fireEvent.click(chooseButton);
      
      expect(mockOnChoose).toHaveBeenCalledTimes(1);
      expect(mockOnChoose).toHaveBeenCalledWith(sampleDosages[0]);
    });

    it('calls onChoose with correct dosage data for different buttons', () => {
      render(
        <PrescriptionDosage 
          dosages={sampleDosages} 
          onChoose={mockOnChoose}
        />
      );
      
      // Click second dosage
      const secondButton = screen.getByLabelText('Choose 500mg once daily dosage');
      fireEvent.click(secondButton);
      
      expect(mockOnChoose).toHaveBeenCalledWith(sampleDosages[1]);
      
      // Click third dosage
      const thirdButton = screen.getByLabelText('Choose 125mg three times daily dosage');
      fireEvent.click(thirdButton);
      
      expect(mockOnChoose).toHaveBeenCalledWith(sampleDosages[2]);
    });

    it('handles keyboard interaction correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <PrescriptionDosage 
          dosages={sampleDosages} 
          onChoose={mockOnChoose}
        />
      );
      
      const chooseButton = screen.getByLabelText('Choose 250mg twice daily dosage (recommended)');
      
      // Focus and press Enter
      chooseButton.focus();
      await user.keyboard('{Enter}');
      
      expect(mockOnChoose).toHaveBeenCalledWith(sampleDosages[0]);
    });
  });

  describe('Content Display', () => {
    it('displays all dosage information correctly', () => {
      render(
        <PrescriptionDosage 
          dosages={sampleDosages} 
          onChoose={mockOnChoose}
        />
      );
      
      // Check amount and frequency for each dosage
      expect(screen.getByText('250mg')).toBeInTheDocument();
      expect(screen.getByText('twice daily')).toBeInTheDocument();
      expect(screen.getByText('Take with food')).toBeInTheDocument();
      
      expect(screen.getByText('500mg')).toBeInTheDocument();
      expect(screen.getByText('once daily')).toBeInTheDocument();
      expect(screen.getByText('Take on empty stomach')).toBeInTheDocument();
      
      expect(screen.getByText('125mg')).toBeInTheDocument();
      expect(screen.getByText('three times daily')).toBeInTheDocument();
    });

    it('handles dosages without instructions correctly', () => {
      const dosagesWithoutInstructions = [
        {
          id: '1',
          amount: '100mg',
          frequency: 'once daily'
        }
      ];
      
      render(
        <PrescriptionDosage 
          dosages={dosagesWithoutInstructions} 
          onChoose={mockOnChoose}
        />
      );
      
      expect(screen.getByText('100mg')).toBeInTheDocument();
      expect(screen.getByText('once daily')).toBeInTheDocument();
      // Instructions should not be present
      expect(screen.queryByText('instructions')).not.toBeInTheDocument();
    });

    it('displays Choose buttons for all dosages', () => {
      render(
        <PrescriptionDosage 
          dosages={sampleDosages} 
          onChoose={mockOnChoose}
        />
      );
      
      const chooseButtons = screen.getAllByText('Choose');
      expect(chooseButtons).toHaveLength(3);
    });
  });

  describe('Type Safety', () => {
    it('accepts properly typed dosage objects', () => {
      const typedDosage = {
        id: 'test-id',
        amount: '300mg',
        frequency: 'twice daily',
        instructions: 'Test instructions',
        recommended: false
      };
      
      render(
        <PrescriptionDosage 
          dosages={[typedDosage]} 
          onChoose={mockOnChoose}
        />
      );
      
      expect(screen.getByText('300mg')).toBeInTheDocument();
      expect(screen.getByText('twice daily')).toBeInTheDocument();
      expect(screen.getByText('Test instructions')).toBeInTheDocument();
    });
  });
});