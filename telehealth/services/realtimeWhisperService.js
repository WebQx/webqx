/**
 * @fileoverview Real-time Whisper Service for Telehealth
 * 
 * This service provides real-time speech-to-text transcription for telehealth
 * sessions with multilingual support, medical terminology recognition, and
 * HIPAA-compliant processing.
 * 
 * Features:
 * - Real-time audio streaming and transcription
 * - Multilingual support with auto-detection
 * - Medical terminology optimization
 * - Live translation capabilities
 * - HIPAA-compliant data handling
 * - Voice activity detection
 * - Speaker identification
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const EventEmitter = require('events');
const WebSocket = require('ws');
const crypto = require('crypto');
const hipaaConfig = require('../config/hipaa');

/**
 * Real-time Whisper Service for telehealth transcription
 */
class RealtimeWhisperService extends EventEmitter {
    constructor(sessionId, options = {}) {
        super();
        
        this.sessionId = sessionId;
        this.config = {
            // API configuration
            apiEndpoint: process.env.WHISPER_STREAMING_ENDPOINT || 'wss://api.openai.com/v1/realtime',
            apiKey: process.env.WHISPER_STREAMING_API_KEY || process.env.WHISPER_API_KEY,
            
            // Audio configuration
            sampleRate: options.sampleRate || parseInt(process.env.WHISPER_SAMPLE_RATE || '16000'),
            chunkDuration: options.chunkDuration || parseInt(process.env.WHISPER_CHUNK_DURATION || '3000'),
            channels: options.channels || 1,
            
            // Transcription configuration
            language: options.language || 'auto',
            targetLanguage: options.targetLanguage || 'en',
            enableTranslation: options.enableTranslation || false,
            
            // Voice Activity Detection
            enableVAD: options.enableVAD !== false,
            silenceThreshold: options.silenceThreshold || parseFloat(process.env.WHISPER_SILENCE_THRESHOLD || '0.01'),
            maxSilenceDuration: options.maxSilenceDuration || parseInt(process.env.WHISPER_MAX_SILENCE_DURATION || '2000'),
            
            // Medical configuration
            medicalTermsEnabled: options.medicalTermsEnabled !== false,
            specialty: options.specialty || 'general',
            phiDetectionEnabled: options.phiDetectionEnabled !== false,
            
            // Quality configuration
            qualityThreshold: options.qualityThreshold || 0.7,
            maxRetries: options.maxRetries || 3,
            bufferSize: options.bufferSize || 8192,
            
            // HIPAA compliance
            encryptTransmission: options.encryptTransmission !== false,
            logTranscriptions: options.logTranscriptions !== false,
            anonymizeResults: options.anonymizeResults !== false,
            
            ...options
        };

        this.state = {
            connected: false,
            transcribing: false,
            lastActivity: new Date(),
            audioBuffer: Buffer.alloc(0),
            totalProcessed: 0,
            sessionsActive: 0
        };

        this.websocket = null;
        this.audioChunks = [];
        this.transcriptionHistory = [];
        this.speakerProfiles = new Map();
        
        this.initializeService();
    }

    /**
     * Initialize the real-time transcription service
     */
    initializeService() {
        // Validate configuration
        this.validateConfiguration();
        
        // Initialize medical terminology
        this.initializeMedicalTerms();
        
        // Set up voice activity detection
        this.initializeVAD();
        
        // Log service initialization
        hipaaConfig.logAuditEvent('REALTIME_TRANSCRIPTION_INIT', {
            sessionId: this.sessionId,
            resourceType: 'TranscriptionService',
            action: 'INITIALIZE',
            details: {
                language: this.config.language,
                specialty: this.config.specialty,
                vadEnabled: this.config.enableVAD
            }
        });

        console.log('✅ Real-time Whisper service initialized', {
            sessionId: this.sessionId,
            language: this.config.language,
            sampleRate: this.config.sampleRate
        });
    }

