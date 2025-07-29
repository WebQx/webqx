/**
 * HIPAA Encryption Service
 * 
 * Provides AES-256-GCM encryption for PHI data at rest and secure key management.
 * Ensures HIPAA compliance for all Protected Health Information storage.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const crypto = require('crypto');
const { promisify } = require('util');

/**
 * HIPAA-compliant encryption service using AES-256-GCM
 */
class HIPAAEncryption {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16;  // 128 bits
        this.tagLength = 16; // 128 bits
        this.masterKey = this.getMasterKey();
    }

    /**
     * Get master encryption key from environment
     * @returns {Buffer} Master encryption key
     */
    getMasterKey() {
        const keyString = process.env.ENCRYPTION_KEY || process.env.HIPAA_ENCRYPTION_KEY;
        
        if (!keyString || keyString.length < 64) {
            throw new Error('HIPAA_ENCRYPTION_KEY environment variable must be at least 64 characters for security');
        }

        // Use first 32 bytes of SHA-256 hash of the key string
        return crypto.createHash('sha256').update(keyString).digest().slice(0, this.keyLength);
    }

    /**
     * Generate a random data encryption key
     * @returns {Buffer} Random 256-bit key
     */
    generateDataKey() {
        return crypto.randomBytes(this.keyLength);
    }

    /**
     * Generate a random initialization vector
     * @returns {Buffer} Random IV
     */
    generateIV() {
        return crypto.randomBytes(this.ivLength);
    }

    /**
     * Encrypt PHI data with AES-256-GCM
     * @param {string|Buffer} data - Data to encrypt
     * @param {Object} metadata - Additional metadata for encryption context
     * @returns {Object} Encrypted data with metadata
     */
    encryptPHI(data, metadata = {}) {
        try {
            // Convert string data to buffer
            const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
            
            // Generate unique key and IV for this encryption
            const dataKey = this.generateDataKey();
            const iv = this.generateIV();
            
            // Create cipher
            const cipher = crypto.createCipher(this.algorithm, dataKey, iv);
            
            // Encrypt the data
            const encrypted = Buffer.concat([
                cipher.update(dataBuffer),
                cipher.final()
            ]);
            
            // Get authentication tag
            const tag = cipher.getAuthTag();
            
            // Encrypt the data key with master key
            const keyIV = this.generateIV();
            const keyCipher = crypto.createCipher(this.algorithm, this.masterKey, keyIV);
            const encryptedKey = Buffer.concat([
                keyCipher.update(dataKey),
                keyCipher.final()
            ]);
            const keyTag = keyCipher.getAuthTag();

            // Create encrypted package
            const encryptedPackage = {
                algorithm: this.algorithm,
                encryptedData: encrypted.toString('base64'),
                iv: iv.toString('base64'),
                tag: tag.toString('base64'),
                encryptedKey: encryptedKey.toString('base64'),
                keyIV: keyIV.toString('base64'),
                keyTag: keyTag.toString('base64'),
                timestamp: new Date().toISOString(),
                metadata: {
                    ...metadata,
                    originalSize: dataBuffer.length,
                    encryptedSize: encrypted.length
                }
            };

            return {
                success: true,
                data: encryptedPackage,
                size: encrypted.length
            };

        } catch (error) {
            console.error('PHI encryption failed:', error);
            return {
                success: false,
                error: 'Encryption failed',
                details: error.message
            };
        }
    }

    /**
     * Decrypt PHI data with AES-256-GCM
     * @param {Object} encryptedPackage - Encrypted package from encryptPHI
     * @returns {Object} Decrypted data
     */
    decryptPHI(encryptedPackage) {
        try {
            // Validate encrypted package structure
            const required = ['encryptedData', 'iv', 'tag', 'encryptedKey', 'keyIV', 'keyTag'];
            for (const field of required) {
                if (!encryptedPackage[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            // Decrypt the data key first
            const keyIV = Buffer.from(encryptedPackage.keyIV, 'base64');
            const encryptedKey = Buffer.from(encryptedPackage.encryptedKey, 'base64');
            const keyTag = Buffer.from(encryptedPackage.keyTag, 'base64');
            
            const keyDecipher = crypto.createDecipher(this.algorithm, this.masterKey, keyIV);
            keyDecipher.setAuthTag(keyTag);
            
            const dataKey = Buffer.concat([
                keyDecipher.update(encryptedKey),
                keyDecipher.final()
            ]);

            // Decrypt the actual data
            const iv = Buffer.from(encryptedPackage.iv, 'base64');
            const encryptedData = Buffer.from(encryptedPackage.encryptedData, 'base64');
            const tag = Buffer.from(encryptedPackage.tag, 'base64');
            
            const decipher = crypto.createDecipher(this.algorithm, dataKey, iv);
            decipher.setAuthTag(tag);
            
            const decrypted = Buffer.concat([
                decipher.update(encryptedData),
                decipher.final()
            ]);

            return {
                success: true,
                data: decrypted.toString('utf8'),
                metadata: encryptedPackage.metadata || {},
                originalSize: encryptedPackage.metadata?.originalSize || decrypted.length
            };

        } catch (error) {
            console.error('PHI decryption failed:', error);
            return {
                success: false,
                error: 'Decryption failed',
                details: error.message
            };
        }
    }

    /**
     * Encrypt PACS DICOM metadata with specialized handling
     * @param {Object} dicomMetadata - DICOM metadata object
     * @param {string} patientId - Patient identifier
     * @returns {Object} Encrypted DICOM metadata
     */
    encryptDICOMMetadata(dicomMetadata, patientId) {
        const metadata = {
            type: 'DICOM_METADATA',
            patientId: patientId,
            timestamp: new Date().toISOString(),
            compliance: 'HIPAA'
        };

        // Separate PHI fields from technical metadata
        const phiFields = this.extractPHIFromDICOM(dicomMetadata);
        const technicalFields = this.extractTechnicalFromDICOM(dicomMetadata);

        // Encrypt only PHI fields
        const encryptedPHI = this.encryptPHI(JSON.stringify(phiFields), metadata);
        
        if (!encryptedPHI.success) {
            return encryptedPHI;
        }

        return {
            success: true,
            data: {
                encrypted_phi: encryptedPHI.data,
                technical_metadata: technicalFields,
                metadata: metadata
            }
        };
    }

    /**
     * Decrypt PACS DICOM metadata
     * @param {Object} encryptedDICOM - Encrypted DICOM package
     * @returns {Object} Decrypted DICOM metadata
     */
    decryptDICOMMetadata(encryptedDICOM) {
        if (!encryptedDICOM.encrypted_phi) {
            return {
                success: false,
                error: 'Invalid encrypted DICOM package'
            };
        }

        const decryptedPHI = this.decryptPHI(encryptedDICOM.encrypted_phi);
        
        if (!decryptedPHI.success) {
            return decryptedPHI;
        }

        try {
            const phiFields = JSON.parse(decryptedPHI.data);
            const fullMetadata = {
                ...encryptedDICOM.technical_metadata,
                ...phiFields
            };

            return {
                success: true,
                data: fullMetadata,
                metadata: encryptedDICOM.metadata
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to parse decrypted PHI',
                details: error.message
            };
        }
    }

    /**
     * Extract PHI fields from DICOM metadata
     * @param {Object} dicomMetadata - DICOM metadata
     * @returns {Object} PHI fields only
     */
    extractPHIFromDICOM(dicomMetadata) {
        const phiFields = {};
        const phiTags = [
            'PatientName', 'PatientID', 'PatientBirthDate', 'PatientSex',
            'PatientAddress', 'PatientTelephoneNumbers', 'PatientComments',
            'PhysicianName', 'ReferringPhysicianName', 'OperatorName',
            'InstitutionName', 'InstitutionAddress', 'StationName'
        ];

        phiTags.forEach(tag => {
            if (dicomMetadata[tag]) {
                phiFields[tag] = dicomMetadata[tag];
            }
        });

        return phiFields;
    }

    /**
     * Extract technical (non-PHI) fields from DICOM metadata
     * @param {Object} dicomMetadata - DICOM metadata
     * @returns {Object} Technical fields only
     */
    extractTechnicalFromDICOM(dicomMetadata) {
        const technicalFields = {};
        const phiTags = [
            'PatientName', 'PatientID', 'PatientBirthDate', 'PatientSex',
            'PatientAddress', 'PatientTelephoneNumbers', 'PatientComments',
            'PhysicianName', 'ReferringPhysicianName', 'OperatorName',
            'InstitutionName', 'InstitutionAddress', 'StationName'
        ];

        Object.keys(dicomMetadata).forEach(tag => {
            if (!phiTags.includes(tag)) {
                technicalFields[tag] = dicomMetadata[tag];
            }
        });

        return technicalFields;
    }

    /**
     * Generate encryption key for new installation
     * @returns {string} Base64 encoded random key
     */
    static generateNewEncryptionKey() {
        const key = crypto.randomBytes(64);
        return key.toString('base64');
    }

    /**
     * Validate encryption key strength
     * @param {string} key - Key to validate
     * @returns {Object} Validation result
     */
    static validateEncryptionKey(key) {
        if (!key || key.length < 64) {
            return {
                valid: false,
                error: 'Key must be at least 64 characters'
            };
        }

        return {
            valid: true,
            strength: 'strong',
            length: key.length
        };
    }
}

module.exports = HIPAAEncryption;