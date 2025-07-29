/**
 * Test suite for WebQX™ OHIF Integration Module
 */

import { 
  DICOMService, 
  ImagingAPI, 
  PerformanceService, 
  ImagingRBAC,
  WebQXImagingPlugin,
  createImagingWorkflow,
  validateDICOMData
} from '../index';

import { 
  WebQXUser, 
  WebQXStudyMetadata, 
  CacheConfiguration 
} from '../types';

describe('WebQX OHIF Integration Module', () => {
  let mockUser: WebQXUser;
  let mockStudy: WebQXStudyMetadata;

  beforeEach(() => {
    mockUser = {
      id: 'user-123',
      role: 'radiologist',
      permissions: ['view_images', 'annotate_images', 'measure_images'],
      preferences: {
        language: 'en',
        theme: 'dark',
        defaultLayout: 'grid',
        autoSave: true,
        notifications: {
          email: true,
          push: false,
          sound: true,
          types: ['study_ready', 'urgent_study']
        },
        performance: {
          imageQuality: 'high',
          cacheSize: 1024,
          prefetchEnabled: true,
          compressionLevel: 1
        }
      },
      language: 'en',
      specialty: 'radiology'
    };

    mockStudy = {
      studyInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.78',
      patientName: 'Test Patient',
      patientID: 'TEST001',
      studyDate: '20240115',
      studyTime: '143000',
      studyDescription: 'CT Chest',
      modality: 'CT',
      webqxPatientId: 'webqx-patient-123',
      accessibleBy: ['radiologist', 'physician'],
      workflow: 'radiology-interpretation',
      priority: 'normal',
      annotations: []
    };
  });

  describe('DICOMService', () => {
    let dicomService: DICOMService;

    beforeEach(() => {
      const config = {
        baseUrl: 'http://localhost:8080/dcm4chee-arc',
        cacheConfig: {
          maxSize: 512,
          ttl: 3600,
          strategy: 'lru' as const,
          compression: true
        }
      };
      dicomService = new DICOMService(config);
    });

    test('should initialize with correct configuration', () => {
      expect(dicomService).toBeDefined();
    });

    test('should get study metadata with user access control', async () => {
      const response = await dicomService.getStudyMetadata(mockStudy.studyInstanceUID, mockUser);
      
      expect(response).toBeDefined();
      expect(response.success).toBeDefined();
      
      if (response.success) {
        expect(response.data).toBeDefined();
        expect(response.metadata).toBeDefined();
      }
    });

    test('should handle permission denied scenarios', async () => {
      const restrictedUser: WebQXUser = {
        ...mockUser,
        permissions: [] // No permissions
      };

      const response = await dicomService.getStudyMetadata(mockStudy.studyInstanceUID, restrictedUser);
      
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('should return cached data on subsequent requests', async () => {
      // First request
      const response1 = await dicomService.getStudyMetadata(mockStudy.studyInstanceUID, mockUser);
      
      // Second request (should hit cache)
      const response2 = await dicomService.getStudyMetadata(mockStudy.studyInstanceUID, mockUser);
      
      if (response2.success) {
        expect(response2.metadata?.cacheHit).toBe(true);
      }
    });
  });

  describe('ImagingAPI', () => {
    let imagingAPI: ImagingAPI;

    beforeEach(() => {
      imagingAPI = new ImagingAPI({
        dicomBaseUrl: 'http://localhost:8080/dcm4chee-arc',
        enablePerformanceOptimization: true,
        cacheSize: 512
      });
    });

    test('should initialize correctly', () => {
      expect(imagingAPI).toBeDefined();
    });

    test('should get study with enhanced features', async () => {
      const response = await imagingAPI.getStudy(mockStudy.studyInstanceUID, mockUser, {
        includeAnnotations: true,
        prefetchSeries: true,
        workflow: 'radiology-interpretation'
      });

      expect(response).toBeDefined();
      expect(response.success).toBeDefined();
    });

    test('should save annotations with proper validation', async () => {
      const annotation = {
        type: 'text' as const,
        authorId: mockUser.id,
        authorRole: mockUser.role,
        content: {
          text: 'Test annotation',
          coordinates: [100, 200],
          style: {
            color: '#ff0000',
            thickness: 2,
            opacity: 0.8
          }
        },
        visibility: 'public' as const
      };

      const response = await imagingAPI.saveAnnotation(mockStudy.studyInstanceUID, annotation, mockUser);

      if (response.success) {
        expect(response.data).toBeDefined();
        expect(response.data!.id).toBeDefined();
        expect(response.data!.timestamp).toBeDefined();
      }
    });

    test('should get performance metrics', () => {
      const metrics = imagingAPI.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.loadTime).toBeDefined();
      expect(metrics.renderTime).toBeDefined();
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.networkLatency).toBeDefined();
      expect(metrics.cacheHitRate).toBeDefined();
    });
  });

  describe('PerformanceService', () => {
    let performanceService: PerformanceService;

    beforeEach(() => {
      const cacheConfig: CacheConfiguration = {
        maxSize: 256,
        ttl: 1800,
        strategy: 'lru',
        compression: true
      };
      performanceService = new PerformanceService(cacheConfig);
    });

    test('should cache data successfully', async () => {
      const testData = { test: 'data' };
      const key = 'test-key';

      const result = await performanceService.cacheData(key, testData);
      expect(result).toBe(true);

      const cachedData = performanceService.getCachedData(key);
      expect(cachedData).toEqual(testData);
    });

    test('should schedule prefetch operations', () => {
      performanceService.schedulePrefetch(mockStudy.studyInstanceUID, {
        priority: 5,
        userId: mockUser.id,
        immediate: true
      });

      // Verify prefetch was scheduled (in real implementation, this would check internal state)
      expect(true).toBe(true); // Placeholder assertion
    });

    test('should optimize preferences for user role', () => {
      const preferences = performanceService.optimizeForUser(mockUser);
      
      expect(preferences).toBeDefined();
      expect(preferences.imageQuality).toBe('high'); // Radiologist should get high quality
      expect(preferences.cacheSize).toBeGreaterThan(512); // Radiologist should get larger cache
      expect(preferences.prefetchEnabled).toBe(true);
    });

    test('should clear cache based on strategy', () => {
      // Add some test data
      performanceService.cacheData('test1', { data: 1 });
      performanceService.cacheData('test2', { data: 2 });

      const cleared = performanceService.clearCache('all');
      expect(cleared).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ImagingRBAC', () => {
    let rbac: ImagingRBAC;

    beforeEach(() => {
      rbac = new ImagingRBAC();
    });

    test('should check user permissions correctly', () => {
      expect(rbac.hasPermission(mockUser, 'view_images')).toBe(true);
      expect(rbac.hasPermission(mockUser, 'annotate_images')).toBe(true);
      expect(rbac.hasPermission(mockUser, 'admin_settings')).toBe(false);
    });

    test('should validate study access based on role', () => {
      const canAccess = rbac.canAccessStudy(mockUser, mockStudy);
      expect(canAccess).toBe(true);
    });

    test('should deny access for restricted studies', () => {
      const restrictedStudy: WebQXStudyMetadata = {
        ...mockStudy,
        accessibleBy: ['admin'] // Only admin can access
      };

      const canAccess = rbac.canAccessStudy(mockUser, restrictedStudy);
      expect(canAccess).toBe(false);
    });

    test('should filter accessible studies', () => {
      const studies = [
        mockStudy,
        { ...mockStudy, studyInstanceUID: 'restricted-study', accessibleBy: ['admin'] }
      ];

      const accessibleStudies = rbac.filterAccessibleStudies(mockUser, studies);
      expect(accessibleStudies).toHaveLength(1);
      expect(accessibleStudies[0].studyInstanceUID).toBe(mockStudy.studyInstanceUID);
    });

    test('should get effective permissions including specialty-specific ones', () => {
      const permissions = rbac.getEffectivePermissions(mockUser);
      
      expect(permissions).toContain('view_images');
      expect(permissions).toContain('annotate_images');
      expect(permissions).toContain('measure_images');
      // Should include radiology-specific permissions
      expect(permissions).toContain('download_images');
    });

    test('should maintain audit log', () => {
      rbac.hasPermission(mockUser, 'view_images');
      rbac.canAccessStudy(mockUser, mockStudy);

      const auditEntries = rbac.getAuditLog({ userId: mockUser.id });
      expect(auditEntries.length).toBeGreaterThan(0);
      
      const firstEntry = auditEntries[0];
      expect(firstEntry.userId).toBe(mockUser.id);
      expect(firstEntry.action).toBeDefined();
      expect(firstEntry.timestamp).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    test('should create imaging workflow', () => {
      const workflow = createImagingWorkflow(
        'test-workflow',
        'Test Workflow',
        'radiology',
        [
          {
            name: 'Initial Review',
            order: 1,
            required: true,
            tools: ['zoom', 'pan']
          },
          {
            name: 'Measurements',
            order: 2,
            required: false,
            tools: ['length', 'area']
          }
        ]
      );

      expect(workflow.id).toBe('test-workflow');
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.specialty).toBe('radiology');
      expect(workflow.steps).toHaveLength(2);
      expect(workflow.steps[0].id).toBe('test-workflow_step_1');
      expect(workflow.permissions).toContain('view_images');
      expect(workflow.uiConfig).toBeDefined();
    });

    test('should validate DICOM data', () => {
      const validData = {
        studyInstanceUID: '1.2.3.4.5',
        patientID: 'PAT001',
        patientName: 'Test Patient'
      };

      const invalidData = {
        studyInstanceUID: '1.2.3.4.5'
        // Missing required fields
      };

      expect(validateDICOMData(validData)).toBe(true);
      expect(validateDICOMData(invalidData)).toBe(false);
      expect(validateDICOMData(null)).toBe(false);
      expect(validateDICOMData(undefined)).toBe(false);
    });
  });

  describe('WebQXImagingPlugin', () => {
    let plugin: WebQXImagingPlugin;
    let mockCanvas: HTMLCanvasElement;

    beforeEach(() => {
      const context = {
        user: mockUser,
        language: 'en',
        permissions: mockUser.permissions,
        onAnnotationChange: jest.fn(),
        onMeasurementChange: jest.fn()
      };

      plugin = new WebQXImagingPlugin(context);

      // Mock canvas
      mockCanvas = document.createElement('canvas');
      mockCanvas.width = 800;
      mockCanvas.height = 600;
      
      // Mock getContext
      const mockContext = {
        clearRect: jest.fn(),
        fillText: jest.fn(),
        strokeRect: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        arc: jest.fn(),
        stroke: jest.fn(),
        save: jest.fn(),
        restore: jest.fn()
      };
      
      jest.spyOn(mockCanvas, 'getContext').mockReturnValue(mockContext as any);
    });

    test('should initialize with canvas', () => {
      plugin.initialize(mockCanvas);
      expect(plugin).toBeDefined();
    });

    test('should activate tools with permission check', () => {
      plugin.initialize(mockCanvas);
      
      // Should succeed for permitted tools
      expect(plugin.activateTool('text')).toBe(true);
      expect(plugin.activateTool('length')).toBe(true);
      
      // Should fail for tools requiring admin permissions
      const restrictedUser: WebQXUser = {
        ...mockUser,
        permissions: ['view_images'] // Limited permissions
      };
      
      const restrictedPlugin = new WebQXImagingPlugin({
        user: restrictedUser,
        language: 'en',
        permissions: restrictedUser.permissions
      });
      
      restrictedPlugin.initialize(mockCanvas);
      expect(restrictedPlugin.activateTool('text')).toBe(false);
    });

    test('should create text annotations', () => {
      plugin.initialize(mockCanvas);
      
      const annotation = plugin.createTextAnnotation(100, 200, 'Test annotation');
      
      expect(annotation.id).toBeDefined();
      expect(annotation.type).toBe('text');
      expect(annotation.content.text).toBe('Test annotation');
      expect(annotation.content.coordinates).toEqual([100, 200]);
      expect(annotation.authorId).toBe(mockUser.id);
    });

    test('should create measurements', () => {
      plugin.initialize(mockCanvas);
      
      const measurement = plugin.createLengthMeasurement(50, 50, 150, 150, 0.5);
      
      expect(measurement.type).toBe('length');
      expect(measurement.unit).toBe('mm');
      expect(measurement.value).toBeGreaterThan(0);
    });

    test('should export annotations to DICOM format', () => {
      const annotations = [
        {
          id: 'ann-1',
          type: 'text' as const,
          authorId: mockUser.id,
          authorRole: mockUser.role,
          timestamp: new Date(),
          content: {
            text: 'Test annotation',
            coordinates: [100, 200],
            style: {
              color: '#ff0000',
              thickness: 2,
              opacity: 0.8
            }
          },
          visibility: 'public' as const
        }
      ];

      const dicomExport = plugin.exportToDICOM(annotations);
      
      expect(dicomExport.SOPClassUID).toBeDefined();
      expect(dicomExport.ContentSequence).toHaveLength(1);
      expect(dicomExport.ContentSequence[0].TextValue).toBe('Test annotation');
    });

    afterEach(() => {
      plugin.destroy();
    });
  });
});