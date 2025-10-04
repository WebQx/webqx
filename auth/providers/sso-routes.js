const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { getSSOConfigs } = require('./sso-config');

const router = express.Router();

// Load SSO configuration once so we can fail fast if production secrets are missing
const ssoConfigs = getSSOConfigs();

// Exchange authorization code for access token
router.post('/exchange', async (req, res) => {
    try {
        const { provider, code, redirectUri } = req.body;
        
        if (!ssoConfigs[provider]) {
            return res.status(400).json({
                error: 'Unsupported SSO provider'
            });
        }
        
        const config = ssoConfigs[provider];
        const tokenData = await exchangeCodeForToken(provider, code, redirectUri, config);
        
        res.json(tokenData);
        
    } catch (error) {
        console.error('SSO token exchange error:', error);
        res.status(500).json({
            error: 'Failed to exchange authorization code'
        });
    }
});

// Get user information from SSO provider
router.post('/userinfo', async (req, res) => {
    try {
        const { provider, accessToken } = req.body;
        
        if (!ssoConfigs[provider]) {
            return res.status(400).json({
                error: 'Unsupported SSO provider'
            });
        }
        
        const config = ssoConfigs[provider];
        const userInfo = await getUserInfo(provider, accessToken, config);
        
        res.json(userInfo);
        
    } catch (error) {
        console.error('SSO user info error:', error);
        res.status(500).json({
            error: 'Failed to get user information'
        });
    }
});

async function exchangeCodeForToken(provider, code, redirectUri, config) {
    let tokenRequestData;
    
    switch (provider) {
        case 'keycloak':
            tokenRequestData = {
                grant_type: 'authorization_code',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: code,
                redirect_uri: redirectUri
            };
            break;
            
        case 'microsoft':
            tokenRequestData = {
                grant_type: 'authorization_code',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: code,
                redirect_uri: redirectUri
            };
            break;
        case 'google':
            tokenRequestData = {
                grant_type: 'authorization_code',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: code,
                redirect_uri: redirectUri
            };
            break;
        case 'apple':
            tokenRequestData = {
                grant_type: 'authorization_code',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: code,
                redirect_uri: redirectUri
            };
            break;
            
        case 'smart-fhir':
            tokenRequestData = {
                grant_type: 'authorization_code',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: code,
                redirect_uri: redirectUri
            };
            break;
            
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
    
    const response = await axios.post(config.tokenUrl, new URLSearchParams(tokenRequestData), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        }
    });
    
    return response.data;
}

async function getUserInfo(provider, accessToken, config) {
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
    };
    // Apple has no userinfo endpoint; decode id_token instead
    if (provider === 'apple') {
        try {
            const decoded = jwt.decode(accessToken) || {};
            return {
                id: decoded.sub,
                email: decoded.email,
                email_verified: decoded.email_verified,
                name: decoded.name || decoded.given_name || decoded.family_name ? `${decoded.given_name || ''} ${decoded.family_name || ''}`.trim() : undefined,
                given_name: decoded.given_name,
                family_name: decoded.family_name,
                provider: 'apple'
            };
        } catch (e) {
            throw new Error('Failed to parse Apple ID token');
        }
    }

    const response = await axios.get(config.userInfoUrl, { headers });

    // Normalize user info based on provider
    switch (provider) {
        case 'keycloak':
            return {
                id: response.data.sub,
                email: response.data.email,
                name: response.data.name,
                given_name: response.data.given_name,
                family_name: response.data.family_name,
                provider: 'keycloak'
            };
            
        case 'microsoft':
            return {
                id: response.data.id,
                email: response.data.mail || response.data.userPrincipalName,
                name: response.data.displayName,
                given_name: response.data.givenName,
                family_name: response.data.surname,
                provider: 'microsoft'
            };
        case 'google':
            return {
                id: response.data.sub,
                email: response.data.email,
                name: response.data.name,
                given_name: response.data.given_name,
                family_name: response.data.family_name,
                provider: 'google',
                email_verified: response.data.email_verified
            };
        case 'apple':
            // handled above
            break;
            
        case 'smart-fhir':
            // SMART on FHIR returns FHIR Practitioner resource
            const practitioner = response.data;
            return {
                id: practitioner.id,
                email: practitioner.telecom?.find(t => t.system === 'email')?.value,
                name: practitioner.name?.[0] ? 
                    `${practitioner.name[0].given?.join(' ') || ''} ${practitioner.name[0].family || ''}`.trim() : 
                    'Unknown Practitioner',
                given_name: practitioner.name?.[0]?.given?.join(' '),
                family_name: practitioner.name?.[0]?.family,
                npi: practitioner.identifier?.find(i => i.system === 'http://hl7.org/fhir/sid/us-npi')?.value,
                provider: 'smart-fhir'
            };
            
        default:
            return response.data;
    }
}

module.exports = router;