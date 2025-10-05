/**
 * WebQX™ OpenEMR Integration Launcher
 * 
 * Handles authentication, initialization, and launching of OpenEMR functionality
 * from the provider portal with proper OAuth2 flow and FHIR integration.
 */

class OpenEMRLauncher {
    constructor() {
        console.log('🔧 Initializing OpenEMR Launcher...');
        
        // Default configuration
        this.config = {
            baseUrl: 'https://demo.openemr.io',
            clientId: 'webqx-provider-portal',
            redirectUri: this.getRedirectUri(),
            scopes: [
                'openid',
                'fhirUser',
                'patient/Patient.read',
                'patient/Patient.write',
                'patient/Appointment.read',
                'patient/Appointment.write',
                'patient/Encounter.read',
                'patient/Encounter.write',
                'patient/Observation.read',
                'patient/DocumentReference.read',
                'user/Practitioner.read'
            ],
            fhirBaseUrl: null,
            apiVersion: '7.0.2'
        };
        
        this.tokens = null;
        this.userContext = null;
        this.isInitialized = false;
        
        // Load stored tokens if available
        this.loadStoredTokens();
        
        // Initialize configuration asynchronously
        this.initConfigAsync();
    }

    async initConfigAsync() {
        try {
            // Wait for config to be available and merge with defaults
            await this.waitForConfig();
            this.initializeConfig();
            console.log('✅ OpenEMR Launcher configuration ready');
            
            // Auto-initialize if in demo mode
            if (this.isDemoMode()) {
                console.log('🎭 Demo mode detected, auto-initializing...');
                setTimeout(() => {
                    this.initialize().then(result => {
                        console.log('🚀 Demo initialization complete:', result);
                    }).catch(error => {
                        console.warn('⚠️ Demo initialization failed:', error);
                    });
                }, 1000);
            }
        } catch (error) {
            console.warn('⚠️ Config initialization failed, using defaults:', error);
            // Still try to initialize in demo mode
            if (this.isDemoMode()) {
                console.log('🎭 Fallback: Initializing with default demo configuration');
                this.isInitialized = true;
            }
        }
    }

