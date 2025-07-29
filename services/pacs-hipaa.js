/**
 * PACS HIPAA Compliance Service
 * 
 * Provides HIPAA-compliant Picture Archiving and Communication System (PACS) functionality.
 * Handles medical imaging with comprehensive audit trails, encryption, and access controls.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const HIPAAEncryption = require('./hipaa-encryption');
const { HIPAA_RBAC } = require('./hipaa-rbac');
const SimpleAuditLogger = require('./simple-audit-logger');

/**
 * PACS study types and their HIPAA sensitivity levels
 */
const STUDY_TYPES = {
    'CT': { name: 'Computed Tomography', sensitivity: 'HIGH', retention: '7_YEARS' },
    'MRI': { name: 'Magnetic Resonance Imaging', sensitivity: 'HIGH', retention: '7_YEARS' },
    'XRAY': { name: 'X-Ray', sensitivity: 'MEDIUM', retention: '7_YEARS' },
    'ULTRASOUND': { name: 'Ultrasound', sensitivity: 'MEDIUM', retention: '7_YEARS' },
    'MAMMOGRAPHY': { name: 'Mammography', sensitivity: 'HIGH', retention: '10_YEARS' },
    'NUCLEAR': { name: 'Nuclear Medicine', sensitivity: 'HIGH', retention: '7_YEARS' },
    'PET': { name: 'Positron Emission Tomography', sensitivity: 'HIGH', retention: '7_YEARS' },
    'FLUOROSCOPY': { name: 'Fluoroscopy', sensitivity: 'MEDIUM', retention: '7_YEARS' }
};

/**
 * PACS HIPAA Compliance Service
 */
class PACSHIPAAService {
    constructor(options = {}) {
        this.encryption = new HIPAAEncryption();
        this.auditLogger = new SimpleAuditLogger({
            enabled: true,
            logToConsole: true,
            retentionDays: 2555 // 7 years HIPAA requirement
        });
        this.rbac = new HIPAA_RBAC(this.auditLogger);
        
        this.config = {
            maxImageSize: options.maxImageSize || 100 * 1024 * 1024, // 100MB
            allowedImageTypes: options.allowedImageTypes || [
                'application/dicom',
                'image/jpeg',
                'image/png',
                'image/tiff'
            ],
            encryptionEnabled: options.encryptionEnabled !== false,
            auditEnabled: options.auditEnabled !== false,
            ...options
        };

        this.initializeService();
    }

    /**
     * Initialize PACS service
     */
    initializeService() {
        console.log('[PACS HIPAA] Service initialized with configuration:', {
            encryptionEnabled: this.config.encryptionEnabled,
            auditEnabled: this.config.auditEnabled,
            maxImageSize: this.config.maxImageSize,
            allowedTypes: this.config.allowedImageTypes.length
        });
    }

