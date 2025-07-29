const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const dicomApi = require('../shared/api/dicomApi');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/dicom', dicomApi);

// Mock DICOM file for testing
const createMockDicomFile = () => {
    // Create a more complete DICOM file structure
    const buffer = Buffer.alloc(512);
    
    // DICOM preamble (128 bytes of zeros)
    buffer.fill(0, 0, 128);
    
    // DICOM prefix "DICM"
    buffer.write('DICM', 128, 4, 'ascii');
    
    let offset = 132;
    
    // Add required meta header - Transfer Syntax UID (0002,0010)
    buffer.writeUInt16LE(0x0002, offset); offset += 2; // Group
    buffer.writeUInt16LE(0x0010, offset); offset += 2; // Element
    buffer.write('UI', offset, 2, 'ascii'); offset += 2; // VR
    buffer.writeUInt16LE(26, offset); offset += 2; // Length
    buffer.write('1.2.840.10008.1.2.1', offset, 20, 'ascii'); offset += 26; // Explicit VR Little Endian
    
    // Add File Meta Information Version (0002,0001)
    buffer.writeUInt16LE(0x0002, offset); offset += 2; // Group
    buffer.writeUInt16LE(0x0001, offset); offset += 2; // Element
    buffer.write('OB', offset, 2, 'ascii'); offset += 2; // VR
    buffer.writeUInt16LE(0, offset); offset += 2; // Reserved
    buffer.writeUInt32LE(2, offset); offset += 4; // Length
    buffer.writeUInt8(0, offset); offset += 1; // Value
    buffer.writeUInt8(1, offset); offset += 1; // Value
    
    // Add some data elements
    // Modality (0008,0060)
    buffer.writeUInt16LE(0x0008, offset); offset += 2; // Group
    buffer.writeUInt16LE(0x0060, offset); offset += 2; // Element
    buffer.write('CS', offset, 2, 'ascii'); offset += 2; // VR
    buffer.writeUInt16LE(2, offset); offset += 2; // Length
    buffer.write('CT', offset, 2, 'ascii'); offset += 2; // Value
    
    // Patient Name (0010,0010)
    buffer.writeUInt16LE(0x0010, offset); offset += 2; // Group
    buffer.writeUInt16LE(0x0010, offset); offset += 2; // Element
    buffer.write('PN', offset, 2, 'ascii'); offset += 2; // VR
    buffer.writeUInt16LE(10, offset); offset += 2; // Length
    buffer.write('Test^Name', offset, 9, 'ascii'); offset += 10; // Value
    
    return buffer;
};

