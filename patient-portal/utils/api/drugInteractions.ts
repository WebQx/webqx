/**
 * Drug Interactions API Utility
 * 
 * This module provides functionality to check drug interactions using the FDA's RxNav API.
 * It includes comprehensive error handling, input validation, and TypeScript type safety.
 * 
 * @module drugInteractions
 */

/**
 * Structure of an individual drug interaction from RxNav API
 */
export interface DrugInteraction {
  /** Source of the interaction data */
  source: string;
  /** Description of the interaction */
  description: string;
  /** Severity level of the interaction */
  severity?: string;
}

/**
 * Response structure from RxNav drug interactions API
 */
export interface RxNavInteractionResponse {
  /** Information about the drug interactions */
  interactionTypeGroup?: {
    /** Array of interaction types */
    interactionType?: Array<{
      /** Comments about the interaction */
      comment?: string;
      /** Minimum concept items */
      minConceptItem?: {
        /** RxCUI identifier */
        rxcui: string;
        /** Drug name */
        name: string;
        /** Time to live */
        tty?: string;
      };
      /** Interaction pairs */
      interactionPair?: Array<{
        /** Interaction concept */
        interactionConcept?: Array<{
          /** Minimum concept item */
          minConceptItem?: {
            /** RxCUI identifier */
            rxcui: string;
            /** Drug name */
            name: string;
            /** Time to live */
            tty?: string;
          };
          /** Source of concept */
          sourceConceptItem?: {
            /** Source identifier */
            id: string;
            /** Source name */
            name: string;
            /** Source URL */
            url?: string;
          };
        }>;
        /** Severity level */
        severity?: string;
        /** Description of interaction */
        description?: string;
      }>;
    }>;
  };
}

/**
 * Parameters for checking drug interactions
 */
export interface CheckDrugInteractionsParams {
  /** RxCUI (RxNorm Concept Unique Identifier) for the drug */
  rxcui: string;
  /** Optional list of other drug RxCUIs to check interactions with */
  otherDrugIds?: string[];
}

/**
 * Result structure returned by checkDrugInteractions function
 */
export interface DrugInteractionResult {
  /** Success status of the API call */
  success: boolean;
  /** Array of drug interactions found */
  interactions: DrugInteraction[];
  /** Error message if the request failed */
  error?: string;
  /** The RxCUI that was checked */
  rxcui: string;
}

/**
 * Validates RxCUI parameter to ensure it meets the expected format
 * 
 * @param rxcui - The RxCUI to validate
 * @returns True if valid, false otherwise
 */
function validateRxcui(rxcui: string): boolean {
  // RxCUI should be a non-empty string containing only digits
  if (!rxcui || typeof rxcui !== 'string') {
    return false;
  }
  
  // Remove whitespace and check if it's a valid number
  const trimmed = rxcui.trim();
  if (trimmed.length === 0) {
    return false;
  }
  
  // RxCUI should contain only digits
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }
  
  return true;
}

/**
 * Gets the RxNav API base URL from environment variables or uses default
 * 
 * @returns The base URL for RxNav API
 */
function getRxNavBaseUrl(): string {
  // In a browser environment, we might need to use a different approach
  // for environment variables (e.g., process.env may not be available)
  const baseUrl = process.env.RXNAV_API_BASE_URL || 'https://rxnav.nlm.nih.gov/REST';
  return baseUrl;
}

/**
 * Transforms RxNav API response to our standardized format
 * 
 * @param response - Raw response from RxNav API
 * @returns Array of standardized DrugInteraction objects
 */
function transformRxNavResponse(response: RxNavInteractionResponse): DrugInteraction[] {
  const interactions: DrugInteraction[] = [];
  
  try {
    const interactionTypes = response.interactionTypeGroup?.interactionType;
    
    if (!interactionTypes || !Array.isArray(interactionTypes)) {
      return interactions;
    }
    
    for (const interactionType of interactionTypes) {
      const interactionPairs = interactionType.interactionPair;
      
      if (!interactionPairs || !Array.isArray(interactionPairs)) {
        continue;
      }
      
      for (const pair of interactionPairs) {
        const interaction: DrugInteraction = {
          source: 'RxNav/NIH',
          description: pair.description || 'Drug interaction detected',
          severity: pair.severity || 'Unknown'
        };
        
        interactions.push(interaction);
      }
    }
  } catch (error) {
    console.warn('Error transforming RxNav response:', error);
  }
  
  return interactions;
}

/**
 * Checks for drug interactions using the FDA's RxNav API
 * 
 * This function fetches drug interaction data from the RxNav API with comprehensive
 * error handling, input validation, and type safety.
 * 
 * @param params - Parameters containing the RxCUI and optional other drug IDs
 * @returns Promise resolving to drug interaction results
 * 
 * @example
 * ```typescript
 * const result = await checkDrugInteractions({ rxcui: '207106' });
 * if (result.success) {
 *   console.log('Found interactions:', result.interactions);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function checkDrugInteractions(
  params: CheckDrugInteractionsParams
): Promise<DrugInteractionResult> {
  const { rxcui, otherDrugIds = [] } = params;
  
  // Validate the primary RxCUI parameter
  if (!validateRxcui(rxcui)) {
    return {
      success: false,
      interactions: [],
      error: 'Invalid RxCUI provided. RxCUI must be a non-empty string containing only digits.',
      rxcui
    };
  }
  
  // Validate other drug IDs if provided
  for (const drugId of otherDrugIds) {
    if (!validateRxcui(drugId)) {
      return {
        success: false,
        interactions: [],
        error: `Invalid drug ID provided in otherDrugIds: ${drugId}. All drug IDs must be valid RxCUIs.`,
        rxcui
      };
    }
  }
  
  try {
    const baseUrl = getRxNavBaseUrl();
    const cleanRxcui = rxcui.trim();
    
    // Construct the API URL for drug interactions
    // Using the interaction endpoint which returns interactions for a specific drug
    const apiUrl = `${baseUrl}/interaction/interaction.json?rxcui=${cleanRxcui}`;
    
    // Make the API request with appropriate timeout and headers
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WebQX-Healthcare-Platform/1.0'
      },
      // Set a reasonable timeout (10 seconds)
      signal: AbortSignal.timeout(10000)
    });
    
    // Check if the response is successful
    if (!response.ok) {
      const statusText = response.statusText || 'Unknown error';
      return {
        success: false,
        interactions: [],
        error: `API request failed with status ${response.status}: ${statusText}`,
        rxcui
      };
    }
    
    // Parse the JSON response
    const data: RxNavInteractionResponse = await response.json();
    
    // Transform the response to our standardized format
    const interactions = transformRxNavResponse(data);
    
    // Return successful result
    return {
      success: true,
      interactions,
      rxcui
    };
    
  } catch (error) {
    // Handle different types of errors
    let errorMessage = 'Unknown error occurred while checking drug interactions';
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = 'Network error: Unable to connect to RxNav API. Please check your internet connection.';
    } else if (error instanceof SyntaxError) {
      errorMessage = 'Invalid response format received from RxNav API';
    } else if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout: RxNav API did not respond within 10 seconds';
      } else {
        errorMessage = `Request failed: ${error.message}`;
      }
    }
    
    return {
      success: false,
      interactions: [],
      error: errorMessage,
      rxcui
    };
  }
}

/**
 * Default export for the main function
 */
export default checkDrugInteractions;