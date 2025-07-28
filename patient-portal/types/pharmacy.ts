/**
 * TypeScript interfaces for PharmacyLocator component
 */

export interface Pharmacy {
  /** Unique identifier for the pharmacy */
  id: string;
  /** Name of the pharmacy */
  name: string;
  /** Availability status of the pharmacy */
  availability: 'open' | 'closed' | 'open-24h';
  /** Price tier or rating (e.g., '$', '$$', '$$$') */
  price: string;
  /** Distance from user location in miles */
  distance: number;
  /** Full address of the pharmacy */
  address?: string;
  /** Phone number of the pharmacy */
  phone?: string;
  /** Array of services offered by the pharmacy */
  services?: string[];
}

export interface PharmacyLocatorProps {
  /** Array of nearby pharmacies */
  stores?: Pharmacy[];
  /** CSS class name for styling */
  className?: string;
  /** Callback function when a pharmacy is selected */
  onPharmacySelect?: (pharmacy: Pharmacy) => void;
}

export type SortOption = 'distance' | 'price' | 'name';

export interface SortConfig {
  /** Current sort field */
  field: SortOption;
  /** Sort direction */
  direction: 'asc' | 'desc';
}