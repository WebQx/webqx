/**
 * OpenEHR Integration Service
 * 
 * Service for handling openEHR archetypes, templates, and data mapping
 * for PACS clinical data synchronization.
 */

import {
  OpenEHRArchetype,
  OpenEHRTemplate,
  OpenEHRComposition,
  OpenEHREntry,
  OpenEHRDataValue,
  HL7ToOpenEHRMapping,
  CreateOpenEHRMappingRequest,
  PACSApiResponse,
  HL7ORMMessage,
  HL7ORUMessage,
  HL7ObservationResult
} from '../types/pacs-clinical-sync';

/**
 * OpenEHR service configuration
 */
interface OpenEHRServiceConfig {
  /** Base URL for OpenEHR server */
  baseUrl: string;
  /** Username for authentication */
  username: string;
  /** Password for authentication */
  password: string;
  /** Default template ID */
  defaultTemplateId: string;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Enable caching */
  enableCaching: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Validate compositions before storing */
  validateCompositions: boolean;
}

/**
 * Default OpenEHR service configuration
 */
const DEFAULT_OPENEHR_CONFIG: OpenEHRServiceConfig = {
  baseUrl: 'http://localhost:8080/ehrbase',
  username: 'ehrbase-user',
  password: 'ehrbase-password',
  defaultTemplateId: 'PACS_Clinical_Data',
  timeoutMs: 30000,
  enableCaching: true,
  cacheTtlMs: 300000, // 5 minutes
  validateCompositions: true
};

/**
 * Cached item wrapper
 */
interface CachedItem<T> {
  data: T;
  timestamp: Date;
  ttl: number;
}

/**
 * Composition validation result
 */
interface CompositionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * OpenEHR Integration Service
 */
export class OpenEHRIntegrationService {
  private config: OpenEHRServiceConfig;
  private templateCache: Map<string, CachedItem<OpenEHRTemplate>> = new Map();
  private archetypeCache: Map<string, CachedItem<OpenEHRArchetype>> = new Map();
  private mappingRules: Map<string, HL7ToOpenEHRMapping[]> = new Map();

  /**
   * Constructor
   */
  constructor(config: Partial<OpenEHRServiceConfig> = {}) {
    this.config = { ...DEFAULT_OPENEHR_CONFIG, ...config };
    this.initializeDefaultMappingRules();
    this.logInfo('OpenEHR Integration Service initialized', { config: this.config });
  }

  /**
   * Create OpenEHR composition from HL7 message data
   */
  async createCompositionFromHL7(request: CreateOpenEHRMappingRequest): Promise<PACSApiResponse<OpenEHRComposition>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.logInfo('Creating OpenEHR composition from HL7 data', { 
        requestId,
        templateId: request.templateId,
        hasCustomMappingRules: !!request.mappingRules
      });

      // Get template
      const template = await this.getTemplate(request.templateId);
      if (!template) {
        throw new Error(`Template not found: ${request.templateId}`);
      }

      // Get mapping rules
      const mappingRules = request.mappingRules || this.getMappingRulesForTemplate(request.templateId);

      // Create composition
      const composition = await this.mapHL7DataToComposition(
        request.hl7MessageData,
        template,
        mappingRules
      );

