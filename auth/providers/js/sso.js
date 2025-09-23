/**
 * WebQX Provider Portal - Single Sign-On (SSO) Module
 * Unified via Keycloak (brokered social login for Microsoft, Google, Apple)
 */

class SSOManager {
    constructor() {
        // Allow per-page overrides before instantiation
        const override = (window.WEBQX_SSO_OVERRIDE || {});
    this.finalizeEndpoint = override.finalizeEndpoint || '/api/auth/provider/sso-login';
    // Use a concrete callback HTML file so static hosting returns same-origin content
    this.callbackPathPrefix = override.callbackPathPrefix || '/auth/providers/callback';
        this.redirectAfterLogin = override.redirectAfterLogin || null;

        // Base Keycloak config (acts as broker)
        const keycloakBase = {
            name: 'Keycloak',
            enabled: true,
            authUrl: 'https://keycloak.webqx.health/auth',
            realm: 'webqx-healthcare',
            clientId: 'webqx-provider-portal',
            scope: 'openid profile email',
            redirectUri: `${window.location.origin}${this.callbackPathPrefix}.html`
        };

        // Map friendly providers to Keycloak with kc_idp_hint
        this.idpHints = Object.assign({
            microsoft: 'microsoft',
            google: 'google',
            apple: 'apple'
        }, (window.WEBQX_SSO_IDP_HINTS || {}));

        this.ssoConfigs = {
            keycloak: keycloakBase,
            microsoft: { name: 'Microsoft', enabled: true },
            google: { name: 'Google', enabled: true },
            apple: { name: 'Apple', enabled: true }
        };

        this.currentProvider = null;
        this.authWindow = null;
        this.authCheckInterval = null;
        
        this.init();
    }

    init() {
        // Optional: page can override provider enablement flags
        const providerOverrides = (window.WEBQX_SSO_PROVIDERS || {});
        Object.keys(providerOverrides).forEach(p => {
            if (this.ssoConfigs[p]) this.ssoConfigs[p].enabled = !!providerOverrides[p];
        });
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
        
        // Always broker through Keycloak; use kc_idp_hint for social providers
        const kc = this.ssoConfigs.keycloak;
        const base = `${kc.authUrl}/realms/${kc.realm}/protocol/openid-connect/auth`;
        const common = `client_id=${encodeURIComponent(kc.clientId)}&` +
                       `redirect_uri=${encodeURIComponent(kc.redirectUri)}&` +
                       `response_type=code&` +
                       `scope=${encodeURIComponent(kc.scope)}&` +
                       `state=${encodeURIComponent(state)}`;
        if (provider === 'keycloak') {
            return `${base}?${common}`;
        }
        if (provider === 'microsoft' || provider === 'google' || provider === 'apple') {
            const hint = encodeURIComponent(this.idpHints[provider] || provider);
            return `${base}?${common}&kc_idp_hint=${hint}`;
        }
        throw new Error(`Unknown SSO provider: ${provider}`);
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
            if (url.includes(`${this.callbackPathPrefix}`)) {
                // Callback URL reached on same origin: parse params from popup
                try {
                    const search = this.authWindow.location.search || '';
                    const params = new URLSearchParams(search);
                    const code = params.get('code');
                    const state = params.get('state');
                    if (code && state && this.currentProvider) {
                        // Process callback in the main window
                        this.handleSSOCallback(this.currentProvider, code, state);
                    }
                } catch (_) { /* ignore parse errors */ }

                // Close popup and cleanup
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
            
            // Get user info (Apple returns user claims in id_token)
            const tokenForUserInfo = provider === 'apple' ? tokenData.id_token : tokenData.access_token;
            const userInfo = await this.getUserInfo(provider, tokenForUserInfo);
            
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
                // Use Keycloak as the broker for token exchange
                provider: 'keycloak',
                code,
                redirectUri: this.ssoConfigs.keycloak.redirectUri
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
                // Userinfo via Keycloak (regardless of upstream IdP)
                provider: 'keycloak',
                accessToken
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to get user information');
        }
        
        return await response.json();
    }