    /**
     * Upload medical image with HIPAA compliance
     * @param {Object} imageData - Image data and metadata
     * @param {Object} user - User uploading the image
     * @returns {Promise<Object>} Upload result
     */
    async uploadImage(imageData, user) {
        try {
            // Set audit context
            this.auditLogger.setContext({
                userId: user.id,
                userRole: user.role,
                ipAddress: user.ipAddress,
                userAgent: user.userAgent
            });

            // Check permissions
            const permissionCheck = await this.rbac.checkPermission(
                user.id,
                user.role,
                'pacs.upload_images',
                { patientId: imageData.patientId }
            );

            if (!permissionCheck.granted) {
                await this.auditLogger.log({
                    action: 'upload_image',
                    resourceType: 'pacs_image',
                    resourceId: 'upload_attempt',
                    patientMrn: imageData.patientId,
                    success: false,
                    errorMessage: permissionCheck.reason,
                    context: { permissionDenied: true }
                });

                return {
                    success: false,
                    error: 'Access denied',
                    code: permissionCheck.code
                };
            }

            // Validate image data
            const validation = this.validateImageData(imageData);
            if (!validation.valid) {
                await this.auditLogger.log({
                    action: 'upload_image',
                    resourceType: 'pacs_image',
                    resourceId: 'upload_attempt',
                    patientMrn: imageData.patientId,
                    success: false,
                    errorMessage: validation.error,
                    context: { validationFailed: true }
                });

                return {
                    success: false,
                    error: validation.error,
                    code: 'VALIDATION_ERROR'
                };
            }

            // Generate unique study ID
            const studyId = this.generateStudyId(imageData.studyType);

            // Prepare metadata for encryption
            const metadata = {
                studyId: studyId,
                patientId: imageData.patientId,
                studyType: imageData.studyType,
                uploadedBy: user.id,
                uploadTime: new Date().toISOString(),
                sensitivity: STUDY_TYPES[imageData.studyType]?.sensitivity || 'HIGH',
                retention: STUDY_TYPES[imageData.studyType]?.retention || '7_YEARS'
            };

            // Encrypt image data if enabled
            let encryptedImage = null;
            if (this.config.encryptionEnabled) {
                const encryptionResult = this.encryption.encryptPHI(
                    imageData.imageBuffer,
                    metadata
                );

                if (!encryptionResult.success) {
                    await this.auditLogger.log({
                        action: 'upload_image',
                        resourceType: 'pacs_image',
                        resourceId: studyId,
                        patientMrn: imageData.patientId,
                        success: false,
                        errorMessage: 'Encryption failed',
                        context: { encryptionFailed: true }
                    });

                    return {
                        success: false,
                        error: 'Image encryption failed',
                        code: 'ENCRYPTION_ERROR'
                    };
                }

                encryptedImage = encryptionResult.data;
            }

            // Encrypt DICOM metadata if present
            let encryptedMetadata = null;
            if (imageData.dicomMetadata) {
                const metadataEncryption = this.encryption.encryptDICOMMetadata(
                    imageData.dicomMetadata,
                    imageData.patientId
                );

                if (!metadataEncryption.success) {
                    await this.auditLogger.log({
                        action: 'upload_image',
                        resourceType: 'pacs_image',
                        resourceId: studyId,
                        patientMrn: imageData.patientId,
                        success: false,
                        errorMessage: 'Metadata encryption failed',
                        context: { metadataEncryptionFailed: true }
                    });

                    return {
                        success: false,
                        error: 'Metadata encryption failed',
                        code: 'METADATA_ENCRYPTION_ERROR'
                    };
                }

                encryptedMetadata = metadataEncryption.data;
            }

            // Store image (in real implementation, this would go to PACS storage)
            const storageResult = await this.storeImage({
                studyId: studyId,
                encryptedImage: encryptedImage,
                encryptedMetadata: encryptedMetadata,
                metadata: metadata
            });

            if (!storageResult.success) {
                await this.auditLogger.log({
                    action: 'upload_image',
                    resourceType: 'pacs_image',
                    resourceId: studyId,
                    patientMrn: imageData.patientId,
                    success: false,
                    errorMessage: 'Storage failed',
                    context: { storageFailed: true }
                });

                return storageResult;
            }

            // Log successful upload
            await this.auditLogger.log({
                action: 'upload_image',
                resourceType: 'pacs_image',
                resourceId: studyId,
                patientMrn: imageData.patientId,
                success: true,
                context: {
                    studyType: imageData.studyType,
                    imageSize: imageData.imageBuffer?.length || 0,
                    encrypted: this.config.encryptionEnabled,
                    sensitivity: metadata.sensitivity
                }
            });

            return {
                success: true,
                data: {
                    studyId: studyId,
                    uploadTime: metadata.uploadTime,
                    studyType: imageData.studyType,
                    encrypted: this.config.encryptionEnabled
                }
            };

        } catch (error) {
            console.error('PACS image upload failed:', error);
            
            await this.auditLogger.log({
                action: 'upload_image',
                resourceType: 'pacs_image',
                resourceId: 'unknown',
                patientMrn: imageData?.patientId || 'unknown',
                success: false,
                errorMessage: error.message,
                context: { systemError: true }
            });

            return {
                success: false,
                error: 'Image upload failed',
                code: 'SYSTEM_ERROR'
            };
        }
    }

