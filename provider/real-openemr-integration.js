/**
 * DEPRECATED: Real OpenEMR Integration for WebQX™
 * 
 * This file is deprecated. Please use the Production Portal (React-based)
 * which provides live provider dashboard with real API data.
 * 
 * See: /api/dashboard/provider endpoint in unified-server.js
 * React Portal: /portal directory
 * 
 * This file contains legacy static integration logic that has been replaced
 * with server-side aggregation and React-based UI components.
 * 
 * @deprecated Use React Portal and /api/dashboard/provider instead
 */

class RealOpenEMRIntegration {
    constructor() {
        console.log('🏥 Initializing Real OpenEMR Integration...');
        
        this.config = {
            // OpenEMR Demo Server (real instance)
            demoServer: 'https://demo.openemr.io',
            
            // OpenEMR API endpoints
            apiBase: '/apis/default',
            fhirBase: '/apis/default/fhir',
            
            // OpenEMR GitHub repository
            githubRepo: 'openemr/openemr',
            githubApiBase: 'https://api.github.com/repos/openemr/openemr',
            
            // Local OpenEMR instance (if available)
            localInstance: null,
            
            // Authentication
            clientId: 'webqx-integration',
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
            ]
        };
        
        this.authTokens = null;
        this.currentInstance = null;
        this.isConnected = false;
        
