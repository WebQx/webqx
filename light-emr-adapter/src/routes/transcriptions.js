import express from 'express';
import { createTranscriptDocumentReference, listTranscriptDocumentReferences } from '../medplum.js';
import { logger } from '../logger.js';

const router = express.Router();

/**
 * POST /emr/transcriptions
 * Body: { patientId: string, text: string, language?: string, duration?: number, model?: string, title?: string, description?: string }
 */
router.post('/transcriptions', async (req, res) => {
  try {
    const { patientId, text, language, duration, model, title, description } = req.body || {};
    if (!patientId || !text) {
      return res.status(400).json({ status: 'error', error: 'missing_fields', message: 'patientId and text are required' });
    }
    const doc = await createTranscriptDocumentReference({ patientId, text, meta: { language, duration, model, title, description } });
    if (!doc) return res.status(500).json({ status: 'error', error: 'create_failed', message: 'Failed to persist transcript' });
    res.status(201).json({ status: 'created', documentReference: { id: doc.id, date: doc.date, description: doc.description } });
  } catch (e) {
    logger.error({ msg: 'Transcript persistence failed', err: e.message });
    res.status(500).json({ status: 'error', error: 'internal_error', message: e.message });
  }
});

/**
 * GET /emr/patients/:id/transcriptions
 */
router.get('/patients/:id/transcriptions', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const docs = await listTranscriptDocumentReferences(id, limit);
    res.json({ status: 'ok', count: docs.length, transcriptions: docs });
  } catch (e) {
    logger.error({ msg: 'List patient transcriptions failed', patientId: req.params.id, err: e.message });
    res.status(500).json({ status: 'error', error: 'internal_error', message: e.message });
  }
});

export default router;