import { logger } from '../../src/logger.js';
import { randomUUID } from 'crypto';

export function requestId(req, _res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  next();
}

export function auditLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      type: 'audit',
      req_id: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      ip: req.ip,
      ua: req.headers['user-agent']
    });
  });
  next();
}
