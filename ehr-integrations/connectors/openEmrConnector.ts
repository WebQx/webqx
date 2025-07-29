/**
 * OpenEMR Integration Connector
 * 
 * Provides connectivity and data synchronization with OpenEMR systems
 * through their REST API and FHIR endpoints.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { ExternalEHRConnector } from '../services/ehrEngineCore';
import { EHRConfiguration } from '../types';
import { FHIRResource, FHIRPatient, FHIRObservation, FHIRMedicationRequest } from '../types/fhir-r4';

/**
 * OpenEMR specific configuration
 */
export interface OpenEMRConfig extends EHRConfiguration {
  /** OpenEMR API base URL */
  apiBaseUrl: string;
  /** OpenEMR FHIR endpoint URL */
  fhirBaseUrl?: string;
  /** API version */
  apiVersion?: string;
  /** Site identifier for multi-site OpenEMR installations */
  siteId?: string;
}

/**
 * OpenEMR API response wrapper
 */
interface OpenEMRApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: string[];
}

/**
 * OpenEMR patient data structure
 */
interface OpenEMRPatient {
  id: string;
  uuid: string;
  title?: string;
  fname: string;
  lname: string;
  mname?: string;
  DOB: string;
  sex: 'Male' | 'Female' | 'Other';
  race?: string;
  ethnicity?: string;
  phone_home?: string;
  phone_cell?: string;
  email?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
}

/**
 * OpenEMR Connector
 * 
 * Implements integration with OpenEMR electronic health record system
 * supporting both their REST API and FHIR R4 endpoints.
 */
export class OpenEMRConnector implements ExternalEHRConnector {
  systemType = 'OpenEMR';
  private config: OpenEMRConfig | null = null;
  private authToken: string | null = null;
  private isConnected = false;

