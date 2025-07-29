/**
 * Specialty Routing Service
 * 
 * Routes imaging studies to relevant medical specialties based on patient conditions,
 * clinical needs, and configurable routing rules.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { DicomImage, DicomMetadata } from './pacsService';

export interface RoutingRule {
  id: string;
  name: string;
  specialty: string;
  priority: number;
  conditions: RoutingCondition[];
  isActive: boolean;
}

export interface RoutingCondition {
  field: 'modality' | 'bodyPart' | 'studyDescription' | 'patientAge' | 'urgency' | 'referringDepartment';
  operator: 'equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than' | 'in';
  value: string | number | string[];
}

export interface RoutingResult {
  primarySpecialty: string;
  secondarySpecialties: string[];
  priority: 'urgent' | 'high' | 'normal' | 'low';
  routingRuleApplied: string;
  recommendations?: string[];
}

export interface SpecialtyConfig {
  name: string;
  displayName: string;
  description: string;
  supportedModalities: string[];
  supportedBodyParts: string[];
  isActive: boolean;
}

/**
 * Specialty Routing Service
 */
export class SpecialtyRoutingService {
  private routingRules: RoutingRule[] = [];
  private specialties: SpecialtyConfig[] = [];

  constructor() {
    this.initializeDefaultRules();
    this.initializeSpecialties();
  }

  /**
   * Route a study to appropriate specialties
   */
  async routeStudy(study: DicomImage, patientContext?: any): Promise<RoutingResult> {
    try {
      const metadata = study.metadata;
      let applicableRules = this.getApplicableRules(metadata, patientContext);
      
      // Sort by priority (higher priority first)
      applicableRules = applicableRules.sort((a, b) => b.priority - a.priority);
      
      if (applicableRules.length === 0) {
        // Default routing based on modality
        return this.getDefaultRouting(metadata);
      }

      const primaryRule = applicableRules[0];
      const secondarySpecialties = applicableRules
        .slice(1)
        .map(rule => rule.specialty)
        .filter(spec => spec !== primaryRule.specialty);

      return {
        primarySpecialty: primaryRule.specialty,
        secondarySpecialties: Array.from(new Set(secondarySpecialties)),
        priority: this.determinePriority(metadata, patientContext),
        routingRuleApplied: primaryRule.name,
        recommendations: this.generateRecommendations(metadata, primaryRule.specialty)
      };
    } catch (error) {
      console.error('Routing error:', error);
      throw new Error('Failed to route study to specialty');
    }
  }

  /**
   * Get all configured routing rules
   */
  getRoutingRules(): RoutingRule[] {
    return this.routingRules.filter(rule => rule.isActive);
  }