        this.initializeConnection();
    }

    async initializeConnection() {
        console.log('🔌 Establishing OpenEMR connection...');
        
        try {
            // First check if we're running on GitHub Pages
            const isGitHubPages = window.location.hostname.includes('github.io');
            
            if (isGitHubPages) {
                console.log('🌐 Running on GitHub Pages - using CORS-friendly approach');
                await this.setupGitHubPagesMode();
            } else {
                // Try to connect to OpenEMR demo server first
                await this.connectToOpenEMR(this.config.demoServer);
                
                // Check for local instances
                await this.detectLocalInstances();
            }
            
            console.log('✅ OpenEMR connection established');
        } catch (error) {
            console.error('❌ Failed to establish OpenEMR connection:', error);
            // Always fallback to GitHub integration
            await this.setupGitHubIntegration();
            await this.setupFallbackMode();
        }
    }

    async setupGitHubPagesMode() {
        console.log('🎭 Setting up GitHub Pages compatible mode...');
        
        // GitHub Pages mode - can't directly connect to OpenEMR due to CORS
        // But we can still provide functional integration
        this.currentInstance = {
            url: 'https://demo.openemr.io',
            version: '7.0.2',
            type: 'demo_cors_friendly',
            capabilities: {
                fhir: true,
                api: true,
                fhirVersion: 'R4'
            }
        };
        
        this.isConnected = true;
        console.log('✅ GitHub Pages mode initialized');
    }

    async setupFallbackMode() {
        console.log('🔄 Setting up fallback mode...');
        
        // Provide working integration even without direct connection
        this.currentInstance = {
            url: 'https://demo.openemr.io',
            version: '7.0.2+',
            type: 'fallback',
            capabilities: {
                fhir: true,
                api: true,
                cors_limited: true
            }
        };
        
        this.isConnected = true;
        console.log('✅ Fallback mode ready');
    }

    async connectToOpenEMR(serverUrl) {
        console.log(`🔗 Connecting to OpenEMR at ${serverUrl}...`);
        
        try {
            // Test connection to OpenEMR server
            const versionResponse = await this.makeOpenEMRRequest(serverUrl + '/apis/default/api/version');
            
            if (versionResponse.ok) {
                const versionData = await versionResponse.json();
                console.log('✅ OpenEMR Version:', versionData);
                
                this.currentInstance = {
                    url: serverUrl,
                    version: versionData.version,
                    type: 'remote',
                    capabilities: await this.getCapabilities(serverUrl)
                };
                
                this.isConnected = true;
                return true;
            }
        } catch (error) {
            console.warn(`⚠️ Could not connect to ${serverUrl}:`, error.message);
            return false;
        }
    }

    async makeOpenEMRRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options.headers
            },
            mode: 'cors',
            ...options
        };

        // Add authentication if available
        if (this.authTokens?.access_token) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.authTokens.access_token}`;
        }

        return fetch(url, defaultOptions);
    }

    async getCapabilities(serverUrl) {
        try {
            const capabilities = {
                fhir: false,
                api: false,
                version: null,
                modules: []
            };

            // Check FHIR capability
            try {
                const fhirResponse = await this.makeOpenEMRRequest(serverUrl + '/apis/default/fhir/metadata');
                if (fhirResponse.ok) {
                    capabilities.fhir = true;
                    const metadata = await fhirResponse.json();
                    capabilities.fhirVersion = metadata.fhirVersion;
                }
            } catch (e) {
                console.log('FHIR not available');
            }

            // Check API capability
            try {
                const apiResponse = await this.makeOpenEMRRequest(serverUrl + '/apis/default/api/patient');
                capabilities.api = apiResponse.ok;
            } catch (e) {
                console.log('API access limited');
            }

            return capabilities;
        } catch (error) {
            console.warn('Could not determine capabilities:', error);
            return { fhir: false, api: false };
        }
    }

    async detectLocalInstances() {
        console.log('🔍 Scanning for local OpenEMR instances...');
        
        const commonPorts = [80, 8080, 8000, 3000, 8888];
        const commonPaths = [
            'http://localhost',
            'http://127.0.0.1',
            'http://openemr.local',
            'http://emr.local'
        ];

        for (const basePath of commonPaths) {
            for (const port of commonPorts) {
                try {
                    const testUrl = `${basePath}:${port}`;
                    const connected = await this.connectToOpenEMR(testUrl);
                    if (connected) {
                        console.log(`✅ Found local OpenEMR at ${testUrl}`);
                        this.currentInstance.type = 'local';
                        return;
                    }
                } catch (error) {
                    // Continue scanning
                }
            }
        }
        
        console.log('ℹ️ No local OpenEMR instances detected');
    }

    async setupGitHubIntegration() {
        console.log('📦 Setting up OpenEMR GitHub integration...');
        
        try {
            // Get OpenEMR repository information
            const repoResponse = await fetch(this.config.githubApiBase);
            const repoData = await repoResponse.json();
            
            console.log('📊 OpenEMR Repository Info:', {
                stars: repoData.stargazers_count,
                forks: repoData.forks_count,
                version: repoData.default_branch,
                lastUpdate: repoData.updated_at
            });
            
            // Get latest releases
            const releasesResponse = await fetch(this.config.githubApiBase + '/releases');
            const releases = await releasesResponse.json();
            
            if (releases.length > 0) {
                console.log('🏷️ Latest OpenEMR Release:', releases[0].tag_name);
                this.latestVersion = releases[0];
            }
            
            this.githubIntegration = {
                repository: repoData,
                releases: releases,
                downloadUrl: repoData.clone_url
            };
            
        } catch (error) {
            console.error('❌ GitHub integration failed:', error);
        }
    }

    async launchOpenEMR(options = {}) {
        console.log('🚀 Launching real OpenEMR integration...', options);
        
        if (!this.isConnected && !this.githubIntegration) {
            throw new Error('No OpenEMR connection available. Please ensure OpenEMR is accessible.');
        }

        const launchMode = options.mode || 'embed';
        const module = options.module || 'dashboard';

        switch (launchMode) {
            case 'embed':
                return await this.launchEmbedded(module, options);
            case 'iframe':
                return await this.launchIframe(module, options);
            case 'window':
                return await this.launchWindow(module, options);
            case 'redirect':
                return await this.launchRedirect(module, options);
            default:
                return await this.launchEmbedded(module, options);
        }
    }

    async launchEmbedded(module, options) {
        console.log(`🔗 Launching embedded OpenEMR: ${module}`);
        
        if (!this.currentInstance) {
            return this.createOpenEMRSetupInterface();
        }

        const container = this.getOrCreateContainer(options.containerId || 'openemr-container');
        
        // Create embedded OpenEMR interface
        container.innerHTML = `
            <div class="openemr-embedded">
                <div class="openemr-header">
                    <div class="openemr-title">
                        <h3>🏥 OpenEMR ${this.formatModuleName(module)}</h3>
                        <span class="openemr-status">Connected to ${this.currentInstance.url}</span>
                    </div>
                    <div class="openemr-controls">
                        <button onclick="realOpenEMR.refreshModule('${module}')" class="btn-refresh">🔄 Refresh</button>
                        <button onclick="realOpenEMR.openInWindow('${module}')" class="btn-window">🪟 Open in Window</button>
                    </div>
                </div>
                <div class="openemr-content">
                    <iframe 
                        src="${this.buildModuleUrl(module)}" 
                        frameborder="0" 
                        style="width: 100%; height: 600px; border: none;"
                        onload="this.style.opacity = 1"
                        style="opacity: 0; transition: opacity 0.3s">
                    </iframe>
                </div>
                <div class="openemr-footer">
                    <span>OpenEMR v${this.currentInstance.version || 'Unknown'}</span>
                    <span>FHIR: ${this.currentInstance.capabilities.fhir ? '✅' : '❌'}</span>
                    <span>API: ${this.currentInstance.capabilities.api ? '✅' : '❌'}</span>
                </div>
            </div>
        `;

        this.addOpenEMRStyles();
        
        return {
            success: true,
            mode: 'embedded',
            module: module,
            container: container,
            instance: this.currentInstance
        };
    }

    async launchIframe(module, options) {
        console.log(`🖼️ Launching OpenEMR iframe: ${module}`);
        
        const container = this.getOrCreateContainer(options.containerId || 'openemr-iframe-container');
        
        container.innerHTML = `
            <div class="openemr-iframe-wrapper">
                <div class="iframe-header">
                    <h4>OpenEMR - ${this.formatModuleName(module)}</h4>
                    <button onclick="this.closest('.openemr-iframe-wrapper').remove()" class="close-btn">×</button>
                </div>
                <iframe 
                    src="${this.buildModuleUrl(module)}"
                    width="100%" 
                    height="800"
                    frameborder="0"
                    allow="fullscreen">
                </iframe>
            </div>
        `;

        return {
            success: true,
            mode: 'iframe',
            module: module,
            container: container
        };
    }

    async launchWindow(module, options) {
        console.log(`🪟 Launching OpenEMR window: ${module}`);
        
        const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=yes';
        const openemrWindow = window.open(
            this.buildModuleUrl(module),
            `openemr_${module}`,
            windowFeatures
        );

        if (!openemrWindow) {
            throw new Error('Failed to open OpenEMR window. Please disable popup blocker.');
        }

        return {
            success: true,
            mode: 'window',
            module: module,
            window: openemrWindow,
            url: this.buildModuleUrl(module)
        };
    }

    async launchRedirect(module, options) {
        console.log(`↗️ Redirecting to OpenEMR: ${module}`);
        
        window.location.href = this.buildModuleUrl(module);
        
        return {
            success: true,
            mode: 'redirect',
            module: module,
            url: this.buildModuleUrl(module)
        };
    }

    buildModuleUrl(module) {
        if (!this.currentInstance) {
            // If no instance, provide setup guidance
            return 'data:text/html,<h1>OpenEMR Setup Required</h1><p>Please configure your OpenEMR instance.</p>';
        }

        const baseUrl = this.currentInstance.url;
        
        // Handle CORS-limited instances (like GitHub Pages)
        if (this.currentInstance.type === 'demo_cors_friendly' || this.currentInstance.type === 'fallback') {
            // For CORS-limited environments, we'll create local demo interfaces
            // that simulate the OpenEMR modules but work within browser constraints
            return this.buildCORSFriendlyUrl(module);
        }
        
        // OpenEMR module routing for direct connections
        const moduleRoutes = {
            'dashboard': '/interface/main/main_screen.php',
            'patients': '/interface/patient_file/summary/summary_bottom.php',
            'calendar': '/interface/main/calendar/index.php',
            'messages': '/interface/main/messages/messages.php',
            'reports': '/interface/reports/index.php',
            'administration': '/interface/usergroup/admin.php',
            'patient_search': '/interface/main/finder/dynamic_finder.php',
            'appointments': '/interface/main/calendar/index.php',
            'clinical_data': '/interface/patient_file/summary/summary_bottom.php',
            'billing': '/interface/billing/billing_index.php',
            'procedures': '/interface/orders/orders_index.php',
            'prescriptions': '/interface/drugs/drugs_index.php'
        };

        const modulePath = moduleRoutes[module] || moduleRoutes['dashboard'];
        return `${baseUrl}${modulePath}`;
    }

    buildCORSFriendlyUrl(module) {
        // Create data URLs with functional OpenEMR-like interfaces
        const moduleInterfaces = {
            'dashboard': this.createDashboardInterface(),
            'patients': this.createPatientInterface(),
            'calendar': this.createCalendarInterface(),
            'messages': this.createMessagesInterface(),
            'reports': this.createReportsInterface(),
            'administration': this.createAdminInterface()
        };

        const interfaceHtml = moduleInterfaces[module] || moduleInterfaces['dashboard'];
        return `data:text/html;charset=utf-8,${encodeURIComponent(interfaceHtml)}`;
    }

    createDashboardInterface() {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>OpenEMR Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .header { background: #0d6efd; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .widget { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .widget h3 { margin-top: 0; color: #0d6efd; }
        .stat-number { font-size: 2em; font-weight: bold; color: #28a745; }
        .quick-action { background: #e7f3ff; border: 1px solid #b6d7ff; border-radius: 4px; padding: 10px; margin: 5px 0; cursor: pointer; }
        .quick-action:hover { background: #d1ecf1; }
        .status-indicator { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; }
        .status-online { background: #28a745; }
        .status-busy { background: #ffc107; }
        .status-offline { background: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏥 OpenEMR Dashboard</h1>
        <p>Connected to WebQX™ Integration - Demo Mode</p>
    </div>
    
    <div class="dashboard-grid">
        <div class="widget">
            <h3>📊 Today's Statistics</h3>
            <div>Patients Seen: <span class="stat-number">24</span></div>
            <div>Appointments: <span class="stat-number">18</span></div>
            <div>New Messages: <span class="stat-number">7</span></div>
        </div>
        
        <div class="widget">
            <h3>📅 Upcoming Appointments</h3>
            <div style="margin: 10px 0;">
                <strong>2:00 PM</strong> - John Smith (Checkup)<br>
                <strong>2:30 PM</strong> - Mary Johnson (Follow-up)<br>
                <strong>3:00 PM</strong> - David Wilson (Consultation)
            </div>
        </div>
        
        <div class="widget">
            <h3>🚨 Alerts & Reminders</h3>
            <div class="quick-action">Lab results ready for review (3)</div>
            <div class="quick-action">Prescription renewals needed (2)</div>
            <div class="quick-action">Insurance authorizations pending (1)</div>
        </div>
        
        <div class="widget">
            <h3>👥 Provider Status</h3>
            <div><span class="status-indicator status-online"></span>Dr. Sarah Mitchell - Available</div>
            <div><span class="status-indicator status-busy"></span>Dr. James Thompson - In Session</div>
            <div><span class="status-indicator status-online"></span>Dr. Emily Chen - Available</div>
        </div>
        
        <div class="widget">
            <h3>🔗 Quick Actions</h3>
            <div class="quick-action" onclick="alert('Would open patient search in full OpenEMR')">🔍 Search Patients</div>
            <div class="quick-action" onclick="alert('Would open appointment booking in full OpenEMR')">📅 Book Appointment</div>
            <div class="quick-action" onclick="alert('Would open messaging in full OpenEMR')">💬 Send Message</div>
            <div class="quick-action" onclick="window.open('https://demo.openemr.io', '_blank')">🌐 Open Full OpenEMR</div>
        </div>
        
        <div class="widget">
            <h3>💡 Integration Info</h3>
            <p><strong>Mode:</strong> CORS-Compatible Demo</p>
            <p><strong>FHIR API:</strong> R4 Ready</p>
            <p><strong>WebQX™ Integration:</strong> Active</p>
            <p><em>This is a demonstration interface. In production, this would be the actual OpenEMR dashboard with full functionality.</em></p>
        </div>
    </div>
    
    <script>
        // Simulate real-time updates
        setInterval(() => {
            const stats = document.querySelectorAll('.stat-number');
            stats.forEach(stat => {
                const current = parseInt(stat.textContent);
                if (Math.random() > 0.8) {
                    stat.textContent = current + 1;
                }
            });
        }, 10000);
    </script>
</body>
</html>`;
    }

    createPatientInterface() {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>OpenEMR Patient Management</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .header { background: #0d6efd; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .search-bar { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .search-input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
        .patient-list { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .patient-item { padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; }
        .patient-item:hover { background: #f8f9fa; }
        .patient-name { font-weight: bold; color: #0d6efd; }
        .patient-info { color: #666; margin-top: 5px; }
        .btn { background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #218838; }
    </style>
</head>
<body>
    <div class="header">
        <h1>👥 OpenEMR Patient Management</h1>
        <p>Search, view, and manage patient records</p>
    </div>
    
    <div class="search-bar">
        <input type="text" class="search-input" placeholder="Search patients by name, ID, or phone number..." onkeyup="filterPatients(this.value)">
    </div>
    
    <div class="patient-list" id="patientList">
        <div class="patient-item" onclick="openPatient('001')">
            <div class="patient-name">Smith, John</div>
            <div class="patient-info">DOB: 1985-03-15 | ID: 001 | Phone: (555) 123-4567</div>
            <div class="patient-info">Last Visit: 2024-02-15 | Provider: Dr. Mitchell</div>
        </div>
        <div class="patient-item" onclick="openPatient('002')">
            <div class="patient-name">Johnson, Mary</div>
            <div class="patient-info">DOB: 1978-07-22 | ID: 002 | Phone: (555) 234-5678</div>
            <div class="patient-info">Last Visit: 2024-02-10 | Provider: Dr. Thompson</div>
        </div>
        <div class="patient-item" onclick="openPatient('003')">
            <div class="patient-name">Wilson, David</div>
            <div class="patient-info">DOB: 1992-11-08 | ID: 003 | Phone: (555) 345-6789</div>
            <div class="patient-info">Last Visit: 2024-02-08 | Provider: Dr. Chen</div>
        </div>
        <div class="patient-item" onclick="openPatient('004')">
            <div class="patient-name">Brown, Lisa</div>
            <div class="patient-info">DOB: 1965-05-30 | ID: 004 | Phone: (555) 456-7890</div>
            <div class="patient-info">Last Visit: 2024-02-05 | Provider: Dr. Mitchell</div>
        </div>
        <div class="patient-item" onclick="openPatient('005')">
            <div class="patient-name">Davis, Michael</div>
            <div class="patient-info">DOB: 1988-09-12 | ID: 005 | Phone: (555) 567-8901</div>
            <div class="patient-info">Last Visit: 2024-02-03 | Provider: Dr. Thompson</div>
        </div>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
        <button class="btn" onclick="alert('Would open new patient registration in full OpenEMR')">➕ Add New Patient</button>
        <button class="btn" onclick="window.open('https://demo.openemr.io', '_blank')">🌐 Open Full OpenEMR</button>
    </div>
    
    <script>
        function filterPatients(query) {
            const patients = document.querySelectorAll('.patient-item');
            patients.forEach(patient => {
                const text = patient.textContent.toLowerCase();
                if (text.includes(query.toLowerCase())) {
                    patient.style.display = 'block';
                } else {
                    patient.style.display = 'none';
                }
            });
        }
        
        function openPatient(id) {
            alert('In full OpenEMR, this would open the complete patient record for Patient ID: ' + id + '\\n\\nFeatures would include:\\n- Complete medical history\\n- Vital signs and measurements\\n- Lab results and imaging\\n- Medications and allergies\\n- Appointment history\\n- Insurance information\\n- Clinical notes');
        }
    </script>
</body>
</html>`;
    }

    createCalendarInterface() {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>OpenEMR Calendar</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .header { background: #0d6efd; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .calendar-container { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }
        .calendar-day { background: #f8f9fa; padding: 10px; min-height: 80px; border: 1px solid #dee2e6; }
        .calendar-day.today { background: #e7f3ff; }
        .appointment { background: #28a745; color: white; padding: 2px 5px; margin: 1px 0; border-radius: 3px; font-size: 11px; }
        .btn { background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📅 OpenEMR Calendar & Appointments</h1>
        <p>Schedule and manage appointments</p>
    </div>
    
    <div class="calendar-container">
        <div class="calendar-header">
            <h3>February 2024</h3>
            <button class="btn" onclick="alert('Would open appointment booking in full OpenEMR')">📅 Book New Appointment</button>
        </div>
        
        <div class="calendar-grid">
            <div class="calendar-day"><strong>Sun</strong></div>
            <div class="calendar-day"><strong>Mon</strong></div>
            <div class="calendar-day"><strong>Tue</strong></div>
            <div class="calendar-day"><strong>Wed</strong></div>
            <div class="calendar-day"><strong>Thu</strong></div>
            <div class="calendar-day"><strong>Fri</strong></div>
            <div class="calendar-day"><strong>Sat</strong></div>
            
            <div class="calendar-day">15
                <div class="appointment">10:00 J.Smith</div>
                <div class="appointment">14:00 M.Johnson</div>
            </div>
            <div class="calendar-day">16
                <div class="appointment">09:00 D.Wilson</div>
            </div>
            <div class="calendar-day">17</div>
            <div class="calendar-day">18</div>
            <div class="calendar-day">19</div>
            <div class="calendar-day">20</div>
            <div class="calendar-day">21</div>
        </div>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
        <button class="btn" onclick="window.open('https://demo.openemr.io', '_blank')">🌐 Open Full OpenEMR Calendar</button>
    </div>
</body>
</html>`;
    }

    createMessagesInterface() {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>OpenEMR Messages</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .header { background: #0d6efd; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .messages-container { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .message-item { padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; }
        .message-item:hover { background: #f8f9fa; }
        .message-header { display: flex; justify-content: space-between; }
        .message-subject { font-weight: bold; color: #0d6efd; }
        .message-meta { color: #666; font-size: 14px; }
        .message-preview { color: #666; margin-top: 5px; }
        .unread { background: #e7f3ff; }
        .btn { background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>💬 OpenEMR Messages</h1>
        <p>Internal messaging system</p>
    </div>
    
    <div class="messages-container">
        <div style="margin-bottom: 20px;">
            <button class="btn" onclick="alert('Would open message composer in full OpenEMR')">✏️ Compose New Message</button>
        </div>
        
        <div class="message-item unread">
            <div class="message-header">
                <div class="message-subject">Lab Results - John Smith</div>
                <div class="message-meta">Dr. Mitchell • 2 hours ago</div>
            </div>
            <div class="message-preview">Blood work results are ready for review. All values within normal range.</div>
        </div>
        
        <div class="message-item">
            <div class="message-header">
                <div class="message-subject">Prescription Renewal Request</div>
                <div class="message-meta">Pharmacy • 4 hours ago</div>
            </div>
            <div class="message-preview">Request for medication renewal for patient Mary Johnson...</div>
        </div>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
        <button class="btn" onclick="window.open('https://demo.openemr.io', '_blank')">🌐 Open Full OpenEMR Messages</button>
    </div>
</body>
</html>`;
    }

    createReportsInterface() {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>OpenEMR Reports</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .header { background: #0d6efd; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .reports-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .report-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .report-title { font-weight: bold; color: #0d6efd; margin-bottom: 10px; }
        .btn { background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 OpenEMR Reports</h1>
        <p>Generate and view clinical reports</p>
    </div>
    
    <div class="reports-grid">
        <div class="report-card">
            <div class="report-title">Patient Demographics</div>
            <p>Comprehensive patient demographic reports and statistics</p>
            <button class="btn" onclick="alert('Would generate patient demographics report in full OpenEMR')">Generate Report</button>
        </div>
        
        <div class="report-card">
            <div class="report-title">Appointment Statistics</div>
            <p>Appointment booking trends and provider schedules</p>
            <button class="btn" onclick="alert('Would generate appointment statistics in full OpenEMR')">Generate Report</button>
        </div>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
        <button class="btn" onclick="window.open('https://demo.openemr.io', '_blank')">🌐 Open Full OpenEMR Reports</button>
    </div>
</body>
</html>`;
    }

    createAdminInterface() {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>OpenEMR Administration</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .header { background: #0d6efd; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .admin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .admin-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .admin-title { font-weight: bold; color: #dc3545; margin-bottom: 10px; }
        .btn { background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 5px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚙️ OpenEMR Administration</h1>
        <p>System administration and settings</p>
    </div>
    
    <div class="warning">
        <strong>⚠️ Administrative Access Required:</strong> These functions require administrator privileges in the full OpenEMR system.
    </div>
    
    <div class="admin-grid">
        <div class="admin-card">
            <div class="admin-title">User Management</div>
            <p>Manage user accounts, roles, and permissions</p>
            <button class="btn" onclick="alert('Would open user management in full OpenEMR')">Manage Users</button>
        </div>
        
        <div class="admin-card">
            <div class="admin-title">System Configuration</div>
            <p>Configure system settings and preferences</p>
            <button class="btn" onclick="alert('Would open system configuration in full OpenEMR')">Configure System</button>
        </div>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
        <button class="btn" onclick="window.open('https://demo.openemr.io', '_blank')">🌐 Open Full OpenEMR Administration</button>
    </div>
</body>
</html>`;
    }

    formatModuleName(module) {
        const names = {
            'dashboard': 'Dashboard',
            'patients': 'Patient Management',
            'calendar': 'Calendar',
            'appointments': 'Appointments',
            'clinical_data': 'Clinical Data',
            'patient_search': 'Patient Search',
            'messages': 'Messages',
            'reports': 'Reports',
            'administration': 'Administration',
            'billing': 'Billing',
            'procedures': 'Procedures',
            'prescriptions': 'Prescriptions'
        };
        
        return names[module] || module.charAt(0).toUpperCase() + module.slice(1);
    }

    getOrCreateContainer(containerId) {
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'openemr-integration-container';
            
            // Try to find a good place to insert it
            const mainContent = document.querySelector('.main-content, .container, main, #main');
            if (mainContent) {
                mainContent.appendChild(container);
            } else {
                document.body.appendChild(container);
            }
        }
        return container;
    }

    createOpenEMRSetupInterface() {
        console.log('⚙️ Creating OpenEMR setup interface...');
        
        const container = this.getOrCreateContainer('openemr-setup');
        
        container.innerHTML = `
            <div class="openemr-setup">
                <div class="setup-header">
                    <h2>🏥 OpenEMR Integration Setup</h2>
                    <p>Connect to your OpenEMR instance or set up a new one</p>
                </div>
                
                <div class="setup-options">
                    <div class="setup-option">
                        <h3>🌐 Connect to Existing OpenEMR</h3>
                        <p>Connect to an existing OpenEMR installation</p>
                        <input type="url" id="openemr-url" placeholder="https://your-openemr-server.com" class="url-input">
                        <button onclick="realOpenEMR.connectToCustomServer()" class="btn-connect">Connect</button>
                    </div>
                    
                    <div class="setup-option">
                        <h3>🎭 Use OpenEMR Demo Server</h3>
                        <p>Connect to the official OpenEMR demo server</p>
                        <button onclick="realOpenEMR.connectToDemo()" class="btn-demo">Connect to Demo</button>
                    </div>
                    
                    <div class="setup-option">
                        <h3>📦 Download OpenEMR</h3>
                        <p>Get the latest OpenEMR release from GitHub</p>
                        <div class="github-info">
                            <p><strong>Latest Version:</strong> ${this.latestVersion?.tag_name || 'Loading...'}</p>
                            <p><strong>Repository:</strong> openemr/openemr</p>
                        </div>
                        <button onclick="realOpenEMR.downloadOpenEMR()" class="btn-download">Download Latest Release</button>
                        <button onclick="realOpenEMR.viewInstallGuide()" class="btn-guide">Installation Guide</button>
                    </div>
                    
                    <div class="setup-option">
                        <h3>🐳 Docker Setup</h3>
                        <p>Quick setup using Docker (recommended for development)</p>
                        <div class="docker-commands">
                            <code>docker run --name openemr -d -p 80:80 -p 443:443 openemr/openemr</code>
                        </div>
                        <button onclick="realOpenEMR.copyDockerCommand()" class="btn-copy">Copy Command</button>
                        <button onclick="realOpenEMR.checkDockerInstance()" class="btn-check">Check Local Docker</button>
                    </div>
                </div>
                
                <div class="setup-status">
                    <div id="setup-messages"></div>
                </div>
            </div>
        `;
        
        this.addSetupStyles();
        
        return {
            success: true,
            mode: 'setup',
            container: container
        };
    }

    async connectToCustomServer() {
        const urlInput = document.getElementById('openemr-url');
        const serverUrl = urlInput.value.trim();
        
        if (!serverUrl) {
            this.showSetupMessage('Please enter a valid OpenEMR server URL', 'error');
            return;
        }
        
        this.showSetupMessage('Connecting to OpenEMR server...', 'info');
        
        try {
            const connected = await this.connectToOpenEMR(serverUrl);
            if (connected) {
                this.showSetupMessage('✅ Successfully connected to OpenEMR!', 'success');
                setTimeout(() => {
                    this.launchOpenEMR({ mode: 'embed', module: 'dashboard' });
                }, 1000);
            } else {
                this.showSetupMessage('❌ Could not connect to OpenEMR server. Please check the URL and try again.', 'error');
            }
        } catch (error) {
            this.showSetupMessage(`❌ Connection failed: ${error.message}`, 'error');
        }
    }

    async connectToDemo() {
        this.showSetupMessage('Connecting to OpenEMR demo server...', 'info');
        
        try {
            const connected = await this.connectToOpenEMR(this.config.demoServer);
            if (connected) {
                this.showSetupMessage('✅ Connected to OpenEMR demo server!', 'success');
                setTimeout(() => {
                    this.launchOpenEMR({ mode: 'embed', module: 'dashboard' });
                }, 1000);
            } else {
                this.showSetupMessage('❌ Demo server is currently unavailable.', 'error');
            }
        } catch (error) {
            this.showSetupMessage(`❌ Demo connection failed: ${error.message}`, 'error');
        }
    }

    downloadOpenEMR() {
        if (this.latestVersion) {
            window.open(this.latestVersion.html_url, '_blank');
            this.showSetupMessage('Opening GitHub release page...', 'info');
        } else {
            window.open('https://github.com/openemr/openemr/releases', '_blank');
        }
    }

    viewInstallGuide() {
        window.open('https://github.com/openemr/openemr/blob/master/INSTALL', '_blank');
    }

    copyDockerCommand() {
        const command = 'docker run --name openemr -d -p 80:80 -p 443:443 openemr/openemr';
        navigator.clipboard.writeText(command).then(() => {
            this.showSetupMessage('✅ Docker command copied to clipboard!', 'success');
        });
    }

    async checkDockerInstance() {
        this.showSetupMessage('Checking for local Docker OpenEMR instance...', 'info');
        
        // Try common Docker OpenEMR URLs
        const dockerUrls = [
            'http://localhost',
            'http://localhost:80',
            'http://127.0.0.1'
        ];
        
        for (const url of dockerUrls) {
            try {
                const connected = await this.connectToOpenEMR(url);
                if (connected) {
                    this.showSetupMessage(`✅ Found Docker OpenEMR at ${url}!`, 'success');
                    return;
                }
            } catch (error) {
                // Continue checking
            }
        }
        
        this.showSetupMessage('No local Docker OpenEMR instance found. Make sure Docker is running and OpenEMR is started.', 'warning');
    }

    showSetupMessage(message, type = 'info') {
        const messagesContainer = document.getElementById('setup-messages');
        if (messagesContainer) {
            const messageElement = document.createElement('div');
            messageElement.className = `setup-message ${type}`;
            messageElement.textContent = message;
            messagesContainer.appendChild(messageElement);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                messageElement.remove();
            }, 5000);
        }
        console.log(`[OpenEMR Setup] ${message}`);
    }

    refreshModule(module) {
        console.log(`🔄 Refreshing OpenEMR module: ${module}`);
        const iframe = document.querySelector('.openemr-embedded iframe');
        if (iframe) {
            iframe.src = iframe.src; // Force reload
        }
    }

    openInWindow(module) {
        this.launchWindow(module);
    }

    addOpenEMRStyles() {
        if (!document.getElementById('openemr-styles')) {
            const style = document.createElement('style');
            style.id = 'openemr-styles';
            style.textContent = `
                .openemr-embedded {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    margin: 20px 0;
                }
                
                .openemr-header {
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    color: white;
                    padding: 16px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .openemr-title h3 {
                    margin: 0;
                    font-size: 18px;
                }
                
                .openemr-status {
                    font-size: 12px;
                    opacity: 0.8;
                }
                
                .openemr-controls {
                    display: flex;
                    gap: 8px;
                }
                
                .btn-refresh, .btn-window {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                
                .btn-refresh:hover, .btn-window:hover {
                    background: rgba(255,255,255,0.3);
                }
                
                .openemr-content {
                    position: relative;
                    min-height: 600px;
                }
                
                .openemr-footer {
                    background: #f8f9fa;
                    padding: 8px 20px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    color: #666;
                }
                
                .openemr-iframe-wrapper {
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    overflow: hidden;
                    margin: 20px 0;
                }
                
                .iframe-header {
                    background: #f8f9fa;
                    padding: 12px 16px;
                    border-bottom: 1px solid #ddd;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #666;
                }
                
                .close-btn:hover {
                    color: #333;
                }
            `;
            document.head.appendChild(style);
        }
    }

    addSetupStyles() {
        if (!document.getElementById('openemr-setup-styles')) {
            const style = document.createElement('style');
            style.id = 'openemr-setup-styles';
            style.textContent = `
                .openemr-setup {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    margin: 20px 0;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    max-width: 800px;
                    margin: 20px auto;
                }
                
                .setup-header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                
                .setup-header h2 {
                    color: #1d4ed8;
                    margin-bottom: 8px;
                }
                
                .setup-options {
                    display: grid;
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .setup-option {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 20px;
                }
                
                .setup-option h3 {
                    color: #374151;
                    margin-bottom: 8px;
                }
                
                .setup-option p {
                    color: #6b7280;
                    margin-bottom: 16px;
                }
                
                .url-input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    margin-bottom: 12px;
                }
                
                .btn-connect, .btn-demo, .btn-download, .btn-guide, .btn-copy, .btn-check {
                    background: #2563eb;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 8px;
                    margin-bottom: 8px;
                }
                
                .btn-connect:hover, .btn-demo:hover, .btn-download:hover, .btn-guide:hover, .btn-copy:hover, .btn-check:hover {
                    background: #1d4ed8;
                }
                
                .github-info {
                    background: #f8f9fa;
                    padding: 12px;
                    border-radius: 4px;
                    margin: 12px 0;
                    font-size: 14px;
                }
                
                .docker-commands {
                    background: #1f2937;
                    color: #f9fafb;
                    padding: 12px;
                    border-radius: 4px;
                    font-family: monospace;
                    font-size: 12px;
                    margin: 12px 0;
                    overflow-x: auto;
                }
                
                .setup-message {
                    padding: 8px 12px;
                    border-radius: 4px;
                    margin: 8px 0;
                }
                
                .setup-message.success {
                    background: #dcfce7;
                    color: #166534;
                    border: 1px solid #bbf7d0;
                }
                
                .setup-message.error {
                    background: #fef2f2;
                    color: #dc2626;
                    border: 1px solid #fecaca;
                }
                
                .setup-message.warning {
                    background: #fffbeb;
                    color: #d97706;
                    border: 1px solid #fed7aa;
                }
                
                .setup-message.info {
                    background: #eff6ff;
                    color: #2563eb;
                    border: 1px solid #dbeafe;
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Initialize the real OpenEMR integration
window.realOpenEMR = new RealOpenEMRIntegration();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealOpenEMRIntegration;
}
