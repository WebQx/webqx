/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

/**
 * Unit tests for Pharmacy Service
 * 
 * Tests cover all enhancement requirements:
 * - TypeScript type safety
 * - Error handling for network issues and invalid JSON
 * - Input validation for rxcui parameter
 * - Timeout mechanism
 * - Various scenarios including edge cases
 */

import {
  fetchMockPharmacyOptions,
  getAllMockPharmacyStores,
  PharmacyServiceError,
  PharmacyStore,
  FetchPharmacyOptions
} from '../pharmacy';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock data for testing
const mockStoresData: PharmacyStore[] = [
  {
    id: 'store-001',
    name: 'Test Pharmacy A',
    address: '123 Test St',
    phone: '(555) 123-4567',
    hours: 'Mon-Fri: 9AM-6PM',
    rxcui: ['123456', '789012'],
    services: ['prescription_filling', 'consultation'],
    rating: 4.5,
    distance: '0.5 miles'
  },
  {
    id: 'store-002',
    name: 'Test Pharmacy B',
    address: '456 Test Ave',
    phone: '(555) 234-5678',
    hours: 'Mon-Sat: 8AM-8PM',
    rxcui: ['789012', '345678'],
    services: ['prescription_filling', 'delivery'],
    rating: 4.2,
    distance: '1.0 miles'
  },
  {
    id: 'store-003',
    name: 'Test Pharmacy C',
    address: '789 Test Blvd',
    phone: '(555) 345-6789',
    hours: 'Daily: 24 hours',
    rxcui: ['111213', '141516'],
    services: ['prescription_filling', '24hr_service'],
    rating: 4.0,
    distance: '2.0 miles'
  }
];

