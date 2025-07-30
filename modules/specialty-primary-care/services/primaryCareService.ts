/**
 * Primary Care Service
 * 
 * Comprehensive service for primary care management including patient care,
 * chronic disease management, preventive care scheduling, and care coordination.
 * Integrates with EHR systems and provides specialized primary care workflows.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import {
  PrimaryCarePatient,
  PrimaryCareAppointment,
  PrimaryCareAppointmentType,
  ChronicCondition,
  PreventiveCareItem,
  CareGap,
  VisitSummary,
  PrimaryCarePlan,
  PatientCommunication,
  QualityMeasure,
  ProviderMetrics,
  PrimaryCareApiResponse,
  PatientSearchCriteria,
  PrimaryLoadingState,
  PrimaryErrorState,
  CarePriority
} from '../types';

/**
 * Primary care service configuration
 */
export interface PrimaryCareServiceConfig {
  /** Enable audit logging */
  enableAuditLogging: boolean;
  /** Default appointment duration in minutes */
  defaultAppointmentDuration: number;
  /** Chronic disease monitoring frequency */
  chronicDiseaseMonitoringFrequency: 'weekly' | 'monthly' | 'quarterly';
  /** Preventive care reminder lead time in days */
  preventiveCareReminderDays: number;
  /** Care gap alert threshold in days */
  careGapAlertThreshold: number;
  /** Auto-schedule follow-ups */
  autoScheduleFollowUps: boolean;
}

/**
 * Service event types
 */
export type PrimaryCareServiceEvent = 
  | 'patient_registered'
  | 'appointment_scheduled'
  | 'visit_completed'
  | 'care_gap_identified'
  | 'chronic_condition_updated'
  | 'preventive_care_due'
  | 'quality_metric_updated';

/**
 * Event handler type
 */
export type PrimaryCareEventHandler = (event: PrimaryCareServiceEvent, data?: unknown) => void;

/**
 * Primary Care Service
 * 
 * Main service class for managing all aspects of primary care including:
 * - Patient management and registration
 * - Appointment scheduling and management
 * - Chronic disease monitoring and management
 * - Preventive care scheduling and tracking
 * - Care gap identification and closure
 * - Quality metrics and reporting
 * - Provider performance tracking
 */
export class PrimaryCareService {
  private config: Required<PrimaryCareServiceConfig>;
  private patients: Map<string, PrimaryCarePatient> = new Map();
  private appointments: Map<string, PrimaryCareAppointment> = new Map();
  private carePlans: Map<string, PrimaryCarePlan> = new Map();
  private communications: Map<string, PatientCommunication[]> = new Map();
  private eventHandlers: Map<PrimaryCareServiceEvent, PrimaryCareEventHandler[]> = new Map();

  /**
   * Constructor
   * @param config Service configuration
   */
  constructor(config: Partial<PrimaryCareServiceConfig> = {}) {
    this.config = {
      enableAuditLogging: config.enableAuditLogging ?? true,
      defaultAppointmentDuration: config.defaultAppointmentDuration ?? 30,
      chronicDiseaseMonitoringFrequency: config.chronicDiseaseMonitoringFrequency ?? 'monthly',
      preventiveCareReminderDays: config.preventiveCareReminderDays ?? 30,
      careGapAlertThreshold: config.careGapAlertThreshold ?? 7,
      autoScheduleFollowUps: config.autoScheduleFollowUps ?? true
    };

    // Initialize event handlers
    this.initializeEventHandlers();

    this.logInfo('Primary Care Service initialized', { config: this.config });
  }

  // ============================================================================
  // Patient Management
  // ============================================================================

