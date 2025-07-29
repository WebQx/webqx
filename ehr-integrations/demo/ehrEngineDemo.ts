/**
 * WebQX EHR Engine - Demo Implementation
 * 
 * This demonstration script shows how to use the WebQX EHR Engine
 * for real-world healthcare integration scenarios.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { 
  createEHREngine, 
  EHREngineConfig,
  OpenEMRConnector, 
  OpenMRSConnector,
  RealTimeEventType 
} from '../index';

import { 
  FHIRPatient, 
  FHIRObservation, 
  FHIRMedicationRequest,
  FHIRAppointment 
} from '../types/fhir-r4';

/**
 * Demo configuration for different environments
 */
const demoConfigs = {
  development: {
    fhirConfig: {
      baseUrl: 'http://localhost:8080/fhir',
      timeout: 10000
    },
    realTimeConfig: {
      enableWebSocket: false, // Use polling in development
      pollingInterval: 10000
    },
    security: {
      auditLevel: 'standard' as const,
      enableEncryption: false
    }
  },
  
  production: {
    fhirConfig: {
      baseUrl: 'https://fhir.hospital.com/fhir',
      smartConfig: {
        fhirBaseUrl: 'https://fhir.hospital.com/fhir',
        clientId: 'demo-client-id',
        redirectUri: 'https://app.hospital.com/callback',
        scopes: ['patient/*.read', 'patient/*.write', 'launch']
      },
      timeout: 30000
    },
    realTimeConfig: {
      enableWebSocket: true,
      websocketUrl: 'wss://realtime.hospital.com/ehr',
      pollingInterval: 30000
    },
    externalSystems: {
      openEmr: {
        id: 'openemr-main',
        name: 'Main OpenEMR System',
        systemType: 'OpenEMR',
        baseUrl: 'https://emr.hospital.com',
        apiBaseUrl: 'https://emr.hospital.com/apis/default',
        authentication: {
          type: 'oauth2',
          clientId: 'openemr-client-id',
          clientSecret: 'openemr-client-secret'
        }
      },
      openMrs: {
        id: 'openmrs-main',
        name: 'Main OpenMRS System',
        systemType: 'OpenMRS',
        baseUrl: 'https://openmrs.hospital.com',
        restApiUrl: 'https://openmrs.hospital.com/openmrs/ws/rest/v1',
        authentication: {
          type: 'basic',
          username: 'admin',
          password: 'Admin123'
        }
      }
    },
    specialtyModules: {
      radiology: true,
      cardiology: true,
      primaryCare: true
    },
    security: {
      auditLevel: 'comprehensive' as const,
      enableEncryption: true,
      accessControl: true
    }
  }
};

/**
 * Demo EHR Integration Class
 */
class EHRIntegrationDemo {
  private ehrEngine: any;

  constructor(environment: 'development' | 'production' = 'development') {
    const config = demoConfigs[environment] as EHREngineConfig;
    this.ehrEngine = createEHREngine(config);
  }

  /**
   * Initialize the EHR engine and setup connections
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing WebQX EHR Engine...');
    
    const result = await this.ehrEngine.initialize();
    if (!result.success) {
      throw new Error(`EHR Engine initialization failed: ${result.error?.message}`);
    }
    
    console.log('✅ EHR Engine initialized successfully');
    
    // Setup external connectors
    await this.setupExternalConnectors();
    
    // Setup real-time event handlers
    this.setupRealTimeHandlers();
    
    console.log('🔗 All systems connected and ready');
  }

  /**
   * Setup external EHR system connectors
   */
  private async setupExternalConnectors(): Promise<void> {
    console.log('🔌 Setting up external EHR connectors...');
    
    // OpenEMR Connector
    const openEmrConnector = new OpenEMRConnector();
    this.ehrEngine.registerExternalConnector(openEmrConnector);
    console.log('  ✅ OpenEMR connector registered');
    
    // OpenMRS Connector
    const openMrsConnector = new OpenMRSConnector();
    this.ehrEngine.registerExternalConnector(openMrsConnector);
    console.log('  ✅ OpenMRS connector registered');
  }

  /**
   * Setup real-time event handlers
   */
  private setupRealTimeHandlers(): void {
    console.log('📡 Setting up real-time event handlers...');
    
    // Subscribe to patient-related events
    this.ehrEngine.subscribeToRealTimeUpdates(
      ['resource_created', 'resource_updated', 'patient_updated'],
      (event: any) => {
        console.log('📝 Patient event received:', {
          type: event.type,
          resourceType: event.resourceType,
          patientId: event.patientId,
          timestamp: event.timestamp
        });
      },
      { resourceType: 'Patient' }
    );

    // Subscribe to clinical events
    this.ehrEngine.subscribeToRealTimeUpdates(
      ['observation_added', 'medication_prescribed'],
      (event: any) => {
        console.log('🏥 Clinical event received:', {
          type: event.type,
          resourceType: event.resourceType,
          patientId: event.patientId,
          data: event.data
        });
        
        // Handle critical observations
        this.handleCriticalObservation(event);
      }
    );

    // Subscribe to appointment events
    this.ehrEngine.subscribeToRealTimeUpdates(
      ['appointment_booked', 'appointment_cancelled'],
      (event: any) => {
        console.log('📅 Appointment event received:', {
          type: event.type,
          resourceId: event.resourceId,
          patientId: event.patientId
        });
        
        // Send notifications
        this.sendAppointmentNotification(event);
      }
    );
    
    console.log('  ✅ Real-time event handlers configured');
  }

