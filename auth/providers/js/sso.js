/**
 * WebQX Provider Portal - Single Sign-On (SSO) Module
 * Handles integration with Keycloak, Microsoft, and SMART on FHIR
 */

class SSOManager {
    constructor() {
        this.ssoConfigs = {
            keycloak: {
                name: 'Keycloak',
                enabled: true,
                authUrl: 'https://keycloak.webqx.health/auth',
                realm: 'webqx-healthcare',
                clientId: 'webqx-provider-portal',
                scope: 'openid profile email',
                redirectUri: `${window.location.origin}/auth/providers/callback/keycloak`
            },
            microsoft: {
                name: 'Microsoft',
                enabled: true,
                authUrl: 'https://login.microsoftonline.com',
                tenantId: 'common',
                clientId: 'your-azure-client-id',
                scope: 'https://graph.microsoft.com/User.Read openid profile email',
                redirectUri: `${window.location.origin}/auth/providers/callback/microsoft`
            },
            'smart-fhir': {
                name: 'SMART on FHIR',
                enabled: true,
                authUrl: 'https://fhir.epic.com/interconnect-fhir-oauth',
                clientId: 'your-fhir-client-id',
                scope: 'launch/patient patient/*.read user/*.read openid profile',
                redirectUri: `${window.location.origin}/auth/providers/callback/smart-fhir`,
                aud: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/'
            }
        };

        this.currentProvider = null;
        this.authWindow = null;
        this.authCheckInterval = null;
        
        this.init();
    }

    init() {
        // Check for OAuth callback parameters
        this.handleOAuthCallback();
        
        // Set up SSO button states
        this.updateSSOButtonStates();
        
        // Listen for language changes to update button tooltips
        window.addEventListener('languageChanged', () => {
            this.updateSSOButtonTooltips();
        });
    }

    handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        
        if (error) {
            console.error('OAuth error:', error);
            this.showSSOError(`Authentication failed: ${error}`);
            return;
        }
        
