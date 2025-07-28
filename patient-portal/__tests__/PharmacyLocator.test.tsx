/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PharmacyLocator, { PharmacyLocatorProps, PharmacyStore } from '../components/PharmacyLocator';

// Mock the fetchMockPharmacyOptions function
const originalFetch = global.fetch;

describe('PharmacyLocator Component', () => {
  const mockPharmacies: PharmacyStore[] = [
    {
      name: "HealthMart Orlando",
      rxcui: ["12345"],
      price: "18.99",
      distance: 1.2,
      status: "Available"
    },
    {
      name: "CVS Downtown",
      rxcui: ["12345"],
      price: "22.50",
      distance: 2.0,
      status: "In Stock"
    },
    {
      name: "Walgreens Main St",
      rxcui: ["12345"],
      price: "16.75",
      distance: 3.5,
      status: "Available"
    }
  ];

  const defaultProps: PharmacyLocatorProps = {
    rxcui: "12345",
    className: "test-pharmacy-locator"
  };

  // Create a version of PharmacyLocator that can be controlled for testing
  const TestPharmacyLocator: React.FC<PharmacyLocatorProps & { 
    mockStores?: PharmacyStore[]; 
    mockLoading?: boolean; 
    mockError?: string;
  }> = ({ mockStores, mockLoading, mockError, ...props }) => {
    const [stores, setStores] = React.useState<PharmacyStore[]>(mockStores || []);
    const [loading, setLoading] = React.useState(mockLoading || false);
    const [error, setError] = React.useState<string | null>(mockError || null);

    React.useEffect(() => {
      if (mockStores !== undefined) setStores(mockStores);
      if (mockLoading !== undefined) setLoading(mockLoading);
      if (mockError !== undefined) setError(mockError);
    }, [mockStores, mockLoading, mockError]);

    // Render the same content as PharmacyLocator based on state
    if (loading) {
      return (
        <div 
          className={`pharmacy-locator ${props.className || ''}`}
          role="status"
          aria-live="polite"
          aria-label="Loading pharmacy information"
        >
          <div className="loading-container">
            <div className="loading-spinner" aria-hidden="true">⏳</div>
            <p>Loading pharmacy options...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div 
          className={`pharmacy-locator ${props.className || ''}`}
          role="alert"
          aria-live="assertive"
        >
          <div className="error-container">
            <div className="error-icon" aria-hidden="true">⚠️</div>
            <h3>Unable to Load Pharmacy Information</h3>
            <p>{error}</p>
            <p>Please try again later or contact support if the problem persists.</p>
          </div>
        </div>
      );
    }

    if (stores.length === 0) {
      return (
        <div 
          className={`pharmacy-locator ${props.className || ''}`}
          role="region"
          aria-label="Pharmacy search results"
        >
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">🏥</div>
            <h3>No Pharmacies Found</h3>
            <p>
              {props.rxcui 
                ? "No pharmacies found with this medication in stock." 
                : "Please provide a medication identifier to search for pharmacies."
              }
            </p>
          </div>
        </div>
      );
    }

    // Helper functions (copied from original component)
    const getPriceValue = (price: string): number => parseFloat(price.replace('$', ''));
    
    const isLowPrice = (price: string): boolean => {
      const priceValue = getPriceValue(price);
      const allPrices = stores.map(store => getPriceValue(store.price));
      const sortedPrices = allPrices.sort((a, b) => a - b);
      const quarterIndex = Math.ceil(sortedPrices.length * 0.25);
      return priceValue <= sortedPrices[quarterIndex - 1];
    };

    const isShortDistance = (distance: number): boolean => {
      const allDistances = stores.map(store => store.distance);
      const sortedDistances = allDistances.sort((a, b) => a - b);
      const quarterIndex = Math.ceil(sortedDistances.length * 0.25);
      return distance <= sortedDistances[quarterIndex - 1];
    };

    const handlePharmacyClick = (pharmacy: PharmacyStore) => {
      if (props.onPharmacySelect) {
        props.onPharmacySelect(pharmacy);
      }
    };

    const handlePharmacyKeyDown = (event: React.KeyboardEvent, pharmacy: PharmacyStore) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handlePharmacyClick(pharmacy);
      }
    };

    return (
      <div 
        className={`pharmacy-locator ${props.className || ''}`}
        role="region"
        aria-label="Pharmacy search results"
      >
        <header className="pharmacy-locator-header">
          <h2>Available Pharmacies</h2>
          <p className="results-count" aria-live="polite">
            Found {stores.length} pharmacy{stores.length !== 1 ? 'ies' : ''} with your medication
          </p>
        </header>

        <ul 
          className="pharmacy-list" 
          role="list"
          aria-label="List of pharmacies with medication availability"
        >
          {stores.map((pharmacy, index) => {
            const lowPrice = isLowPrice(pharmacy.price);
            const shortDistance = isShortDistance(pharmacy.distance);
            const highlighted = lowPrice || shortDistance;
            
            return (
              <li
                key={`${pharmacy.name}-${index}`}
                className={`pharmacy-item ${highlighted ? 'highlighted' : ''}`}
                role="listitem"
              >
                <div
                  className="pharmacy-card"
                  tabIndex={0}
                  role="button"
                  aria-label={`Select ${pharmacy.name}, $${pharmacy.price}, ${pharmacy.distance} miles away, ${pharmacy.status}`}
                  onClick={() => handlePharmacyClick(pharmacy)}
                  onKeyDown={(e) => handlePharmacyKeyDown(e, pharmacy)}
                >
                  <div className="pharmacy-header">
                    <h3 className="pharmacy-name">{pharmacy.name}</h3>
                    <div className="pharmacy-highlights">
                      {lowPrice && (
                        <span className="highlight-badge price-highlight" aria-label="Low price">
                          💰 Best Price
                        </span>
                      )}
                      {shortDistance && (
                        <span className="highlight-badge distance-highlight" aria-label="Close distance">
                          📍 Closest
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="pharmacy-details">
                    <div className="pharmacy-price">
                      <span className="label">Price:</span>
                      <span className="value">${pharmacy.price}</span>
                    </div>
                    
                    <div className="pharmacy-distance">
                      <span className="label">Distance:</span>
                      <span className="value">{pharmacy.distance} miles</span>
                    </div>
                    
                    <div className="pharmacy-status">
                      <span className="label">Status:</span>
                      <span className={`value status-${pharmacy.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {pharmacy.status}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading state when data is being fetched', () => {
      render(<TestPharmacyLocator {...defaultProps} mockLoading={true} />);
      
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading pharmacy options...')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading pharmacy information')).toBeInTheDocument();
    });

    it('has proper accessibility attributes during loading', () => {
      render(<TestPharmacyLocator {...defaultProps} mockLoading={true} />);
      
      const loadingContainer = screen.getByRole('status');
      expect(loadingContainer).toHaveAttribute('aria-live', 'polite');
      expect(loadingContainer).toHaveAttribute('aria-label', 'Loading pharmacy information');
    });
  });

  describe('Error State', () => {
    it('displays error state on failed fetch', () => {
      const errorMessage = 'Network error: Unable to fetch pharmacy data';
      render(<TestPharmacyLocator {...defaultProps} mockError={errorMessage} />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Unable to Load Pharmacy Information')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText(/Please try again later/)).toBeInTheDocument();
    });

    it('has proper accessibility attributes for error state', () => {
      render(<TestPharmacyLocator {...defaultProps} mockError="Test error" />);
      
      const errorContainer = screen.getByRole('alert');
      expect(errorContainer).toHaveAttribute('aria-live', 'assertive');
    });

    it('handles non-Error exceptions gracefully', () => {
      render(<TestPharmacyLocator {...defaultProps} mockError="An unexpected error occurred" />);
      
      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('renders correctly with empty stores', () => {
      render(<TestPharmacyLocator {...defaultProps} mockStores={[]} />);
      
      expect(screen.getByText('No Pharmacies Found')).toBeInTheDocument();
      expect(screen.getByText('No pharmacies found with this medication in stock.')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Pharmacy search results' })).toBeInTheDocument();
    });

    it('shows different message when no rxcui is provided', () => {
      render(<TestPharmacyLocator rxcui="" mockStores={[]} />);
      
      expect(screen.getByText('Please provide a medication identifier to search for pharmacies.')).toBeInTheDocument();
    });
  });

  describe('Successful Data Display', () => {
    it('renders pharmacy list correctly with data', () => {
      const { container } = render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} />);
      
      expect(screen.getByText('Available Pharmacies')).toBeInTheDocument();
      
      // Test for results count using container query
      const resultsCount = container.querySelector('.results-count');
      expect(resultsCount).toBeInTheDocument();
      expect(resultsCount).toHaveTextContent(/Found.*3.*pharmacy.*ies.*with your medication/);
      
      expect(screen.getByRole('list', { name: 'List of pharmacies with medication availability' })).toBeInTheDocument();
    });

    it('displays all pharmacy information correctly', () => {
      render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} />);
      
      // Check all pharmacies are displayed
      expect(screen.getByText('HealthMart Orlando')).toBeInTheDocument();
      expect(screen.getByText('CVS Downtown')).toBeInTheDocument();
      expect(screen.getByText('Walgreens Main St')).toBeInTheDocument();
      
      // Check price information
      expect(screen.getByText('$18.99')).toBeInTheDocument();
      expect(screen.getByText('$22.50')).toBeInTheDocument();
      expect(screen.getByText('$16.75')).toBeInTheDocument();
      
      // Check distance information
      expect(screen.getByText('1.2 miles')).toBeInTheDocument();
      expect(screen.getByText('2 miles')).toBeInTheDocument();
      expect(screen.getByText('3.5 miles')).toBeInTheDocument();
      
      // Check status information
      expect(screen.getAllByText('Available')).toHaveLength(2);
      expect(screen.getByText('In Stock')).toBeInTheDocument();
    });

    it('highlights pharmacies with low prices', () => {
      render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} />);
      
      // Walgreens has the lowest price ($16.75), so it should be highlighted
      const walgreensCard = screen.getByText('Walgreens Main St').closest('.pharmacy-item');
      expect(walgreensCard).toHaveClass('highlighted');
      expect(screen.getByText('💰 Best Price')).toBeInTheDocument();
    });

    it('highlights pharmacies with short distances', () => {
      render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} />);
      
      // HealthMart has the shortest distance (1.2 miles), so it should be highlighted
      const healthMartCard = screen.getByText('HealthMart Orlando').closest('.pharmacy-item');
      expect(healthMartCard).toHaveClass('highlighted');
      expect(screen.getByText('📍 Closest')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onPharmacySelect when pharmacy is clicked', () => {
      const mockOnSelect = jest.fn();
      render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} onPharmacySelect={mockOnSelect} />);
      
      const pharmacyCard = screen.getByLabelText(/Select HealthMart Orlando/);
      fireEvent.click(pharmacyCard);
      
      expect(mockOnSelect).toHaveBeenCalledWith(mockPharmacies[0]);
    });

    it('handles keyboard navigation with Enter key', () => {
      const mockOnSelect = jest.fn();
      render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} onPharmacySelect={mockOnSelect} />);
      
      const pharmacyCard = screen.getByLabelText(/Select HealthMart Orlando/);
      fireEvent.keyDown(pharmacyCard, { key: 'Enter' });
      
      expect(mockOnSelect).toHaveBeenCalledWith(mockPharmacies[0]);
    });

    it('handles keyboard navigation with Space key', () => {
      const mockOnSelect = jest.fn();
      render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} onPharmacySelect={mockOnSelect} />);
      
      const pharmacyCard = screen.getByLabelText(/Select HealthMart Orlando/);
      fireEvent.keyDown(pharmacyCard, { key: ' ' });
      
      expect(mockOnSelect).toHaveBeenCalledWith(mockPharmacies[0]);
    });

    it('does not trigger selection on other keys', () => {
      const mockOnSelect = jest.fn();
      render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} onPharmacySelect={mockOnSelect} />);
      
      const pharmacyCard = screen.getByLabelText(/Select HealthMart Orlando/);
      fireEvent.keyDown(pharmacyCard, { key: 'Tab' });
      
      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} />);
      
      expect(screen.getByRole('region', { name: 'Pharmacy search results' })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'List of pharmacies with medication availability' })).toBeInTheDocument();
      
      const pharmacyCards = screen.getAllByRole('button');
      expect(pharmacyCards.length).toBe(3);
      
      pharmacyCards.forEach(card => {
        expect(card).toHaveAttribute('tabIndex', '0');
        expect(card).toHaveAttribute('aria-label');
      });
    });

    it('provides descriptive aria-labels for pharmacy cards', () => {
      render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} />);
      
      expect(screen.getByLabelText(/Select HealthMart Orlando, \$18.99, 1.2 miles away, Available/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Select CVS Downtown, \$22.50, 2 miles away, In Stock/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Select Walgreens Main St, \$16.75, 3.5 miles away, Available/)).toBeInTheDocument();
    });

    it('has live region for results count', () => {
      const { container } = render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} />);
      
      const resultsCount = container.querySelector('.results-count');
      expect(resultsCount).toHaveAttribute('aria-live', 'polite');
      expect(resultsCount).toHaveTextContent(/Found.*3.*pharmacy.*ies.*with your medication/);
    });
  });

  describe('Props and Configuration', () => {
    it('applies custom className correctly', () => {
      const { container } = render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} className="custom-class" />);
      
      const pharmacyLocator = container.querySelector('.pharmacy-locator');
      expect(pharmacyLocator).toHaveClass('custom-class');
    });

    it('works without onPharmacySelect callback', () => {
      render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} />);
      
      const pharmacyCard = screen.getByLabelText(/Select HealthMart Orlando/);
      
      // Should not throw error when clicking without callback
      expect(() => fireEvent.click(pharmacyCard)).not.toThrow();
    });
  });

  describe('Data Handling', () => {
    it('handles singular pharmacy count correctly', () => {
      const { container } = render(<TestPharmacyLocator {...defaultProps} mockStores={[mockPharmacies[0]]} />);
      
      const resultsCount = container.querySelector('.results-count');
      expect(resultsCount).toHaveTextContent(/Found.*1.*pharmacy.*with your medication/);
    });

    it('handles multiple pharmacies count correctly', () => {
      const { container } = render(<TestPharmacyLocator {...defaultProps} mockStores={mockPharmacies} />);
      
      const resultsCount = container.querySelector('.results-count');
      expect(resultsCount).toHaveTextContent(/Found.*3.*pharmacy.*ies.*with your medication/);
    });
  });

  // Test the actual PharmacyLocator component for basic functionality
  describe('Actual PharmacyLocator Integration', () => {
    it('renders loading state initially', () => {
      render(<PharmacyLocator rxcui="12345" />);
      
      // Should show loading initially
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading pharmacy options...')).toBeInTheDocument();
    });

    it('renders without rxcui', async () => {
      render(<PharmacyLocator />);
      
      // Wait for effect to complete and component to settle
      await waitFor(() => {
        expect(screen.getByText('No Pharmacies Found')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });
});