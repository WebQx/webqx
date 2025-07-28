import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpecialtyFilter from '../components/SpecialtyFilter';

describe('SpecialtyFilter Component', () => {
  const mockSpecialties = [
    'Primary Care',
    'Cardiology',
    'Dermatology',
    'Orthopedics',
    'Neurology'
  ];

  const mockOnSelect = jest.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });
  
  afterEach(() => {
    // Clean up any DOM elements between tests
    document.body.innerHTML = '';
  });

  describe('Rendering', () => {
    it('renders correctly with provided specialties', () => {
      const { container } = render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
          onSelect={mockOnSelect}
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      expect(selectElement).toHaveValue(''); // Default empty value
      expect(screen.getByText('Select a specialty')).toBeInTheDocument();
      
      // Check that all specialty options are present
      mockSpecialties.forEach(specialty => {
        expect(screen.getByText(specialty)).toBeInTheDocument();
      });
    });

    it('renders with default props when no props are provided', () => {
      const { container } = render(<SpecialtyFilter />);
      
      const selectElement = screen.getByRole('combobox');
      expect(selectElement).toHaveValue(''); // Default empty value
      expect(screen.getByText('No specialties available')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('No specialties are currently available for selection.');
    });

    it('renders with custom label', () => {
      const { container } = render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
          label="Choose Medical Specialty"
        />
      );
      
      const label = container.querySelector('label[for="specialty-filter"]');
      expect(label).toHaveTextContent('Choose Medical Specialty');
    });

    it('applies custom className correctly', () => {
      const { container } = render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
          className="custom-class"
        />
      );
      
      const filterContainer = container.querySelector('.specialty-filter');
      expect(filterContainer).toHaveClass('custom-class');
    });

    it('renders with custom id', () => {
      render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
          id="custom-specialty-filter"
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      expect(selectElement).toHaveAttribute('id', 'custom-specialty-filter');
      
      const label = screen.getByText('Select Specialty');
      expect(label).toHaveAttribute('for', 'custom-specialty-filter');
    });
  });

  describe('Accessibility', () => {
    it('has proper accessibility attributes', () => {
      render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
          onSelect={mockOnSelect}
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      const label = screen.getByText('Select Specialty');
      const group = screen.getByRole('group');
      
      // Check label association
      expect(label).toHaveAttribute('for', 'specialty-filter');
      expect(selectElement).toHaveAttribute('id', 'specialty-filter');
      
      // Check group labelling
      expect(group).toHaveAttribute('aria-labelledby', 'specialty-filter-label');
      expect(label).toHaveAttribute('id', 'specialty-filter-label');
      
      // Check select attributes
      expect(selectElement).toHaveAttribute('aria-required', 'false');
    });

    it('has proper accessibility attributes when empty', () => {
      render(<SpecialtyFilter specialties={[]} />);
      
      const selectElement = screen.getByRole('combobox');
      const errorMessage = screen.getByRole('alert');
      
      expect(selectElement).toHaveAttribute('aria-describedby', 'specialty-filter-error');
      expect(errorMessage).toHaveAttribute('id', 'specialty-filter-error');
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });

    it('is keyboard accessible', async () => {
      const user = userEvent.setup();
      
      render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
          onSelect={mockOnSelect}
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      
      // Focus the select element
      await user.tab();
      expect(selectElement).toHaveFocus();
      
      // Select an option using userEvent
      await user.selectOptions(selectElement, 'Primary Care');
      
      expect(mockOnSelect).toHaveBeenCalledWith('Primary Care');
    });
  });

  describe('Functionality', () => {
    it('calls onSelect callback when a specialty is selected', async () => {
      const user = userEvent.setup();
      
      render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
          onSelect={mockOnSelect}
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      
      await user.selectOptions(selectElement, 'Cardiology');
      
      expect(mockOnSelect).toHaveBeenCalledWith('Cardiology');
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });

    it('does not call onSelect when default option is selected', async () => {
      const user = userEvent.setup();
      
      render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
          onSelect={mockOnSelect}
          value="Cardiology"
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      
      // Try to select the default option
      await user.selectOptions(selectElement, '');
      
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('works without onSelect callback', async () => {
      const user = userEvent.setup();
      
      render(<SpecialtyFilter specialties={mockSpecialties} />);
      
      const selectElement = screen.getByRole('combobox');
      
      // This should not throw an error
      await user.selectOptions(selectElement, 'Neurology');
      
      // Since this is an uncontrolled component without onSelect, 
      // it should maintain its internal state
      expect(selectElement).toHaveValue('Neurology');
    });

    it('displays correct value when value prop is provided', () => {
      render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
          value="Dermatology"
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      expect(selectElement).toHaveValue('Dermatology');
    });
  });

  describe('Error Handling', () => {
    it('handles empty specialties array gracefully', () => {
      render(
        <SpecialtyFilter 
          specialties={[]}
          onSelect={mockOnSelect}
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      expect(selectElement).toBeDisabled();
      expect(screen.getByText('No specialties available')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('No specialties are currently available for selection.');
    });

    it('handles undefined specialties gracefully', () => {
      render(
        <SpecialtyFilter 
          specialties={undefined}
          onSelect={mockOnSelect}
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      expect(selectElement).toBeDisabled();
      expect(screen.getByText('No specialties available')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('is disabled when disabled prop is true even with specialties', () => {
      render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
          disabled={true}
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      expect(selectElement).toBeDisabled();
    });
  });

  describe('Default Option', () => {
    it('includes a default disabled option', () => {
      render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
        />
      );
      
      const defaultOption = screen.getByText('Select a specialty');
      expect(defaultOption).toBeInTheDocument();
      expect(defaultOption).toHaveAttribute('disabled');
      expect(defaultOption).toHaveAttribute('value', '');
    });

    it('shows appropriate default text when no specialties available', () => {
      render(<SpecialtyFilter specialties={[]} />);
      
      const defaultOption = screen.getByText('No specialties available');
      expect(defaultOption).toBeInTheDocument();
      expect(defaultOption).toHaveAttribute('disabled');
    });

    it('default option is selected by default', () => {
      render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      expect(selectElement).toHaveValue('');
    });
  });

  describe('Styling and Interaction', () => {
    it('has hover and focus effects (testable through classes)', () => {
      render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      
      // Check that the element has the appropriate CSS class for styling
      expect(selectElement).toHaveClass('specialty-filter-select');
      
      // Test that the element can be focused without throwing errors
      fireEvent.focus(selectElement);
      fireEvent.blur(selectElement);
      fireEvent.mouseEnter(selectElement);
      fireEvent.mouseLeave(selectElement);
      
      // Verify the element still exists after these interactions
      expect(selectElement).toBeInTheDocument();
    });

    it('maintains focus state correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <SpecialtyFilter 
          specialties={mockSpecialties}
        />
      );
      
      const selectElement = screen.getByRole('combobox');
      
      await user.click(selectElement);
      expect(selectElement).toHaveFocus();
      
      await user.tab();
      expect(selectElement).not.toHaveFocus();
    });
  });
});