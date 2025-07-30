import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpecialtyPicker from '../components/SpecialtyPicker';
import { Specialty } from '../data/specialties';

// Mock specialties for testing
const mockSpecialties: Specialty[] = [
  {
    id: 'general',
    name: 'General Medicine',
    description: 'Primary care and general health services',
    available: true
  },
  {
    id: 'cardiology',
    name: 'Cardiology',
    description: 'Heart and cardiovascular system care',
    available: true
  },
  {
    id: 'dermatology',
    name: 'Dermatology',
    description: 'Skin, hair, and nail conditions',
    available: true
  }
];

describe('SpecialtyPicker Component', () => {
  const defaultProps = {
    specialtiesOverride: mockSpecialties,
    loadingOverride: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Accessibility', () => {
    it('has proper accessibility attributes', () => {
      render(<SpecialtyPicker {...defaultProps} />);
      
      // Check for label and select association
      const label = screen.getByText('Select Medical Specialty');
      const select = screen.getByRole('combobox');
      
      expect(label).toBeInTheDocument();
      expect(select).toBeInTheDocument();
      expect(select).toHaveAttribute('id', 'specialty-picker-select');
      expect(label).toHaveAttribute('for', 'specialty-picker-select');
      
      // Check aria attributes
      expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'specialty-picker-label');
      expect(select).toHaveAttribute('aria-label');
    });

    it('associates label with select using htmlFor and id', () => {
      render(<SpecialtyPicker {...defaultProps} />);
      
      const label = screen.getByText('Select Medical Specialty');
      const select = screen.getByRole('combobox');
      
      expect(label).toHaveAttribute('for', 'specialty-picker-select');
      expect(select).toHaveAttribute('id', 'specialty-picker-select');
    });

    it('uses aria-live regions for dynamic content', () => {
      render(<SpecialtyPicker {...defaultProps} showSelectedSpecialty={true} />);
      
      const selectedDisplay = screen.getByRole('status');
      expect(selectedDisplay).toHaveAttribute('aria-live', 'polite');
    });

    it('displays loading state with proper accessibility', () => {
      render(<SpecialtyPicker loadingOverride={true} />);
      
      const loadingStatus = screen.getByRole('status');
      expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
      expect(loadingStatus).toHaveAttribute('aria-label', 'Loading medical specialties');
      expect(screen.getByText('Loading medical specialties...')).toBeInTheDocument();
    });

    it('displays error state with proper accessibility', () => {
      const errorMessage = 'Failed to load specialties';
      render(<SpecialtyPicker errorOverride={errorMessage} loadingOverride={false} />);
      
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Dynamic Options', () => {
    it('renders dynamically fetched options', () => {
      render(<SpecialtyPicker {...defaultProps} />);
      
      // Check that all mock specialties are rendered as options
      expect(screen.getByRole('option', { name: 'General Medicine' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Cardiology' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Dermatology' })).toBeInTheDocument();
    });

    it('includes placeholder option', () => {
      render(<SpecialtyPicker {...defaultProps} />);
      
      const placeholderOption = screen.getByRole('option', { name: 'Choose a medical specialty...' });
      expect(placeholderOption).toBeInTheDocument();
      expect(placeholderOption).toHaveAttribute('disabled');
    });

    it('updates options when specialties prop changes', () => {
      const { rerender } = render(<SpecialtyPicker {...defaultProps} />);
      
      expect(screen.getByRole('option', { name: 'General Medicine' })).toBeInTheDocument();
      
      const newSpecialties = [
        { id: 'pediatrics', name: 'Pediatrics', description: 'Child healthcare', available: true }
      ];
      
      rerender(<SpecialtyPicker specialtiesOverride={newSpecialties} loadingOverride={false} />);
      
      expect(screen.queryByRole('option', { name: 'General Medicine' })).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Pediatrics' })).toBeInTheDocument();
    });

    it('handles empty specialties list', () => {
      render(<SpecialtyPicker specialtiesOverride={[]} loadingOverride={false} />);
      
      const select = screen.getByRole('combobox');
      expect(select.children).toHaveLength(1); // Only placeholder option
      expect(screen.getByRole('option', { name: 'Choose a medical specialty...' })).toBeInTheDocument();
    });
  });

  describe('Default Specialty Display', () => {
    it('displays default specialty correctly when provided', () => {
      render(
        <SpecialtyPicker 
          {...defaultProps} 
          selectedSpecialtyId="cardiology"
          showSelectedSpecialty={true}
        />
      );
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('cardiology');
      
      // Check in the selected specialty display area specifically
      const selectedDisplay = screen.getByRole('status');
      expect(selectedDisplay).toHaveTextContent('Cardiology');
      expect(selectedDisplay).toHaveTextContent('Heart and cardiovascular system care');
    });

    it('shows no specialty selected when none is provided', () => {
      render(<SpecialtyPicker {...defaultProps} showSelectedSpecialty={true} />);
      
      expect(screen.getByText('No specialty selected')).toBeInTheDocument();
    });

    it('hides selected specialty display when showSelectedSpecialty is false', () => {
      render(
        <SpecialtyPicker 
          {...defaultProps} 
          selectedSpecialtyId="cardiology"
          showSelectedSpecialty={false}
        />
      );
      
      expect(screen.queryByText('Selected Specialty:')).not.toBeInTheDocument();
      expect(screen.queryByText('No specialty selected')).not.toBeInTheDocument();
    });
  });

  describe('State Updates', () => {
    it('updates state correctly when a new specialty is selected', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(
        <SpecialtyPicker 
          {...defaultProps} 
          onSpecialtyChange={mockOnChange}
          showSelectedSpecialty={true}
        />
      );
      
      const select = screen.getByRole('combobox');
      
      await user.selectOptions(select, 'cardiology');
      
      expect(mockOnChange).toHaveBeenCalledWith('cardiology');
      
      // Check in the selected specialty display area specifically
      const selectedDisplay = screen.getByRole('status');
      expect(selectedDisplay).toHaveTextContent('Cardiology');
      expect(selectedDisplay).toHaveTextContent('Heart and cardiovascular system care');
    });

    it('updates display when selectedSpecialtyId prop changes', () => {
      const { rerender } = render(
        <SpecialtyPicker 
          {...defaultProps} 
          selectedSpecialtyId="general"
          showSelectedSpecialty={true}
        />
      );
      
      // Check initial state
      let selectedDisplay = screen.getByRole('status');
      expect(selectedDisplay).toHaveTextContent('General Medicine');
      
      rerender(
        <SpecialtyPicker 
          {...defaultProps} 
          selectedSpecialtyId="dermatology"
          showSelectedSpecialty={true}
        />
      );
      
      // Check updated state
      selectedDisplay = screen.getByRole('status');
      expect(selectedDisplay).toHaveTextContent('Dermatology');
      expect(selectedDisplay).not.toHaveTextContent('General Medicine');
    });

    it('handles invalid specialty ID gracefully', () => {
      render(
        <SpecialtyPicker 
          {...defaultProps} 
          selectedSpecialtyId="invalid-id"
          showSelectedSpecialty={true}
        />
      );
      
      expect(screen.getByText('No specialty selected')).toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    it('applies custom label', () => {
      const customLabel = 'Choose your medical specialty';
      render(<SpecialtyPicker {...defaultProps} label={customLabel} />);
      
      expect(screen.getByText(customLabel)).toBeInTheDocument();
      
      // Use a more specific query for the form control
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<SpecialtyPicker {...defaultProps} className="custom-class" />);
      
      const pickerDiv = container.querySelector('.specialty-picker');
      expect(pickerDiv).toHaveClass('custom-class');
    });

    it('calls onSpecialtyChange callback with correct parameters', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<SpecialtyPicker {...defaultProps} onSpecialtyChange={mockOnChange} />);
      
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'general');
      
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('general');
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading state correctly', () => {
      render(<SpecialtyPicker loadingOverride={true} />);
      
      expect(screen.getByText('Loading medical specialties...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('shows error state correctly', () => {
      const errorMessage = 'Network error occurred';
      render(<SpecialtyPicker errorOverride={errorMessage} loadingOverride={false} />);
      
      // Check that error text is displayed
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      
      // Check that select is not shown in error state
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('transitions from loading to success state', () => {
      const { rerender } = render(<SpecialtyPicker loadingOverride={true} />);
      
      expect(screen.getByText('Loading medical specialties...')).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      
      rerender(<SpecialtyPicker {...defaultProps} />);
      
      expect(screen.queryByText('Loading medical specialties...')).not.toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<SpecialtyPicker {...defaultProps} />);
      
      const select = screen.getByRole('combobox');
      
      // Focus the select
      await user.click(select);
      expect(select).toHaveFocus();
      
      // Use arrow keys to navigate (browser behavior)
      await user.keyboard('{ArrowDown}');
      
      // The select should still have focus
      expect(select).toHaveFocus();
    });

    it('supports tab navigation to and from the component', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <button>Before</button>
          <SpecialtyPicker {...defaultProps} />
          <button>After</button>
        </div>
      );
      
      const beforeBtn = screen.getByText('Before');
      const select = screen.getByRole('combobox');
      const afterBtn = screen.getByText('After');
      
      // Start at before button
      beforeBtn.focus();
      expect(beforeBtn).toHaveFocus();
      
      // Tab to select
      await user.tab();
      expect(select).toHaveFocus();
      
      // Tab to after button
      await user.tab();
      expect(afterBtn).toHaveFocus();
    });
  });
});