/**
 * Simple test to verify EHR integrations imports work
 */

import { OpenEMRIntegration } from '../openemr';

describe('EHR Integrations Structure', () => {
  test('should export OpenEMR integration', () => {
    expect(OpenEMRIntegration).toBeDefined();
    expect(typeof OpenEMRIntegration).toBe('function');
  });

  test('should create OpenEMR integration instance', () => {
    const config = {
      baseUrl: 'https://test.example.com',
      apiVersion: '7.0.2',
      oauth: {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.example.com/callback',
        scopes: ['openid']
      }
    };

    const integration = new OpenEMRIntegration(config);
    expect(integration).toBeInstanceOf(OpenEMRIntegration);
  });
});