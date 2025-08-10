/**
 * Dynamic Compliance Configuration System
 * 
 * Allows runtime configuration and enabling/disabling of compliance features
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { ComplianceConfig } from '../types/compliance';
import { ComplianceManager } from '../services/complianceManager';
import { AuditLogger } from '../../ehr-integrations/services/auditLogger';

/**
 * Configuration loader for compliance services
 */
export class ComplianceConfigLoader {
  private static instance: ComplianceConfigLoader;
  private config: ComplianceConfig;
  private complianceManager?: ComplianceManager;

  private constructor() {
    this.config = this.loadDefaultConfig();
  }

  static getInstance(): ComplianceConfigLoader {
    if (!ComplianceConfigLoader.instance) {
      ComplianceConfigLoader.instance = new ComplianceConfigLoader();
    }
    return ComplianceConfigLoader.instance;
  }

  /**
   * Load configuration from environment variables and config files
   */
  private loadDefaultConfig(): ComplianceConfig {
    return {
      hipaa: {
        enabled: process.env.HIPAA_ENABLED === 'true',
        strictMode: process.env.HIPAA_STRICT_MODE === 'true',
        breachNotificationEmail: process.env.HIPAA_BREACH_EMAIL,
        phiRetentionDays: parseInt(process.env.HIPAA_PHI_RETENTION_DAYS || '2555'),
        auditRetentionDays: parseInt(process.env.HIPAA_AUDIT_RETENTION_DAYS || '2555')
      },
      gdpr: {
        enabled: process.env.GDPR_ENABLED === 'true',
        region: (process.env.GDPR_REGION as 'EU' | 'UK' | 'GLOBAL') || 'EU',
        dataProcessingLegalBasis: process.env.GDPR_LEGAL_BASIS || 'consent',
        consentExpiryDays: parseInt(process.env.GDPR_CONSENT_EXPIRY_DAYS || '365'),
        erasureTimeframeDays: parseInt(process.env.GDPR_ERASURE_TIMEFRAME_DAYS || '30')
      },
      lgpd: {
        enabled: process.env.LGPD_ENABLED === 'true',
        region: 'BR',
        dataProcessingLegalBasis: process.env.LGPD_LEGAL_BASIS || 'consentimento',
        consentExpiryDays: parseInt(process.env.LGPD_CONSENT_EXPIRY_DAYS || '365'),
        eliminationTimeframeDays: parseInt(process.env.LGPD_ELIMINATION_TIMEFRAME_DAYS || '15'),
        pseudonymizationRequired: process.env.LGPD_PSEUDONYMIZATION_REQUIRED !== 'false',
        language: (process.env.LGPD_LANGUAGE as 'pt-BR' | 'en') || 'pt-BR'
      },
      iso27001: {
        enabled: process.env.ISO27001_ENABLED === 'true',
        auditLevel: (process.env.ISO27001_AUDIT_LEVEL as 'basic' | 'detailed' | 'comprehensive') || 'basic',
        riskAssessmentInterval: parseInt(process.env.ISO27001_RISK_ASSESSMENT_INTERVAL || '365'),
        incidentResponseEnabled: process.env.ISO27001_INCIDENT_RESPONSE_ENABLED !== 'false'
      }
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ComplianceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration dynamically
   */
  async updateConfig(newConfig: Partial<ComplianceConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    
    // Merge new configuration
    this.config = {
      hipaa: { ...this.config.hipaa, ...newConfig.hipaa },
      gdpr: { ...this.config.gdpr, ...newConfig.gdpr },
      lgpd: { ...this.config.lgpd, ...newConfig.lgpd },
      iso27001: { ...this.config.iso27001, ...newConfig.iso27001 }
    };

    // Log configuration change
    console.log('[Compliance Config] Configuration updated', {
      oldConfig: this.sanitizeConfig(oldConfig),
      newConfig: this.sanitizeConfig(this.config)
    });

    // Reinitialize compliance manager if it exists
    if (this.complianceManager) {
      await this.reinitializeComplianceManager();
    }
  }

  /**
   * Enable specific compliance standard
   */
  async enableStandard(standard: 'hipaa' | 'gdpr' | 'lgpd' | 'iso27001'): Promise<void> {
    const update: any = {};
    update[standard] = { ...this.config[standard], enabled: true };
    await this.updateConfig(update);
  }

  /**
   * Disable specific compliance standard
   */
  async disableStandard(standard: 'hipaa' | 'gdpr' | 'lgpd' | 'iso27001'): Promise<void> {
    const update: any = {};
    update[standard] = { ...this.config[standard], enabled: false };
    await this.updateConfig(update);
  }

  /**
   * Initialize compliance manager with current configuration
   */
  async initializeComplianceManager(auditLogger?: AuditLogger): Promise<ComplianceManager> {
    this.complianceManager = new ComplianceManager(this.config, auditLogger);
    await this.complianceManager.initialize();
    return this.complianceManager;
  }

  /**
   * Get current compliance manager instance
   */
  getComplianceManager(): ComplianceManager | undefined {
    return this.complianceManager;
  }

  /**
   * Reinitialize compliance manager with updated configuration
   */
  private async reinitializeComplianceManager(): Promise<void> {
    if (!this.complianceManager) return;

    try {
      // Create new instance with updated configuration
      const auditLogger = (this.complianceManager as any).auditLogger;
      this.complianceManager = new ComplianceManager(this.config, auditLogger);
      await this.complianceManager.initialize();
      
      console.log('[Compliance Config] Compliance manager reinitialized');
    } catch (error) {
      console.error('[Compliance Config] Failed to reinitialize compliance manager:', error);
      throw error;
    }
  }

  /**
   * Get compliance status for all standards
   */
  getComplianceStatus(): {
    hipaa: { enabled: boolean; initialized: boolean };
    gdpr: { enabled: boolean; initialized: boolean };
    lgpd: { enabled: boolean; initialized: boolean };
    iso27001: { enabled: boolean; initialized: boolean };
  } {
    return {
      hipaa: {
        enabled: this.config.hipaa?.enabled || false,
        initialized: !!this.complianceManager?.getHIPAAService()
      },
      gdpr: {
        enabled: this.config.gdpr?.enabled || false,
        initialized: !!this.complianceManager?.getGDPRService()
      },
      lgpd: {
        enabled: this.config.lgpd?.enabled || false,
        initialized: !!this.complianceManager?.getLGPDService()
      },
      iso27001: {
        enabled: this.config.iso27001?.enabled || false,
        initialized: !!this.complianceManager?.getISO27001Service()
      }
    };
  }

  /**
   * Load configuration from file
   */
  async loadConfigFromFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs');
      const configData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      await this.updateConfig(configData);
      console.log(`[Compliance Config] Configuration loaded from ${filePath}`);
    } catch (error) {
      console.error(`[Compliance Config] Failed to load configuration from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Save current configuration to file
   */
  async saveConfigToFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs');
      const configData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(filePath, configData, 'utf8');
      console.log(`[Compliance Config] Configuration saved to ${filePath}`);
    } catch (error) {
      console.error(`[Compliance Config] Failed to save configuration to ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(config: ComplianceConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate HIPAA configuration
    if (config.hipaa?.enabled) {
      if (!config.hipaa.phiRetentionDays || config.hipaa.phiRetentionDays < 1) {
        errors.push('HIPAA PHI retention days must be at least 1');
      }
      if (!config.hipaa.auditRetentionDays || config.hipaa.auditRetentionDays < 1826) {
        errors.push('HIPAA audit retention days must be at least 1826 days (5 years)');
      }
    }

    // Validate GDPR configuration
    if (config.gdpr?.enabled) {
      if (!['EU', 'UK', 'GLOBAL'].includes(config.gdpr.region)) {
        errors.push('GDPR region must be EU, UK, or GLOBAL');
      }
      if (!config.gdpr.consentExpiryDays || config.gdpr.consentExpiryDays < 1) {
        errors.push('GDPR consent expiry days must be at least 1');
      }
    }

    // Validate LGPD configuration
    if (config.lgpd?.enabled) {
      if (config.lgpd.region !== 'BR') {
        errors.push('LGPD region must be BR');
      }
      if (!config.lgpd.eliminationTimeframeDays || config.lgpd.eliminationTimeframeDays < 1) {
        errors.push('LGPD elimination timeframe days must be at least 1');
      }
      if (!['pt-BR', 'en'].includes(config.lgpd.language)) {
        errors.push('LGPD language must be pt-BR or en');
      }
    }

    // Validate ISO27001 configuration
    if (config.iso27001?.enabled) {
      if (!['basic', 'detailed', 'comprehensive'].includes(config.iso27001.auditLevel)) {
        errors.push('ISO27001 audit level must be basic, detailed, or comprehensive');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize configuration for logging (remove sensitive data)
   */
  private sanitizeConfig(config: ComplianceConfig): Record<string, any> {
    return {
      hipaa: {
        enabled: config.hipaa?.enabled,
        strictMode: config.hipaa?.strictMode,
        hasBreachNotificationEmail: !!config.hipaa?.breachNotificationEmail,
        phiRetentionDays: config.hipaa?.phiRetentionDays,
        auditRetentionDays: config.hipaa?.auditRetentionDays
      },
      gdpr: {
        enabled: config.gdpr?.enabled,
        region: config.gdpr?.region,
        dataProcessingLegalBasis: config.gdpr?.dataProcessingLegalBasis,
        consentExpiryDays: config.gdpr?.consentExpiryDays,
        erasureTimeframeDays: config.gdpr?.erasureTimeframeDays
      },
      lgpd: {
        enabled: config.lgpd?.enabled,
        region: config.lgpd?.region,
        dataProcessingLegalBasis: config.lgpd?.dataProcessingLegalBasis,
        consentExpiryDays: config.lgpd?.consentExpiryDays,
        eliminationTimeframeDays: config.lgpd?.eliminationTimeframeDays,
        pseudonymizationRequired: config.lgpd?.pseudonymizationRequired,
        language: config.lgpd?.language
      },
      iso27001: {
        enabled: config.iso27001?.enabled,
        auditLevel: config.iso27001?.auditLevel,
        riskAssessmentInterval: config.iso27001?.riskAssessmentInterval,
        incidentResponseEnabled: config.iso27001?.incidentResponseEnabled
      }
    };
  }
}

/**
 * Factory function to get configured compliance manager
 */
export async function createConfiguredComplianceManager(auditLogger?: AuditLogger): Promise<ComplianceManager> {
  const configLoader = ComplianceConfigLoader.getInstance();
  return await configLoader.initializeComplianceManager(auditLogger);
}