    async authenticateWithBackend(provider, tokenData, userInfo) {
        const response = await fetch(this.finalizeEndpoint, {
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
            // If provider auth UI exists, delegate to it
            if (window.providerAuth && typeof window.providerAuth.storeAuthData === 'function') {
                window.providerAuth.storeAuthData(result, false);
                if (typeof window.providerAuth.showRoleConfirmation === 'function') {
                    window.providerAuth.showRoleConfirmation(result.user.roles);
                }
                return;
            }

            // Generic fallback for other pages
            try {
                const storage = window.localStorage;
                if (result.token) storage.setItem('webqx_token', result.token);
                if (result.user) storage.setItem('webqx_user', JSON.stringify(result.user));
                storage.setItem('webqx_auth_provider', provider);
            } catch {}

            const dest = this.redirectAfterLogin || '/';
            window.location.assign(dest);
        } else {
            throw new Error(result.error || 'SSO authentication failed');
        }
    }

    setSSOButtonLoading(provider, loading) {
        const button = document.querySelector(`button[data-sso="${provider}"]`);
        if (button) {
            button.disabled = loading;
            if (loading) {
                button.classList.add('opacity-50', 'cursor-not-allowed');
                button.dataset.prevHtml = button.innerHTML;
                button.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>`;
            } else {
                button.classList.remove('opacity-50', 'cursor-not-allowed');
                if (button.dataset.prevHtml) {
                    button.innerHTML = button.dataset.prevHtml;
                    delete button.dataset.prevHtml;
                } else {
                    this.restoreButtonIcon(provider, button);
                }
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
            case 'google':
                iconSvg = `<svg class="w-5 h-5" viewBox="0 0 533.5 544.3">
                    <path fill="#4285F4" d="M533.5 278.4c0-18.6-1.5-37.7-4.7-55.8H272v105.5h146.9c-6.4 34.5-25.7 63.7-54.9 83.3v68h88.7c52-47.9 81.8-118.4 81.8-201z"/>
                    <path fill="#34A853" d="M272 544.3c74.2 0 136.5-24.5 182-66.3l-88.7-68c-24.6 16.5-56.1 26-93.3 26-71.5 0-132-48.2-153.7-113.1H27.2v70.9c45.2 89.7 137.9 150.5 244.8 150.5z"/>
                    <path fill="#FBBC04" d="M118.3 322.9c-10.6-31.9-10.6-66.2 0-98.1v-70.9H27.2c-40.3 80.5-40.3 176.5 0 257z"/>
                    <path fill="#EA4335" d="M272 107.7c38.3-.6 74.9 13.8 102.8 40.9l77-77C404.4 24.8 339.9-1.1 272 0 165.1 0 72.4 60.8 27.2 150.5l91.1 70.9C140 155.9 200.5 107.7 272 107.7z"/>
                </svg>`;
                break;
            case 'apple':
                iconSvg = `<svg class="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M16.365 1.43c0 1.14-.463 2.2-1.248 2.993-.713.72-1.88 1.275-3.026 1.152-.123-1.148.47-2.31 1.186-3.032.76-.756 2.047-1.3 3.088-1.113zm3.512 17.556c-.64 1.457-.94 2.116-1.759 3.415-1.14 1.742-2.748 3.927-4.729 3.945-1.782.017-2.25-1.148-4.697-1.137-2.447.01-2.962 1.157-4.744 1.14-1.98-.018-3.5-1.981-4.64-3.723-3.18-4.85-3.518-10.56-1.558-13.57 1.39-2.15 3.595-3.415 5.668-3.415 2.123 0 3.46 1.163 5.22 1.163 1.71 0 2.75-1.164 5.23-1.164 1.933 0 3.978 1.05 5.37 2.855-4.72 2.586-3.96 9.33.64 10.491z"/>
                </svg>`;
                break;
        }
        
        button.innerHTML = iconSvg;
    }

    updateSSOButtonStates() {
        Object.keys(this.ssoConfigs).forEach(provider => {
            const config = this.ssoConfigs[provider];
            const button = document.querySelector(`button[data-sso="${provider}"]`);
            if (!button) return;
            if (!config.enabled) {
                button.disabled = true;
                button.classList.add('opacity-50', 'cursor-not-allowed');
                button.title = `${config.name} SSO is not configured`;
                button.style.display = 'none';
            } else {
                button.style.display = '';
                button.title = `Sign in with ${config.name}`;
                // Attach click handler if not already
                if (!button._wqxSsoBound) {
                    button.addEventListener('click', () => this.initiateSSO(provider));
                    button._wqxSsoBound = true;
                }
            }
        });
    }

    updateSSOButtonTooltips() {
        Object.keys(this.ssoConfigs).forEach(provider => {
            const config = this.ssoConfigs[provider];
            const button = document.querySelector(`button[data-sso="${provider}"]`);
            
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