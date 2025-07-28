/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React, { useState, useEffect } from 'react';

/**
 * Interface for pharmacy store data
 */
export interface PharmacyStore {
  /** The name of the pharmacy */
  name: string;
  /** Array of RxCUI identifiers for medications available at this pharmacy */
  rxcui: string[];
  /** Price of the medication as a string */
  price: string;
  /** Distance to the pharmacy in miles */
  distance: number;
  /** Current availability status */
  status: string;
}

/**
 * Props interface for PharmacyLocator component
 */
export interface PharmacyLocatorProps {
  /** RxCUI identifier for the medication to search for */
  rxcui?: string;
  /** CSS class name for styling */
  className?: string;
  /** Callback when a pharmacy is selected */
  onPharmacySelect?: (pharmacy: PharmacyStore) => void;
}

/**
 * Interface for component state
 */
interface PharmacyLocatorState {
  stores: PharmacyStore[];
  loading: boolean;
  error: string | null;
}

/**
 * Mock data for pharmacy stores - simulates API response
 */
const mockPharmacyData: PharmacyStore[] = [
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
  },
  {
    name: "Target Pharmacy",
    rxcui: ["12345"],
    price: "24.99",
    distance: 0.8,
    status: "Limited Stock"
  }
];

/**
 * Simulates fetching pharmacy options from an API
 * @param rxcui - The RxCUI identifier to search for
 * @returns Promise that resolves to pharmacy store data
 */
export const fetchMockPharmacyOptions = async (rxcui?: string): Promise<PharmacyStore[]> => {
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      try {
        // Simulate random API failure (10% chance)
        if (Math.random() < 0.1) {
          throw new Error('Network error: Unable to fetch pharmacy data');
        }
        
        if (!rxcui) {
          resolve([]);
          return;
        }
        
        // Filter mock data by rxcui if provided
        const filteredStores = mockPharmacyData.filter(store => 
          store.rxcui.includes(rxcui)
        );
        
        resolve(filteredStores);
      } catch (error) {
        reject(error);
      }
    }, 1000); // 1 second delay to simulate API call
  });
};

/**
 * PharmacyLocator component displays a list of pharmacies with medication availability
 * and pricing information. Includes loading states, error handling, and accessibility features.
 */
export const PharmacyLocator: React.FC<PharmacyLocatorProps> = ({
  rxcui,
  className = "",
  onPharmacySelect
}) => {
  const [state, setState] = useState<PharmacyLocatorState>({
    stores: [],
    loading: false,
    error: null
  });

  // Fetch pharmacy data when component mounts or rxcui changes
  useEffect(() => {
    const fetchPharmacies = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const stores = await fetchMockPharmacyOptions(rxcui);
        setState(prev => ({ ...prev, stores, loading: false }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage
        }));
      }
    };

    fetchPharmacies();
  }, [rxcui]);

  // Helper function to get price as number for comparison
  const getPriceValue = (price: string): number => {
    return parseFloat(price.replace('$', ''));
  };

  // Helper function to determine if price is low (bottom 25% of prices)
  const isLowPrice = (price: string): boolean => {
    const priceValue = getPriceValue(price);
    const allPrices = state.stores.map(store => getPriceValue(store.price));
    const sortedPrices = allPrices.sort((a, b) => a - b);
    const quarterIndex = Math.ceil(sortedPrices.length * 0.25);
    return priceValue <= sortedPrices[quarterIndex - 1];
  };

  // Helper function to determine if distance is short (bottom 25% of distances)
  const isShortDistance = (distance: number): boolean => {
    const allDistances = state.stores.map(store => store.distance);
    const sortedDistances = allDistances.sort((a, b) => a - b);
    const quarterIndex = Math.ceil(sortedDistances.length * 0.25);
    return distance <= sortedDistances[quarterIndex - 1];
  };

  // Handle pharmacy selection
  const handlePharmacyClick = (pharmacy: PharmacyStore) => {
    if (onPharmacySelect) {
      onPharmacySelect(pharmacy);
    }
  };

  // Handle keyboard navigation for pharmacy selection
  const handlePharmacyKeyDown = (event: React.KeyboardEvent, pharmacy: PharmacyStore) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePharmacyClick(pharmacy);
    }
  };

  // Loading state
  if (state.loading) {
    return (
      <div 
        className={`pharmacy-locator ${className}`}
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

  // Error state
  if (state.error) {
    return (
      <div 
        className={`pharmacy-locator ${className}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="error-container">
          <div className="error-icon" aria-hidden="true">⚠️</div>
          <h3>Unable to Load Pharmacy Information</h3>
          <p>{state.error}</p>
          <p>Please try again later or contact support if the problem persists.</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (state.stores.length === 0) {
    return (
      <div 
        className={`pharmacy-locator ${className}`}
        role="region"
        aria-label="Pharmacy search results"
      >
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">🏥</div>
          <h3>No Pharmacies Found</h3>
          <p>
            {rxcui 
              ? "No pharmacies found with this medication in stock." 
              : "Please provide a medication identifier to search for pharmacies."
            }
          </p>
        </div>
      </div>
    );
  }

  // Main content with pharmacy list
  return (
    <div 
      className={`pharmacy-locator ${className}`}
      role="region"
      aria-label="Pharmacy search results"
    >
      <header className="pharmacy-locator-header">
        <h2>Available Pharmacies</h2>
        <p className="results-count" aria-live="polite">
          Found {state.stores.length} pharmacy{state.stores.length !== 1 ? 'ies' : ''} with your medication
        </p>
      </header>

      <ul 
        className="pharmacy-list" 
        role="list"
        aria-label="List of pharmacies with medication availability"
      >
        {state.stores.map((pharmacy, index) => {
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

export default PharmacyLocator;