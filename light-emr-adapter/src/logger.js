import pino from 'pino';

export const logger = pino({
  level: process.env.ADAPTER_LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'res.headers.authorization']
});
