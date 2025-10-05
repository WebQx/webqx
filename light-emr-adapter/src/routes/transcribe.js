import express from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { logger } from '../logger.js';
import { config } from '../config.js';

const router = express.Router();

// Configure multer for audio file uploads (max 25MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB (OpenAI limit)
  },
  fileFilter: (req, file, cb) => {
    // Allow common audio formats
    const allowedMimes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave',
      'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/webm',
      'audio/ogg', 'audio/flac'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  }
});

/**
 * POST /emr/transcribe
 * Transcribe audio file using OpenAI Whisper API
 */
router.post('/transcribe', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'missing_file',
        message: 'No audio file provided. Use "file" field in multipart/form-data'
      });
    }

    // Check for API key
    const apiKey = config.OPENAI_API_KEY || config.WHISPER_API_KEY;
    if (!apiKey) {
      logger.error('OPENAI_API_KEY or WHISPER_API_KEY not configured');
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'Transcription service not configured. Missing API key.'
      });
    }

    const language = req.body.language || 'en';
    const prompt = req.body.prompt || '';
    const temperature = parseFloat(req.body.temperature || '0');

    logger.info({
      msg: 'Transcription request',
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      language
    });

    // Prepare FormData for OpenAI API
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname || 'audio.mp3',
      contentType: req.file.mimetype
    });
    formData.append('model', config.WHISPER_MODEL || 'whisper-1');
    formData.append('language', language);
    if (prompt) formData.append('prompt', prompt);
    formData.append('temperature', temperature.toString());
    formData.append('response_format', 'verbose_json');

    // Call OpenAI Whisper API
    const whisperUrl = `${config.WHISPER_BASE_URL || 'https://api.openai.com/v1'}/audio/transcriptions`;
    const response = await fetch(whisperUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({
        msg: 'OpenAI API error',
        status: response.status,
        error: errorText
      });
      
      return res.status(response.status).json({
        error: 'transcription_failed',
        message: `OpenAI API error: ${response.statusText}`,
        details: errorText
      });
    }

    const result = await response.json();
    const duration = (Date.now() - startTime) / 1000;

    logger.info({
      msg: 'Transcription successful',
      textLength: result.text?.length || 0,
      duration_s: duration.toFixed(2),
      audioLang: result.language
    });

    res.json({
      success: true,
      text: result.text,
      language: result.language,
      duration: result.duration,
      segments: result.segments || [],
      processing_time_s: duration.toFixed(2)
    });

  } catch (error) {
    logger.error({
      msg: 'Transcription error',
      err: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'internal_error',
      message: error.message
    });
  }
});

/**
 * GET /emr/transcribe/status
 * Check if transcription service is available
 */
router.get('/transcribe/status', (req, res) => {
  const apiKey = config.OPENAI_API_KEY || config.WHISPER_API_KEY;
  const configured = !!apiKey;
  
  res.json({
    service: 'whisper-transcription',
    status: configured ? 'online' : 'offline',
    configured,
    model: config.WHISPER_MODEL || 'whisper-1',
    maxFileSize: '25MB',
    supportedFormats: ['mp3', 'mp4', 'm4a', 'wav', 'webm', 'ogg', 'flac']
  });
});

export default router;
