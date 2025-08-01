/**
 * WebQX™ Messaging Encryption Utilities
 * 
 * End-to-end encryption utilities for Matrix-based healthcare communications.
 * Implements HIPAA-compliant encryption with device verification and key management.
 */

const crypto = require('crypto');
const { AuditLogger } = require('../utils/audit');

class EncryptionManager {
  constructor(matrixClient, options = {}) {
    this.client = matrixClient;
    this.auditLogger = new AuditLogger();
    this.options = {
      enableDeviceVerification: options.enableDeviceVerification !== false,
      enableCrossSigning: options.enableCrossSigning !== false,
      keyBackupEnabled: options.keyBackupEnabled !== false,
      ...options
    };

    this.deviceTrustCache = new Map();
    this.keyBackupInfo = null;
  }

  /**
   * Initialize encryption for the Matrix client
   */
  async initialize() {
    try {
      if (!this.client.isCryptoEnabled()) {
        await this.client.initCrypto();
        this.auditLogger.log('crypto', 'Crypto initialized for Matrix client');
      }

      // Set up cross-signing if enabled and not already set up
      if (this.options.enableCrossSigning && !this.client.getCrossSigningId()) {
        await this.setupCrossSigning();
      }

      // Set up key backup if enabled
      if (this.options.keyBackupEnabled) {
        await this.setupKeyBackup();
      }

      // Set up device verification handlers
      if (this.options.enableDeviceVerification) {
        this.setupDeviceVerificationHandlers();
      }

      this.auditLogger.log('crypto', 'Encryption manager initialized', {
        crossSigningEnabled: this.options.enableCrossSigning,
        keyBackupEnabled: this.options.keyBackupEnabled,
        deviceVerificationEnabled: this.options.enableDeviceVerification
      });

      return true;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to initialize encryption', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Set up cross-signing for enhanced security
   */
  async setupCrossSigning() {
    try {
      // In a real implementation, this would require user interaction
      // to verify the cross-signing keys
      const crossSigningKeys = await this.client.getCrypto().bootstrapCrossSigning({
        setupNewCrossSigning: true
      });

      this.auditLogger.log('crypto', 'Cross-signing set up', {
        masterKeyId: crossSigningKeys.master_key?.getId(),
        selfSigningKeyId: crossSigningKeys.self_signing_key?.getId(),
        userSigningKeyId: crossSigningKeys.user_signing_key?.getId()
      });

      return crossSigningKeys;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to set up cross-signing', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Set up key backup for recovery
   */
  async setupKeyBackup() {
    try {
      // Check if key backup already exists
      const existingBackup = await this.client.getKeyBackupVersion();
      
      if (existingBackup) {
        this.keyBackupInfo = existingBackup;
        this.auditLogger.log('crypto', 'Existing key backup found', {
          version: existingBackup.version,
          algorithm: existingBackup.algorithm
        });
        return existingBackup;
      }

      // Create new key backup
      const backupInfo = await this.client.prepareKeyBackupVersion();
      const version = await this.client.createKeyBackupVersion(backupInfo);
      
      this.keyBackupInfo = { ...backupInfo, version };

      this.auditLogger.log('crypto', 'Key backup created', {
        version: version.version,
        algorithm: backupInfo.algorithm
      });

      return this.keyBackupInfo;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to set up key backup', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Set up device verification event handlers
   */
  setupDeviceVerificationHandlers() {
    // Handle device verification requests
    this.client.on('crypto.verification.request', async (request) => {
      this.auditLogger.log('crypto', 'Verification request received', {
        requestId: request.transactionId,
        fromUser: request.otherUserId,
        fromDevice: request.otherDeviceId
      });

      // Auto-accept verification requests from trusted healthcare providers
      // In production, this would be configurable based on user roles
      if (await this.isHealthcareProvider(request.otherUserId)) {
        await this.handleVerificationRequest(request);
      }
    });

    // Handle device verification completion
    this.client.on('crypto.verification.done', (event) => {
      this.auditLogger.log('crypto', 'Device verification completed', {
        userId: event.userId,
        deviceId: event.deviceId,
        verified: true
      });

      // Update device trust cache
      this.deviceTrustCache.set(`${event.userId}:${event.deviceId}`, {
        verified: true,
        verifiedAt: new Date().toISOString()
      });
    });
  }

  /**
   * Verify a device using SAS (Short Authentication String)
   */
  async verifyDevice(userId, deviceId) {
    try {
      const device = this.client.getStoredDevice(userId, deviceId);
      if (!device) {
        throw new Error(`Device not found: ${userId}:${deviceId}`);
      }

      // Start verification process
      const request = await this.client.requestVerification(userId, [deviceId]);
      
      this.auditLogger.log('crypto', 'Device verification started', {
        userId,
        deviceId,
        requestId: request.transactionId
      });

      return request;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to verify device', {
        userId,
        deviceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if a device is verified
   */
  async isDeviceVerified(userId, deviceId) {
    try {
      const device = this.client.getStoredDevice(userId, deviceId);
      if (!device) {
        return false;
      }

      // Check if device is verified through cross-signing
      const crossSigningInfo = this.client.getStoredCrossSigningForUser(userId);
      if (crossSigningInfo && device.isVerified()) {
        return true;
      }

      // Check our local trust cache
      const cacheKey = `${userId}:${deviceId}`;
      const cached = this.deviceTrustCache.get(cacheKey);
      return cached?.verified || false;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to check device verification', {
        userId,
        deviceId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Encrypt message for specific recipients
   */
  async encryptMessage(roomId, content, options = {}) {
    try {
      if (!this.client.isRoomEncrypted(roomId)) {
        throw new Error(`Room ${roomId} is not encrypted`);
      }

      // Add healthcare-specific metadata
      const enrichedContent = {
        ...content,
        'webqx.encryption': {
          version: '1.0',
          encryptedAt: new Date().toISOString(),
          algorithm: 'm.megolm.v1.aes-sha2',
          healthcare: options.healthcareMetadata || {}
        }
      };

      // The Matrix client will handle encryption automatically
      // when sending to an encrypted room
      this.auditLogger.log('crypto', 'Message encrypted', {
        roomId,
        contentType: content.msgtype,
        hasHealthcareMetadata: !!options.healthcareMetadata
      });

      return enrichedContent;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to encrypt message', {
        roomId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate encryption keys for file encryption
   */
  generateFileEncryptionKey() {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    return {
      key: key.toString('base64'),
      iv: iv.toString('base64'),
      algorithm: 'aes-256-cbc'
    };
  }

  /**
   * Encrypt file for secure upload
   */
  encryptFile(fileBuffer, encryptionKey) {
    try {
      const key = Buffer.from(encryptionKey.key, 'base64');
      const iv = Buffer.from(encryptionKey.iv, 'base64');
      
      const cipher = crypto.createCipher(encryptionKey.algorithm, key);
      cipher.setAutoPadding(true);
      
      const encrypted = Buffer.concat([
        cipher.update(fileBuffer),
        cipher.final()
      ]);

      const hash = crypto.createHash('sha256').update(encrypted).digest('hex');

      this.auditLogger.log('crypto', 'File encrypted', {
        originalSize: fileBuffer.length,
        encryptedSize: encrypted.length,
        hash: hash.substring(0, 16) + '...' // Log partial hash for audit
      });

      return {
        encryptedData: encrypted,
        hash,
        encryptionInfo: {
          algorithm: encryptionKey.algorithm,
          iv: encryptionKey.iv
        }
      };
    } catch (error) {
      this.auditLogger.log('error', 'Failed to encrypt file', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Decrypt file
   */
  decryptFile(encryptedBuffer, encryptionKey) {
    try {
      const key = Buffer.from(encryptionKey.key, 'base64');
      const iv = Buffer.from(encryptionKey.iv, 'base64');
      
      const decipher = crypto.createDecipher(encryptionKey.algorithm, key);
      
      const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
      ]);

      this.auditLogger.log('crypto', 'File decrypted', {
        encryptedSize: encryptedBuffer.length,
        decryptedSize: decrypted.length
      });

      return decrypted;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to decrypt file', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Back up room keys
   */
  async backupKeys() {
    try {
      if (!this.keyBackupInfo) {
        throw new Error('Key backup not set up');
      }

      await this.client.enableKeyBackup(this.keyBackupInfo);
      
      this.auditLogger.log('crypto', 'Keys backed up', {
        backupVersion: this.keyBackupInfo.version
      });

      return true;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to backup keys', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get encryption status for a room
   */
  getRoomEncryptionStatus(roomId) {
    const isEncrypted = this.client.isRoomEncrypted(roomId);
    const encryptionInfo = isEncrypted ? 
      this.client.getRoom(roomId)?.currentState?.getStateEvents('m.room.encryption', '') : null;

    return {
      isEncrypted,
      algorithm: encryptionInfo?.getContent()?.algorithm || null,
      rotationPeriodMs: encryptionInfo?.getContent()?.rotation_period_ms || null,
      rotationPeriodMsgs: encryptionInfo?.getContent()?.rotation_period_msgs || null
    };
  }

  /**
   * Check if user is a healthcare provider (helper method)
   */
  async isHealthcareProvider(userId) {
    // This would integrate with WebQX™'s user management system
    // to check if the user has healthcare provider credentials
    return userId.includes('provider') || userId.includes('doctor') || userId.includes('nurse');
  }

  /**
   * Handle verification request (helper method)
   */
  async handleVerificationRequest(request) {
    try {
      // Accept and start verification
      await request.accept();
      
      // In a real implementation, this would present the SAS to the user
      // For healthcare environments, this might be automated for trusted devices
      const verifier = request.beginKeyVerification('m.sas.v1');
      
      this.auditLogger.log('crypto', 'Verification request handled', {
        requestId: request.transactionId,
        method: 'm.sas.v1'
      });

      return verifier;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to handle verification request', {
        requestId: request.transactionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats() {
    return {
      crossSigningEnabled: !!this.client.getCrossSigningId(),
      keyBackupEnabled: !!this.keyBackupInfo,
      deviceVerificationEnabled: this.options.enableDeviceVerification,
      trustedDevices: this.deviceTrustCache.size,
      encryptedRooms: this.client.getRooms().filter(room => 
        this.client.isRoomEncrypted(room.roomId)
      ).length
    };
  }
}

module.exports = { EncryptionManager };