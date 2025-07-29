const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const dicomParser = require('dicom-parser');
const { v4: uuidv4 } = require('uuid');
const { body, param, validationResult } = require('express-validator');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../../uploads/dicom'));
    },
    filename: (req, file, cb) => {
        // Generate unique filename with UUID
        const uniqueId = uuidv4();
        const extension = path.extname(file.originalname) || '.dcm';
        cb(null, `${uniqueId}${extension}`);
    }
});

// File filter to validate DICOM files
const fileFilter = (req, file, cb) => {
    // Accept files that might be DICOM files
    const allowedTypes = [
        'application/dicom',
        'application/octet-stream',
        'image/x-dicom'
    ];
    
    const allowedExtensions = ['.dcm', '.dicom', '.dic'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    // Check if it's a DICOM file by extension or content type
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        // Reject files that are clearly not DICOM
        if (file.originalname.endsWith('.txt') || file.originalname.endsWith('.jpg') || 
            file.originalname.endsWith('.png') || file.originalname.endsWith('.pdf')) {
            cb(new Error('Only DICOM files are allowed'), false);
        } else {
            // Allow other files to be processed and validated by DICOM parser
            cb(null, true);
        }
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: fileFilter
});

// In-memory storage for metadata (in production, this would be a database)
const dicomMetadata = new Map();

/**
 * Error handler helper
 */
const handleError = (res, error, statusCode = 500) => {
    console.error('DICOM API Error:', error);
    
    res.status(statusCode).json({
        error: {
            code: statusCode,
            message: error.message || 'An error occurred',
            type: 'DICOM_API_ERROR'
        }
    });
};

/**
 * Success response helper
 */
const sendSuccessResponse = (res, data, statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        data
    });
};

/**
 * Extract metadata from DICOM file
 */
const extractDicomMetadata = async (filePath) => {
    try {
        const fileBuffer = await fs.readFile(filePath);
        
        // Basic DICOM file validation - check for DICM prefix
        if (fileBuffer.length < 132 || fileBuffer.toString('ascii', 128, 132) !== 'DICM') {
            throw new Error('File does not appear to be a valid DICOM file (missing DICM prefix)');
        }
        
        const byteArray = new Uint8Array(fileBuffer);
        const dataSet = dicomParser.parseDicom(byteArray);
        
        // Extract key metadata fields
        const metadata = {
            patientName: getDataElementValue(dataSet, 'x00100010') || 'Unknown',
            patientId: getDataElementValue(dataSet, 'x00100020') || 'Unknown',
            studyDate: getDataElementValue(dataSet, 'x00080020') || 'Unknown',
            studyTime: getDataElementValue(dataSet, 'x00080030') || 'Unknown',
            studyDescription: getDataElementValue(dataSet, 'x00081030') || 'Unknown',
            seriesDescription: getDataElementValue(dataSet, 'x0008103e') || 'Unknown',
            modality: getDataElementValue(dataSet, 'x00080060') || 'Unknown',
            instanceNumber: getDataElementValue(dataSet, 'x00200013') || 'Unknown',
            sopInstanceUID: getDataElementValue(dataSet, 'x00080018') || 'Unknown',
            studyInstanceUID: getDataElementValue(dataSet, 'x0020000d') || 'Unknown',
            seriesInstanceUID: getDataElementValue(dataSet, 'x0020000e') || 'Unknown',
            rows: getDataElementValue(dataSet, 'x00280010'),
            columns: getDataElementValue(dataSet, 'x00280011'),
            pixelSpacing: getDataElementValue(dataSet, 'x00280030')
        };
        
        return metadata;
    } catch (error) {
        console.error('Error parsing DICOM file:', error);
        
        if (error.message.includes('missing DICM prefix')) {
            throw new Error('Invalid DICOM file: ' + error.message);
        }
        
        // Return basic metadata even if DICOM parsing fails
        return {
            patientName: 'Unknown (parsing failed)',
            patientId: 'Unknown',
            studyDate: 'Unknown',
            studyTime: 'Unknown',
            studyDescription: 'Unknown',
            seriesDescription: 'Unknown',
            modality: 'Unknown',
            instanceNumber: 'Unknown',
            sopInstanceUID: 'Unknown',
            studyInstanceUID: 'Unknown',
            seriesInstanceUID: 'Unknown',
            rows: null,
            columns: null,
            pixelSpacing: null,
            parsingError: error.message
        };
    }
};

/**
 * Helper function to get DICOM data element value
 */
const getDataElementValue = (dataSet, tag) => {
    try {
        const element = dataSet.elements[tag];
        if (!element) return null;
        
        // Handle different VR types
        if (element.vr === 'PN') {
            // Person Name
            return dataSet.string(tag);
        } else if (element.vr === 'DA') {
            // Date
            return dataSet.string(tag);
        } else if (element.vr === 'TM') {
            // Time
            return dataSet.string(tag);
        } else if (element.vr === 'LO' || element.vr === 'SH' || element.vr === 'CS') {
            // Long String, Short String, Code String
            return dataSet.string(tag);
        } else if (element.vr === 'US' || element.vr === 'IS') {
            // Unsigned Short, Integer String
            return dataSet.uint16(tag);
        } else if (element.vr === 'DS') {
            // Decimal String
            return dataSet.string(tag);
        } else {
            // Default to string
            return dataSet.string(tag);
        }
    } catch (error) {
        return null;
    }
};

