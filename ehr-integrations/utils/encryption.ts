/**
 * Encryption Utilities for EHR Integration
 * 
 * Provides secure encryption and decryption functions for sensitive data
 * including patient information, authentication credentials, and other
 * confidential data. Ensures HIPAA compliance and data security.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  /** Encryption algorithm */
  algorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'aes-192-gcm' | 'aes-128-gcm';
  /** Key derivation function */
  keyDerivation: 'pbkdf2' | 'scrypt' | 'argon2';
  /** Number of iterations for key derivation */
  iterations: number;
  /** Salt length in bytes */
  saltLength: number;
  /** IV/Nonce length in bytes */
  ivLength: number;
  /** Tag length for authenticated encryption */
  tagLength: number;
  /** Memory cost for scrypt/argon2 */
  memoryCost?: number;
  /** Time cost for argon2 */
  timeCost?: number;
  /** Parallelism for argon2 */
  parallelism?: number;
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  /** Encrypted data (base64 encoded) */
  data: string;
  /** Salt used for key derivation (base64 encoded) */
  salt: string;
  /** Initialization vector/nonce (base64 encoded) */
  iv: string;
  /** Authentication tag for verified encryption (base64 encoded) */
  tag?: string;
  /** Algorithm used for encryption */
  algorithm: string;
  /** Key derivation function used */
  keyDerivation: string;
  /** Number of iterations used */
  iterations: number;
  /** Additional parameters for key derivation */
  params?: Record<string, unknown>;
}

/**
 * Key derivation result
 */
interface DerivedKey {
  /** Derived key buffer */
  key: ArrayBuffer;
  /** Salt used */
  salt: ArrayBuffer;
}

/**
 * Default encryption configuration
 */
const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  iterations: 100000,
  saltLength: 32,
  ivLength: 12,
  tagLength: 16
};

/**
 * Encryption service class
 */
export class EncryptionService {
  private config: EncryptionConfig;
  private masterKey?: string;

