/**
 * Dicoogle Plugin Configuration
 * 
 * Centralized configuration management for Dicoogle PACS plugins
 * Integrates with WebQX configuration system and environment variables
 */

export interface DicoogleConfig {
  server: {
    host: string;
    port: number;
    protocol: 'http' | 'https';
    apiPath: string;
    timeout: number;
  };
  auth: {
    enabled: boolean;
    provider: 'webqx' | 'basic' | 'oauth2';
    webqxAuthEndpoint?: string;
    secretKey?: string;
  };
  indexing: {
    enabled: boolean;
    maxConcurrentIndexing: number;
    batchSize: number;
    indexPath: string;
    customFields: string[];
    preprocessingEnabled: boolean;
  };
  filtering: {
    enabled: boolean;
    maxResultsPerQuery: number;
    cacheEnabled: boolean;
    cacheTimeoutMs: number;
    allowedOperators: string[];
  };
  performance: {
    caching: {
      enabled: boolean;
      provider: 'memory' | 'redis';
      maxMemoryMB: number;
      ttlSeconds: number;
      redisConfig?: {
        host: string;
        port: number;
        password?: string;
        db: number;
      };
    };
    optimization: {
      enableQueryOptimization: boolean;
      enableResultPagination: boolean;
      maxConcurrentQueries: number;
      queryTimeoutMs: number;
    };
  };
  security: {
    enableAuditLogging: boolean;
    enableRoleBasedAccess: boolean;
    allowedRoles: string[];
    encryptionEnabled: boolean;
    rateLimiting: {
      enabled: boolean;
      windowMs: number;
      maxRequests: number;
    };
  };
  integration: {
    webqxApiEndpoint: string;
    userManagementEndpoint: string;
    authValidationEndpoint: string;
    webhookEndpoints: string[];
  };
}

/**
 * Default configuration for Dicoogle plugins
 */
export const defaultConfig: DicoogleConfig = {
  server: {
    host: process.env.DICOOGLE_HOST || 'localhost',
    port: parseInt(process.env.DICOOGLE_PORT || '8080', 10),
    protocol: (process.env.DICOOGLE_PROTOCOL as 'http' | 'https') || 'http',
    apiPath: '/api/v1',
    timeout: 30000,
  },
  auth: {
    enabled: process.env.DICOOGLE_AUTH_ENABLED === 'true',
    provider: (process.env.DICOOGLE_AUTH_PROVIDER as 'webqx' | 'basic' | 'oauth2') || 'webqx',
    webqxAuthEndpoint: process.env.WEBQX_AUTH_ENDPOINT,
    secretKey: process.env.DICOOGLE_SECRET_KEY,
  },
  indexing: {
    enabled: process.env.DICOOGLE_INDEXING_ENABLED !== 'false',
    maxConcurrentIndexing: parseInt(process.env.DICOOGLE_MAX_CONCURRENT_INDEXING || '3', 10),
    batchSize: parseInt(process.env.DICOOGLE_BATCH_SIZE || '100', 10),
    indexPath: process.env.DICOOGLE_INDEX_PATH || './data/index',
    customFields: (process.env.DICOOGLE_CUSTOM_FIELDS || '').split(',').filter(Boolean),
    preprocessingEnabled: process.env.DICOOGLE_PREPROCESSING_ENABLED === 'true',
  },
  filtering: {
    enabled: process.env.DICOOGLE_FILTERING_ENABLED !== 'false',
    maxResultsPerQuery: parseInt(process.env.DICOOGLE_MAX_RESULTS || '1000', 10),
    cacheEnabled: process.env.DICOOGLE_CACHE_ENABLED === 'true',
    cacheTimeoutMs: parseInt(process.env.DICOOGLE_CACHE_TIMEOUT || '300000', 10),
    allowedOperators: ['AND', 'OR', 'NOT', 'EQUALS', 'CONTAINS', 'RANGE', 'EXISTS'],
  },
  performance: {
    caching: {
      enabled: process.env.DICOOGLE_CACHE_ENABLED === 'true',
      provider: (process.env.DICOOGLE_CACHE_PROVIDER as 'memory' | 'redis') || 'memory',
      maxMemoryMB: parseInt(process.env.DICOOGLE_CACHE_MAX_MEMORY || '256', 10),
      ttlSeconds: parseInt(process.env.DICOOGLE_CACHE_TTL || '3600', 10),
      redisConfig: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
      },
    },
    optimization: {
      enableQueryOptimization: process.env.DICOOGLE_QUERY_OPTIMIZATION === 'true',
      enableResultPagination: process.env.DICOOGLE_RESULT_PAGINATION === 'true',
      maxConcurrentQueries: parseInt(process.env.DICOOGLE_MAX_CONCURRENT_QUERIES || '10', 10),
      queryTimeoutMs: parseInt(process.env.DICOOGLE_QUERY_TIMEOUT || '60000', 10),
    },
  },
  security: {
    enableAuditLogging: process.env.DICOOGLE_AUDIT_LOGGING === 'true',
    enableRoleBasedAccess: process.env.DICOOGLE_RBAC_ENABLED === 'true',
    allowedRoles: (process.env.DICOOGLE_ALLOWED_ROLES || 'provider,admin,radiologist').split(','),
    encryptionEnabled: process.env.DICOOGLE_ENCRYPTION_ENABLED === 'true',
    rateLimiting: {
      enabled: process.env.DICOOGLE_RATE_LIMITING === 'true',
      windowMs: parseInt(process.env.DICOOGLE_RATE_WINDOW || '900000', 10), // 15 minutes
      maxRequests: parseInt(process.env.DICOOGLE_RATE_MAX_REQUESTS || '100', 10),
    },
  },
  integration: {
    webqxApiEndpoint: process.env.WEBQX_API_ENDPOINT || 'http://localhost:3000/api',
    userManagementEndpoint: process.env.WEBQX_USER_MGMT_ENDPOINT || '/auth/users',
    authValidationEndpoint: process.env.WEBQX_AUTH_VALIDATION_ENDPOINT || '/auth/validate',
    webhookEndpoints: (process.env.DICOOGLE_WEBHOOK_ENDPOINTS || '').split(',').filter(Boolean),
  },
};

