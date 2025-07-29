/**
 * Provider Verification Service for WebQX™
 * 
 * Comprehensive medical provider verification system that validates licenses,
 * certifications, and credentials for healthcare professionals.
 */

import {
  Provider,
  ProviderVerificationStatus,
  VerificationRequest,
  VerificationResult,
  MedicalSpecialty,
  BoardCertification,
  HospitalPrivilege,
  LicenseValidationResult,
  NPIValidationResult,
  DEAValidationResult,
  ExternalVerificationAPI
} from '../types';

export class ProviderVerificationService {
  private auditEnabled: boolean;
  private externalAPIs: ExternalVerificationAPI;

  constructor(options: { enableAudit?: boolean } = {}) {
    this.auditEnabled = options.enableAudit !== false;
    
    // Initialize external API connections
    this.externalAPIs = new MockExternalVerificationAPI();
  }

  /**
   * Comprehensive provider verification process
   */
  async verifyProvider(providerId: string, specialty?: MedicalSpecialty): Promise<ProviderVerificationStatus> {
    try {
      const provider = await this.getProviderById(providerId);
      
      if (!provider) {
        throw new Error('Provider not found');
      }

      console.log(`[Provider Verification] Starting verification for ${provider.id}`);

      // Step 1: Validate medical license
      const licenseValid = await this.validateMedicalLicense(
        provider.medicalLicenseNumber,
        provider.medicalLicenseState
      );

      if (!licenseValid.isValid) {
        await this.updateVerificationStatus(providerId, 'REJECTED');
        return 'REJECTED';
      }

      // Step 2: Validate NPI number
      const npiValid = await this.validateNPI(provider.npiNumber);
      
      if (!npiValid.isValid) {
        await this.updateVerificationStatus(providerId, 'REJECTED');
        return 'REJECTED';
      }

      // Step 3: Validate DEA if provided
      if (provider.deaNumber) {
        const deaValid = await this.validateDEA(provider.deaNumber);
        
        if (!deaValid.isValid) {
          await this.updateVerificationStatus(providerId, 'REJECTED');
          return 'REJECTED';
        }
      }

      // Step 4: Validate board certifications
      const certificationsValid = await this.validateBoardCertifications(
        provider.boardCertifications,
        specialty
      );

      if (!certificationsValid) {
        await this.updateVerificationStatus(providerId, 'REJECTED');
        return 'REJECTED';
      }

      // Step 5: Check disciplinary actions
      const disciplinaryCheck = await this.checkDisciplinaryActions(provider.medicalLicenseNumber);
      
      if (disciplinaryCheck.hasActiveActions) {
        await this.updateVerificationStatus(providerId, 'SUSPENDED');
        return 'SUSPENDED';
      }

      // All validations passed
      await this.updateVerificationStatus(providerId, 'VERIFIED');
      await this.logVerificationEvent(providerId, 'VERIFICATION_COMPLETE', { success: true });

      console.log(`[Provider Verification] Verification successful for ${provider.id}`);
      return 'VERIFIED';

    } catch (error) {
      console.error('[Provider Verification] Verification failed:', error);
      await this.updateVerificationStatus(providerId, 'REJECTED');
      await this.logVerificationEvent(providerId, 'VERIFICATION_FAILED', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return 'REJECTED';
    }
  }

  /**
   * Validate medical license with state board
   */
  async validateMedicalLicense(licenseNumber: string, state: string): Promise<LicenseValidationResult> {
    try {
      const result = await this.externalAPIs.validateLicense(licenseNumber, state);
      
      await this.logVerificationEvent('license_validation', 'LICENSE_VALIDATED', {
        licenseNumber,
        state,
        isValid: result.isValid,
        status: result.status
      });

      return result;

    } catch (error) {
      console.error('[Provider Verification] License validation error:', error);
      
      return {
        isValid: false,
        licenseNumber,
        state,
        status: 'EXPIRED',
        issueDate: new Date(),
        expirationDate: new Date(),
        practitionerName: ''
      };
    }
  }

  /**
   * Validate National Provider Identifier (NPI)
   */
  async validateNPI(npiNumber: string): Promise<NPIValidationResult> {
    try {
      const result = await this.externalAPIs.validateNPI(npiNumber);
      
      await this.logVerificationEvent('npi_validation', 'NPI_VALIDATED', {
        npiNumber,
        isValid: result.isValid,
        providerType: result.providerType
      });

      return result;

    } catch (error) {
      console.error('[Provider Verification] NPI validation error:', error);
      
      return {
        isValid: false,
        npiNumber,
        providerType: 'INDIVIDUAL',
        name: '',
        address: '',
        isActive: false
      };
    }
  }

  /**
   * Validate DEA registration
   */
  async validateDEA(deaNumber: string): Promise<DEAValidationResult> {
    try {
      const result = await this.externalAPIs.validateDEA(deaNumber);
      
      await this.logVerificationEvent('dea_validation', 'DEA_VALIDATED', {
        deaNumber,
        isValid: result.isValid,
        isActive: result.isActive
      });

      return result;

    } catch (error) {
      console.error('[Provider Verification] DEA validation error:', error);
      
      return {
        isValid: false,
        deaNumber,
        registrantName: '',
        businessActivity: '',
        schedules: [],
        expirationDate: new Date(),
        isActive: false
      };
    }
  }

  /**
   * Validate board certifications
   */
  async validateBoardCertifications(
    certifications: BoardCertification[],
    requiredSpecialty?: MedicalSpecialty
  ): Promise<boolean> {
    try {
      if (certifications.length === 0) {
        console.warn('[Provider Verification] No board certifications provided');
        return false;
      }

      for (const cert of certifications) {
        // Check if certification is active
        if (!cert.isActive || cert.expirationDate < new Date()) {
          console.warn(`[Provider Verification] Expired certification: ${cert.certificationNumber}`);
          return false;
        }

        // Check if required specialty matches
        if (requiredSpecialty && cert.specialty !== requiredSpecialty) {
          console.warn(`[Provider Verification] Specialty mismatch: ${cert.specialty} vs ${requiredSpecialty}`);
          return false;
        }
      }

      await this.logVerificationEvent('certification_validation', 'CERTIFICATIONS_VALIDATED', {
        certificationsCount: certifications.length,
        requiredSpecialty,
        isValid: true
      });

      return true;

    } catch (error) {
      console.error('[Provider Verification] Certification validation error:', error);
      return false;
    }
  }

  /**
   * Check for disciplinary actions
   */
  async checkDisciplinaryActions(licenseNumber: string): Promise<{ hasActiveActions: boolean }> {
    try {
      // In real implementation, this would query state boards and NPDB
      // For demonstration, we'll simulate no active disciplinary actions
      
      await this.logVerificationEvent('disciplinary_check', 'DISCIPLINARY_CHECKED', {
        licenseNumber,
        hasActiveActions: false
      });

      return { hasActiveActions: false };

    } catch (error) {
      console.error('[Provider Verification] Disciplinary check error:', error);
      return { hasActiveActions: true }; // Fail safe
    }
  }

  /**
   * Schedule re-verification for providers with expiring credentials
   */
  async scheduleReVerification(providerId: string): Promise<void> {
    try {
      const provider = await this.getProviderById(providerId);
      
      if (!provider) {
        throw new Error('Provider not found');
      }

      // Check credential expiration dates
      const expiringCredentials = this.getExpiringCredentials(provider);
      
      if (expiringCredentials.length > 0) {
        console.log(`[Provider Verification] Scheduling re-verification for ${providerId}`);
        
        // In real implementation, this would create scheduled tasks
        await this.logVerificationEvent(providerId, 'RE_VERIFICATION_SCHEDULED', {
          expiringCredentials: expiringCredentials.map(c => c.type)
        });
      }

    } catch (error) {
      console.error('[Provider Verification] Re-verification scheduling error:', error);
    }
  }

  /**
   * Get credentials that are expiring within 90 days
   */
  private getExpiringCredentials(provider: Provider): Array<{ type: string; expirationDate: Date }> {
    const credentials: Array<{ type: string; expirationDate: Date }> = [];
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    // Check board certifications
    provider.boardCertifications.forEach(cert => {
      if (cert.expirationDate <= ninetyDaysFromNow) {
        credentials.push({
          type: `board_certification_${cert.specialty}`,
          expirationDate: cert.expirationDate
        });
      }
    });

    // Check hospital privileges
    provider.hospitalPrivileges.forEach(privilege => {
      if (privilege.expirationDate && privilege.expirationDate <= ninetyDaysFromNow) {
        credentials.push({
          type: `hospital_privilege_${privilege.hospitalId}`,
          expirationDate: privilege.expirationDate
        });
      }
    });

    return credentials;
  }

  /**
   * Update provider verification status
   */
  private async updateVerificationStatus(
    providerId: string, 
    status: ProviderVerificationStatus
  ): Promise<void> {
    // In real implementation, this would update the provider database
    console.log(`[Provider Verification] Updated status for ${providerId}: ${status}`);
  }

  /**
   * Get provider by ID
   */
  private async getProviderById(providerId: string): Promise<Provider | null> {
    // In real implementation, this would fetch from database
    return {
      id: providerId,
      email: 'doctor@example.com',
      firstName: 'Dr. John',
      lastName: 'Smith',
      role: 'PROVIDER',
      specialty: 'CARDIOLOGY',
      isVerified: false,
      mfaEnabled: true,
      npiNumber: '1234567890',
      deaNumber: 'BS1234567',
      medicalLicenseNumber: 'MD123456',
      medicalLicenseState: 'CA',
      boardCertifications: [
        {
          boardName: 'American Board of Internal Medicine',
          specialty: 'CARDIOLOGY',
          certificationNumber: 'ABIM123456',
          issueDate: new Date('2020-01-01'),
          expirationDate: new Date('2030-01-01'),
          isActive: true
        }
      ],
      hospitalPrivileges: [
        {
          hospitalId: 'hosp_123',
          hospitalName: 'General Hospital',
          privilegeType: 'Active Staff',
          department: 'Cardiology',
          grantedDate: new Date('2020-01-01'),
          expirationDate: new Date('2025-01-01'),
          isActive: true
        }
      ],
      verificationStatus: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Log verification event for audit purposes
   */
  private async logVerificationEvent(
    providerId: string,
    eventType: string,
    details: Record<string, any>
  ): Promise<void> {
    if (!this.auditEnabled) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      providerId,
      eventType,
      details
    };

    console.log('[Provider Verification] Audit Log:', JSON.stringify(logEntry, null, 2));
  }
}

/**
 * Mock external verification API for demonstration
 */
class MockExternalVerificationAPI implements ExternalVerificationAPI {
  async validateLicense(licenseNumber: string, state: string): Promise<LicenseValidationResult> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      isValid: true,
      licenseNumber,
      state,
      status: 'ACTIVE',
      issueDate: new Date('2020-01-01'),
      expirationDate: new Date('2025-01-01'),
      practitionerName: 'Dr. John Smith'
    };
  }

  async validateNPI(npiNumber: string): Promise<NPIValidationResult> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      isValid: true,
      npiNumber,
      providerType: 'INDIVIDUAL',
      name: 'Dr. John Smith',
      specialty: 'Cardiology',
      address: '123 Medical Center Dr, City, ST 12345',
      isActive: true
    };
  }

  async validateDEA(deaNumber: string): Promise<DEAValidationResult> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      isValid: true,
      deaNumber,
      registrantName: 'Dr. John Smith',
      businessActivity: 'Practitioner',
      schedules: ['II', 'III', 'IV', 'V'],
      expirationDate: new Date('2025-01-01'),
      isActive: true
    };
  }
}

export default ProviderVerificationService;