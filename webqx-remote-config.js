/**
 * WebQX Remote Configuration for GitHub Pages
 * Updated to use Codespace external URLs instead of localhost
 */

function buildConfig() {
    const ghPages = window.location.hostname.includes('github.io');
    const origin = window.location.origin;

    // Allow override via global injection before this script loads
    const envApiBase = window.WEBQX_API_BASE || window.__WEBQX_API_BASE__;
    const envEmrBase = window.WEBQX_EMR_BASE || window.__WEBQX_EMR_BASE__;

    const local = {
        api_base: envApiBase || 'http://localhost:8080',
        emr_base: envEmrBase || 'http://localhost:8085',
        pacs_dicomweb: (envApiBase || 'http://localhost:8080') + '/dicomweb',
        ohif_viewer: window.WEBQX_OHIF_VIEWER || 'https://ohif.org/viewer',
        endpoints: {
            server_status: (envApiBase || 'http://localhost:8080') + '/api/system/status',
            remote_start: (envApiBase || 'http://localhost:8080') + '/api/system/start',
            emr_status: (envEmrBase || 'http://localhost:8085') + '/webqx-api.php?action=status',
            emr_health: (envEmrBase || 'http://localhost:8085') + '/webqx-api.php?action=health',
            community_stats: (envEmrBase || 'http://localhost:8085') + '/webqx-api.php?action=community-stats'
        }
    };

    // Production / remote: prefer window.WEBQX_PROD_API or fallback to same-origin (for reverse proxy setups)
    const remoteApi = envApiBase || window.WEBQX_PROD_API || (ghPages ? 'https://api.webqx.com' : origin);
    const remoteEmr = envEmrBase || window.WEBQX_PROD_EMR || remoteApi.replace('api.', 'emr.');

    const remote = {
        api_base: remoteApi,
        emr_base: remoteEmr,
        pacs_dicomweb: (remoteApi + '/dicomweb'),
        ohif_viewer: window.WEBQX_OHIF_VIEWER || 'https://ohif.org/viewer',
        endpoints: {
            server_status: remoteApi + '/api/system/status',
            remote_start: remoteApi + '/api/system/start',
            emr_status: remoteEmr + '/webqx-api.php?action=status',
            emr_health: remoteEmr + '/webqx-api.php?action=health',
            community_stats: remoteEmr + '/webqx-api.php?action=community-stats'
        }
    };

    return { ghPages, local, remote };
}

const _cfg = buildConfig();

const WEBQX_CONFIG = {
    remote: _cfg.remote,
    local: _cfg.local,
    getConfig() {
        if (_cfg.ghPages) return this.remote;
        // If explicitly forced
        if (window.WEBQX_FORCE_ENV === 'remote') return this.remote;
        if (window.WEBQX_FORCE_ENV === 'local') return this.local;
        return this.local;
    },
    async testConnectivity() {
        const config = this.getConfig();
        const results = { api_accessible: false, emr_accessible: false, endpoints_working: {} };
        try {
            const apiResponse = await fetch(config.endpoints.server_status, { method: 'GET' });
            results.api_accessible = apiResponse.ok;
        } catch (e) { results.api_accessible = false; }
        try {
            const emrResponse = await fetch(config.endpoints.emr_status, { method: 'GET' });
            results.emr_accessible = emrResponse.ok;
        } catch (e) { results.emr_accessible = false; }
        for (const [name, url] of Object.entries(config.endpoints)) {
            try {
                const r = await fetch(url, { method: 'GET' });
                results.endpoints_working[name] = r.ok;
            } catch (e) { results.endpoints_working[name] = false; }
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