describe('Pharmacy Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchMockPharmacyOptions', () => {
    
    describe('Input Validation', () => {
      it('should throw validation error for non-string rxcui', async () => {
        try {
          await fetchMockPharmacyOptions(123 as any);
          fail('Expected function to throw');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(PharmacyServiceError);
          expect((error as PharmacyServiceError).message).toBe('RxCUI must be a string');
          expect((error as PharmacyServiceError).code).toBe('VALIDATION_ERROR');
        }
      });

      it('should throw validation error for empty string rxcui', async () => {
        try {
          await fetchMockPharmacyOptions('');
          fail('Expected function to throw');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(PharmacyServiceError);
          expect((error as PharmacyServiceError).message).toBe('RxCUI cannot be empty or whitespace only');
          expect((error as PharmacyServiceError).code).toBe('VALIDATION_ERROR');
        }
      });

      it('should throw validation error for whitespace-only rxcui', async () => {
        try {
          await fetchMockPharmacyOptions('   ');
          fail('Expected function to throw');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(PharmacyServiceError);
          expect((error as PharmacyServiceError).message).toBe('RxCUI cannot be empty or whitespace only');
          expect((error as PharmacyServiceError).code).toBe('VALIDATION_ERROR');
        }
      });

      it('should throw validation error for non-numeric rxcui', async () => {
        try {
          await fetchMockPharmacyOptions('abc123');
          fail('Expected function to throw');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(PharmacyServiceError);
          expect((error as PharmacyServiceError).message).toBe('RxCUI must contain only numeric characters');
          expect((error as PharmacyServiceError).code).toBe('VALIDATION_ERROR');
        }
      });

      it('should accept valid numeric rxcui', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockStoresData)
        });

        await expect(fetchMockPharmacyOptions('123456')).resolves.toBeDefined();
      });

      it('should accept rxcui with leading/trailing whitespace', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockStoresData)
        });

        const result = await fetchMockPharmacyOptions('  123456  ');
        expect(result).toEqual([mockStoresData[0]]);
      });
    });

    describe('Successful Requests', () => {
      it('should return matching stores for valid rxcui', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockStoresData)
        });

        const result = await fetchMockPharmacyOptions('123456');
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockStoresData[0]);
        expect(mockFetch).toHaveBeenCalledWith('/mockStores.json', expect.any(Object));
      });

      it('should return multiple matching stores when rxcui appears in multiple stores', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockStoresData)
        });

        const result = await fetchMockPharmacyOptions('789012');
        
        expect(result).toHaveLength(2);
        expect(result).toEqual([mockStoresData[0], mockStoresData[1]]);
      });

      it('should return empty array when no stores match rxcui', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockStoresData)
        });

        const result = await fetchMockPharmacyOptions('999999');
        
        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
      });

      it('should use custom base URL when provided', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockStoresData)
        });

        const options: FetchPharmacyOptions = {
          baseUrl: 'https://api.example.com'
        };

        await fetchMockPharmacyOptions('123456', options);
        
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/mockStores.json',
          expect.any(Object)
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle 404 file not found error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        });

        try {
          await fetchMockPharmacyOptions('123456');
          fail('Expected function to throw');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(PharmacyServiceError);
          expect((error as PharmacyServiceError).code).toBe('FILE_NOT_FOUND');
          expect((error as PharmacyServiceError).message).toContain('Mock stores data file not found');
        }
      });

      it('should handle other HTTP errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        });

        try {
          await fetchMockPharmacyOptions('123456');
          fail('Expected function to throw');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(PharmacyServiceError);
          expect((error as PharmacyServiceError).code).toBe('NETWORK_ERROR');
          expect((error as PharmacyServiceError).message).toContain('HTTP Error: 500 Internal Server Error');
        }
      });

      it('should handle invalid JSON response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockRejectedValue(new SyntaxError('Invalid JSON'))
        });

        try {
          await fetchMockPharmacyOptions('123456');
          fail('Expected function to throw');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(PharmacyServiceError);
          expect((error as PharmacyServiceError).code).toBe('INVALID_JSON');
          expect((error as PharmacyServiceError).message).toContain('Invalid JSON response');
        }
      });

      it('should handle non-array JSON response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ invalid: 'data' })
        });

        try {
          await fetchMockPharmacyOptions('123456');
          fail('Expected function to throw');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(PharmacyServiceError);
          expect((error as PharmacyServiceError).code).toBe('INVALID_JSON');
          expect((error as PharmacyServiceError).message).toContain('Mock stores data must be an array');
        }
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

        try {
          await fetchMockPharmacyOptions('123456');
          fail('Expected function to throw');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(PharmacyServiceError);
          expect((error as PharmacyServiceError).code).toBe('NETWORK_ERROR');
          expect((error as PharmacyServiceError).message).toContain('Network error: Unable to connect');
        }
      });

      it('should handle malformed store objects gracefully', async () => {
        const malformedData = [
          mockStoresData[0], // Valid store
          null, // Invalid store
          { id: 'invalid', name: 'No rxcui' }, // Missing rxcui
          { id: 'invalid2', rxcui: 'not-array' }, // Invalid rxcui type
          mockStoresData[1] // Valid store
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(malformedData)
        });

        const result = await fetchMockPharmacyOptions('123456');
        
        // Should only return valid stores that match
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockStoresData[0]);
      });
    });

    describe('Timeout Mechanism', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should timeout after specified duration', async () => {
        // Mock a long-running fetch
        mockFetch.mockImplementation(() => 
          new Promise(resolve => {
            setTimeout(() => resolve({
              ok: true,
              json: () => Promise.resolve(mockStoresData)
            }), 10000);
          })
        );

        const options: FetchPharmacyOptions = { timeout: 1000 };
        const promise = fetchMockPharmacyOptions('123456', options);

        // Fast-forward time to trigger timeout
        jest.advanceTimersByTime(1000);

        try {
          await promise;
          fail('Expected function to throw');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(PharmacyServiceError);
          expect((error as PharmacyServiceError).code).toBe('TIMEOUT');
          expect((error as PharmacyServiceError).message).toContain('Request timed out after 1000ms');
        }
      });

      it('should use default timeout of 5000ms', async () => {
        mockFetch.mockImplementation(() => 
          new Promise(resolve => {
            setTimeout(() => resolve({
              ok: true,
              json: () => Promise.resolve(mockStoresData)
            }), 10000);
          })
        );

        const promise = fetchMockPharmacyOptions('123456');

        // Fast-forward to just before default timeout
        jest.advanceTimersByTime(4999);
        
        // Should not timeout yet
        expect(promise).not.toBe('resolved');

        // Now trigger timeout
        jest.advanceTimersByTime(1);

        try {
          await promise;
          fail('Expected function to throw');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(PharmacyServiceError);
          expect((error as PharmacyServiceError).code).toBe('TIMEOUT');
        }
      });

      it('should not timeout if request completes within timeout period', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockStoresData)
        });

        const options: FetchPharmacyOptions = { timeout: 5000 };
        const promise = fetchMockPharmacyOptions('123456', options);

        // Fast-forward time but not to timeout
        jest.advanceTimersByTime(1000);

        await expect(promise).resolves.toBeDefined();
      });
    });
  });

  describe('getAllMockPharmacyStores', () => {
    it('should return all pharmacy stores', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockStoresData)
      });

      const result = await getAllMockPharmacyStores();
      
      expect(result).toEqual(mockStoresData);
      expect(result).toHaveLength(3);
    });

    it('should handle errors appropriately', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      try {
        await getAllMockPharmacyStores();
        fail('Expected function to throw');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(PharmacyServiceError);
        expect((error as PharmacyServiceError).code).toBe('NETWORK_ERROR');
      }
    });

    it('should respect custom options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockStoresData)
      });

      const options: FetchPharmacyOptions = {
        baseUrl: 'https://test.com',
        timeout: 3000
      };

      await getAllMockPharmacyStores(options);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.com/mockStores.json',
        expect.any(Object)
      );
    });
  });

  describe('PharmacyServiceError', () => {
    it('should create error with correct properties', () => {
      const originalError = new Error('Original error');
      const error = new PharmacyServiceError(
        'Test error message',
        'NETWORK_ERROR',
        originalError
      );

      expect(error.name).toBe('PharmacyServiceError');
      expect((error as PharmacyServiceError).message).toBe('Test error message');
      expect((error as PharmacyServiceError).code).toBe('NETWORK_ERROR');
      expect(error.originalError).toBe(originalError);
    });

    it('should work without original error', () => {
      const error = new PharmacyServiceError(
        'Test error message',
        'VALIDATION_ERROR'
      );

      expect(error.name).toBe('PharmacyServiceError');
      expect((error as PharmacyServiceError).message).toBe('Test error message');
      expect((error as PharmacyServiceError).code).toBe('VALIDATION_ERROR');
      expect(error.originalError).toBeUndefined();
    });
  });

  describe('Type Safety', () => {
    it('should enforce PharmacyStore interface compliance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockStoresData)
      });

      const result = await fetchMockPharmacyOptions('123456');
      
      // TypeScript should enforce these properties exist
      expect(result[0].id).toBeDefined();
      expect(result[0].name).toBeDefined();
      expect(result[0].address).toBeDefined();
      expect(result[0].phone).toBeDefined();
      expect(result[0].hours).toBeDefined();
      expect(Array.isArray(result[0].rxcui)).toBe(true);
      expect(Array.isArray(result[0].services)).toBe(true);
      expect(typeof result[0].rating).toBe('number');
      expect(result[0].distance).toBeDefined();
    });
  });
});