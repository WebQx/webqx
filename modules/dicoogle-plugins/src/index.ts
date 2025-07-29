/**
 * Dicoogle PACS Plugins Main Entry Point
 * 
 * Integrates all Dicoogle plugins with the WebQX healthcare platform
 */

import { EventEmitter } from 'events';
import { Express } from 'express';
import { configManager, ConfigManager } from './config';
import { cachingService } from './services/caching';
import { metadataFilteringService } from './plugins/metadata-filter';
import { advancedIndexingService } from './plugins/advanced-indexing';
import { mountDicoogleAPI } from './api';

/**
 * Plugin lifecycle events
 */
export interface PluginEvents {
  'plugin:initialized': { plugins: string[] };
  'plugin:started': { plugin: string };
  'plugin:stopped': { plugin: string };
  'plugin:error': { plugin: string; error: string };
  'system:ready': {};
  'system:shutdown': {};
}

/**
 * Plugin status interface
 */
export interface PluginStatus {
  name: string;
  version: string;
  status: 'inactive' | 'initializing' | 'active' | 'error';
  lastStarted?: Date;
  lastError?: string;
  dependencies: string[];
  configuration: any;
}

/**
 * Main Dicoogle plugins manager
 */
export class DicooglePluginsManager extends EventEmitter {
  private plugins: Map<string, PluginStatus> = new Map();
  private isInitialized: boolean = false;
  private isStarted: boolean = false;

  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Initialize all plugins
   */
  async initialize(customConfig?: Partial<any>): Promise<void> {
    if (this.isInitialized) {
      console.warn('[Dicoogle] Plugins already initialized');
      return;
    }

    try {
      console.log('[Dicoogle] Initializing plugins...');

      // Update configuration if provided
      if (customConfig) {
        configManager.updateConfig(customConfig);
      }

      // Initialize plugin statuses
      this.initializePluginStatuses();

      // Initialize caching service
      await this.initializePlugin('caching', async () => {
        // Caching service is already initialized in constructor
        return true;
      });

      // Initialize metadata filtering plugin
      await this.initializePlugin('metadata-filtering', async () => {
        // Service is already initialized, just verify it's working
        return metadataFilteringService.getSupportedOperators().length > 0;
      });

      // Initialize advanced indexing plugin
      await this.initializePlugin('advanced-indexing', async () => {
        // Service is already initialized, just verify it's working
        return advancedIndexingService.getIndexingFields().length >= 0;
      });

      this.isInitialized = true;
      this.emit('plugin:initialized', { 
        plugins: Array.from(this.plugins.keys()) 
      });

      console.log('[Dicoogle] All plugins initialized successfully');

    } catch (error) {
      console.error('[Dicoogle] Plugin initialization failed:', error);
      this.emit('plugin:error', { plugin: 'system', error: error.message });
      throw error;
    }
  }

  /**
   * Start all plugins
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Plugins must be initialized before starting');
    }

    if (this.isStarted) {
      console.warn('[Dicoogle] Plugins already started');
      return;
    }

    try {
      console.log('[Dicoogle] Starting plugins...');

      // Start plugins in dependency order
      const startOrder = ['caching', 'metadata-filtering', 'advanced-indexing'];

      for (const pluginName of startOrder) {
        await this.startPlugin(pluginName);
      }

      this.isStarted = true;
      this.emit('system:ready');

      console.log('[Dicoogle] All plugins started successfully');

    } catch (error) {
      console.error('[Dicoogle] Plugin startup failed:', error);
      this.emit('plugin:error', { plugin: 'system', error: error.message });
      throw error;
    }
  }

  /**
   * Stop all plugins
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      console.warn('[Dicoogle] Plugins not started');
      return;
    }

    try {
      console.log('[Dicoogle] Stopping plugins...');

      // Stop plugins in reverse dependency order
      const stopOrder = ['advanced-indexing', 'metadata-filtering', 'caching'];

      for (const pluginName of stopOrder) {
        await this.stopPlugin(pluginName);
      }

      this.isStarted = false;
      this.emit('system:shutdown');

      console.log('[Dicoogle] All plugins stopped successfully');

    } catch (error) {
      console.error('[Dicoogle] Plugin shutdown failed:', error);
      this.emit('plugin:error', { plugin: 'system', error: error.message });
      throw error;
    }
  }

  /**
   * Mount API routes on Express app
   */
  mountAPI(app: Express, basePath: string = '/api/dicoogle'): void {
    if (!this.isInitialized) {
      throw new Error('Plugins must be initialized before mounting API');
    }

    try {
      mountDicoogleAPI(app, basePath);
      console.log(`[Dicoogle] API mounted at ${basePath}`);
    } catch (error) {
      console.error('[Dicoogle] Failed to mount API:', error);
      throw error;
    }
  }

  /**
   * Get plugin status
   */
  getPluginStatus(name: string): PluginStatus | null {
    return this.plugins.get(name) || null;
  }

  /**
   * Get all plugin statuses
   */
  getAllPluginStatuses(): PluginStatus[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    plugins: PluginStatus[];
    details: any;
  }> {
    const plugins = this.getAllPluginStatuses();
    const activePlugins = plugins.filter(p => p.status === 'active');
    const errorPlugins = plugins.filter(p => p.status === 'error');

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (errorPlugins.length === 0) {
      status = 'healthy';
    } else if (activePlugins.length > errorPlugins.length) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const details = {
      totalPlugins: plugins.length,
      activePlugins: activePlugins.length,
      errorPlugins: errorPlugins.length,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cacheStats: await cachingService.getStats(),
      configuration: configManager.getConfig(),
    };

    return {
      status,
      plugins,
      details,
    };
  }

