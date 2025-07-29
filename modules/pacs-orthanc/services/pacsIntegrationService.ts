/**
 * WebQX™ Orthanc PACS Integration - Main Integration Service
 * Coordinates all PACS plugins and provides unified API
 */

import { EventEmitter } from 'events';
import {
  DicomEvent,
  PluginConfig,
  HealthStatus,
  SearchQuery,
  SearchResult,
  UserContext,
  ActionType,
  ResourceType,
  CloudStorageConfig,
  RBACConfig,
  MultilingualConfig,
  ImageViewingConfig,
  OrthancConfig
} from '../types';
import { OrthancClient } from '../utils/orthancClient';
import { CloudStoragePlugin } from './cloudStoragePlugin';
import { IndexingPlugin } from './indexingPlugin';
import { RBACPlugin, WebQXAccessProvider } from './rbacPlugin';
import { MultilingualPlugin } from './multilingualPlugin';
import { ImageViewingPlugin } from './imageViewingPlugin';

export class PACSIntegrationService extends EventEmitter {
  private orthancClient: OrthancClient;
  private cloudStoragePlugin?: CloudStoragePlugin;
  private indexingPlugin?: IndexingPlugin;
  private rbacPlugin?: RBACPlugin;
  private multilingualPlugin?: MultilingualPlugin;
  private imageViewingPlugin?: ImageViewingPlugin;
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    private config: {
      orthanc: OrthancConfig;
      cloudStorage?: CloudStorageConfig;
      rbac?: RBACConfig;
      multilingual?: MultilingualConfig;
      imageViewing?: ImageViewingConfig;
      plugins: PluginConfig;
      database?: {
        type: 'postgresql' | 'mongodb';
        config: any;
      };
      webqx?: {
        apiUrl: string;
        apiKey: string;
      };
    }
  ) {
    super();
    this.orthancClient = new OrthancClient(config.orthanc);
  }

  /**
   * Initialize the PACS integration service
   */
  async initialize(): Promise<void> {
    try {
      console.log('[PACS Integration] Starting initialization...');

      // Initialize Orthanc client
      const orthancHealth = await this.orthancClient.healthCheck();
      if (!orthancHealth) {
        throw new Error('Cannot connect to Orthanc server');
      }

      // Initialize plugins based on configuration
      await this.initializePlugins();

      // Set up event routing
      this.setupEventRouting();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      this.emit('initialized');

      console.log('[PACS Integration] Successfully initialized');
    } catch (error) {
      this.emit('error', {
        code: 'INTEGRATION_INITIALIZATION_FAILED',
        message: 'Failed to initialize PACS integration service',
        details: error,
        timestamp: new Date(),
        pluginName: 'PACSIntegrationService',
        severity: 'critical'
      });
      throw error;
    }
  }

  /**
   * Get overall health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    if (!this.isInitialized) {
      return {
        status: 'unhealthy',
        message: 'Service not initialized',
        timestamp: new Date(),
        version: '1.0.0'
      };
    }

    try {
      // Check all plugin health statuses
      const healthChecks = await Promise.all([
        this.orthancClient.healthCheck(),
        this.cloudStoragePlugin?.getHealthStatus(),
        this.indexingPlugin?.getHealthStatus(),
        this.rbacPlugin?.getHealthStatus(),
        this.multilingualPlugin?.getHealthStatus(),
        this.imageViewingPlugin?.getHealthStatus()
      ]);

      const orthancHealth = healthChecks[0];
      const pluginHealths = healthChecks.slice(1).filter(h => h !== undefined) as HealthStatus[];

      // Determine overall status
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const issues: string[] = [];

      if (!orthancHealth) {
        overallStatus = 'unhealthy';
        issues.push('Orthanc server not accessible');
      }

      for (const health of pluginHealths) {
        if (health.status === 'unhealthy') {
          overallStatus = 'unhealthy';
          issues.push(`${health.message}`);
        } else if (health.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
          issues.push(`${health.message}`);
        }
      }

      return {
        status: overallStatus,
        message: issues.length > 0 ? issues.join('; ') : 'All systems operational',
        details: {
          orthancHealth,
          plugins: pluginHealths.length,
          pluginDetails: pluginHealths
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Health check failed',
        details: error,
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  }

  /**
   * Authentication and authorization
   */
  async authenticateUser(token: string, ipAddress?: string, userAgent?: string): Promise<UserContext> {
    if (!this.rbacPlugin) {
      throw new Error('RBAC plugin not enabled');
    }
    return this.rbacPlugin.authenticateUser(token, ipAddress, userAgent);
  }

  async checkPermission(
    sessionId: string,
    resource: ResourceType,
    action: ActionType,
    resourceId?: string,
    metadata?: any
  ): Promise<boolean> {
    if (!this.rbacPlugin) {
      return true; // Allow all access if RBAC is not enabled
    }
    return this.rbacPlugin.checkPermission(sessionId, resource, action, resourceId, metadata);
  }

  async logoutUser(sessionId: string): Promise<void> {
    if (this.rbacPlugin) {
      await this.rbacPlugin.logoutUser(sessionId);
    }
  }

  /**
   * Search and indexing
   */
  async searchStudies(query: SearchQuery, sessionId?: string): Promise<SearchResult> {
    // Check permissions
    if (sessionId && !await this.checkPermission(sessionId, 'study', 'read')) {
      throw new Error('Access denied');
    }

    if (!this.indexingPlugin) {
      throw new Error('Indexing plugin not enabled');
    }

    return this.indexingPlugin.searchStudies(query);
  }

  async getSearchSuggestions(field: string, partialValue: string, limit = 10, sessionId?: string): Promise<string[]> {
    if (sessionId && !await this.checkPermission(sessionId, 'study', 'read')) {
      throw new Error('Access denied');
    }

    if (!this.indexingPlugin) {
      return [];
    }

    return this.indexingPlugin.getSearchSuggestions(field, partialValue, limit);
  }

  /**
   * Multilingual support
   */
  async getLocalizedStudyMetadata(studyId: string, sessionId?: string): Promise<any> {
    // Check permissions
    if (sessionId && !await this.checkPermission(sessionId, 'study', 'read', studyId)) {
      throw new Error('Access denied');
    }

    if (!this.multilingualPlugin) {
      // Fall back to Orthanc direct access
      return this.orthancClient.getStudyTags(studyId);
    }

    const userContext = sessionId ? this.rbacPlugin?.getUserContext(sessionId) : null;
    return this.multilingualPlugin.getLocalizedStudyMetadata(studyId, userContext?.userId);
  }

  async setUserLanguagePreference(preference: any, sessionId: string): Promise<void> {
    const userContext = this.rbacPlugin?.getUserContext(sessionId);
    if (!userContext) {
      throw new Error('Invalid session');
    }

    if (!this.multilingualPlugin) {
      throw new Error('Multilingual plugin not enabled');
    }

    preference.userId = userContext.userId;
    await this.multilingualPlugin.setUserLanguagePreference(preference);
  }

  /**
   * Image viewing
   */
  async getImagePreview(instanceId: string, sessionId?: string, requestedSizes?: number[]): Promise<any> {
    // Check permissions
    if (sessionId && !await this.checkPermission(sessionId, 'instance', 'read', instanceId)) {
      throw new Error('Access denied');
    }

    if (!this.imageViewingPlugin) {
      // Fall back to Orthanc direct access
      return this.orthancClient.getInstancePreview(instanceId);
    }

    const userContext = sessionId ? this.rbacPlugin?.getUserContext(sessionId) : null;
    return this.imageViewingPlugin.getImagePreview(instanceId, requestedSizes, 'jpeg', userContext?.userId);
  }

  async getImageDownloadUrl(instanceId: string, sessionId: string, format = 'jpeg'): Promise<string> {
    // Check permissions
    if (!await this.checkPermission(sessionId, 'instance', 'download', instanceId)) {
      throw new Error('Download access denied');
    }

    if (!this.imageViewingPlugin) {
      throw new Error('Image viewing plugin not enabled');
    }

    const userContext = this.rbacPlugin?.getUserContext(sessionId);
    return this.imageViewingPlugin.getDownloadUrl(instanceId, format, userContext?.userId);
  }

  /**
   * Cloud storage
   */
  async storeStudy(studyId: string, sessionId?: string): Promise<any> {
    // Check permissions
    if (sessionId && !await this.checkPermission(sessionId, 'study', 'write', studyId)) {
      throw new Error('Access denied');
    }

    if (!this.cloudStoragePlugin) {
      throw new Error('Cloud storage plugin not enabled');
    }

    return this.cloudStoragePlugin.storeStudy(studyId);
  }

  async retrieveStudy(studyId: string, sessionId?: string): Promise<any> {
    // Check permissions
    if (sessionId && !await this.checkPermission(sessionId, 'study', 'read', studyId)) {
      throw new Error('Access denied');
    }

    if (!this.cloudStoragePlugin) {
      throw new Error('Cloud storage plugin not enabled');
    }

    // Implementation would retrieve study from cloud storage
    throw new Error('Not implemented');
  }

  /**
   * Administrative functions
   */
  async reindexAllStudies(sessionId: string): Promise<void> {
    // Check admin permissions
    if (!await this.checkPermission(sessionId, 'system', 'admin')) {
      throw new Error('Admin access required');
    }

    if (!this.indexingPlugin) {
      throw new Error('Indexing plugin not enabled');
    }

    await this.indexingPlugin.reindexAll();
  }

  async getServiceStats(sessionId: string): Promise<any> {
    // Check admin permissions
    if (!await this.checkPermission(sessionId, 'system', 'admin')) {
      throw new Error('Admin access required');
    }

    const stats = {
      initialized: this.isInitialized,
      uptime: process.uptime(),
      plugins: {
        cloudStorage: !!this.cloudStoragePlugin,
        indexing: !!this.indexingPlugin,
        rbac: !!this.rbacPlugin,
        multilingual: !!this.multilingualPlugin,
        imageViewing: !!this.imageViewingPlugin
      },
      indexingStats: this.indexingPlugin ? await this.indexingPlugin.getIndexingStats() : null,
      cacheStats: this.imageViewingPlugin ? this.imageViewingPlugin.getCacheStats() : null,
      healthStatus: await this.getHealthStatus()
    };

    return stats;
  }

  /**
   * Event handling
   */
  async handleDicomEvent(event: DicomEvent): Promise<void> {
    try {
      // Route event to all relevant plugins
      const promises: Promise<void>[] = [];

      if (this.cloudStoragePlugin) {
        promises.push(this.cloudStoragePlugin.handleDicomEvent(event));
      }

      if (this.indexingPlugin) {
        promises.push(this.indexingPlugin.handleDicomEvent(event));
      }

      await Promise.all(promises);

      this.emit('dicom_event_processed', event);
    } catch (error) {
      this.emit('error', {
        code: 'EVENT_PROCESSING_FAILED',
        message: 'Failed to process DICOM event',
        details: { event, error },
        timestamp: new Date(),
        pluginName: 'PACSIntegrationService',
        severity: 'medium'
      });
      throw error;
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    try {
      console.log('[PACS Integration] Shutting down...');

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Shutdown plugins (if they have shutdown methods)
      // This would be implemented in the actual plugins

      this.isInitialized = false;
      this.emit('shutdown');

      console.log('[PACS Integration] Shutdown complete');
    } catch (error) {
      console.error('[PACS Integration] Error during shutdown:', error);
      throw error;
    }
  }

  private async initializePlugins(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    // Initialize Cloud Storage Plugin
    if (this.config.cloudStorage) {
      this.cloudStoragePlugin = new CloudStoragePlugin(
        this.config.cloudStorage,
        this.config.plugins,
        this.orthancClient
      );
      initPromises.push(this.cloudStoragePlugin.initialize());
    }

    // Initialize Indexing Plugin
    if (this.config.database) {
      this.indexingPlugin = new IndexingPlugin(
        this.config.database.type,
        this.config.database.config,
        this.config.plugins,
        this.orthancClient
      );
      initPromises.push(this.indexingPlugin.initialize());
    }

    // Initialize RBAC Plugin
    if (this.config.rbac) {
      const accessProvider = this.config.webqx 
        ? new WebQXAccessProvider(this.config.webqx.apiUrl, this.config.webqx.apiKey)
        : new WebQXAccessProvider('http://localhost:3000', 'default-key');
      
      this.rbacPlugin = new RBACPlugin(
        this.config.rbac,
        this.config.plugins,
        this.orthancClient,
        accessProvider
      );
      initPromises.push(this.rbacPlugin.initialize());
    }

    // Initialize Multilingual Plugin
    if (this.config.multilingual) {
      this.multilingualPlugin = new MultilingualPlugin(
        this.config.multilingual,
        this.config.plugins,
        this.orthancClient
      );
      initPromises.push(this.multilingualPlugin.initialize());
    }

    // Initialize Image Viewing Plugin
    if (this.config.imageViewing) {
      this.imageViewingPlugin = new ImageViewingPlugin(
        this.config.imageViewing,
        this.config.plugins,
        this.orthancClient
      );
      initPromises.push(this.imageViewingPlugin.initialize());
    }

    // Wait for all plugins to initialize
    await Promise.all(initPromises);
  }

  private setupEventRouting(): void {
    // Route events from plugins to integration service
    const plugins = [
      this.cloudStoragePlugin,
      this.indexingPlugin,
      this.rbacPlugin,
      this.multilingualPlugin,
      this.imageViewingPlugin
    ].filter(plugin => plugin !== undefined);

    for (const plugin of plugins) {
      plugin!.on('error', (error) => {
        this.emit('plugin_error', error);
      });

      plugin!.on('initialized', () => {
        this.emit('plugin_initialized', { pluginName: plugin!.constructor.name });
      });
    }

    // Monitor Orthanc for changes
    this.startOrthancMonitoring();
  }

  private startOrthancMonitoring(): void {
    // Poll Orthanc changes every 30 seconds
    setInterval(async () => {
      try {
        const changesResponse = await this.orthancClient.getChanges();
        if (changesResponse.success && changesResponse.data) {
          // Process changes and emit events
          // This would need to track the last change sequence number
          // and only process new changes
        }
      } catch (error) {
        console.error('[PACS Integration] Error monitoring Orthanc changes:', error);
      }
    }, 30000);
  }

  private startHealthMonitoring(): void {
    // Check health every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        if (health.status !== 'healthy') {
          this.emit('health_degraded', health);
        }
      } catch (error) {
        console.error('[PACS Integration] Health check failed:', error);
      }
    }, 5 * 60 * 1000);
  }
}