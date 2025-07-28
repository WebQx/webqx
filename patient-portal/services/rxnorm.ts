/**
 * Mock RxNorm API Service
 * 
 * This service simulates the RxNorm API for medication search functionality.
 * It provides realistic medication data and can simulate various network conditions
 * including failures, delays, and partial results for comprehensive testing.
 */

import { MedicationItem, RxNormResponse, RxNormServiceConfig } from '../types/prescription';

/**
 * Mock medication database
 * Contains a comprehensive list of common medications with realistic data
 */
const MOCK_MEDICATIONS: MedicationItem[] = [
  // Pain medications
  { rxcui: '161', name: 'Acetaminophen', synonym: 'Tylenol', strength: '500mg', doseForm: 'tablet' },
  { rxcui: '5640', name: 'Ibuprofen', synonym: 'Advil, Motrin', strength: '200mg', doseForm: 'tablet' },
  { rxcui: '1191', name: 'Aspirin', synonym: 'Bayer', strength: '325mg', doseForm: 'tablet' },
  { rxcui: '7804', name: 'Naproxen', synonym: 'Aleve', strength: '220mg', doseForm: 'tablet' },
  
  // Antibiotics
  { rxcui: '723', name: 'Amoxicillin', synonym: 'Amoxil', strength: '500mg', doseForm: 'capsule' },
  { rxcui: '2551', name: 'Azithromycin', synonym: 'Zithromax', strength: '250mg', doseForm: 'tablet' },
  { rxcui: '3640', name: 'Ciprofloxacin', synonym: 'Cipro', strength: '500mg', doseForm: 'tablet' },
  { rxcui: '4316', name: 'Doxycycline', synonym: 'Vibramycin', strength: '100mg', doseForm: 'capsule' },
  
  // Cardiovascular medications
  { rxcui: '29046', name: 'Lisinopril', synonym: 'Prinivil, Zestril', strength: '10mg', doseForm: 'tablet' },
  { rxcui: '6918', name: 'Metoprolol', synonym: 'Lopressor', strength: '50mg', doseForm: 'tablet' },
  { rxcui: '6472', name: 'Losartan', synonym: 'Cozaar', strength: '50mg', doseForm: 'tablet' },
  { rxcui: '36567', name: 'Simvastatin', synonym: 'Zocor', strength: '20mg', doseForm: 'tablet' },
  { rxcui: '83367', name: 'Atorvastatin', synonym: 'Lipitor', strength: '20mg', doseForm: 'tablet' },
  
  // Diabetes medications
  { rxcui: '6809', name: 'Metformin', synonym: 'Glucophage', strength: '500mg', doseForm: 'tablet' },
  { rxcui: '274783', name: 'Glipizide', synonym: 'Glucotrol', strength: '5mg', doseForm: 'tablet' },
  { rxcui: '8660', name: 'Insulin', synonym: 'Humalog', strength: '100 units/mL', doseForm: 'injection' },
  
  // Mental health medications
  { rxcui: '4493', name: 'Sertraline', synonym: 'Zoloft', strength: '50mg', doseForm: 'tablet' },
  { rxcui: '321988', name: 'Escitalopram', synonym: 'Lexapro', strength: '10mg', doseForm: 'tablet' },
  { rxcui: '4337', name: 'Fluoxetine', synonym: 'Prozac', strength: '20mg', doseForm: 'capsule' },
  { rxcui: '2598', name: 'Alprazolam', synonym: 'Xanax', strength: '0.5mg', doseForm: 'tablet' },
  
  // Respiratory medications
  { rxcui: '1998', name: 'Albuterol', synonym: 'ProAir, Ventolin', strength: '90mcg', doseForm: 'inhaler' },
  { rxcui: '6754', name: 'Montelukast', synonym: 'Singulair', strength: '10mg', doseForm: 'tablet' },
  { rxcui: '5093', name: 'Prednisone', synonym: 'Deltasone', strength: '10mg', doseForm: 'tablet' },
  
  // Gastrointestinal medications
  { rxcui: '7646', name: 'Omeprazole', synonym: 'Prilosec', strength: '20mg', doseForm: 'capsule' },
  { rxcui: '50090', name: 'Pantoprazole', synonym: 'Protonix', strength: '40mg', doseForm: 'tablet' },
  { rxcui: '6130', name: 'Loperamide', synonym: 'Imodium', strength: '2mg', doseForm: 'capsule' },
  
  // Allergy medications
  { rxcui: '1158', name: 'Cetirizine', synonym: 'Zyrtec', strength: '10mg', doseForm: 'tablet' },
  { rxcui: '18631', name: 'Loratadine', synonym: 'Claritin', strength: '10mg', doseForm: 'tablet' },
  { rxcui: '391', name: 'Diphenhydramine', synonym: 'Benadryl', strength: '25mg', doseForm: 'capsule' },
];

