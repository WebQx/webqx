/**
 * @jest-environment jsdom
 */

import {
  checkDrugInteractions,
  DrugInteractionResult,
  CheckDrugInteractionsParams,
  RxNavInteractionResponse
} from '../utils/api/drugInteractions';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock AbortSignal.timeout for older environments
if (!AbortSignal.timeout) {
  (AbortSignal as any).timeout = jest.fn().mockImplementation((ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  });
}

describe('checkDrugInteractions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.RXNAV_API_BASE_URL;
  });

  describe('Input Validation', () => {
    it('should reject empty rxcui', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '' };
      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid RxCUI provided');
      expect(result.interactions).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject non-numeric rxcui', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: 'abc123' };
      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid RxCUI provided');
      expect(result.interactions).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject rxcui with special characters', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '123-456' };
      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid RxCUI provided');
      expect(result.interactions).toEqual([]);
    });

    it('should accept valid numeric rxcui', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        status: 200,
        statusText: 'OK',
      } as Partial<Response> as Response);

      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should trim whitespace from rxcui', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '  207106  ' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        status: 200,
        statusText: 'OK',
      } as Partial<Response> as Response);

      await checkDrugInteractions(params);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('rxcui=207106'),
        expect.any(Object)
      );
    });

    it('should validate otherDrugIds when provided', async () => {
      const params: CheckDrugInteractionsParams = {
        rxcui: '207106',
        otherDrugIds: ['123456', 'invalid-id']
      };

      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid drug ID provided in otherDrugIds');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('API URL Configuration', () => {
    it('should use default RxNav URL when no environment variable is set', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        status: 200,
        statusText: 'OK',
      } as Partial<Response> as Response);

      await checkDrugInteractions(params);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui=207106',
        expect.any(Object)
      );
    });

    it('should use custom API URL from environment variable', async () => {
      process.env.RXNAV_API_BASE_URL = 'https://custom-api.example.com/rxnav';
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        status: 200,
        statusText: 'OK',
      } as Partial<Response> as Response);

      await checkDrugInteractions(params);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-api.example.com/rxnav/interaction/interaction.json?rxcui=207106',
        expect.any(Object)
      );
    });
  });

  describe('Network Requests', () => {
    it('should include proper headers in the request', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        status: 200,
        statusText: 'OK',
      } as Partial<Response> as Response);

      await checkDrugInteractions(params);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'WebQX-Healthcare-Platform/1.0'
          },
          signal: expect.any(Object)
        })
      );
    });

    it('should handle network timeout', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Request timeout');
    });

    it('should handle network errors', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      const networkError = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValueOnce(networkError);

      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('HTTP Response Handling', () => {
    it('should handle successful response with no interactions', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        status: 200,
        statusText: 'OK',
      } as Partial<Response> as Response);

      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(true);
      expect(result.interactions).toEqual([]);
      expect(result.rxcui).toBe('207106');
      expect(result.error).toBeUndefined();
    });

    it('should handle HTTP error responses', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Partial<Response> as Response);

      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API request failed with status 404');
    });

    it('should handle invalid JSON response', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('Invalid JSON');
        },
        status: 200,
        statusText: 'OK',
      } as Partial<Response> as Response);

      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response format');
    });
  });

  describe('Response Transformation', () => {
    it('should transform RxNav response with interactions correctly', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      const mockApiResponse: RxNavInteractionResponse = {
        interactionTypeGroup: {
          interactionType: [
            {
              comment: 'Drug-Drug Interaction',
              interactionPair: [
                {
                  severity: 'High',
                  description: 'Warfarin may increase the risk of bleeding when combined with aspirin.',
                  interactionConcept: [
                    {
                      minConceptItem: {
                        rxcui: '207106',
                        name: 'Warfarin',
                        tty: 'IN'
                      }
                    }
                  ]
                },
                {
                  severity: 'Moderate',
                  description: 'Monitor patient for signs of bleeding.',
                  interactionConcept: [
                    {
                      minConceptItem: {
                        rxcui: '1191',
                        name: 'Aspirin',
                        tty: 'IN'
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
        status: 200,
        statusText: 'OK',
      } as Partial<Response> as Response);

      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(true);
      expect(result.interactions).toHaveLength(2);
      expect(result.interactions[0]).toEqual({
        source: 'RxNav/NIH',
        description: 'Warfarin may increase the risk of bleeding when combined with aspirin.',
        severity: 'High'
      });
      expect(result.interactions[1]).toEqual({
        source: 'RxNav/NIH',
        description: 'Monitor patient for signs of bleeding.',
        severity: 'Moderate'
      });
    });

    it('should handle malformed RxNav response gracefully', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      const malformedResponse = {
        someOtherField: 'unexpected data structure'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => malformedResponse,
        status: 200,
        statusText: 'OK',
      } as Partial<Response> as Response);

      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(true);
      expect(result.interactions).toEqual([]);
    });

    it('should provide default values for missing interaction details', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '207106' };
      
      const incompleteResponse: RxNavInteractionResponse = {
        interactionTypeGroup: {
          interactionType: [
            {
              interactionPair: [
                {
                  // Missing description and severity
                  interactionConcept: []
                }
              ]
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => incompleteResponse,
        status: 200,
        statusText: 'OK',
      } as Partial<Response> as Response);

      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(true);
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0]).toEqual({
        source: 'RxNav/NIH',
        description: 'Drug interaction detected',
        severity: 'Unknown'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long rxcui numbers', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: '12345678901234567890' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        status: 200,
        statusText: 'OK',
      } as Partial<Response> as Response);

      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('rxcui=12345678901234567890'),
        expect.any(Object)
      );
    });

    it('should preserve rxcui in error responses', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: 'invalid' };
      
      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(false);
      expect(result.rxcui).toBe('invalid');
    });

    it('should handle undefined/null parameters gracefully', async () => {
      const params: CheckDrugInteractionsParams = { rxcui: null as any };
      
      const result = await checkDrugInteractions(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid RxCUI provided');
    });
  });
});