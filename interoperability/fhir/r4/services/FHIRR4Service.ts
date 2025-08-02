/**
 * FHIR R4 Service Implementation
 * Provides a service layer for FHIR R4 operations
 */

import { FHIRResource, FHIRBundle, FHIRSearchParameters, FHIROperationOutcome } from '../../common/types/base';
import { FHIRPatient, FHIRPatientSearchParams } from '../resources/Patient';

export interface FHIRR4Config {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
  authentication?: {
    type: 'bearer' | 'basic' | 'oauth2';
    token?: string;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

export interface FHIRResponse<T = FHIRResource> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface FHIRSearchResponse<T = FHIRResource> extends FHIRResponse<FHIRBundle> {
  data: FHIRBundle & {
    entry?: Array<{
      resource: T;
      fullUrl?: string;
    }>;
  };
}

export class FHIRR4Service {
  private config: FHIRR4Config;

  constructor(config: FHIRR4Config) {
    this.config = {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
      },
      ...config,
    };
  }

  /**
   * Create a new resource
   */
  async create<T extends FHIRResource>(resource: T): Promise<FHIRResponse<T>> {
    const url = `${this.config.baseUrl}/${resource.resourceType}`;
    return this.makeRequest<T>('POST', url, resource);
  }

  /**
   * Update an existing resource
   */
  async update<T extends FHIRResource>(resource: T): Promise<FHIRResponse<T>> {
    if (!resource.id) {
      throw new Error('Resource must have an ID for update operations');
    }
    const url = `${this.config.baseUrl}/${resource.resourceType}/${resource.id}`;
    return this.makeRequest<T>('PUT', url, resource);
  }

  /**
   * Delete a resource
   */
  async delete(resourceType: string, id: string): Promise<void> {
    const url = `${this.config.baseUrl}/${resourceType}/${id}`;
    await this.makeRequest('DELETE', url);
  }

  /**
   * Get a resource by type and ID
   */
  async getResource<T extends FHIRResource>(
    resourceType: string,
    id: string
  ): Promise<FHIRResponse<T>> {
    const url = `${this.config.baseUrl}/${resourceType}/${id}`;
    return this.makeRequest<T>('GET', url);
  }

  /**
   * Create a new resource
   */
  async create<T extends FHIRResource>(resource: T): Promise<FHIRResponse<T>> {
    const url = `${this.config.baseUrl}/${resource.resourceType}`;
    return this.makeRequest<T>('POST', url, resource);
  }

  /**
   * Update an existing resource
   */
  async update<T extends FHIRResource>(resource: T): Promise<FHIRResponse<T>> {
    if (!resource.id) {
      throw new Error('Resource must have an ID for update operations');
    }
    const url = `${this.config.baseUrl}/${resource.resourceType}/${resource.id}`;
    return this.makeRequest<T>('PUT', url, resource);
  }

  /**
   * Delete a resource
   */
  async delete(resourceType: string, id: string): Promise<void> {
    const url = `${this.config.baseUrl}/${resourceType}/${id}`;
    await this.makeRequest('DELETE', url);
  }

  /**
   * Search for resources
   */
  async searchResources<T extends FHIRResource>(
    resourceType: string,
    searchParams?: FHIRSearchParameters
  ): Promise<FHIRSearchResponse<T>> {
    const url = `${this.config.baseUrl}/${resourceType}`;
    const queryParams = this.buildQueryString(searchParams);
    const fullUrl = queryParams ? `${url}?${queryParams}` : url;
    
    return this.makeRequest<FHIRBundle>('GET', fullUrl) as Promise<FHIRSearchResponse<T>>;
  }

  /**
   * Create a new resource (alias for create)
   */
  async createResource<T extends FHIRResource>(resource: T): Promise<FHIRResponse<T>> {
    return this.create(resource);
  }

  /**
   * Update a resource
   */
  async updateResource<T extends FHIRResource>(
    resourceType: string,
    id: string,
    resource: T
  ): Promise<FHIRResponse<T>> {
    const url = `${this.config.baseUrl}/${resourceType}/${id}`;
    return this.makeRequest<T>('PUT', url, resource);
  }

  /**
   * Delete a resource
   */
  async deleteResource(resourceType: string, id: string): Promise<FHIRResponse<FHIROperationOutcome>> {
    const url = `${this.config.baseUrl}/${resourceType}/${id}`;
    return this.makeRequest<FHIROperationOutcome>('DELETE', url);
  }

  /**
   * Execute a batch/transaction bundle
   */
  async executeBatch(bundle: FHIRBundle): Promise<FHIRResponse<FHIRBundle>> {
    const url = `${this.config.baseUrl}`;
    return this.makeRequest<FHIRBundle>('POST', url, bundle);
  }

  // Patient-specific convenience methods
  async getPatient(id: string): Promise<FHIRResponse<FHIRPatient>> {
    return this.getResource<FHIRPatient>('Patient', id);
  }

  async searchPatients(searchParams?: FHIRPatientSearchParams): Promise<FHIRSearchResponse<FHIRPatient>> {
    return this.searchResources<FHIRPatient>('Patient', searchParams);
  }

  async createPatient(patient: FHIRPatient): Promise<FHIRResponse<FHIRPatient>> {
    return this.createResource(patient);
  }

  async updatePatient(id: string, patient: FHIRPatient): Promise<FHIRResponse<FHIRPatient>> {
    return this.updateResource('Patient', id, patient);
  }

  /**
   * Get server capability statement
   */
  async getCapabilityStatement(): Promise<FHIRResponse<FHIRResource>> {
    const url = `${this.config.baseUrl}/metadata`;
    return this.makeRequest<FHIRResource>('GET', url);
  }

  private async makeRequest<T>(
    method: string,
    url: string,
    body?: any
  ): Promise<FHIRResponse<T>> {
    const headers = { ...this.config.headers };
    
    // Add authentication headers
    if (this.config.authentication) {
      const auth = this.config.authentication;
      if (auth.type === 'bearer' && auth.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      } else if (auth.type === 'basic' && auth.username && auth.password) {
        const credentials = btoa(`${auth.username}:${auth.password}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }
    }

    try {
      // This is a placeholder - in a real implementation, you'd use fetch or axios
      // For now, we'll simulate the response structure
      const response = await this.simulateHttpRequest<T>(method, url, body, headers);
      
      return {
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      throw this.createFHIRError(error);
    }
  }

  private async simulateHttpRequest<T>(
    method: string,
    url: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<{ data: T; status: number; headers: Record<string, string> }> {
    // This is a simulation - replace with actual HTTP client in real implementation
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (url.includes('/Patient/')) {
          resolve({
            data: this.createMockPatient() as unknown as T,
            status: 200,
            headers: { 'Content-Type': 'application/fhir+json' },
          });
        } else {
          reject(new Error('Simulated HTTP request - not implemented'));
        }
      }, 100);
    });
  }

  private createMockPatient(): FHIRPatient {
    return {
      resourceType: 'Patient',
      id: 'example-patient',
      active: true,
      name: [
        {
          use: 'official',
          family: 'Doe',
          given: ['John'],
        },
      ],
      gender: 'male',
      birthDate: '1990-01-01',
    };
  }

  private buildQueryString(params?: Record<string, any>): string {
    if (!params) return '';
    
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, String(v)));
        } else {
          queryParams.append(key, String(value));
        }
      }
    });
    
    return queryParams.toString();
  }

  private createFHIRError(error: any): Error {
    // Convert errors to FHIR OperationOutcome format
    const message = error.message || 'Unknown FHIR operation error';
    return new Error(`FHIR Error: ${message}`);
  }
}