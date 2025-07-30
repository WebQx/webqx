/**
 * HL7 Message Processing Service
 * 
 * Service for processing HL7 ORM (Order) and ORU (Observation Result) messages
 * for PACS clinical data synchronization.
 */

import { 
  HL7MessageType, 
  HL7ORMMessage, 
  HL7ORUMessage, 
  HL7MessageHeader,
  HL7PatientIdentification,
  HL7OrderControl,
  HL7ObservationRequest,
  HL7ObservationResult,
  HL7PatientVisit,
  ClinicalSyncError,
  ProcessHL7MessageRequest,
  PACSApiResponse
} from '../types/pacs-clinical-sync';

/**
 * HL7 message validation result
 */
interface HL7ValidationResult {
  /** Is valid */
  isValid: boolean;
  /** Errors */
  errors: string[];
  /** Warnings */
  warnings: string[];
}

/**
 * Parsed HL7 message
 */
interface ParsedHL7Message {
  /** Message type */
  messageType: HL7MessageType;
  /** Raw segments */
  segments: Record<string, string[]>;
  /** Parsed message data */
  messageData: HL7ORMMessage | HL7ORUMessage;
}

/**
 * HL7 processing configuration
 */
interface HL7ProcessingConfig {
  /** Enable strict validation */
  strictValidation: boolean;
  /** Supported message types */
  supportedMessageTypes: HL7MessageType[];
  /** Field separator */
  fieldSeparator: string;
  /** Component separator */
  componentSeparator: string;
  /** Repetition separator */
  repetitionSeparator: string;
  /** Escape character */
  escapeCharacter: string;
  /** Sub-component separator */
  subComponentSeparator: string;
  /** Maximum message size in bytes */
  maxMessageSizeBytes: number;
  /** Processing timeout in milliseconds */
  processingTimeoutMs: number;
}

/**
 * Default HL7 processing configuration
 */
const DEFAULT_HL7_CONFIG: HL7ProcessingConfig = {
  strictValidation: true,
  supportedMessageTypes: ['ORM', 'ORU'],
  fieldSeparator: '|',
  componentSeparator: '^',
  repetitionSeparator: '~',
  escapeCharacter: '\\',
  subComponentSeparator: '&',
  maxMessageSizeBytes: 1024 * 1024, // 1MB
  processingTimeoutMs: 30000 // 30 seconds
};

/**
 * HL7 Message Processing Service
 */
export class HL7MessageProcessor {
  private config: HL7ProcessingConfig;
  private processedMessages: Map<string, ParsedHL7Message> = new Map();

  /**
   * Constructor
   */
  constructor(config: Partial<HL7ProcessingConfig> = {}) {
    this.config = { ...DEFAULT_HL7_CONFIG, ...config };
    this.logInfo('HL7 Message Processor initialized', { config: this.config });
  }

  /**
   * Process HL7 message
   */
  async processMessage(request: ProcessHL7MessageRequest): Promise<PACSApiResponse<ParsedHL7Message>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.logInfo('Processing HL7 message', { 
        requestId, 
        messageType: request.messageType,
        messageLength: request.rawMessage.length 
      });

      // Validate message size
      if (request.rawMessage.length > this.config.maxMessageSizeBytes) {
        throw new Error(`Message size ${request.rawMessage.length} exceeds maximum allowed size ${this.config.maxMessageSizeBytes}`);
      }

      // Validate message type
      if (!this.config.supportedMessageTypes.includes(request.messageType)) {
        throw new Error(`Unsupported message type: ${request.messageType}`);
      }

      // Parse the raw HL7 message
      const parsedMessage = await this.parseHL7Message(request.rawMessage, request.messageType);

