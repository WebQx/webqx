import * as crypto from 'crypto';
import { SSOError } from '../types/common';

/**
 * Cryptographic utilities for SSO module
 * Provides secure encryption, decryption, and hashing functions
 */
export class CryptoUtils {
  private static algorithm = 'aes-256-gcm';
  private static keyLength = 32; // 256 bits

  /**
   * Generate a secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a cryptographically secure state parameter
   */
  static generateState(): string {
    return this.generateSecureRandom(16);
  }

  /**
   * Generate a nonce for OIDC
   */
  static generateNonce(): string {
    return this.generateSecureRandom(16);
  }

  /**
   * Hash a string using SHA-256
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * Create HMAC signature
   */
  static createHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  static verifyHMAC(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Encrypt sensitive data
   */
  static encrypt(text: string, secretKey: string): string {
    try {
      // Derive key from secret
      const key = crypto.scryptSync(secretKey, 'salt', this.keyLength);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv) as crypto.CipherGCM;
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new SSOError('Encryption failed', 'CRYPTO_ERROR');
    }
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: string, secretKey: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      // Derive key from secret
      const key = crypto.scryptSync(secretKey, 'salt', this.keyLength);
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new SSOError('Decryption failed', 'CRYPTO_ERROR');
    }
  }

  /**
   * Generate key pair for SAML signing
   */
  static generateKeyPair(): { privateKey: string; publicKey: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return { privateKey, publicKey };
  }

  /**
   * Sign data with private key
   */
  static signData(data: string, privateKey: string): string {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data, 'utf8');
    return sign.sign(privateKey, 'base64');
  }

  /**
   * Verify signature with public key
   */
  static verifySignature(data: string, signature: string, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(data, 'utf8');
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  static safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8')
    );
  }

  /**
   * Generate certificate serial number
   */
  static generateSerialNumber(): string {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
  }
}