    /**
     * Validate service configuration
     */
    validateConfiguration() {
        if (!this.config.apiKey) {
            throw new Error('Whisper API key is required for real-time transcription');
        }

        if (!this.sessionId) {
            throw new Error('Session ID is required for HIPAA compliance');
        }

        if (this.config.sampleRate < 8000 || this.config.sampleRate > 48000) {
            throw new Error('Sample rate must be between 8000 and 48000 Hz');
        }

        if (this.config.chunkDuration < 1000 || this.config.chunkDuration > 10000) {
            console.warn('⚠️ Chunk duration should be between 1-10 seconds for optimal performance');
        }
    }

    /**
     * Initialize medical terminology support
     */
    initializeMedicalTerms() {
        this.medicalTerms = {
            general: [
                'patient', 'diagnosis', 'symptoms', 'treatment', 'medication',
                'prescription', 'dosage', 'allergies', 'medical history',
                'vital signs', 'blood pressure', 'heart rate', 'temperature'
            ],
            cardiology: [
                'arrhythmia', 'hypertension', 'myocardial', 'echocardiogram',
                'electrocardiogram', 'coronary', 'angioplasty', 'stent'
            ],
            pulmonology: [
                'respiratory', 'bronchial', 'pneumonia', 'asthma', 'copd',
                'spirometry', 'oxygen saturation', 'ventilator'
            ],
            oncology: [
                'chemotherapy', 'radiation', 'metastasis', 'tumor', 'malignant',
                'benign', 'biopsy', 'staging', 'prognosis'
            ],
            psychiatry: [
                'depression', 'anxiety', 'bipolar', 'schizophrenia', 'therapy',
                'counseling', 'antidepressant', 'mood stabilizer'
            ]
        };

        this.currentTerms = [
            ...this.medicalTerms.general,
            ...(this.medicalTerms[this.config.specialty] || [])
        ];
    }

    /**
     * Initialize Voice Activity Detection
     */
    initializeVAD() {
        if (!this.config.enableVAD) {
            return;
        }

        this.vadState = {
            isSpeaking: false,
            silenceStart: null,
            energyHistory: [],
            energyThreshold: this.config.silenceThreshold
        };
    }

    /**
     * Connect to real-time transcription service
     */
    async connect() {
        try {
            if (this.websocket) {
                await this.disconnect();
            }

            const wsUrl = this.buildWebSocketURL();
            this.websocket = new WebSocket(wsUrl, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'User-Agent': 'WebQX-Telehealth/1.0.0',
                    'X-Session-ID': this.sessionId
                }
            });

            this.setupWebSocketHandlers();
            
            await this.waitForConnection();
            
            this.state.connected = true;
            this.emit('connected');

            // Log connection
            hipaaConfig.logAuditEvent('REALTIME_TRANSCRIPTION_CONNECT', {
                sessionId: this.sessionId,
                resourceType: 'TranscriptionService',
                action: 'CONNECT',
                details: { endpoint: wsUrl.split('?')[0] }
            });