      // Validate the parsed message
      if (request.options?.validateMessage !== false) {
        const validationResult = await this.validateHL7Message(parsedMessage);
        if (!validationResult.isValid && this.config.strictValidation) {
          throw new Error(`Message validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Store message if requested
      if (request.options?.storeMessage) {
        this.processedMessages.set(requestId, parsedMessage);
      }

      const processingTimeMs = Date.now() - startTime;
      this.logInfo('HL7 message processed successfully', { 
        requestId, 
        processingTimeMs,
        messageType: parsedMessage.messageType 
      });

      return {
        success: true,
        data: parsedMessage,
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTimeMs,
          version: '1.0.0'
        }
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      this.logError('HL7 message processing failed', { 
        requestId, 
        error: errorMessage,
        processingTimeMs 
      });

      return {
        success: false,
        error: {
          code: 'HL7_PROCESSING_ERROR',
          message: errorMessage,
          details: error instanceof Error ? error.stack : undefined
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTimeMs,
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Parse raw HL7 message into structured format
   */
  private async parseHL7Message(rawMessage: string, expectedType: HL7MessageType): Promise<ParsedHL7Message> {
    // Normalize line endings
    const normalizedMessage = rawMessage.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const segments = normalizedMessage.split('\n').filter(line => line.trim());

    if (segments.length === 0) {
      throw new Error('Empty HL7 message');
    }

    // Parse segments into key-value pairs
    const parsedSegments: Record<string, string[]> = {};
    for (const segment of segments) {
      const segmentType = segment.substring(0, 3);
      if (!parsedSegments[segmentType]) {
        parsedSegments[segmentType] = [];
      }
      parsedSegments[segmentType].push(segment);
    }

    // Validate required segments
    if (!parsedSegments.MSH) {
      throw new Error('Missing required MSH (Message Header) segment');
    }

    // Parse message header to determine actual message type
    const mshSegment = parsedSegments.MSH[0];
    const mshFields = mshSegment.split(this.config.fieldSeparator);
    const messageTypeField = mshFields[8] || '';
    const actualMessageType = messageTypeField.split(this.config.componentSeparator)[0] as HL7MessageType;

    if (actualMessageType !== expectedType) {
      throw new Error(`Message type mismatch: expected ${expectedType}, got ${actualMessageType}`);
    }

    // Parse message based on type
    let messageData: HL7ORMMessage | HL7ORUMessage;
    
    if (actualMessageType === 'ORM') {
      messageData = await this.parseORMMessage(parsedSegments);
    } else if (actualMessageType === 'ORU') {
      messageData = await this.parseORUMessage(parsedSegments);
    } else {
      throw new Error(`Unsupported message type: ${actualMessageType}`);
    }

    return {
      messageType: actualMessageType,
      segments: parsedSegments,
      messageData
    };
  }

  /**
   * Parse ORM (Order) message
   */
  private async parseORMMessage(segments: Record<string, string[]>): Promise<HL7ORMMessage> {
    // Parse MSH (Message Header)
    const msh = this.parseMSHSegment(segments.MSH[0]);
    
    // Parse PID (Patient Identification)
    if (!segments.PID || segments.PID.length === 0) {
      throw new Error('Missing required PID segment in ORM message');
    }
    const pid = this.parsePIDSegment(segments.PID[0]);

    // Parse ORC (Order Control) segments
    if (!segments.ORC || segments.ORC.length === 0) {
      throw new Error('Missing required ORC segment in ORM message');
    }
    const orc = segments.ORC.map(segment => this.parseORCSegment(segment));

    // Parse OBR (Observation Request) segments
    if (!segments.OBR || segments.OBR.length === 0) {
      throw new Error('Missing required OBR segment in ORM message');
    }
    const obr = segments.OBR.map(segment => this.parseOBRSegment(segment));

    // Parse optional PV1 (Patient Visit)
    let pv1: HL7PatientVisit | undefined;
    if (segments.PV1 && segments.PV1.length > 0) {
      pv1 = this.parsePV1Segment(segments.PV1[0]);
    }

    return {
      MSH: msh,
      PID: pid,
      ORC: orc,
      OBR: obr,
      PV1: pv1
    };
  }

  /**
   * Parse ORU (Observation Result) message
   */
  private async parseORUMessage(segments: Record<string, string[]>): Promise<HL7ORUMessage> {
    // Parse MSH (Message Header)
    const msh = this.parseMSHSegment(segments.MSH[0]);
    
    // Parse PID (Patient Identification)
    if (!segments.PID || segments.PID.length === 0) {
      throw new Error('Missing required PID segment in ORU message');
    }
    const pid = this.parsePIDSegment(segments.PID[0]);

    // Parse ORC (Order Control) segments
    if (!segments.ORC || segments.ORC.length === 0) {
      throw new Error('Missing required ORC segment in ORU message');
    }
    const orc = segments.ORC.map(segment => this.parseORCSegment(segment));

    // Parse OBR (Observation Request) segments
    if (!segments.OBR || segments.OBR.length === 0) {
      throw new Error('Missing required OBR segment in ORU message');
    }
    const obr = segments.OBR.map(segment => this.parseOBRSegment(segment));

    // Parse OBX (Observation Result) segments
    if (!segments.OBX || segments.OBX.length === 0) {
      throw new Error('Missing required OBX segment in ORU message');
    }
    const obx = segments.OBX.map(segment => this.parseOBXSegment(segment));

    // Parse optional PV1 (Patient Visit)
    let pv1: HL7PatientVisit | undefined;
    if (segments.PV1 && segments.PV1.length > 0) {
      pv1 = this.parsePV1Segment(segments.PV1[0]);
    }

    return {
      MSH: msh,
      PID: pid,
      ORC: orc,
      OBR: obr,
      OBX: obx,
      PV1: pv1
    };
  }

  /**
   * Parse MSH (Message Header) segment
   */
  private parseMSHSegment(segment: string): HL7MessageHeader {
    const fields = segment.split(this.config.fieldSeparator);
    
    return {
      fieldSeparator: fields[1] || '|',
      encodingCharacters: fields[2] || '^~\\&',
      sendingApplication: fields[3] || '',
      sendingFacility: fields[4] || '',
      receivingApplication: fields[5] || '',
      receivingFacility: fields[6] || '',
      dateTimeOfMessage: this.parseHL7DateTime(fields[7] || ''),
      messageType: (fields[8] || '').split(this.config.componentSeparator)[0] as HL7MessageType,
      messageControlId: fields[10] || '',
      processingId: fields[11] || '',
      versionId: fields[12] || ''
    };
  }

  /**
   * Parse PID (Patient Identification) segment
   */
  private parsePIDSegment(segment: string): HL7PatientIdentification {
    const fields = segment.split(this.config.fieldSeparator);
    
    // Parse patient name (field 5)
    const nameComponents = (fields[5] || '').split(this.config.componentSeparator);
    
    // Parse address (field 11)
    const addressComponents = (fields[11] || '').split(this.config.componentSeparator);
    
    return {
      patientId: fields[3] || '',
      patientName: {
        familyName: nameComponents[0] || '',
        givenName: nameComponents[1] || '',
        middleName: nameComponents[2] || undefined
      },
      dateOfBirth: this.parseHL7Date(fields[7] || ''),
      sex: (fields[8] || 'U') as 'M' | 'F' | 'O' | 'U',
      race: fields[10] || undefined,
      address: addressComponents.length > 0 && addressComponents[0] ? {
        streetAddress: addressComponents[0] || '',
        city: addressComponents[2] || '',
        state: addressComponents[3] || '',
        zipCode: addressComponents[4] || '',
        country: addressComponents[5] || ''
      } : undefined,
      phoneNumbers: fields[13] ? [fields[13]] : undefined,
      patientAccountNumber: fields[18] || undefined,
      ssn: fields[19] || undefined
    };
  }

  /**
   * Parse ORC (Order Control) segment
   */
  private parseORCSegment(segment: string): HL7OrderControl {
    const fields = segment.split(this.config.fieldSeparator);
    
    // Parse ordering provider (field 12)
    const providerComponents = (fields[12] || '').split(this.config.componentSeparator);
    
    return {
      orderControlCode: (fields[1] || 'NW') as any,
      placerOrderNumber: fields[2] || '',
      fillerOrderNumber: fields[3] || undefined,
      dateTimeOfTransaction: this.parseHL7DateTime(fields[9] || ''),
      orderingProvider: providerComponents.length > 0 && providerComponents[0] ? {
        id: providerComponents[0],
        name: providerComponents[1] || '',
        npi: providerComponents[2] || undefined
      } : undefined,
      orderStatus: (fields[5] || undefined) as any
    };
  }

  /**
   * Parse OBR (Observation Request) segment
   */
  private parseOBRSegment(segment: string): HL7ObservationRequest {
    const fields = segment.split(this.config.fieldSeparator);
    
    // Parse universal service ID (field 4)
    const serviceIdComponents = (fields[4] || '').split(this.config.componentSeparator);
    
    // Parse ordering provider (field 16)
    const providerComponents = (fields[16] || '').split(this.config.componentSeparator);
    
    return {
      setId: fields[1] || '',
      placerOrderNumber: fields[2] || '',
      fillerOrderNumber: fields[3] || undefined,
      universalServiceId: {
        identifier: serviceIdComponents[0] || '',
        text: serviceIdComponents[1] || '',
        codingSystem: serviceIdComponents[2] || ''
      },
      requestedDateTime: fields[6] ? this.parseHL7DateTime(fields[6]) : undefined,
      observationDateTime: fields[7] ? this.parseHL7DateTime(fields[7]) : undefined,
      specimenSource: fields[15] || undefined,
      orderingProvider: providerComponents.length > 0 && providerComponents[0] ? {
        id: providerComponents[0],
        name: providerComponents[1] || ''
      } : undefined,
      resultStatus: (fields[25] || undefined) as any
    };
  }

  /**
   * Parse OBX (Observation Result) segment
   */
  private parseOBXSegment(segment: string): HL7ObservationResult {
    const fields = segment.split(this.config.fieldSeparator);
    
    // Parse observation identifier (field 3)
    const obsIdComponents = (fields[3] || '').split(this.config.componentSeparator);
    
    // Parse observation value based on value type
    const valueType = fields[2] || 'ST';
    let observationValue: string | number | boolean = fields[5] || '';
    
    if (valueType === 'NM') {
      observationValue = parseFloat(observationValue as string) || 0;
    } else if (valueType === 'ID' && (observationValue === 'Y' || observationValue === 'N')) {
      observationValue = observationValue === 'Y';
    }
    
    return {
      setId: fields[1] || '',
      valueType: valueType as any,
      observationId: {
        identifier: obsIdComponents[0] || '',
        text: obsIdComponents[1] || '',
        codingSystem: obsIdComponents[2] || ''
      },
      observationSubId: fields[4] || undefined,
      observationValue,
      units: fields[6] || undefined,
      referenceRange: fields[7] || undefined,
      abnormalFlags: fields[8] ? fields[8].split(this.config.repetitionSeparator) : undefined,
      probability: fields[9] ? parseFloat(fields[9]) : undefined,
      natureOfAbnormalTest: fields[10] || undefined,
      observationResultStatus: (fields[11] || 'F') as any,
      dateLastObservationNormalValues: fields[12] ? this.parseHL7Date(fields[12]) : undefined,
      userDefinedAccessChecks: fields[13] || undefined,
      dateTimeOfObservation: fields[14] ? this.parseHL7DateTime(fields[14]) : undefined
    };
  }

  /**
   * Parse PV1 (Patient Visit) segment
   */
  private parsePV1Segment(segment: string): HL7PatientVisit {
    const fields = segment.split(this.config.fieldSeparator);
    
    // Parse assigned patient location (field 3)
    const locationComponents = (fields[3] || '').split(this.config.componentSeparator);
    
    // Parse attending physician (field 7)
    const physicianComponents = (fields[7] || '').split(this.config.componentSeparator);
    
    return {
      setId: fields[1] || '',
      patientClass: (fields[2] || 'O') as any,
      assignedPatientLocation: locationComponents.length > 0 && locationComponents[0] ? {
        pointOfCare: locationComponents[0] || '',
        room: locationComponents[1] || '',
        bed: locationComponents[2] || '',
        facility: locationComponents[3] || '',
        locationStatus: locationComponents[4] || '',
        personLocationType: locationComponents[5] || '',
        building: locationComponents[6] || '',
        floor: locationComponents[7] || ''
      } : undefined,
      admissionType: (fields[4] || undefined) as any,
      attendingPhysician: physicianComponents.length > 0 && physicianComponents[0] ? {
        id: physicianComponents[0],
        name: physicianComponents[1] || ''
      } : undefined,
      visitNumber: fields[19] || undefined,
      admitDateTime: fields[44] ? this.parseHL7DateTime(fields[44]) : undefined,
      dischargeDateTime: fields[45] ? this.parseHL7DateTime(fields[45]) : undefined
    };
  }

  /**
   * Validate parsed HL7 message
   */
  private async validateHL7Message(parsedMessage: ParsedHL7Message): Promise<HL7ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate message header
      const msh = parsedMessage.messageData.MSH;
      if (!msh.sendingApplication) {
        errors.push('Missing sending application in MSH segment');
      }
      if (!msh.messageControlId) {
        errors.push('Missing message control ID in MSH segment');
      }

      // Validate patient identification
      const pid = parsedMessage.messageData.PID;
      if (!pid.patientId) {
        errors.push('Missing patient ID in PID segment');
      }
      if (!pid.patientName.familyName && !pid.patientName.givenName) {
        errors.push('Missing patient name in PID segment');
      }

      // Message type specific validation
      if (parsedMessage.messageType === 'ORM') {
        const ormMessage = parsedMessage.messageData as HL7ORMMessage;
        if (ormMessage.ORC.length === 0) {
          errors.push('ORM message must contain at least one ORC segment');
        }
        if (ormMessage.OBR.length === 0) {
          errors.push('ORM message must contain at least one OBR segment');
        }
      } else if (parsedMessage.messageType === 'ORU') {
        const oruMessage = parsedMessage.messageData as HL7ORUMessage;
        if (oruMessage.OBX.length === 0) {
          errors.push('ORU message must contain at least one OBX segment');
        }
      }

      // Additional business rule validations
      if (pid.dateOfBirth > new Date()) {
        warnings.push('Patient date of birth is in the future');
      }

      this.logInfo('HL7 message validation completed', { 
        messageType: parsedMessage.messageType,
        errorsCount: errors.length,
        warningsCount: warnings.length 
      });

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Parse HL7 date (YYYYMMDD)
   */
  private parseHL7Date(dateStr: string): Date {
    if (!dateStr || dateStr.length < 8) {
      return new Date();
    }
    
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-based
    const day = parseInt(dateStr.substring(6, 8));
    
    return new Date(year, month, day);
  }

  /**
   * Parse HL7 date/time (YYYYMMDDHHMMSS)
   */
  private parseHL7DateTime(dateTimeStr: string): Date {
    if (!dateTimeStr || dateTimeStr.length < 8) {
      return new Date();
    }
    
    const year = parseInt(dateTimeStr.substring(0, 4));
    const month = parseInt(dateTimeStr.substring(4, 6)) - 1; // Month is 0-based
    const day = parseInt(dateTimeStr.substring(6, 8));
    const hour = dateTimeStr.length >= 10 ? parseInt(dateTimeStr.substring(8, 10)) : 0;
    const minute = dateTimeStr.length >= 12 ? parseInt(dateTimeStr.substring(10, 12)) : 0;
    const second = dateTimeStr.length >= 14 ? parseInt(dateTimeStr.substring(12, 14)) : 0;
    
    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `hl7_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get processed message by request ID
   */
  getProcessedMessage(requestId: string): ParsedHL7Message | undefined {
    return this.processedMessages.get(requestId);
  }

  /**
   * Clear processed messages cache
   */
  clearProcessedMessages(): void {
    this.processedMessages.clear();
    this.logInfo('Processed messages cache cleared');
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      processedMessagesCount: this.processedMessages.size,
      supportedMessageTypes: this.config.supportedMessageTypes,
      maxMessageSizeBytes: this.config.maxMessageSizeBytes,
      processingTimeoutMs: this.config.processingTimeoutMs
    };
  }

  /**
   * Log info message
   */
  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[HL7 Message Processor] ${message}`, context || {});
  }

  /**
   * Log error message
   */
  private logError(message: string, context?: Record<string, unknown>): void {
    console.error(`[HL7 Message Processor] ${message}`, context || {});
  }
}

export default HL7MessageProcessor;