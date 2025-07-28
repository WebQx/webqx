import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PharmacyLocator from '../components/PharmacyLocator';
import { Pharmacy } from '../types/pharmacy';

describe('PharmacyLocator Component', () => {
  const mockPharmacies: Pharmacy[] = [
    {
      id: '1',
      name: 'CVS Pharmacy',
      availability: 'open',
      price: '$$',
      distance: 0.5,
      address: '123 Main St, City, ST 12345',
      phone: '(555) 123-4567',
      services: ['Prescriptions', 'Vaccinations', 'Health Screenings']
    },
    {
      id: '2',
      name: 'Walgreens',
      availability: 'open-24h',
      price: '$',
      distance: 1.2,
      address: '456 Oak Ave, City, ST 12345',
      phone: '(555) 987-6543',
      services: ['Prescriptions', 'Photo Services']
    },
    {
      id: '3',
      name: 'Local Health Pharmacy',
      availability: 'closed',
      price: '$$$',
      distance: 0.3,
      address: '789 Pine Rd, City, ST 12345',
      phone: '(555) 555-0123'
    }
  ];

  const mockOnPharmacySelect = jest.fn();

  beforeEach(() => {
    mockOnPharmacySelect.mockClear();
  });

  describe('Empty State', () => {
    it('displays empty state when no pharmacies are provided', () => {
      render(<PharmacyLocator stores={[]} />);
      
      expect(screen.getByText(/No pharmacies found nearby/)).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your location or search criteria.')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('displays empty state when stores prop is undefined', () => {
      render(<PharmacyLocator />);
      
      expect(screen.getByText(/No pharmacies found nearby/)).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your location or search criteria.')).toBeInTheDocument();
    });

    it('has proper accessibility attributes for empty state', () => {
      render(<PharmacyLocator stores={[]} />);
      
      const region = screen.getByRole('region', { name: 'Nearby pharmacies' });
      expect(region).toBeInTheDocument();
      
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Pharmacy List Display', () => {
    it('renders correctly with provided pharmacies', () => {
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      expect(screen.getByText('Nearby Pharmacies (3)')).toBeInTheDocument();
      expect(screen.getByText('CVS Pharmacy')).toBeInTheDocument();
      expect(screen.getByText('Walgreens')).toBeInTheDocument();
      expect(screen.getByText('Local Health Pharmacy')).toBeInTheDocument();
    });

    it('displays pharmacy details correctly', () => {
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      // Check distance and price display (being more specific)
      expect(screen.getByText(/0.5 mi/)).toBeInTheDocument();
      expect(screen.getByLabelText('Price tier: $$')).toBeInTheDocument();
      
      // Check address and phone
      expect(screen.getByText(/123 Main St, City, ST 12345/)).toBeInTheDocument();
      expect(screen.getByText(/\(555\) 123-4567/)).toBeInTheDocument();
      
      // Check services (using getAllByText for multiple instances)
      expect(screen.getAllByText('Prescriptions')).toHaveLength(2);
      expect(screen.getByText('Vaccinations')).toBeInTheDocument();
    });

    it('displays availability status correctly', () => {
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getByText('Open 24h')).toBeInTheDocument();
      expect(screen.getByText('Closed')).toBeInTheDocument();
    });

    it('has proper accessibility attributes for pharmacy list', () => {
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      const pharmacyList = screen.getByTestId('pharmacy-list'); // Use test id instead
      expect(pharmacyList).toBeInTheDocument();
      
      const listItems = screen.getAllByRole('listitem');
      expect(listItems.length).toBeGreaterThanOrEqual(3); // At least 3 pharmacy items
      
      // Check that pharmacy items are focusable
      const firstPharmacy = screen.getByLabelText(/Local Health Pharmacy/);
      expect(firstPharmacy).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Sorting Functionality', () => {
    it('sorts by distance by default (ascending)', () => {
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      const listItems = screen.getAllByRole('listitem');
      const firstPharmacyName = listItems[0].querySelector('.pharmacy-name')?.textContent;
      expect(firstPharmacyName).toBe('Local Health Pharmacy'); // 0.3 mi
    });

    it('sorts by distance when distance button is clicked', async () => {
      const user = userEvent.setup();
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      const distanceButton = screen.getByRole('button', { name: /Sort by distance/ });
      expect(distanceButton).toHaveAttribute('aria-pressed', 'true');
      
      // Click to reverse order
      await user.click(distanceButton);
      
      const listItems = screen.getAllByRole('listitem');
      const firstPharmacyName = listItems[0].querySelector('.pharmacy-name')?.textContent;
      expect(firstPharmacyName).toBe('Walgreens'); // 1.2 mi (descending)
    });

    it('sorts by price when price button is clicked', async () => {
      const user = userEvent.setup();
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      const priceButton = screen.getByRole('button', { name: /Sort by price/ });
      await user.click(priceButton);
      
      expect(priceButton).toHaveAttribute('aria-pressed', 'true');
      
      const listItems = screen.getAllByRole('listitem');
      const firstPharmacyName = listItems[0].querySelector('.pharmacy-name')?.textContent;
      expect(firstPharmacyName).toBe('Walgreens'); // $ (cheapest)
    });

    it('sorts by name when name button is clicked', async () => {
      const user = userEvent.setup();
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      const nameButton = screen.getByRole('button', { name: /Sort by name/ });
      await user.click(nameButton);
      
      expect(nameButton).toHaveAttribute('aria-pressed', 'true');
      
      const listItems = screen.getAllByRole('listitem');
      const firstPharmacyName = listItems[0].querySelector('.pharmacy-name')?.textContent;
      expect(firstPharmacyName).toBe('CVS Pharmacy'); // Alphabetically first
    });

    it('shows sort indicators correctly', async () => {
      const user = userEvent.setup();
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      const distanceButton = screen.getByRole('button', { name: /Sort by distance/ });
      expect(distanceButton).toContainHTML('↑'); // Ascending by default
      
      await user.click(distanceButton);
      expect(distanceButton).toContainHTML('↓'); // Descending after click
    });

    it('has proper accessibility attributes for sort controls', () => {
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      const sortGroup = screen.getByRole('group', { name: 'Sort pharmacies' });
      expect(sortGroup).toBeInTheDocument();
      
      const sortLabel = screen.getByText('Sort by:');
      expect(sortLabel).toBeInTheDocument();
      
      const distanceButton = screen.getByRole('button', { name: /Sort by distance/ });
      expect(distanceButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('User Interactions', () => {
    it('calls onPharmacySelect when pharmacy is clicked', async () => {
      const user = userEvent.setup();
      render(
        <PharmacyLocator 
          stores={mockPharmacies} 
          onPharmacySelect={mockOnPharmacySelect}
        />
      );
      
      const firstPharmacy = screen.getByLabelText(/Local Health Pharmacy/);
      await user.click(firstPharmacy);
      
      expect(mockOnPharmacySelect).toHaveBeenCalledWith(mockPharmacies[2]); // Local Health Pharmacy (sorted by distance)
    });

    it('calls onPharmacySelect when Enter key is pressed', async () => {
      const user = userEvent.setup();
      render(
        <PharmacyLocator 
          stores={mockPharmacies} 
          onPharmacySelect={mockOnPharmacySelect}
        />
      );
      
      const firstPharmacy = screen.getByLabelText(/Local Health Pharmacy/);
      firstPharmacy.focus();
      await user.keyboard('{Enter}');
      
      expect(mockOnPharmacySelect).toHaveBeenCalledWith(mockPharmacies[2]);
    });

    it('calls onPharmacySelect when Space key is pressed', async () => {
      const user = userEvent.setup();
      render(
        <PharmacyLocator 
          stores={mockPharmacies} 
          onPharmacySelect={mockOnPharmacySelect}
        />
      );
      
      const firstPharmacy = screen.getByLabelText(/Local Health Pharmacy/);
      firstPharmacy.focus();
      await user.keyboard(' ');
      
      expect(mockOnPharmacySelect).toHaveBeenCalledWith(mockPharmacies[2]);
    });

    it('does not call onPharmacySelect when no callback is provided', async () => {
      const user = userEvent.setup();
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      const firstPharmacy = screen.getByLabelText(/Local Health Pharmacy/);
      await user.click(firstPharmacy);
      
      // Should not throw an error
      expect(mockOnPharmacySelect).not.toHaveBeenCalled();
    });
  });

  describe('Styling and CSS Classes', () => {
    it('applies custom className correctly', () => {
      const { container } = render(
        <PharmacyLocator stores={mockPharmacies} className="custom-class" />
      );
      
      const pharmacyLocator = container.querySelector('.pharmacy-locator');
      expect(pharmacyLocator).toHaveClass('custom-class');
    });

    it('applies correct CSS classes for different availability statuses', () => {
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      expect(screen.getByText('Open')).toHaveClass('status-open');
      expect(screen.getByText('Open 24h')).toHaveClass('status-24h');
      expect(screen.getByText('Closed')).toHaveClass('status-closed');
    });

    it('applies active class to currently selected sort button', () => {
      render(<PharmacyLocator stores={mockPharmacies} />);
      
      const distanceButton = screen.getByRole('button', { name: /Sort by distance/ });
      expect(distanceButton).toHaveClass('active');
      
      const priceButton = screen.getByRole('button', { name: /Sort by price/ });
      expect(priceButton).not.toHaveClass('active');
    });
  });

  describe('Edge Cases', () => {
    it('handles pharmacies without optional fields', () => {
      const minimalPharmacy: Pharmacy[] = [{
        id: '1',
        name: 'Basic Pharmacy',
        availability: 'open',
        price: '$',
        distance: 1.0
      }];
      
      render(<PharmacyLocator stores={minimalPharmacy} />);
      
      expect(screen.getByText('Basic Pharmacy')).toBeInTheDocument();
      expect(screen.getByText(/1 mi/)).toBeInTheDocument();
      expect(screen.getByText(/\$/)).toBeInTheDocument();
      
      // Should not show address, phone, or services
      expect(screen.queryByText(/📧/)).not.toBeInTheDocument();
      expect(screen.queryByText(/📞/)).not.toBeInTheDocument();
      expect(screen.queryByText('Services:')).not.toBeInTheDocument();
    });

    it('handles empty services array', () => {
      const pharmacyWithEmptyServices: Pharmacy[] = [{
        id: '1',
        name: 'No Services Pharmacy',
        availability: 'open',
        price: '$',
        distance: 1.0,
        services: []
      }];
      
      render(<PharmacyLocator stores={pharmacyWithEmptyServices} />);
      
      expect(screen.getByText('No Services Pharmacy')).toBeInTheDocument();
      expect(screen.queryByText('Services:')).not.toBeInTheDocument();
    });

    it('handles unknown availability status', () => {
      const pharmacyWithUnknownStatus: Pharmacy[] = [{
        id: '1',
        name: 'Unknown Status Pharmacy',
        availability: 'unknown' as any, // Intentionally invalid
        price: '$',
        distance: 1.0
      }];
      
      render(<PharmacyLocator stores={pharmacyWithUnknownStatus} />);
      
      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toHaveClass('status-unknown');
    });
  });
});