import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PharmacyLocator from '../components/PharmacyLocator';
import { fetchMockPharmacyOptions } from '../services/pharmacyService';

// Mock the pharmacy service
jest.mock('../services/pharmacyService');

const mockFetchMockPharmacyOptions = fetchMockPharmacyOptions as jest.MockedFunction<typeof fetchMockPharmacyOptions>;

describe('PharmacyLocator Component', () => {
  const mockStores = [
    {
      id: 'cvs-001',
      name: 'CVS Pharmacy #2847',
      status: 'Open',
      price: 12.99,
      distance: 0.3,
      address: '123 Main St, Anytown, ST 12345',
      phone: '(555) 123-4567',
      isBestPrice: true,
      isClosest: true
    },
    {
      id: 'walgreens-001',
      name: 'Walgreens #8234',
      status: 'Open',
      price: 15.49,
      distance: 0.7,
      address: '456 Oak Ave, Anytown, ST 12345',
      phone: '(555) 234-5678',
      isBestPrice: false,
      isClosest: false
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component title correctly', () => {
    render(<PharmacyLocator rxcui="test-rxcui" />);
    
    expect(screen.getByText('📍 Pharmacy Fulfillment Options')).toBeInTheDocument();
  });

  it('displays loading state when fetching data', async () => {
    // Mock a delayed response
    mockFetchMockPharmacyOptions.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockStores), 100))
    );

    render(<PharmacyLocator rxcui="test-rxcui" />);
    
    expect(screen.getByRole('status', { name: /loading pharmacy options/i })).toBeInTheDocument();
    expect(screen.getByText('Finding pharmacy options...')).toBeInTheDocument();
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading pharmacy options/i })).not.toBeInTheDocument();
    });
  });

  it('renders correctly with empty stores', async () => {
    mockFetchMockPharmacyOptions.mockResolvedValue([]);

    render(<PharmacyLocator rxcui="empty" />);
    
    await waitFor(() => {
      expect(screen.getByRole('status', { name: /no pharmacy options found/i })).toBeInTheDocument();
    });
    
    expect(screen.getByText('No pharmacy options found for this medication.')).toBeInTheDocument();
  });

  it('displays pharmacy options when data is loaded successfully', async () => {
    mockFetchMockPharmacyOptions.mockResolvedValue(mockStores);

    render(<PharmacyLocator rxcui="test-rxcui" />);
    
    await waitFor(() => {
      expect(screen.getByText('Found 2 pharmacy options near you')).toBeInTheDocument();
    });

    // Check if pharmacy names are displayed
    expect(screen.getByText('🏥 CVS Pharmacy #2847')).toBeInTheDocument();
    expect(screen.getByText('🏥 Walgreens #8234')).toBeInTheDocument();

    // Check prices
    expect(screen.getByText('💵 $12.99')).toBeInTheDocument();
    expect(screen.getByText('💵 $15.49')).toBeInTheDocument();

    // Check distances
    expect(screen.getByText('📍 0.3 mi')).toBeInTheDocument();
    expect(screen.getByText('📍 0.7 mi')).toBeInTheDocument();
  });

  it('displays an error message on fetch failure', async () => {
    const errorMessage = 'Failed to fetch pharmacy options';
    mockFetchMockPharmacyOptions.mockRejectedValue({
      message: errorMessage,
      code: 'NETWORK_ERROR'
    });

    render(<PharmacyLocator rxcui="test-rxcui" />);
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('Unable to load pharmacy options')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('handles retry functionality when fetch fails', async () => {
    const user = userEvent.setup();
    
    // First call fails
    mockFetchMockPharmacyOptions
      .mockRejectedValueOnce({
        message: 'Service temporarily unavailable',
        code: 'SERVICE_ERROR'
      })
      // Second call succeeds
      .mockResolvedValueOnce(mockStores);

    render(<PharmacyLocator rxcui="test-rxcui" />);
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /retry loading pharmacy options/i });
    expect(retryButton).toBeInTheDocument();

    // Click retry
    await user.click(retryButton);

    // Wait for successful data load
    await waitFor(() => {
      expect(screen.getByText('Found 2 pharmacy options near you')).toBeInTheDocument();
    });

    expect(screen.getByText('🏥 CVS Pharmacy #2847')).toBeInTheDocument();
  });

  it('displays badges for best price and closest pharmacy', async () => {
    mockFetchMockPharmacyOptions.mockResolvedValue(mockStores);

    render(<PharmacyLocator rxcui="test-rxcui" />);
    
    await waitFor(() => {
      expect(screen.getByText('Found 2 pharmacy options near you')).toBeInTheDocument();
    });

    // Check for badges
    expect(screen.getByLabelText('Best price')).toBeInTheDocument();
    expect(screen.getByLabelText('Closest pharmacy')).toBeInTheDocument();
  });

  it('displays pharmacy contact information', async () => {
    mockFetchMockPharmacyOptions.mockResolvedValue(mockStores);

    render(<PharmacyLocator rxcui="test-rxcui" />);
    
    await waitFor(() => {
      expect(screen.getByText('Found 2 pharmacy options near you')).toBeInTheDocument();
    });

    // Check addresses
    expect(screen.getByText('123 Main St, Anytown, ST 12345')).toBeInTheDocument();
    expect(screen.getByText('456 Oak Ave, Anytown, ST 12345')).toBeInTheDocument();

    // Check phone numbers as links
    const phoneLink1 = screen.getByRole('link', { name: /call cvs pharmacy #2847 at \(555\) 123-4567/i });
    expect(phoneLink1).toBeInTheDocument();
    expect(phoneLink1).toHaveAttribute('href', 'tel:(555) 123-4567');
  });

  it('has proper accessibility attributes', async () => {
    mockFetchMockPharmacyOptions.mockResolvedValue(mockStores);

    render(<PharmacyLocator rxcui="test-rxcui" />);
    
    await waitFor(() => {
      expect(screen.getByText('Found 2 pharmacy options near you')).toBeInTheDocument();
    });

    // Check main region
    const pharmacySection = screen.getByRole('region', { name: /pharmacy fulfillment options/i });
    expect(pharmacySection).toBeInTheDocument();
    expect(pharmacySection).toHaveAttribute('aria-live', 'polite');

    // Check list structure
    const pharmacyList = screen.getByRole('list', { name: /available pharmacy options/i });
    expect(pharmacyList).toBeInTheDocument();

    // Check list items
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);

    // Check ARIA labels for prices and distances
    expect(screen.getByLabelText('Price: 12.99 dollars')).toBeInTheDocument();
    expect(screen.getByLabelText('Distance: 0.3 miles')).toBeInTheDocument();
  });

  it('applies custom className correctly', () => {
    const { container } = render(<PharmacyLocator rxcui="test-rxcui" className="custom-class" />);
    const pharmacyLocator = container.querySelector('.pharmacy-locator');
    
    expect(pharmacyLocator).toHaveClass('custom-class');
  });

  it('does not fetch data when rxcui is empty', () => {
    render(<PharmacyLocator rxcui="" />);
    
    expect(mockFetchMockPharmacyOptions).not.toHaveBeenCalled();
  });

  it('refetches data when rxcui changes', async () => {
    const { rerender } = render(<PharmacyLocator rxcui="first-rxcui" />);
    
    await waitFor(() => {
      expect(mockFetchMockPharmacyOptions).toHaveBeenCalledWith('first-rxcui');
    });

    mockFetchMockPharmacyOptions.mockClear();
    
    rerender(<PharmacyLocator rxcui="second-rxcui" />);
    
    await waitFor(() => {
      expect(mockFetchMockPharmacyOptions).toHaveBeenCalledWith('second-rxcui');
    });
  });

  it('displays status indicators correctly', async () => {
    const storesWithDifferentStatuses = [
      {
        ...mockStores[0],
        status: 'Open'
      },
      {
        ...mockStores[1],
        status: 'Limited Hours'
      }
    ];

    mockFetchMockPharmacyOptions.mockResolvedValue(storesWithDifferentStatuses);

    render(<PharmacyLocator rxcui="test-rxcui" />);
    
    await waitFor(() => {
      expect(screen.getByText('Found 2 pharmacy options near you')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Status: Open')).toBeInTheDocument();
    expect(screen.getByLabelText('Status: Limited Hours')).toBeInTheDocument();
  });

  it('handles error with missing message gracefully', async () => {
    mockFetchMockPharmacyOptions.mockRejectedValue({});

    render(<PharmacyLocator rxcui="test-rxcui" />);
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('An unexpected error occurred while fetching pharmacy options.')).toBeInTheDocument();
  });
});