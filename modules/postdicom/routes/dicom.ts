/**
 * PostDICOM API Routes
 * Express routes for DICOM imaging operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  StudySearchParams,
  APIResponse,
  DICOMStudy,
  PostDICOMError,
  ERROR_CODES
} from '../types/postdicom.types';
import PostDICOMAPIService from '../services/apiService';
import PostDICOMRBACService from '../services/rbacService';
import PostDICOMCacheService from '../services/cacheService';

/**
 * Extended request interface with user context
 */
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
    specialties: string[];
    sessionId: string;
  };
}

/**
 * PostDICOM Router factory
 */
export function createPostDICOMRouter(): Router {
  const router = Router();
  
  // Initialize services
  const apiService = new PostDICOMAPIService();
  const rbacService = new PostDICOMRBACService();
  const cacheService = new PostDICOMCacheService();

  // Middleware for authentication (integrates with WebQX auth)
  const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // In a real implementation, this would validate JWT token from WebQX auth
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_CREDENTIALS,
            message: 'Authentication required'
          }
        });
      }

      // Mock user context - would be extracted from JWT in real implementation
      req.user = {
        userId: 'user-123',
        role: 'provider',
        specialties: ['radiology', 'primary-care'],
        sessionId: 'session-123'
      };

      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CREDENTIALS,
          message: 'Invalid authentication token'
        }
      });
    }
  };

  // Middleware for RBAC authorization
  const authorize = (action: string, resourceType: string) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: {
              code: ERROR_CODES.ACCESS_DENIED,
              message: 'User context not found'
            }
          });
        }

        const accessRequest = {
          user: {
            userId: req.user.userId,
            role: req.user.role as any,
            specialties: req.user.specialties,
            permissions: [],
            sessionId: req.user.sessionId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || ''
          },
          resourceType: resourceType as any,
          resourceId: req.params.id || req.params.studyInstanceUID || '',
          action: action as any,
          patientID: req.query.patientID as string,
          studyMetadata: req.body?.studyMetadata
        };

        const accessResult = await rbacService.checkAccess(accessRequest);
        
        if (!accessResult.granted) {
          return res.status(403).json({
            success: false,
            error: {
              code: ERROR_CODES.ACCESS_DENIED,
              message: accessResult.reason || 'Access denied'
            }
          });
        }

        next();
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: ERROR_CODES.ACCESS_DENIED,
            message: 'Authorization check failed'
          }
        });
      }
    };
  };

  // Error handler middleware
  const handleError = (error: any, res: Response) => {
    console.error('PostDICOM API Error:', error);
    
    if (error instanceof PostDICOMError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.NETWORK_ERROR,
        message: 'Internal server error'
      }
    });
  };

  // Health check endpoint
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const healthStatus = await apiService.getServiceHealth();
      res.json(healthStatus);
    } catch (error) {
      handleError(error, res);
    }
  });

  // Search studies
  router.get('/studies', authenticate, authorize('view', 'study'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const searchParams: StudySearchParams = {
        patientID: req.query.patientID as string,
        studyDate: req.query.studyDate as string,
        studyDateRange: req.query.startDate && req.query.endDate ? {
          start: req.query.startDate as string,
          end: req.query.endDate as string
        } : undefined,
        modality: req.query.modality as string,
        specialty: req.query.specialty as string,
        accessLevel: req.query.accessLevel as any,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        sortBy: (req.query.sortBy as any) || 'studyDate',
        sortOrder: (req.query.sortOrder as any) || 'desc'
      };

      const result = await apiService.searchStudies(searchParams);
      res.json(result);
    } catch (error) {
      handleError(error, res);
    }
  });

  // Get specific study
  router.get('/studies/:studyInstanceUID', authenticate, authorize('view', 'study'), 
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { studyInstanceUID } = req.params;
        const result = await apiService.getStudy(studyInstanceUID);
        res.json(result);
      } catch (error) {
        handleError(error, res);
      }
    });

  // Get study series
  router.get('/studies/:studyInstanceUID/series', authenticate, authorize('view', 'series'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { studyInstanceUID } = req.params;
        const result = await apiService.getStudySeries(studyInstanceUID);
        res.json(result);
      } catch (error) {
        handleError(error, res);
      }
    });

  // Get series images
  router.get('/studies/:studyInstanceUID/series/:seriesInstanceUID/images', 
    authenticate, authorize('view', 'image'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { studyInstanceUID, seriesInstanceUID } = req.params;
        const result = await apiService.getSeriesImages(studyInstanceUID, seriesInstanceUID);
        res.json(result);
      } catch (error) {
        handleError(error, res);
      }
    });

  // Get image data
  router.get('/images/:sopInstanceUID/data', authenticate, authorize('download', 'image'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { sopInstanceUID } = req.params;
        const result = await apiService.getImageData(sopInstanceUID);
        
        if (result.success && result.data) {
          res.setHeader('Content-Type', 'application/dicom');
          res.setHeader('Content-Disposition', `attachment; filename="${sopInstanceUID}.dcm"`);
          res.send(Buffer.from(result.data));
        } else {
          res.status(404).json(result);
        }
      } catch (error) {
        handleError(error, res);
      }
    });

  // Get image metadata
  router.get('/images/:sopInstanceUID/metadata', authenticate, authorize('view', 'image'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { sopInstanceUID } = req.params;
        const result = await apiService.getImageMetadata(sopInstanceUID);
        res.json(result);
      } catch (error) {
        handleError(error, res);
      }
    });

  // Generate pre-signed URL
  router.post('/images/:sopInstanceUID/presigned-url', authenticate, authorize('view', 'image'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { sopInstanceUID } = req.params;
        const { expiresIn = 3600 } = req.body;
        
        const result = await apiService.generatePreSignedUrl(sopInstanceUID, expiresIn);
        res.json(result);
      } catch (error) {
        handleError(error, res);
      }
    });

  // Upload study
  router.post('/studies/upload', authenticate, authorize('upload', 'study'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_DICOM_FILE,
              message: 'No files provided for upload'
            }
          });
        }

        // Convert Express.Multer.File to File interface
        const dicomFiles = files.map(file => ({
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          buffer: file.buffer
        })) as any[];

        const result = await apiService.uploadStudy(dicomFiles, req.body.metadata);
        res.json(result);
      } catch (error) {
        handleError(error, res);
      }
    });

  // Delete study (admin only)
  router.delete('/studies/:studyInstanceUID', authenticate, authorize('delete', 'study'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { studyInstanceUID } = req.params;
        const result = await apiService.deleteStudy(studyInstanceUID);
        res.json(result);
      } catch (error) {
        handleError(error, res);
      }
    });

  // Batch operations
  router.post('/batch/:operation', authenticate, authorize('batch', 'study'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { operation } = req.params;
        const { studyInstanceUIDs } = req.body;

        if (!studyInstanceUIDs || !Array.isArray(studyInstanceUIDs)) {
          return res.status(400).json({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_DICOM_FILE,
              message: 'studyInstanceUIDs array is required'
            }
          });
        }

        const validOperations = ['download', 'delete', 'archive'];
        if (!validOperations.includes(operation)) {
          return res.status(400).json({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_DICOM_FILE,
              message: `Invalid operation. Must be one of: ${validOperations.join(', ')}`
            }
          });
        }

        const result = await apiService.batchOperation(operation as any, studyInstanceUIDs);
        res.json(result);
      } catch (error) {
        handleError(error, res);
      }
    });

  // Get usage statistics
  router.get('/stats/usage', authenticate, authorize('view', 'stats'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const result = await apiService.getUsageStats();
        res.json(result);
      } catch (error) {
        handleError(error, res);
      }
    });

  // Cache management endpoints

  // Get cache statistics
  router.get('/cache/stats', authenticate, authorize('view', 'cache'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const stats = await cacheService.getStats();
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        handleError(error, res);
      }
    });

  // Clear cache
  router.delete('/cache', authenticate, authorize('admin', 'cache'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        await cacheService.clear();
        res.json({
          success: true,
          message: 'Cache cleared successfully'
        });
      } catch (error) {
        handleError(error, res);
      }
    });

  // Invalidate study cache
  router.delete('/cache/studies/:studyInstanceUID', authenticate, authorize('admin', 'cache'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { studyInstanceUID } = req.params;
        await cacheService.invalidateStudy(studyInstanceUID);
        res.json({
          success: true,
          message: `Cache invalidated for study: ${studyInstanceUID}`
        });
      } catch (error) {
        handleError(error, res);
      }
    });

  // Warm up cache
  router.post('/cache/warmup', authenticate, authorize('admin', 'cache'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { studyInstanceUIDs } = req.body;
        
        if (!studyInstanceUIDs || !Array.isArray(studyInstanceUIDs)) {
          return res.status(400).json({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_DICOM_FILE,
              message: 'studyInstanceUIDs array is required'
            }
          });
        }

        await cacheService.warmUpCache(studyInstanceUIDs);
        res.json({
          success: true,
          message: `Cache warmed up for ${studyInstanceUIDs.length} studies`
        });
      } catch (error) {
        handleError(error, res);
      }
    });

  // RBAC management endpoints

  // Get audit logs
  router.get('/audit/logs', authenticate, authorize('view', 'audit'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const filters = {
          userId: req.query.userId as string,
          startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
          endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
          action: req.query.action as string,
          success: req.query.success ? req.query.success === 'true' : undefined,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 100
        };

        const logs = await rbacService.getAuditLogs(filters);
        res.json({
          success: true,
          data: logs,
          metadata: {
            totalCount: logs.length,
            filters
          }
        });
      } catch (error) {
        handleError(error, res);
      }
    });

  // Get user permissions
  router.get('/permissions/:userId', authenticate, authorize('view', 'permissions'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { userId } = req.params;
        
        // Mock user context for permission lookup
        const userContext = {
          userId,
          role: 'provider' as any,
          specialties: ['radiology'],
          permissions: [],
          sessionId: 'session-123',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || ''
        };

        const permissions = await rbacService.getUserPermissions(userContext);
        res.json({
          success: true,
          data: permissions
        });
      } catch (error) {
        handleError(error, res);
      }
    });

  // Get active sessions
  router.get('/sessions/active', authenticate, authorize('view', 'sessions'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const activeCount = rbacService.getActiveSessionsCount();
        res.json({
          success: true,
          data: {
            activeSessions: activeCount,
            timestamp: new Date()
          }
        });
      } catch (error) {
        handleError(error, res);
      }
    });

  return router;
}

export default createPostDICOMRouter;