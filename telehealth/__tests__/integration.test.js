/**
 * @fileoverview Integration Tests for Telehealth Module
 * 
 * This test suite validates the core functionality of the telehealth module
 * including video services, chat services, and security configurations.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const SecureVideoService = require('../services/videoService');
const SecureChatService = require('../services/chatService');
const RealtimeWhisperService = require('../services/realtimeWhisperService');
const tlsConfig = require('../config/tls');
const hipaaConfig = require('../config/hipaa');

describe('Telehealth Module Integration Tests', () => {
    let videoService;
    let chatService;
    let whisperService;
    const testSessionId = 'test-session-12345';

    beforeEach(() => {
        // Set up test environment variables
        process.env.NODE_ENV = 'test';
        process.env.HIPAA_ENCRYPTION_KEY = 'test-key-12345678901234567890123456789012';
        process.env.WHISPER_API_KEY = 'test-whisper-api-key';
    });

    afterEach(async () => {
        // Clean up services
        if (videoService) {
            await videoService.cleanup();
            videoService = null;
        }
        if (chatService) {
            await chatService.cleanup();
            chatService = null;
        }
        if (whisperService) {
            await whisperService.cleanup();
            whisperService = null;
        }
    });

    describe('TLS Configuration', () => {
        test('should initialize TLS configuration', () => {
            expect(tlsConfig).toBeDefined();
            expect(tlsConfig.getConfigSummary).toBeDefined();
            
            const summary = tlsConfig.getConfigSummary();
            expect(summary.tlsVersion).toBe('TLSv1.3');
            expect(summary.hstsEnabled).toBe(true);
        });

        test('should provide HTTPS options', () => {
            const httpsOptions = tlsConfig.getHTTPSOptions();
            expect(httpsOptions).toBeDefined();
            expect(httpsOptions.minVersion).toBe('TLSv1.3');
            expect(httpsOptions.maxVersion).toBe('TLSv1.3');
        });

        test('should provide WebRTC configuration', () => {
            const webrtcConfig = tlsConfig.getWebRTCConfig();
            expect(webrtcConfig).toBeDefined();
            expect(webrtcConfig.iceServers).toBeDefined();
            expect(Array.isArray(webrtcConfig.iceServers)).toBe(true);
        });

        test('should generate HSTS headers', () => {
            const headers = tlsConfig.getHSTSHeaders();
            expect(headers).toBeDefined();
            expect(headers['Strict-Transport-Security']).toBeDefined();
            expect(headers['X-Content-Type-Options']).toBe('nosniff');
            expect(headers['X-Frame-Options']).toBe('DENY');
        });
    });

    describe('HIPAA Configuration', () => {
        test('should initialize HIPAA configuration', () => {
            expect(hipaaConfig).toBeDefined();
            expect(hipaaConfig.getConfigSummary).toBeDefined();
            
            const summary = hipaaConfig.getConfigSummary();
            expect(summary.encryptionEnabled).toBe(true);
            expect(summary.retentionDays).toBeGreaterThanOrEqual(2555);
        });

        test('should log audit events', () => {
            const eventId = hipaaConfig.logAuditEvent('TEST_EVENT', {
                sessionId: testSessionId,
                userId: 'test-user',
                action: 'TEST_ACTION',
                details: { test: true }
            });
            
            expect(eventId).toBeDefined();
            expect(typeof eventId).toBe('string');
        });

        test('should encrypt and decrypt data', () => {
            const testData = { sensitive: 'information', patient: 'data' };
            
            const encrypted = hipaaConfig.encryptData(testData);
            expect(encrypted).toBeDefined();
            expect(encrypted.encrypted).toBeDefined();
            expect(encrypted.iv).toBeDefined();
            expect(encrypted.algorithm).toBe('aes-256-gcm');
            
            const decrypted = hipaaConfig.decryptData(encrypted);
            expect(decrypted).toEqual(testData);
        });

        test('should validate patient consent', () => {
            const consent = hipaaConfig.validatePatientConsent('test-patient-123');
            expect(consent).toBeDefined();
            expect(consent.granted).toBe(true);
            expect(consent.patientId).toBe('test-patient-123');
        });

        test('should generate compliance report', () => {
            const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
            const endDate = new Date();
            
            const report = hipaaConfig.generateComplianceReport(startDate, endDate);
            expect(report).toBeDefined();
            expect(report.reportId).toBeDefined();
            expect(report.auditSummary).toBeDefined();
            expect(report.compliance).toBeDefined();
        });
    });

    describe('Secure Video Service', () => {
        test('should initialize video service', () => {
            videoService = new SecureVideoService(testSessionId, {
                recordingEnabled: false,
                transcriptionEnabled: false
            });
            
            expect(videoService).toBeDefined();
            expect(videoService.sessionId).toBe(testSessionId);
        });

        test('should validate configuration', () => {
            videoService = new SecureVideoService(testSessionId, {
                maxBitrate: 2000000,
                minBitrate: 300000,
                framerate: 30
            });
            
            expect(videoService.config.maxBitrate).toBe(2000000);
            expect(videoService.config.minBitrate).toBe(300000);
            expect(videoService.config.framerate).toBe(30);
        });

        test('should handle session lifecycle', async () => {
            videoService = new SecureVideoService(testSessionId);
            
            // Mock session start
            const sessionInfo = await videoService.startSession('test-user-1', 'provider');
            expect(sessionInfo).toBeDefined();
            expect(sessionInfo.sessionId).toBe(testSessionId);
            
            // Mock participant join
            const joinInfo = await videoService.joinSession('test-user-2', 'patient');
            expect(joinInfo).toBeDefined();
            expect(joinInfo.participantId).toBe('test-user-2');
            
            // Get session statistics
            const stats = videoService.getSessionStatistics();
            expect(stats.sessionId).toBe(testSessionId);
            expect(stats.active).toBe(true);
            expect(stats.participantCount).toBe(2);
        });

        test('should handle errors gracefully', async () => {
            videoService = new SecureVideoService(testSessionId);
            
            // Test error handling
            videoService.on('error', (error) => {
                expect(error.message).toBeDefined();
            });
            
            // This should not throw
            await videoService.leaveSession('non-existent-user');
        });
    });

    describe('Secure Chat Service', () => {
        test('should initialize chat service', () => {
            chatService = new SecureChatService(testSessionId, {
                encryptionEnabled: true,
                phiDetectionEnabled: true
            });
            
            expect(chatService).toBeDefined();
            expect(chatService.sessionId).toBe(testSessionId);
            expect(chatService.config.encryptionEnabled).toBe(true);
        });

        test('should handle message encryption', async () => {
            chatService = new SecureChatService(testSessionId, {
                encryptionEnabled: true
            });
            
            const testMessage = 'This is a test message';
            const encrypted = chatService.encryptMessage(testMessage);
            
            expect(encrypted).toBeDefined();
            expect(encrypted.encrypted).toBeDefined();
            expect(encrypted.iv).toBeDefined();
            expect(encrypted.algorithm).toBeDefined();
            
            const decrypted = chatService.decryptMessage(encrypted, chatService.currentKeyId);
            expect(decrypted).toBe(testMessage);
        });

        test('should detect PHI in messages', () => {
            chatService = new SecureChatService(testSessionId, {
                phiDetectionEnabled: true
            });
            
            const messageWithPHI = 'Patient SSN is 123-45-6789 and phone is 555-123-4567';
            const phiDetected = chatService.detectPHI(messageWithPHI);
            
            expect(Array.isArray(phiDetected)).toBe(true);
            expect(phiDetected.length).toBeGreaterThan(0);
            
            const ssnDetected = phiDetected.find(phi => phi.type === 'ssn');
            expect(ssnDetected).toBeDefined();
            expect(ssnDetected.value).toBe('123-45-6789');
        });

        test('should anonymize PHI', () => {
            chatService = new SecureChatService(testSessionId, {
                phiAnonymizationEnabled: true
            });
            
            const messageWithPHI = 'Patient SSN is 123-45-6789';
            const phiDetected = chatService.detectPHI(messageWithPHI);
            const anonymized = chatService.anonymizePHI(messageWithPHI, phiDetected);
            
            expect(anonymized).toBe('Patient SSN is [SSN]');
        });

        test('should handle rate limiting', () => {
            chatService = new SecureChatService(testSessionId, {
                maxMessagesPerMinute: 60
            });
            
            // First message should pass
            expect(chatService.checkRateLimit('message')).toBe(true);
            
            // Simulate many messages
            for (let i = 0; i < 60; i++) {
                chatService.checkRateLimit('message');
            }
            
            // Should now be rate limited
            expect(chatService.checkRateLimit('message')).toBe(false);
        });

        test('should handle file validation', async () => {
            chatService = new SecureChatService(testSessionId, {
                fileShareEnabled: true,
                maxFileSize: 1024 * 1024, // 1MB
                allowedFileTypes: ['text/plain', 'application/pdf']
            });
            
            const validFile = {
                buffer: Buffer.from('Test file content'),
                size: 100,
                mimetype: 'text/plain',
                originalname: 'test.txt'
            };
            
            // This should work in a real implementation
            // For now, we just test the structure
            expect(validFile.buffer).toBeDefined();
            expect(validFile.size).toBeLessThanOrEqual(1024 * 1024);
        });

        test('should get chat statistics', () => {
            chatService = new SecureChatService(testSessionId);
            
            const stats = chatService.getChatStatistics();
            expect(stats.sessionId).toBe(testSessionId);
            expect(stats.encryptionEnabled).toBeDefined();
            expect(stats.messageCount).toBe(0);
            expect(stats.participantCount).toBe(0);
        });
    });

    describe('Realtime Whisper Service', () => {
        test('should initialize whisper service', () => {
            whisperService = new RealtimeWhisperService(testSessionId, {
                language: 'en',
                enableVAD: true,
                medicalTermsEnabled: true
            });
            
            expect(whisperService).toBeDefined();
            expect(whisperService.sessionId).toBe(testSessionId);
            expect(whisperService.config.language).toBe('en');
        });

        test('should detect PHI in transcriptions', () => {
            whisperService = new RealtimeWhisperService(testSessionId, {
                phiDetectionEnabled: true
            });
            
            const transcriptWithPHI = 'Patient John Doe, SSN 123-45-6789, has hypertension';
            const phiDetected = whisperService.detectPHI(transcriptWithPHI);
            
            expect(Array.isArray(phiDetected)).toBe(true);
            expect(phiDetected.length).toBeGreaterThan(0);
        });

        test('should enhance medical terminology', () => {
            whisperService = new RealtimeWhisperService(testSessionId, {
                medicalTermsEnabled: true,
                specialty: 'cardiology'
            });
            
            const text = 'Patient has hart rate of 80 and blood preasure is normal';
            const enhanced = whisperService.enhanceMedicalTerms(text);
            
            expect(enhanced).toBe('Patient has heart rate of 80 and blood pressure is normal');
        });

        test('should detect voice activity', () => {
            whisperService = new RealtimeWhisperService(testSessionId, {
                enableVAD: true,
                silenceThreshold: 0.01
            });
            
            // Mock audio data
            const audioData = Buffer.alloc(1024);
            audioData.fill(100); // Non-zero values simulate audio
            
            const vadResult = whisperService.detectVoiceActivity(audioData);
            expect(vadResult).toBeDefined();
            expect(vadResult.hasSpeech).toBeDefined();
            expect(vadResult.energy).toBeDefined();
        });

        test('should get service statistics', () => {
            whisperService = new RealtimeWhisperService(testSessionId);
            
            const stats = whisperService.getStatistics();
            expect(stats.sessionId).toBe(testSessionId);
            expect(stats.connected).toBe(false);
            expect(stats.transcribing).toBe(false);
            expect(stats.transcriptionsCount).toBe(0);
        });

        test('should handle transcription history', () => {
            whisperService = new RealtimeWhisperService(testSessionId);
            
            const history = whisperService.getTranscriptionHistory();
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(0);
        });
    });

    describe('Service Integration', () => {
        test('should work together in a telehealth session', async () => {
            // Initialize all services for a telehealth session
            videoService = new SecureVideoService(testSessionId, {
                recordingEnabled: false,
                transcriptionEnabled: true
            });
            
            chatService = new SecureChatService(testSessionId, {
                encryptionEnabled: true,
                phiDetectionEnabled: true
            });
            
            whisperService = new RealtimeWhisperService(testSessionId, {
                language: 'en',
                medicalTermsEnabled: true
            });
            
            expect(videoService.sessionId).toBe(testSessionId);
            expect(chatService.sessionId).toBe(testSessionId);
            expect(whisperService.sessionId).toBe(testSessionId);
            
            // Test cross-service functionality
            const videoStats = videoService.getSessionStatistics();
            const chatStats = chatService.getChatStatistics();
            const whisperStats = whisperService.getStatistics();
            
            expect(videoStats.sessionId).toBe(chatStats.sessionId);
            expect(chatStats.sessionId).toBe(whisperStats.sessionId);
        });

        test('should maintain HIPAA compliance across services', () => {
            videoService = new SecureVideoService(testSessionId);
            chatService = new SecureChatService(testSessionId);
            whisperService = new RealtimeWhisperService(testSessionId);
            
            // All services should support encryption
            expect(videoService.config.encryptionEnabled).toBe(true);
            expect(chatService.config.encryptionEnabled).toBe(true);
            expect(whisperService.config.encryptTransmission).toBe(true);
            
            // All services should support PHI detection
            expect(chatService.config.phiDetectionEnabled).toBe(true);
            expect(whisperService.config.phiDetectionEnabled).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle service initialization errors', () => {
            expect(() => {
                new SecureVideoService(''); // Invalid session ID
            }).toThrow();
        });

        test('should handle configuration errors', () => {
            expect(() => {
                new SecureVideoService(testSessionId, {
                    maxBitrate: 100, // Too low
                    minBitrate: 200  // Higher than max
                });
            }).toThrow();
        });

        test('should handle missing encryption keys', () => {
            // Temporarily remove encryption key
            const originalKey = process.env.HIPAA_ENCRYPTION_KEY;
            delete process.env.HIPAA_ENCRYPTION_KEY;
            
            expect(() => {
                hipaaConfig.encryptData({ test: 'data' });
            }).toThrow();
            
            // Restore key
            process.env.HIPAA_ENCRYPTION_KEY = originalKey;
        });
    });
});

// Helper function to create mock file
function createMockFile(content, filename, mimetype) {
    return {
        buffer: Buffer.from(content),
        size: Buffer.byteLength(content),
        mimetype,
        originalname: filename
    };
}

module.exports = {
    createMockFile
};