      // Validate composition if requested
      if (request.options?.validateComposition !== false) {
        const validationResult = await this.validateComposition(composition);
        if (!validationResult.isValid) {
          throw new Error(`Composition validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Store composition if requested
      if (request.options?.storeComposition) {
        await this.storeComposition(composition);
      }

      const processingTimeMs = Date.now() - startTime;
      this.logInfo('OpenEHR composition created successfully', { 
        requestId,
        compositionId: composition.compositionId,
        processingTimeMs
      });

      return {
        success: true,
        data: composition,
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
      
      this.logError('OpenEHR composition creation failed', { 
        requestId,
        error: errorMessage,
        processingTimeMs
      });

      return {
        success: false,
        error: {
          code: 'OPENEHR_MAPPING_ERROR',
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
   * Get OpenEHR template by ID
   */
  async getTemplate(templateId: string): Promise<OpenEHRTemplate | null> {
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.templateCache.get(templateId);
      if (cached && this.isCacheValid(cached)) {
        return cached.data;
      }
    }

    try {
      // For demo purposes, return a mock template
      // In a real implementation, this would fetch from the OpenEHR server
      const template: OpenEHRTemplate = {
        templateId,
        name: `PACS Clinical Data Template - ${templateId}`,
        description: 'Template for PACS clinical data synchronization',
        concept: 'PACS Clinical Data',
        language: 'en',
        archetypes: [
          'openEHR-EHR-COMPOSITION.clinical_report.v1',
          'openEHR-EHR-OBSERVATION.imaging_result.v1',
          'openEHR-EHR-OBSERVATION.laboratory_test_result.v1'
        ],
        defaultLanguage: 'en',
        languages: ['en', 'es', 'fr'],
        createdBy: 'PACS Sync System',
        createdDate: new Date()
      };

      // Cache the template
      if (this.config.enableCaching) {
        this.templateCache.set(templateId, {
          data: template,
          timestamp: new Date(),
          ttl: this.config.cacheTtlMs
        });
      }

      return template;

    } catch (error) {
      this.logError('Failed to get OpenEHR template', { templateId, error });
      return null;
    }
  }

  /**
   * Get OpenEHR archetype by ID
   */
  async getArchetype(archetypeId: string): Promise<OpenEHRArchetype | null> {
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.archetypeCache.get(archetypeId);
      if (cached && this.isCacheValid(cached)) {
        return cached.data;
      }
    }

    try {
      // For demo purposes, return a mock archetype
      // In a real implementation, this would fetch from the OpenEHR server
      const archetype: OpenEHRArchetype = {
        archetypeId,
        version: '1.0.0',
        conceptName: this.getArchetypeConceptName(archetypeId),
        description: `Archetype for ${archetypeId}`,
        language: 'en',
        author: 'PACS Sync System',
        createdDate: new Date(),
        purpose: 'Clinical data representation for PACS synchronization',
        keywords: ['PACS', 'imaging', 'clinical', 'sync'],
        specialization: undefined
      };

      // Cache the archetype
      if (this.config.enableCaching) {
        this.archetypeCache.set(archetypeId, {
          data: archetype,
          timestamp: new Date(),
          ttl: this.config.cacheTtlMs
        });
      }

      return archetype;

    } catch (error) {
      this.logError('Failed to get OpenEHR archetype', { archetypeId, error });
      return null;
    }
  }

  /**
   * Map HL7 data to OpenEHR composition
   */
  private async mapHL7DataToComposition(
    hl7Data: Record<string, unknown>,
    template: OpenEHRTemplate,
    mappingRules: HL7ToOpenEHRMapping[]
  ): Promise<OpenEHRComposition> {
    const compositionId = this.generateCompositionId();
    
    // Extract patient information from HL7 data
    const patientData = this.extractPatientDataFromHL7(hl7Data);
    
    // Create composition structure
    const composition: OpenEHRComposition = {
      compositionId,
      templateId: template.templateId,
      language: template.defaultLanguage,
      territory: 'US',
      category: {
        value: 'persistent',
        definingCode: {
          terminologyId: 'openehr',
          codeString: '431'
        }
      },
      composer: {
        name: 'PACS Clinical Sync System',
        id: 'pacs-sync-system'
      },
      context: {
        startTime: new Date(),
        location: patientData.location || 'Unknown',
        healthCareFacility: patientData.facility || 'Unknown',
        setting: {
          value: 'secondary medical care',
          definingCode: {
            terminologyId: 'openehr',
            codeString: '232'
          }
        }
      },
      content: []
    };

    // Apply mapping rules to create content entries
    for (const rule of mappingRules) {
      if (!rule.isActive) continue;

      try {
        const entry = await this.createEntryFromMapping(hl7Data, rule);
        if (entry) {
          composition.content.push(entry);
        }
      } catch (error) {
        this.logError('Failed to apply mapping rule', { 
          ruleId: rule.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return composition;
  }

  /**
   * Create OpenEHR entry from mapping rule
   */
  private async createEntryFromMapping(
    hl7Data: Record<string, unknown>,
    mappingRule: HL7ToOpenEHRMapping
  ): Promise<OpenEHREntry | null> {
    try {
      // Extract data from HL7 using the mapping rule
      const sourceValue = this.extractValueFromHL7Data(hl7Data, mappingRule.sourceHL7Segment, mappingRule.sourceHL7Field);
      
      if (sourceValue === null || sourceValue === undefined) {
        return null;
      }

      // Apply transformation if specified
      let transformedValue: any = sourceValue;
      if (mappingRule.transformation) {
        transformedValue = this.applyTransformation(sourceValue, mappingRule.transformation);
      }

      // Create entry based on archetype
      const entry: OpenEHREntry = {
        type: this.getEntryTypeFromArchetype(mappingRule.targetOpenEHRArchetype),
        archetypeNodeId: mappingRule.targetOpenEHRArchetype,
        name: {
          value: mappingRule.name
        },
        subject: {
          externalRef: {
            id: {
              value: this.extractPatientId(hl7Data)
            },
            namespace: 'PACS',
            type: 'PERSON'
          }
        },
        time: new Date(),
        data: this.createDataStructure(mappingRule.targetOpenEHRPath, transformedValue)
      };

      return entry;

    } catch (error) {
      this.logError('Failed to create entry from mapping', { 
        mappingRuleId: mappingRule.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Extract value from HL7 data using segment and field path
   */
  private extractValueFromHL7Data(hl7Data: Record<string, unknown>, segment: string, field: string): unknown {
    try {
      // Navigate through the HL7 data structure
      const segmentData = hl7Data[segment];
      if (!segmentData) return null;

      // Handle array of segments (e.g., OBX segments)
      if (Array.isArray(segmentData)) {
        // For arrays, extract from the first matching segment
        for (const item of segmentData) {
          const value = this.extractFieldValue(item, field);
          if (value !== null && value !== undefined) {
            return value;
          }
        }
        return null;
      }

      return this.extractFieldValue(segmentData, field);

    } catch (error) {
      this.logError('Failed to extract value from HL7 data', { segment, field, error });
      return null;
    }
  }

  /**
   * Extract field value from segment data
   */
  private extractFieldValue(segmentData: unknown, fieldPath: string): unknown {
    if (!segmentData || typeof segmentData !== 'object') return null;

    const pathParts = fieldPath.split('.');
    let current: any = segmentData;

    for (const part of pathParts) {
      if (current === null || current === undefined) return null;
      current = current[part];
    }

    return current;
  }

  /**
   * Apply transformation function to value
   */
  private applyTransformation(value: unknown, transformation: string): unknown {
    try {
      // Simple transformation rules
      switch (transformation) {
        case 'toUpperCase':
          return typeof value === 'string' ? value.toUpperCase() : value;
        case 'toLowerCase':
          return typeof value === 'string' ? value.toLowerCase() : value;
        case 'toNumber':
          return typeof value === 'string' ? parseFloat(value) : value;
        case 'toString':
          return String(value);
        case 'toBoolean':
          return Boolean(value);
        default:
          // If transformation is a function string, evaluate it safely
          // In a production environment, use a proper expression evaluator
          return value;
      }
    } catch (error) {
      this.logError('Failed to apply transformation', { transformation, value, error });
      return value;
    }
  }

  /**
   * Create data structure for OpenEHR path
   */
  private createDataStructure(path: string, value: unknown): Record<string, unknown> {
    const pathParts = path.split('/').filter(part => part.length > 0);
    const result: Record<string, unknown> = {};
    
    let current = result;
    for (let i = 0; i < pathParts.length - 1; i++) {
      current[pathParts[i]] = {};
      current = current[pathParts[i]] as Record<string, unknown>;
    }
    
    if (pathParts.length > 0) {
      current[pathParts[pathParts.length - 1]] = value;
    }
    
    return result;
  }

  /**
   * Extract patient data from HL7 message
   */
  private extractPatientDataFromHL7(hl7Data: Record<string, unknown>): {
    patientId: string;
    location?: string;
    facility?: string;
  } {
    const pidData = hl7Data.PID as any;
    const pv1Data = hl7Data.PV1 as any;
    const mshData = hl7Data.MSH as any;

    return {
      patientId: pidData?.patientId || 'unknown',
      location: pv1Data?.assignedPatientLocation?.pointOfCare,
      facility: mshData?.sendingFacility
    };
  }

  /**
   * Extract patient ID from HL7 data
   */
  private extractPatientId(hl7Data: Record<string, unknown>): string {
    const pidData = hl7Data.PID as any;
    return pidData?.patientId || 'unknown';
  }

  /**
   * Get entry type from archetype ID
   */
  private getEntryTypeFromArchetype(archetypeId: string): OpenEHREntry['type'] {
    if (archetypeId.includes('OBSERVATION')) return 'OBSERVATION';
    if (archetypeId.includes('EVALUATION')) return 'EVALUATION';
    if (archetypeId.includes('INSTRUCTION')) return 'INSTRUCTION';
    if (archetypeId.includes('ACTION')) return 'ACTION';
    return 'ADMIN_ENTRY';
  }

  /**
   * Get archetype concept name from ID
   */
  private getArchetypeConceptName(archetypeId: string): string {
    const parts = archetypeId.split('.');
    if (parts.length >= 2) {
      return parts[parts.length - 2].replace(/_/g, ' ');
    }
    return 'Clinical Data';
  }

  /**
   * Get mapping rules for template
   */
  private getMappingRulesForTemplate(templateId: string): HL7ToOpenEHRMapping[] {
    return this.mappingRules.get(templateId) || this.mappingRules.get('default') || [];
  }

  /**
   * Initialize default mapping rules
   */
  private initializeDefaultMappingRules(): void {
    const defaultRules: HL7ToOpenEHRMapping[] = [
      {
        id: 'pid-patient-name',
        name: 'Patient Name Mapping',
        description: 'Map HL7 PID patient name to OpenEHR',
        sourceHL7Segment: 'PID',
        sourceHL7Field: 'patientName.familyName',
        targetOpenEHRArchetype: 'openEHR-EHR-COMPOSITION.clinical_report.v1',
        targetOpenEHRPath: '/context/health_care_facility',
        transformation: 'toString',
        validationRules: ['required'],
        isActive: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'obx-observation-value',
        name: 'Observation Value Mapping',
        description: 'Map HL7 OBX observation value to OpenEHR',
        sourceHL7Segment: 'OBX',
        sourceHL7Field: 'observationValue',
        targetOpenEHRArchetype: 'openEHR-EHR-OBSERVATION.imaging_result.v1',
        targetOpenEHRPath: '/data/events/any_event/data/items/result_value',
        isActive: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'obr-service-id',
        name: 'Service ID Mapping',
        description: 'Map HL7 OBR universal service ID to OpenEHR',
        sourceHL7Segment: 'OBR',
        sourceHL7Field: 'universalServiceId.identifier',
        targetOpenEHRArchetype: 'openEHR-EHR-OBSERVATION.imaging_result.v1',
        targetOpenEHRPath: '/data/events/any_event/data/items/test_name',
        isActive: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    this.mappingRules.set('default', defaultRules);
    this.mappingRules.set(this.config.defaultTemplateId, defaultRules);
  }

  /**
   * Validate OpenEHR composition
   */
  private async validateComposition(composition: OpenEHRComposition): Promise<CompositionValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic validation
      if (!composition.compositionId) {
        errors.push('Missing composition ID');
      }
      if (!composition.templateId) {
        errors.push('Missing template ID');
      }
      if (!composition.composer?.name) {
        errors.push('Missing composer name');
      }
      if (composition.content.length === 0) {
        warnings.push('Composition has no content entries');
      }

      // Validate each content entry
      for (let i = 0; i < composition.content.length; i++) {
        const entry = composition.content[i];
        if (!entry.archetypeNodeId) {
          errors.push(`Content entry ${i} missing archetype node ID`);
        }
        if (!entry.name?.value) {
          errors.push(`Content entry ${i} missing name`);
        }
      }

      this.logInfo('OpenEHR composition validation completed', {
        compositionId: composition.compositionId,
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
   * Store composition to OpenEHR server
   */
  private async storeComposition(composition: OpenEHRComposition): Promise<void> {
    try {
      // In a real implementation, this would POST to the OpenEHR server
      // For demo purposes, just log the operation
      this.logInfo('Storing OpenEHR composition', {
        compositionId: composition.compositionId,
        templateId: composition.templateId,
        contentEntries: composition.content.length
      });

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      this.logError('Failed to store OpenEHR composition', {
        compositionId: composition.compositionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check if cached item is valid
   */
  private isCacheValid<T>(cached: CachedItem<T>): boolean {
    const now = new Date().getTime();
    const cacheTime = cached.timestamp.getTime();
    return (now - cacheTime) < cached.ttl;
  }

  /**
   * Generate unique composition ID
   */
  private generateCompositionId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `openehr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    return {
      templatesInCache: this.templateCache.size,
      archetypesInCache: this.archetypeCache.size,
      mappingRulesCount: Array.from(this.mappingRules.values()).reduce((sum, rules) => sum + rules.length, 0),
      cacheEnabled: this.config.enableCaching,
      cacheTtlMs: this.config.cacheTtlMs
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.templateCache.clear();
    this.archetypeCache.clear();
    this.logInfo('OpenEHR caches cleared');
  }

  /**
   * Add custom mapping rule
   */
  addMappingRule(templateId: string, rule: HL7ToOpenEHRMapping): void {
    const rules = this.mappingRules.get(templateId) || [];
    rules.push(rule);
    this.mappingRules.set(templateId, rules);
    this.logInfo('Added mapping rule', { templateId, ruleId: rule.id });
  }

  /**
   * Remove mapping rule
   */
  removeMappingRule(templateId: string, ruleId: string): boolean {
    const rules = this.mappingRules.get(templateId);
    if (!rules) return false;

    const index = rules.findIndex(rule => rule.id === ruleId);
    if (index === -1) return false;

    rules.splice(index, 1);
    this.mappingRules.set(templateId, rules);
    this.logInfo('Removed mapping rule', { templateId, ruleId });
    return true;
  }

  /**
   * Log info message
   */
  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[OpenEHR Integration Service] ${message}`, context || {});
  }

  /**
   * Log error message
   */
  private logError(message: string, context?: Record<string, unknown>): void {
    console.error(`[OpenEHR Integration Service] ${message}`, context || {});
  }
}

export default OpenEHRIntegrationService;