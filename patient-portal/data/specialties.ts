/**
 * Medical Specialties Configuration
 * 
 * This file contains the list of medical specialties available in the WebQX platform.
 * In a real application, this could be fetched from an API endpoint.
 */

export interface Specialty {
  /** Unique identifier for the specialty */
  id: string;
  /** Display name of the specialty */
  name: string;
  /** Optional description of the specialty */
  description?: string;
  /** Whether this specialty is currently available for appointments */
  available?: boolean;
}

/**
 * Default list of medical specialties
 * This simulates data that would typically come from an API
 */
export const DEFAULT_SPECIALTIES: Specialty[] = [
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
  },
  {
    id: 'endocrinology',
    name: 'Endocrinology',
    description: 'Hormones and metabolic disorders',
    available: true
  },
  {
    id: 'gastroenterology',
    name: 'Gastroenterology',
    description: 'Digestive system disorders',
    available: true
  },
  {
    id: 'neurology',
    name: 'Neurology',
    description: 'Brain and nervous system conditions',
    available: true
  },
  {
    id: 'orthopedics',
    name: 'Orthopedics',
    description: 'Bone, joint, and muscle care',
    available: true
  },
  {
    id: 'pediatrics',
    name: 'Pediatrics',
    description: 'Children and adolescent healthcare',
    available: true
  },
  {
    id: 'psychiatry',
    name: 'Psychiatry',
    description: 'Mental health and behavioral disorders',
    available: true
  },
  {
    id: 'radiology',
    name: 'Radiology',
    description: 'Medical imaging and diagnostics',
    available: false // Example of unavailable specialty
  }
];

/**
 * Simulates fetching specialties from an API
 * In a real application, this would make an HTTP request
 */
export const fetchSpecialties = async (): Promise<Specialty[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return available specialties only
  return DEFAULT_SPECIALTIES.filter(specialty => specialty.available);
};

/**
 * Get specialty by ID
 */
export const getSpecialtyById = (id: string): Specialty | undefined => {
  return DEFAULT_SPECIALTIES.find(specialty => specialty.id === id);
};