    /**
     * Retrieve medical image with HIPAA compliance
     * @param {string} studyId - Study identifier
     * @param {Object} user - User requesting the image
     * @returns {Promise<Object>} Image retrieval result
     */
    async retrieveImage(studyId, user) {
        try {
            // Set audit context
            this.auditLogger.setContext({
                userId: user.id,
                userRole: user.role,
                ipAddress: user.ipAddress,
                userAgent: user.userAgent
            });

            // Get study metadata to check patient access
            const studyMetadata = await this.getStudyMetadata(studyId);
            if (!studyMetadata.success) {
                return studyMetadata;
            }

            // Check permissions
            const permissionCheck = await this.rbac.checkPermission(
                user.id,
                user.role,
                'pacs.view_images',
                { patientId: studyMetadata.data.patientId }
            );

            if (!permissionCheck.granted) {
                await this.auditLogger.log({
                    action: 'view_image',
                    resourceType: 'pacs_image',
                    resourceId: studyId,
                    patientMrn: studyMetadata.data.patientId,
                    success: false,
                    errorMessage: permissionCheck.reason,
                    context: { accessDenied: true }
                });

                return {
                    success: false,
                    error: 'Access denied',
                    code: permissionCheck.code
                };
            }

            // Retrieve encrypted image from storage
            const storageResult = await this.retrieveFromStorage(studyId);
            if (!storageResult.success) {
                await this.auditLogger.log({
                    action: 'view_image',
                    resourceType: 'pacs_image',
                    resourceId: studyId,
                    patientMrn: studyMetadata.data.patientId,
                    success: false,
                    errorMessage: 'Image not found',
                    context: { imageNotFound: true }
                });

                return storageResult;
            }

            // Decrypt image if encrypted
            let imageData = storageResult.data.encryptedImage;
            if (this.config.encryptionEnabled && imageData) {
                const decryptionResult = this.encryption.decryptPHI(imageData);
                if (!decryptionResult.success) {
                    await this.auditLogger.log({
                        action: 'view_image',
                        resourceType: 'pacs_image',
                        resourceId: studyId,
                        patientMrn: studyMetadata.data.patientId,
                        success: false,
                        errorMessage: 'Decryption failed',
                        context: { decryptionFailed: true }
                    });

                    return {
                        success: false,
                        error: 'Image decryption failed',
                        code: 'DECRYPTION_ERROR'
                    };
                }

                imageData = decryptionResult.data;
            }

            // Decrypt DICOM metadata if present
            let dicomMetadata = null;
            if (storageResult.data.encryptedMetadata) {
                const metadataDecryption = this.encryption.decryptDICOMMetadata(
                    storageResult.data.encryptedMetadata
                );

                if (metadataDecryption.success) {
                    dicomMetadata = metadataDecryption.data;
                }
            }

            // Log successful access
            await this.auditLogger.log({
                action: 'view_image',
                resourceType: 'pacs_image',
                resourceId: studyId,
                patientMrn: studyMetadata.data.patientId,
                success: true,
                context: {
                    studyType: studyMetadata.data.studyType,
                    sensitivity: studyMetadata.data.sensitivity,
                    accessTime: new Date().toISOString()
                }
            });

            return {
                success: true,
                data: {
                    studyId: studyId,
                    imageData: imageData,
                    dicomMetadata: dicomMetadata,
                    metadata: studyMetadata.data
                }
            };

        } catch (error) {
            console.error('PACS image retrieval failed:', error);
            
            await this.auditLogger.log({
                action: 'view_image',
                resourceType: 'pacs_image',
                resourceId: studyId,
                success: false,
                errorMessage: error.message,
                context: { systemError: true }
            });

            return {
                success: false,
                error: 'Image retrieval failed',
                code: 'SYSTEM_ERROR'
            };
        }
    }

