/**
 * Telepsychiatry Consent Management Routes
 * Handles consent tracking, audit logs, and compliance
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage for demo purposes (use database in production)
const consentRecords = new Map();
const auditLogs = new Map();

/**
 * GET /consent/audit
 * View Consent Status - Queries signed consent logs for users or sessions
 */
router.get('/audit', (req, res) => {
    try {
        const { 
            userId, 
            sessionId, 
            patientId,
            startDate,
            endDate,
            consentType,
            status 
        } = req.query;

        let filteredConsents = [];

        // Filter consent records based on query parameters
        for (const [consentId, consent] of consentRecords.entries()) {
            let matches = true;

            if (userId && consent.userId !== userId) matches = false;
            if (sessionId && consent.sessionId !== sessionId) matches = false;
            if (patientId && consent.patientId !== patientId) matches = false;
            if (status && consent.status !== status) matches = false;
            if (consentType && consent.consentType !== consentType) matches = false;
            
            if (startDate) {
                if (new Date(consent.timestamp) < new Date(startDate)) matches = false;
            }
            if (endDate) {
                if (new Date(consent.timestamp) > new Date(endDate)) matches = false;
            }

            if (matches) {
                filteredConsents.push({
                    consentId,
                    ...consent,
                    // Remove sensitive internal data
                    internalNotes: undefined
                });
            }
        }

        res.json({
            success: true,
            data: {
                consents: filteredConsents,
                totalCount: filteredConsents.length,
                filters: {
                    userId,
                    sessionId,
                    patientId,
                    startDate,
                    endDate,
                    consentType,
                    status
                }
            }
        });
    } catch (error) {
        console.error('Error querying consent audit:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to query consent records'
        });
    }
});

/**
 * POST /consent/record
 * Record new consent - Creates a new consent record
 */
router.post('/record', (req, res) => {
    try {
        const {
            patientId,
            clinicianId,
            sessionId,
            consentType,
            consentText,
            language = 'en',
            culturalContext,
            electronicSignature,
            witnessId
        } = req.body;

        if (!patientId || !consentType || !consentText) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Patient ID, consent type, and consent text are required'
            });
        }

        const consentId = uuidv4();
        const consentRecord = {
            consentId,
            patientId,
            clinicianId,
            sessionId,
            consentType,
            consentText,
            language,
            culturalContext,
            status: 'signed',
            timestamp: new Date().toISOString(),
            electronicSignature,
            witnessId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            version: '1.0'
        };

        consentRecords.set(consentId, consentRecord);

        // Create audit log entry
        const auditEntry = {
            id: uuidv4(),
            action: 'consent_recorded',
            consentId,
            patientId,
            clinicianId,
            timestamp: new Date().toISOString(),
            details: {
                consentType,
                language,
                culturalContext
            }
        };

        auditLogs.set(auditEntry.id, auditEntry);

        res.json({
            success: true,
            data: {
                consentId,
                status: 'signed',
                timestamp: consentRecord.timestamp,
                consentType
            }
        });
    } catch (error) {
        console.error('Error recording consent:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to record consent'
        });
    }
});

/**
 * GET /consent/:id
 * Get specific consent record
 */
router.get('/:id', (req, res) => {
    try {
        const { id: consentId } = req.params;
        
        const consent = consentRecords.get(consentId);
        if (!consent) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Consent record not found'
            });
        }

        // Remove sensitive internal data
        const sanitizedConsent = {
            ...consent,
            internalNotes: undefined
        };

        res.json({
            success: true,
            data: sanitizedConsent
        });
    } catch (error) {
        console.error('Error retrieving consent:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve consent record'
        });
    }
});

/**
 * PUT /consent/:id/revoke
 * Revoke consent
 */
router.put('/:id/revoke', (req, res) => {
    try {
        const { id: consentId } = req.params;
        const { reason, revokedBy } = req.body;

        const consent = consentRecords.get(consentId);
        if (!consent) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Consent record not found'
            });
        }

        if (consent.status === 'revoked') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Consent is already revoked'
            });
        }

        // Update consent status
        consent.status = 'revoked';
        consent.revokedAt = new Date().toISOString();
        consent.revokedBy = revokedBy;
        consent.revocationReason = reason;

        // Create audit log entry
        const auditEntry = {
            id: uuidv4(),
            action: 'consent_revoked',
            consentId,
            patientId: consent.patientId,
            revokedBy,
            timestamp: new Date().toISOString(),
            details: {
                reason,
                originalConsentType: consent.consentType
            }
        };

        auditLogs.set(auditEntry.id, auditEntry);

        res.json({
            success: true,
            data: {
                consentId,
                status: 'revoked',
                revokedAt: consent.revokedAt,
                reason
            }
        });
    } catch (error) {
        console.error('Error revoking consent:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to revoke consent'
        });
    }
});

