/**
 * WebQX Remote Configuration for GitHub Pages
 * Updated to use Codespace external URLs instead of localhost
 */

// Codespace Configuration
const CODESPACE_NAME = 'fuzzy-goldfish-7vx645x7wgvv3rjxg';
const CODESPACE_BASE = `https://${CODESPACE_NAME}`;

// External URLs for remote access
const WEBQX_CONFIG = {
    // Remote API endpoints (accessible from GitHub Pages)
    remote: {
        api_base: `${CODESPACE_BASE}-8080.app.github.dev`,
        emr_base: `${CODESPACE_BASE}-8085.app.github.dev`,
        endpoints: {
            server_status: `${CODESPACE_BASE}-8080.app.github.dev/api/server-status`,
            remote_start: `${CODESPACE_BASE}-8080.app.github.dev/api/remote-start`,
            emr_status: `${CODESPACE_BASE}-8085.app.github.dev/webqx-api.php?action=status`,
            emr_health: `${CODESPACE_BASE}-8085.app.github.dev/webqx-api.php?action=health`,
            community_stats: `${CODESPACE_BASE}-8085.app.github.dev/webqx-api.php?action=community-stats`
        }
    },
    
    // Local URLs (for development/testing)
    local: {
        api_base: 'http://localhost:8080',
        emr_base: 'http://localhost:8085',
        endpoints: {
            server_status: 'http://localhost:8080/api/server-status',
            remote_start: 'http://localhost:8080/api/remote-start',
            emr_status: 'http://localhost:8085/webqx-api.php?action=status',
            emr_health: 'http://localhost:8085/webqx-api.php?action=health',
            community_stats: 'http://localhost:8085/webqx-api.php?action=community-stats'
        }
    },
    
    // Auto-detect environment
    getConfig() {
        // For GitHub Pages, always use remote
        if (window.location.hostname.includes('github.io')) {
            return this.remote;
        }
        // For local development, use local
        return this.local;
    },
    
    // Test connectivity
    async testConnectivity() {
        const config = this.getConfig();
        const results = {
            api_accessible: false,
            emr_accessible: false,
            endpoints_working: {}
        };
        
        try {
            // Test API server
            const apiResponse = await fetch(config.endpoints.server_status);
            results.api_accessible = apiResponse.ok;
            
            // Test EMR server
            const emrResponse = await fetch(config.endpoints.emr_status);
            results.emr_accessible = emrResponse.ok;
            
            // Test individual endpoints
            for (const [name, url] of Object.entries(config.endpoints)) {
                try {
                    const response = await fetch(url);
                    results.endpoints_working[name] = response.ok;
                } catch (error) {
                    results.endpoints_working[name] = false;
                }
            }
            
        } catch (error) {
            console.error('Connectivity test failed:', error);
        }
        
        return results;
    }
};

// Export for use in GitHub Pages
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WEBQX_CONFIG;
}

// Make available globally
window.WEBQX_CONFIG = WEBQX_CONFIG;

console.log('🔗 WebQX Remote Configuration Loaded');
console.log('📍 Current environment:', window.location.hostname.includes('github.io') ? 'GitHub Pages (Remote)' : 'Local Development');
console.log('🌐 Using endpoints:', WEBQX_CONFIG.getConfig().endpoints);