  /**
   * Add or update a routing rule
   */
  setRoutingRule(rule: RoutingRule): void {
    const existingIndex = this.routingRules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      this.routingRules[existingIndex] = rule;
    } else {
      this.routingRules.push(rule);
    }
  }

  /**
   * Remove a routing rule
   */
  removeRoutingRule(ruleId: string): void {
    this.routingRules = this.routingRules.filter(rule => rule.id !== ruleId);
  }

  /**
   * Get all configured specialties
   */
  getSpecialties(): SpecialtyConfig[] {
    return this.specialties.filter(spec => spec.isActive);
  }

  /**
   * Route multiple studies in batch
   */
  async routeStudies(studies: DicomImage[], patientContext?: any): Promise<Map<string, RoutingResult>> {
    const results = new Map<string, RoutingResult>();
    
    for (const study of studies) {
      try {
        const routing = await this.routeStudy(study, patientContext);
        results.set(study.studyInstanceUID, routing);
      } catch (error) {
        console.error(`Failed to route study ${study.studyInstanceUID}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Get applicable routing rules for given metadata
   */
  private getApplicableRules(metadata: DicomMetadata, patientContext?: any): RoutingRule[] {
    return this.routingRules.filter(rule => {
      if (!rule.isActive) return false;
      
      return rule.conditions.every(condition => 
        this.evaluateCondition(condition, metadata, patientContext)
      );
    });
  }

  /**
   * Evaluate a single routing condition
   */
  private evaluateCondition(condition: RoutingCondition, metadata: DicomMetadata, patientContext?: any): boolean {
    let fieldValue: any;
    
    switch (condition.field) {
      case 'modality':
        fieldValue = metadata.modality;
        break;
      case 'bodyPart':
        fieldValue = metadata.bodyPart;
        break;
      case 'studyDescription':
        fieldValue = metadata.studyDescription;
        break;
      case 'patientAge':
        fieldValue = patientContext?.age || 0;
        break;
      case 'urgency':
        fieldValue = patientContext?.urgency || 'normal';
        break;
      case 'referringDepartment':
        fieldValue = patientContext?.referringDepartment || '';
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'starts_with':
        return String(fieldValue).toLowerCase().startsWith(String(condition.value).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Get default routing when no rules match
   */
  private getDefaultRouting(metadata: DicomMetadata): RoutingResult {
    let primarySpecialty = 'radiology'; // Default to radiology
    
    // Basic modality-based routing
    switch (metadata.modality.toLowerCase()) {
      case 'ct':
      case 'mri':
      case 'pet':
      case 'spect':
        primarySpecialty = 'radiology';
        break;
      case 'us':
        primarySpecialty = metadata.bodyPart.toLowerCase().includes('heart') ? 'cardiology' : 'radiology';
        break;
      case 'xr':
      case 'cr':
      case 'dr':
        primarySpecialty = metadata.bodyPart.toLowerCase().includes('chest') ? 'pulmonology' : 'radiology';
        break;
      case 'mg':
        primarySpecialty = 'radiology';
        break;
    }

    return {
      primarySpecialty,
      secondarySpecialties: [],
      priority: 'normal',
      routingRuleApplied: 'default-modality-routing'
    };
  }

  /**
   * Determine study priority
   */
  private determinePriority(metadata: DicomMetadata, patientContext?: any): 'urgent' | 'high' | 'normal' | 'low' {
    if (patientContext?.urgency === 'stat' || patientContext?.urgency === 'urgent') {
      return 'urgent';
    }
    
    // Check for urgent keywords in study description
    const urgentKeywords = ['emergency', 'trauma', 'stroke', 'cardiac', 'acute'];
    const description = metadata.studyDescription.toLowerCase();
    
    if (urgentKeywords.some(keyword => description.includes(keyword))) {
      return 'high';
    }
    
    return 'normal';
  }

  /**
   * Generate recommendations based on specialty and metadata
   */
  private generateRecommendations(metadata: DicomMetadata, specialty: string): string[] {
    const recommendations: string[] = [];
    
    switch (specialty.toLowerCase()) {
      case 'cardiology':
        if (metadata.modality === 'CT') {
          recommendations.push('Consider cardiac function assessment');
          recommendations.push('Check for coronary artery disease');
        }
        break;
      case 'orthopedics':
        if (metadata.modality === 'XR') {
          recommendations.push('Assess for fractures and bone abnormalities');
          recommendations.push('Consider follow-up imaging if indicated');
        }
        break;
      case 'neurology':
        if (metadata.bodyPart.toLowerCase().includes('head')) {
          recommendations.push('Evaluate for neurological abnormalities');
          recommendations.push('Consider correlation with clinical symptoms');
        }
        break;
    }
    
    return recommendations;
  }

  /**
   * Initialize default routing rules
   */
  private initializeDefaultRules(): void {
    this.routingRules = [
      {
        id: 'cardiac-imaging',
        name: 'Cardiac Imaging to Cardiology',
        specialty: 'cardiology',
        priority: 10,
        isActive: true,
        conditions: [
          {
            field: 'bodyPart',
            operator: 'contains',
            value: 'heart'
          }
        ]
      },
      {
        id: 'orthopedic-xray',
        name: 'Orthopedic X-Ray to Orthopedics',
        specialty: 'orthopedics',
        priority: 9,
        isActive: true,
        conditions: [
          {
            field: 'modality',
            operator: 'in',
            value: ['XR', 'CR', 'DR']
          },
          {
            field: 'bodyPart',
            operator: 'in',
            value: ['EXTREMITY', 'SPINE', 'PELVIS']
          }
        ]
      },
      {
        id: 'neuro-imaging',
        name: 'Neurological Imaging to Neurology',
        specialty: 'neurology',
        priority: 9,
        isActive: true,
        conditions: [
          {
            field: 'bodyPart',
            operator: 'in',
            value: ['HEAD', 'BRAIN', 'SPINE']
          },
          {
            field: 'modality',
            operator: 'in',
            value: ['CT', 'MRI']
          }
        ]
      },
      {
        id: 'chest-imaging',
        name: 'Chest Imaging to Pulmonology',
        specialty: 'pulmonology',
        priority: 8,
        isActive: true,
        conditions: [
          {
            field: 'bodyPart',
            operator: 'equals',
            value: 'CHEST'
          }
        ]
      },
      {
        id: 'pediatric-patients',
        name: 'Pediatric Patients to Pediatrics',
        specialty: 'pediatrics',
        priority: 8,
        isActive: true,
        conditions: [
          {
            field: 'patientAge',
            operator: 'less_than',
            value: 18
          }
        ]
      },
      {
        id: 'urgent-studies',
        name: 'Urgent Studies Priority Routing',
        specialty: 'emergency_medicine',
        priority: 15,
        isActive: true,
        conditions: [
          {
            field: 'urgency',
            operator: 'in',
            value: ['urgent', 'stat', 'emergency']
          }
        ]
      }
    ];
  }

  /**
   * Initialize specialty configurations
   */
  private initializeSpecialties(): void {
    this.specialties = [
      {
        name: 'radiology',
        displayName: 'Radiology',
        description: 'Diagnostic imaging and image-guided procedures',
        supportedModalities: ['CT', 'MRI', 'XR', 'US', 'PET', 'SPECT', 'CR', 'DR', 'MG'],
        supportedBodyParts: ['*'],
        isActive: true
      },
      {
        name: 'cardiology',
        displayName: 'Cardiology',
        description: 'Heart and cardiovascular system',
        supportedModalities: ['CT', 'MRI', 'US', 'XR'],
        supportedBodyParts: ['CHEST', 'HEART'],
        isActive: true
      },
      {
        name: 'orthopedics',
        displayName: 'Orthopedics',
        description: 'Musculoskeletal system',
        supportedModalities: ['XR', 'CT', 'MRI', 'CR', 'DR'],
        supportedBodyParts: ['EXTREMITY', 'SPINE', 'PELVIS'],
        isActive: true
      },
      {
        name: 'neurology',
        displayName: 'Neurology',
        description: 'Nervous system',
        supportedModalities: ['CT', 'MRI', 'PET'],
        supportedBodyParts: ['HEAD', 'BRAIN', 'SPINE'],
        isActive: true
      },
      {
        name: 'pulmonology',
        displayName: 'Pulmonology',
        description: 'Respiratory system',
        supportedModalities: ['CT', 'XR', 'CR', 'DR'],
        supportedBodyParts: ['CHEST'],
        isActive: true
      },
      {
        name: 'pediatrics',
        displayName: 'Pediatrics',
        description: 'Pediatric medical care',
        supportedModalities: ['*'],
        supportedBodyParts: ['*'],
        isActive: true
      },
      {
        name: 'emergency_medicine',
        displayName: 'Emergency Medicine',
        description: 'Urgent and emergency care',
        supportedModalities: ['*'],
        supportedBodyParts: ['*'],
        isActive: true
      },
      {
        name: 'oncology',
        displayName: 'Oncology',
        description: 'Cancer diagnosis and treatment',
        supportedModalities: ['CT', 'MRI', 'PET', 'SPECT'],
        supportedBodyParts: ['*'],
        isActive: true
      }
    ];
  }
}

export default SpecialtyRoutingService;