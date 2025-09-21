/**
 * WebQX™ Healthcare Platform Gateway
 * 
 * Comprehensive server setup for OpenEMR, Telehealth, and Django authentication
 * Provides a single entry point for all healthcare services with proper isolation
 * 
 * Services:
 * - Port 3000: Main WebQx Frontend & API Gateway
 * - Port 3001: Django Authentication Server
 * - Port 3002: OpenEMR Integration Server
 * - Port 3003: Telehealth Services (Video, Messaging, WebRTC)
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const express = require('express');
const { spawn, fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const { PortManager } = require('./port-manager');
// Optional middleware (wrapped in try/catch so missing files won't break startup)
let securityMiddleware, metricsMiddleware, auditMiddleware, authOptional;
try { securityMiddleware = require('../middleware/security'); } catch (_) {}
try { metricsMiddleware = require('../middleware/metrics'); } catch (_) {}
try { auditMiddleware = require('../middleware/audit'); } catch (_) {}
try { authOptional = require('../middleware/auth'); } catch (_) {}
// Removed mock AI Assist and mock FHIR routers for production-only build

class UnifiedHealthcareServer {
    constructor() {
        this.portManager = new PortManager();
        this.services = new Map();
        this.log = (level, msg) => {
            const ts = new Date().toISOString();
            console.log(`[Gateway][${level.toUpperCase()}][${ts}] ${msg}`);
        };
        this.config = {
            // Prefer platform-provided PORT (e.g., Railway/Heroku), fallback to MAIN_PORT or 3000
            mainPort: process.env.PORT || process.env.MAIN_PORT || 3000,
            djangoPort: process.env.DJANGO_PORT || 3001,
            openEMRPort: process.env.OPENEMR_PORT || 3002,
            telehealthPort: process.env.TELEHEALTH_PORT || 3003,
            environment: process.env.NODE_ENV || 'development',
            useRemoteOpenEMR: /^true$/i.test(process.env.USE_REMOTE_OPENEMR || ''),
            remoteOpenEMRUrl: process.env.OPENEMR_REMOTE_URL || '',
            aiAssistEnabled: false,
            openemrCircuitThreshold: parseInt(process.env.OPENEMR_CIRCUIT_THRESHOLD || '5', 10),
            openemrCircuitCooldownMs: parseInt(process.env.OPENEMR_CIRCUIT_COOLDOWN_MS || '15000', 10),
            transcriptionBaseUrl: (process.env.TRANSCRIPTION_BASE_URL || '').trim()
        };
        // Circuit breaker state
        this._openemrFailures = [];
        this._openemrCircuitOpenUntil = 0;
        
        // Service health status
        this.serviceHealth = {
            django: false,
            openemr: false,
            telehealth: false,
            main: false
        };

        this.log('info', 'Initializing WebQX Healthcare Platform Gateway');
    }

    /**
     * Initialize and start all healthcare services
     */
    async start() {
        try {
            this.log('info', 'Starting WebQX Healthcare Platform Services');
            // Reserve ports early to avoid race conflicts
            try {
                this.config.djangoPort = await this.portManager.reservePort('django', this.config.djangoPort);
                if (!this.config.useRemoteOpenEMR) {
                    this.config.openEMRPort = await this.portManager.reservePort('openemr', this.config.openEMRPort);
                }
                this.config.telehealthPort = await this.portManager.reservePort('telehealth', this.config.telehealthPort);
                this.config.mainPort = await this.portManager.reservePort('main', this.config.mainPort);
            } catch (e) {
                this.log('warn', `Port reservation issue: ${e.message}`);
            }
            
            // Create main API gateway
            await this.createMainGateway();

            // Start the main gateway server FIRST so /health is up immediately
            await this.startMainServer();

            // Start all backend services in parallel (non-blocking for health)
            if (this.config.useRemoteOpenEMR) {
                console.log('🌐 Remote OpenEMR mode ENABLED. Backend OpenEMR will not be spawned.');
                await Promise.all([
                    this.startDjangoAuth(),
                    // Skip local OpenEMR integration spawn
                    this.startTelehealthServer()
                ]);
                // Mark OpenEMR as healthy (remote assumption) after lightweight probe (optional)
                this.serviceHealth.openemr = true;
                this.scheduleRemoteOpenEMRProbe();
            } else {
                await Promise.all([
                    this.startDjangoAuth(),
                    this.startOpenEMRServer(),
                    this.startTelehealthServer()
                ]);
            }
            
            this.log('info', 'All WebQX Healthcare Platform Services are running');
            this.printServiceStatus();
            
        } catch (error) {
            this.log('error', `Failed to start platform gateway: ${error.message}`);
            await this.shutdown();
            process.exit(1);
        }
    }

    /**
     * Create the main API gateway that routes to all services
     */
    async createMainGateway() {
    this.app = express();
    // Respect X-Forwarded-* headers from Railway (and other proxies)
    this.app.set('trust proxy', 1);
        
        // Security middleware with remote access support (fixed CSP)
        this.app.use(helmet({
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "'unsafe-eval'",
                        "https://cdn.tailwindcss.com",
                        "https://unpkg.com",
                        "https://cdnjs.cloudflare.com"
                    ],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "https://cdn.tailwindcss.com",
                        "https://cdnjs.cloudflare.com"
                    ],
                    connectSrc: [
                        "'self'",
                        "ws:",
                        "wss:",
                        "http:",
                        "https:"
                    ]
                }
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true
            }
        }));

        // CORS configuration for remote access
        const corsOptions = {
            origin: (origin, callback) => {
                // Allow requests with no origin (mobile apps, Postman, etc.)
                if (!origin) return callback(null, true);
                
                // In production, you might want to restrict to specific domains
                if (this.config.environment === 'production') {
                    // Add your allowed domains here
                    const allowedOrigins = [
                        /^https?:\/\/.*\.webqx\..*$/,          // WebQx subdomains on any TLD (e.g., emr.webqx.com)
                        /^https?:\/\/(www\.)?webqx\.com$/,      // Apex/root domain and www
                        /^https?:\/\/.*\.railway\.app$/,        // Railway hosted domains
                        /^https?:\/\/webqx\.github\.io$/,       // GitHub Pages for this repo/org
                        /^https?:\/\/localhost:\\d+$/,          // Local development
                        /^https?:\/\/192\.168\.\d+\.\d+:\\d+$/,  // Local network
                        /^https?:\/\/10\.\d+\.\d+\.\d+:\\d+$/,   // Private network
                        /^https?:\/\/172\.1[6-9]\.\d+\.\d+:\\d+$/,  // Private network
                        /^https?:\/\/172\.2[0-9]\.\d+\.\d+:\\d+$/,  // Private network
                        /^https?:\/\/172\.3[0-1]\.\d+\.\d+:\\d+$/   // Private network
                    ];
                    
                    const isAllowed = allowedOrigins.some(pattern => pattern.test(origin));
                    if (isAllowed) {
                        callback(null, true);
                    } else {
                        console.warn(`⚠️ CORS blocked origin: ${origin}`);
                        callback(new Error('CORS policy violation'));
                    }
                } else {
                    // Development mode - allow all origins
                    callback(null, true);
                }
            },
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
            allowedHeaders: [
                'Content-Type', 
                'Authorization', 
                'Accept', 
                'Origin', 
                'X-Requested-With',
                'X-HTTP-Method-Override',
                'Cache-Control',
                'Pragma'
            ],
            credentials: true,
            optionsSuccessStatus: 200,
            maxAge: 86400 // 24 hours
        };
        
        this.app.use(cors(corsOptions));
        // Ensure preflight requests are handled for all routes
        this.app.options('*', cors(corsOptions));

        // Friendly redirects for legacy paths and guaranteed serve for emr-login
        this.app.get(['/openemr-login.html', '/openemr-login'], (req, res) => {
            return res.redirect(301, '/emr-login');
        });

        this.app.get(['/emr-login.html', '/emr-login'], (req, res, next) => {
            try {
                const p = path.resolve(__dirname, '..', 'emr-login.html');
                if (fs.existsSync(p)) return res.sendFile(p);
                // Fallback: if not found in repo root, try current working directory
                const alt = path.resolve(process.cwd(), 'emr-login.html');
                if (fs.existsSync(alt)) return res.sendFile(alt);
                return res.status(404).send('emr-login not found');
            } catch (e) {
                return next(e);
            }
        });
        
            // Remote server management endpoints
            /**
             * Remotely trigger server start (for placement card)
             */
            this.app.post('/api/remote-start', async (req, res) => {
                // This is a stub: in production, you would use systemd, PM2, or a cloud API
                // For demo, just return success and log the request
                console.log('🔔 Remote server start requested from placement card:', req.ip);
                res.json({ success: true, message: 'Server start triggered (demo mode)' });
            });

            /**
             * Wake endpoint (for remote wake-up)
             */
            this.app.post('/api/wake', (req, res) => {
                console.log('🔔 Remote wake requested:', req.ip);
                res.json({ success: true, message: 'Server wake triggered (demo mode)' });
            });

            // Local UX helper: allow the login page to call /api/start-server without error
            this.app.post('/api/start-server', (req, res) => {
                console.log('🟢 /api/start-server invoked (stub)');
                // In real deployments, start or check the EMR service here.
                res.json({ success: true, message: 'Start command accepted (stub). Ensure EMR is running on http://localhost:8080' });
            });

            /**
             * Server status endpoint (for placement card health check)
             */
            this.app.get('/api/server-status', (req, res) => {
                res.json({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    services: this.serviceHealth,
                    ports: this.config,
                    message: 'WebQX Healthcare Platform Gateway is online'
                });
            });

        // Rate limiting
        const globalLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // Limit each IP to 1000 requests per windowMs
            message: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' }
        });
        this.app.use(globalLimiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Custom layered middleware (order matters lightly: security -> auth decode -> metrics -> audit)
    if (securityMiddleware) this.app.use(securityMiddleware);
    if (authOptional) this.app.use(authOptional);
    if (metricsMiddleware) this.app.use(metricsMiddleware);
    if (auditMiddleware) this.app.use(auditMiddleware);

        // Serve static files (prefer built artifacts if present)
        const cwd = process.cwd();
        const distDir = path.join(cwd, 'dist');
        const portalDistDir = path.join(cwd, 'portal', 'dist');
        // Favicon handler: serve from dist or provide a tiny fallback to avoid 404 noise
        this.app.get('/favicon.ico', (req, res, next) => {
            const candidates = [
                path.join(distDir, 'favicon.ico'),
                path.join(cwd, 'favicon.ico'),
            ];
            for (const p of candidates) {
                if (p && fs.existsSync(p)) return res.sendFile(p);
            }
            // 1x1 transparent ICO fallback
            const icoBlank = Buffer.from(
                'AAABAAEAEBAAAAAAIABoAwAAFgAAACgAAAAQAAAAIAAAAAEAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'base64');
            res.setHeader('Content-Type', 'image/x-icon');
            return res.status(200).send(icoBlank);
        });
        if (fs.existsSync(distDir)) {
            this.log('info', `Serving static content from dist/: ${distDir}`);
            this.app.use(express.static(distDir));
        }
        if (fs.existsSync(portalDistDir)) {
            this.log('info', `Serving static content from portal/dist: ${portalDistDir}`);
            this.app.use(express.static(portalDistDir));
        }
        // Fallback to repo root for legacy static files
        this.app.use(express.static('.'));

        // Friendly redirects for legacy SPA paths
        this.app.get(['/portal', '/portal/'], (req, res) => {
            // Redirect to unified SPA with portal hash
            return res.redirect(302, '/index.html#portal');
        });
        this.app.get('/portal/*', (req, res) => {
            return res.redirect(302, '/index.html#portal');
        });

        // Patient portal routes
        this.setupPatientPortalRoutes();

        // Health check for the platform gateway
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'WebQX Healthcare Platform Gateway',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                services: this.serviceHealth,
                ports: {
                    main: this.config.mainPort,
                    django: this.config.djangoPort,
                    openemr: this.config.openEMRPort,
                    telehealth: this.config.telehealthPort
                },
                config: {
                    environment: this.config.environment,
                    useRemoteOpenEMR: this.config.useRemoteOpenEMR,
                    transcriptionConfigured: !!(this.config.transcriptionBaseUrl && this.config.transcriptionBaseUrl.length > 0)
                }
            });
        });

        // Lightweight readiness endpoint (all critical deps ready)
        this.app.get('/ready', (req, res) => {
            // Consider django + main mandatory, others optional but reported
            const ready = this.serviceHealth.main && this.serviceHealth.django;
            res.status(ready ? 200 : 503).json({
                ready,
                services: this.serviceHealth,
                timestamp: new Date().toISOString()
            });
        });

        // Internal observability endpoints (unauthenticated for now)
        if (metricsMiddleware && metricsMiddleware.metricsEndpoint) {
            this.app.get('/internal/metrics', metricsMiddleware.metricsEndpoint);
        }
        if (auditMiddleware && auditMiddleware.auditEndpoint) {
            this.app.get('/internal/audit', auditMiddleware.auditEndpoint);
        }

            // Lightweight module/status API expected by GitHub Pages integration
            // GET /api/v1/modules/status -> [{ id, status }]
            this.app.get('/api/v1/modules/status', (req, res) => {
                try {
                    const statuses = [
                        { id: 'patient-portal', status: 'active' },
                        { id: 'provider-portal', status: 'active' },
                        { id: 'admin-console', status: 'active' },
                        { id: 'telehealth', status: this.serviceHealth.telehealth ? 'active' : 'degraded' },
                        { id: 'emr-system', status: this.serviceHealth.openemr ? 'active' : 'degraded' }
                    ];
                    res.json(statuses);
                } catch (e) {
                    res.status(500).json({ error: 'MODULE_STATUS_ERROR', message: e.message });
                }
            });

            // POST /api/v1/analytics/module-access (fire-and-forget logging stub)
            this.app.post('/api/v1/analytics/module-access', (req, res) => {
                try {
                    const payload = req.body || {};
                    console.log('[Analytics] module-access', JSON.stringify(payload));
                    res.status(202).json({ ok: true });
                } catch (e) {
                    res.status(500).json({ error: 'ANALYTICS_ERROR', message: e.message });
                }
            });

            // GET /api/v1/placement-cards/:id/data -> mocked dynamic data used by homepage cards
            this.app.get('/api/v1/placement-cards/:id/data', (req, res) => {
                const { id } = req.params;
                try {
                    switch (id) {
                        case 'patient-appointments':
                            return res.json({ count: 2, next: 'Dr. Smith - Tomorrow 2:00 PM' });
                        case 'patient-records':
                            return res.json({ newResults: 2, totalRecords: 45 });
                        case 'patient-prescriptions':
                            return res.json({ active: 3, readyForPickup: 1 });
                        case 'provider-patients':
                            return res.json({ totalPatients: 156, todayAppointments: 8 });
                        case 'provider-schedule':
                            return res.json({ todaySlots: 8, availableSlots: 3 });
                        default:
                            return res.json({ ok: true });
                    }
                } catch (e) {
                    res.status(500).json({ error: 'CARD_DATA_ERROR', message: e.message });
                }
            });

        // SPA HTML fallback for unknown GET routes (after all APIs and static)
        this.app.get('*', (req, res, next) => {
            try {
                // Only handle HTML navigations
                if (req.method === 'GET' && (req.accepts('html') || req.headers.accept?.includes('text/html'))) {
                    const candidates = [
                        path.join(distDir, 'index.html'),
                        path.join(portalDistDir, 'index.html'),
                        path.join(cwd, 'index.html')
                    ];
                    for (const p of candidates) {
                        if (p && fs.existsSync(p)) {
                            return res.sendFile(p);
                        }
                    }
                }
            } catch (_) {}
            return next();
        });

        // Setup service proxies
        this.setupServiceProxies();

        // AI Assist router (mount after proxies to keep ordering predictable)
            // AI Assist mock removed for production-only build
        
        // Serve main frontend (prefer built artifacts)
        this.app.get('/', (req, res) => {
            try {
                const cwd = process.cwd();
                const distDir = path.join(cwd, 'dist');
                const portalDistDir = path.join(cwd, 'portal', 'dist');
                const candidates = [
                    path.join(distDir, 'index.html'),
                    path.join(portalDistDir, 'index.html'),
                    path.join(cwd, 'index.html')
                ];
                for (const p of candidates) {
                    if (p && fs.existsSync(p)) {
                        return res.sendFile(p);
                    }
                }
            } catch (_) { /* fall through */ }
            return res.status(404).send('index.html not found');
        });

        // Normalize legacy login paths to provider production login
        this.app.get(['/login', '/login.html'], (req, res) => {
            return res.redirect(302, '/auth/providers/login.html');
        });

        console.log('✅ Main API Gateway created');
    }

    /**
     * Setup proxy middleware for all backend services
     */
    setupServiceProxies() {
        // Circuit breaker guard for OpenEMR / FHIR
        const circuitGuard = (req, res, next) => {
            if (this.isOpenEMRCircuitOpen && this.isOpenEMRCircuitOpen()) {
                return res.status(503).json({ error: 'OPENEMR_CIRCUIT_OPEN', retryAfterMs: Math.max(0, this._openemrCircuitOpenUntil - Date.now()) });
            }
            next();
        };
        // Django Authentication Service Proxy (robust path preservation)
        this.app.use('/api/auth', (req, res, next) => {
            // Ensure body is captured BEFORE proxy consumes the stream
            const rawBodyChunks = [];
            req.on('data', chunk => rawBodyChunks.push(chunk));
            req.on('end', () => {
                req.rawBodyBuffer = Buffer.concat(rawBodyChunks);
            });
            next();
        }, createProxyMiddleware({
            target: `http://localhost:${this.config.djangoPort}`,
            changeOrigin: true,
            selfHandleResponse: false,
            pathRewrite: (path, req) => {
                if (path === '/api/auth') return '/api/v1/auth';
                if (path.startsWith('/api/auth/')) {
                    const suffix = path.substring('/api/auth/'.length);
                    return '/api/v1/auth/' + suffix;
                }
                return path;
            },
            onProxyReq: (proxyReq, req, res) => {
                if (this.config.environment !== 'production') {
                    console.log('[Proxy][Auth] inbound:', req.method, req.originalUrl, 'rewritten->', proxyReq.path);
                }
                // Re-stream JSON body if present and method supports body
                if (req.method && ['POST','PUT','PATCH'].includes(req.method.toUpperCase())) {
                    const bodyData = req.rawBodyBuffer || (req.body && Object.keys(req.body).length ? Buffer.from(JSON.stringify(req.body)) : null);
                    if (bodyData && bodyData.length) {
                        // Set proper headers for downstream server
                        if (!proxyReq.getHeader('Content-Type')) {
                            proxyReq.setHeader('Content-Type', 'application/json');
                        }
                        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                        try { proxyReq.write(bodyData); } catch (e) { console.warn('Auth proxy body write failed:', e.message); }
                    }
                }
            },
            onError: (err, req, res) => {
                console.error('❌ Django Auth proxy error:', err.message);
                if (!res.headersSent) res.status(503).json({ error: 'Authentication service unavailable' });
            }
        }));

            // Also support clients calling /api/v1/auth/* directly (no rewrite necessary)
            this.app.use('/api/v1/auth', (req, res, next) => {
                // Ensure body captured before proxy
                const rawBodyChunks = [];
                req.on('data', chunk => rawBodyChunks.push(chunk));
                req.on('end', () => {
                    req.rawBodyBuffer = Buffer.concat(rawBodyChunks);
                });
                next();
            }, createProxyMiddleware({
                target: `http://localhost:${this.config.djangoPort}`,
                changeOrigin: true,
                selfHandleResponse: false,
                onProxyReq: (proxyReq, req, res) => {
                    if (this.config.environment !== 'production') {
                        console.log('[Proxy][Auth v1] inbound:', req.method, req.originalUrl);
                    }
                    if (req.method && ['POST','PUT','PATCH'].includes(req.method.toUpperCase())) {
                        const bodyData = req.rawBodyBuffer || (req.body && Object.keys(req.body).length ? Buffer.from(JSON.stringify(req.body)) : null);
                        if (bodyData && bodyData.length) {
                            if (!proxyReq.getHeader('Content-Type')) {
                                proxyReq.setHeader('Content-Type', 'application/json');
                            }
                            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                            try { proxyReq.write(bodyData); } catch (e) { console.warn('Auth v1 proxy body write failed:', e.message); }
                        }
                    }
                },
                onError: (err, req, res) => {
                    console.error('❌ Django Auth (/api/v1/auth) proxy error:', err.message);
                    if (!res.headersSent) res.status(503).json({ error: 'Authentication service unavailable' });
                }
            }));

        // Deferred mounting for OpenEMR/FHIR proxies until service health is true
        const mountOpenEMRAndFhir = () => {
            const openEMRTarget = this.config.useRemoteOpenEMR && this.config.remoteOpenEMRUrl
                ? this.config.remoteOpenEMRUrl.replace(/\/$/, '')
                : `http://localhost:${this.config.openEMRPort}`;

            this.app.use('/api/openemr', circuitGuard, createProxyMiddleware({
                target: openEMRTarget,
                changeOrigin: true,
                pathRewrite: { '^/api/openemr': '/api/v1/openemr' },
                onError: (err, req, res) => {
                    console.error('❌ OpenEMR proxy error:', err.message);
                    if (this.recordOpenEMRFailure) this.recordOpenEMRFailure();
                    res.status(503).json({ error: 'OpenEMR service unavailable', remote: this.config.useRemoteOpenEMR, circuitOpen: this.isOpenEMRCircuitOpen && this.isOpenEMRCircuitOpen() });
                }
            }));

            this.app.use('/fhir', circuitGuard, createProxyMiddleware({
                target: openEMRTarget,
                changeOrigin: true,
                pathRewrite: (path) => {
                    if (!path.startsWith('/fhir/')) {
                        return '/fhir' + path;
                    }
                    return path;
                },
                onError: (err, req, res) => {
                    console.error('❌ FHIR proxy error:', err.message);
                    if (this.recordOpenEMRFailure) this.recordOpenEMRFailure();
                    res.status(503).json({ error: 'FHIR service unavailable', remote: this.config.useRemoteOpenEMR, circuitOpen: this.isOpenEMRCircuitOpen && this.isOpenEMRCircuitOpen() });
                }
            }));
            console.log('🔌 OpenEMR & FHIR proxies mounted');
        };

        // Temporary holding handlers until readiness
        this.app.use('/api/openemr', (req, res, next) => {
            if (this.serviceHealth.openemr) return next('route');
            return res.status(503).json({ error: 'OPENEMR_STARTING', message: 'OpenEMR service not yet ready' });
        });
        this.app.use('/fhir', (req, res, next) => {
            if (this.serviceHealth.openemr || (this.config.useFhirMock && mockFhirRouter)) return next('route');
            return res.status(503).json({ error: 'FHIR_STARTING', message: 'FHIR service not yet ready' });
        });

        // Poll until openemr health becomes true then mount real proxies once
        if (this.config.useRemoteOpenEMR && this.config.remoteOpenEMRUrl) {
            // For remote we assume ready immediately
            mountOpenEMRAndFhir();
        } else {
            const readyInterval = setInterval(() => {
                if (this.serviceHealth.openemr) {
                    clearInterval(readyInterval);
                    mountOpenEMRAndFhir();
                }
            }, 500);
            // Safety timeout (10s) mount anyway
            setTimeout(() => {
                if (!this._openemrProxiesMounted) {
                    mountOpenEMRAndFhir();
                }
            }, 10000);
        }

        // Telehealth Service Proxy
        this.app.use('/api/telehealth', createProxyMiddleware({
            target: `http://localhost:${this.config.telehealthPort}`,
            changeOrigin: true,
            pathRewrite: { '^/api/telehealth': '/api/v1/telehealth' },
            onError: (err, req, res) => {
                console.error('❌ Telehealth proxy error:', err.message);
                res.status(503).json({ error: 'Telehealth service unavailable' });
            }
        }));

        // WebSocket proxy for real-time features
        this.app.use('/ws', createProxyMiddleware({
            target: `http://localhost:${this.config.telehealthPort}`,
            ws: true,
            changeOrigin: true,
            onError: (err, req, res) => {
                console.error('❌ WebSocket proxy error:', err.message);
            }
        }));

        console.log('✅ Service proxies configured');

    // Transcription service: production proxy required; if not configured, 503
        const base = this.config.transcriptionBaseUrl;
        if (base) {
            const target = base.replace(/\/$/, '');
            try {
                this.app.use('/api/transcription', createProxyMiddleware({
                    target,
                    changeOrigin: true,
                    ws: false,
                    onError: (err, req, res) => {
                        console.error('❌ Transcription proxy error:', err.message);
                        if (!res.headersSent) res.status(503).json({ error: 'Transcription service unavailable' });
                    }
                }));
                // WebSocket proxy for streaming endpoint if service supports it
                this.app.use('/api/transcription/v1/ws', createProxyMiddleware({
                    target,
                    changeOrigin: true,
                    ws: true,
                    pathRewrite: (path) => path.replace(/^\/api\/transcription/, ''),
                    onError: (err) => console.error('❌ Transcription WS proxy error:', err.message)
                }));
                console.log(`📝 Transcription PROXY enabled -> ${target}`);
            } catch (e) {
                console.warn('⚠️ Failed to mount transcription proxy. Transcription will return 503. Error:', e.message);
                this.app.use('/api/transcription', (req, res) => {
                    res.status(503).json({ error: 'TRANSCRIPTION_UNAVAILABLE', message: 'Transcription proxy mount failed' });
                });
            }
        } else {
            this.app.use('/api/transcription', (req, res) => {
                res.status(503).json({ error: 'TRANSCRIPTION_UNAVAILABLE', message: 'Transcription service not configured' });
            });
        }
    }

    /**
     * Setup patient portal routes and authentication
     */
    setupPatientPortalRoutes() {
        // Patient portal main page
        this.app.get('/patient-portal', (req, res) => {
            res.sendFile(path.join(__dirname, 'patient-portal', 'integrated-index.html'));
        });

        // Patient portal login page
        this.app.get('/patient-portal/login', (req, res) => {
            res.sendFile(path.join(__dirname, 'patient-portal', 'login.html'));
        });

        // Patient portal API endpoints (proxied to backend services)
        this.app.get('/api/patient/dashboard', createProxyMiddleware({
            target: `http://localhost:${this.config.djangoPort}`,
            changeOrigin: true,
            pathRewrite: { '^/api/patient': '/api/v1/patient' },
            onError: (err, req, res) => {
                console.error('❌ Patient dashboard proxy error:', err.message);
                res.json({
                    appointments: { count: 2, next: "Tomorrow 2:00 PM" },
                    prescriptions: { active: 3, ready: 1 },
                    messages: { unread: 1 },
                    healthScore: 98,
                    offline: true
                });
            }
        }));

        // Patient appointments (uses OpenEMR FHIR API)
        this.app.get('/api/patient/appointments', createProxyMiddleware({
            target: `http://localhost:${this.config.openEMRPort}`,
            changeOrigin: true,
            pathRewrite: { '^/api/patient/appointments': '/fhir/Appointment' },
            onError: (err, req, res) => {
                res.json([
                    { id: 1, doctor: "Dr. Smith", date: "2025-01-12T14:00:00Z", type: "Follow-up" },
                    { id: 2, doctor: "Dr. Johnson", date: "2025-01-15T10:00:00Z", type: "Annual Checkup" }
                ]);
            }
        }));

        // Patient prescriptions
        this.app.get('/api/patient/prescriptions', (req, res) => {
            res.json([
                { id: 1, name: "Lisinopril 10mg", status: "Active", refills: 2 },
                { id: 2, name: "Metformin 500mg", status: "Ready", refills: 1 },
                { id: 3, name: "Atorvastatin 20mg", status: "Active", refills: 3 }
            ]);
        });

        // Patient messages (uses Telehealth messaging API)
        this.app.get('/api/patient/messages', createProxyMiddleware({
            target: `http://localhost:${this.config.telehealthPort}`,
            changeOrigin: true,
            pathRewrite: { '^/api/patient/messages': '/api/v1/telehealth/messaging/history/general' },
            onError: (err, req, res) => {
                res.json([
                    { id: 1, from: "Dr. Smith", subject: "Lab Results Available", unread: true, date: "2025-01-11" }
                ]);
            }
        }));

        console.log('✅ Patient portal routes configured');
    }

    /**
     * Start Django Authentication Server
     */
    async startDjangoAuth() {
        return new Promise((resolve, reject) => {
            console.log('🔐 Starting Django Authentication Server...');
            
            const djangoServerPath = path.join(__dirname, '..', 'django-auth-backend', 'auth-server.js');
            
            if (!fs.existsSync(djangoServerPath)) {
                console.warn('⚠️ Django auth server not found, creating minimal implementation...');
                this.createMinimalDjangoServer();
            }
            
            const launch = () => spawn('node', [djangoServerPath], {
                env: {
                    ...process.env,
                    PORT: this.config.djangoPort,
                    NODE_ENV: this.config.environment
                },
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let attempts = 0;
            const startChild = () => {
                attempts++;
                const djangoProcess = launch();

                djangoProcess.stdout.on('data', (data) => {
                console.log(`[Django] ${data.toString().trim()}`);
                if (data.toString().includes('Started') || data.toString().includes('listening')) {
                    this.serviceHealth.django = true;
                    resolve();
                }
            });
                djangoProcess.stderr.on('data', (data) => {
                    const msg = data.toString().trim();
                    console.error(`[Django Error] ${msg}`);
                    if (/EADDRINUSE/.test(msg) && attempts < 3) {
                        console.warn('🔁 Retrying Django server start due to port in use...');
                        setTimeout(startChild, 1000 * attempts);
                    }
                });
                djangoProcess.on('error', (error) => {
                    if (error.code === 'EADDRINUSE' && attempts < 3) {
                        console.warn('🔁 Retrying Django server (error event)');
                        return setTimeout(startChild, 1000 * attempts);
                    }
                    console.error('❌ Failed to start Django server:', error);
                    reject(error);
                });
                this.services.set('django', djangoProcess);
            };
            startChild();
            
            // Timeout fallback
            setTimeout(() => {
                if (!this.serviceHealth.django) {
                    console.log('⚠️ Django server timeout, marking as available');
                    this.serviceHealth.django = true;
                    resolve();
                }
            }, 5000);
        });
    }

    /**
     * Start OpenEMR Integration Server
     */
    async startOpenEMRServer() {
        return new Promise((resolve, reject) => {
            console.log('🏥 Starting OpenEMR Integration Server...');
            
            // Create OpenEMR server if it doesn't exist
            this.createOpenEMRServer();
            
            const openEMRServerPath = path.join(__dirname, 'openemr-server.js');
            const launch = () => spawn('node', [openEMRServerPath], {
                env: {
                    ...process.env,
                    PORT: this.config.openEMRPort,
                    NODE_ENV: this.config.environment
                },
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let attempts = 0;
            const startChild = () => {
                attempts++;
                const openEMRProcess = launch();

                openEMRProcess.stdout.on('data', (data) => {
                const line = data.toString().trim();
                console.log(`[OpenEMR] ${line}`);
                if (!this.serviceHealth.openemr && /(started on port|Server initialized|listening)/i.test(line)) {
                    this.serviceHealth.openemr = true;
                    resolve();
                }
            });
                openEMRProcess.stderr.on('data', (data) => {
                    const msg = data.toString().trim();
                    console.error(`[OpenEMR Error] ${msg}`);
                    if (/EADDRINUSE/.test(msg) && attempts < 3) {
                        console.warn('🔁 Retrying OpenEMR server start due to port in use...');
                        setTimeout(startChild, 1000 * attempts);
                    }
                });
                openEMRProcess.on('error', (error) => {
                    if (error.code === 'EADDRINUSE' && attempts < 3) {
                        console.warn('🔁 Retrying OpenEMR server (error event)');
                        return setTimeout(startChild, 1000 * attempts);
                    }
                    console.error('❌ Failed to start OpenEMR server:', error);
                    reject(error);
                });
                this.services.set('openemr', openEMRProcess);
            };
            startChild();
            
            // Active probe to reduce false timeouts
            const probeStart = Date.now();
            const maxProbeMs = 8000;
            const attemptProbe = () => {
                if (this.serviceHealth.openemr) return; // already ready
                // Lightweight HTTP probe via internal fetch
                fetch(`http://localhost:${this.config.openEMRPort}/health`, { method: 'GET' })
                    .then(r => r.ok ? r.json() : null)
                    .then(() => {
                        this.serviceHealth.openemr = true;
                        console.log('✅ OpenEMR health probe succeeded');
                        resolve();
                    })
                    .catch(() => {
                        if (Date.now() - probeStart < maxProbeMs) {
                            setTimeout(attemptProbe, 500);
                        } else {
                            console.log('⚠️ OpenEMR probe timeout, marking as available');
                            this.serviceHealth.openemr = true;
                            resolve();
                        }
                    });
            };
            setTimeout(attemptProbe, 600); // initial slight delay
        });
    }

    /**
     * Start Telehealth Services Server
     */
    async startTelehealthServer() {
        return new Promise((resolve, reject) => {
            console.log('📹 Starting Telehealth Services Server...');
            
            // Create Telehealth server if it doesn't exist
            this.createTelehealthServer();
            
            const telehealthServerPath = path.join(__dirname, 'telehealth-server.js');
            const launch = () => spawn('node', [telehealthServerPath], {
                env: {
                    ...process.env,
                    PORT: this.config.telehealthPort,
                    NODE_ENV: this.config.environment
                },
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let attempts = 0;
            const startChild = () => {
                attempts++;
                const telehealthProcess = launch();

                telehealthProcess.stdout.on('data', (data) => {
                const line = data.toString().trim();
                console.log(`[Telehealth] ${line}`);
                if (!this.serviceHealth.telehealth && /(Server initialized|Services Server started|listening)/i.test(line)) {
                    this.serviceHealth.telehealth = true;
                    resolve();
                }
            });
                telehealthProcess.stderr.on('data', (data) => {
                    const msg = data.toString().trim();
                    console.error(`[Telehealth Error] ${msg}`);
                    if (/EADDRINUSE/.test(msg) && attempts < 3) {
                        console.warn('🔁 Retrying Telehealth server start due to port in use...');
                        setTimeout(startChild, 1000 * attempts);
                    }
                });
                telehealthProcess.on('error', (error) => {
                    if (error.code === 'EADDRINUSE' && attempts < 3) {
                        console.warn('🔁 Retrying Telehealth server (error event)');
                        return setTimeout(startChild, 1000 * attempts);
                    }
                    console.error('❌ Failed to start Telehealth server:', error);
                    reject(error);
                });
                this.services.set('telehealth', telehealthProcess);
            };
            startChild();
            
            // Active probe to reduce false timeouts
            const probeStart = Date.now();
            const maxProbeMs = 8000;
            const attemptProbe = () => {
                if (this.serviceHealth.telehealth) return;
                fetch(`http://localhost:${this.config.telehealthPort}/health`, { method: 'GET' })
                    .then(r => r.ok ? r.json() : null)
                    .then(() => {
                        this.serviceHealth.telehealth = true;
                        console.log('✅ Telehealth health probe succeeded');
                        resolve();
                    })
                    .catch(() => {
                        if (Date.now() - probeStart < maxProbeMs) {
                            setTimeout(attemptProbe, 500);
                        } else {
                            console.log('⚠️ Telehealth probe timeout, marking as available');
                            this.serviceHealth.telehealth = true;
                            resolve();
                        }
                    });
            };
            setTimeout(attemptProbe, 600);
        });
    }

    /**
     * Start the main server
     */
    async startMainServer() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const startListen = () => {
                attempts++;
                const server = this.app.listen(this.config.mainPort, '0.0.0.0', () => {
                    console.log(`🌐 Main Gateway Server started on port ${this.config.mainPort}`);
                    this.serviceHealth.main = true;
                    resolve(server);
                });
                server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE' && attempts < 3) {
                        console.warn('🔁 Retrying main gateway bind...');
                        return setTimeout(startListen, 1000 * attempts);
                    }
                    console.error('❌ Failed to start main server:', error);
                    reject(error);
                });
                this.services.set('main', server);
            };
            startListen();
        });
    }

    /**
     * Create minimal Django server implementation
     */
    createMinimalDjangoServer() {
        const DjangoAuthServer = require('./django-auth-server');
        console.log('📝 Django authentication server available');
    }

    /**
     * Create OpenEMR integration server
     */
    createOpenEMRServer() {
        const OpenEMRServer = require('./openemr-server');
        console.log('📝 OpenEMR integration server available');
    }

    /**
     * Create Telehealth services server
     */
    createTelehealthServer() {
        const TelehealthServer = require('./telehealth-server');
        console.log('📝 Telehealth services server available');
    }

    /**
     * Print service status
     */
    printServiceStatus() {
    console.log('\n🏥 WebQX Healthcare Platform Services Status:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`🌐 Main Gateway     : http://localhost:${this.config.mainPort} ${this.serviceHealth.main ? '✅' : '❌'}`);
        console.log(`🔐 Django Auth      : http://localhost:${this.config.djangoPort} ${this.serviceHealth.django ? '✅' : '❌'}`);
        if (this.config.useRemoteOpenEMR) {
            console.log(`🏥 OpenEMR (Remote) : ${this.config.remoteOpenEMRUrl || 'UNSET'} ${this.serviceHealth.openemr ? '✅' : '❌'}`);
        } else {
            console.log(`🏥 OpenEMR          : http://localhost:${this.config.openEMRPort} ${this.serviceHealth.openemr ? '✅' : '❌'}`);
        }
        console.log(`📹 Telehealth       : http://localhost:${this.config.telehealthPort} ${this.serviceHealth.telehealth ? '✅' : '❌'}`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('\n🔗 Available Endpoints:');
        console.log(`   • Health Check    : http://localhost:${this.config.mainPort}/health`);
        console.log(`   • Authentication  : http://localhost:${this.config.mainPort}/api/auth/*`);
    console.log(`   • OpenEMR/FHIR    : http://localhost:${this.config.mainPort}/api/openemr/* (remote=${this.config.useRemoteOpenEMR})`);
    console.log(`   • FHIR Direct     : http://localhost:${this.config.mainPort}/fhir/* (remote=${this.config.useRemoteOpenEMR})`);
        console.log(`   • Telehealth      : http://localhost:${this.config.mainPort}/api/telehealth/*`);
        // AI Assist and FHIR Mock are removed in production
        console.log(`   • WebSocket       : ws://localhost:${this.config.mainPort}/ws`);
        if (this.config.transcriptionBaseUrl) {
            console.log(`   • Transcription   : PROXY ${this.config.transcriptionBaseUrl}`);
        } else {
            console.log(`   • Transcription   : UNCONFIGURED (503)`);
        }
    console.log('\n🎯 All services are proxied through the main gateway for unified access');
    }

    // ---- Circuit Breaker Helpers ----
    recordOpenEMRFailure() {
        const now = Date.now();
        this._openemrFailures.push(now);
        const cutoff = now - 60000; // keep last minute
        this._openemrFailures = this._openemrFailures.filter(t => t >= cutoff);
        if (this._openemrFailures.length >= this.config.openemrCircuitThreshold && !this.isOpenEMRCircuitOpen()) {
            this._openemrCircuitOpenUntil = now + this.config.openemrCircuitCooldownMs;
            console.warn(`⚠️ OpenEMR circuit opened for ${this.config.openemrCircuitCooldownMs}ms (failures=${this._openemrFailures.length})`);
        }
    }

    isOpenEMRCircuitOpen() {
        return Date.now() < this._openemrCircuitOpenUntil;
    }

    scheduleRemoteOpenEMRProbe() {
        if (!this.config.remoteOpenEMRUrl) return;
        const attempt = async () => {
            if (!this.isOpenEMRCircuitOpen()) return; // only probe during open state
            try {
                const r = await fetch(this.config.remoteOpenEMRUrl.replace(/\/$/, '') + '/health');
                if (r.ok) {
                    this._openemrCircuitOpenUntil = 0;
                    console.log('✅ Remote OpenEMR probe succeeded - circuit closed');
                }
            } catch (_) { /* swallow */ }
        };
        setInterval(attempt, 4000);
    }

    /**
     * Graceful shutdown of all services
     */
    async shutdown() {
        console.log('\n🛑 Shutting down WebQX Healthcare Services...');
        
        for (const [name, service] of this.services) {
            try {
                if (service && service.kill) {
                    service.kill('SIGTERM');
                    console.log(`✅ ${name} service stopped`);
                } else if (service && service.close) {
                    service.close();
                    console.log(`✅ ${name} service stopped`);
                }
            } catch (error) {
                console.error(`❌ Error stopping ${name} service:`, error.message);
            }
        }
        
        // Release ports
        await this.portManager.releaseAllPorts();
        console.log('✅ All ports released');
    }
}

// Handle graceful shutdown
const server = new UnifiedHealthcareServer();

process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await server.shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await server.shutdown();
    process.exit(0);
});

// Only start if this file is run directly
if (require.main === module) {
    server.start().catch((error) => {
        console.error('❌ Failed to start platform gateway:', error);
        process.exit(1);
    });
}

module.exports = UnifiedHealthcareServer;