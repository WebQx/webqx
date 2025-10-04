import express from 'express';
import { listPatients } from '../medplum.js';

const router = express.Router();

router.get('/patients', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 25);
  const patients = await listPatients(limit);
  res.json({
    status: 'ok',
    count: patients.length,
    patients
  });
});

export default router;
