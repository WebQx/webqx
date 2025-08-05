/**
 * Telepsychiatry EMR Integration Routes
 * Handles ICD/DSM-5 tagging and patient record management
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage for demo purposes (use database in production)
const patientRecords = new Map();
const diagnosticTags = new Map();
const sessionNotes = new Map();

// ICD-10 and DSM-5 code mappings for psychiatric conditions
const diagnosticCodes = {
    'icd10': {
        'F32': { code: 'F32', description: 'Major depressive disorder, single episode', category: 'mood' },
        'F33': { code: 'F33', description: 'Major depressive disorder, recurrent', category: 'mood' },
        'F41.1': { code: 'F41.1', description: 'Generalized anxiety disorder', category: 'anxiety' },
        'F41.0': { code: 'F41.0', description: 'Panic disorder', category: 'anxiety' },
        'F43.10': { code: 'F43.10', description: 'Post-traumatic stress disorder', category: 'trauma' },
        'F84.0': { code: 'F84.0', description: 'Autism spectrum disorder', category: 'neurodevelopmental' },
        'F90.9': { code: 'F90.9', description: 'Attention-deficit/hyperactivity disorder', category: 'neurodevelopmental' }
    },
    'dsm5': {
        '296.23': { code: '296.23', description: 'Major Depressive Disorder, Single Episode, Severe', category: 'mood' },
        '296.33': { code: '296.33', description: 'Major Depressive Disorder, Recurrent Episode, Severe', category: 'mood' },
        '300.02': { code: '300.02', description: 'Generalized Anxiety Disorder', category: 'anxiety' },
        '300.01': { code: '300.01', description: 'Panic Disorder', category: 'anxiety' },
        '309.81': { code: '309.81', description: 'Posttraumatic Stress Disorder', category: 'trauma' },
        '299.00': { code: '299.00', description: 'Autism Spectrum Disorder', category: 'neurodevelopmental' },
        '314.01': { code: '314.01', description: 'Attention-Deficit/Hyperactivity Disorder, Combined Presentation', category: 'neurodevelopmental' }
    }
};

/**
 * POST /emr/tag
 * ICD/DSM-5 Tagging - Enables clinicians to annotate patient records with diagnostic codes
 */
router.post('/tag', (req, res) => {
    try {
        const {
            patientId,
            sessionId,
            clinicianId,
            diagnosticCode,
            codeSystem, // 'icd10' or 'dsm5'
            severity,
            confidence,
            notes,
            culturalConsiderations
        } = req.body;

        if (!patientId || !clinicianId || !diagnosticCode || !codeSystem) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Patient ID, clinician ID, diagnostic code, and code system are required'
            });
        }

        // Validate diagnostic code
        const codeInfo = diagnosticCodes[codeSystem]?.[diagnosticCode];
        if (!codeInfo) {
            return res.status(400).json({
                error: 'Bad Request',
                message: `Invalid diagnostic code ${diagnosticCode} for system ${codeSystem}`
            });
        }

        const tagId = uuidv4();
        const diagnosticTag = {
            tagId,
            patientId,
            sessionId,
            clinicianId,
            diagnosticCode,
            codeSystem,
            codeDescription: codeInfo.description,
            category: codeInfo.category,
            severity,
            confidence,
            notes,
            culturalConsiderations,
            timestamp: new Date().toISOString(),
            status: 'active'
        };

        diagnosticTags.set(tagId, diagnosticTag);

        // Update patient record with new tag
        updatePatientRecordWithTag(patientId, diagnosticTag);

        res.json({
            success: true,
            data: {
                tagId,
                diagnosticCode,
                codeSystem,
                description: codeInfo.description,
                category: codeInfo.category,
                timestamp: diagnosticTag.timestamp,
                status: 'active'
            }
        });
    } catch (error) {
        console.error('Error creating diagnostic tag:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create diagnostic tag'
        });
    }
});

/**
 * GET /emr/tag/search
 * Search diagnostic codes
 */
