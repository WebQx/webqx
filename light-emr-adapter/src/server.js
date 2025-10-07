import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config, parseAllowedOrigins } from './config.js';
import { logger } from './logger.js';
import pinoHttp from 'pino-http';
import statusRouter from './routes/status.js';
import patientsRouter from './routes/patients.js';
import transcribeRouter from './routes/transcribe.js';
import transcriptionsRouter from './routes/transcriptions.js';
import healthRouter from './routes/health.js';
import { requestId, auditLogger } from './middleware/audit.js';
import { defaultLimiter, statusLimiter, patientsLimiter } from './middleware/rateLimits.js';
import { metricsHandler, metricsMiddleware } from './metrics.js';

const app = express();
app.set('trust proxy', 1);

const origins = parseAllowedOrigins(config.ALLOWED_ORIGINS);
app.use(cors({ origin: origins, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(requestId);
app.use(pinoHttp({ logger }));
app.use(auditLogger);
app.use(metricsMiddleware);
app.use(defaultLimiter);

// Simple health check (no rate limiting)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'light-emr-adapter', version: '0.1.0', uptime_s: process.uptime().toFixed(1) });
});

// Metrics
app.get('/metrics', metricsHandler);

// Comprehensive health checks
app.use('/emr', healthRouter);

// Namespaced API
app.use('/emr', statusLimiter, statusRouter);
app.use('/emr', patientsLimiter, patientsRouter);
app.use('/emr', transcribeRouter);
app.use('/emr', transcriptionsRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error({ msg: 'Unhandled error', err: err.message, stack: err.stack });
  res.status(500).json({ error: 'internal_error', message: err.message });
});

const server = app.listen(config.PORT, () => {
  logger.info({ msg: 'Light EMR Adapter started', port: config.PORT });
});

function gracefulShutdown(signal) {
  logger.warn({ msg: 'Graceful shutdown initiated', signal });
  server.close(err => {
    if (err) {
      logger.error({ msg: 'Error during shutdown', err: err.message });
      process.exit(1);
    }
    logger.info({ msg: 'Shutdown complete' });
    process.exit(0);
  });
  // Failsafe
  setTimeout(() => process.exit(0), 8000).unref();
}

['SIGINT','SIGTERM'].forEach(sig => process.on(sig, () => gracefulShutdown(sig)));

export default app;
