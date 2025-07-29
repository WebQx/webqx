/**
 * PACS Clinical Sync Types
 * 
 * Type definitions for PACS (Picture Archiving and Communication System) 
 * clinical data synchronization with HL7 ORM/ORU messages and openEHR tagging.
 */

// ============================================================================
// HL7 Message Types
// ============================================================================

/**
 * HL7 message types supported for PACS sync
 */
export type HL7MessageType = 'ORM' | 'ORU' | 'ADT' | 'ACK';

/**
 * HL7 ORM (Order) message structure
 */
export interface HL7ORMMessage {
  /** Message header */
  MSH: HL7MessageHeader;
  /** Patient identification */
  PID: HL7PatientIdentification;
  /** Order segments */
  ORC: HL7OrderControl[];
  /** Observation request */
  OBR: HL7ObservationRequest[];
  /** Optional patient visit */
  PV1?: HL7PatientVisit;
}

/**
 * HL7 ORU (Observation Result) message structure
 */
export interface HL7ORUMessage {
  /** Message header */
  MSH: HL7MessageHeader;
  /** Patient identification */
  PID: HL7PatientIdentification;
  /** Order segments */
  ORC: HL7OrderControl[];
  /** Observation request */
  OBR: HL7ObservationRequest[];
  /** Observation results */
  OBX: HL7ObservationResult[];
  /** Optional patient visit */
  PV1?: HL7PatientVisit;
}

/**
 * HL7 Message Header (MSH)
 */
export interface HL7MessageHeader {
  /** Field separator */
  fieldSeparator: string;
  /** Encoding characters */
  encodingCharacters: string;
  /** Sending application */
  sendingApplication: string;
  /** Sending facility */
  sendingFacility: string;
  /** Receiving application */
  receivingApplication: string;
  /** Receiving facility */
  receivingFacility: string;
  /** Date/time of message */
  dateTimeOfMessage: Date;
  /** Message type */
  messageType: HL7MessageType;
  /** Message control ID */
  messageControlId: string;
  /** Processing ID */
  processingId: string;
  /** Version ID */
  versionId: string;
}

/**
 * HL7 Patient Identification (PID)
 */