    /**
     * Share imaging study with another provider
     * @param {string} studyId - Study to share
     * @param {Object} shareRequest - Sharing request details
     * @param {Object} user - User requesting share
     * @returns {Promise<Object>} Share result
     */
    async shareStudy(studyId, shareRequest, user) {
        try {
            this.auditLogger.setContext({
                userId: user.id,
                userRole: user.role,
                ipAddress: user.ipAddress,
                userAgent: user.userAgent
            });

            // Get study metadata
            const studyMetadata = await this.getStudyMetadata(studyId);
            if (!studyMetadata.success) {
                return studyMetadata;
            }

            // Check sharing permissions
            const permissionCheck = await this.rbac.checkPermission(
                user.id,
                user.role,
                'pacs.share_studies',
                { patientId: studyMetadata.data.patientId }
            );

            if (!permissionCheck.granted) {
                await this.auditLogger.log({
                    action: 'share_study',
                    resourceType: 'pacs_image',
                    resourceId: studyId,
                    patientMrn: studyMetadata.data.patientId,
                    success: false,
                    errorMessage: permissionCheck.reason,
                    context: { shareDenied: true }
                });

                return {
                    success: false,
                    error: 'Access denied for sharing',
                    code: permissionCheck.code
                };
            }

            // Generate secure sharing link
            const shareId = this.generateShareId();
            const expiryTime = new Date(Date.now() + (shareRequest.expiryHours || 24) * 60 * 60 * 1000);

            // Store sharing record
            const sharingRecord = {
                shareId: shareId,
                studyId: studyId,
                sharedBy: user.id,
                sharedWith: shareRequest.recipientEmail,
                purpose: shareRequest.purpose,
                expiryTime: expiryTime,
                createdTime: new Date(),
                accessCount: 0,
                maxAccesses: shareRequest.maxAccesses || 5
            };

            await this.storeShareRecord(sharingRecord);

            // Log study sharing
            await this.auditLogger.log({
                action: 'share_study',
                resourceType: 'pacs_image',
                resourceId: studyId,
                patientMrn: studyMetadata.data.patientId,
                success: true,
                context: {
                    shareId: shareId,
                    recipientEmail: shareRequest.recipientEmail,
                    purpose: shareRequest.purpose,
                    expiryTime: expiryTime.toISOString()
                }
            });

            return {
                success: true,
                data: {
                    shareId: shareId,
                    shareLink: `${process.env.BASE_URL}/pacs/shared/${shareId}`,
                    expiryTime: expiryTime,
                    studyId: studyId
                }
            };

        } catch (error) {
            console.error('PACS study sharing failed:', error);
            return {
                success: false,
                error: 'Study sharing failed',
                code: 'SYSTEM_ERROR'
            };
        }
    }