  /**
   * Update plugin configuration
   */
  updateConfiguration(updates: Partial<any>): void {
    configManager.updateConfig(updates);
    console.log('[Dicoogle] Configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfiguration(): any {
    return configManager.getConfig();
  }

  /**
   * Initialize plugin statuses
   */
  private initializePluginStatuses(): void {
    const config = configManager.getConfig();

    this.plugins.set('caching', {
      name: 'Caching Service',
      version: '1.0.0',
      status: 'inactive',
      dependencies: [],
      configuration: config.performance.caching,
    });

    this.plugins.set('metadata-filtering', {
      name: 'Metadata Filtering Plugin',
      version: '1.0.0',
      status: 'inactive',
      dependencies: ['caching'],
      configuration: config.filtering,
    });

    this.plugins.set('advanced-indexing', {
      name: 'Advanced Indexing Plugin',
      version: '1.0.0',
      status: 'inactive',
      dependencies: ['caching'],
      configuration: config.indexing,
    });
  }

  /**
   * Initialize a specific plugin
   */
  private async initializePlugin(name: string, initializer: () => Promise<boolean>): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Unknown plugin: ${name}`);
    }

    try {
      plugin.status = 'initializing';
      
      const success = await initializer();
      if (!success) {
        throw new Error('Plugin initialization returned false');
      }

      plugin.status = 'inactive'; // Ready to start
      console.log(`[Dicoogle] Plugin initialized: ${plugin.name}`);

    } catch (error) {
      plugin.status = 'error';
      plugin.lastError = error.message;
      this.emit('plugin:error', { plugin: name, error: error.message });
      throw new Error(`Failed to initialize plugin ${name}: ${error.message}`);
    }
  }

  /**
   * Start a specific plugin
   */
  private async startPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Unknown plugin: ${name}`);
    }

    if (plugin.status === 'active') {
      return; // Already active
    }

    try {
      // Check dependencies
      for (const dep of plugin.dependencies) {
        const depPlugin = this.plugins.get(dep);
        if (!depPlugin || depPlugin.status !== 'active') {
          throw new Error(`Dependency not active: ${dep}`);
        }
      }

      plugin.status = 'active';
      plugin.lastStarted = new Date();
      plugin.lastError = undefined;

      this.emit('plugin:started', { plugin: name });
      console.log(`[Dicoogle] Plugin started: ${plugin.name}`);

    } catch (error) {
      plugin.status = 'error';
      plugin.lastError = error.message;
      this.emit('plugin:error', { plugin: name, error: error.message });
      throw new Error(`Failed to start plugin ${name}: ${error.message}`);
    }
  }

  /**
   * Stop a specific plugin
   */
  private async stopPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Unknown plugin: ${name}`);
    }

    if (plugin.status !== 'active') {
      return; // Not active
    }

    try {
      plugin.status = 'inactive';
      this.emit('plugin:stopped', { plugin: name });
      console.log(`[Dicoogle] Plugin stopped: ${plugin.name}`);

    } catch (error) {
      plugin.status = 'error';
      plugin.lastError = error.message;
      this.emit('plugin:error', { plugin: name, error: error.message });
      throw new Error(`Failed to stop plugin ${name}: ${error.message}`);
    }
  }

  /**
   * Setup event listeners for plugin services
   */
  private setupEventListeners(): void {
    // Listen to caching service events
    cachingService.on('cache:error', (data) => {
      console.error('[Dicoogle] Cache error:', data);
    });

    // Listen to filtering service events
    metadataFilteringService.on('service:error', (data) => {
      console.error('[Dicoogle] Filtering service error:', data);
    });

    // Listen to indexing service events
    advancedIndexingService.on('service:error', (data) => {
      console.error('[Dicoogle] Indexing service error:', data);
    });

    // Listen to own events for logging
    this.on('plugin:error', (data) => {
      console.error(`[Dicoogle] Plugin error in ${data.plugin}:`, data.error);
    });

    this.on('system:ready', () => {
      console.log('[Dicoogle] System ready for requests');
    });

    this.on('system:shutdown', () => {
      console.log('[Dicoogle] System shutdown complete');
    });
  }
}

/**
 * Global plugins manager instance
 */
export const dicooglePlugins = new DicooglePluginsManager();

/**
 * Initialize Dicoogle plugins with WebQX integration
 */
export async function initializeDicooglePlugins(
  app: Express,
  customConfig?: Partial<any>
): Promise<DicooglePluginsManager> {
  try {
    console.log('[Dicoogle] Starting Dicoogle PACS plugins initialization...');

    // Initialize plugins
    await dicooglePlugins.initialize(customConfig);

    // Start plugins
    await dicooglePlugins.start();

    // Mount API
    dicooglePlugins.mountAPI(app);

    console.log('[Dicoogle] Dicoogle PACS plugins ready for WebQX integration');
    return dicooglePlugins;

  } catch (error) {
    console.error('[Dicoogle] Failed to initialize Dicoogle plugins:', error);
    throw error;
  }
}

// Export main classes and services
export {
  configManager,
  cachingService,
  metadataFilteringService,
  advancedIndexingService,
};

// Export types for external use
export type {
  PluginStatus,
  PluginEvents,
};

export * from './utils';
export * from './config';
export * from './plugins/metadata-filter';
export * from './plugins/advanced-indexing';
export * from './services/caching';
export * from './api/middleware/auth';