router.get('/tag/search', (req, res) => {
    try {
        const { 
            query, 
            codeSystem = 'both', 
            category,
            limit = 20 
        } = req.query;

        if (!query || query.length < 2) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Search query must be at least 2 characters long'
            });
        }

        const searchResults = [];
        const searchTerm = query.toLowerCase();

        // Search ICD-10 codes
        if (codeSystem === 'both' || codeSystem === 'icd10') {
            Object.entries(diagnosticCodes.icd10).forEach(([code, info]) => {
                if (
                    code.toLowerCase().includes(searchTerm) ||
                    info.description.toLowerCase().includes(searchTerm)
                ) {
                    if (!category || info.category === category) {
                        searchResults.push({
                            ...info,
                            codeSystem: 'icd10'
                        });
                    }
                }
            });
        }

        // Search DSM-5 codes
        if (codeSystem === 'both' || codeSystem === 'dsm5') {
            Object.entries(diagnosticCodes.dsm5).forEach(([code, info]) => {
                if (
                    code.toLowerCase().includes(searchTerm) ||
                    info.description.toLowerCase().includes(searchTerm)
                ) {
                    if (!category || info.category === category) {
                        searchResults.push({
                            ...info,
                            codeSystem: 'dsm5'
                        });
                    }
                }
            });
        }

        // Limit results
        const limitedResults = searchResults.slice(0, parseInt(limit));

        res.json({
            success: true,
            data: {
                codes: limitedResults,
                totalFound: searchResults.length,
                query,
                codeSystem,
                category
            }
        });
    } catch (error) {
        console.error('Error searching diagnostic codes:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to search diagnostic codes'
        });
    }
});

/**
 * POST /emr/records/:id/notes
 * Add notes to patient record (stored locally during session, pushed after session)
 */
router.post('/records/:id/notes', (req, res) => {
    try {
        const { id: patientId } = req.params;
        const {
            sessionId,
            clinicianId,
            noteType = 'progress',
            content,
            tags,
            isPrivate = false,
            culturalNotes
        } = req.body;

        if (!content) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Note content is required'
            });
        }

        const noteId = uuidv4();
        const note = {
            noteId,
            patientId,
            sessionId,
            clinicianId,
            noteType,
            content,
            tags: tags || [],
            isPrivate,
            culturalNotes,
            timestamp: new Date().toISOString(),
            status: sessionId ? 'draft' : 'finalized' // Draft during session, finalized after
        };

        // Store in session notes if part of active session
        if (sessionId) {
            let sessionNotesMap = sessionNotes.get(sessionId) || [];
            sessionNotesMap.push(note);
            sessionNotes.set(sessionId, sessionNotesMap);
        }

        // Also update patient record
        updatePatientRecordWithNote(patientId, note);

        res.json({
            success: true,
            data: {
                noteId,
                patientId,
                sessionId,
                status: note.status,
                timestamp: note.timestamp,
                storedLocally: !!sessionId
            }
        });
    } catch (error) {
        console.error('Error adding patient note:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to add patient note'
        });
    }
});

/**
 * GET /emr/records/:id
 * Get patient record by ID
 */
router.get('/records/:id', (req, res) => {
    try {
        const { id: patientId } = req.params;
        const { includeNotes = true, includeTags = true } = req.query;

        let record = patientRecords.get(patientId);
        if (!record) {
            // Create basic record if doesn't exist
            record = createBasicPatientRecord(patientId);
            patientRecords.set(patientId, record);
        }

        // Filter sensitive information based on user permissions
        const sanitizedRecord = {
            patientId: record.patientId,
            demographics: record.demographics,
            lastUpdated: record.lastUpdated
        };

        if (includeTags === 'true') {
            sanitizedRecord.diagnosticTags = record.diagnosticTags || [];
        }

        if (includeNotes === 'true') {
            sanitizedRecord.notes = record.notes?.map(note => ({
                noteId: note.noteId,
                noteType: note.noteType,
                content: note.isPrivate ? '[Private Note]' : note.content,
                timestamp: note.timestamp,
                clinicianId: note.clinicianId,
                tags: note.tags,
                status: note.status
            })) || [];
        }

        res.json({
            success: true,
            data: sanitizedRecord
        });
    } catch (error) {
        console.error('Error retrieving patient record:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve patient record'
        });
    }
});

/**
 * POST /emr/records/:id/finalize-session
 * Finalize session notes (push from local storage to permanent record)
 */
router.post('/records/:id/finalize-session', (req, res) => {
    try {
        const { id: patientId } = req.params;
        const { sessionId, clinicianId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Session ID is required'
            });
        }

        // Get session notes
        const sessionNotesArray = sessionNotes.get(sessionId) || [];
        
        // Update all draft notes to finalized
        const finalizedNotes = sessionNotesArray.map(note => ({
            ...note,
            status: 'finalized',
            finalizedAt: new Date().toISOString(),
            finalizedBy: clinicianId
        }));

        // Update patient record with finalized notes
        let record = patientRecords.get(patientId);
        if (!record) {
            record = createBasicPatientRecord(patientId);
        }

        if (!record.notes) record.notes = [];
        
        // Remove any existing draft notes for this session and add finalized ones
        record.notes = record.notes.filter(note => note.sessionId !== sessionId);
        record.notes.push(...finalizedNotes);
        record.lastUpdated = new Date().toISOString();

        patientRecords.set(patientId, record);

        // Clear session notes
        sessionNotes.delete(sessionId);

        res.json({
            success: true,
            data: {
                patientId,
                sessionId,
                finalizedNotesCount: finalizedNotes.length,
                finalizedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error finalizing session notes:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to finalize session notes'
        });
    }
});

