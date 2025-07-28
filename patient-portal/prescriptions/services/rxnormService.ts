/**
 * RxNorm Service for comprehensive drug information and interactions
 * Provides drug information, interactions, and FDA integration
 */

export interface DrugInfo {
  rxcui: string;
  name: string;
  synonym?: string;
  tty?: string;
  language?: string;
}

export interface DrugInteraction {
  minConceptItem: {
    rxcui: string;
    name: string;
    tty: string;
  };
  interactionTypeGroup: {
    sourceConceptItem: {
      id: string;
      name: string;
    }[];
    interactionType: {
      comment: string;
      minConcept: {
        rxcui: string;
        name: string;
      }[];
    }[];
  }[];
}

export interface FDAWarning {
  id: string;
  drugName: string;
  warningType: 'BLACK_BOX' | 'CONTRAINDICATION' | 'WARNING' | 'PRECAUTION';
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

class RxNormService {
  private readonly baseUrl = 'https://rxnav.nlm.nih.gov/REST';
  private readonly fdaBaseUrl = 'https://api.fda.gov/drug';
  private cache = new Map<string, any>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Implements retry logic for API calls
   */
  private async fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
        
        if (response.ok) {
          return response;
        }
        
        // If it's a 5xx error, retry; otherwise throw
        if (response.status >= 500 && attempt < maxRetries) {
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
          continue;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          console.warn(`Attempt ${attempt} failed, retrying in ${Math.pow(2, attempt)} seconds...`);
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError!.message}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get from cache or fetch with caching
   */
  private async getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Search for drugs by name
   */
  async searchDrugs(name: string): Promise<DrugInfo[]> {
    const cacheKey = `search_${name.toLowerCase()}`;
    
    return this.getCached(cacheKey, async () => {
      try {
        const response = await this.fetchWithRetry(
          `${this.baseUrl}/drugs.json?name=${encodeURIComponent(name)}`
        );
        const data = await response.json();
        
        if (data.drugGroup?.conceptGroup) {
          const drugs: DrugInfo[] = [];
          for (const group of data.drugGroup.conceptGroup) {
            if (group.conceptProperties) {
              drugs.push(...group.conceptProperties.map((prop: any) => ({
                rxcui: prop.rxcui,
                name: prop.name,
                synonym: prop.synonym,
                tty: prop.tty,
                language: prop.language || 'ENG'
              })));
            }
          }
          return drugs;
        }
        
        return [];
      } catch (error) {
        console.error('Error searching drugs:', error);
        throw new Error(`Failed to search for drugs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * Get drug interactions for a specific RxCUI
   */
  async getDrugInteractions(rxcui: string): Promise<DrugInteraction[]> {
    const cacheKey = `interactions_${rxcui}`;
    
    return this.getCached(cacheKey, async () => {
      try {
        const response = await this.fetchWithRetry(
          `${this.baseUrl}/interaction/interaction.json?rxcui=${rxcui}`
        );
        const data = await response.json();
        
        return data.interactionTypeGroup || [];
      } catch (error) {
        console.error('Error fetching drug interactions:', error);
        throw new Error(`Failed to fetch interactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * Get FDA warnings for a drug
   */
  async getFDAWarnings(drugName: string): Promise<FDAWarning[]> {
    const cacheKey = `fda_warnings_${drugName.toLowerCase()}`;
    
    return this.getCached(cacheKey, async () => {
      try {
        // Note: This is a mock implementation as FDA API requires API key
        // In production, you would use the actual FDA API
        const mockWarnings: FDAWarning[] = [
          {
            id: `warning_${drugName}_1`,
            drugName,
            warningType: 'WARNING',
            description: `Monitor patient response when prescribing ${drugName}`,
            severity: 'MEDIUM'
          }
        ];
        
        // Simulate API delay
        await this.delay(100);
        
        return mockWarnings;
      } catch (error) {
        console.error('Error fetching FDA warnings:', error);
        return [];
      }
    });
  }

  /**
   * Get comprehensive drug information including interactions and warnings
   */
  async getComprehensiveDrugInfo(rxcui: string): Promise<{
    drugInfo: DrugInfo | null;
    interactions: DrugInteraction[];
    warnings: FDAWarning[];
  }> {
    try {
      const [drugInfoResponse, interactions] = await Promise.all([
        this.fetchWithRetry(`${this.baseUrl}/rxcui/${rxcui}.json`),
        this.getDrugInteractions(rxcui)
      ]);
      
      const drugData = await drugInfoResponse.json();
      const drugInfo = drugData.idGroup?.rxnormId?.[0] ? {
        rxcui,
        name: drugData.idGroup.name || 'Unknown',
        tty: drugData.idGroup.tty
      } : null;
      
      let warnings: FDAWarning[] = [];
      if (drugInfo) {
        warnings = await this.getFDAWarnings(drugInfo.name);
      }
      
      return {
        drugInfo,
        interactions,
        warnings
      };
    } catch (error) {
      console.error('Error fetching comprehensive drug info:', error);
      throw new Error(`Failed to fetch drug information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const rxnormService = new RxNormService();
export default rxnormService;