  /**
   * Register a new patient
   * @param patientData Patient registration data
   * @returns Promise resolving to patient profile
   */
  async registerPatient(patientData: Partial<PrimaryCarePatient>): Promise<PrimaryCareApiResponse<PrimaryCarePatient>> {
    try {
      this.logInfo('Registering new patient', { patientData: this.sanitizePatientData(patientData) });

      // Validate required fields
      if (!patientData.mrn || !patientData.demographics?.name) {
        throw new Error('MRN and patient name are required for registration');
      }

      // Check for existing patient
      const existingPatient = Array.from(this.patients.values())
        .find(p => p.mrn === patientData.mrn);
      
      if (existingPatient) {
        throw new Error(`Patient with MRN ${patientData.mrn} already exists`);
      }

      // Create patient profile
      const patient: PrimaryCarePatient = {
        patientId: this.generatePatientId(),
        mrn: patientData.mrn,
        demographics: {
          name: patientData.demographics!.name,
          dateOfBirth: patientData.demographics!.dateOfBirth || new Date(),
          gender: patientData.demographics!.gender || 'unknown',
          phoneNumber: patientData.demographics?.phoneNumber,
          email: patientData.demographics?.email,
          emergencyContact: patientData.demographics?.emergencyContact
        },
        primaryProvider: patientData.primaryProvider || {
          providerId: 'default_provider',
          name: 'Unassigned Provider',
          npi: '0000000000'
        },
        careTeam: patientData.careTeam || [],
        riskLevel: patientData.riskLevel || 'low',
        chronicConditions: patientData.chronicConditions || [],
        preventiveCareStatus: patientData.preventiveCareStatus || [],
        careGaps: []
      };

      // Perform initial risk assessment
      await this.performRiskAssessment(patient);

      // Generate preventive care recommendations
      await this.generatePreventiveCareRecommendations(patient);

      // Identify initial care gaps
      await this.identifyCareGaps(patient);

      // Store patient
      this.patients.set(patient.patientId, patient);

      // Emit event
      this.emitEvent('patient_registered', patient);

      // Log audit event
      if (this.config.enableAuditLogging) {
        this.logAuditEvent('patient_registered', patient.patientId, {
          mrn: patient.mrn,
          providerAssigned: patient.primaryProvider.providerId
        });
      }

      this.logInfo('Patient registered successfully', { 
        patientId: patient.patientId,
        mrn: patient.mrn,
        riskLevel: patient.riskLevel
      });

      return {
        success: true,
        data: patient,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during patient registration';
      this.logError('Patient registration failed', errorMessage);
      
      return {
        success: false,
        error: {
          code: 'PATIENT_REGISTRATION_ERROR',
          message: errorMessage
        }
      };
    }
  }

  /**
   * Search for patients
   * @param criteria Search criteria
   * @returns Promise resolving to patient list
   */
  async searchPatients(criteria: PatientSearchCriteria): Promise<PrimaryCareApiResponse<{
    patients: PrimaryCarePatient[];
    total: number;
    hasMore: boolean;
  }>> {
    try {
      this.logInfo('Searching patients', { criteria: this.sanitizeSearchCriteria(criteria) });

      let filteredPatients = Array.from(this.patients.values());

      // Apply search filters
      if (criteria.searchText) {
        const searchLower = criteria.searchText.toLowerCase();
        filteredPatients = filteredPatients.filter(patient =>
          patient.demographics.name.toLowerCase().includes(searchLower) ||
          patient.mrn.toLowerCase().includes(searchLower)
        );
      }

      if (criteria.mrn) {
        filteredPatients = filteredPatients.filter(patient => 
          patient.mrn === criteria.mrn
        );
      }

      if (criteria.providerId) {
        filteredPatients = filteredPatients.filter(patient => 
          patient.primaryProvider.providerId === criteria.providerId
        );
      }

      if (criteria.riskLevel) {
        filteredPatients = filteredPatients.filter(patient => 
          patient.riskLevel === criteria.riskLevel
        );
      }

      if (criteria.hasChronicConditions !== undefined) {
        filteredPatients = filteredPatients.filter(patient => 
          (patient.chronicConditions.length > 0) === criteria.hasChronicConditions
        );
      }

      if (criteria.hasCareGaps !== undefined) {
        filteredPatients = filteredPatients.filter(patient => 
          (patient.careGaps.length > 0) === criteria.hasCareGaps
        );
      }

      if (criteria.lastVisitDateRange) {
        filteredPatients = filteredPatients.filter(patient => {
          if (!patient.lastVisitDate) return false;
          return patient.lastVisitDate >= criteria.lastVisitDateRange!.startDate &&
                 patient.lastVisitDate <= criteria.lastVisitDateRange!.endDate;
        });
      }

      // Apply pagination
      const page = criteria.page || 1;
      const pageSize = criteria.pageSize || 20;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      
      const paginatedPatients = filteredPatients.slice(startIndex, endIndex);
      const hasMore = endIndex < filteredPatients.length;

      this.logInfo('Patient search completed', {
        totalFound: filteredPatients.length,
        returned: paginatedPatients.length,
        hasMore
      });

      return {
        success: true,
        data: {
          patients: paginatedPatients,
          total: filteredPatients.length,
          hasMore
        },
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during patient search';
      this.logError('Patient search failed', errorMessage);
      
      return {
        success: false,
        error: {
          code: 'PATIENT_SEARCH_ERROR',
          message: errorMessage
        }
      };
    }
  }

  /**
   * Get patient by ID
   * @param patientId Patient ID
   * @returns Promise resolving to patient profile
   */
  async getPatientById(patientId: string): Promise<PrimaryCareApiResponse<PrimaryCarePatient>> {
    try {
      const patient = this.patients.get(patientId);
      
      if (!patient) {
        throw new Error(`Patient not found: ${patientId}`);
      }

      // Refresh care gaps and preventive care status
      await this.refreshPatientData(patient);

      return {
        success: true,
        data: patient,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error retrieving patient';
      this.logError('Get patient failed', errorMessage);
      
      return {
        success: false,
        error: {
          code: 'PATIENT_RETRIEVAL_ERROR',
          message: errorMessage
        }
      };
    }
  }

  // ============================================================================
  // Appointment Management
  // ============================================================================

  /**
   * Schedule an appointment
   * @param appointmentData Appointment data
   * @returns Promise resolving to appointment details
   */
  async scheduleAppointment(appointmentData: Partial<PrimaryCareAppointment>): Promise<PrimaryCareApiResponse<PrimaryCareAppointment>> {
    try {
      this.logInfo('Scheduling appointment', { appointmentData: this.sanitizeAppointmentData(appointmentData) });

      // Validate required fields
      if (!appointmentData.patientId || !appointmentData.providerId || !appointmentData.scheduledDateTime) {
        throw new Error('Patient ID, provider ID, and scheduled date/time are required');
      }

      // Check if patient exists
      const patient = this.patients.get(appointmentData.patientId);
      if (!patient) {
        throw new Error(`Patient not found: ${appointmentData.patientId}`);
      }

      // Create appointment
      const appointment: PrimaryCareAppointment = {
        id: this.generateAppointmentId(),
        patientId: appointmentData.patientId,
        providerId: appointmentData.providerId,
        type: appointmentData.type || 'follow_up',
        scheduledDateTime: appointmentData.scheduledDateTime,
        durationMinutes: appointmentData.durationMinutes || this.config.defaultAppointmentDuration,
        status: 'scheduled',
        visitReason: appointmentData.visitReason || 'Routine visit',
        preVisitChecklist: appointmentData.preVisitChecklist || [],
        preparations: appointmentData.preparations,
        location: appointmentData.location || {
          type: 'in_person',
          details: 'Main clinic'
        }
      };

      // Generate pre-visit checklist based on appointment type
      appointment.preVisitChecklist = this.generatePreVisitChecklist(appointment, patient);

      // Store appointment
      this.appointments.set(appointment.id, appointment);

      // Update patient's next visit date
      if (!patient.nextVisitDate || appointment.scheduledDateTime < patient.nextVisitDate) {
        patient.nextVisitDate = appointment.scheduledDateTime;
      }

      // Emit event
      this.emitEvent('appointment_scheduled', appointment);

      // Log audit event
      if (this.config.enableAuditLogging) {
        this.logAuditEvent('appointment_scheduled', appointment.id, {
          patientId: appointment.patientId,
          providerId: appointment.providerId,
          type: appointment.type,
          scheduledDateTime: appointment.scheduledDateTime
        });
      }

      this.logInfo('Appointment scheduled successfully', {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        type: appointment.type,
        scheduledDateTime: appointment.scheduledDateTime
      });

      return {
        success: true,
        data: appointment,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error scheduling appointment';
      this.logError('Appointment scheduling failed', errorMessage);
      
      return {
        success: false,
        error: {
          code: 'APPOINTMENT_SCHEDULING_ERROR',
          message: errorMessage
        }
      };
    }
  }

  /**
   * Complete a visit
   * @param visitData Visit completion data
   * @returns Promise resolving to visit summary
   */
  async completeVisit(visitData: Partial<VisitSummary>): Promise<PrimaryCareApiResponse<VisitSummary>> {
    try {
      this.logInfo('Completing visit', { visitData: this.sanitizeVisitData(visitData) });

      if (!visitData.appointmentId) {
        throw new Error('Appointment ID is required to complete visit');
      }

      const appointment = this.appointments.get(visitData.appointmentId);
      if (!appointment) {
        throw new Error(`Appointment not found: ${visitData.appointmentId}`);
      }

      const patient = this.patients.get(appointment.patientId);
      if (!patient) {
        throw new Error(`Patient not found: ${appointment.patientId}`);
      }

      // Create visit summary
      const visitSummary: VisitSummary = {
        id: this.generateVisitId(),
        appointmentId: visitData.appointmentId,
        visitDate: visitData.visitDate || new Date(),
        durationMinutes: visitData.durationMinutes || appointment.durationMinutes,
        assessment: visitData.assessment || '',
        plan: visitData.plan || '',
        diagnoses: visitData.diagnoses || [],
        procedures: visitData.procedures || [],
        medications: visitData.medications || [],
        orders: visitData.orders || [],
        followUpInstructions: visitData.followUpInstructions || '',
        nextAppointmentRecommended: visitData.nextAppointmentRecommended
      };

      // Update appointment status
      appointment.status = 'completed';

      // Update patient's last visit date
      patient.lastVisitDate = visitSummary.visitDate;

      // Update chronic conditions based on visit
      await this.updateChronicConditionsFromVisit(patient, visitSummary);

      // Update care gaps
      await this.updateCareGapsFromVisit(patient, visitSummary);

      // Schedule follow-up if recommended and auto-scheduling is enabled
      if (this.config.autoScheduleFollowUps && visitSummary.nextAppointmentRecommended) {
        await this.scheduleRecommendedFollowUp(patient, visitSummary.nextAppointmentRecommended);
      }

      // Emit event
      this.emitEvent('visit_completed', visitSummary);

      // Log audit event
      if (this.config.enableAuditLogging) {
        this.logAuditEvent('visit_completed', visitSummary.id, {
          appointmentId: visitSummary.appointmentId,
          patientId: appointment.patientId,
          diagnosesCount: visitSummary.diagnoses.length,
          proceduresCount: visitSummary.procedures.length
        });
      }

      this.logInfo('Visit completed successfully', {
        visitId: visitSummary.id,
        appointmentId: visitSummary.appointmentId,
        patientId: appointment.patientId
      });

      return {
        success: true,
        data: visitSummary,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error completing visit';
      this.logError('Visit completion failed', errorMessage);
      
      return {
        success: false,
        error: {
          code: 'VISIT_COMPLETION_ERROR',
          message: errorMessage
        }
      };
    }
  }

  // ============================================================================
  // Chronic Disease Management
  // ============================================================================

  /**
   * Add chronic condition to patient
   * @param patientId Patient ID
   * @param condition Chronic condition data
   * @returns Promise resolving to updated patient
   */
  async addChronicCondition(
    patientId: string, 
    condition: Partial<ChronicCondition>
  ): Promise<PrimaryCareApiResponse<ChronicCondition>> {
    try {
      this.logInfo('Adding chronic condition', { patientId, condition: this.sanitizeConditionData(condition) });

      const patient = this.patients.get(patientId);
      if (!patient) {
        throw new Error(`Patient not found: ${patientId}`);
      }

      if (!condition.icd10Code || !condition.name) {
        throw new Error('ICD-10 code and condition name are required');
      }

      // Check for existing condition
      const existingCondition = patient.chronicConditions.find(c => c.icd10Code === condition.icd10Code);
      if (existingCondition) {
        throw new Error(`Chronic condition already exists: ${condition.name}`);
      }

      // Create chronic condition
      const chronicCondition: ChronicCondition = {
        id: this.generateConditionId(),
        icd10Code: condition.icd10Code,
        name: condition.name,
        diagnosisDate: condition.diagnosisDate || new Date(),
        status: condition.status || 'active',
        severity: condition.severity || 'moderate',
        goals: condition.goals || [],
        monitoringParameters: condition.monitoringParameters || [],
        medications: condition.medications || []
      };

      // Generate default monitoring parameters and goals
      chronicCondition.monitoringParameters = this.generateDefaultMonitoringParameters(chronicCondition);
      chronicCondition.goals = this.generateDefaultConditionGoals(chronicCondition);

      // Add to patient
      patient.chronicConditions.push(chronicCondition);

      // Update risk level
      await this.updatePatientRiskLevel(patient);

      // Identify new care gaps
      await this.identifyCareGaps(patient);

      // Emit event
      this.emitEvent('chronic_condition_updated', { patientId, condition: chronicCondition });

      // Log audit event
      if (this.config.enableAuditLogging) {
        this.logAuditEvent('chronic_condition_added', chronicCondition.id, {
          patientId,
          conditionName: chronicCondition.name,
          icd10Code: chronicCondition.icd10Code
        });
      }

      this.logInfo('Chronic condition added successfully', {
        patientId,
        conditionId: chronicCondition.id,
        conditionName: chronicCondition.name
      });

      return {
        success: true,
        data: chronicCondition,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error adding chronic condition';
      this.logError('Add chronic condition failed', errorMessage);
      
      return {
        success: false,
        error: {
          code: 'CHRONIC_CONDITION_ADD_ERROR',
          message: errorMessage
        }
      };
    }
  }

  // ============================================================================
  // Care Gap Management
  // ============================================================================

  /**
   * Identify care gaps for patient
   * @param patient Patient to analyze
   * @returns Promise resolving to identified care gaps
   */
  private async identifyCareGaps(patient: PrimaryCarePatient): Promise<CareGap[]> {
    const careGaps: CareGap[] = [];

    // Check preventive care gaps
    for (const preventiveItem of patient.preventiveCareStatus) {
      if (preventiveItem.status === 'overdue') {
        careGaps.push({
          id: this.generateCareGapId(),
          type: 'preventive_care',
          priority: preventiveItem.overdueDays! > this.config.careGapAlertThreshold ? 'urgent' : 'routine',
          description: `${preventiveItem.name} is overdue`,
          recommendedAction: `Schedule ${preventiveItem.name}`,
          daysOverdue: preventiveItem.overdueDays!
        });
      } else if (preventiveItem.status === 'due') {
        careGaps.push({
          id: this.generateCareGapId(),
          type: 'preventive_care',
          priority: 'routine',
          description: `${preventiveItem.name} is due`,
          recommendedAction: `Schedule ${preventiveItem.name}`,
          daysOverdue: 0
        });
      }
    }

    // Check chronic disease monitoring gaps
    for (const condition of patient.chronicConditions) {
      for (const parameter of condition.monitoringParameters) {
        if (parameter.nextDue && parameter.nextDue < new Date()) {
          const daysOverdue = Math.floor((new Date().getTime() - parameter.nextDue.getTime()) / (1000 * 60 * 60 * 24));
          careGaps.push({
            id: this.generateCareGapId(),
            type: 'chronic_disease_monitoring',
            priority: daysOverdue > this.config.careGapAlertThreshold ? 'urgent' : 'routine',
            description: `${parameter.name} monitoring for ${condition.name} is overdue`,
            recommendedAction: `Order ${parameter.name} test`,
            daysOverdue,
            relatedCondition: condition.name
          });
        }
      }
    }

    // Update patient's care gaps
    patient.careGaps = careGaps;

    // Emit event if gaps found
    if (careGaps.length > 0) {
      this.emitEvent('care_gap_identified', { patientId: patient.patientId, careGaps });
    }

    return careGaps;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Perform risk assessment for patient
   * @param patient Patient to assess
   */
  private async performRiskAssessment(patient: PrimaryCarePatient): Promise<void> {
    let riskScore = 0;

    // Age factor
    const age = this.calculateAge(patient.demographics.dateOfBirth);
    if (age > 65) riskScore += 2;
    else if (age > 50) riskScore += 1;

    // Chronic conditions factor
    riskScore += patient.chronicConditions.length;

    // Previous visits factor (would normally check history)
    // For now, assume based on existing conditions
    if (patient.chronicConditions.some(c => c.severity === 'severe')) {
      riskScore += 3;
    }

    // Determine risk level
    if (riskScore >= 5) {
      patient.riskLevel = 'high';
    } else if (riskScore >= 3) {
      patient.riskLevel = 'moderate';
    } else {
      patient.riskLevel = 'low';
    }
  }

  /**
   * Generate preventive care recommendations
   * @param patient Patient to generate recommendations for
   */
  private async generatePreventiveCareRecommendations(patient: PrimaryCarePatient): Promise<void> {
    const age = this.calculateAge(patient.demographics.dateOfBirth);
    const gender = patient.demographics.gender;
    const recommendations: PreventiveCareItem[] = [];

    // Age-based screenings
    if (age >= 40) {
      recommendations.push({
        id: this.generatePreventiveCareId(),
        name: 'Annual Physical Exam',
        category: 'assessment',
        ageRange: { min: 18, max: 100 },
        frequency: 'Annually',
        status: 'due',
        nextDueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        guidelines: ['USPSTF', 'AMA']
      });
    }

    if (age >= 50) {
      recommendations.push({
        id: this.generatePreventiveCareId(),
        name: 'Colonoscopy',
        category: 'screening',
        ageRange: { min: 50, max: 75 },
        frequency: 'Every 10 years',
        status: 'due',
        nextDueDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
        guidelines: ['USPSTF']
      });
    }

    // Gender-specific screenings
    if (gender === 'female' && age >= 21) {
      recommendations.push({
        id: this.generatePreventiveCareId(),
        name: 'Cervical Cancer Screening',
        category: 'screening',
        ageRange: { min: 21, max: 65 },
        gender: 'female',
        frequency: 'Every 3 years',
        status: 'due',
        nextDueDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000),
        guidelines: ['USPSTF', 'ACOG']
      });
    }

    if (gender === 'female' && age >= 40) {
      recommendations.push({
        id: this.generatePreventiveCareId(),
        name: 'Mammography',
        category: 'screening',
        ageRange: { min: 40, max: 74 },
        gender: 'female',
        frequency: 'Every 1-2 years',
        status: 'due',
        nextDueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        guidelines: ['USPSTF', 'ACS']
      });
    }

    patient.preventiveCareStatus = recommendations;
  }

  /**
   * Generate default monitoring parameters for condition
   * @param condition Chronic condition
   * @returns Monitoring parameters
   */
  private generateDefaultMonitoringParameters(condition: ChronicCondition) {
    const parameters = [];

    // Condition-specific monitoring
    switch (condition.icd10Code.substring(0, 3)) {
      case 'E11': // Type 2 diabetes
        parameters.push({
          id: this.generateParameterId(),
          name: 'HbA1c',
          type: 'lab_value' as const,
          targetRange: { min: 0, max: 7, unit: '%' },
          frequency: 'quarterly' as const,
          nextDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        });
        break;
      case 'I10': // Hypertension
        parameters.push({
          id: this.generateParameterId(),
          name: 'Blood Pressure',
          type: 'vital_sign' as const,
          targetRange: { min: 0, max: 130, unit: 'mmHg systolic' },
          frequency: 'monthly' as const,
          nextDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        break;
    }

    return parameters;
  }

  /**
   * Generate default condition goals
   * @param condition Chronic condition
   * @returns Condition goals
   */
  private generateDefaultConditionGoals(condition: ChronicCondition) {
    const goals = [];

    switch (condition.icd10Code.substring(0, 3)) {
      case 'E11': // Type 2 diabetes
        goals.push({
          id: this.generateGoalId(),
          description: 'Maintain HbA1c below 7%',
          targetValue: '<7%',
          targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          status: 'in_progress' as const
        });
        break;
      case 'I10': // Hypertension
        goals.push({
          id: this.generateGoalId(),
          description: 'Maintain blood pressure below 130/80',
          targetValue: '<130/80 mmHg',
          targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'in_progress' as const
        });
        break;
    }

    return goals;
  }

  /**
   * Calculate age from date of birth
   * @param dateOfBirth Date of birth
   * @returns Age in years
   */
  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Initialize event handlers
   */
  private initializeEventHandlers(): void {
    const events: PrimaryCareServiceEvent[] = [
      'patient_registered',
      'appointment_scheduled',
      'visit_completed',
      'care_gap_identified',
      'chronic_condition_updated',
      'preventive_care_due',
      'quality_metric_updated'
    ];

    events.forEach(event => {
      this.eventHandlers.set(event, []);
    });
  }

  /**
   * Emit event to handlers
   * @param event Event type
   * @param data Event data
   */
  private emitEvent(event: PrimaryCareServiceEvent, data?: unknown): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(event, data);
      } catch (error) {
        this.logError('Event handler error', `Error in ${event} handler: ${error}`);
      }
    });
  }

  // Placeholder methods for other functionality
  private async refreshPatientData(patient: PrimaryCarePatient): Promise<void> { /* Implementation */ }
  private async updateChronicConditionsFromVisit(patient: PrimaryCarePatient, visit: VisitSummary): Promise<void> { /* Implementation */ }
  private async updateCareGapsFromVisit(patient: PrimaryCarePatient, visit: VisitSummary): Promise<void> { /* Implementation */ }
  private async scheduleRecommendedFollowUp(patient: PrimaryCarePatient, recommendation: any): Promise<void> { /* Implementation */ }
  private async updatePatientRiskLevel(patient: PrimaryCarePatient): Promise<void> { /* Implementation */ }

  private generatePreVisitChecklist(appointment: PrimaryCareAppointment, patient: PrimaryCarePatient) {
    // Generate pre-visit checklist based on appointment type
    return [];
  }

  // ID generators
  private generatePatientId(): string { return `patient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }
  private generateAppointmentId(): string { return `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }
  private generateVisitId(): string { return `visit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }
  private generateConditionId(): string { return `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }
  private generateCareGapId(): string { return `gap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }
  private generatePreventiveCareId(): string { return `preventive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }
  private generateParameterId(): string { return `param_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }
  private generateGoalId(): string { return `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }
  private generateRequestId(): string { return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }

  // Data sanitization methods
  private sanitizePatientData(data: any): any { return { ...data, demographics: data.demographics ? { ...data.demographics, name: '[REDACTED]' } : undefined }; }
  private sanitizeSearchCriteria(criteria: any): any { return { ...criteria, searchText: criteria.searchText ? '[REDACTED]' : undefined }; }
  private sanitizeAppointmentData(data: any): any { return { ...data }; }
  private sanitizeVisitData(data: any): any { return { ...data }; }
  private sanitizeConditionData(data: any): any { return { ...data }; }

  // Logging methods
  private logInfo(message: string, context?: any): void {
    console.log(`[Primary Care Service] ${message}`, context || {});
  }

  private logError(title: string, message: string): void {
    console.error(`[Primary Care Service] ${title}:`, message);
  }

  private logAuditEvent(action: string, resourceId: string, context: any): void {
    if (this.config.enableAuditLogging) {
      console.log(`[Audit] ${action}`, { resourceId, context });
    }
  }

  // ============================================================================
  // Public Event Management
  // ============================================================================

  /**
   * Register event handler
   * @param event Event type
   * @param handler Event handler
   */
  on(event: PrimaryCareServiceEvent, handler: PrimaryCareEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Unregister event handler
   * @param event Event type
   * @param handler Event handler
   */
  off(event: PrimaryCareServiceEvent, handler: PrimaryCareEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(event, handlers);
    }
  }
}

export default PrimaryCareService;