        if (code && state) {
            try {
                const stateData = JSON.parse(atob(state));
                if (stateData.provider) {
                    this.handleSSOCallback(stateData.provider, code, state);
                }
            } catch (e) {
                console.error('Invalid state parameter:', e);
                this.showSSOError('Invalid authentication state');
            }
        }
    }

    async initiateSSO(provider) {
        if (!this.ssoConfigs[provider] || !this.ssoConfigs[provider].enabled) {
            this.showSSOError(`${provider} SSO is not configured or enabled`);
            return;
        }

        this.currentProvider = provider;
        const config = this.ssoConfigs[provider];
        
        try {
            // Generate state parameter for security
            const state = btoa(JSON.stringify({
                provider,
                timestamp: Date.now(),
                nonce: this.generateNonce()
            }));
            
            // Build authorization URL
            const authUrl = this.buildAuthUrl(provider, state);
            
            // Show loading state
            this.setSSOButtonLoading(provider, true);
            
            // Open authorization window
            this.openAuthWindow(authUrl);
            
        } catch (error) {
            console.error(`Error initiating ${provider} SSO:`, error);
            this.showSSOError(`Failed to initiate ${provider} authentication`);
            this.setSSOButtonLoading(provider, false);
        }
    }

    buildAuthUrl(provider, state) {
        const config = this.ssoConfigs[provider];
        
        switch (provider) {
            case 'keycloak':
                return `${config.authUrl}/realms/${config.realm}/protocol/openid-connect/auth?` +
                       `client_id=${encodeURIComponent(config.clientId)}&` +
                       `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
                       `response_type=code&` +
                       `scope=${encodeURIComponent(config.scope)}&` +
                       `state=${encodeURIComponent(state)}`;
                       
            case 'microsoft':
                return `${config.authUrl}/${config.tenantId}/oauth2/v2.0/authorize?` +
                       `client_id=${encodeURIComponent(config.clientId)}&` +
                       `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
                       `response_type=code&` +
                       `scope=${encodeURIComponent(config.scope)}&` +
                       `state=${encodeURIComponent(state)}&` +
                       `response_mode=query`;
                       
            case 'smart-fhir':
                return `${config.authUrl}/authorize?` +
                       `client_id=${encodeURIComponent(config.clientId)}&` +
                       `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
                       `response_type=code&` +
                       `scope=${encodeURIComponent(config.scope)}&` +
                       `state=${encodeURIComponent(state)}&` +
                       `aud=${encodeURIComponent(config.aud)}`;
                       
            default:
                throw new Error(`Unknown SSO provider: ${provider}`);
        }
    }

    openAuthWindow(authUrl) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        this.authWindow = window.open(
            authUrl,
            'sso_auth',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );
        
        // Monitor auth window
        this.authCheckInterval = setInterval(() => {
            this.checkAuthWindow();
        }, 1000);
        
        // Set timeout for auth window
        setTimeout(() => {
            if (this.authWindow && !this.authWindow.closed) {
                this.authWindow.close();
                this.cleanupAuthWindow();
                this.showSSOError('Authentication timeout. Please try again.');
            }
        }, 300000); // 5 minutes timeout
    }

    checkAuthWindow() {
        if (!this.authWindow || this.authWindow.closed) {
            this.cleanupAuthWindow();
            if (this.currentProvider) {
                this.setSSOButtonLoading(this.currentProvider, false);
                // Don't show error if user simply closed the window
            }
            return;
        }
        
        try {
            // Check if we can access the window URL (same origin)
            const url = this.authWindow.location.href;
            if (url.includes('/auth/providers/callback/')) {
                // Callback URL reached, close window and handle on main page
                this.authWindow.close();
                this.cleanupAuthWindow();
            }
        } catch (e) {
            // Cross-origin restriction, window is still on auth provider domain
            // This is expected during the auth flow
        }
    }

    cleanupAuthWindow() {
        if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
            this.authCheckInterval = null;
        }
        this.authWindow = null;
    }

    async handleSSOCallback(provider, code, state) {
        try {
            // Verify state parameter
            const stateData = JSON.parse(atob(state));
            if (Date.now() - stateData.timestamp > 600000) { // 10 minutes
                throw new Error('Authentication state expired');
            }
            
            // Exchange code for tokens
            const tokenData = await this.exchangeCodeForTokens(provider, code);
            
            // Get user info
            const userInfo = await this.getUserInfo(provider, tokenData.access_token);
            
            // Authenticate with WebQX backend
            await this.authenticateWithBackend(provider, tokenData, userInfo);
            
        } catch (error) {
            console.error('SSO callback error:', error);
            this.showSSOError(`Authentication failed: ${error.message}`);
        }
    }

    async exchangeCodeForTokens(provider, code) {
        const response = await fetch('/api/auth/sso/exchange', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                provider,
                code,
                redirectUri: this.ssoConfigs[provider].redirectUri
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to exchange authorization code');
        }
        
        return await response.json();
    }

    async getUserInfo(provider, accessToken) {
        const response = await fetch('/api/auth/sso/userinfo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                provider,
                accessToken
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to get user information');
        }
        
        return await response.json();
    }

    async authenticateWithBackend(provider, tokenData, userInfo) {
        const response = await fetch('/api/auth/provider/sso-login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                provider,
                tokenData,
                userInfo
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Store authentication data
            providerAuth.storeAuthData(result, false);
            
            // Show role confirmation modal
            providerAuth.showRoleConfirmation(result.user.roles);
        } else {
            throw new Error(result.error || 'SSO authentication failed');
        }
    }

    setSSOButtonLoading(provider, loading) {
        const button = document.querySelector(`[onclick="initiateSSO('${provider}')"]`);
        if (button) {
            button.disabled = loading;
            if (loading) {
                button.classList.add('opacity-50', 'cursor-not-allowed');
                button.innerHTML = `
                    <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                `;
            } else {
                button.classList.remove('opacity-50', 'cursor-not-allowed');
                this.restoreButtonIcon(provider, button);
            }
        }
    }

    restoreButtonIcon(provider, button) {
        let iconSvg = '';
        
        switch (provider) {
            case 'keycloak':
                iconSvg = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7v10c0 5.55 3.84 9.95 9 11 5.16-1.05 9-5.45 9-11V7l-10-5z"/>
                </svg>`;
                break;
            case 'microsoft':
                iconSvg = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
                </svg>`;
                break;
            case 'smart-fhir':
                iconSvg = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>`;
                break;
        }
        
        button.innerHTML = iconSvg;
    }

    updateSSOButtonStates() {
        Object.keys(this.ssoConfigs).forEach(provider => {
            const config = this.ssoConfigs[provider];
            const button = document.querySelector(`[onclick="initiateSSO('${provider}')"]`);
            
            if (button) {
                if (!config.enabled) {
                    button.disabled = true;
                    button.classList.add('opacity-50', 'cursor-not-allowed');
                    button.title = `${config.name} SSO is not configured`;
                } else {
                    button.title = `Sign in with ${config.name}`;
                }
            }
        });
    }

    updateSSOButtonTooltips() {
        Object.keys(this.ssoConfigs).forEach(provider => {
            const config = this.ssoConfigs[provider];
            const button = document.querySelector(`[onclick="initiateSSO('${provider}')"]`);
            
            if (button) {
                if (!config.enabled) {
                    button.title = `${config.name} SSO is not configured`;
                } else {
                    // Update tooltip based on current language
                    const currentLang = i18n ? i18n.getCurrentLanguage() : 'en';
                    const signInText = this.getSignInText(currentLang);
                    button.title = `${signInText} ${config.name}`;
                }
            }
        });
    }

    getSignInText(language) {
        const translations = {
            en: 'Sign in with',
            es: 'Iniciar sesión con',
            ar: 'تسجيل الدخول باستخدام'
        };
        return translations[language] || translations.en;
    }

    showSSOError(message) {
        // Use the auth manager's alert system if available
        if (window.providerAuth) {
            providerAuth.showAlert(message, 'error');
        } else {
            alert(message);
        }
    }

    generateNonce() {
        const array = new Uint32Array(8);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16)).join('');
    }
}

// Global functions for HTML onclick handlers
function initiateSSO(provider) {
    if (window.ssoManager) {
        ssoManager.initiateSSO(provider);
    } else {
        console.error('SSO Manager not initialized');
    }
}

// Global instance
let ssoManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    ssoManager = new SSOManager();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SSOManager;
}