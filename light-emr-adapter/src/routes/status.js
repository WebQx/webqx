import express from 'express';
import { checkMedplum } from '../medplum.js';
import { checkNextcloud } from '../nextcloud.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  const [medplum, nextcloud] = await Promise.all([
    checkMedplum(),
    checkNextcloud()
  ]);
  const degraded = [medplum, nextcloud].some(d => d.status === 'offline') || false;
  const offline = [medplum, nextcloud].every(d => d.status !== 'online');
  const status = offline ? 'offline' : degraded ? 'degraded' : 'online';
  res.json({
    status,
    service: 'light-emr-adapter',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime_s: process.uptime().toFixed(1),
    dependencies: { medplum, nextcloud }
  });
});

export default router;
