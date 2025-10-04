// WebQx GitHub Pages Integration - Enhanced with API Proxy Support
console.log('🏥 WebQx Enhanced GitHub Pages Integration Loading...');

(function() {
    'use strict';
    
    // Environment detection
    const isGitHubPages = window.location.hostname.includes('github.io');
    const isDev = window.location.hostname.includes('localhost');
    
    // Configuration
    const PROXY_SERVER = 'http://localhost:8080';
    const LOCAL_EMR_SERVER = 'http://localhost:8085';
    const LOCAL_TELEHEALTH_SERVER = 'http://localhost:8085';
    
    console.log('Environment:', isGitHubPages ? 'GitHub Pages' : isDev ? 'Development' : 'Production');
    console.log('Proxy Server:', PROXY_SERVER);
    console.log('Local EMR Server:', LOCAL_EMR_SERVER);
    console.log('Local Telehealth Server:', LOCAL_TELEHEALTH_SERVER);
    
    // Enhanced status check with multiple services
    async function checkBackendStatus() {
        const statusEl = document.getElementById('backendStatus');
        const textEl = document.getElementById('statusText');
        const btnEl = document.getElementById('startBackend');
        
        if (!statusEl || !textEl || !btnEl) {
            setTimeout(checkBackendStatus, 500);
            return;
        }
        
        statusEl.className = 'status-indicator status-connecting';
        textEl.textContent = 'WebQX: Checking local servers...';
        btnEl.style.display = 'none';
        
        const services = {
            emr: { url: `${LOCAL_EMR_SERVER}/webqx-api.php?action=health`, name: 'EMR' },
            proxy: { url: `${PROXY_SERVER}/api/server-status`, name: 'Proxy' }
        };
        
        const results = {};
        
        // Check all services
        for (const [key, service] of Object.entries(services)) {
            try {
                const response = await fetch(service.url, { 
                    signal: AbortSignal.timeout(5000) 
                });
                results[key] = response.ok;
            } catch (error) {
                results[key] = false;
            }
        }
        
        // Determine overall status
        const allOnline = Object.values(results).every(status => status);
        const anyOnline = Object.values(results).some(status => status);
        
        if (allOnline) {
            statusEl.className = 'status-indicator status-online';
            textEl.textContent = 'WebQx: All services online ✓';
            return true;
        } else if (anyOnline) {
            statusEl.className = 'status-indicator status-partial';
            const online = Object.entries(results)
                .filter(([, status]) => status)
                .map(([key,]) => key.toUpperCase())
                .join(', ');
            textEl.textContent = `WebQx: ${online} online ⚠️`;
            btnEl.style.display = 'inline-block';
            btnEl.textContent = 'Start Missing Services';
            return false;
        } else {
            statusEl.className = 'status-indicator status-offline';
            textEl.textContent = 'WebQx: Services offline ✗';
            btnEl.style.display = 'inline-block';
            btnEl.textContent = 'Start All Services';
            return false;
        }
    }
    
    // Start backend services remotely
    async function startBackend() {
        const btnEl = document.getElementById('startBackend');
        if (btnEl) {
            btnEl.textContent = 'Starting Services...';
            btnEl.disabled = true;
        }
        
        try {
            // Try to start services through remote trigger
            const response = await fetch(`${PROXY_SERVER}/api/remote-start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start_webqx_emr' })
            });
            
            if (response.ok) {
                setTimeout(checkBackendStatus, 3000);
                return;
            }
        } catch (error) {
            console.log('Remote start failed, opening EMR portal');
        }
        
        // Fallback: open WebQX EMR directly
        window.open(`${LOCAL_EMR_SERVER}/`, '_blank');
        
        setTimeout(checkBackendStatus, 5000);
        
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.textContent = 'Start Services';
        }
    }
    
    // Setup module handlers for local servers
    function setupModuleHandlers() {
        const modules = {
            'patient-portal': `${LOCAL_EMR_SERVER}/`,
            'provider-portal': `${LOCAL_EMR_SERVER}/`,
            'admin-console': `${LOCAL_EMR_SERVER}/`,
            'telehealth': `${LOCAL_EMR_SERVER}/`,
            'login': `${LOCAL_EMR_SERVER}/`
        };
        
        // Handle placement cards
        Object.keys(modules).forEach(module => {
            const card = document.querySelector(`[data-module="${module}"]`);
            if (card) {
                card.addEventListener('click', function(e) {
                    e.preventDefault();
                    openModuleWithAuth(modules[module], module);
                });
            }
        });
        
        // Handle navigation dropdown links
        const navLinks = document.querySelectorAll('a[href*="patient-portal"], a[href*="provider"], a[href*="admin-console"], a[href*="telehealth"]');
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const href = this.getAttribute('href');
                
                if (href.includes('patient-portal')) {
                    openModuleWithAuth(modules['patient-portal'], 'patient-portal');
                } else if (href.includes('provider')) {
                    openModuleWithAuth(modules['provider-portal'], 'provider-portal');
                } else if (href.includes('admin-console')) {
                    openModuleWithAuth(modules['admin-console'], 'admin-console');
                } else if (href.includes('telehealth')) {
                    openModuleWithAuth(modules['telehealth'], 'telehealth');
                }
            });
        });
        
        // Handle login page link
        const loginLinks = document.querySelectorAll('a[href*="login"]');
        loginLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                window.open(modules['login'], '_blank');
            });
        });
    }
    
    // Open module with authentication check
    async function openModuleWithAuth(url, moduleName) {
        try {
            // Check if user is already authenticated
            const authCheck = await fetch(`${LOCAL_EMR_SERVER}/api/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('webqx_token') || ''}`
                }
            });
            
            if (authCheck.ok) {
                // User is authenticated, open module directly
                window.open(url, '_blank');
            } else {
                // User needs to login first
                const loginUrl = `${LOCAL_EMR_SERVER}/login.html?redirect=${encodeURIComponent(url)}&module=${moduleName}`;
                window.open(loginUrl, '_blank');
            }
        } catch (error) {
            console.log('Authentication check failed, opening login:', error);
            const loginUrl = `${LOCAL_EMR_SERVER}/login.html?redirect=${encodeURIComponent(url)}&module=${moduleName}`;
            window.open(loginUrl, '_blank');
        }
    }
    
    // Add styles
    function addStyles() {
        if (document.getElementById('webqx-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'webqx-styles';
        style.textContent = `
            .status-indicator {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 8px;
                animation: pulse 2s infinite;
            }
            .status-online { background-color: #10b981; }
            .status-offline { background-color: #ef4444; }
            .status-connecting { background-color: #f59e0b; }
            .status-partial { background-color: #f97316; }
            .status-demo { background-color: #8b5cf6; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        `;
        document.head.appendChild(style);
    }
    
    // Initialize
    function init() {
        // Initialize with control panel option
        addStyles();
        checkBackendStatus();
        setupModuleHandlers();
        
        const startBtn = document.getElementById('startBackend');
        if (startBtn) {
            startBtn.addEventListener('click', startBackend);
        }
        
        // Add keyboard shortcut for control panel (Ctrl+Shift+C)
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                window.WebQXIntegration.createControlPanel();
            }
        });
        
        // Add control panel button to status bar
        setTimeout(() => {
            const statusBar = document.querySelector('.status-bar');
            if (statusBar && !document.getElementById('control-panel-btn')) {
                const controlBtn = document.createElement('button');
                controlBtn.id = 'control-panel-btn';
                controlBtn.textContent = '⚙️ Control Panel';
                controlBtn.style.cssText = `
                    margin-left: 1rem; 
                    padding: 0.25rem 0.75rem; 
                    background: #4299e1; 
                    color: white; 
                    border: none; 
                    border-radius: 3px; 
                    cursor: pointer; 
                    font-size: 0.8rem;
                `;
                controlBtn.onclick = () => window.WebQXIntegration.createControlPanel();
                statusBar.appendChild(controlBtn);
            }
        }, 1000);
        
        console.log('✅ WebQX Integration initialized');
    }
    
    // Start when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Global access with enhanced functionality
    window.WebQXIntegration = {
        checkStatus: checkBackendStatus,
        startBackend: startBackend,
        proxy: PROXY_SERVER,
        emr: LOCAL_EMR_SERVER,
        telehealth: LOCAL_TELEHEALTH_SERVER,
        version: '2.0.0',
        
        // Remote control functions
        async startService(serviceName) {
            try {
                const response = await fetch(`${PROXY_SERVER}/api/system/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ services: [serviceName] })
                });
                
                if (response.ok) {
                    console.log(`${serviceName} service started successfully`);
                    setTimeout(checkBackendStatus, 2000);
                    return true;
                } else {
                    console.error(`Failed to start ${serviceName} service`);
                    return false;
                }
            } catch (error) {
                console.error(`Error starting ${serviceName}:`, error);
                return false;
            }
        },
        
        async getSystemStatus() {
            try {
                const response = await fetch(`${PROXY_SERVER}/api/system/status`);
                return await response.json();
            } catch (error) {
                console.error('Failed to get system status:', error);
                return null;
            }
        },
        
        // Create control panel
        createControlPanel() {
            if (document.getElementById('webqx-control-panel')) return;
            
            const panel = document.createElement('div');
            panel.id = 'webqx-control-panel';
            panel.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                z-index: 10000;
                min-width: 300px;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 14px;
            `;
            
            panel.innerHTML = `
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin: 0; color: #333;">WebQX Control Panel</h4>
                    <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
                </div>
                <div id="service-status"></div>
                <div style="margin-top: 10px;">
                    <button onclick="window.WebQXIntegration.refreshStatus()" style="padding: 5px 10px; margin-right: 5px; background: #4299e1; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Refresh Status
                    </button>
                    <button onclick="window.WebQXIntegration.startAllServices()" style="padding: 5px 10px; background: #48bb78; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Start All
                    </button>
                </div>
            `;
            
            document.body.appendChild(panel);
            this.refreshStatus();
        },
        
        async refreshStatus() {
            const statusDiv = document.getElementById('service-status');
            if (!statusDiv) return;
            
            statusDiv.innerHTML = '<div>🔄 Checking services...</div>';
            
            const status = await this.getSystemStatus();
            if (status && status.services) {
                const html = Object.entries(status.services).map(([key, service]) => {
                    const statusColor = service.status === 'online' ? '#48bb78' : '#ef4444';
                    const statusIcon = service.status === 'online' ? '✓' : '✗';
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin: 5px 0;">
                            <span>${service.name}</span>
                            <span style="color: ${statusColor};">${statusIcon} ${service.status}</span>
                        </div>
                    `;
                }).join('');
                statusDiv.innerHTML = html;
            } else {
                statusDiv.innerHTML = '<div style="color: #ef4444;">Failed to get status</div>';
            }
        },
        
        async startAllServices() {
            const services = ['emr', 'telehealth'];
            for (const service of services) {
                await this.startService(service);
            }
            setTimeout(() => this.refreshStatus(), 3000);
        }
    };
    
})();
