import client from 'prom-client';

client.collectDefaultMetrics({ prefix: 'light_emr_' });

export const requestHistogram = new client.Histogram({
  name: 'light_emr_http_request_duration_seconds',
  help: 'Request duration seconds',
  labelNames: ['method', 'route', 'status']
});

export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const diffNs = Number(process.hrtime.bigint() - start);
    requestHistogram.labels(req.method, req.route?.path || req.path, String(res.statusCode)).observe(diffNs / 1e9);
  });
  next();
}

export function metricsHandler(req, res) {
  res.set('Content-Type', client.register.contentType);
  res.end(client.register.metrics());
}
