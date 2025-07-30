/**
 * OpenMRS Integration Connector
 * 
 * Provides connectivity and data synchronization with OpenMRS systems
 * through their REST API and FHIR endpoints.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { ExternalEHRConnector } from '../services/ehrEngineCore';
import { EHRConfiguration } from '../types';
import { FHIRResource, FHIRPatient, FHIRObservation, FHIRMedicationRequest } from '../types/fhir-r4';

/**
 * OpenMRS specific configuration
 */
export interface OpenMRSConfig extends EHRConfiguration {
  /** OpenMRS REST API base URL */
  restApiUrl: string;
  /** OpenMRS FHIR module URL */
  fhirModuleUrl?: string;
  /** OpenMRS instance version */
  version?: string;
  /** Location UUID for the default location */
  defaultLocationUuid?: string;
}

/**
 * OpenMRS API response wrapper
 */
interface OpenMRSApiResponse<T = any> {
  results?: T[];
  uuid?: string;
  display?: string;
  [key: string]: any;
}

/**
 * OpenMRS person structure
 */
interface OpenMRSPerson {
  uuid: string;
  display: string;
  gender: 'M' | 'F' | 'O' | 'U';
  age?: number;
  birthdate?: string;
  birthdateEstimated?: boolean;
  dead?: boolean;
  deathDate?: string;
  preferredName?: {
    uuid: string;
    display: string;
    givenName: string;
    middleName?: string;
    familyName: string;
    prefix?: string;
    suffix?: string;
  };
  preferredAddress?: {
    uuid: string;
    display: string;
    address1?: string;
    address2?: string;
    cityVillage?: string;
    stateProvince?: string;
    country?: string;
    postalCode?: string;
  };
  attributes?: Array<{
    uuid: string;
    display: string;
    attributeType: {
      uuid: string;
      display: string;
    };
    value: string;
  }>;
}

/**
 * OpenMRS patient structure
 */
interface OpenMRSPatient {
  uuid: string;
  display: string;
  identifiers: Array<{
    uuid: string;
    display: string;
    identifier: string;
    identifierType: {
      uuid: string;
      display: string;
    };
    location?: {
      uuid: string;
      display: string;
    };
    preferred?: boolean;
  }>;
  person: OpenMRSPerson;
}

/**
 * OpenMRS encounter structure
 */
interface OpenMRSEncounter {
  uuid: string;
  display: string;
  encounterDatetime: string;
  patient: {
    uuid: string;
    display: string;
  };
  location: {
    uuid: string;
    display: string;
  };
  encounterType: {
    uuid: string;
    display: string;
  };
  encounterProviders?: Array<{
    uuid: string;
    provider: {
      uuid: string;
      display: string;
    };
    encounterRole: {
      uuid: string;
      display: string;
    };
  }>;
  obs?: Array<any>;
}

/**
 * OpenMRS observation structure
 */
interface OpenMRSObs {
  uuid: string;
  display: string;
  concept: {
    uuid: string;
    display: string;
  };
  person: {
    uuid: string;
    display: string;
  };
  obsDatetime: string;
  value?: any;
  valueCodedName?: {
    uuid: string;
    display: string;
  };
  groupMembers?: OpenMRSObs[];
  encounter?: {
    uuid: string;
    display: string;
  };
}

/**
 * OpenMRS Connector
 * 
 * Implements integration with OpenMRS electronic health record platform
 * supporting their REST API and optional FHIR module.
 */
export class OpenMRSConnector implements ExternalEHRConnector {
  systemType = 'OpenMRS';
  private config: OpenMRSConfig | null = null;
  private sessionId: string | null = null;
  private isConnected = false;

