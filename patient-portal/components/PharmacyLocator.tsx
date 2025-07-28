import React, { useState, useMemo } from 'react';
import { Pharmacy, PharmacyLocatorProps, SortOption, SortConfig } from '../types/pharmacy';

/**
 * PharmacyLocator component displays nearby pharmacy listings with sorting and filtering capabilities
 */
export const PharmacyLocator: React.FC<PharmacyLocatorProps> = ({
  stores = [],
  className = '',
  onPharmacySelect
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'distance',
    direction: 'asc'
  });

  // Sort pharmacies based on current sort configuration
  const sortedPharmacies = useMemo(() => {
    if (!stores || stores.length === 0) return [];

    return [...stores].sort((a, b) => {
      const { field, direction } = sortConfig;
      let comparison = 0;

      switch (field) {
        case 'distance':
          comparison = a.distance - b.distance;
          break;
        case 'price':
          // Convert price strings to numbers for comparison
          const priceA = a.price.length;
          const priceB = b.price.length;
          comparison = priceA - priceB;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        default:
          return 0;
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  }, [stores, sortConfig]);

  const handleSortChange = (field: SortOption) => {
    setSortConfig(prevConfig => ({
      field,
      direction: prevConfig.field === field && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handlePharmacyClick = (pharmacy: Pharmacy) => {
    if (onPharmacySelect) {
      onPharmacySelect(pharmacy);
    }
  };

  const getAvailabilityStatus = (availability: Pharmacy['availability']) => {
    switch (availability) {
      case 'open':
        return { text: 'Open', className: 'status-open' };
      case 'closed':
        return { text: 'Closed', className: 'status-closed' };
      case 'open-24h':
        return { text: 'Open 24h', className: 'status-24h' };
      default:
        return { text: 'Unknown', className: 'status-unknown' };
    }
  };

  // Handle empty or undefined stores array
  if (!stores || stores.length === 0) {
    return (
      <div 
        className={`pharmacy-locator ${className}`}
        role="region"
        aria-label="Nearby pharmacies"
      >
        <div className="pharmacy-locator-header">
          <h2 className="pharmacy-locator-title">Nearby Pharmacies</h2>
        </div>
        <div className="empty-state" role="status" aria-live="polite">
          <p className="no-pharmacies-message">
            🏥 No pharmacies found nearby.
          </p>
          <p className="empty-state-suggestion">
            Try adjusting your location or search criteria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`pharmacy-locator ${className}`}
      role="region"
      aria-label="Nearby pharmacies"
    >
      <div className="pharmacy-locator-header">
        <h2 className="pharmacy-locator-title">
          Nearby Pharmacies ({stores.length})
        </h2>
        
        <div className="sort-controls" role="group" aria-label="Sort pharmacies">
          <label htmlFor="sort-select" className="sort-label">
            Sort by:
          </label>
          <div className="sort-buttons">
            <button
              type="button"
              onClick={() => handleSortChange('distance')}
              className={`sort-button ${sortConfig.field === 'distance' ? 'active' : ''}`}
              aria-pressed={sortConfig.field === 'distance'}
              aria-label={`Sort by distance ${sortConfig.field === 'distance' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : ''}`}
            >
              Distance
              {sortConfig.field === 'distance' && (
                <span className="sort-indicator" aria-hidden="true">
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSortChange('price')}
              className={`sort-button ${sortConfig.field === 'price' ? 'active' : ''}`}
              aria-pressed={sortConfig.field === 'price'}
              aria-label={`Sort by price ${sortConfig.field === 'price' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : ''}`}
            >
              Price
              {sortConfig.field === 'price' && (
                <span className="sort-indicator" aria-hidden="true">
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSortChange('name')}
              className={`sort-button ${sortConfig.field === 'name' ? 'active' : ''}`}
              aria-pressed={sortConfig.field === 'name'}
              aria-label={`Sort by name ${sortConfig.field === 'name' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : ''}`}
            >
              Name
              {sortConfig.field === 'name' && (
                <span className="sort-indicator" aria-hidden="true">
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="pharmacy-list" role="list" data-testid="pharmacy-list">
        {sortedPharmacies.map((pharmacy) => {
          const availabilityStatus = getAvailabilityStatus(pharmacy.availability);
          
          return (
            <div
              key={pharmacy.id}
              className="pharmacy-item"
              role="listitem"
              tabIndex={0}
              onClick={() => handlePharmacyClick(pharmacy)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handlePharmacyClick(pharmacy);
                }
              }}
              aria-label={`${pharmacy.name}, ${pharmacy.distance} miles away, ${availabilityStatus.text}`}
            >
              <div className="pharmacy-header">
                <h3 className="pharmacy-name">{pharmacy.name}</h3>
                <div className="pharmacy-meta">
                  <span 
                    className={`pharmacy-status ${availabilityStatus.className}`}
                    aria-label={`Status: ${availabilityStatus.text}`}
                  >
                    {availabilityStatus.text}
                  </span>
                </div>
              </div>
              
              <div className="pharmacy-details">
                <div className="pharmacy-info">
                  <span className="pharmacy-distance" aria-label={`Distance: ${pharmacy.distance} miles`}>
                    📍 {pharmacy.distance} mi
                  </span>
                  <span className="pharmacy-price" aria-label={`Price tier: ${pharmacy.price}`}>
                    💰 {pharmacy.price}
                  </span>
                </div>
                
                {pharmacy.address && (
                  <div className="pharmacy-address" aria-label={`Address: ${pharmacy.address}`}>
                    📧 {pharmacy.address}
                  </div>
                )}
                
                {pharmacy.phone && (
                  <div className="pharmacy-phone" aria-label={`Phone: ${pharmacy.phone}`}>
                    📞 {pharmacy.phone}
                  </div>
                )}
                
                {pharmacy.services && pharmacy.services.length > 0 && (
                  <div className="pharmacy-services" aria-label="Available services">
                    <span className="services-label">Services:</span>
                    <ul className="services-list" role="list">
                      {pharmacy.services.map((service, index) => (
                        <li key={index} className="service-item" role="listitem">
                          {service}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PharmacyLocator;