            console.log('✅ Connected to real-time transcription service');
            
        } catch (error) {
            this.handleError('Connection failed', error);
            throw error;
        }
    }

    /**
     * Build WebSocket URL with parameters
     */
    buildWebSocketURL() {
        const url = new URL(this.config.apiEndpoint);
        url.searchParams.set('model', 'whisper-1');
        url.searchParams.set('language', this.config.language);
        url.searchParams.set('sample_rate', this.config.sampleRate.toString());
        url.searchParams.set('channels', this.config.channels.toString());
        
        if (this.config.medicalTermsEnabled) {
            url.searchParams.set('prompt', this.buildMedicalPrompt());
        }
        
        return url.toString();
    }

    /**
     * Build medical terminology prompt
     */
    buildMedicalPrompt() {
        const basePrompt = `Medical consultation transcript with terms like: ${this.currentTerms.slice(0, 10).join(', ')}`;
        return basePrompt;
    }

    /**
     * Setup WebSocket event handlers
     */
    setupWebSocketHandlers() {
        this.websocket.on('open', () => {
            console.log('📡 WebSocket connection opened');
        });

        this.websocket.on('message', (data) => {
            this.handleWebSocketMessage(data);
        });

        this.websocket.on('error', (error) => {
            this.handleError('WebSocket error', error);
        });

        this.websocket.on('close', (code, reason) => {
            this.handleWebSocketClose(code, reason);
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'transcription':
                    this.handleTranscriptionResult(message);
                    break;
                    
                case 'translation':
                    this.handleTranslationResult(message);
                    break;
                    
                case 'error':
                    this.handleServerError(message);
                    break;
                    
                case 'speaker_identification':
                    this.handleSpeakerIdentification(message);
                    break;
                    
                default:
                    console.warn('Unknown message type:', message.type);
            }
        } catch (error) {
            this.handleError('Failed to parse WebSocket message', error);
        }
    }

    /**
     * Handle transcription results
     */
    handleTranscriptionResult(message) {
        const result = {
            id: crypto.randomUUID(),
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            text: message.text,
            language: message.language || this.config.language,
            confidence: message.confidence || 0,
            isFinal: message.is_final || false,
            speakerId: message.speaker_id,
            startTime: message.start_time,
            endTime: message.end_time,
            words: message.words || []
        };

        // Apply medical terminology enhancement
        if (this.config.medicalTermsEnabled) {
            result.text = this.enhanceMedicalTerms(result.text);
        }

        // Apply PHI detection and anonymization
        if (this.config.phiDetectionEnabled) {
            result.phiDetected = this.detectPHI(result.text);
            if (this.config.anonymizeResults && result.phiDetected.length > 0) {
                result.text = this.anonymizePHI(result.text, result.phiDetected);
            }
        }

        // Store transcription
        this.transcriptionHistory.push(result);

        // Emit events
        if (result.isFinal) {
            this.emit('finalTranscription', result);
        } else {
            this.emit('partialTranscription', result);
        }

        // Handle translation if enabled
        if (this.config.enableTranslation && result.language !== this.config.targetLanguage) {
            this.requestTranslation(result);
        }

        // Log transcription event
        if (this.config.logTranscriptions) {
            hipaaConfig.logAuditEvent('TRANSCRIPTION_RECEIVED', {
                sessionId: this.sessionId,
                resourceType: 'Transcription',
                resourceId: result.id,
                action: 'TRANSCRIBE',
                details: {
                    language: result.language,
                    confidence: result.confidence,
                    isFinal: result.isFinal,
                    phiDetected: result.phiDetected?.length || 0
                }
            });
        }
    }

    /**
     * Handle translation results
     */
    handleTranslationResult(message) {
        const translation = {
            originalId: message.original_id,
            translatedText: message.translated_text,
            sourceLanguage: message.source_language,
            targetLanguage: message.target_language,
            confidence: message.confidence || 0
        };

        this.emit('translationReceived', translation);

        // Log translation event
        hipaaConfig.logAuditEvent('TRANSLATION_RECEIVED', {
            sessionId: this.sessionId,
            resourceType: 'Translation',
            action: 'TRANSLATE',
            details: {
                sourceLanguage: translation.sourceLanguage,
                targetLanguage: translation.targetLanguage,
                confidence: translation.confidence
            }
        });
    }

    /**
     * Process audio stream
     */
    processAudioStream(audioData) {
        if (!this.state.connected || !this.state.transcribing) {
            return;
        }

        try {
            // Add to audio buffer
            this.state.audioBuffer = Buffer.concat([this.state.audioBuffer, audioData]);
            this.state.lastActivity = new Date();

            // Apply Voice Activity Detection
            if (this.config.enableVAD) {
                const vadResult = this.detectVoiceActivity(audioData);
                if (!vadResult.hasSpeech) {
                    return; // Skip silent audio
                }
            }

            // Check if we have enough data for a chunk
            const chunkSizeBytes = (this.config.sampleRate * this.config.chunkDuration / 1000) * 2; // 16-bit audio
            
            if (this.state.audioBuffer.length >= chunkSizeBytes) {
                const chunk = this.state.audioBuffer.slice(0, chunkSizeBytes);
                this.state.audioBuffer = this.state.audioBuffer.slice(chunkSizeBytes);
                
                this.sendAudioChunk(chunk);
            }

        } catch (error) {
            this.handleError('Failed to process audio stream', error);
        }
    }

    /**
     * Detect voice activity in audio
     */
    detectVoiceActivity(audioData) {
        if (!this.config.enableVAD) {
            return { hasSpeech: true, energy: 1.0 };
        }

        // Calculate audio energy (simplified)
        let energy = 0;
        for (let i = 0; i < audioData.length; i += 2) {
            const sample = audioData.readInt16LE(i);
            energy += Math.abs(sample);
        }
        energy = energy / (audioData.length / 2);

        // Update energy history
        this.vadState.energyHistory.push(energy);
        if (this.vadState.energyHistory.length > 10) {
            this.vadState.energyHistory.shift();
        }

        // Determine if speech is present
        const hasSpeech = energy > this.vadState.energyThreshold;
        
        // Track silence periods
        if (!hasSpeech) {
            if (!this.vadState.silenceStart) {
                this.vadState.silenceStart = Date.now();
            }
        } else {
            this.vadState.silenceStart = null;
        }

        return { hasSpeech, energy };
    }

    /**
     * Send audio chunk for transcription
     */
    sendAudioChunk(audioChunk) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            const message = {
                type: 'audio',
                audio: audioChunk.toString('base64'),
                timestamp: Date.now(),
                chunk_id: crypto.randomUUID()
            };

            this.websocket.send(JSON.stringify(message));
            this.state.totalProcessed += audioChunk.length;

        } catch (error) {
            this.handleError('Failed to send audio chunk', error);
        }
    }

    /**
     * Start real-time transcription
     */
    async startTranscription() {
        if (!this.state.connected) {
            await this.connect();
        }

        this.state.transcribing = true;
        this.emit('transcriptionStarted');

        // Log transcription start
        hipaaConfig.logAuditEvent('REALTIME_TRANSCRIPTION_START', {
            sessionId: this.sessionId,
            resourceType: 'TranscriptionService',
            action: 'START_TRANSCRIPTION',
            details: {
                language: this.config.language,
                vadEnabled: this.config.enableVAD
            }
        });

        console.log('🎙️ Real-time transcription started');
    }

    /**
     * Stop real-time transcription
     */
    async stopTranscription() {
        this.state.transcribing = false;
        
        // Send any remaining audio
        if (this.state.audioBuffer.length > 0) {
            this.sendAudioChunk(this.state.audioBuffer);
            this.state.audioBuffer = Buffer.alloc(0);
        }

        this.emit('transcriptionStopped');

        // Log transcription stop
        hipaaConfig.logAuditEvent('REALTIME_TRANSCRIPTION_STOP', {
            sessionId: this.sessionId,
            resourceType: 'TranscriptionService',
            action: 'STOP_TRANSCRIPTION',
            details: {
                totalProcessed: this.state.totalProcessed,
                transcriptionsCount: this.transcriptionHistory.length
            }
        });

        console.log('🛑 Real-time transcription stopped');
    }

    /**
     * Request translation for a transcription
     */
    requestTranslation(transcription) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        const message = {
            type: 'translate',
            text: transcription.text,
            source_language: transcription.language,
            target_language: this.config.targetLanguage,
            original_id: transcription.id
        };

        this.websocket.send(JSON.stringify(message));
    }

    /**
     * Enhance medical terminology in text
     */
    enhanceMedicalTerms(text) {
        let enhanced = text;
        
        // Apply medical term corrections
        const corrections = {
            'blood preasure': 'blood pressure',
            'hart rate': 'heart rate',
            'temprature': 'temperature',
            'perscription': 'prescription',
            'alergies': 'allergies'
        };

        Object.entries(corrections).forEach(([wrong, correct]) => {
            enhanced = enhanced.replace(new RegExp(wrong, 'gi'), correct);
        });

        return enhanced;
    }

    /**
     * Detect PHI in transcription text
     */
    detectPHI(text) {
        const phiPatterns = [
            { type: 'ssn', pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g },
            { type: 'phone', pattern: /\b\d{3}-?\d{3}-?\d{4}\b/g },
            { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
            { type: 'mrn', pattern: /\b(?:MRN|mrn|medical record|patient id)\s*:?\s*(\w+)/gi },
            { type: 'date', pattern: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g }
        ];

        const detected = [];
        
        phiPatterns.forEach(({ type, pattern }) => {
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    detected.push({ type, value: match, position: text.indexOf(match) });
                });
            }
        });

        return detected;
    }

    /**
     * Anonymize PHI in text
     */
    anonymizePHI(text, phiDetected) {
        let anonymized = text;
        
        // Sort by position (descending) to maintain string positions
        phiDetected.sort((a, b) => b.position - a.position);
        
        phiDetected.forEach(phi => {
            const replacement = `[${phi.type.toUpperCase()}]`;
            anonymized = anonymized.replace(phi.value, replacement);
        });

        return anonymized;
    }

    /**
     * Wait for WebSocket connection
     */
    waitForConnection() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);

            this.websocket.on('open', () => {
                clearTimeout(timeout);
                resolve();
            });

            this.websocket.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Disconnect from service
     */
    async disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        this.state.connected = false;
        this.state.transcribing = false;
        
        this.emit('disconnected');

        // Log disconnection
        hipaaConfig.logAuditEvent('REALTIME_TRANSCRIPTION_DISCONNECT', {
            sessionId: this.sessionId,
            resourceType: 'TranscriptionService',
            action: 'DISCONNECT',
            details: {
                totalProcessed: this.state.totalProcessed,
                transcriptionsCount: this.transcriptionHistory.length
            }
        });

        console.log('📡 Disconnected from real-time transcription service');
    }

    /**
     * Handle WebSocket close
     */
    handleWebSocketClose(code, reason) {
        this.state.connected = false;
        this.state.transcribing = false;
        
        console.log(`📡 WebSocket closed: ${code} - ${reason}`);
        
        // Attempt reconnection if unexpected close
        if (code !== 1000 && code !== 1001) {
            console.log('🔄 Attempting to reconnect...');
            setTimeout(() => this.connect().catch(console.error), 5000);
        }
    }

    /**
     * Handle errors
     */
    handleError(message, error) {
        console.error(`❌ ${message}:`, error);
        
        this.emit('error', { message, error });

        // Log error event
        hipaaConfig.logAuditEvent('REALTIME_TRANSCRIPTION_ERROR', {
            sessionId: this.sessionId,
            resourceType: 'TranscriptionService',
            action: 'ERROR',
            outcome: 'FAILURE',
            details: { message, error: error.message }
        });
    }

    /**
     * Handle server errors
     */
    handleServerError(message) {
        const error = new Error(message.error || 'Server error');
        this.handleError('Server error received', error);
    }

    /**
     * Handle speaker identification
     */
    handleSpeakerIdentification(message) {
        const speakerId = message.speaker_id;
        const confidence = message.confidence || 0;
        
        if (!this.speakerProfiles.has(speakerId)) {
            this.speakerProfiles.set(speakerId, {
                id: speakerId,
                firstDetected: new Date(),
                totalSpeechTime: 0,
                averageConfidence: confidence
            });
        }

        this.emit('speakerIdentified', { speakerId, confidence });
    }

    /**
     * Get transcription history
     */
    getTranscriptionHistory() {
        return this.transcriptionHistory.slice();
    }

    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            sessionId: this.sessionId,
            connected: this.state.connected,
            transcribing: this.state.transcribing,
            totalProcessed: this.state.totalProcessed,
            transcriptionsCount: this.transcriptionHistory.length,
            speakersDetected: this.speakerProfiles.size,
            lastActivity: this.state.lastActivity,
            uptime: Date.now() - this.serviceStartTime
        };
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.disconnect();
        this.removeAllListeners();
        this.transcriptionHistory = [];
        this.speakerProfiles.clear();
        this.state.audioBuffer = Buffer.alloc(0);
    }
}

module.exports = RealtimeWhisperService;