  /**
   * Demo: Create and manage a patient record
   */
  async demoPatientManagement(): Promise<string | undefined> {
    console.log('\n👤 === Patient Management Demo ===');
    
    // Create a new patient
    const newPatient: FHIRPatient = {
      resourceType: 'Patient',
      identifier: [
        {
          use: 'usual',
          system: 'http://hospital.com/patient-id',
          value: 'DEMO-001'
        }
      ],
      active: true,
      name: [
        {
          use: 'official',
          family: 'Doe',
          given: ['John', 'Michael'],
          prefix: ['Mr.']
        }
      ],
      gender: 'male',
      birthDate: '1980-01-15',
      telecom: [
        {
          system: 'phone',
          value: '+1-555-123-4567',
          use: 'home'
        },
        {
          system: 'email',
          value: 'john.doe@email.com'
        }
      ],
      address: [
        {
          use: 'home',
          line: ['123 Main Street', 'Apt 4B'],
          city: 'Springfield',
          state: 'IL',
          postalCode: '62701',
          country: 'US'
        }
      ]
    };

    console.log('📝 Creating new patient...');
    const createResult = await this.ehrEngine.createResource(newPatient);
    if (!createResult.success) {
      console.error('❌ Failed to create patient:', createResult.error);
      return undefined;
    }
    
    const createdPatient = createResult.data;
    console.log(`✅ Patient created with ID: ${createdPatient.id}`);

    // Update patient information
    console.log('📝 Updating patient information...');
    const updatedPatient = {
      ...createdPatient,
      telecom: [
        ...createdPatient.telecom,
        {
          system: 'phone',
          value: '+1-555-987-6543',
          use: 'mobile'
        }
      ]
    };

    const updateResult = await this.ehrEngine.updateResource(updatedPatient);
    if (updateResult.success) {
      console.log('✅ Patient updated successfully');
    }

    // Retrieve patient
    console.log('📖 Retrieving patient record...');
    const retrieveResult = await this.ehrEngine.getResource('Patient', createdPatient.id);
    if (retrieveResult.success) {
      console.log('✅ Patient retrieved:', {
        id: retrieveResult.data.id,
        name: retrieveResult.data.name?.[0],
        telecom: retrieveResult.data.telecom?.length
      });
    }

    return createdPatient.id;
  }