/**
 * GET /emr/tag/patient/:patientId
 * Get all diagnostic tags for a patient
 */
router.get('/tag/patient/:patientId', (req, res) => {
    try {
        const { patientId } = req.params;
        const { status = 'active', category } = req.query;

        const patientTags = [];
        for (const [tagId, tag] of diagnosticTags.entries()) {
            if (tag.patientId === patientId) {
                if (status && tag.status !== status) continue;
                if (category && tag.category !== category) continue;
                
                patientTags.push(tag);
            }
        }

        // Group by category for easier viewing
        const tagsByCategory = {};
        patientTags.forEach(tag => {
            if (!tagsByCategory[tag.category]) {
                tagsByCategory[tag.category] = [];
            }
            tagsByCategory[tag.category].push(tag);
        });

        res.json({
            success: true,
            data: {
                patientId,
                tags: patientTags,
                tagsByCategory,
                totalTags: patientTags.length
            }
        });
    } catch (error) {
        console.error('Error retrieving patient tags:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve patient diagnostic tags'
        });
    }
});

/**
 * PUT /emr/tag/:id/status
 * Update diagnostic tag status
 */
router.put('/tag/:id/status', (req, res) => {
    try {
        const { id: tagId } = req.params;
        const { status, notes, updatedBy } = req.body;

        const validStatuses = ['active', 'inactive', 'resolved', 'ruled_out'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        const tag = diagnosticTags.get(tagId);
        if (!tag) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Diagnostic tag not found'
            });
        }

        tag.status = status;
        tag.statusUpdatedAt = new Date().toISOString();
        tag.statusUpdatedBy = updatedBy;
        if (notes) tag.statusNotes = notes;

        res.json({
            success: true,
            data: {
                tagId,
                status,
                updatedAt: tag.statusUpdatedAt,
                updatedBy
            }
        });
    } catch (error) {
        console.error('Error updating tag status:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update diagnostic tag status'
        });
    }
});

// Helper functions
function updatePatientRecordWithTag(patientId, tag) {
    let record = patientRecords.get(patientId);
    if (!record) {
        record = createBasicPatientRecord(patientId);
    }
    
    if (!record.diagnosticTags) record.diagnosticTags = [];
    record.diagnosticTags.push(tag);
    record.lastUpdated = new Date().toISOString();
    
    patientRecords.set(patientId, record);
}

function updatePatientRecordWithNote(patientId, note) {
    let record = patientRecords.get(patientId);
    if (!record) {
        record = createBasicPatientRecord(patientId);
    }
    
    if (!record.notes) record.notes = [];
    record.notes.push(note);
    record.lastUpdated = new Date().toISOString();
    
    patientRecords.set(patientId, record);
}

function createBasicPatientRecord(patientId) {
    return {
        patientId,
        demographics: {
            // This would typically come from FHIR Patient resource
            name: `Patient ${patientId}`,
            dateOfBirth: '1990-01-01',
            gender: 'unknown'
        },
        diagnosticTags: [],
        notes: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
    };
}

// Initialize some sample diagnostic tags for demo
function initializeSampleTags() {
    const sampleTags = [
        {
            patientId: 'patient-123',
            clinicianId: 'clinician-456',
            diagnosticCode: 'F41.1',
            codeSystem: 'icd10',
            severity: 'moderate',
            confidence: 0.85,
            notes: 'Patient presents with persistent worry and anxiety'
        },
        {
            patientId: 'patient-456',
            clinicianId: 'clinician-456',
            diagnosticCode: '296.23',
            codeSystem: 'dsm5',
            severity: 'severe',
            confidence: 0.90,
            notes: 'Major depressive episode with significant functional impairment'
        }
    ];

    sampleTags.forEach(tag => {
        const tagId = uuidv4();
        const codeInfo = diagnosticCodes[tag.codeSystem][tag.diagnosticCode];
        
        const diagnosticTag = {
            tagId,
            ...tag,
            codeDescription: codeInfo.description,
            category: codeInfo.category,
            timestamp: new Date().toISOString(),
            status: 'active'
        };
        
        diagnosticTags.set(tagId, diagnosticTag);
        updatePatientRecordWithTag(tag.patientId, diagnosticTag);
    });
}

// Initialize sample data
initializeSampleTags();

module.exports = router;