/**
 * GET /consent/patient/:patientId/status
 * Get consent status summary for a patient
 */
router.get('/patient/:patientId/status', (req, res) => {
    try {
        const { patientId } = req.params;

        const patientConsents = [];
        for (const [consentId, consent] of consentRecords.entries()) {
            if (consent.patientId === patientId) {
                patientConsents.push({
                    consentId,
                    consentType: consent.consentType,
                    status: consent.status,
                    timestamp: consent.timestamp,
                    language: consent.language,
                    culturalContext: consent.culturalContext
                });
            }
        }

        // Categorize consents by type and status
        const consentSummary = {
            total: patientConsents.length,
            active: patientConsents.filter(c => c.status === 'signed').length,
            revoked: patientConsents.filter(c => c.status === 'revoked').length,
            byType: {}
        };

        patientConsents.forEach(consent => {
            if (!consentSummary.byType[consent.consentType]) {
                consentSummary.byType[consent.consentType] = {
                    total: 0,
                    active: 0,
                    revoked: 0
                };
            }
            
            consentSummary.byType[consent.consentType].total++;
            if (consent.status === 'signed') {
                consentSummary.byType[consent.consentType].active++;
            } else if (consent.status === 'revoked') {
                consentSummary.byType[consent.consentType].revoked++;
            }
        });

        res.json({
            success: true,
            data: {
                patientId,
                consents: patientConsents,
                summary: consentSummary
            }
        });
    } catch (error) {
        console.error('Error retrieving patient consent status:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve patient consent status'
        });
    }
});

/**
 * GET /consent/types
 * Get available consent types
 */
router.get('/types', (req, res) => {
    try {
        const consentTypes = [
            {
                type: 'telehealth_session',
                name: 'Telehealth Session Consent',
                description: 'Consent for participating in telehealth video sessions',
                required: true,
                languages: ['en', 'es', 'fr', 'de']
            },
            {
                type: 'data_collection',
                name: 'Data Collection and Analytics',
                description: 'Consent for collecting session data for quality improvement',
                required: false,
                languages: ['en', 'es', 'fr', 'de']
            },
            {
                type: 'research_participation',
                name: 'Research Participation',
                description: 'Consent for including de-identified data in research studies',
                required: false,
                languages: ['en', 'es', 'fr', 'de']
            },
            {
                type: 'transcription_recording',
                name: 'Session Recording and Transcription',
                description: 'Consent for recording and transcribing therapy sessions',
                required: true,
                languages: ['en', 'es', 'fr', 'de']
            },
            {
                type: 'cultural_adaptation',
                name: 'Cultural and Linguistic Adaptation',
                description: 'Consent for adapting care plans based on cultural preferences',
                required: false,
                languages: ['en', 'es', 'fr', 'de']
            }
        ];

        res.json({
            success: true,
            data: {
                consentTypes,
                totalTypes: consentTypes.length
            }
        });
    } catch (error) {
        console.error('Error retrieving consent types:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve consent types'
        });
    }
});

// Initialize some sample consent records for demo
function initializeSampleConsents() {
    const sampleConsents = [
        {
            patientId: 'patient-123',
            clinicianId: 'clinician-456',
            sessionId: 'session-789',
            consentType: 'telehealth_session',
            consentText: 'I consent to participate in telehealth sessions...',
            language: 'en',
            status: 'signed'
        },
        {
            patientId: 'patient-456',
            clinicianId: 'clinician-456',
            consentType: 'research_participation',
            consentText: 'I consent to participate in research studies...',
            language: 'es',
            culturalContext: 'hispanic',
            status: 'signed'
        }
    ];

    sampleConsents.forEach(consent => {
        const consentId = uuidv4();
        const consentRecord = {
            consentId,
            ...consent,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        consentRecords.set(consentId, consentRecord);
    });
}

// Initialize sample data
initializeSampleConsents();

module.exports = router;