  /**
   * Demo: Add clinical observations
   */
  async demoClinicalObservations(patientId: string): Promise<void> {
    console.log('\n🏥 === Clinical Observations Demo ===');
    
    // Blood pressure observation
    const bloodPressureObs: FHIRObservation = {
      resourceType: 'Observation',
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
        coding: [
          {
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel with all children optional'
          }
        ],
        text: 'Blood Pressure'
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      effectiveDateTime: new Date().toISOString(),
      component: [
        {
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8480-6',
                display: 'Systolic blood pressure'
              }
            ]
          },
          valueQuantity: {
            value: 140,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]'
          }
        },
        {
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8462-4',
                display: 'Diastolic blood pressure'
              }
            ]
          },
          valueQuantity: {
            value: 90,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]'
          }
        }
      ]
    };

    console.log('🩺 Adding blood pressure observation...');
    const obsResult = await this.ehrEngine.createResource(bloodPressureObs);
    if (obsResult.success) {
      console.log(`✅ Blood pressure observation created: ${obsResult.data.id}`);
    }

    // Heart rate observation
    const heartRateObs: FHIRObservation = {
      resourceType: 'Observation',
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
        coding: [
          {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          }
        ],
        text: 'Heart Rate'
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      effectiveDateTime: new Date().toISOString(),
      valueQuantity: {
        value: 72,
        unit: 'beats/minute',
        system: 'http://unitsofmeasure.org',
        code: '/min'
      }
    };

    console.log('💓 Adding heart rate observation...');
    const heartRateResult = await this.ehrEngine.createResource(heartRateObs);
    if (heartRateResult.success) {
      console.log(`✅ Heart rate observation created: ${heartRateResult.data.id}`);
    }
  }

  /**
   * Demo: External system synchronization
   */
  async demoExternalSystemSync(patientId: string): Promise<void> {
    console.log('\n🔄 === External System Synchronization Demo ===');
    
    // Sync from OpenEMR
    console.log('📡 Syncing patient data from OpenEMR...');
    const openEmrResult = await this.ehrEngine.syncPatientFromExternal('OpenEMR', patientId);
    if (openEmrResult.success) {
      console.log(`✅ Synced ${openEmrResult.data?.length || 0} resources from OpenEMR`);
    } else {
      console.log('⚠️ OpenEMR sync failed (expected in demo):', openEmrResult.error?.message);
    }

    // Sync from OpenMRS
    console.log('📡 Syncing patient data from OpenMRS...');
    const openMrsResult = await this.ehrEngine.syncPatientFromExternal('OpenMRS', patientId);
    if (openMrsResult.success) {
      console.log(`✅ Synced ${openMrsResult.data?.length || 0} resources from OpenMRS`);
    } else {
      console.log('⚠️ OpenMRS sync failed (expected in demo):', openMrsResult.error?.message);
    }
  }

  /**
   * Demo: Real-time event simulation
   */
  async demoRealTimeEvents(patientId: string): Promise<void> {
    console.log('\n📡 === Real-Time Events Demo ===');
    
    console.log('🔄 Simulating real-time events...');
    
    // Simulate new observation event
    this.ehrEngine.realTimeService.publishEvent({
      type: 'observation_added',
      resourceType: 'Observation',
      resourceId: 'obs-demo-001',
      patientId: patientId,
      ehrSystem: 'Demo',
      timestamp: new Date(),
      data: {
        observationType: 'vital-signs',
        value: '120/80 mmHg',
        critical: false
      }
    });

    // Simulate critical observation event
    setTimeout(() => {
      this.ehrEngine.realTimeService.publishEvent({
        type: 'observation_added',
        resourceType: 'Observation',
        resourceId: 'obs-demo-002',
        patientId: patientId,
        ehrSystem: 'Demo',
        timestamp: new Date(),
        data: {
          observationType: 'vital-signs',
          value: '180/110 mmHg',
          critical: true
        }
      });
    }, 2000);

    // Simulate appointment booking
    setTimeout(() => {
      this.ehrEngine.realTimeService.publishEvent({
        type: 'appointment_booked',
        resourceType: 'Appointment',
        resourceId: 'appt-demo-001',
        patientId: patientId,
        ehrSystem: 'Demo',
        timestamp: new Date(),
        data: {
          appointmentType: 'follow-up',
          scheduledDate: '2025-02-15T10:00:00Z',
          provider: 'Dr. Smith'
        }
      });
    }, 4000);

    console.log('✅ Real-time events will be published over the next few seconds...');
  }

  /**
   * Handle critical observations
   */
  private handleCriticalObservation(event: any): void {
    if (event.data?.critical) {
      console.log('🚨 CRITICAL OBSERVATION ALERT:', {
        patientId: event.patientId,
        value: event.data.value,
        type: event.data.observationType
      });
      
      // In a real system, this would trigger:
      // - Immediate provider notifications
      // - Automatic care plan adjustments
      // - Emergency response protocols
    }
  }

  /**
   * Send appointment notifications
   */
  private sendAppointmentNotification(event: any): void {
    console.log('📧 Sending appointment notification:', {
      type: event.type,
      patientId: event.patientId,
      appointmentId: event.resourceId,
      details: event.data
    });
    
    // In a real system, this would send:
    // - Email confirmations
    // - SMS reminders
    // - Push notifications
    // - Calendar invites
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down EHR Engine...');
    await this.ehrEngine.shutdown();
    console.log('✅ EHR Engine shutdown complete');
  }

  /**
   * Get engine status
   */
  getStatus(): void {
    console.log('\n📊 === EHR Engine Status ===');
    console.log('🔗 Real-time connection:', this.ehrEngine.getRealTimeStatus());
    console.log('🧩 Specialty modules:', this.ehrEngine.getSpecialtyModules().length);
    console.log('🔌 External connectors:', this.ehrEngine.externalConnectors?.size || 0);
    console.log('📡 Active subscriptions:', this.ehrEngine.realTimeService.getSubscriptions().length);
  }
}

/**
 * Run the complete EHR integration demo
 */
async function runDemo(): Promise<void> {
  const demo = new EHRIntegrationDemo('development');
  
  try {
    // Initialize the engine
    await demo.initialize();
    
    // Run patient management demo
    const patientId = await demo.demoPatientManagement();
    
    // Add clinical observations
    if (patientId) {
      await demo.demoClinicalObservations(patientId);
      
      // Demo external system sync
      await demo.demoExternalSystemSync(patientId);
      
      // Demo real-time events
      await demo.demoRealTimeEvents(patientId);
    }
    
    // Show status
    demo.getStatus();
    
    // Wait for real-time events to complete
    console.log('\n⏳ Waiting for real-time events to complete...');
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Shutdown
    await demo.shutdown();
    
    console.log('\n🎉 Demo completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    await demo.shutdown();
    process.exit(1);
  }
}

/**
 * Export demo class and runner for external use
 */
export { EHRIntegrationDemo, runDemo };

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}