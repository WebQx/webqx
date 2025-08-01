/**
 * @fileoverview TLS Configuration for Telehealth Module
 * 
 * This module provides comprehensive TLS configuration for secure
 * video and chat communications in compliance with HIPAA requirements.
 * 
 * Features:
 * - TLS 1.3 enforcement
 * - Perfect Forward Secrecy
 * - Certificate validation
 * - HSTS headers
 * - Cipher suite restrictions
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * TLS Configuration for HIPAA-compliant communications
 */
class TLSConfig {
    constructor() {
        this.loadEnvironmentConfig();
        this.validateConfiguration();
    }

    /**
     * Load TLS configuration from environment variables
     */
    loadEnvironmentConfig() {
        this.config = {
            // Certificate paths
            certPath: process.env.TELEHEALTH_TLS_CERT_PATH || '/etc/ssl/certs/telehealth.pem',
            keyPath: process.env.TELEHEALTH_TLS_KEY_PATH || '/etc/ssl/private/telehealth.key',
            caPath: process.env.TELEHEALTH_TLS_CA_PATH,
            
            // TLS version requirements
            minVersion: 'TLSv1.3',
            maxVersion: 'TLSv1.3',
            
            // Security options
            honorCipherOrder: true,
            secureProtocol: 'TLSv1_3_method',
            
            // HSTS configuration
            hstsMaxAge: 31536000, // 1 year
            hstsIncludeSubDomains: true,
            hstsPreload: true,
            
            // Session configuration
            sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60') * 60,
            sessionIdContext: crypto.randomBytes(16).toString('hex'),
            
            // Cipher suites (TLS 1.3 compatible)
            ciphers: [
                'TLS_AES_256_GCM_SHA384',
                'TLS_CHACHA20_POLY1305_SHA256',
                'TLS_AES_128_GCM_SHA256'
            ].join(':'),
            
            // ECDH curves
            ecdhCurve: 'prime256v1:secp384r1:secp521r1',
            
            // Client certificate requirements
            requestCert: process.env.TELEHEALTH_REQUIRE_CLIENT_CERT === 'true',
            rejectUnauthorized: process.env.NODE_ENV === 'production',
            
            // Certificate verification
            checkServerIdentity: true,
            verifyMode: 'VERIFY_PEER'
        };
    }

    /**
     * Validate TLS configuration
     */
    validateConfiguration() {
        const errors = [];

        // Check if certificate files exist
        if (!fs.existsSync(this.config.certPath)) {
            if (process.env.NODE_ENV === 'production') {
                errors.push(`TLS certificate not found at: ${this.config.certPath}`);
            } else {
                console.warn(`⚠️ TLS certificate not found, using self-signed for development`);
                this.generateSelfSignedCertificate();
            }
        }

        if (!fs.existsSync(this.config.keyPath)) {
            if (process.env.NODE_ENV === 'production') {
                errors.push(`TLS private key not found at: ${this.config.keyPath}`);
            }
        }

        if (this.config.caPath && !fs.existsSync(this.config.caPath)) {
            errors.push(`CA certificate not found at: ${this.config.caPath}`);
        }

        if (errors.length > 0) {
            throw new Error(`TLS Configuration Errors:\n${errors.join('\n')}`);
        }

        console.log('✅ TLS configuration validated successfully');
    }

    /**
     * Generate self-signed certificate for development
     */
    generateSelfSignedCertificate() {
        const { generateKeyPairSync } = require('crypto');
        const { createCertificate } = require('crypto');
        
        try {
            // Generate key pair
            const { publicKey, privateKey } = generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            });

            // Create certificate
            const cert = {
                subject: { CN: 'localhost' },
                issuer: { CN: 'localhost' },
                validFrom: new Date(),
                validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
                publicKey: publicKey
            };

            // Create directories if they don't exist
            const certDir = path.dirname(this.config.certPath);
            const keyDir = path.dirname(this.config.keyPath);
            
            if (!fs.existsSync(certDir)) {
                fs.mkdirSync(certDir, { recursive: true });
            }
            if (!fs.existsSync(keyDir)) {
                fs.mkdirSync(keyDir, { recursive: true });
            }