  /**
   * Constructor
   * @param config Encryption configuration
   */
  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeMasterKey();
  }

  /**
   * Set master key for encryption
   * @param masterKey Master key for encryption
   */
  setMasterKey(masterKey: string): void {
    this.masterKey = masterKey;
  }

  /**
   * Encrypt sensitive data
   * @param plaintext Data to encrypt
   * @param password Optional password (uses master key if not provided)
   * @returns Promise resolving to encrypted data
   */
  async encrypt(plaintext: string, password?: string): Promise<EncryptedData> {
    try {
      if (!plaintext) {
        throw new Error('Plaintext cannot be empty');
      }

      const keyPassword = password || this.masterKey;
      if (!keyPassword) {
        throw new Error('No encryption password or master key available');
      }

      // Generate salt and IV
      const salt = this.generateRandomBytes(this.config.saltLength);
      const iv = this.generateRandomBytes(this.config.ivLength);

      // Derive encryption key
      const derivedKey = await this.deriveKey(keyPassword, salt);

      // Encrypt data
      const encryptedResult = await this.performEncryption(plaintext, derivedKey.key, iv);

      // Prepare result
      const result: EncryptedData = {
        data: this.arrayBufferToBase64(encryptedResult.data),
        salt: this.arrayBufferToBase64(salt),
        iv: this.arrayBufferToBase64(iv),
        algorithm: this.config.algorithm,
        keyDerivation: this.config.keyDerivation,
        iterations: this.config.iterations
      };

      // Add authentication tag if available
      if (encryptedResult.tag) {
        result.tag = this.arrayBufferToBase64(encryptedResult.tag);
      }

      // Add additional parameters for certain KDFs
      if (this.config.keyDerivation === 'scrypt' || this.config.keyDerivation === 'argon2') {
        result.params = {
          memoryCost: this.config.memoryCost,
          timeCost: this.config.timeCost,
          parallelism: this.config.parallelism
        };
      }

      return result;

    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive data
   * @param encryptedData Encrypted data to decrypt
   * @param password Optional password (uses master key if not provided)
   * @returns Promise resolving to decrypted plaintext
   */
  async decrypt(encryptedData: EncryptedData, password?: string): Promise<string> {
    try {
      if (!encryptedData || !encryptedData.data) {
        throw new Error('Invalid encrypted data');
      }

      const keyPassword = password || this.masterKey;
      if (!keyPassword) {
        throw new Error('No decryption password or master key available');
      }

      // Convert base64 data back to ArrayBuffers
      const data = this.base64ToArrayBuffer(encryptedData.data);
      const salt = this.base64ToArrayBuffer(encryptedData.salt);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const tag = encryptedData.tag ? this.base64ToArrayBuffer(encryptedData.tag) : undefined;

      // Derive decryption key using same parameters
      const derivedKey = await this.deriveKeyWithParams(
        keyPassword,
        salt,
        encryptedData.keyDerivation,
        encryptedData.iterations,
        encryptedData.params
      );

      // Decrypt data
      const plaintext = await this.performDecryption(
        data,
        derivedKey,
        iv,
        tag,
        encryptedData.algorithm
      );

      return plaintext;

    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a secure hash of data
   * @param data Data to hash
   * @param algorithm Hash algorithm
   * @returns Promise resolving to hash (base64 encoded)
   */
  async hash(data: string, algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
      return this.arrayBufferToBase64(hashBuffer);
    } catch (error) {
      throw new Error(`Hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate HMAC for data integrity verification
   * @param data Data to create HMAC for
   * @param key HMAC key
   * @param algorithm HMAC algorithm
   * @returns Promise resolving to HMAC (base64 encoded)
   */
  async hmac(
    data: string,
    key: string,
    algorithm: 'HMAC-SHA-256' | 'HMAC-SHA-384' | 'HMAC-SHA-512' = 'HMAC-SHA-256'
  ): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const keyBuffer = encoder.encode(key);
      const dataBuffer = encoder.encode(data);

      const hmacKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'HMAC', hash: algorithm.replace('HMAC-', '') },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', hmacKey, dataBuffer);
      return this.arrayBufferToBase64(signature);
    } catch (error) {
      throw new Error(`HMAC generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify HMAC
   * @param data Original data
   * @param signature HMAC signature to verify
   * @param key HMAC key
   * @param algorithm HMAC algorithm
   * @returns Promise resolving to verification result
   */
  async verifyHmac(
    data: string,
    signature: string,
    key: string,
    algorithm: 'HMAC-SHA-256' | 'HMAC-SHA-384' | 'HMAC-SHA-512' = 'HMAC-SHA-256'
  ): Promise<boolean> {
    try {
      const expectedSignature = await this.hmac(data, key, algorithm);
      return this.constantTimeEquals(signature, expectedSignature);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate cryptographically secure random string
   * @param length Length of random string
   * @param charset Character set to use
   * @returns Random string
   */
  generateRandomString(length: number, charset?: string): string {
    const defaultCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const chars = charset || defaultCharset;
    
    const randomBytes = this.generateRandomBytes(length);
    const randomArray = new Uint8Array(randomBytes);
    
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[randomArray[i] % chars.length];
    }
    
    return result;
  }

  /**
   * Generate cryptographically secure UUID
   * @returns UUID string
   */
  generateUUID(): string {
    const randomBytes = this.generateRandomBytes(16);
    const bytes = new Uint8Array(randomBytes);
    
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32)
    ].join('-');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Initialize master key from environment or generate one
   */
  private initializeMasterKey(): void {
    // In a real application, this would come from environment variables
    // or a secure key management system
    this.masterKey = process?.env?.WEBQX_ENCRYPTION_KEY || this.generateRandomString(64);
  }

  /**
   * Derive encryption key from password
   * @param password Password to derive key from
   * @param salt Salt for key derivation
   * @returns Promise resolving to derived key
   */
  private async deriveKey(password: string, salt: ArrayBuffer): Promise<DerivedKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    let derivedKey: ArrayBuffer;

    switch (this.config.keyDerivation) {
      case 'pbkdf2':
        derivedKey = await this.deriveKeyPBKDF2(passwordBuffer, salt);
        break;
      case 'scrypt':
        derivedKey = await this.deriveKeyScrypt(passwordBuffer, salt);
        break;
      case 'argon2':
        derivedKey = await this.deriveKeyArgon2(passwordBuffer, salt);
        break;
      default:
        throw new Error(`Unsupported key derivation function: ${this.config.keyDerivation}`);
    }

    return { key: derivedKey, salt };
  }

  /**
   * Derive key with specific parameters
   * @param password Password
   * @param salt Salt
   * @param keyDerivation Key derivation function
   * @param iterations Iterations
   * @param params Additional parameters
   * @returns Promise resolving to derived key
   */
  private async deriveKeyWithParams(
    password: string,
    salt: ArrayBuffer,
    keyDerivation: string,
    iterations: number,
    params?: Record<string, unknown>
  ): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    switch (keyDerivation) {
      case 'pbkdf2':
        return this.deriveKeyPBKDF2(passwordBuffer, salt, iterations);
      case 'scrypt':
        return this.deriveKeyScrypt(passwordBuffer, salt, params);
      case 'argon2':
        return this.deriveKeyArgon2(passwordBuffer, salt, params);
      default:
        throw new Error(`Unsupported key derivation function: ${keyDerivation}`);
    }
  }

  /**
   * Derive key using PBKDF2
   * @param password Password buffer
   * @param salt Salt buffer
   * @param iterations Number of iterations
   * @returns Promise resolving to derived key
   */
  private async deriveKeyPBKDF2(
    password: ArrayBuffer,
    salt: ArrayBuffer,
    iterations?: number
  ): Promise<ArrayBuffer> {
    const importedKey = await crypto.subtle.importKey(
      'raw',
      password,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const keyBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations || this.config.iterations,
        hash: 'SHA-256'
      },
      importedKey,
      256 // 32 bytes for AES-256
    );

    return keyBits;
  }

  /**
   * Derive key using scrypt (mock implementation)
   * @param password Password buffer
   * @param salt Salt buffer
   * @param params Additional parameters
   * @returns Promise resolving to derived key
   */
  private async deriveKeyScrypt(
    password: ArrayBuffer,
    salt: ArrayBuffer,
    params?: Record<string, unknown>
  ): Promise<ArrayBuffer> {
    // Mock implementation - in production, use a proper scrypt library
    // For now, fall back to PBKDF2
    console.warn('Scrypt not implemented, falling back to PBKDF2');
    return this.deriveKeyPBKDF2(password, salt);
  }

  /**
   * Derive key using Argon2 (mock implementation)
   * @param password Password buffer
   * @param salt Salt buffer
   * @param params Additional parameters
   * @returns Promise resolving to derived key
   */
  private async deriveKeyArgon2(
    password: ArrayBuffer,
    salt: ArrayBuffer,
    params?: Record<string, unknown>
  ): Promise<ArrayBuffer> {
    // Mock implementation - in production, use a proper Argon2 library
    // For now, fall back to PBKDF2
    console.warn('Argon2 not implemented, falling back to PBKDF2');
    return this.deriveKeyPBKDF2(password, salt);
  }

  /**
   * Perform encryption
   * @param plaintext Plaintext to encrypt
   * @param key Encryption key
   * @param iv Initialization vector
   * @returns Promise resolving to encrypted data
   */
  private async performEncryption(
    plaintext: string,
    key: ArrayBuffer,
    iv: ArrayBuffer
  ): Promise<{ data: ArrayBuffer; tag?: ArrayBuffer }> {
    const encoder = new TextEncoder();
    const plaintextBuffer = encoder.encode(plaintext);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: this.getAlgorithmName(this.config.algorithm) },
      false,
      ['encrypt']
    );

    const algorithm = this.getEncryptionParams(this.config.algorithm, iv);
    const encryptedData = await crypto.subtle.encrypt(algorithm, cryptoKey, plaintextBuffer);

    // For GCM mode, extract the tag
    if (this.config.algorithm.includes('gcm')) {
      const dataLength = encryptedData.byteLength - this.config.tagLength;
      const data = encryptedData.slice(0, dataLength);
      const tag = encryptedData.slice(dataLength);
      return { data, tag };
    }

    return { data: encryptedData };
  }

  /**
   * Perform decryption
   * @param encryptedData Encrypted data
   * @param key Decryption key
   * @param iv Initialization vector
   * @param tag Authentication tag
   * @param algorithm Encryption algorithm
   * @returns Promise resolving to plaintext
   */
  private async performDecryption(
    encryptedData: ArrayBuffer,
    key: ArrayBuffer,
    iv: ArrayBuffer,
    tag?: ArrayBuffer,
    algorithm?: string
  ): Promise<string> {
    const alg = algorithm || this.config.algorithm;
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: this.getAlgorithmName(alg) },
      false,
      ['decrypt']
    );

    let dataToDecrypt = encryptedData;
    
    // For GCM mode, combine data and tag
    if (alg.includes('gcm') && tag) {
      const combined = new Uint8Array(encryptedData.byteLength + tag.byteLength);
      combined.set(new Uint8Array(encryptedData), 0);
      combined.set(new Uint8Array(tag), encryptedData.byteLength);
      dataToDecrypt = combined.buffer;
    }

    const algorithmParams = this.getEncryptionParams(alg, iv);
    const decryptedData = await crypto.subtle.decrypt(algorithmParams, cryptoKey, dataToDecrypt);

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  }

  /**
   * Get algorithm name for Web Crypto API
   * @param algorithm Algorithm string
   * @returns Algorithm name
   */
  private getAlgorithmName(algorithm: string): string {
    if (algorithm.includes('gcm')) {
      return 'AES-GCM';
    } else if (algorithm.includes('cbc')) {
      return 'AES-CBC';
    }
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  /**
   * Get encryption parameters for Web Crypto API
   * @param algorithm Algorithm string
   * @param iv Initialization vector
   * @returns Algorithm parameters
   */
  private getEncryptionParams(algorithm: string, iv: ArrayBuffer): AlgorithmIdentifier {
    if (algorithm.includes('gcm')) {
      return {
        name: 'AES-GCM',
        iv: iv,
        tagLength: this.config.tagLength * 8 // Convert bytes to bits
      };
    } else if (algorithm.includes('cbc')) {
      return {
        name: 'AES-CBC',
        iv: iv
      };
    }
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  /**
   * Generate cryptographically secure random bytes
   * @param length Number of bytes to generate
   * @returns ArrayBuffer with random bytes
   */
  private generateRandomBytes(length: number): ArrayBuffer {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes.buffer;
  }

  /**
   * Convert ArrayBuffer to base64 string
   * @param buffer ArrayBuffer to convert
   * @returns Base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   * @param base64 Base64 string to convert
   * @returns ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Constant time string comparison to prevent timing attacks
   * @param a First string
   * @param b Second string
   * @returns Whether strings are equal
   */
  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

let defaultEncryptionService: EncryptionService;

/**
 * Get default encryption service instance
 * @returns Default encryption service
 */
function getDefaultService(): EncryptionService {
  if (!defaultEncryptionService) {
    defaultEncryptionService = new EncryptionService();
  }
  return defaultEncryptionService;
}

/**
 * Encrypt sensitive data using default service
 * @param plaintext Data to encrypt
 * @param password Optional password
 * @returns Promise resolving to encrypted data
 */
export async function encryptSensitiveData(plaintext: string, password?: string): Promise<string> {
  const service = getDefaultService();
  const encrypted = await service.encrypt(plaintext, password);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt sensitive data using default service
 * @param encryptedData Encrypted data (JSON string)
 * @param password Optional password
 * @returns Promise resolving to plaintext
 */
export async function decryptSensitiveData(encryptedData: string, password?: string): Promise<string> {
  const service = getDefaultService();
  const encrypted = JSON.parse(encryptedData) as EncryptedData;
  return service.decrypt(encrypted, password);
}

/**
 * Hash data using default service
 * @param data Data to hash
 * @param algorithm Hash algorithm
 * @returns Promise resolving to hash
 */
export async function hashData(
  data: string,
  algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'
): Promise<string> {
  const service = getDefaultService();
  return service.hash(data, algorithm);
}

/**
 * Generate HMAC using default service
 * @param data Data to create HMAC for
 * @param key HMAC key
 * @param algorithm HMAC algorithm
 * @returns Promise resolving to HMAC
 */
export async function generateHMAC(
  data: string,
  key: string,
  algorithm: 'HMAC-SHA-256' | 'HMAC-SHA-384' | 'HMAC-SHA-512' = 'HMAC-SHA-256'
): Promise<string> {
  const service = getDefaultService();
  return service.hmac(data, key, algorithm);
}

/**
 * Verify HMAC using default service
 * @param data Original data
 * @param signature HMAC signature
 * @param key HMAC key
 * @param algorithm HMAC algorithm
 * @returns Promise resolving to verification result
 */
export async function verifyHMAC(
  data: string,
  signature: string,
  key: string,
  algorithm: 'HMAC-SHA-256' | 'HMAC-SHA-384' | 'HMAC-SHA-512' = 'HMAC-SHA-256'
): Promise<boolean> {
  const service = getDefaultService();
  return service.verifyHmac(data, signature, key, algorithm);
}

/**
 * Generate secure random string
 * @param length Length of string
 * @param charset Character set
 * @returns Random string
 */
export function generateSecureRandom(length: number, charset?: string): string {
  const service = getDefaultService();
  return service.generateRandomString(length, charset);
}

/**
 * Generate UUID
 * @returns UUID string
 */
export function generateUUID(): string {
  const service = getDefaultService();
  return service.generateUUID();
}

export default EncryptionService;