  /**
   * Connect to OpenMRS system
   */
  async connect(config: EHRConfiguration): Promise<boolean> {
    try {
      this.config = config as OpenMRSConfig;
      
      // Authenticate with OpenMRS
      const authResult = await this.authenticate();
      if (!authResult) {
        throw new Error('Authentication failed');
      }

      // Test connection with session validation
      const testResult = await this.testConnection();
      if (!testResult) {
        throw new Error('Connection test failed');
      }

      this.isConnected = true;
      this.logInfo('Connected to OpenMRS successfully', { 
        restApiUrl: this.config.restApiUrl,
        version: this.config.version 
      });

      return true;

    } catch (error) {
      this.logError('Failed to connect to OpenMRS', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from OpenMRS system
   */
  async disconnect(): Promise<void> {
    if (this.sessionId) {
      try {
        // Logout from OpenMRS
        await this.logout();
      } catch (error) {
        this.logError('Error during logout', error);
      }
      this.sessionId = null;
    }
    
    this.isConnected = false;
    this.config = null;
    
    this.logInfo('Disconnected from OpenMRS');
  }

  /**
   * Sync patient data from OpenMRS
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

      // Fetch patient observations
      const observations = await this.fetchPatientObservations(patientId);
      resources.push(...observations);

      // Fetch patient programs (for chronic care management)
      const programs = await this.fetchPatientPrograms(patientId);
      resources.push(...programs);

      // Fetch patient visits
      const visits = await this.fetchPatientVisits(patientId);
      resources.push(...visits);

      this.logInfo('Synced patient data from OpenMRS', { 
        patientId, 
        resourceCount: resources.length 
      });

      return resources;

    } catch (error) {
      this.logError('Failed to sync patient data from OpenMRS', error, { patientId });
      throw error;
    }
  }

  /**
   * Create a resource in OpenMRS
   */
  async createResource(resource: FHIRResource): Promise<FHIRResource> {
    this.validateConnection();

    try {
      // Route to appropriate OpenMRS API endpoint based on resource type
      switch (resource.resourceType) {
        case 'Patient':
          return await this.createPatient(resource as FHIRPatient);
        case 'Observation':
          return await this.createObservation(resource as FHIRObservation);
        case 'Encounter':
          return await this.createEncounter(resource);
        default:
          throw new Error(`Resource type ${resource.resourceType} not supported for creation in OpenMRS`);
      }

    } catch (error) {
      this.logError('Failed to create resource in OpenMRS', error, { 
        resourceType: resource.resourceType,
        resourceId: resource.id 
      });
      throw error;
    }
  }

  /**
   * Update a resource in OpenMRS
   */
  async updateResource(resource: FHIRResource): Promise<FHIRResource> {
    this.validateConnection();

    if (!resource.id) {
      throw new Error('Resource ID is required for update');
    }

    try {
      // Route to appropriate OpenMRS API endpoint based on resource type
      switch (resource.resourceType) {
        case 'Patient':
          return await this.updatePatient(resource as FHIRPatient);
        case 'Observation':
          return await this.updateObservation(resource as FHIRObservation);
        case 'Encounter':
          return await this.updateEncounter(resource);
        default:
          throw new Error(`Resource type ${resource.resourceType} not supported for update in OpenMRS`);
      }

    } catch (error) {
      this.logError('Failed to update resource in OpenMRS', error, { 
        resourceType: resource.resourceType,
        resourceId: resource.id 
      });
      throw error;
    }
  }

  /**
   * Delete a resource from OpenMRS
   */
  async deleteResource(resourceType: string, resourceId: string): Promise<boolean> {
    this.validateConnection();

    try {
      let url: string;
      
      switch (resourceType) {
        case 'Patient':
          url = `${this.config!.restApiUrl}/patient/${resourceId}`;
          break;
        case 'Observation':
          url = `${this.config!.restApiUrl}/obs/${resourceId}`;
          break;
        case 'Encounter':
          url = `${this.config!.restApiUrl}/encounter/${resourceId}`;
          break;
        default:
          throw new Error(`Resource type ${resourceType} not supported for deletion in OpenMRS`);
      }

      const response = await this.makeApiRequest('DELETE', url);
      
      return response.ok;

    } catch (error) {
      this.logError('Failed to delete resource from OpenMRS', error, { resourceType, resourceId });
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
      const authUrl = `${this.config.restApiUrl}/session`;
      const credentials = btoa(`${this.config.authentication.username}:${this.config.authentication.password}`);

      const response = await fetch(authUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const sessionData = await response.json();
      this.sessionId = sessionData.sessionId;

      return !!this.sessionId;

    } catch (error) {
      this.logError('OpenMRS authentication failed', error);
      return false;
    }
  }

  private async testConnection(): Promise<boolean> {
    try {
      const url = `${this.config!.restApiUrl}/session`;
      const response = await this.makeApiRequest('GET', url);
      
      return response.ok;

    } catch (error) {
      this.logError('OpenMRS connection test failed', error);
      return false;
    }
  }

  private async logout(): Promise<void> {
    try {
      const url = `${this.config!.restApiUrl}/session`;
      await this.makeApiRequest('DELETE', url);
    } catch (error) {
      this.logError('OpenMRS logout failed', error);
    }
  }

  private async fetchPatientDemographics(patientId: string): Promise<FHIRPatient | null> {
    try {
      const url = `${this.config!.restApiUrl}/patient/${patientId}?v=full`;
      const response = await this.makeApiRequest('GET', url);

      if (!response.ok) {
        return null;
      }

      const openMrsPatient = await response.json() as OpenMRSPatient;
      return this.convertOpenMRSPatientToFHIR(openMrsPatient);

    } catch (error) {
      this.logError('Failed to fetch patient demographics from OpenMRS', error, { patientId });
      return null;
    }
  }

  private async fetchPatientEncounters(patientId: string): Promise<FHIRResource[]> {
    try {
      const url = `${this.config!.restApiUrl}/encounter?patient=${patientId}&v=full`;
      const response = await this.makeApiRequest('GET', url);

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as OpenMRSApiResponse<OpenMRSEncounter>;
      const encounters = data.results || [];

      // Convert OpenMRS encounters to FHIR Encounter resources
      return encounters.map(encounter => this.convertOpenMRSEncounterToFHIR(encounter));

    } catch (error) {
      this.logError('Failed to fetch patient encounters from OpenMRS', error, { patientId });
      return [];
    }
  }

  private async fetchPatientObservations(patientId: string): Promise<FHIRObservation[]> {
    try {
      const url = `${this.config!.restApiUrl}/obs?patient=${patientId}&v=full`;
      const response = await this.makeApiRequest('GET', url);

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as OpenMRSApiResponse<OpenMRSObs>;
      const observations = data.results || [];

      // Convert OpenMRS observations to FHIR Observation resources
      return observations.map(obs => this.convertOpenMRSObsToFHIR(obs));

    } catch (error) {
      this.logError('Failed to fetch patient observations from OpenMRS', error, { patientId });
      return [];
    }
  }

  private async fetchPatientPrograms(patientId: string): Promise<FHIRResource[]> {
    try {
      const url = `${this.config!.restApiUrl}/programenrollment?patient=${patientId}&v=full`;
      const response = await this.makeApiRequest('GET', url);

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as OpenMRSApiResponse;
      const programs = data.results || [];

      // Convert OpenMRS program enrollments to FHIR CarePlan resources
      return programs.map((program: any) => this.convertOpenMRSProgramToFHIR(program, patientId));

    } catch (error) {
      this.logError('Failed to fetch patient programs from OpenMRS', error, { patientId });
      return [];
    }
  }

  private async fetchPatientVisits(patientId: string): Promise<FHIRResource[]> {
    try {
      const url = `${this.config!.restApiUrl}/visit?patient=${patientId}&v=full`;
      const response = await this.makeApiRequest('GET', url);

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as OpenMRSApiResponse;
      const visits = data.results || [];

      // Convert OpenMRS visits to FHIR Encounter resources (as visit containers)
      return visits.map((visit: any) => this.convertOpenMRSVisitToFHIR(visit));

    } catch (error) {
      this.logError('Failed to fetch patient visits from OpenMRS', error, { patientId });
      return [];
    }
  }

  private async createPatient(patient: FHIRPatient): Promise<FHIRPatient> {
    const openMrsPatient = this.convertFHIRPatientToOpenMRS(patient);
    const url = `${this.config!.restApiUrl}/patient`;
    
    const response = await this.makeApiRequest('POST', url, openMrsPatient);
    
    if (!response.ok) {
      throw new Error('Failed to create patient in OpenMRS');
    }

    const createdPatient = await response.json() as OpenMRSPatient;
    return this.convertOpenMRSPatientToFHIR(createdPatient);
  }

  private async updatePatient(patient: FHIRPatient): Promise<FHIRPatient> {
    const openMrsPatient = this.convertFHIRPatientToOpenMRS(patient);
    const url = `${this.config!.restApiUrl}/patient/${patient.id}`;
    
    const response = await this.makeApiRequest('POST', url, openMrsPatient);
    
    if (!response.ok) {
      throw new Error('Failed to update patient in OpenMRS');
    }

    const updatedPatient = await response.json() as OpenMRSPatient;
    return this.convertOpenMRSPatientToFHIR(updatedPatient);
  }

  private async createObservation(observation: FHIRObservation): Promise<FHIRObservation> {
    const openMrsObs = this.convertFHIRObservationToOpenMRS(observation);
    const url = `${this.config!.restApiUrl}/obs`;
    
    const response = await this.makeApiRequest('POST', url, openMrsObs);
    
    if (!response.ok) {
      throw new Error('Failed to create observation in OpenMRS');
    }

    const createdObs = await response.json() as OpenMRSObs;
    return this.convertOpenMRSObsToFHIR(createdObs);
  }

  private async updateObservation(observation: FHIRObservation): Promise<FHIRObservation> {
    const openMrsObs = this.convertFHIRObservationToOpenMRS(observation);
    const url = `${this.config!.restApiUrl}/obs/${observation.id}`;
    
    const response = await this.makeApiRequest('POST', url, openMrsObs);
    
    if (!response.ok) {
      throw new Error('Failed to update observation in OpenMRS');
    }

    const updatedObs = await response.json() as OpenMRSObs;
    return this.convertOpenMRSObsToFHIR(updatedObs);
  }

  private async createEncounter(encounter: FHIRResource): Promise<FHIRResource> {
    const openMrsEncounter = this.convertFHIREncounterToOpenMRS(encounter);
    const url = `${this.config!.restApiUrl}/encounter`;
    
    const response = await this.makeApiRequest('POST', url, openMrsEncounter);
    
    if (!response.ok) {
      throw new Error('Failed to create encounter in OpenMRS');
    }

    const createdEncounter = await response.json() as OpenMRSEncounter;
    return this.convertOpenMRSEncounterToFHIR(createdEncounter);
  }

  private async updateEncounter(encounter: FHIRResource): Promise<FHIRResource> {
    const openMrsEncounter = this.convertFHIREncounterToOpenMRS(encounter);
    const url = `${this.config!.restApiUrl}/encounter/${encounter.id}`;
    
    const response = await this.makeApiRequest('POST', url, openMrsEncounter);
    
    if (!response.ok) {
      throw new Error('Failed to update encounter in OpenMRS');
    }

    const updatedEncounter = await response.json() as OpenMRSEncounter;
    return this.convertOpenMRSEncounterToFHIR(updatedEncounter);
  }

  private async makeApiRequest(method: string, url: string, data?: any): Promise<Response> {
    if (!this.sessionId) {
      throw new Error('Not authenticated');
    }

    const headers: HeadersInit = {
      'Cookie': `JSESSIONID=${this.sessionId}`,
      'Content-Type': 'application/json'
    };

    const requestInit: RequestInit = {
      method,
      headers
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      requestInit.body = JSON.stringify(data);
    }

    return fetch(url, requestInit);
  }

  // ============================================================================
  // Data Conversion Methods
  // ============================================================================

  private convertOpenMRSPatientToFHIR(openMrsPatient: OpenMRSPatient): FHIRPatient {
    const person = openMrsPatient.person;
    const preferredName = person.preferredName;
    const preferredAddress = person.preferredAddress;

    const fhirPatient: FHIRPatient = {
      resourceType: 'Patient',
      id: openMrsPatient.uuid,
      identifier: openMrsPatient.identifiers.map(id => ({
        use: id.preferred ? 'usual' : 'secondary',
        type: {
          text: id.identifierType.display
        },
        system: `${this.config!.restApiUrl}/patient-identifier-type/${id.identifierType.uuid}`,
        value: id.identifier
      })),
      active: true,
      name: preferredName ? [
        {
          use: 'official',
          family: preferredName.familyName,
          given: [preferredName.givenName, preferredName.middleName].filter(Boolean),
          prefix: preferredName.prefix ? [preferredName.prefix] : undefined,
          suffix: preferredName.suffix ? [preferredName.suffix] : undefined
        }
      ] : [],
      gender: this.mapOpenMRSGenderToFHIR(person.gender),
      birthDate: person.birthdate,
      deceasedBoolean: person.dead,
      deceasedDateTime: person.deathDate,
      address: preferredAddress ? [
        {
          use: 'home',
          line: [preferredAddress.address1, preferredAddress.address2].filter(Boolean),
          city: preferredAddress.cityVillage,
          state: preferredAddress.stateProvince,
          postalCode: preferredAddress.postalCode,
          country: preferredAddress.country
        }
      ] : []
    };

    // Add person attributes as extensions
    if (person.attributes && person.attributes.length > 0) {
      fhirPatient.extension = person.attributes.map(attr => ({
        url: `${this.config!.restApiUrl}/person-attribute-type/${attr.attributeType.uuid}`,
        valueString: attr.value
      }));
    }

    return fhirPatient;
  }

  private convertFHIRPatientToOpenMRS(fhirPatient: FHIRPatient): any {
    const name = fhirPatient.name?.[0];
    const address = fhirPatient.address?.[0];
    
    return {
      person: {
        gender: this.mapFHIRGenderToOpenMRS(fhirPatient.gender),
        birthdate: fhirPatient.birthDate,
        dead: fhirPatient.deceasedBoolean || false,
        deathDate: fhirPatient.deceasedDateTime,
        names: name ? [
          {
            givenName: name.given?.[0],
            middleName: name.given?.[1],
            familyName: name.family,
            prefix: name.prefix?.[0],
            suffix: name.suffix?.[0]
          }
        ] : [],
        addresses: address ? [
          {
            address1: address.line?.[0],
            address2: address.line?.[1],
            cityVillage: address.city,
            stateProvince: address.state,
            postalCode: address.postalCode,
            country: address.country
          }
        ] : []
      },
      identifiers: fhirPatient.identifier?.map(id => ({
        identifier: id.value,
        identifierType: this.getIdentifierTypeUuid(id.type?.text || 'Medical Record Number'),
        location: this.config!.defaultLocationUuid,
        preferred: id.use === 'usual'
      })) || []
    };
  }

  private convertOpenMRSEncounterToFHIR(openMrsEncounter: OpenMRSEncounter): FHIRResource {
    return {
      resourceType: 'Encounter',
      id: openMrsEncounter.uuid,
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      type: [
        {
          text: openMrsEncounter.encounterType.display
        }
      ],
      subject: {
        reference: `Patient/${openMrsEncounter.patient.uuid}`
      },
      period: {
        start: openMrsEncounter.encounterDatetime
      },
      location: [
        {
          location: {
            display: openMrsEncounter.location.display
          }
        }
      ],
      participant: openMrsEncounter.encounterProviders?.map(provider => ({
        individual: {
          reference: `Practitioner/${provider.provider.uuid}`,
          display: provider.provider.display
        },
        type: [
          {
            text: provider.encounterRole.display
          }
        ]
      })) || []
    };
  }

  private convertFHIREncounterToOpenMRS(fhirEncounter: FHIRResource): any {
    return {
      encounterDatetime: (fhirEncounter as any).period?.start || new Date().toISOString(),
      patient: this.extractPatientId(fhirEncounter),
      encounterType: this.getDefaultEncounterTypeUuid(),
      location: this.config!.defaultLocationUuid
    };
  }

  private convertOpenMRSObsToFHIR(openMrsObs: OpenMRSObs): FHIRObservation {
    const observation: FHIRObservation = {
      resourceType: 'Observation',
      id: openMrsObs.uuid,
      status: 'final',
      code: {
        text: openMrsObs.concept.display
      },
      subject: {
        reference: `Patient/${openMrsObs.person.uuid}`
      },
      effectiveDateTime: openMrsObs.obsDatetime
    };

    // Handle different value types
    if (openMrsObs.value !== undefined && openMrsObs.value !== null) {
      if (typeof openMrsObs.value === 'string') {
        observation.valueString = openMrsObs.value;
      } else if (typeof openMrsObs.value === 'number') {
        observation.valueQuantity = {
          value: openMrsObs.value
        };
      } else if (typeof openMrsObs.value === 'boolean') {
        observation.valueBoolean = openMrsObs.value;
      } else {
        observation.valueString = String(openMrsObs.value);
      }
    }

    if (openMrsObs.valueCodedName) {
      observation.valueCodeableConcept = {
        text: openMrsObs.valueCodedName.display
      };
    }

    // Handle grouped observations
    if (openMrsObs.groupMembers && openMrsObs.groupMembers.length > 0) {
      observation.component = openMrsObs.groupMembers.map(member => ({
        code: {
          text: member.concept.display
        },
        valueString: String(member.value)
      }));
    }

    if (openMrsObs.encounter) {
      observation.encounter = {
        reference: `Encounter/${openMrsObs.encounter.uuid}`
      };
    }

    return observation;
  }

  private convertFHIRObservationToOpenMRS(observation: FHIRObservation): any {
    let value: any;
    
    if (observation.valueString) {
      value = observation.valueString;
    } else if (observation.valueQuantity) {
      value = observation.valueQuantity.value;
    } else if (observation.valueBoolean !== undefined) {
      value = observation.valueBoolean;
    } else if (observation.valueCodeableConcept) {
      value = observation.valueCodeableConcept.text;
    }

    return {
      person: this.extractPatientId(observation),
      concept: this.getConceptUuid(observation.code?.text || 'Unknown'),
      obsDatetime: observation.effectiveDateTime || new Date().toISOString(),
      value,
      encounter: observation.encounter?.reference?.replace('Encounter/', ''),
      location: this.config!.defaultLocationUuid
    };
  }

  private convertOpenMRSProgramToFHIR(program: any, patientId: string): FHIRResource {
    return {
      resourceType: 'CarePlan',
      id: program.uuid,
      status: program.dateCompleted ? 'completed' : 'active',
      intent: 'plan',
      category: [
        {
          text: program.program?.display || 'Care Program'
        }
      ],
      subject: {
        reference: `Patient/${patientId}`
      },
      period: {
        start: program.dateEnrolled,
        end: program.dateCompleted
      },
      activity: program.states?.map((state: any) => ({
        detail: {
          status: 'completed',
          description: state.state?.display
        }
      })) || []
    };
  }

  private convertOpenMRSVisitToFHIR(visit: any): FHIRResource {
    return {
      resourceType: 'Encounter',
      id: visit.uuid,
      status: visit.stopDatetime ? 'finished' : 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'IMP',
        display: 'inpatient encounter'
      },
      type: [
        {
          text: visit.visitType?.display || 'Visit'
        }
      ],
      subject: {
        reference: `Patient/${visit.patient.uuid}`
      },
      period: {
        start: visit.startDatetime,
        end: visit.stopDatetime
      },
      location: [
        {
          location: {
            display: visit.location?.display
          }
        }
      ]
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private mapOpenMRSGenderToFHIR(gender: string): 'male' | 'female' | 'other' | 'unknown' {
    switch (gender?.toUpperCase()) {
      case 'M':
        return 'male';
      case 'F':
        return 'female';
      case 'O':
        return 'other';
      default:
        return 'unknown';
    }
  }

  private mapFHIRGenderToOpenMRS(gender?: string): 'M' | 'F' | 'O' | 'U' {
    switch (gender) {
      case 'male':
        return 'M';
      case 'female':
        return 'F';
      case 'other':
        return 'O';
      default:
        return 'U';
    }
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

  private getIdentifierTypeUuid(typeName: string): string {
    // In a real implementation, you would maintain a mapping of identifier types
    // For now, return a default UUID for Medical Record Number
    return '05a29f94-c0ed-11e2-94be-8c13b969e334';
  }

  private getDefaultEncounterTypeUuid(): string {
    // In a real implementation, you would fetch this from OpenMRS or maintain a mapping
    // For now, return a common encounter type UUID
    return '61ae96f4-6afe-4351-b6f8-cd4fc383cce1';
  }

  private getConceptUuid(conceptName: string): string {
    // In a real implementation, you would maintain a mapping of concepts
    // or perform concept lookup via OpenMRS API
    // For now, return a default UUID for unknown concepts
    return '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  }

  private validateConnection(): void {
    if (!this.isConnected || !this.sessionId) {
      throw new Error('Not connected to OpenMRS. Call connect() first.');
    }
  }

  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[OpenMRS Connector] ${message}`, context || {});
  }

  private logError(message: string, error: unknown, context?: Record<string, unknown>): void {
    console.error(`[OpenMRS Connector] ${message}`, {
      error: error instanceof Error ? error.message : error,
      context: context || {}
    });
  }
}

export default OpenMRSConnector;