export interface HL7PatientIdentification {
  /** Patient ID */
  patientId: string;
  /** Patient name */
  patientName: {
    familyName: string;
    givenName: string;
    middleName?: string;
  };
  /** Date of birth */
  dateOfBirth: Date;
  /** Sex */
  sex: 'M' | 'F' | 'O' | 'U';
  /** Race */
  race?: string;
  /** Address */
  address?: {
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  /** Phone numbers */
  phoneNumbers?: string[];
  /** Patient account number */
  patientAccountNumber?: string;
  /** SSN */
  ssn?: string;
}

/**
 * HL7 Order Control (ORC)
 */
export interface HL7OrderControl {
  /** Order control code */
  orderControlCode: 'NW' | 'OK' | 'UA' | 'CA' | 'OC' | 'CR' | 'SC' | 'SN' | 'XO';
  /** Placer order number */
  placerOrderNumber: string;
  /** Filler order number */
  fillerOrderNumber?: string;
  /** Date/time of transaction */
  dateTimeOfTransaction: Date;
  /** Ordering provider */
  orderingProvider?: {
    id: string;
    name: string;
    npi?: string;
  };
  /** Order status */
  orderStatus?: 'A' | 'CA' | 'CM' | 'DC' | 'ER' | 'HD' | 'IP' | 'RP' | 'SC';
}

/**
 * HL7 Observation Request (OBR)
 */
export interface HL7ObservationRequest {
  /** Set ID */
  setId: string;
  /** Placer order number */
  placerOrderNumber: string;
  /** Filler order number */
  fillerOrderNumber?: string;
  /** Universal service identifier */
  universalServiceId: {
    identifier: string;
    text: string;
    codingSystem: string;
  };
  /** Requested date/time */
  requestedDateTime?: Date;
  /** Observation date/time */
  observationDateTime?: Date;
  /** Specimen source */
  specimenSource?: string;
  /** Ordering provider */
  orderingProvider?: {
    id: string;
    name: string;
  };
  /** Result status */
  resultStatus?: 'O' | 'I' | 'S' | 'A' | 'P' | 'C' | 'R' | 'F' | 'X' | 'Y' | 'Z';
}

/**
 * HL7 Observation Result (OBX)
 */
export interface HL7ObservationResult {
  /** Set ID */
  setId: string;
  /** Value type */
  valueType: 'ST' | 'NM' | 'CE' | 'DT' | 'TM' | 'TX' | 'FT' | 'SN' | 'PN' | 'TN' | 'AD' | 'ID';
  /** Observation identifier */
  observationId: {
    identifier: string;
    text: string;
    codingSystem: string;
  };
  /** Observation sub-ID */
  observationSubId?: string;
  /** Observation value */
  observationValue: string | number | boolean;
  /** Units */
  units?: string;
  /** Reference range */
  referenceRange?: string;
  /** Abnormal flags */
  abnormalFlags?: string[];
  /** Probability */
  probability?: number;
  /** Nature of abnormal test */
  natureOfAbnormalTest?: string;
  /** Observation result status */
  observationResultStatus: 'C' | 'D' | 'F' | 'I' | 'N' | 'O' | 'P' | 'R' | 'S' | 'U' | 'W' | 'X';
  /** Date last observation normal values */
  dateLastObservationNormalValues?: Date;
  /** User defined access checks */
  userDefinedAccessChecks?: string;
  /** Date/time of observation */
  dateTimeOfObservation?: Date;
}

/**
 * HL7 Patient Visit (PV1)
 */
export interface HL7PatientVisit {
  /** Set ID */
  setId: string;
  /** Patient class */
  patientClass: 'I' | 'O' | 'A' | 'E' | 'N' | 'R' | 'B' | 'P';
  /** Assigned patient location */
  assignedPatientLocation?: {
    pointOfCare: string;
    room: string;
    bed: string;
    facility: string;
    locationStatus: string;
    personLocationType: string;
    building: string;
    floor: string;
  };
  /** Admission type */
  admissionType?: 'A' | 'C' | 'E' | 'L' | 'N' | 'R' | 'U';
  /** Attending physician */
  attendingPhysician?: {
    id: string;
    name: string;
  };
  /** Visit number */
  visitNumber?: string;
  /** Admit date/time */
  admitDateTime?: Date;
  /** Discharge date/time */
  dischargeDateTime?: Date;
}

// ============================================================================
// OpenEHR Types
// ============================================================================

/**
 * OpenEHR archetype metadata
 */
export interface OpenEHRArchetype {
  /** Archetype ID */
  archetypeId: string;
  /** Archetype version */
  version: string;
  /** Concept name */
  conceptName: string;
  /** Description */
  description: string;
  /** Language */
  language: string;
  /** Author */
  author: string;
  /** Creation date */
  createdDate: Date;
  /** Revision date */
  revisionDate?: Date;
  /** Purpose */
  purpose: string;
  /** Keywords */
  keywords: string[];
  /** Specialization */
  specialization?: string;
}

/**
 * OpenEHR template
 */
export interface OpenEHRTemplate {
  /** Template ID */
  templateId: string;
  /** Template name */
  name: string;
  /** Description */
  description: string;
  /** Concept */
  concept: string;
  /** Language */
  language: string;
  /** Archetype references */
  archetypes: string[];
  /** Default language */
  defaultLanguage: string;
  /** Languages */
  languages: string[];
  /** Created by */
  createdBy: string;
  /** Creation date */
  createdDate: Date;
}

/**
 * OpenEHR composition
 */
export interface OpenEHRComposition {
  /** Composition ID */
  compositionId: string;
  /** Template ID */
  templateId: string;
  /** Language */
  language: string;
  /** Territory */
  territory: string;
  /** Category */
  category: {
    value: string;
    definingCode: {
      terminologyId: string;
      codeString: string;
    };
  };
  /** Composer */
  composer: {
    name: string;
    id?: string;
  };
  /** Context */
  context?: {
    startTime: Date;
    endTime?: Date;
    location?: string;
    healthCareFacility?: string;
    setting: {
      value: string;
      definingCode: {
        terminologyId: string;
        codeString: string;
      };
    };
  };
  /** Content */
  content: OpenEHREntry[];
}

/**
 * OpenEHR entry (base type for observations, evaluations, instructions, actions)
 */
export interface OpenEHREntry {
  /** Entry type */
  type: 'OBSERVATION' | 'EVALUATION' | 'INSTRUCTION' | 'ACTION' | 'ADMIN_ENTRY';
  /** Archetype node ID */
  archetypeNodeId: string;
  /** Name */
  name: {
    value: string;
  };
  /** Subject */
  subject: {
    externalRef: {
      id: {
        value: string;
      };
      namespace: string;
      type: string;
    };
  };
  /** Time */
  time?: Date;
  /** Data */
  data: Record<string, unknown>;
  /** Protocol */
  protocol?: Record<string, unknown>;
  /** State */
  state?: Record<string, unknown>;
}

/**
 * OpenEHR data value types
 */
export type OpenEHRDataValue = 
  | { type: 'DV_TEXT'; value: string }
  | { type: 'DV_CODED_TEXT'; value: string; definingCode: { terminologyId: string; codeString: string } }
  | { type: 'DV_QUANTITY'; magnitude: number; units: string }
  | { type: 'DV_COUNT'; magnitude: number }
  | { type: 'DV_ORDINAL'; value: number; symbol: { value: string; definingCode: { terminologyId: string; codeString: string } } }
  | { type: 'DV_BOOLEAN'; value: boolean }
  | { type: 'DV_DATE'; value: string }
  | { type: 'DV_DATE_TIME'; value: string }
  | { type: 'DV_TIME'; value: string }
  | { type: 'DV_DURATION'; value: string };

// ============================================================================
// PACS Integration Types
// ============================================================================

/**
 * PACS system configuration
 */
export interface PACSConfiguration {
  /** Configuration ID */
  id: string;
  /** System name */
  name: string;
  /** PACS vendor */
  vendor: 'GE' | 'Philips' | 'Siemens' | 'Canon' | 'Fuji' | 'Agfa' | 'Carestream' | 'Other';
  /** DICOM settings */
  dicomSettings: {
    /** Application Entity Title */
    aet: string;
    /** Host */
    host: string;
    /** Port */
    port: number;
    /** Move destination AET */
    moveDestinationAET?: string;
    /** Store SCP AET */
    storeSCPAET?: string;
  };
  /** HL7 settings */
  hl7Settings: {
    /** Host */
    host: string;
    /** Port */
    port: number;
    /** Sending application */
    sendingApplication: string;
    /** Sending facility */
    sendingFacility: string;
    /** Receiving application */
    receivingApplication: string;
    /** Receiving facility */
    receivingFacility: string;
  };
  /** OpenEHR settings */
  openEHRSettings: {
    /** Base URL */
    baseUrl: string;
    /** Username */
    username: string;
    /** Password (encrypted) */
    password: string;
    /** Default template ID */
    defaultTemplateId: string;
  };
  /** Security settings */
  security: {
    /** TLS enabled */
    tlsEnabled: boolean;
    /** Certificate path */
    certificatePath?: string;
    /** Key path */
    keyPath?: string;
    /** CA certificate path */
    caCertPath?: string;
  };
  /** Is active */
  isActive: boolean;
  /** Created date */
  createdAt: Date;
  /** Updated date */
  updatedAt: Date;
}

/**
 * Clinical sync operation
 */
export interface ClinicalSyncOperation {
  /** Operation ID */
  id: string;
  /** PACS configuration ID */
  pacsConfigId: string;
  /** Patient MRN */
  patientMrn: string;
  /** Operation type */
  type: 'order_sync' | 'result_sync' | 'full_sync' | 'real_time_sync';
  /** HL7 message type */
  hl7MessageType?: HL7MessageType;
  /** OpenEHR template ID */
  openEHRTemplateId?: string;
  /** Status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  /** Priority */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  /** Started at */
  startedAt: Date;
  /** Completed at */
  completedAt?: Date;
  /** Progress percentage */
  progressPercent: number;
  /** Messages processed */
  messagesProcessed: number;
  /** Messages total */
  messagesTotal?: number;
  /** Data synchronized */
  dataSynchronized: {
    /** Orders */
    orders: number;
    /** Results */
    results: number;
    /** Images */
    images: number;
    /** Reports */
    reports: number;
  };
  /** Errors */
  errors: ClinicalSyncError[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Clinical sync error
 */
export interface ClinicalSyncError {
  /** Error ID */
  id: string;
  /** Error type */
  type: 'hl7_parsing' | 'openehr_mapping' | 'pacs_communication' | 'data_validation' | 'security' | 'network' | 'other';
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Details */
  details?: string;
  /** Severity */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Is retryable */
  retryable: boolean;
  /** Timestamp */
  timestamp: Date;
  /** Context */
  context?: Record<string, unknown>;
}

/**
 * HL7 to OpenEHR mapping rule
 */
export interface HL7ToOpenEHRMapping {
  /** Mapping ID */
  id: string;
  /** Name */
  name: string;
  /** Description */
  description: string;
  /** Source HL7 segment */
  sourceHL7Segment: string;
  /** Source HL7 field */
  sourceHL7Field: string;
  /** Target OpenEHR archetype */
  targetOpenEHRArchetype: string;
  /** Target OpenEHR path */
  targetOpenEHRPath: string;
  /** Transformation function */
  transformation?: string;
  /** Validation rules */
  validationRules?: string[];
  /** Is active */
  isActive: boolean;
  /** Created by */
  createdBy: string;
  /** Created date */
  createdAt: Date;
  /** Updated date */
  updatedAt: Date;
}

/**
 * Clinical data sync filter
 */
export interface ClinicalSyncFilter {
  /** Patient MRNs */
  patientMrns?: string[];
  /** Date range */
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  /** Message types */
  messageTypes?: HL7MessageType[];
  /** Study types */
  studyTypes?: string[];
  /** Modalities */
  modalities?: string[];
  /** Departments */
  departments?: string[];
  /** Providers */
  providerIds?: string[];
  /** Priority */
  priority?: ('low' | 'normal' | 'high' | 'urgent')[];
  /** Status */
  status?: string[];
}

/**
 * Performance metrics for PACS sync
 */
export interface PACSPerformanceMetrics {
  /** Timestamp */
  timestamp: Date;
  /** Operation ID */
  operationId: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Queue depth */
  queueDepth: number;
  /** Throughput (messages per second) */
  throughputMps: number;
  /** Error rate percentage */
  errorRatePercent: number;
  /** Memory usage in MB */
  memoryUsageMB: number;
  /** CPU usage percentage */
  cpuUsagePercent: number;
  /** Network latency in milliseconds */
  networkLatencyMs: number;
  /** Cache hit rate percentage */
  cacheHitRatePercent: number;
}

/**
 * Audit event for PACS clinical sync
 */
export interface PACSAuditEvent {
  /** Event ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** User ID */
  userId: string;
  /** User role */
  userRole: string;
  /** Event type */
  eventType: 'message_received' | 'message_processed' | 'sync_started' | 'sync_completed' | 'error_occurred' | 'configuration_changed' | 'data_accessed';
  /** Patient MRN */
  patientMrn?: string;
  /** PACS configuration ID */
  pacsConfigId: string;
  /** HL7 message ID */
  hl7MessageId?: string;
  /** OpenEHR composition ID */
  openEHRCompositionId?: string;
  /** Event details */
  details: Record<string, unknown>;
  /** IP address */
  ipAddress: string;
  /** User agent */
  userAgent?: string;
  /** Success */
  success: boolean;
  /** Error message */
  errorMessage?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * PACS sync API response
 */
export interface PACSApiResponse<T = unknown> {
  /** Success status */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  /** Metadata */
  metadata?: {
    requestId: string;
    timestamp: Date;
    processingTimeMs: number;
    version: string;
  };
}

/**
 * Start clinical sync request
 */
export interface StartClinicalSyncRequest {
  /** PACS configuration ID */
  pacsConfigId: string;
  /** Patient MRN */
  patientMrn: string;
  /** Sync type */
  syncType: 'order_sync' | 'result_sync' | 'full_sync' | 'real_time_sync';
  /** Priority */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  /** Filters */
  filters?: ClinicalSyncFilter;
  /** Options */
  options?: {
    /** Enable parallel processing */
    enableParallelProcessing?: boolean;
    /** Batch size */
    batchSize?: number;
    /** Timeout in milliseconds */
    timeoutMs?: number;
  };
}

/**
 * HL7 message processing request
 */
export interface ProcessHL7MessageRequest {
  /** Raw HL7 message */
  rawMessage: string;
  /** Message type */
  messageType: HL7MessageType;
  /** PACS configuration ID */
  pacsConfigId: string;
  /** Processing options */
  options?: {
    /** Validate message */
    validateMessage?: boolean;
    /** Store message */
    storeMessage?: boolean;
    /** Auto-map to OpenEHR */
    autoMapToOpenEHR?: boolean;
  };
}

/**
 * OpenEHR mapping request
 */
export interface CreateOpenEHRMappingRequest {
  /** HL7 message data */
  hl7MessageData: Record<string, unknown>;
  /** Target template ID */
  templateId: string;
  /** Mapping rules */
  mappingRules?: HL7ToOpenEHRMapping[];
  /** Options */
  options?: {
    /** Validate composition */
    validateComposition?: boolean;
    /** Store composition */
    storeComposition?: boolean;
  };
}