/**
 * Default configuration for the RxNorm service
 */
const DEFAULT_CONFIG: Required<RxNormServiceConfig> = {
  baseUrl: 'https://rxnav.nlm.nih.gov/REST',
  timeout: 5000,
  useMockData: true,
  mockDelay: 300, // 300ms delay to simulate network latency
  mockFailureRate: 0.1, // 10% chance of failure for testing
};

/**
 * RxNorm Service Class
 * Handles medication search functionality with configurable mock behavior
 */
export class RxNormService {
  private config: Required<RxNormServiceConfig>;

  constructor(config: Partial<RxNormServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Search for medications by name
   * @param query - Search term for medication name
   * @returns Promise resolving to array of matching medications
   */
  async searchMedications(query: string): Promise<MedicationItem[]> {
    if (!query || query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }

    // Simulate network delay
    await this.delay(this.config.mockDelay);

    // Simulate potential API failures for testing
    if (this.config.useMockData && Math.random() < this.config.mockFailureRate) {
      throw new Error('RxNorm API is temporarily unavailable. Please try again.');
    }

    if (this.config.useMockData) {
      return this.searchMockData(query);
    } else {
      return this.searchRealAPI(query);
    }
  }

  /**
   * Search mock medication data
   * @param query - Search term
   * @returns Array of matching medications
   */
  private searchMockData(query: string): MedicationItem[] {
    const normalizedQuery = query.toLowerCase().trim();
    
    return MOCK_MEDICATIONS.filter(med => {
      const nameMatch = med.name.toLowerCase().includes(normalizedQuery);
      const synonymMatch = med.synonym?.toLowerCase().includes(normalizedQuery) || false;
      const strengthMatch = med.strength?.toLowerCase().includes(normalizedQuery) || false;
      
      return nameMatch || synonymMatch || strengthMatch;
    }).slice(0, 10); // Limit to 10 results for better UX
  }

  /**
   * Search real RxNorm API (placeholder for future implementation)
   * @param query - Search term
   * @returns Promise resolving to array of medications
   */
  private async searchRealAPI(query: string): Promise<MedicationItem[]> {
    try {
      const url = `${this.config.baseUrl}/drugs.json?name=${encodeURIComponent(query)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`RxNorm API error: ${response.status} ${response.statusText}`);
      }
      
      const data: RxNormResponse = await response.json();
      return this.parseRxNormResponse(data);
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Search request timed out. Please try again.');
        }
        throw new Error(`Failed to search medications: ${error.message}`);
      }
      throw new Error('An unexpected error occurred while searching medications.');
    }
  }

  /**
   * Parse RxNorm API response into our medication format
   * @param response - Raw RxNorm API response
   * @returns Array of parsed medications
   */
  private parseRxNormResponse(response: RxNormResponse): MedicationItem[] {
    if (!response.drugGroup?.conceptGroup) {
      return [];
    }

    const medications: MedicationItem[] = [];
    
    response.drugGroup.conceptGroup.forEach(group => {
      if (group.conceptProperties) {
        group.conceptProperties.forEach(concept => {
          medications.push({
            rxcui: concept.rxcui,
            name: concept.name,
            synonym: concept.synonym,
            strength: concept.strength,
            doseForm: concept.doseForm,
          });
        });
      }
    });

    return medications;
  }

  /**
   * Add delay for simulating network latency
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update service configuration
   * @param newConfig - Partial configuration to update
   */
  updateConfig(newConfig: Partial<RxNormServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   * @returns Current service configuration
   */
  getConfig(): Required<RxNormServiceConfig> {
    return { ...this.config };
  }
}

/**
 * Default service instance with mock data enabled
 */
export const rxNormService = new RxNormService();

/**
 * Service instance for production use with real API
 */
export const rxNormServiceProduction = new RxNormService({
  useMockData: false,
  mockFailureRate: 0,
});