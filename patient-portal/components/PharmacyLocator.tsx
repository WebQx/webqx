import React, { useEffect, useState } from 'react';
import { fetchMockPharmacyOptions } from '../services/pharmacyService';
import { PharmacyStore, PharmacyLocatorProps } from '../types/pharmacy';
import '../styles/PharmacyLocator.css';

/**
 * PharmacyLocator component displays pharmacy fulfillment options for a medication
 * Features include error handling, loading states, and accessibility enhancements
 */
export const PharmacyLocator: React.FC<PharmacyLocatorProps> = ({ 
  rxcui, 
  className = "" 
}) => {
  const [stores, setStores] = useState<PharmacyStore[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!rxcui) {
      return;
    }

    const fetchPharmacies = async () => {
      setLoading(true);
      setError('');
      
      try {
        const pharmacyData = await fetchMockPharmacyOptions(rxcui);
        setStores(pharmacyData);
      } catch (err: any) {
        const errorMessage = err?.message || err?.details || 'An unexpected error occurred while fetching pharmacy options.';
        setError(errorMessage);
        setStores([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPharmacies();
  }, [rxcui]);

  /**
   * Formats price for display
   */
  const formatPrice = (price: number): string => {
    return price.toFixed(2);
  };

  /**
   * Gets appropriate CSS classes for a pharmacy item
   */
  const getPharmacyItemClasses = (store: PharmacyStore): string => {
    const baseClasses = 'pharmacy-item';
    const modifierClasses = [];
    
    if (store.isBestPrice) modifierClasses.push('best-price');
    if (store.isClosest) modifierClasses.push('closest');
    if (store.status !== 'Open') modifierClasses.push('limited-hours');
    
    return [baseClasses, ...modifierClasses].join(' ');
  };

  /**
   * Retry function for failed requests
   */
  const handleRetry = () => {
    if (rxcui) {
      const fetchPharmacies = async () => {
        setLoading(true);
        setError('');
        
        try {
          const pharmacyData = await fetchMockPharmacyOptions(rxcui);
          setStores(pharmacyData);
        } catch (err: any) {
          const errorMessage = err?.message || err?.details || 'An unexpected error occurred while fetching pharmacy options.';
          setError(errorMessage);
          setStores([]);
        } finally {
          setLoading(false);
        }
      };

      fetchPharmacies();
    }
  };

  return (
    <section 
      className={`pharmacy-locator ${className}`}
      role="region"
      aria-labelledby="pharmacy-locator-heading"
      aria-live="polite"
    >
      <h3 id="pharmacy-locator-heading" className="pharmacy-locator-title">
        📍 Pharmacy Fulfillment Options
      </h3>
      
      {loading && (
        <div 
          className="pharmacy-loading"
          role="status"
          aria-label="Loading pharmacy options"
        >
          <div className="loading-spinner" aria-hidden="true"></div>
          <span className="loading-text">Finding pharmacy options...</span>
        </div>
      )}

      {error && (
        <div 
          className="pharmacy-error"
          role="alert"
          aria-describedby="error-description"
        >
          <div className="error-icon" aria-hidden="true">⚠️</div>
          <div className="error-content">
            <p className="error-message">Unable to load pharmacy options</p>
            <p id="error-description" className="error-details">{error}</p>
            <button 
              className="retry-button"
              onClick={handleRetry}
              aria-label="Retry loading pharmacy options"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && stores.length === 0 && (
        <div 
          className="pharmacy-empty"
          role="status"
          aria-label="No pharmacy options found"
        >
          <p>No pharmacy options found for this medication.</p>
        </div>
      )}

      {!loading && !error && stores.length > 0 && (
        <div className="pharmacy-results">
          <p className="results-summary" aria-live="polite">
            Found {stores.length} pharmacy option{stores.length !== 1 ? 's' : ''} near you
          </p>
          
          <ul 
            className="pharmacy-list"
            role="list"
            aria-label="Available pharmacy options"
          >
            {stores.map((store) => (
              <li 
                key={store.id}
                className={getPharmacyItemClasses(store)}
                role="listitem"
              >
                <div className="pharmacy-header">
                  <h4 className="pharmacy-name">
                    🏥 {store.name}
                    {store.isClosest && (
                      <span className="badge closest-badge" aria-label="Closest pharmacy">
                        Closest
                      </span>
                    )}
                    {store.isBestPrice && (
                      <span className="badge best-price-badge" aria-label="Best price">
                        Best Price
                      </span>
                    )}
                  </h4>
                  <div className="pharmacy-status" aria-label={`Status: ${store.status}`}>
                    <span className={`status-indicator ${store.status.toLowerCase().replace(' ', '-')}`}>
                      {store.status}
                    </span>
                  </div>
                </div>
                
                <div className="pharmacy-details">
                  <div className="pharmacy-pricing">
                    <span className="price-label">Price:</span>
                    <span 
                      className={`price-value ${store.isBestPrice ? 'best-price' : ''}`}
                      aria-label={`Price: ${formatPrice(store.price)} dollars`}
                    >
                      💵 ${formatPrice(store.price)}
                    </span>
                  </div>
                  
                  <div className="pharmacy-location">
                    <span className="distance-label">Distance:</span>
                    <span 
                      className="distance-value"
                      aria-label={`Distance: ${store.distance} miles`}
                    >
                      📍 {store.distance} mi
                    </span>
                  </div>
                </div>

                {store.address && (
                  <div className="pharmacy-address">
                    <span className="address-label">Address:</span>
                    <address className="address-value">{store.address}</address>
                  </div>
                )}

                {store.phone && (
                  <div className="pharmacy-contact">
                    <span className="phone-label">Phone:</span>
                    <a 
                      href={`tel:${store.phone}`}
                      className="phone-value"
                      aria-label={`Call ${store.name} at ${store.phone}`}
                    >
                      📞 {store.phone}
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}


    </section>
  );
};

export default PharmacyLocator;