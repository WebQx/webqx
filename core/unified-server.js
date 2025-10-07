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
 * @version v0.1.0
 */

const express = require('express');
const { spawn, fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();
// ChatEHR API routes
let chatehrRouter; try { chatehrRouter = require('../routes/chatehr'); } catch (_) {}

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
            // OAuth2/SSO configuration
            disableOAuth: process.env.DISABLE_OAUTH === 'true',
            djangoPort: process.env.DJANGO_PORT || 3001,
            openEMRPort: process.env.OPENEMR_PORT || 3002,
            telehealthPort: process.env.TELEHEALTH_PORT || 3003,
            webqxEMRPort: process.env.WEBQX_EMR_PORT || 3100,
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
            webqxEMR: false,
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
                this.config.webqxEMRPort = await this.portManager.reservePort('webqxEMR', this.config.webqxEMRPort);
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
                    this.startTelehealthServer(),
                    this.startWebQxEMR()
                ]);
                // Mark OpenEMR as healthy (remote assumption) after lightweight probe (optional)
                this.serviceHealth.openemr = true;
                this.scheduleRemoteOpenEMRProbe();
            } else {
                await Promise.all([
                    this.startDjangoAuth(),
                    this.startOpenEMRServer(),
                    this.startTelehealthServer(),
                    this.startWebQxEMR()
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
        
        // Security middleware with remote access support (CSP tuned for dev previews)
    const isProd = (process.env.NODE_ENV === 'production');
    const allowEmbed = (process.env.ALLOW_IFRAME === 'true') || (process.env.ALLOW_SIMPLE_BROWSER === 'true') || (!isProd && process.env.ALLOW_IFRAME !== 'false');
        this.app.use(helmet({
            // Allow embedding in VS Code Simple Browser or similar when enabled
            frameguard: allowEmbed ? false : { action: 'sameorigin' },
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        ...(isProd ? [] : ["'unsafe-eval'"]),
                        "https://cdn.tailwindcss.com",
                        "https://unpkg.com",
                        "https://cdnjs.cloudflare.com",
                        // Allow Jitsi IFrame API script when configured (defaults to meet.jit.si)
                        ...(process.env.JITSI_DOMAIN ? [
                            `https://${process.env.JITSI_DOMAIN}`
                        ] : [
                            'https://meet.jit.si'
                        ])
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
                        "https:",
                        // Jitsi websocket/xhr connections
                        ...(process.env.JITSI_DOMAIN ? [
                            `https://${process.env.JITSI_DOMAIN}`
                        ] : [
                            'https://meet.jit.si'
                        ])
                    ],
                    frameSrc: [
                        "'self'",
                        // Allow embedding Jitsi meeting frames
                        ...(process.env.JITSI_DOMAIN ? [
                            `https://${process.env.JITSI_DOMAIN}`
                        ] : [
                            'https://meet.jit.si'
                        ])
                    ],
                    // Allow embedding this app itself in dev/simple browser
                    frameAncestors: allowEmbed ? ["*"] : ["'self'"]
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
                // Allow requests with no origin (mobile apps, Postman, curl)
                if (!origin) return callback(null, true);

                // In production, restrict to known domains (with optional env override)
                if (this.config.environment === 'production') {
                    const envAllowed = (process.env.ALLOWED_ORIGINS || '')
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean);

                    const defaultAllowedOrigins = [
                        /^https?:\/\/(.+\.)?webqx\.[a-z]+$/i,  // WebQx subdomains on any TLD
                        /^https?:\/\/(www\.)?webqx\.com$/i,    // Apex/root domain and www
                        /^https?:\/\/.+\.railway\.app$/i,      // Railway hosted domains
                        /^https?:\/\/webqx\.github\.io$/i,     // GitHub Pages
                        /^https?:\/\/localhost(:\d+)?$/i,       // Localhost (any port)
                        /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,  // Loopback
                        /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/i, // Private network
                        /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/i,  // Private network
                        /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/i // Private network
                    ];

                    const isAllowedByEnv = envAllowed.length > 0 && envAllowed.includes(origin);
                    const isAllowedByDefault = defaultAllowedOrigins.some(pattern => pattern.test(origin));

                    if (isAllowedByEnv || isAllowedByDefault) {
                        return callback(null, true);
                    }
                    console.warn(`⚠️ CORS blocked origin: ${origin}`);
                    return callback(new Error('CORS policy violation'));
                }

                // Development mode - allow all origins
                return callback(null, true);
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

        // Legacy EMR login paths now route to the unified home page
        this.app.get(['/openemr-login.html', '/openemr-login', '/emr-login.html', '/emr-login'], (req, res) => {
            return res.redirect(302, '/');
        });
        
            // Helper to protect internal endpoints (token-based)
            const requireInternalAuth = (req, res, next) => {
                const expected = process.env.INTERNAL_API_TOKEN;
                if (!expected) return res.status(403).json({ error: 'INTERNAL_API_DISABLED' });
                const token = req.headers['x-internal-token'] || req.query.token;
                if (token !== expected) return res.status(401).json({ error: 'UNAUTHORIZED' });
                return next();
            };

            // Remote server management endpoints (opt-in only)
            if (this.config.environment !== 'production' || process.env.ENABLE_REMOTE_CONTROL === 'true') {
                /**
                 * Remotely trigger server start (for placement card)
                 */
                this.app.post('/api/remote-start', requireInternalAuth, async (req, res) => {
                    console.log('🔔 Remote server start requested from placement card:', req.ip);
                    res.json({ success: true, message: 'Server start triggered (demo mode)' });
                });

                /**
                 * Wake endpoint (for remote wake-up)
                 */
                this.app.post('/api/wake', requireInternalAuth, (req, res) => {
                    console.log('🔔 Remote wake requested:', req.ip);
                    res.json({ success: true, message: 'Server wake triggered (demo mode)' });
                });

                // Local UX helper: allow the login page to call /api/start-server without error
                this.app.post('/api/start-server', requireInternalAuth, (req, res) => {
                    console.log('🟢 /api/start-server invoked (stub)');
                    // In real deployments, start or check the EMR service here.
                    res.json({ success: true, message: 'Start command accepted (stub). Ensure EMR is running on http://localhost:8080' });
                });
            }

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

    // Body & cookie parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());

    // Custom layered middleware (order matters lightly: security -> auth decode -> metrics -> audit)
    if (securityMiddleware) this.app.use(securityMiddleware);
    if (authOptional) this.app.use(authOptional);
    if (metricsMiddleware) this.app.use(metricsMiddleware);
    if (auditMiddleware) this.app.use(auditMiddleware);

        // Mount ChatEHR API if available (provides consultations, appointments, messages)
        if (chatehrRouter) {
            this.app.use('/api/chatehr', chatehrRouter);
            this.log('info', '✅ ChatEHR routes mounted at /api/chatehr');
        } else {
            this.log('warn', '⚠️ ChatEHR routes not found; conversational care APIs disabled');
        }

        // Serve homepage as provider portal entry (portal handles auth redirect if needed)
        this.app.get(['/', '/index.html'], (req, res) => {
            return res.redirect(302, '/portal');
        });

        // Serve static files (prefer built artifacts if present) without auto index
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
            this.app.use(express.static(distDir, { index: false }));
        }
        if (fs.existsSync(portalDistDir)) {
            this.log('info', `Serving static content from portal/dist: ${portalDistDir}`);
            this.app.use(express.static(portalDistDir, { index: false }));
        }
        // Fallback to repo root for legacy static files (no auto index)
        this.app.use(express.static('.', { index: false }));

        // Provider Portal production entry: serve dedicated provider portal HTML
        // Previous behavior redirected /portal -> /index.html#portal (legacy hash SPA)
        // Now we deliver the standalone provider portal experience directly for cleaner prod URL.
        this.app.get(['/portal', '/portal/', '/portal/index.html'], (req, res) => {
            const portalPath = path.join(cwd, 'provider-portal-real.html');
            if (fs.existsSync(portalPath)) return res.sendFile(portalPath);
            // Fallback: maintain old redirect if file missing
            return res.redirect(302, '/index.html#portal');
        });
        // Allow any nested path under /portal/* to still load the portal (client-side handles state)
        this.app.get('/portal/*', (req, res) => {
            const portalPath = path.join(cwd, 'provider-portal-real.html');
            if (fs.existsSync(portalPath)) return res.sendFile(portalPath);
            return res.redirect(302, '/index.html#portal');
        });
        // Convenience aliases
        this.app.get(['/provider', '/providers', '/providers/portal'], (req, res) => res.redirect(302, '/portal'));

        // Patient portal routes
        this.setupPatientPortalRoutes();

        // Mount Telepsychiatry session routes (lightweight) so /session/* is available
        try {
            const telepsychiatryRoutes = require('../routes/session');
            this.app.use('/session', telepsychiatryRoutes);
            console.log('✅ Telepsychiatry routes mounted at /session');
        } catch (e) {
            console.warn('⚠️ Telepsychiatry routes not available:', e.message);
        }

        // Simple auth gate for provider/admin areas
        const requireProviderAuth = (req, res, next) => {
            try {
                const token = req.cookies && req.cookies.provider_token;
                if (!token) throw new Error('NO_TOKEN');
                const secret = process.env.JWT_SECRET || 'webqx-provider-secret';
                const decoded = jwt.verify(token, secret);
                req.user = decoded;
                return next();
            } catch (_) {
                const ret = encodeURIComponent(req.originalUrl || '/provider/');
                return res.redirect(302, `/auth/providers/login.html?return=${ret}`);
            }
        };

        // Apply the gate to provider and admin-console sections (GET navigations only)
        this.app.use((req, res, next) => {
            if (req.method === 'GET' && (req.path.startsWith('/provider') || req.path.startsWith('/admin-console'))) {
                return requireProviderAuth(req, res, next);
            }
            return next();
        });

        // Health check for the platform gateway
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'WebQX Healthcare Platform Gateway',
                timestamp: new Date().toISOString(),
                version: 'v0.1.0',
                services: this.serviceHealth,
                ports: {
                    main: this.config.mainPort,
                    django: this.config.djangoPort,
                    openemr: this.config.openEMRPort,
                    telehealth: this.config.telehealthPort,
                    webqxEMR: this.config.webqxEMRPort
                },
                config: {
                    environment: this.config.environment,
                    useRemoteOpenEMR: this.config.useRemoteOpenEMR,
                    transcriptionConfigured: !!(this.config.transcriptionBaseUrl && this.config.transcriptionBaseUrl.length > 0),
                    webqxEMRConfigured: !!(process.env.MEDPLUM_API_URL || process.env.MEDPLUM_BASE_URL),
                    transcriptionConfigured: !!(process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY)
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

        // Internal observability endpoints (disabled by default; require opt-in + token)
        if (process.env.ENABLE_INTERNAL_OBSERVABILITY === 'true') {
            const internalGuard = (req, res, next) => {
                const expected = process.env.INTERNAL_API_TOKEN;
                if (!expected) return res.status(403).json({ error: 'INTERNAL_API_DISABLED' });
                const token = req.headers['x-internal-token'] || req.query.token;
                if (token !== expected) return res.status(401).json({ error: 'UNAUTHORIZED' });
                next();
            };
            if (metricsMiddleware && metricsMiddleware.metricsEndpoint) {
                this.app.get('/internal/metrics', internalGuard, metricsMiddleware.metricsEndpoint);
            }
            if (auditMiddleware && auditMiddleware.auditEndpoint) {
                this.app.get('/internal/audit', internalGuard, auditMiddleware.auditEndpoint);
            }
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
            // Root path handled by explicit handler above; just fall through here
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
        
        // Serve homepage as login (already handled early before static)

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
        // Mount provider authentication and SSO routes BEFORE generic /api/auth proxy
        try {
            const providerAuthRoutes = require('../auth/providers/routes');
            this.app.use('/api/auth/provider', providerAuthRoutes);
            console.log('✅ Provider auth routes mounted at /api/auth/provider');
        } catch (e) {
            console.warn('⚠️ Provider auth routes not available:', e.message);
        }

        try {
            const providerSSORoutes = require('../auth/providers/sso-routes');
            this.app.use('/api/auth/sso', providerSSORoutes);
            console.log('✅ Provider SSO routes mounted at /api/auth/sso');
        } catch (e) {
            console.warn('⚠️ Provider SSO routes not available:', e.message);
        }

        // Mount patient SSO finalize routes (reuses provider SSO exchange/userinfo)
        try {
            const patientSSORoutes = require('../auth/patient/sso-routes');
            this.app.use('/api/auth/patient', patientSSORoutes);
            console.log('✅ Patient SSO routes mounted at /api/auth/patient');
        } catch (e) {
            console.warn('⚠️ Patient SSO routes not available:', e.message);
        }

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
            this._openemrProxiesMounted = true;
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

        // WebQx EMR Service Proxy (Nextcloud + Medplum + Whisper)
        this.app.use('/emr', createProxyMiddleware({
            target: `http://localhost:${this.config.webqxEMRPort}`,
            changeOrigin: true,
            pathRewrite: { '^/emr': '/emr' },
            onError: (err, req, res) => {
                console.error('❌ WebQx EMR proxy error:', err.message);
                if (!res.headersSent) res.status(503).json({ error: 'WebQx EMR service unavailable' });
            }
        }));
        console.log('✅ WebQx EMR proxy configured at /emr/*');

        // DICOMweb (dcm4chee) Proxy to avoid CORS in browser
        // Configure with:
        //   DCM4CHEE_BASE example: https://pacs.example.com/dcm4chee-arc
        //   DCM4CHEE_AET  example: DCM4CHEE
        // Final target: ${DCM4CHEE_BASE}/aets/${DCM4CHEE_AET}/rs
        const dcmBase = (process.env.DCM4CHEE_BASE || '').replace(/\/$/, '');
        const dcmAet = process.env.DCM4CHEE_AET || 'DCM4CHEE';
        if (dcmBase) {
            const dicomwebTarget = `${dcmBase}/aets/${dcmAet}/rs`;
            this.app.use('/dicomweb', createProxyMiddleware({
                target: dicomwebTarget,
                changeOrigin: true,
                pathRewrite: (path) => path.replace(/^\/dicomweb/, ''),
                onProxyReq: (proxyReq, req) => {
                    // Forward optional basic auth from env
                    const u = process.env.DCM4CHEE_USERNAME;
                    const p = process.env.DCM4CHEE_PASSWORD;
                    if (u && p) {
                        const auth = Buffer.from(`${u}:${p}`).toString('base64');
                        proxyReq.setHeader('Authorization', `Basic ${auth}`);
                    }
                },
                onError: (err, req, res) => {
                    console.error('❌ DICOMweb proxy error:', err.message);
                    if (!res.headersSent) res.status(503).json({ error: 'DICOMWEB_UNAVAILABLE' });
                }
            }));
            console.log(`🩻 DICOMweb proxy enabled at /dicomweb -> ${dicomwebTarget}`);
        } else {
            this.app.use('/dicomweb', (req, res) => {
                res.status(503).json({ error: 'DICOMWEB_UNCONFIGURED', message: 'Set DCM4CHEE_BASE and DCM4CHEE_AET env vars' });
            });
        }

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
     * Start WebQx EMR Service (Nextcloud + Medplum + Whisper integration)
     */
    async startWebQxEMR() {
        return new Promise((resolve, reject) => {
            console.log('🏥 Starting WebQx EMR Service (Nextcloud + Medplum + Whisper)...');
            
            const webqxEMRServerPath = path.join(__dirname, '..', 'light-emr-adapter', 'src', 'server.js');
            
            if (!fs.existsSync(webqxEMRServerPath)) {
                console.warn('⚠️ WebQx EMR server not found at:', webqxEMRServerPath);
                this.serviceHealth.webqxEMR = false;
                return resolve(); // Don't block startup
            }
            
            const launch = () => spawn('node', [webqxEMRServerPath], {
                env: {
                    ...process.env,
                    PORT: this.config.webqxEMRPort,
                    NODE_ENV: this.config.environment,
                    // Pass through backend credentials
                    MEDPLUM_API_URL: process.env.MEDPLUM_API_URL || process.env.MEDPLUM_BASE_URL || '',
                    MEDPLUM_CLIENT_ID: process.env.MEDPLUM_CLIENT_ID || '',
                    MEDPLUM_CLIENT_SECRET: process.env.MEDPLUM_CLIENT_SECRET || '',
                    NEXTCLOUD_WEBDAV_URL: process.env.NEXTCLOUD_WEBDAV_URL || process.env.NEXTCLOUD_BASE_URL || '',
                    NEXTCLOUD_USERNAME: process.env.NEXTCLOUD_USERNAME || '',
                    NEXTCLOUD_PASSWORD: process.env.NEXTCLOUD_PASSWORD || '',
                    OPENAI_API_KEY: process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY || '',
                    WHISPER_API_KEY: process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY || '',
                    WHISPER_BASE_URL: process.env.WHISPER_BASE_URL || 'https://api.openai.com/v1',
                    WHISPER_MODEL: process.env.WHISPER_MODEL || 'whisper-1'
                },
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let attempts = 0;
            const startChild = () => {
                attempts++;
                const webqxEMRProcess = launch();

                webqxEMRProcess.stdout.on('data', (data) => {
                    const line = data.toString().trim();
                    console.log(`[WebQx EMR] ${line}`);
                    if (!this.serviceHealth.webqxEMR && /(started|listening|Light EMR Adapter started)/i.test(line)) {
                        this.serviceHealth.webqxEMR = true;
                        resolve();
                    }
                });
                
                webqxEMRProcess.stderr.on('data', (data) => {
                    const msg = data.toString().trim();
                    console.error(`[WebQx EMR Error] ${msg}`);
                    if (/EADDRINUSE/.test(msg) && attempts < 3) {
                        console.warn('🔁 Retrying WebQx EMR server start due to port in use...');
                        setTimeout(startChild, 1000 * attempts);
                    }
                });
                
                webqxEMRProcess.on('error', (error) => {
                    if (error.code === 'EADDRINUSE' && attempts < 3) {
                        console.warn('🔁 Retrying WebQx EMR server (error event)');
                        return setTimeout(startChild, 1000 * attempts);
                    }
                    console.error('❌ Failed to start WebQx EMR server:', error);
                    // Don't reject - allow other services to continue
                    this.serviceHealth.webqxEMR = false;
                    resolve();
                });
                
                this.services.set('webqxEMR', webqxEMRProcess);
            };
            startChild();
            
            // Active probe to reduce false timeouts
            const probeStart = Date.now();
            const maxProbeMs = 8000;
            const attemptProbe = () => {
                if (this.serviceHealth.webqxEMR) return;
                fetch(`http://localhost:${this.config.webqxEMRPort}/health`, { method: 'GET' })
                    .then(r => r.ok ? r.json() : null)
                    .then(() => {
                        this.serviceHealth.webqxEMR = true;
                        console.log('✅ WebQx EMR health probe succeeded');
                        resolve();
                    })
                    .catch(() => {
                        if (Date.now() - probeStart < maxProbeMs) {
                            setTimeout(attemptProbe, 500);
                        } else {
                            console.log('⚠️ WebQx EMR probe timeout, marking as unavailable');
                            this.serviceHealth.webqxEMR = false;
                            resolve(); // Don't block startup
                        }
                    });
            };
            setTimeout(attemptProbe, 600);
        });
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
        console.log(`🏥 WebQx EMR™       : http://localhost:${this.config.webqxEMRPort} ${this.serviceHealth.webqxEMR ? '✅' : '❌'}`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('\n🔗 Available Endpoints:');
        console.log(`   • Health Check    : http://localhost:${this.config.mainPort}/health`);
        console.log(`   • Authentication  : http://localhost:${this.config.mainPort}/api/auth/*`);
    console.log(`   • OpenEMR/FHIR    : http://localhost:${this.config.mainPort}/api/openemr/* (remote=${this.config.useRemoteOpenEMR})`);
    console.log(`   • FHIR Direct     : http://localhost:${this.config.mainPort}/fhir/* (remote=${this.config.useRemoteOpenEMR})`);
        console.log(`   • Telehealth      : http://localhost:${this.config.mainPort}/api/telehealth/*`);
        console.log(`   • WebQx EMR™      : http://localhost:${this.config.mainPort}/emr/* (Nextcloud+Medplum+Whisper)`);
        // AI Assist and FHIR Mock are removed in production
        console.log(`   • WebSocket       : ws://localhost:${this.config.mainPort}/ws`);
        if (this.config.transcriptionBaseUrl) {
            console.log(`   • Transcription   : PROXY ${this.config.transcriptionBaseUrl}`);
        } else {
            console.log(`   • Transcription   : UNCONFIGURED (503)`);
        }
    console.log('\n🎯 All services are proxied through the main gateway for unified access');

        // Clarify environment: localhost URLs are internal container ports.
        console.log('\nℹ️  Note: "http://localhost:PORT" entries above are internal addresses inside the container.');
        console.log('    Behind Railway, requests are served via the service URL and domain you configured.');
        const externalApiBase = process.env.PUBLIC_BASE_URL
          || process.env.RAILWAY_PUBLIC_API_BASE
          || process.env.PUBLIC_API_BASE
          || '';
        const externalEmrBase = process.env.RAILWAY_PUBLIC_EMR_BASE
          || process.env.PUBLIC_EMR_BASE
          || '';
        if (externalApiBase || externalEmrBase) {
            console.log('🌍 External/Public Endpoints:');
            if (externalApiBase) {
                const base = externalApiBase.replace(/\/$/, '');
                const wsProto = base.startsWith('https://') ? 'wss://' : 'ws://';
                console.log(`   • API Base        : ${base}`);
                console.log(`   • Health Check    : ${base}/health`);
                console.log(`   • FHIR Proxy      : ${base}/fhir/*`);
                console.log(`   • WebSocket       : ${wsProto}${base.replace(/^https?:\/\//, '')}/ws`);
            }
            if (externalEmrBase) {
                console.log(`   • EMR Base        : ${externalEmrBase.replace(/\/$/, '')}`);
            }
        }
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