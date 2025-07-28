const crypto = require('crypto');
const CryptoJS = require('crypto-js');

/**
 * HIPAA-Compliant Encryption Utilities
 * Implements AES-256 encryption for data at rest and in transit
 */

class HIPAAEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.saltLength = 32; // 256 bits
    this.tagLength = 16; // 128 bits
    
    // Get encryption key from environment or generate one
    this.masterKey = process.env.ENCRYPTION_KEY || this.generateKey();
    
    if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
      console.warn('⚠️  WARNING: No ENCRYPTION_KEY found in environment. Using generated key.');
      console.warn('⚠️  This should be set as an environment variable in production.');
    }
  }

  /**
   * Generate a new encryption key
   * @returns {string} Base64 encoded key
   */
  generateKey() {
    return crypto.randomBytes(this.keyLength).toString('base64');
  }

  /**
   * Derive key from master key using PBKDF2
   * @param {string} salt - Salt for key derivation
   * @returns {Buffer} Derived key
   */
  deriveKey(salt) {
    return crypto.pbkdf2Sync(this.masterKey, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Encrypt sensitive data (PHI - Protected Health Information)
   * @param {string} plaintext - Data to encrypt
   * @param {string} context - Context for additional security (optional)
   * @returns {object} Encrypted data with metadata
   */
  encryptPHI(plaintext, context = '') {
    try {
      if (!plaintext) return null;
      
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      const key = this.deriveKey(salt);
      
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from(context, 'utf8'));
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        algorithm: this.algorithm,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Encryption error:', error.message);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive data (PHI)
   * @param {object} encryptedData - Encrypted data object
   * @param {string} context - Context used during encryption
   * @returns {string} Decrypted plaintext
   */
  decryptPHI(encryptedData, context = '') {
    try {
      if (!encryptedData || !encryptedData.encrypted) return null;
      
      const { encrypted, salt, iv, authTag, algorithm } = encryptedData;
      
      if (algorithm !== this.algorithm) {
        throw new Error('Algorithm mismatch');
      }
      
      const saltBuffer = Buffer.from(salt, 'base64');
      const ivBuffer = Buffer.from(iv, 'base64');
      const authTagBuffer = Buffer.from(authTag, 'base64');
      const key = this.deriveKey(saltBuffer);
      
      const decipher = crypto.createDecipher(algorithm, key);
      decipher.setAuthTag(authTagBuffer);
      decipher.setAAD(Buffer.from(context, 'utf8'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error.message);
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  /**
   * Hash sensitive data for storage (passwords, etc.)
   * @param {string} data - Data to hash
   * @param {number} rounds - Number of salt rounds (default: 12)
   * @returns {string} Hashed data
   */
  hashSensitive(data, rounds = 12) {
    const bcrypt = require('bcryptjs');
    return bcrypt.hashSync(data, rounds);
  }

  /**
   * Verify hashed data
   * @param {string} data - Original data
   * @param {string} hash - Hash to verify against
   * @returns {boolean} Verification result
   */
  verifySensitive(data, hash) {
    const bcrypt = require('bcryptjs');
    return bcrypt.compareSync(data, hash);
  }

  /**
   * Generate secure random token
   * @param {number} length - Token length in bytes
   * @returns {string} Random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Create HMAC signature for data integrity
   * @param {string} data - Data to sign
   * @param {string} secret - Secret key for signing
   * @returns {string} HMAC signature
   */
  createSignature(data, secret = this.masterKey) {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   * @param {string} data - Original data
   * @param {string} signature - Signature to verify
   * @param {string} secret - Secret key used for signing
   * @returns {boolean} Verification result
   */
  verifySignature(data, signature, secret = this.masterKey) {
    const expectedSignature = this.createSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
}

// Export singleton instance
module.exports = new HIPAAEncryption();