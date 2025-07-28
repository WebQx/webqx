import { PharmacyStore, PharmacyApiResponse, PharmacyApiError } from '../types/pharmacy';

/**
 * Mock pharmacy data for testing and demonstration
 */
const MOCK_PHARMACY_DATA: PharmacyStore[] = [
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
  },
  {
    id: 'rite-aid-001',
    name: 'Rite Aid #1203',
    status: 'Open',
    price: 14.25,
    distance: 1.2,
    address: '789 Elm Dr, Anytown, ST 12345',
    phone: '(555) 345-6789',
    isBestPrice: false,
    isClosest: false
  },
  {
    id: 'independent-001',
    name: 'Community Health Pharmacy',
    status: 'Open',
    price: 11.50,
    distance: 2.1,
    address: '321 Cedar Blvd, Anytown, ST 12345',
    phone: '(555) 456-7890',
    isBestPrice: true,
    isClosest: false
  },
  {
    id: 'walmart-001',
    name: 'Walmart Pharmacy #3421',
    status: 'Limited Hours',
    price: 13.75,
    distance: 1.8,
    address: '654 Pine Way, Anytown, ST 12345',
    phone: '(555) 567-8901',
    isBestPrice: false,
    isClosest: false
  }
];

/**
 * Simulates a network delay for realistic API behavior
 */
const simulateNetworkDelay = (): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
};

/**
 * Mock function to fetch pharmacy options for a given medication
 * @param rxcui - RxCUI (RxNorm Concept Unique Identifier) for the medication
 * @returns Promise that resolves to pharmacy options or rejects with error
 */
export const fetchMockPharmacyOptions = async (rxcui: string): Promise<PharmacyStore[]> => {
  // Simulate network delay
  await simulateNetworkDelay();

  // Simulate API error conditions (5% chance)
  if (Math.random() < 0.05) {
    const error: PharmacyApiError = {
      message: 'Failed to fetch pharmacy options',
      code: 'NETWORK_ERROR',
      details: 'Unable to connect to pharmacy service. Please try again later.'
    };
    throw error;
  }

  // Simulate empty results for certain RxCUI values
  if (rxcui === 'empty' || rxcui === '') {
    return [];
  }

  // Return mock data with some variation based on rxcui
  const stores = [...MOCK_PHARMACY_DATA];
  
  // Simulate price variations based on medication
  if (rxcui.includes('generic')) {
    stores.forEach(store => {
      store.price = store.price * 0.7; // Generic medications are cheaper
    });
  } else if (rxcui.includes('brand')) {
    stores.forEach(store => {
      store.price = store.price * 1.5; // Brand medications are more expensive
    });
  }

  // Sort by distance by default
  stores.sort((a, b) => a.distance - b.distance);

  // Mark the best price
  const minPrice = Math.min(...stores.map(s => s.price));
  stores.forEach(store => {
    store.isBestPrice = store.price === minPrice;
  });

  return stores;
};

/**
 * Alternative mock function that always throws an error (for testing error handling)
 */
export const fetchMockPharmacyOptionsWithError = async (rxcui: string): Promise<PharmacyStore[]> => {
  await simulateNetworkDelay();
  
  const error: PharmacyApiError = {
    message: 'Service temporarily unavailable',
    code: 'SERVICE_ERROR',
    details: 'The pharmacy service is currently experiencing issues. Please try again in a few minutes.'
  };
  throw error;
};

/**
 * Get pharmacy options with additional API response metadata
 */
export const fetchPharmacyOptionsWithMetadata = async (rxcui: string): Promise<PharmacyApiResponse> => {
  try {
    const stores = await fetchMockPharmacyOptions(rxcui);
    return {
      stores,
      lastUpdated: new Date().toISOString(),
      success: true
    };
  } catch (error) {
    throw error;
  }
};