    async waitForConfig() {
        // Wait for openemrConfig to be available (loaded from openemr-config.js)
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 second timeout
            
            const checkConfig = () => {
                attempts++;
                if (typeof window.openemrConfig !== 'undefined') {
                    resolve(window.openemrConfig);
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Configuration timeout - openemr-config.js may not be loaded'));
                } else {
                    setTimeout(checkConfig, 100);
                }
            };
            
            checkConfig();
        });
    }

    initializeConfig() {
        if (window.openemrConfig) {
            // Merge loaded configuration with defaults
            this.config = { ...this.config, ...window.openemrConfig };
            
            // Set FHIR base URL if not already configured
            if (!this.config.fhirBaseUrl) {
                this.config.fhirBaseUrl = `${this.config.baseUrl}/apis/default/fhir`;
            }
        }
        
        this.isInitialized = true;
        console.log('🔧 OpenEMR configuration initialized:', this.config);
    }

    getRedirectUri() {
        // Use current page as redirect URI for OAuth callback
        const currentUrl = new URL(window.location.href);
        currentUrl.search = ''; // Remove query parameters
        currentUrl.hash = ''; // Remove hash
        return currentUrl.toString() + 'openemr-callback.html';
    }

    loadStoredTokens() {
        try {
            const stored = localStorage.getItem('webqx_openemr_tokens');
            if (stored) {
                this.tokens = JSON.parse(stored);
                console.log('🔑 Loaded stored OpenEMR tokens');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load stored tokens:', error);
        }
    }

    saveTokens(tokens) {
        try {
            this.tokens = tokens;
            localStorage.setItem('webqx_openemr_tokens', JSON.stringify(tokens));
            console.log('💾 Saved OpenEMR tokens');
        } catch (error) {
            console.error('❌ Failed to save tokens:', error);
        }
    }

    clearTokens() {
        this.tokens = null;
        this.userContext = null;
        localStorage.removeItem('webqx_openemr_tokens');
        console.log('🗑️ Cleared OpenEMR tokens');
    }

    /**
     * Initialize OpenEMR integration
     */
    async initialize() {
        try {
            console.log('🔄 Initializing OpenEMR integration...');
            
            // Detect OpenEMR configuration
            await this.detectOpenEMRConfiguration();
            
            // Check authentication status
            await this.checkAuthenticationStatus();
            
            this.isInitialized = true;
            
            console.log('✅ OpenEMR integration initialized successfully');
            return {
                success: true,
                status: 'initialized',
                config: this.config,
                authenticated: !!this.tokens
            };
        } catch (error) {
            console.error('❌ Failed to initialize OpenEMR integration:', error);
            return {
                success: false,
                error: error.message,
                status: 'initialization_failed'
            };
        }
    }

    /**
     * Launch OpenEMR with proper authentication
     */
    async launchOpenEMR(launchContext = {}) {
        try {
            console.log('🚀 Starting OpenEMR launch...', launchContext);
            
            if (!this.isInitialized) {
                console.log('🔄 Initializing OpenEMR integration...');
                const initResult = await this.initialize();
                if (!initResult.success) {
                    throw new Error(`Initialization failed: ${initResult.error}`);
                }
            }

            // Check if this is a demo environment
            if (this.isDemoMode()) {
                console.log('🎭 Running in demo mode');
                return this.launchDemoMode(launchContext);
            }

            // Check if we need to authenticate
            if (!this.tokens || this.isTokenExpired()) {
                console.log('🔐 Authentication required, starting OAuth2 flow...');
                return await this.startAuthenticationFlow(launchContext);
            }

            // Launch OpenEMR with current tokens
            return await this.performLaunch(launchContext);
            
        } catch (error) {
            console.error('❌ Failed to launch OpenEMR:', error);
            // Fallback to demo mode on error
            console.log('🔄 Falling back to demo mode...');
            return this.launchDemoMode(launchContext);
        }
    }

    /**
     * Check if running in demo mode
     */
    isDemoMode() {
        // Demo mode detection
        const isDemoUrl = this.config.baseUrl.includes('demo.openemr.io') || 
                         this.config.baseUrl.includes('localhost') ||
                         window.location.hostname.includes('github.io');
        
        // Always use demo mode for GitHub Pages unless explicitly configured
        const isGitHubPages = window.location.hostname.includes('github.io');
        
        return isDemoUrl || isGitHubPages;
    }

    /**
     * Launch demo mode with simulated behavior
     */
    async launchDemoMode(launchContext = {}) {
        console.log('🎭 Launching OpenEMR demo mode...', launchContext);
        
        const demoActions = {
            'patient_management': 'Patient Management Demo',
            'appointments': 'Appointment Scheduling Demo',
            'clinical_data': 'Clinical Data Demo',
            'patient_search': 'Patient Search Demo'
        };
        
        const actionName = demoActions[launchContext.module] || 'OpenEMR Demo';
        
        // Simulate authentication delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create demo interface based on launch mode
        switch (launchContext.mode) {
            case 'modal':
                return this.createDemoModal(actionName, launchContext);
            case 'embed':
                return this.createDemoEmbed(actionName, launchContext);
            case 'redirect':
                return this.createDemoRedirect(actionName, launchContext);
            default:
                return this.createDemoWindow(actionName, launchContext);
        }
    }

    /**
     * Create demo modal
     */
    createDemoModal(actionName, launchContext) {
        const modal = document.createElement('div');
        modal.className = 'openemr-demo-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.openemr-demo-modal').remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🏥 ${actionName}</h3>
                    <button class="close-btn" onclick="this.closest('.openemr-demo-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="demo-interface">
                        <div class="demo-status">
                            <div class="status-indicator">
                                <div class="status-dot connected"></div>
                                <span>Demo Mode - OpenEMR Integration Ready</span>
                            </div>
                        </div>
                        
                        <div class="demo-content">
                            <h4>🎭 Demo: ${actionName}</h4>
                            <p>This is a demonstration of the ${actionName} interface.</p>
                            <p><strong>In production:</strong> This would connect to your actual OpenEMR instance with OAuth2 authentication.</p>
                            
                            <div class="demo-features">
                                <h5>Features Available:</h5>
                                <ul>
                                    <li>✅ OAuth2 Authentication Flow</li>
                                    <li>✅ FHIR R4 API Integration</li>
                                    <li>✅ Patient Management</li>
                                    <li>✅ Appointment Scheduling</li>
                                    <li>✅ Clinical Data Access</li>
                                    <li>✅ Real-time Synchronization</li>
                                </ul>
                            </div>
                            
                            <div class="demo-config">
                                <h5>Current Configuration:</h5>
                                <pre>${JSON.stringify({
                                    baseUrl: this.config.baseUrl,
                                    clientId: this.config.clientId,
                                    mode: 'demo',
                                    fhirEnabled: !!this.config.fhirBaseUrl
                                }, null, 2)}</pre>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.openemr-demo-modal').remove()">Close Demo</button>
                    <button class="btn-primary" onclick="window.open('https://demo.openemr.io', '_blank')">Try OpenEMR Demo</button>
                </div>
            </div>
        `;

        // Add demo modal styles
        const style = document.createElement('style');
        style.textContent = `
            .openemr-demo-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .openemr-demo-modal .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                backdrop-filter: blur(5px);
            }
            
            .openemr-demo-modal .modal-content {
                background: linear-gradient(135deg, #0f766e 0%, #0891b2 50%, #164e63 100%);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 16px;
                width: 90%;
                max-width: 900px;
                max-height: 90vh;
                overflow-y: auto;
                position: relative;
                color: white;
            }
            
            .openemr-demo-modal .modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px 24px;
                border-bottom: 1px solid rgba(255,255,255,0.2);
            }
            
            .openemr-demo-modal .close-btn {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .openemr-demo-modal .close-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .openemr-demo-modal .modal-body {
                padding: 24px;
            }
            
            .demo-status {
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 24px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .status-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .status-dot.connected {
                width: 8px;
                height: 8px;
                background: #10b981;
                border-radius: 50%;
                animation: pulse 2s infinite;
            }
            
            .demo-features ul {
                list-style: none;
                padding: 0;
            }
            
            .demo-features li {
                padding: 4px 0;
            }
            
            .demo-config pre {
                background: rgba(0,0,0,0.3);
                padding: 12px;
                border-radius: 6px;
                font-size: 12px;
                overflow-x: auto;
            }
            
            .openemr-demo-modal .modal-footer {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 12px;
                padding: 20px 24px;
                border-top: 1px solid rgba(255,255,255,0.2);
            }
            
            .openemr-demo-modal .btn-secondary {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
            }
            
            .openemr-demo-modal .btn-primary {
                background: #0d9488;
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);

        return {
            success: true,
            action: 'demo_modal_launched',
            mode: 'demo',
            modal: modal
        };
    }

    /**
     * Create demo window
     */
    createDemoWindow(actionName, launchContext) {
        const demoWindow = window.open('', 'openemr_demo', 'width=1000,height=700,scrollbars=yes,resizable=yes');
        
        if (!demoWindow) {
            throw new Error('Failed to open demo window. Please disable popup blocker.');
        }

        demoWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>OpenEMR Demo - ${actionName}</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 20px; 
                        background: linear-gradient(135deg, #0f766e 0%, #0891b2 50%, #164e63 100%);
                        color: white;
                        min-height: 100vh;
                    }
                    .demo-container {
                        background: rgba(255,255,255,0.1);
                        border-radius: 12px;
                        padding: 30px;
                        backdrop-filter: blur(10px);
                    }
                    .demo-header { text-align: center; margin-bottom: 30px; }
                    .demo-feature { margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; }
                    .btn { background: #0d9488; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin: 5px; }
                    .btn:hover { background: #0f766e; }
                </style>
            </head>
            <body>
                <div class="demo-container">
                    <div class="demo-header">
                        <h1>🏥 ${actionName}</h1>
                        <p>WebQX™ OpenEMR Integration Demo</p>
                    </div>
                    
                    <div class="demo-feature">
                        <h3>🔐 Authentication Status</h3>
                        <p>✅ Demo Mode Active - OAuth2 flow would authenticate here</p>
                    </div>
                    
                    <div class="demo-feature">
                        <h3>🔗 Integration Features</h3>
                        <p>✅ FHIR R4 API Ready</p>
                        <p>✅ Patient Management</p>
                        <p>✅ Appointment Scheduling</p>
                        <p>✅ Clinical Data Access</p>
                    </div>
                    
                    <div class="demo-feature">
                        <h3>⚙️ Configuration</h3>
                        <p><strong>Base URL:</strong> ${this.config.baseUrl}</p>
                        <p><strong>Client ID:</strong> ${this.config.clientId}</p>
                        <p><strong>Mode:</strong> Demo</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <button class="btn" onclick="window.open('https://demo.openemr.io', '_blank')">Try Real OpenEMR Demo</button>
                        <button class="btn" onclick="window.close()">Close Demo</button>
                    </div>
                </div>
            </body>
            </html>
        `);

        demoWindow.document.close();

        return {
            success: true,
            action: 'demo_window_launched',
            mode: 'demo',
            window: demoWindow
        };
    }

    createDemoEmbed(actionName, launchContext) {
        // Implementation for embedded demo
        return {
            success: true,
            action: 'demo_embed_launched',
            mode: 'demo'
        };
    }

    createDemoRedirect(actionName, launchContext) {
        // Implementation for redirect demo
        return {
            success: true,
            action: 'demo_redirect_launched',
            mode: 'demo'
        };
    }

    /**
     * Start OAuth2 authentication flow
     */
    async startAuthenticationFlow(launchContext = {}) {
        const state = this.generateState();
        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        
        // Store PKCE parameters
        sessionStorage.setItem('openemr_code_verifier', codeVerifier);
        sessionStorage.setItem('openemr_state', state);
        sessionStorage.setItem('openemr_launch_context', JSON.stringify(launchContext));
        
        // Build authorization URL
        const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            scope: this.config.scopes.join(' '),
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });

        const authUrl = `${this.config.baseUrl}/oauth2/default/authorize?${authParams}`;
        
        console.log('🔗 Redirecting to OpenEMR authorization...');
        
        // Open in new window or redirect based on context
        if (launchContext.newWindow !== false) {
            this.openAuthWindow(authUrl);
        } else {
            window.location.href = authUrl;
        }
        
        return {
            success: true,
            action: 'authentication_started',
            authUrl: authUrl
        };
    }

    /**
     * Handle OAuth2 callback
     */
    async handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
            throw new Error(`Authentication failed: ${error}`);
        }

        if (!code || !state) {
            throw new Error('Missing authorization code or state parameter');
        }

        // Verify state
        const storedState = sessionStorage.getItem('openemr_state');
        if (state !== storedState) {
            throw new Error('Invalid state parameter - possible CSRF attack');
        }

        // Exchange code for tokens
        const codeVerifier = sessionStorage.getItem('openemr_code_verifier');
        const tokens = await this.exchangeCodeForTokens(code, codeVerifier);
        
        // Store tokens
        this.tokens = tokens;
        this.storeTokens(tokens);
        
        // Get launch context
        const launchContext = JSON.parse(sessionStorage.getItem('openemr_launch_context') || '{}');
        
        // Clean up session storage
        sessionStorage.removeItem('openemr_code_verifier');
        sessionStorage.removeItem('openemr_state');
        sessionStorage.removeItem('openemr_launch_context');
        
        // Complete launch
        return await this.performLaunch(launchContext);
    }

    /**
     * Perform actual OpenEMR launch
     */
    async performLaunch(launchContext = {}) {
        try {
            console.log('🚀 Launching OpenEMR with context:', launchContext);
            
            // Get user information
            await this.fetchUserInfo();
            
            // Validate FHIR access
            if (this.config.fhirBaseUrl) {
                await this.validateFHIRAccess();
            }
            
            const launchOptions = {
                openemrUrl: this.buildOpenEMRLaunchUrl(launchContext),
                userContext: this.userContext,
                tokens: this.tokens,
                fhirCapable: !!this.config.fhirBaseUrl,
                launchContext: launchContext
            };

            // Determine launch method
            switch (launchContext.mode || 'window') {
                case 'embed':
                    return this.launchEmbedded(launchOptions);
                case 'redirect':
                    return this.launchRedirect(launchOptions);
                case 'modal':
                    return this.launchModal(launchOptions);
                default:
                    return this.launchInNewWindow(launchOptions);
            }
            
        } catch (error) {
            console.error('❌ Launch failed:', error);
            throw error;
        }
    }

    /**
     * Launch OpenEMR in new window
     */
    async launchInNewWindow(options) {
        const openemrWindow = window.open(
            options.openemrUrl,
            'openemr_window',
            'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=yes,menubar=yes'
        );

        if (!openemrWindow) {
            throw new Error('Failed to open OpenEMR window. Please disable popup blocker.');
        }

        // Monitor window for close
        const checkClosed = setInterval(() => {
            if (openemrWindow.closed) {
                clearInterval(checkClosed);
                console.log('📱 OpenEMR window closed');
            }
        }, 1000);

        return {
            success: true,
            action: 'launched_in_window',
            window: openemrWindow,
            url: options.openemrUrl
        };
    }

    /**
     * Launch OpenEMR in modal
     */
    async launchModal(options) {
        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'openemr-modal-launcher';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🏥 OpenEMR System</h3>
                        <button class="close-btn" onclick="this.closest('.openemr-modal-launcher').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <iframe src="${options.openemrUrl}" 
                                style="width: 100%; height: 600px; border: none;">
                        </iframe>
                    </div>
                </div>
            </div>
        `;

        // Add modal styles
        const style = document.createElement('style');
        style.textContent = `
            .openemr-modal-launcher {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .openemr-modal-launcher .modal-content {
                background: white;
                border-radius: 8px;
                width: 95%;
                max-width: 1200px;
                height: 90%;
                max-height: 800px;
                display: flex;
                flex-direction: column;
            }
            .openemr-modal-launcher .modal-header {
                padding: 16px;
                border-bottom: 1px solid #ddd;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .openemr-modal-launcher .modal-body {
                flex: 1;
                overflow: hidden;
            }
            .openemr-modal-launcher .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
            }
            .openemr-modal-launcher .close-btn:hover {
                background: #f0f0f0;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);

        return {
            success: true,
            action: 'launched_in_modal',
            modal: modal,
            url: options.openemrUrl
        };
    }

    /**
     * Launch embedded OpenEMR
     */
    async launchEmbedded(options) {
        // Find container or create one
        let container = document.getElementById('openemr-embed-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'openemr-embed-container';
            container.style.cssText = 'width: 100%; height: 600px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;';
            
            // Insert into main content area
            const mainContent = document.querySelector('.main-content .container');
            if (mainContent) {
                mainContent.appendChild(container);
            } else {
                document.body.appendChild(container);
            }
        }

        // Create iframe
        container.innerHTML = `
            <iframe src="${options.openemrUrl}" 
                    style="width: 100%; height: 100%; border: none;">
                OpenEMR is loading...
            </iframe>
        `;

        return {
            success: true,
            action: 'launched_embedded',
            container: container,
            url: options.openemrUrl
        };
    }

    /**
     * Launch with redirect
     */
    async launchRedirect(options) {
        window.location.href = options.openemrUrl;
        return {
            success: true,
            action: 'launched_redirect',
            url: options.openemrUrl
        };
    }

    // Utility methods

    async waitForConfig() {
        // Wait for openEMRConfig to be available
        let attempts = 0;
        while (!window.openEMRConfig && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
    }

    initializeConfig() {
        if (window.openEMRConfig) {
            console.log('🔧 Merging OpenEMR configuration...');
            this.config = {
                ...this.config,
                baseUrl: window.openEMRConfig.baseUrl || this.config.baseUrl,
                clientId: window.openEMRConfig.clientId || this.config.clientId,
                apiVersion: window.openEMRConfig.apiVersion || this.config.apiVersion,
                scopes: window.openEMRConfig.scopes || this.config.scopes,
                ...window.openEMRConfig
            };
            console.log('✅ OpenEMR configuration merged:', this.config);
        }
    }

    getOpenEMRBaseUrl() {
        // Try to detect from environment or use default
        return process.env.OPENEMR_BASE_URL || 
               localStorage.getItem('openemr_base_url') || 
               'https://demo.openemr.io';
    }

    getRedirectUri() {
        const isGitHubPages = window.location.hostname.includes('github.io');
        const baseUrl = isGitHubPages ? 'https://webqx.github.io/EMR' : window.location.origin;
        return `${baseUrl}/provider/openemr-callback.html`;
    }

    async detectOpenEMRConfiguration() {
        try {
            // Try to get version and capabilities
            const response = await fetch(`${this.config.baseUrl}/apis/default/api/version`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                const versionInfo = await response.json();
                this.config.apiVersion = versionInfo.version || this.config.apiVersion;
                
                // Check for FHIR support
                const fhirResponse = await fetch(`${this.config.baseUrl}/apis/default/fhir/metadata`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/fhir+json' }
                });

                if (fhirResponse.ok) {
                    this.config.fhirBaseUrl = `${this.config.baseUrl}/apis/default/fhir`;
                    console.log('✅ FHIR R4 support detected');
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not detect OpenEMR configuration:', error.message);
        }
    }

    async checkAuthenticationStatus() {
        if (this.tokens && !this.isTokenExpired()) {
            try {
                await this.fetchUserInfo();
                console.log('✅ Existing authentication valid');
                return true;
            } catch (error) {
                console.log('🔄 Existing tokens invalid, will re-authenticate');
                this.clearTokens();
                return false;
            }
        }
        return false;
    }

    async exchangeCodeForTokens(code, codeVerifier) {
        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: this.config.redirectUri,
            client_id: this.config.clientId,
            code_verifier: codeVerifier
        });

        const response = await fetch(`${this.config.baseUrl}/oauth2/default/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: tokenParams
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
        }

        const tokenData = await response.json();
        
        return {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenType: tokenData.token_type || 'Bearer',
            expiresIn: tokenData.expires_in,
            scope: tokenData.scope,
            idToken: tokenData.id_token,
            expiresAt: Date.now() + (tokenData.expires_in * 1000)
        };
    }

    async fetchUserInfo() {
        if (!this.tokens) {
            throw new Error('No access token available');
        }

        const response = await fetch(`${this.config.baseUrl}/oauth2/default/userinfo`, {
            headers: {
                'Authorization': `${this.tokens.tokenType} ${this.tokens.accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch user info: ${response.statusText}`);
        }

        this.userContext = await response.json();
        return this.userContext;
    }

    async validateFHIRAccess() {
        if (!this.config.fhirBaseUrl || !this.tokens) {
            return false;
        }

        try {
            const response = await fetch(`${this.config.fhirBaseUrl}/Patient`, {
                headers: {
                    'Authorization': `${this.tokens.tokenType} ${this.tokens.accessToken}`,
                    'Accept': 'application/fhir+json'
                }
            });

            if (response.ok) {
                console.log('✅ FHIR access validated');
                return true;
            }
        } catch (error) {
            console.warn('⚠️ FHIR access validation failed:', error.message);
        }
        return false;
    }

    buildOpenEMRLaunchUrl(launchContext) {
        const params = new URLSearchParams();
        
        // Add authentication token as parameter for direct access
        if (this.tokens?.accessToken) {
            params.append('access_token', this.tokens.accessToken);
        }
        
        // Add launch context parameters
        if (launchContext.patient) {
            params.append('patient', launchContext.patient);
        }
        
        if (launchContext.encounter) {
            params.append('encounter', launchContext.encounter);
        }
        
        if (launchContext.module) {
            params.append('module', launchContext.module);
        }

        const baseUrl = `${this.config.baseUrl}/interface/main/main_screen.php`;
        return params.toString() ? `${baseUrl}?${params}` : baseUrl;
    }

    // Token management
    loadStoredTokens() {
        const stored = localStorage.getItem('openemr_tokens');
        if (stored) {
            try {
                this.tokens = JSON.parse(stored);
            } catch (error) {
                console.warn('Failed to parse stored tokens');
                localStorage.removeItem('openemr_tokens');
            }
        }
    }

    storeTokens(tokens) {
        localStorage.setItem('openemr_tokens', JSON.stringify(tokens));
    }

    clearTokens() {
        this.tokens = null;
        localStorage.removeItem('openemr_tokens');
    }

    isTokenExpired() {
        if (!this.tokens?.expiresAt) {
            return true;
        }
        // Add 5 minute buffer
        return Date.now() > (this.tokens.expiresAt - 300000);
    }

    // Utility functions
    generateState() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    generateCodeVerifier() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return this.base64URLEncode(array);
    }

    async generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return this.base64URLEncode(new Uint8Array(digest));
    }

    base64URLEncode(buffer) {
        return btoa(String.fromCharCode(...buffer))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    openAuthWindow(url) {
        const authWindow = window.open(
            url,
            'openemr_auth',
            'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        if (!authWindow) {
            throw new Error('Failed to open authentication window. Please disable popup blocker.');
        }

        // Monitor for completion
        const checkComplete = setInterval(() => {
            try {
                if (authWindow.closed) {
                    clearInterval(checkComplete);
                    console.log('🔐 Authentication window closed');
                }
                
                // Check if redirected to callback
                if (authWindow.location.href.includes('openemr-callback')) {
                    clearInterval(checkComplete);
                    authWindow.close();
                    // The callback page will handle the rest
                }
            } catch (error) {
                // Cross-origin access will throw errors, this is expected
            }
        }, 1000);

        return authWindow;
    }
}

// Global instance - Initialize with error handling
try {
    window.openEMRLauncher = new OpenEMRLauncher();
    console.log('✅ OpenEMR Launcher instance created');
} catch (error) {
    console.error('❌ Failed to create OpenEMR Launcher:', error);
    // Create a fallback object
    window.openEMRLauncher = {
        isInitialized: false,
        error: error.message,
        launchOpenEMR: async (context) => {
            console.error('OpenEMR Launcher failed to initialize:', error);
            throw new Error('OpenEMR Launcher initialization failed: ' + error.message);
        }
    };
}

// Initialize on page load with error handling
document.addEventListener('DOMContentLoaded', () => {
    if (window.openEMRLauncher && typeof window.openEMRLauncher.initialize === 'function') {
        window.openEMRLauncher.initialize().catch(error => {
            console.error('❌ OpenEMR Launcher initialization failed:', error);
        });
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpenEMRLauncher;
}