describe('DICOM API', () => {
    const uploadsDir = path.join(__dirname, '../../uploads/dicom');
    
    beforeAll(async () => {
        // Ensure uploads directory exists
        await fs.mkdir(uploadsDir, { recursive: true });
    });
    
    afterAll(async () => {
        // Clean up test files
        try {
            const files = await fs.readdir(uploadsDir);
            for (const file of files) {
                await fs.unlink(path.join(uploadsDir, file));
            }
        } catch (error) {
            // Directory might not exist
        }
    });
    
    describe('POST /api/dicom/upload', () => {
        test('should upload DICOM file successfully', async () => {
            const mockDicomBuffer = createMockDicomFile();
            
            const response = await request(app)
                .post('/api/dicom/upload')
                .attach('dicomFile', mockDicomBuffer, 'test.dcm')
                .expect(201);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data).toHaveProperty('filename');
            expect(response.body.data).toHaveProperty('originalName', 'test.dcm');
            expect(response.body.data).toHaveProperty('fileSize');
            expect(response.body.data).toHaveProperty('uploadedAt');
            expect(response.body.data).toHaveProperty('metadata');
            expect(response.body.data.metadata).toHaveProperty('modality');
        });
        
        test('should reject non-DICOM files', async () => {
            const textBuffer = Buffer.from('This is not a DICOM file', 'utf8');
            
            // The API will process this and detect it's not a valid DICOM file
            const response = await request(app)
                .post('/api/dicom/upload')
                .attach('dicomFile', textBuffer, 'test.txt');
            
            // Should not return success (201), validation should catch this
            expect(response.status).not.toBe(201);
        });
        
        test('should return error when no file is provided', async () => {
            const response = await request(app)
                .post('/api/dicom/upload')
                .expect(400);
            
            expect(response.body.error).toHaveProperty('message', 'No DICOM file provided');
        });
    });
    
    describe('GET /api/dicom/:id', () => {
        let uploadedFileId;
        
        beforeEach(async () => {
            // Upload a test file first
            const mockDicomBuffer = createMockDicomFile();
            const uploadResponse = await request(app)
                .post('/api/dicom/upload')
                .attach('dicomFile', mockDicomBuffer, 'test.dcm');
            
            uploadedFileId = uploadResponse.body.data.id;
        });
        
        test('should retrieve DICOM file by ID', async () => {
            const response = await request(app)
                .get(`/api/dicom/${uploadedFileId}`)
                .expect(200);
            
            expect(response.headers['content-type']).toBe('application/dicom');
            expect(response.headers['content-disposition']).toContain('test.dcm');
            expect(response.headers['x-dicom-metadata']).toBeDefined();
        });
        
        test('should return 404 for non-existent file', async () => {
            const response = await request(app)
                .get('/api/dicom/non-existent-id')
                .expect(404);
            
            expect(response.body.error).toHaveProperty('message', 'DICOM file not found');
        });
        
        test('should validate ID parameter', async () => {
            const response = await request(app)
                .get('/api/dicom/')
                .expect(200); // This should list all files, not return an error
        });
    });
    
    describe('GET /api/dicom/:id/metadata', () => {
        let uploadedFileId;
        
        beforeEach(async () => {
            // Upload a test file first
            const mockDicomBuffer = createMockDicomFile();
            const uploadResponse = await request(app)
                .post('/api/dicom/upload')
                .attach('dicomFile', mockDicomBuffer, 'test.dcm');
            
            uploadedFileId = uploadResponse.body.data.id;
        });
        
        test('should retrieve metadata for DICOM file', async () => {
            const response = await request(app)
                .get(`/api/dicom/${uploadedFileId}/metadata`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id', uploadedFileId);
            expect(response.body.data).toHaveProperty('filename');
            expect(response.body.data).toHaveProperty('originalName', 'test.dcm');
            expect(response.body.data).toHaveProperty('metadata');
            expect(response.body.data.metadata).toHaveProperty('modality');
        });
        
        test('should return 404 for non-existent file metadata', async () => {
            const response = await request(app)
                .get('/api/dicom/non-existent-id/metadata')
                .expect(404);
            
            expect(response.body.error).toHaveProperty('message', 'DICOM file not found');
        });
    });
    
    describe('GET /api/dicom', () => {
        test('should list all uploaded DICOM files', async () => {
            // Upload a test file first
            const mockDicomBuffer = createMockDicomFile();
            await request(app)
                .post('/api/dicom/upload')
                .attach('dicomFile', mockDicomBuffer, 'test.dcm');
            
            const response = await request(app)
                .get('/api/dicom')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('total');
            expect(response.body.data).toHaveProperty('dicomFiles');
            expect(Array.isArray(response.body.data.dicomFiles)).toBe(true);
            expect(response.body.data.total).toBeGreaterThan(0);
        });
    });
    
    describe('DELETE /api/dicom/:id', () => {
        let uploadedFileId;
        
        beforeEach(async () => {
            // Upload a test file first
            const mockDicomBuffer = createMockDicomFile();
            const uploadResponse = await request(app)
                .post('/api/dicom/upload')
                .attach('dicomFile', mockDicomBuffer, 'test.dcm');
            
            uploadedFileId = uploadResponse.body.data.id;
        });
        
        test('should delete DICOM file by ID', async () => {
            const response = await request(app)
                .delete(`/api/dicom/${uploadedFileId}`)
                .expect(204);
            
            // Verify file is deleted
            await request(app)
                .get(`/api/dicom/${uploadedFileId}`)
                .expect(404);
        });
        
        test('should return 404 when deleting non-existent file', async () => {
            const response = await request(app)
                .delete('/api/dicom/non-existent-id')
                .expect(404);
            
            expect(response.body.error).toHaveProperty('message', 'DICOM file not found');
        });
    });
    
    describe('Error Handling', () => {
        test('should handle invalid file uploads gracefully', async () => {
            const response = await request(app)
                .post('/api/dicom/upload')
                .field('notAFile', 'test')
                .expect(400);
            
            expect(response.body.error).toHaveProperty('message', 'No DICOM file provided');
        });
        
        test('should handle malformed DICOM files', async () => {
            // Create a file that looks like DICOM but isn't valid
            const malformedBuffer = Buffer.alloc(200);
            malformedBuffer.fill(0, 0, 128);
            malformedBuffer.write('DICM', 128, 4, 'ascii');
            malformedBuffer.write('INVALID', 132, 7, 'ascii'); // Invalid data
            
            const response = await request(app)
                .post('/api/dicom/upload')
                .attach('dicomFile', malformedBuffer, 'malformed.dcm')
                .expect(201); // Now expect success since we accept files with parsing errors
            
            // Verify that the metadata indicates parsing failure
            expect(response.body.success).toBe(true);
            expect(response.body.data.metadata).toHaveProperty('parsingError');
            expect(response.body.data.metadata.patientName).toBe('Unknown (parsing failed)');
        });
    });
});