  /**
   * Connect to OpenEMR system
   */
  async connect(config: EHRConfiguration): Promise<boolean> {
    try {
      this.config = config as OpenEMRConfig;
      
      // Authenticate with OpenEMR
      const authResult = await this.authenticate();
      if (!authResult) {
        throw new Error('Authentication failed');
      }

      // Test connection with a simple API call
      const testResult = await this.testConnection();
      if (!testResult) {
        throw new Error('Connection test failed');
      }

      this.isConnected = true;
      this.logInfo('Connected to OpenEMR successfully', { 
        baseUrl: this.config.apiBaseUrl,
        siteId: this.config.siteId 
      });

      return true;

    } catch (error) {
      this.logError('Failed to connect to OpenEMR', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from OpenEMR system
   */
  async disconnect(): Promise<void> {
    if (this.authToken) {
      // In a real implementation, you might want to revoke the token
      this.authToken = null;
    }
    
    this.isConnected = false;
    this.config = null;
    
    this.logInfo('Disconnected from OpenEMR');
  }

  /**
   * Sync patient data from OpenEMR
   */
  async syncPatientData(patientId: string): Promise<FHIRResource[]> {
    this.validateConnection();

    try {
      const resources: FHIRResource[] = [];

      // Fetch patient demographics
      const patient = await this.fetchPatientDemographics(patientId);
      if (patient) {
        resources.push(patient);
      }

      // Fetch patient encounters
      const encounters = await this.fetchPatientEncounters(patientId);
      resources.push(...encounters);

      // Fetch patient medications
      const medications = await this.fetchPatientMedications(patientId);
      resources.push(...medications);

      // Fetch patient observations/vitals
      const observations = await this.fetchPatientObservations(patientId);
      resources.push(...observations);

      // Fetch patient allergies
      const allergies = await this.fetchPatientAllergies(patientId);
      resources.push(...allergies);

      this.logInfo('Synced patient data from OpenEMR', { 
        patientId, 
        resourceCount: resources.length 
      });

      return resources;

    } catch (error) {
      this.logError('Failed to sync patient data from OpenEMR', error, { patientId });
      throw error;
    }
  }

  /**
   * Create a resource in OpenEMR
   */
  async createResource(resource: FHIRResource): Promise<FHIRResource> {
    this.validateConnection();

    try {
      // Route to appropriate OpenEMR API endpoint based on resource type
      switch (resource.resourceType) {
        case 'Patient':
          return await this.createPatient(resource as FHIRPatient);
        case 'Observation':
          return await this.createObservation(resource as FHIRObservation);
        case 'MedicationRequest':
          return await this.createMedicationRequest(resource as FHIRMedicationRequest);
        default:
          throw new Error(`Resource type ${resource.resourceType} not supported for creation in OpenEMR`);
      }

    } catch (error) {
      this.logError('Failed to create resource in OpenEMR', error, { 
        resourceType: resource.resourceType,
        resourceId: resource.id 
      });
      throw error;
    }
  }

  /**
   * Update a resource in OpenEMR
   */
  async updateResource(resource: FHIRResource): Promise<FHIRResource> {
    this.validateConnection();

    if (!resource.id) {
      throw new Error('Resource ID is required for update');
    }

    try {
      // Route to appropriate OpenEMR API endpoint based on resource type
      switch (resource.resourceType) {
        case 'Patient':
          return await this.updatePatient(resource as FHIRPatient);
        case 'Observation':
          return await this.updateObservation(resource as FHIRObservation);
        case 'MedicationRequest':
          return await this.updateMedicationRequest(resource as FHIRMedicationRequest);
        default:
          throw new Error(`Resource type ${resource.resourceType} not supported for update in OpenEMR`);
      }

    } catch (error) {
      this.logError('Failed to update resource in OpenEMR', error, { 
        resourceType: resource.resourceType,
        resourceId: resource.id 
      });
      throw error;
    }
  }

  /**
   * Delete a resource from OpenEMR
   */
  async deleteResource(resourceType: string, resourceId: string): Promise<boolean> {
    this.validateConnection();

    try {
      const url = `${this.config!.apiBaseUrl}/api/patient/${resourceId}`;
      const response = await this.makeApiRequest('DELETE', url);
      
      return response.success;

    } catch (error) {
      this.logError('Failed to delete resource from OpenEMR', error, { resourceType, resourceId });
      return false;
    }
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  private async authenticate(): Promise<boolean> {
    if (!this.config) {
      throw new Error('Configuration not set');
    }

    try {
      const authUrl = `${this.config.apiBaseUrl}/oauth2/default/token`;
      const authData = {
        grant_type: 'client_credentials',
        client_id: this.config.authentication.clientId,
        client_secret: this.config.authentication.clientSecret,
        scope: 'openemr:read openemr:write'
      };

      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(authData)
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const tokenData = await response.json();
      this.authToken = tokenData.access_token;

      return !!this.authToken;

    } catch (error) {
      this.logError('OpenEMR authentication failed', error);
      return false;
    }
  }

  private async testConnection(): Promise<boolean> {
    try {
      const url = `${this.config!.apiBaseUrl}/api/version`;
      const response = await this.makeApiRequest('GET', url);
      
      return response.success;

    } catch (error) {
      this.logError('OpenEMR connection test failed', error);
      return false;
    }
  }

  private async fetchPatientDemographics(patientId: string): Promise<FHIRPatient | null> {
    try {
      const url = `${this.config!.apiBaseUrl}/api/patient/${patientId}`;
      const response = await this.makeApiRequest('GET', url);

      if (!response.success || !response.data) {
        return null;
      }

      return this.convertOpenEMRPatientToFHIR(response.data);

    } catch (error) {
      this.logError('Failed to fetch patient demographics from OpenEMR', error, { patientId });
      return null;
    }
  }

  private async fetchPatientEncounters(patientId: string): Promise<FHIRResource[]> {
    try {
      const url = `${this.config!.apiBaseUrl}/api/patient/${patientId}/encounter`;
      const response = await this.makeApiRequest('GET', url);

      if (!response.success || !response.data) {
        return [];
      }

      // Convert OpenEMR encounters to FHIR Encounter resources
      return response.data.map((encounter: any) => this.convertOpenEMREncounterToFHIR(encounter));

    } catch (error) {
      this.logError('Failed to fetch patient encounters from OpenEMR', error, { patientId });
      return [];
    }
  }

  private async fetchPatientMedications(patientId: string): Promise<FHIRMedicationRequest[]> {
    try {
      const url = `${this.config!.apiBaseUrl}/api/patient/${patientId}/medication`;
      const response = await this.makeApiRequest('GET', url);

      if (!response.success || !response.data) {
        return [];
      }

      // Convert OpenEMR medications to FHIR MedicationRequest resources
      return response.data.map((med: any) => this.convertOpenEMRMedicationToFHIR(med, patientId));

    } catch (error) {
      this.logError('Failed to fetch patient medications from OpenEMR', error, { patientId });
      return [];
    }
  }

  private async fetchPatientObservations(patientId: string): Promise<FHIRObservation[]> {
    try {
      const url = `${this.config!.apiBaseUrl}/api/patient/${patientId}/vital`;
      const response = await this.makeApiRequest('GET', url);

      if (!response.success || !response.data) {
        return [];
      }

      // Convert OpenEMR vitals to FHIR Observation resources
      return response.data.map((vital: any) => this.convertOpenEMRVitalToFHIR(vital, patientId));

    } catch (error) {
      this.logError('Failed to fetch patient observations from OpenEMR', error, { patientId });
      return [];
    }
  }

  private async fetchPatientAllergies(patientId: string): Promise<FHIRResource[]> {
    try {
      const url = `${this.config!.apiBaseUrl}/api/patient/${patientId}/allergy`;
      const response = await this.makeApiRequest('GET', url);

      if (!response.success || !response.data) {
        return [];
      }

      // Convert OpenEMR allergies to FHIR AllergyIntolerance resources
      return response.data.map((allergy: any) => this.convertOpenEMRAllergyToFHIR(allergy, patientId));

    } catch (error) {
      this.logError('Failed to fetch patient allergies from OpenEMR', error, { patientId });
      return [];
    }
  }

  private async createPatient(patient: FHIRPatient): Promise<FHIRPatient> {
    const openEmrPatient = this.convertFHIRPatientToOpenEMR(patient);
    const url = `${this.config!.apiBaseUrl}/api/patient`;
    
    const response = await this.makeApiRequest('POST', url, openEmrPatient);
    
    if (!response.success) {
      throw new Error('Failed to create patient in OpenEMR');
    }

    return this.convertOpenEMRPatientToFHIR(response.data);
  }

  private async updatePatient(patient: FHIRPatient): Promise<FHIRPatient> {
    const openEmrPatient = this.convertFHIRPatientToOpenEMR(patient);
    const url = `${this.config!.apiBaseUrl}/api/patient/${patient.id}`;
    
    const response = await this.makeApiRequest('PUT', url, openEmrPatient);
    
    if (!response.success) {
      throw new Error('Failed to update patient in OpenEMR');
    }

    return this.convertOpenEMRPatientToFHIR(response.data);
  }

  private async createObservation(observation: FHIRObservation): Promise<FHIRObservation> {
    // OpenEMR might store observations as vitals or form data
    // This is a simplified implementation
    const url = `${this.config!.apiBaseUrl}/api/patient/${this.extractPatientId(observation)}/vital`;
    
    const openEmrVital = this.convertFHIRObservationToOpenEMR(observation);
    const response = await this.makeApiRequest('POST', url, openEmrVital);
    
    if (!response.success) {
      throw new Error('Failed to create observation in OpenEMR');
    }

    return observation; // Return original with ID if created
  }

  private async updateObservation(observation: FHIRObservation): Promise<FHIRObservation> {
    // Similar to create but with PUT
    const url = `${this.config!.apiBaseUrl}/api/patient/${this.extractPatientId(observation)}/vital/${observation.id}`;
    
    const openEmrVital = this.convertFHIRObservationToOpenEMR(observation);
    const response = await this.makeApiRequest('PUT', url, openEmrVital);
    
    if (!response.success) {
      throw new Error('Failed to update observation in OpenEMR');
    }

    return observation;
  }

  private async createMedicationRequest(medicationRequest: FHIRMedicationRequest): Promise<FHIRMedicationRequest> {
    const url = `${this.config!.apiBaseUrl}/api/patient/${this.extractPatientId(medicationRequest)}/medication`;
    
    const openEmrMed = this.convertFHIRMedicationToOpenEMR(medicationRequest);
    const response = await this.makeApiRequest('POST', url, openEmrMed);
    
    if (!response.success) {
      throw new Error('Failed to create medication request in OpenEMR');
    }

    return medicationRequest;
  }

  private async updateMedicationRequest(medicationRequest: FHIRMedicationRequest): Promise<FHIRMedicationRequest> {
    const url = `${this.config!.apiBaseUrl}/api/patient/${this.extractPatientId(medicationRequest)}/medication/${medicationRequest.id}`;
    
    const openEmrMed = this.convertFHIRMedicationToOpenEMR(medicationRequest);
    const response = await this.makeApiRequest('PUT', url, openEmrMed);
    
    if (!response.success) {
      throw new Error('Failed to update medication request in OpenEMR');
    }

    return medicationRequest;
  }

  private async makeApiRequest(method: string, url: string, data?: any): Promise<OpenEMRApiResponse> {
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.authToken}`,
      'Accept': 'application/json'
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
    }

    const requestInit: RequestInit = {
      method,
      headers
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      requestInit.body = JSON.stringify(data);
    }

    const response = await fetch(url, requestInit);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    return responseData;
  }

  // ============================================================================
  // Data Conversion Methods
  // ============================================================================

  private convertOpenEMRPatientToFHIR(openEmrPatient: OpenEMRPatient): FHIRPatient {
    const fhirPatient: FHIRPatient = {
      resourceType: 'Patient',
      id: openEmrPatient.uuid || openEmrPatient.id,
      identifier: [
        {
          use: 'usual',
          system: `${this.config!.baseUrl}/patient-id`,
          value: openEmrPatient.id
        }
      ],
      active: true,
      name: [
        {
          use: 'official',
          family: openEmrPatient.lname,
          given: [openEmrPatient.fname],
          prefix: openEmrPatient.title ? [openEmrPatient.title] : undefined
        }
      ],
      gender: this.mapOpenEMRGenderToFHIR(openEmrPatient.sex),
      birthDate: openEmrPatient.DOB,
      telecom: this.buildTelecomArray(openEmrPatient),
      address: this.buildAddressArray(openEmrPatient)
    };

    return fhirPatient;
  }

  private convertFHIRPatientToOpenEMR(fhirPatient: FHIRPatient): Partial<OpenEMRPatient> {
    const name = fhirPatient.name?.[0];
    
    return {
      fname: name?.given?.[0] || '',
      lname: name?.family || '',
      mname: name?.given?.[1],
      title: name?.prefix?.[0],
      DOB: fhirPatient.birthDate || '',
      sex: this.mapFHIRGenderToOpenEMR(fhirPatient.gender),
      phone_home: fhirPatient.telecom?.find(t => t.system === 'phone' && t.use === 'home')?.value,
      phone_cell: fhirPatient.telecom?.find(t => t.system === 'phone' && t.use === 'mobile')?.value,
      email: fhirPatient.telecom?.find(t => t.system === 'email')?.value,
      street: fhirPatient.address?.[0]?.line?.[0],
      city: fhirPatient.address?.[0]?.city,
      state: fhirPatient.address?.[0]?.state,
      postal_code: fhirPatient.address?.[0]?.postalCode,
      country_code: fhirPatient.address?.[0]?.country
    };
  }

  private convertOpenEMREncounterToFHIR(openEmrEncounter: any): FHIRResource {
    // Simplified encounter conversion
    return {
      resourceType: 'Encounter',
      id: openEmrEncounter.id || openEmrEncounter.uuid,
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      subject: {
        reference: `Patient/${openEmrEncounter.pid || openEmrEncounter.patient_id}`
      },
      period: {
        start: openEmrEncounter.date
      }
    };
  }

  private convertOpenEMRMedicationToFHIR(openEmrMed: any, patientId: string): FHIRMedicationRequest {
    return {
      resourceType: 'MedicationRequest',
      id: openEmrMed.id || openEmrMed.uuid,
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        text: openEmrMed.drug || openEmrMed.medication_name
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      authoredOn: openEmrMed.date_added || new Date().toISOString(),
      dosageInstruction: openEmrMed.dosage ? [
        {
          text: openEmrMed.dosage
        }
      ] : []
    };
  }

  private convertOpenEMRVitalToFHIR(openEmrVital: any, patientId: string): FHIRObservation {
    return {
      resourceType: 'Observation',
      id: openEmrVital.id || openEmrVital.uuid,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs'
            }
          ]
        }
      ],
      code: {
        text: openEmrVital.vital_type || 'Vital Sign'
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      effectiveDateTime: openEmrVital.date || new Date().toISOString(),
      valueString: openEmrVital.value || openEmrVital.reading
    };
  }

  private convertOpenEMRAllergyToFHIR(openEmrAllergy: any, patientId: string): FHIRResource {
    return {
      resourceType: 'AllergyIntolerance',
      id: openEmrAllergy.id || openEmrAllergy.uuid,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: 'active'
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: 'confirmed'
          }
        ]
      },
      patient: {
        reference: `Patient/${patientId}`
      },
      code: {
        text: openEmrAllergy.allergy || openEmrAllergy.allergen
      },
      reaction: openEmrAllergy.reaction ? [
        {
          manifestation: [
            {
              text: openEmrAllergy.reaction
            }
          ]
        }
      ] : []
    };
  }

  private convertFHIRObservationToOpenEMR(observation: FHIRObservation): any {
    return {
      vital_type: observation.code?.text || 'Unknown',
      value: observation.valueString || observation.valueQuantity?.value?.toString(),
      date: observation.effectiveDateTime || new Date().toISOString(),
      reading: observation.valueString || observation.valueQuantity?.value?.toString()
    };
  }

  private convertFHIRMedicationToOpenEMR(medicationRequest: FHIRMedicationRequest): any {
    return {
      drug: medicationRequest.medicationCodeableConcept?.text,
      medication_name: medicationRequest.medicationCodeableConcept?.text,
      dosage: medicationRequest.dosageInstruction?.[0]?.text,
      date_added: medicationRequest.authoredOn || new Date().toISOString()
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private mapOpenEMRGenderToFHIR(sex: string): 'male' | 'female' | 'other' | 'unknown' {
    switch (sex?.toLowerCase()) {
      case 'male':
      case 'm':
        return 'male';
      case 'female':
      case 'f':
        return 'female';
      case 'other':
      case 'o':
        return 'other';
      default:
        return 'unknown';
    }
  }

  private mapFHIRGenderToOpenEMR(gender?: string): 'Male' | 'Female' | 'Other' {
    switch (gender) {
      case 'male':
        return 'Male';
      case 'female':
        return 'Female';
      default:
        return 'Other';
    }
  }

  private buildTelecomArray(patient: OpenEMRPatient): any[] {
    const telecom: any[] = [];
    
    if (patient.phone_home) {
      telecom.push({
        system: 'phone',
        use: 'home',
        value: patient.phone_home
      });
    }
    
    if (patient.phone_cell) {
      telecom.push({
        system: 'phone',
        use: 'mobile',
        value: patient.phone_cell
      });
    }
    
    if (patient.email) {
      telecom.push({
        system: 'email',
        value: patient.email
      });
    }
    
    return telecom;
  }

  private buildAddressArray(patient: OpenEMRPatient): any[] {
    if (!patient.street && !patient.city && !patient.state) {
      return [];
    }
    
    return [
      {
        use: 'home',
        line: patient.street ? [patient.street] : [],
        city: patient.city,
        state: patient.state,
        postalCode: patient.postal_code,
        country: patient.country_code
      }
    ];
  }

  private extractPatientId(resource: FHIRResource): string {
    if ('subject' in resource && resource.subject) {
      const ref = resource.subject as any;
      if (ref.reference && ref.reference.startsWith('Patient/')) {
        return ref.reference.replace('Patient/', '');
      }
    }
    
    if ('patient' in resource && resource.patient) {
      const ref = resource.patient as any;
      if (ref.reference && ref.reference.startsWith('Patient/')) {
        return ref.reference.replace('Patient/', '');
      }
    }
    
    throw new Error('Cannot extract patient ID from resource');
  }

  private validateConnection(): void {
    if (!this.isConnected || !this.authToken) {
      throw new Error('Not connected to OpenEMR. Call connect() first.');
    }
  }

  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[OpenEMR Connector] ${message}`, context || {});
  }

  private logError(message: string, error: unknown, context?: Record<string, unknown>): void {
    console.error(`[OpenEMR Connector] ${message}`, {
      error: error instanceof Error ? error.message : error,
      context: context || {}
    });
  }
}

export default OpenEMRConnector;