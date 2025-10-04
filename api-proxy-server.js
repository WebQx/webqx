#!/usr/bin/env node

/**
 * WebQX API Proxy Server
 * 
 * CORS-enabled proxy server for EMR and telehealth services
 * Designed to bridge GitHub Pages static hosting with backend services
 * 
 * Features:
 * - CORS headers for GitHub Pages
 * - EMR API proxying to OpenEMR/other EHR systems
 * - Telehealth WebSocket proxy
 * - Environment-aware configuration
 * - Health checks and monitoring
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const WebSocket = require('ws');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');
const client = require('prom-client');
const { randomUUID } = require('crypto');
require('dotenv').config();

class WebQXAPIProxy {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
    // Support common hosting env var PORT (Railway, Render, etc.)
    this.port = process.env.PROXY_PORT || process.env.PORT || 3001;
        
        // Configuration
        this.config = {
            // CORS configuration for GitHub Pages
            cors: (() => {
                // Allow override via env: comma separated list, or *
                const raw = process.env.ALLOWED_ORIGINS;
                if (raw) {
                    if (raw.trim() === '*') {
                        return {
                            origin: '*',
                            credentials: true,
                            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
                            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
                        };
                    }
                    const split = raw.split(',').map(o => o.trim()).filter(Boolean);
                    if (split.length) {
                        return {
                            origin: split,
                            credentials: true,
                            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
                            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
                        };
                    }
                }
                return {
                    origin: [
                        'https://webqx.github.io',
                        'https://webqx.com',
                        'http://localhost:3000',
                        'http://localhost:8080',
                        'http://127.0.0.1:5500', // Live Server
                        /\.github\.io$/,
                        /\.vercel\.app$/,
                        /\.netlify\.app$/
                    ],
                    credentials: true,
                    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
                    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
                };
            })(),
            
            // EMR system endpoints
            emr: {
                openemr: {
                    target: process.env.OPENEMR_URL || 'https://demo.openemr.io',
                    pathRewrite: { '^/api/emr/openemr': '' },
                    changeOrigin: true
                },
                webqx: {
                    target: process.env.WEBQX_EMR_URL || 'http://localhost:8080',
                    pathRewrite: { '^/api/emr/webqx': '' },
                    changeOrigin: true
                }
            },
            
            // Telehealth endpoints
            telehealth: {
                target: process.env.TELEHEALTH_URL || 'http://localhost:3003',
                pathRewrite: { '^/api/telehealth': '' },
                changeOrigin: true,
                ws: true // Enable WebSocket proxying
            },
            
            // Rate limiting
            rateLimit: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 1000, // Limit each IP to 1000 requests per windowMs
                message: 'Too many requests from this IP'
            }
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                useDefaults: true,
                directives: {
                    "default-src": ["'none'"],
                    "connect-src": ["'self'", '*'],
                    "frame-ancestors": ["'none'"],
                    "base-uri": ["'none'"],
                }
            },
            crossOriginEmbedderPolicy: false
        }));
        
        // CORS middleware
        this.app.use(cors(this.config.cors));
        
        // Layered rate limiting
        const genericLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false });
        const healthLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
        const proxyLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
        this.limiters = { genericLimiter, healthLimiter, proxyLimiter };
        this.app.use(genericLimiter);

        // Tightened body size
        this.app.use(express.json({ limit: '512kb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '256kb' }));

        // Structured logging & request id
        this.logger = pino({ level: process.env.PROXY_LOG_LEVEL || 'info' });
        this.app.use((req, _res, next) => { req.id = req.headers['x-request-id'] || randomUUID(); next(); });
        this.app.use(pinoHttp({ logger: this.logger, customProps: (req) => ({ requestId: req.id }) }));

        // Audit logging
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                this.logger.info({ type: 'audit', requestId: req.id, method: req.method, path: req.originalUrl, status: res.statusCode, duration_ms: Date.now() - start, ip: req.ip, ua: req.headers['user-agent'] });
            });
            next();
        });

        // Metrics
        client.collectDefaultMetrics({ prefix: 'webqx_proxy_' });
        this.requestHistogram = new client.Histogram({ name: 'webqx_proxy_http_request_duration_seconds', help: 'Request duration seconds', labelNames: ['method','route','status'] });
        this.app.use((req, res, next) => {
            const t0 = process.hrtime.bigint();
            res.on('finish', () => {
                const s = Number(process.hrtime.bigint() - t0) / 1e9;
                this.requestHistogram.labels(req.method, req.route?.path || req.path, String(res.statusCode)).observe(s);
            });
            next();
        });
    }

    setupRoutes() {
        // Unified health schema
        this.app.get('/health', this.limiters.healthLimiter, async (req, res) => {
            res.json({
                status: 'ok',
                service: 'webqx-api-proxy',
                version: '2.0.0',
                timestamp: new Date().toISOString(),
                uptime_s: process.uptime().toFixed(1),
                dependencies: {
                    emr: { target: this.config.emr.openemr.target, status: 'unknown' },
                    telehealth: { target: this.config.telehealth.target, status: 'unknown' }
                }
            });
        });

        // Fallback light adapter endpoints (only if real adapter not mounted upstream)
        this.app.get('/emr/status', this.limiters.healthLimiter, (req, res) => {
            res.json({
                status: 'degraded',
                adapter: 'embedded-fallback',
                message: 'Standalone light-emr-adapter not detected; serving fallback status.',
                timestamp: new Date().toISOString(),
                dependencies: {
                    medplum: { status: 'unknown' },
                    nextcloud: { status: 'unknown' }
                }
            });
        });
        this.app.get('/emr/patients', this.limiters.healthLimiter, (req, res) => {
            res.json({
                patients: [],
                fallback: true,
                message: 'No adapter service active. Deploy light-emr-adapter for real data.'
            });
        });

        // Backwards compatibility alias (some infra tooling may call /healthz)
        this.app.get('/healthz', (req, res) => {
            res.redirect(307, '/health');
        });

        // Runtime environment metadata (safe public info)
        this.app.get('/api/env', this.limiters.healthLimiter, (req, res) => {
            res.json({
                name: process.env.SERVICE_NAME || 'webqx-proxy',
                environment: process.env.NODE_ENV || 'development',
                commit: process.env.GIT_COMMIT || null,
                region: process.env.DEPLOY_REGION || null,
                timestamp: new Date().toISOString(),
                proxy_port: this.port,
                cors_mode: Array.isArray(this.config.cors.origin) ? 'restricted' : (this.config.cors.origin === '*' ? 'open' : 'custom'),
            });
        });

        // System control endpoints
        this.app.post('/api/system/start', async (req, res) => {
            const { services } = req.body;
            
            try {
                const results = {};
                
                for (const service of services || ['emr', 'telehealth']) {
                    try {
                        const healthUrl = service === 'emr' ? 
                            'http://localhost:3000/health' : 
                            'http://localhost:3003/health';
                        
                        const response = await fetch(healthUrl);
                        results[service] = {
                            status: response.ok ? 'running' : 'failed',
                            url: healthUrl
                        };
                    } catch (error) {
                        results[service] = {
                            status: 'failed',
                            error: error.message
                        };
                    }
                }
                
                res.json({
                    success: true,
                    message: 'Service check completed',
                    results: results
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to check services',
                    error: error.message
                });
            }
        });

        this.app.get('/api/system/status', async (req, res) => {
            try {
                const services = {
                    emr: { url: 'http://localhost:3000/health', name: 'EMR Server' },
                    telehealth: { url: 'http://localhost:3003/health', name: 'Telehealth Server' }
                };
                
                const results = {};
                
                for (const [key, service] of Object.entries(services)) {
                    try {
                        const response = await fetch(service.url, { signal: AbortSignal.timeout(5000) });
                        results[key] = {
                            status: response.ok ? 'online' : 'offline',
                            name: service.name,
                            url: service.url
                        };
                    } catch (error) {
                        results[key] = {
                            status: 'offline',
                            name: service.name,
                            url: service.url,
                            error: error.message
                        };
                    }
                }
                
                res.json({
                    timestamp: new Date().toISOString(),
                    services: results
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to check system status',
                    message: error.message
                });
            }
        });        // EMR health check endpoint for GitHub Pages
        this.app.get('/api/emr/health', (req, res) => {
            res.json({
                status: 'online',
                service: 'WebQX EMR API',
                timestamp: new Date().toISOString(),
                endpoints: {
                    openemr: this.config.emr.openemr.target,
                    webqx: this.config.emr.webqx.target
                }
            });
        });
        
        // Telehealth health check
        this.app.get('/api/telehealth/health', (req, res) => {
            res.json({
                status: 'online',
                service: 'WebQX Telehealth API',
                timestamp: new Date().toISOString(),
                websocket: 'available'
            });
        });
        
        // EMR API proxies
    this.app.use('/api/emr/openemr', this.limiters.proxyLimiter, createProxyMiddleware({
            target: this.config.emr.openemr.target,
            changeOrigin: true,
            pathRewrite: this.config.emr.openemr.pathRewrite,
            onError: this.handleProxyError.bind(this),
            onProxyReq: this.logProxyRequest.bind(this)
        }));
        
    this.app.use('/api/emr/webqx', this.limiters.proxyLimiter, createProxyMiddleware({
            target: this.config.emr.webqx.target,
            changeOrigin: true,
            pathRewrite: this.config.emr.webqx.pathRewrite,
            onError: this.handleProxyError.bind(this),
            onProxyReq: this.logProxyRequest.bind(this)
        }));
        
        // Telehealth API proxy
    this.app.use('/api/telehealth', this.limiters.proxyLimiter, createProxyMiddleware({
            target: this.config.telehealth.target,
            changeOrigin: true,
            pathRewrite: this.config.telehealth.pathRewrite,
            ws: true,
            onError: this.handleProxyError.bind(this),
            onProxyReq: this.logProxyRequest.bind(this)
        }));
        
        // Default EMR endpoint (fallback to OpenEMR demo)
    this.app.use('/api/emr', this.limiters.proxyLimiter, createProxyMiddleware({
            target: 'https://demo.openemr.io',
            changeOrigin: true,
            pathRewrite: { '^/api/emr': '' },
            onError: this.handleProxyError.bind(this)
        }));
        
        // API documentation endpoint
        this.app.get('/api', this.limiters.healthLimiter, (req, res) => {
            res.json({
                service: 'WebQX API Proxy',
                version: '1.0.0',
                endpoints: {
                    health: '/health',
                    emr: {
                        health: '/api/emr/health',
                        openemr: '/api/emr/openemr/*',
                        webqx: '/api/emr/webqx/*',
                        default: '/api/emr/*'
                    },
                    telehealth: {
                        health: '/api/telehealth/health',
                        api: '/api/telehealth/*',
                        websocket: 'ws://localhost:3001/api/telehealth/ws'
                    }
                },
                cors: {
                    enabled: true,
                    origins: this.config.cors.origin
                }
            });
        });
    }

    setupWebSocket() {
        // WebSocket server for telehealth
        this.wss = new WebSocket.Server({ 
            server: this.server, 
            path: '/api/telehealth/ws' 
        });
        
        this.wss.on('connection', (ws, req) => {
            // Optional token check
            try {
                const u = new URL(req.url, 'http://localhost');
                const token = u.searchParams.get('token');
                if (process.env.TELEHEALTH_WS_TOKEN && token !== process.env.TELEHEALTH_WS_TOKEN) {
                    ws.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
                    return ws.close();
                }
            } catch {}
            this.logger?.info({ msg: 'WebSocket connection', path: req.url });
            
            ws.on('message', (message) => {
                const text = message.toString();
                if (text.length > 5000) { ws.send(JSON.stringify({ type: 'error', error: 'message_too_large' })); return; }
                ws.send(JSON.stringify({ type: 'echo', data: text, timestamp: new Date().toISOString() }));
            });
            ws.on('close', () => { this.logger?.info({ msg: 'WebSocket closed' }); });
            
            // Send welcome message
            ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to WebQX Telehealth WebSocket', timestamp: new Date().toISOString() }));
        });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl,
                method: req.method,
                availableEndpoints: ['/health', '/api', '/api/emr/health', '/api/telehealth/health']
            });
        });
        
        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error('Error:', err);
            res.status(500).json({
                error: 'Internal server error',
                message: err.message,
                timestamp: new Date().toISOString()
            });
        });
    }

    handleProxyError(err, req, res) {
        this.logger?.error({ msg: 'Proxy error', err: err.message });
        res.status(502).json({
            error: 'Proxy error',
            message: 'Unable to connect to backend service',
            target: req.originalUrl,
            timestamp: new Date().toISOString()
        });
    }

    logProxyRequest(proxyReq, req, res) {
        this.logger?.info({ msg: 'Proxying', method: req.method, path: req.path, host: proxyReq.getHeader('host') });
    }

    start() {
        this.server.listen(this.port, () => {
            this.logger.info({ msg: 'Proxy started', port: this.port, origins: this.config.cors.origin, openemr: this.config.emr.openemr.target, webqx: this.config.emr.webqx.target, telehealth: this.config.telehealth.target });
        });
    }

    stop() {
        this.server.close(() => { this.logger?.warn({ msg: 'Proxy stopped' }); });
    }
}

// Start the proxy server if run directly
if (require.main === module) {
    const proxy = new WebQXAPIProxy();
    proxy.start();
    
    // Graceful shutdown
    const shutdown = (sig) => {
        proxy.logger?.warn({ msg: 'Shutdown signal', signal: sig });
        proxy.stop();
        setTimeout(() => process.exit(0), 5000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = WebQXAPIProxy;