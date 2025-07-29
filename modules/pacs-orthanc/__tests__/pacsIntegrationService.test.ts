/**
 * WebQX™ Orthanc PACS Integration - Integration Service Tests
 */

import { PACSIntegrationService } from '../services/pacsIntegrationService';
import { createPACSConfig } from '../index';

// Mock all plugin dependencies
jest.mock('../services/cloudStoragePlugin');
jest.mock('../services/indexingPlugin');
jest.mock('../services/rbacPlugin');
jest.mock('../services/multilingualPlugin');
jest.mock('../services/imageViewingPlugin');
jest.mock('../utils/orthancClient');

describe('PACSIntegrationService', () => {
  let integrationService: PACSIntegrationService;
  let mockConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = createPACSConfig({
      orthanc: {
        baseUrl: 'http://localhost:8042',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        ssl: { enabled: false, verifySSL: true }
      },
      cloudStorage: {
        provider: 'aws',
        region: 'us-east-1',
        bucketName: 'test-bucket',
        credentials: {
          aws: {
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret'
          }
        },
        retentionPolicy: {
          defaultRetentionDays: 2555,
          modalitySpecificRetention: {},
          archiveAfterDays: 365
        },
        encryptionEnabled: true,
        compressionEnabled: true,
        pathTemplate: '{year}/{month}/{studyId}'
      },
      rbac: {
        enabled: true,
        defaultPermissions: [],
        roleHierarchy: {},
        auditLogging: true,
        sessionTimeout: 28800,
        mfaRequired: false
      },
      multilingual: {
        defaultLanguage: 'en',
        supportedLanguages: ['en', 'es', 'fr'],
        autoDetectLanguage: true,
        translationProvider: 'local',
        cacheTranslations: true,
        translationQuality: 'medium'
      },
      imageViewing: {
        enableThumbnails: true,
        thumbnailSizes: [64, 128, 256],
        maxPreviewSize: 1024,
        imageFormats: ['jpeg', 'png'],
        compressionQuality: 85,
        cacheEnabled: true,
        cacheExpirationHours: 24,
        watermarkEnabled: false,
        allowDownload: true
      },
      database: {
        type: 'postgresql' as const,
        config: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass'
        }
      },
      webqx: {
        apiUrl: 'http://localhost:3000',
        apiKey: 'test-api-key'
      }
    });

    integrationService = new PACSIntegrationService(mockConfig);
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(integrationService).toBeInstanceOf(PACSIntegrationService);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with all plugins', async () => {
      // Mock Orthanc health check
      const { OrthancClient } = require('../utils/orthancClient');
      OrthancClient.prototype.healthCheck = jest.fn().mockResolvedValue(true);

      // Mock plugin initialization
      const mockPluginInit = jest.fn().mockResolvedValue(undefined);
      
      const { CloudStoragePlugin } = require('../services/cloudStoragePlugin');
      CloudStoragePlugin.prototype.initialize = mockPluginInit;
      
      const { IndexingPlugin } = require('../services/indexingPlugin');
      IndexingPlugin.prototype.initialize = mockPluginInit;
      
      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.initialize = mockPluginInit;
      
      const { MultilingualPlugin } = require('../services/multilingualPlugin');
      MultilingualPlugin.prototype.initialize = mockPluginInit;
      
      const { ImageViewingPlugin } = require('../services/imageViewingPlugin');
      ImageViewingPlugin.prototype.initialize = mockPluginInit;

      await integrationService.initialize();

      expect(mockPluginInit).toHaveBeenCalledTimes(5);
    });

    it('should fail if Orthanc is not accessible', async () => {
      const { OrthancClient } = require('../utils/orthancClient');
      OrthancClient.prototype.healthCheck = jest.fn().mockResolvedValue(false);

      await expect(integrationService.initialize()).rejects.toThrow('Cannot connect to Orthanc server');
    });

    it('should handle plugin initialization failure', async () => {
      const { OrthancClient } = require('../utils/orthancClient');
      OrthancClient.prototype.healthCheck = jest.fn().mockResolvedValue(true);

      const { CloudStoragePlugin } = require('../services/cloudStoragePlugin');
      CloudStoragePlugin.prototype.initialize = jest.fn().mockRejectedValue(new Error('Plugin init failed'));

      await expect(integrationService.initialize()).rejects.toThrow('Plugin init failed');
    });
  });

  describe('getHealthStatus', () => {
    beforeEach(async () => {
      // Setup for initialized service
      const { OrthancClient } = require('../utils/orthancClient');
      OrthancClient.prototype.healthCheck = jest.fn().mockResolvedValue(true);

      const mockPluginInit = jest.fn().mockResolvedValue(undefined);
      const mockHealthStatus = {
        status: 'healthy' as const,
        message: 'All systems operational',
        timestamp: new Date(),
        version: '1.0.0'
      };

      const { CloudStoragePlugin } = require('../services/cloudStoragePlugin');
      CloudStoragePlugin.prototype.initialize = mockPluginInit;
      CloudStoragePlugin.prototype.getHealthStatus = jest.fn().mockResolvedValue(mockHealthStatus);

      const { IndexingPlugin } = require('../services/indexingPlugin');
      IndexingPlugin.prototype.initialize = mockPluginInit;
      IndexingPlugin.prototype.getHealthStatus = jest.fn().mockResolvedValue(mockHealthStatus);

      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.initialize = mockPluginInit;
      RBACPlugin.prototype.getHealthStatus = jest.fn().mockResolvedValue(mockHealthStatus);

      const { MultilingualPlugin } = require('../services/multilingualPlugin');
      MultilingualPlugin.prototype.initialize = mockPluginInit;
      MultilingualPlugin.prototype.getHealthStatus = jest.fn().mockResolvedValue(mockHealthStatus);

      const { ImageViewingPlugin } = require('../services/imageViewingPlugin');
      ImageViewingPlugin.prototype.initialize = mockPluginInit;
      ImageViewingPlugin.prototype.getHealthStatus = jest.fn().mockResolvedValue(mockHealthStatus);

      await integrationService.initialize();
    });

    it('should return healthy status when all systems operational', async () => {
      const { OrthancClient } = require('../utils/orthancClient');
      OrthancClient.prototype.healthCheck = jest.fn().mockResolvedValue(true);

      const healthStatus = await integrationService.getHealthStatus();

      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.message).toBe('All systems operational');
      expect(healthStatus.details).toBeDefined();
    });

    it('should return unhealthy when not initialized', async () => {
      const uninitializedService = new PACSIntegrationService(mockConfig);
      const healthStatus = await uninitializedService.getHealthStatus();

      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.message).toBe('Service not initialized');
    });

    it('should return degraded when Orthanc is not accessible', async () => {
      const { OrthancClient } = require('../utils/orthancClient');
      OrthancClient.prototype.healthCheck = jest.fn().mockResolvedValue(false);

      const healthStatus = await integrationService.getHealthStatus();

      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.message).toContain('Orthanc server not accessible');
    });
  });

  describe('authentication and authorization', () => {
    beforeEach(async () => {
      await setupInitializedService();
    });

    it('should authenticate user successfully', async () => {
      const mockUserContext = {
        userId: 'user123',
        username: 'testuser',
        roles: ['radiologist'],
        permissions: [],
        sessionId: 'session123',
        isActive: true,
        lastActivity: new Date(),
        specialties: ['radiology']
      };

      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.authenticateUser = jest.fn().mockResolvedValue(mockUserContext);

      const result = await integrationService.authenticateUser('test-token', '127.0.0.1', 'test-agent');

      expect(result).toEqual(mockUserContext);
      expect(RBACPlugin.prototype.authenticateUser).toHaveBeenCalledWith('test-token', '127.0.0.1', 'test-agent');
    });

    it('should check permissions correctly', async () => {
      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.checkPermission = jest.fn().mockResolvedValue(true);

      const result = await integrationService.checkPermission('session123', 'study', 'read', 'study123');

      expect(result).toBe(true);
      expect(RBACPlugin.prototype.checkPermission).toHaveBeenCalledWith('session123', 'study', 'read', 'study123', undefined);
    });

    it('should allow all access when RBAC is disabled', async () => {
      const configWithoutRBAC = { ...mockConfig };
      delete configWithoutRBAC.rbac;
      
      const serviceWithoutRBAC = new PACSIntegrationService(configWithoutRBAC);
      await serviceWithoutRBAC.initialize();

      const result = await serviceWithoutRBAC.checkPermission('session123', 'study', 'read');
      expect(result).toBe(true);
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      await setupInitializedService();
    });

    it('should search studies successfully', async () => {
      const mockSearchResult = {
        total: 2,
        studies: [],
        executionTimeMs: 100
      };

      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.checkPermission = jest.fn().mockResolvedValue(true);

      const { IndexingPlugin } = require('../services/indexingPlugin');
      IndexingPlugin.prototype.searchStudies = jest.fn().mockResolvedValue(mockSearchResult);

      const query = { patientId: '12345' };
      const result = await integrationService.searchStudies(query, 'session123');

      expect(result).toEqual(mockSearchResult);
      expect(IndexingPlugin.prototype.searchStudies).toHaveBeenCalledWith(query);
    });

    it('should deny search when permission is denied', async () => {
      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.checkPermission = jest.fn().mockResolvedValue(false);

      const query = { patientId: '12345' };
      
      await expect(integrationService.searchStudies(query, 'session123')).rejects.toThrow('Access denied');
    });

    it('should fail when indexing plugin is not enabled', async () => {
      const configWithoutIndexing = { ...mockConfig };
      delete configWithoutIndexing.database;
      
      const serviceWithoutIndexing = new PACSIntegrationService(configWithoutIndexing);
      await serviceWithoutIndexing.initialize();

      const query = { patientId: '12345' };
      
      await expect(serviceWithoutIndexing.searchStudies(query)).rejects.toThrow('Indexing plugin not enabled');
    });
  });

  describe('multilingual support', () => {
    beforeEach(async () => {
      await setupInitializedService();
    });

    it('should get localized study metadata', async () => {
      const mockLocalizedData = {
        PatientName: 'Test Patient',
        StudyDescription: 'CT Scan'
      };

      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.checkPermission = jest.fn().mockResolvedValue(true);
      RBACPlugin.prototype.getUserContext = jest.fn().mockReturnValue({ userId: 'user123' });

      const { MultilingualPlugin } = require('../services/multilingualPlugin');
      MultilingualPlugin.prototype.getLocalizedStudyMetadata = jest.fn().mockResolvedValue(mockLocalizedData);

      const result = await integrationService.getLocalizedStudyMetadata('study123', 'session123');

      expect(result).toEqual(mockLocalizedData);
      expect(MultilingualPlugin.prototype.getLocalizedStudyMetadata).toHaveBeenCalledWith('study123', 'user123');
    });

    it('should fall back to Orthanc when multilingual plugin is disabled', async () => {
      const configWithoutMultilingual = { ...mockConfig };
      delete configWithoutMultilingual.multilingual;
      
      const serviceWithoutMultilingual = new PACSIntegrationService(configWithoutMultilingual);
      
      const { OrthancClient } = require('../utils/orthancClient');
      OrthancClient.prototype.healthCheck = jest.fn().mockResolvedValue(true);
      OrthancClient.prototype.getStudyTags = jest.fn().mockResolvedValue({ success: true, data: {} });

      await serviceWithoutMultilingual.initialize();

      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.checkPermission = jest.fn().mockResolvedValue(true);

      await serviceWithoutMultilingual.getLocalizedStudyMetadata('study123', 'session123');

      expect(OrthancClient.prototype.getStudyTags).toHaveBeenCalledWith('study123');
    });
  });

  describe('image viewing', () => {
    beforeEach(async () => {
      await setupInitializedService();
    });

    it('should get image preview successfully', async () => {
      const mockPreview = {
        instanceId: 'instance123',
        sizes: [{ width: 256, height: 256, url: '/image/256', fileSize: 1024, mimeType: 'image/jpeg' }],
        format: 'jpeg',
        generatedAt: new Date(),
        cacheKey: 'cache123',
        watermarked: false,
        downloadAllowed: true
      };

      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.checkPermission = jest.fn().mockResolvedValue(true);
      RBACPlugin.prototype.getUserContext = jest.fn().mockReturnValue({ userId: 'user123' });

      const { ImageViewingPlugin } = require('../services/imageViewingPlugin');
      ImageViewingPlugin.prototype.getImagePreview = jest.fn().mockResolvedValue(mockPreview);

      const result = await integrationService.getImagePreview('instance123', 'session123', [256]);

      expect(result).toEqual(mockPreview);
      expect(ImageViewingPlugin.prototype.getImagePreview).toHaveBeenCalledWith('instance123', [256], 'jpeg', 'user123');
    });

    it('should get download URL with proper permissions', async () => {
      const mockDownloadUrl = '/api/pacs/images/instance123/download?format=jpeg';

      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.checkPermission = jest.fn().mockResolvedValue(true);
      RBACPlugin.prototype.getUserContext = jest.fn().mockReturnValue({ userId: 'user123' });

      const { ImageViewingPlugin } = require('../services/imageViewingPlugin');
      ImageViewingPlugin.prototype.getDownloadUrl = jest.fn().mockResolvedValue(mockDownloadUrl);

      const result = await integrationService.getImageDownloadUrl('instance123', 'session123');

      expect(result).toBe(mockDownloadUrl);
      expect(RBACPlugin.prototype.checkPermission).toHaveBeenCalledWith('session123', 'instance', 'download', 'instance123');
    });

    it('should deny download when permission is denied', async () => {
      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.checkPermission = jest.fn().mockResolvedValue(false);

      await expect(integrationService.getImageDownloadUrl('instance123', 'session123')).rejects.toThrow('Download access denied');
    });
  });

  describe('administrative functions', () => {
    beforeEach(async () => {
      await setupInitializedService();
    });

    it('should allow reindexing with admin permissions', async () => {
      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.checkPermission = jest.fn().mockResolvedValue(true);

      const { IndexingPlugin } = require('../services/indexingPlugin');
      IndexingPlugin.prototype.reindexAll = jest.fn().mockResolvedValue(undefined);

      await integrationService.reindexAllStudies('admin-session');

      expect(RBACPlugin.prototype.checkPermission).toHaveBeenCalledWith('admin-session', 'system', 'admin');
      expect(IndexingPlugin.prototype.reindexAll).toHaveBeenCalled();
    });

    it('should deny reindexing without admin permissions', async () => {
      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.checkPermission = jest.fn().mockResolvedValue(false);

      await expect(integrationService.reindexAllStudies('user-session')).rejects.toThrow('Admin access required');
    });

    it('should get service stats with admin permissions', async () => {
      const { RBACPlugin } = require('../services/rbacPlugin');
      RBACPlugin.prototype.checkPermission = jest.fn().mockResolvedValue(true);

      const { IndexingPlugin } = require('../services/indexingPlugin');
      IndexingPlugin.prototype.getIndexingStats = jest.fn().mockResolvedValue({});

      const { ImageViewingPlugin } = require('../services/imageViewingPlugin');
      ImageViewingPlugin.prototype.getCacheStats = jest.fn().mockReturnValue({});

      const stats = await integrationService.getServiceStats('admin-session');

      expect(stats).toBeDefined();
      expect(stats.initialized).toBe(true);
      expect(stats.plugins).toBeDefined();
      expect(stats.healthStatus).toBeDefined();
    });
  });

  // Helper function to setup initialized service
  async function setupInitializedService() {
    const { OrthancClient } = require('../utils/orthancClient');
    OrthancClient.prototype.healthCheck = jest.fn().mockResolvedValue(true);

    const mockPluginInit = jest.fn().mockResolvedValue(undefined);
    const mockHealthStatus = {
      status: 'healthy' as const,
      message: 'All systems operational',
      timestamp: new Date(),
      version: '1.0.0'
    };

    // Mock all plugins
    const plugins = [
      'CloudStoragePlugin',
      'IndexingPlugin',
      'RBACPlugin',
      'MultilingualPlugin',
      'ImageViewingPlugin'
    ];

    for (const pluginName of plugins) {
      const plugin = require(`../services/${pluginName.charAt(0).toLowerCase() + pluginName.slice(1)}`)[pluginName];
      plugin.prototype.initialize = mockPluginInit;
      plugin.prototype.getHealthStatus = jest.fn().mockResolvedValue(mockHealthStatus);
    }

    await integrationService.initialize();
  }
});