    /**
     * Get PACS access audit report
     * @param {Object} criteria - Report criteria
     * @param {Object} user - User requesting report
     * @returns {Promise<Object>} Audit report
     */
    async getAccessAuditReport(criteria, user) {
        try {
            // Check audit access permissions
            const permissionCheck = await this.rbac.checkPermission(
                user.id,
                user.role,
                'admin.view_audit_logs'
            );

            if (!permissionCheck.granted) {
                return {
                    success: false,
                    error: 'Access denied for audit reports',
                    code: permissionCheck.code
                };
            }

            // Search PACS-specific audit logs
            const searchCriteria = {
                ...criteria,
                resourceType: 'pacs_image',
                startDate: criteria.startDate ? new Date(criteria.startDate) : undefined,
                endDate: criteria.endDate ? new Date(criteria.endDate) : undefined
            };

            const auditResults = await this.auditLogger.search(searchCriteria);
            
            if (!auditResults.success) {
                return auditResults;
            }

            // Generate compliance report
            const report = this.generateComplianceReport(auditResults.data.entries);

            // Log report generation
            await this.auditLogger.log({
                action: 'generate_audit_report',
                resourceType: 'audit_report',
                resourceId: 'pacs_audit',
                success: true,
                context: {
                    reportType: 'PACS_ACCESS_AUDIT',
                    entriesCount: auditResults.data.entries.length,
                    criteria: searchCriteria
                }
            });

            return {
                success: true,
                data: {
                    report: report,
                    totalEntries: auditResults.data.total,
                    entries: auditResults.data.entries
                }
            };

        } catch (error) {
            console.error('PACS audit report generation failed:', error);
            return {
                success: false,
                error: 'Audit report generation failed',
                code: 'SYSTEM_ERROR'
            };
        }
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Validate image data for HIPAA compliance
     * @param {Object} imageData - Image data to validate
     * @returns {Object} Validation result
     */
    validateImageData(imageData) {
        if (!imageData.patientId) {
            return { valid: false, error: 'Patient ID is required' };
        }

        if (!imageData.studyType || !STUDY_TYPES[imageData.studyType]) {
            return { valid: false, error: 'Valid study type is required' };
        }

        if (!imageData.imageBuffer || imageData.imageBuffer.length === 0) {
            return { valid: false, error: 'Image data is required' };
        }

        if (imageData.imageBuffer.length > this.config.maxImageSize) {
            return { valid: false, error: 'Image size exceeds maximum allowed' };
        }

        return { valid: true };
    }

    /**
     * Generate unique study ID
     * @param {string} studyType - Type of study
     * @returns {string} Study ID
     */
    generateStudyId(studyType) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${studyType}_${timestamp}_${random}`;
    }

    /**
     * Generate secure share ID
     * @returns {string} Share ID
     */
    generateShareId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 16);
        return `share_${timestamp}_${random}`;
    }

    /**
     * Store image in PACS storage (simulated)
     * @param {Object} imagePackage - Image package to store
     * @returns {Promise<Object>} Storage result
     */
    async storeImage(imagePackage) {
        // In real implementation, this would store to PACS/DICOM server
        console.log(`[PACS HIPAA] Storing image ${imagePackage.studyId}`);
        
        // Simulate storage delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
            success: true,
            storageId: imagePackage.studyId
        };
    }

    /**
     * Retrieve image from storage (simulated)
     * @param {string} studyId - Study ID to retrieve
     * @returns {Promise<Object>} Retrieved data
     */
    async retrieveFromStorage(studyId) {
        // In real implementation, this would retrieve from PACS/DICOM server
        console.log(`[PACS HIPAA] Retrieving image ${studyId}`);
        
        // Simulate retrieval delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Simulate found image
        return {
            success: true,
            data: {
                encryptedImage: null, // Would contain encrypted image data
                encryptedMetadata: null, // Would contain encrypted metadata
                studyId: studyId
            }
        };
    }

    /**
     * Get study metadata
     * @param {string} studyId - Study ID
     * @returns {Promise<Object>} Study metadata
     */
    async getStudyMetadata(studyId) {
        // In real implementation, this would query PACS database
        return {
            success: true,
            data: {
                patientId: 'patient_123',
                studyType: 'CT',
                sensitivity: 'HIGH',
                uploadTime: new Date().toISOString()
            }
        };
    }

    /**
     * Store sharing record
     * @param {Object} sharingRecord - Sharing record to store
     * @returns {Promise<void>}
     */
    async storeShareRecord(sharingRecord) {
        // In real implementation, this would store to database
        console.log(`[PACS HIPAA] Storing share record ${sharingRecord.shareId}`);
    }

    /**
     * Generate compliance report from audit entries
     * @param {Array} auditEntries - Audit log entries
     * @returns {Object} Compliance report
     */
    generateComplianceReport(auditEntries) {
        const report = {
            totalAccess: auditEntries.length,
            successfulAccess: auditEntries.filter(e => e.success).length,
            failedAccess: auditEntries.filter(e => !e.success).length,
            uniqueUsers: new Set(auditEntries.map(e => e.userId)).size,
            uniquePatients: new Set(auditEntries.map(e => e.patientMrn).filter(Boolean)).size,
            actionBreakdown: {},
            timeRange: {
                start: auditEntries.length > 0 ? Math.min(...auditEntries.map(e => new Date(e.timestamp))) : null,
                end: auditEntries.length > 0 ? Math.max(...auditEntries.map(e => new Date(e.timestamp))) : null
            }
        };

        // Count actions
        auditEntries.forEach(entry => {
            report.actionBreakdown[entry.action] = (report.actionBreakdown[entry.action] || 0) + 1;
        });

        return report;
    }
}

module.exports = PACSHIPAAService;