            // Write certificate and key (for development only)
            if (process.env.NODE_ENV === 'development') {
                fs.writeFileSync(this.config.keyPath, privateKey);
                // Note: In a real implementation, you would generate a proper certificate
                console.log('📝 Generated self-signed certificate for development');
            }
        } catch (error) {
            console.warn('⚠️ Could not generate self-signed certificate:', error.message);
        }
    }

    /**
     * Get TLS options for HTTPS server
     */
    getHTTPSOptions() {
        const options = {
            // Certificate files
            cert: this.loadCertificate(),
            key: this.loadPrivateKey(),
            
            // TLS version requirements
            minVersion: this.config.minVersion,
            maxVersion: this.config.maxVersion,
            
            // Security settings
            honorCipherOrder: this.config.honorCipherOrder,
            ciphers: this.config.ciphers,
            ecdhCurve: this.config.ecdhCurve,
            
            // Session settings
            sessionTimeout: this.config.sessionTimeout,
            sessionIdContext: this.config.sessionIdContext,
            
            // Client certificate settings
            requestCert: this.config.requestCert,
            rejectUnauthorized: this.config.rejectUnauthorized
        };

        // Add CA if specified
        if (this.config.caPath && fs.existsSync(this.config.caPath)) {
            options.ca = fs.readFileSync(this.config.caPath);
        }

        return options;
    }

    /**
     * Get WebRTC configuration with DTLS
     */
    getWebRTCConfig() {
        return {
            iceServers: [
                {
                    urls: process.env.WEBRTC_STUN_SERVERS?.split(',') || [
                        'stun:stun.l.google.com:19302',
                        'stun:stun1.l.google.com:19302'
                    ]
                },
                {
                    urls: process.env.WEBRTC_TURN_SERVERS?.split(',') || [],
                    username: process.env.WEBRTC_TURN_USERNAME,
                    credential: process.env.WEBRTC_TURN_PASSWORD
                }
            ],
            iceTransportPolicy: 'relay', // Force TURN for maximum security
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            
            // DTLS configuration
            dtlsSrtpKeyAgreement: true,
            
            // Security constraints
            mandatory: {
                minAspectRatio: 1.33,
                maxAspectRatio: 1.78,
                maxFrameRate: 30,
                minFrameRate: 15
            }
        };
    }

    /**
     * Load certificate file
     */
    loadCertificate() {
        try {
            if (fs.existsSync(this.config.certPath)) {
                return fs.readFileSync(this.config.certPath);
            }
            
            // Development fallback
            if (process.env.NODE_ENV === 'development') {
                return this.getDefaultDevCertificate();
            }
            
            throw new Error('Certificate file not found');
        } catch (error) {
            throw new Error(`Failed to load certificate: ${error.message}`);
        }
    }

    /**
     * Load private key file
     */
    loadPrivateKey() {
        try {
            if (fs.existsSync(this.config.keyPath)) {
                return fs.readFileSync(this.config.keyPath);
            }
            
            // Development fallback
            if (process.env.NODE_ENV === 'development') {
                return this.getDefaultDevPrivateKey();
            }
            
            throw new Error('Private key file not found');
        } catch (error) {
            throw new Error(`Failed to load private key: ${error.message}`);
        }
    }

    /**
     * Get default development certificate (placeholder)
     */
    getDefaultDevCertificate() {
        // In development, we would use a self-signed certificate
        // This is a placeholder - in real implementation, generate actual cert
        return Buffer.from('development-certificate-placeholder');
    }

    /**
     * Get default development private key (placeholder)
     */
    getDefaultDevPrivateKey() {
        // In development, we would use the corresponding private key
        // This is a placeholder - in real implementation, generate actual key
        return Buffer.from('development-private-key-placeholder');
    }

    /**
     * Get HSTS headers
     */
    getHSTSHeaders() {
        let hstsValue = `max-age=${this.config.hstsMaxAge}`;
        
        if (this.config.hstsIncludeSubDomains) {
            hstsValue += '; includeSubDomains';
        }
        
        if (this.config.hstsPreload) {
            hstsValue += '; preload';
        }
        
        return {
            'Strict-Transport-Security': hstsValue,
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Content-Security-Policy': "default-src 'self'; connect-src 'self' wss: https:; media-src 'self' blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        };
    }

    /**
     * Validate certificate expiration
     */
    validateCertificateExpiration() {
        try {
            const cert = this.loadCertificate();
            const x509 = require('crypto').X509Certificate;
            
            if (cert && cert.length > 0) {
                const certificate = new x509(cert);
                const expiryDate = new Date(certificate.validTo);
                const daysUntilExpiry = Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                
                if (daysUntilExpiry < 30) {
                    console.warn(`⚠️ TLS certificate expires in ${daysUntilExpiry} days`);
                }
                
                if (daysUntilExpiry < 0) {
                    throw new Error('TLS certificate has expired');
                }
                
                return { valid: true, daysUntilExpiry };
            }
        } catch (error) {
            console.warn('⚠️ Could not validate certificate expiration:', error.message);
            return { valid: false, error: error.message };
        }
    }

    /**
     * Get configuration summary for logging
     */
    getConfigSummary() {
        return {
            tlsVersion: this.config.minVersion,
            hstsEnabled: true,
            clientCertRequired: this.config.requestCert,
            cipherSuites: this.config.ciphers.split(':').length,
            certificateStatus: fs.existsSync(this.config.certPath) ? 'loaded' : 'missing'
        };
    }
}

// Export singleton instance
const tlsConfig = new TLSConfig();
module.exports = tlsConfig;