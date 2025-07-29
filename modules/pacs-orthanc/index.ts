/**
 * WebQX™ Orthanc PACS Integration - Main Module Export
 * Exports all PACS integration services and utilities
 */

// Main integration service
export { PACSIntegrationService } from './services/pacsIntegrationService';

// Individual plugin services
export { CloudStoragePlugin } from './services/cloudStoragePlugin';
export { IndexingPlugin } from './services/indexingPlugin';
export { RBACPlugin, WebQXAccessProvider } from './services/rbacPlugin';
export { MultilingualPlugin } from './services/multilingualPlugin';
export { ImageViewingPlugin } from './services/imageViewingPlugin';

// Utilities
export { OrthancClient } from './utils/orthancClient';

// Configuration
export * from './config';

// Types
export * from './types';

// Default configuration factory
import {
  defaultOrthancConfig,
  defaultCloudStorageConfig,
  defaultRBACConfig,
  defaultMultilingualConfig,
  defaultImageViewingConfig,
  defaultPluginConfig,
  databaseConfig,
  cacheConfig,
  loggingConfig
} from './config';

export interface PACSIntegrationConfig {
  orthanc: typeof defaultOrthancConfig;
  cloudStorage?: typeof defaultCloudStorageConfig;
  rbac?: typeof defaultRBACConfig;
  multilingual?: typeof defaultMultilingualConfig;
  imageViewing?: typeof defaultImageViewingConfig;
  plugins: typeof defaultPluginConfig;
  database?: {
    type: 'postgresql' | 'mongodb';
    config: typeof databaseConfig.postgresql | typeof databaseConfig.mongodb;
  };
  cache?: typeof cacheConfig;
  logging?: typeof loggingConfig;
  webqx?: {
    apiUrl: string;
    apiKey: string;
  };
}

/**
 * Create a PACS integration configuration with defaults
 */
export function createPACSConfig(overrides: Partial<PACSIntegrationConfig> = {}): PACSIntegrationConfig {
  return {
    orthanc: { ...defaultOrthancConfig, ...overrides.orthanc },
    cloudStorage: overrides.cloudStorage ? { ...defaultCloudStorageConfig, ...overrides.cloudStorage } : undefined,
    rbac: overrides.rbac ? { ...defaultRBACConfig, ...overrides.rbac } : undefined,
    multilingual: overrides.multilingual ? { ...defaultMultilingualConfig, ...overrides.multilingual } : undefined,
    imageViewing: overrides.imageViewing ? { ...defaultImageViewingConfig, ...overrides.imageViewing } : undefined,
    plugins: { ...defaultPluginConfig, ...overrides.plugins },
    database: overrides.database,
    cache: overrides.cache ? { ...cacheConfig, ...overrides.cache } : undefined,
    logging: overrides.logging ? { ...loggingConfig, ...overrides.logging } : undefined,
    webqx: overrides.webqx
  };
}

/**
 * Create and initialize a PACS integration service
 */
export async function createPACSIntegration(config: PACSIntegrationConfig): Promise<PACSIntegrationService> {
  const service = new PACSIntegrationService(config);
  await service.initialize();
  return service;
}