/**
 * Configuration validation and loading
 */
export class ConfigManager {
  private config: DicoogleConfig;

  constructor(customConfig?: Partial<DicoogleConfig>) {
    this.config = this.mergeConfig(defaultConfig, customConfig || {});
    this.validateConfig();
  }

  /**
   * Get the current configuration
   */
  getConfig(): DicoogleConfig {
    return { ...this.config };
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(updates: Partial<DicoogleConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.validateConfig();
  }

  /**
   * Get specific configuration section
   */
  getSection<K extends keyof DicoogleConfig>(section: K): DicoogleConfig[K] {
    return this.config[section];
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(base: DicoogleConfig, override: Partial<DicoogleConfig>): DicoogleConfig {
    const result = { ...base };
    
    Object.keys(override).forEach(key => {
      const typedKey = key as keyof DicoogleConfig;
      if (typeof override[typedKey] === 'object' && !Array.isArray(override[typedKey])) {
        result[typedKey] = {
          ...result[typedKey],
          ...override[typedKey]
        } as any;
      } else {
        result[typedKey] = override[typedKey] as any;
      }
    });

    return result;
  }

  /**
   * Validate configuration for required fields and logical consistency
   */
  private validateConfig(): void {
    const { server, auth, indexing, filtering, performance, security, integration } = this.config;

    // Validate server configuration
    if (!server.host) {
      throw new Error('Server host is required');
    }
    if (server.port < 1 || server.port > 65535) {
      throw new Error('Server port must be between 1 and 65535');
    }

    // Validate auth configuration
    if (auth.enabled && auth.provider === 'webqx' && !auth.webqxAuthEndpoint) {
      throw new Error('WebQX auth endpoint is required when WebQX auth is enabled');
    }

    // Validate indexing configuration
    if (indexing.enabled) {
      if (indexing.maxConcurrentIndexing < 1) {
        throw new Error('Max concurrent indexing must be at least 1');
      }
      if (indexing.batchSize < 1) {
        throw new Error('Batch size must be at least 1');
      }
    }

    // Validate filtering configuration
    if (filtering.enabled && filtering.maxResultsPerQuery < 1) {
      throw new Error('Max results per query must be at least 1');
    }

    // Validate performance configuration
    if (performance.caching.enabled && performance.caching.provider === 'redis') {
      const redisConfig = performance.caching.redisConfig;
      if (!redisConfig?.host) {
        throw new Error('Redis host is required when Redis caching is enabled');
      }
    }

    // Validate security configuration
    if (security.enableRoleBasedAccess && security.allowedRoles.length === 0) {
      throw new Error('At least one role must be allowed when RBAC is enabled');
    }

    // Validate integration endpoints
    if (!integration.webqxApiEndpoint) {
      throw new Error('WebQX API endpoint is required');
    }
  }
}

/**
 * Global configuration instance
 */
export const configManager = new ConfigManager();

/**
 * Helper function to get configuration
 */
export const getConfig = () => configManager.getConfig();