/**
 * POST /api/dicom/upload
 * Upload DICOM file and extract metadata
 */
router.post('/upload', upload.single('dicomFile'), async (req, res) => {
    try {
        if (!req.file) {
            return handleError(res, new Error('No DICOM file provided'), 400);
        }
        
        const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
        const filePath = req.file.path;
        
        // Extract metadata from DICOM file
        const metadata = await extractDicomMetadata(filePath);
        
        // Store metadata and file info
        const dicomRecord = {
            id: fileId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            filePath: filePath,
            fileSize: req.file.size,
            uploadedAt: new Date().toISOString(),
            metadata: metadata
        };
        
        dicomMetadata.set(fileId, dicomRecord);
        
        sendSuccessResponse(res, {
            id: fileId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            uploadedAt: dicomRecord.uploadedAt,
            metadata: metadata
        }, 201);
        
    } catch (error) {
        // Clean up file if there's a severe error (not DICOM parsing)
        if (req.file && req.file.path && !error.message.includes('parsing failed')) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error cleaning up file:', unlinkError);
            }
        }
        
        if (error.message.includes('Only DICOM files are allowed')) {
            handleError(res, error, 400);
        } else if (error.message.includes('Invalid DICOM file')) {
            handleError(res, error, 400);
        } else {
            handleError(res, error, 500);
        }
    }
});

/**
 * GET /api/dicom/:id
 * Retrieve DICOM file and metadata by ID
 */
router.get('/:id', [
    param('id').isString().notEmpty().withMessage('Valid DICOM ID is required')
], async (req, res) => {
    try {
        // Validate request parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid parameters: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const dicomId = req.params.id;
        const dicomRecord = dicomMetadata.get(dicomId);
        
        if (!dicomRecord) {
            return handleError(res, new Error('DICOM file not found'), 404);
        }
        
        // Check if file still exists
        try {
            await fs.access(dicomRecord.filePath);
        } catch (error) {
            // File has been deleted
            dicomMetadata.delete(dicomId);
            return handleError(res, new Error('DICOM file not found on disk'), 404);
        }
        
        // Return file and metadata
        res.setHeader('Content-Type', 'application/dicom');
        res.setHeader('Content-Disposition', `attachment; filename="${dicomRecord.originalName}"`);
        res.setHeader('X-DICOM-Metadata', JSON.stringify(dicomRecord.metadata));
        
        // Send the file
        res.sendFile(path.resolve(dicomRecord.filePath));
        
    } catch (error) {
        handleError(res, error, 500);
    }
});

/**
 * GET /api/dicom/:id/metadata
 * Retrieve only metadata for a DICOM file
 */
router.get('/:id/metadata', [
    param('id').isString().notEmpty().withMessage('Valid DICOM ID is required')
], async (req, res) => {
    try {
        // Validate request parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid parameters: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const dicomId = req.params.id;
        const dicomRecord = dicomMetadata.get(dicomId);
        
        if (!dicomRecord) {
            return handleError(res, new Error('DICOM file not found'), 404);
        }
        
        sendSuccessResponse(res, {
            id: dicomId,
            filename: dicomRecord.filename,
            originalName: dicomRecord.originalName,
            fileSize: dicomRecord.fileSize,
            uploadedAt: dicomRecord.uploadedAt,
            metadata: dicomRecord.metadata
        });
        
    } catch (error) {
        handleError(res, error, 500);
    }
});

/**
 * GET /api/dicom
 * List all uploaded DICOM files
 */
router.get('/', async (req, res) => {
    try {
        const dicomList = Array.from(dicomMetadata.values()).map(record => ({
            id: record.id,
            filename: record.filename,
            originalName: record.originalName,
            fileSize: record.fileSize,
            uploadedAt: record.uploadedAt,
            patientName: record.metadata.patientName,
            studyDate: record.metadata.studyDate,
            modality: record.metadata.modality
        }));
        
        sendSuccessResponse(res, {
            total: dicomList.length,
            dicomFiles: dicomList
        });
        
    } catch (error) {
        handleError(res, error, 500);
    }
});

/**
 * DELETE /api/dicom/:id
 * Delete a DICOM file and its metadata
 */
router.delete('/:id', [
    param('id').isString().notEmpty().withMessage('Valid DICOM ID is required')
], async (req, res) => {
    try {
        // Validate request parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid parameters: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const dicomId = req.params.id;
        const dicomRecord = dicomMetadata.get(dicomId);
        
        if (!dicomRecord) {
            return handleError(res, new Error('DICOM file not found'), 404);
        }
        
        // Delete the file
        try {
            await fs.unlink(dicomRecord.filePath);
        } catch (error) {
            console.warn('File already deleted from disk:', error.message);
        }
        
        // Remove metadata
        dicomMetadata.delete(dicomId);
        
        res.status(204).send();
        
    } catch (error) {
        handleError(res, error, 500);
    }
});

module.exports = router;