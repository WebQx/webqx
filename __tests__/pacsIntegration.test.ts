/**
 * PACS Integration Tests
 * 
 * Comprehensive test suite for PACS integration including
 * DICOM operations, specialty routing, and audit logging.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { PacsService, DicomImage, StudySearchCriteria } from '../services/pacsService';
import { SpecialtyRoutingService, RoutingRule } from '../services/specialtyRoutingService';
import { PacsAuditLogger, PacsAuditContext } from '../services/pacsAuditLogger';

describe('PACS Integration', () => {
  let pacsService: PacsService;
  let routingService: SpecialtyRoutingService;
  let auditLogger: PacsAuditLogger;

  beforeEach(() => {
    pacsService = new PacsService({
      pacsServerUrl: 'http://test-pacs-server',
      dicomWebUrl: 'http://test-dicom-web',
      wadoUrl: 'http://test-wado',
      enableCaching: true,
      cacheExpiryHours: 1,
      maxConcurrentRequests: 3,
      timeoutMs: 5000
    });

    routingService = new SpecialtyRoutingService();
    auditLogger = new PacsAuditLogger({
      enabled: true,
      maxEntries: 1000,
      logToConsole: false
    });
  });

  afterEach(() => {
    pacsService.clearCache();
  });

  describe('PACS Service', () => {
    test('should search for studies based on criteria', async () => {
      const criteria: StudySearchCriteria = {
        patientID: 'PAT123',
        modality: 'CT',
        studyDateFrom: '2024-01-01'
      };

      const studies = await pacsService.searchStudies(criteria);

      expect(studies).toBeDefined();
      expect(Array.isArray(studies)).toBe(true);
      expect(studies.length).toBeGreaterThanOrEqual(0);

      if (studies.length > 0) {
        expect(studies[0]).toHaveProperty('studyInstanceUID');
        expect(studies[0]).toHaveProperty('metadata');
        expect(studies[0].metadata).toHaveProperty('patientID');
        expect(studies[0].metadata.modality).toBe('CT');
      }
    });

    test('should retrieve a specific study', async () => {
      const studyUID = '1.2.3.4.5.6789';
      const study = await pacsService.getStudy(studyUID);

      expect(study).toBeDefined();
      expect(Array.isArray(study)).toBe(true);
      
      if (study.length > 0) {
        expect(study[0].studyInstanceUID).toBe(studyUID);
        expect(study[0]).toHaveProperty('seriesInstanceUID');
        expect(study[0]).toHaveProperty('sopInstanceUID');
        expect(study[0]).toHaveProperty('imageUrl');
      }
    });

    test('should generate image URLs correctly', async () => {
      const studyUID = '1.2.3.4.5';
      const seriesUID = '1.2.3.4.5.1';
      const sopUID = '1.2.3.4.5.1.1';

      const imageUrl = await pacsService.getImageUrl(studyUID, seriesUID, sopUID);
      expect(imageUrl).toContain(studyUID);
      expect(imageUrl).toContain(seriesUID);
      expect(imageUrl).toContain(sopUID);
      expect(imageUrl).toContain('WADO');
    });

    test('should handle caching correctly', async () => {
      const criteria: StudySearchCriteria = {
        patientID: 'PAT123',
        modality: 'MRI'
      };

      // First call - should populate cache
      const studies1 = await pacsService.searchStudies(criteria);
      
      // Second call - should use cache
      const studies2 = await pacsService.searchStudies(criteria);

      expect(studies1).toEqual(studies2);
    });
  });

  describe('Specialty Routing Service', () => {
    test('should route cardiac studies to cardiology', async () => {
      const mockStudy: DicomImage = {
        studyInstanceUID: '1.2.3.4.5',
        seriesInstanceUID: '1.2.3.4.5.1',
        sopInstanceUID: '1.2.3.4.5.1.1',
        imageUrl: 'http://test.com/image',
        metadata: {
          patientID: 'PAT123',
          patientName: 'John Doe',
          studyDate: '20240115',
          studyTime: '100000',
          modality: 'CT',
          bodyPart: 'HEART',
          studyDescription: 'Cardiac CT',
          seriesDescription: 'Axial Images',
          institutionName: 'Test Hospital',
          referringPhysician: 'Dr. Smith'
        }
      };

      const routing = await routingService.routeStudy(mockStudy);

      expect(routing.primarySpecialty).toBe('cardiology');
      expect(routing.priority).toBeDefined();
      expect(routing.routingRuleApplied).toBeDefined();
    });

    test('should route orthopedic X-rays to orthopedics', async () => {
      const mockStudy: DicomImage = {
        studyInstanceUID: '1.2.3.4.6',
        seriesInstanceUID: '1.2.3.4.6.1',
        sopInstanceUID: '1.2.3.4.6.1.1',
        imageUrl: 'http://test.com/image',
        metadata: {
          patientID: 'PAT456',
          patientName: 'Jane Doe',
          studyDate: '20240115',
          studyTime: '140000',
          modality: 'XR',
          bodyPart: 'EXTREMITY',
          studyDescription: 'Knee X-Ray',
          seriesDescription: 'AP/Lateral Views',
          institutionName: 'Test Hospital',
          referringPhysician: 'Dr. Jones'
        }
      };

      const routing = await routingService.routeStudy(mockStudy);

      expect(routing.primarySpecialty).toBe('orthopedics');
    });

    test('should handle urgent studies with high priority', async () => {
      const mockStudy: DicomImage = {
        studyInstanceUID: '1.2.3.4.9',
        seriesInstanceUID: '1.2.3.4.9.1',
        sopInstanceUID: '1.2.3.4.9.1.1',
        imageUrl: 'http://test.com/image',
        metadata: {
          patientID: 'PAT888',
          patientName: 'Emergency Patient',
          studyDate: '20240115',
          studyTime: '200000',
          modality: 'CT',
          bodyPart: 'HEAD',
          studyDescription: 'Emergency CT Head',
          seriesDescription: 'Axial Images',
          institutionName: 'Test Hospital',
          referringPhysician: 'Dr. Emergency'
        }
      };

      const patientContext = { urgency: 'urgent' };
      const routing = await routingService.routeStudy(mockStudy, patientContext);

      expect(routing.priority).toBe('urgent');
    });
  });

  describe('PACS Audit Logger', () => {
    test('should log study search events', async () => {
      const context: PacsAuditContext = {
        userId: 'user123',
        userRole: 'radiologist',
        specialty: 'radiology',
        sessionId: 'session123',
        ipAddress: '192.168.1.100'
      };

      await auditLogger.logStudySearch(
        { patientID: 'PAT123' },
        5,
        context,
        true
      );

      const logs = auditLogger.searchLogs({
        action: 'pacs.study.search',
        userId: 'user123'
      });

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('pacs.study.search');
      expect(logs[0].success).toBe(true);
      expect(logs[0].context.userId).toBe('user123');
    });

    test('should generate audit statistics', async () => {
      const context: PacsAuditContext = {
        userId: 'stats-user',
        userRole: 'radiologist',
        specialty: 'radiology'
      };

      // Log several events
      await auditLogger.logStudySearch({}, 3, context, true);
      await auditLogger.logStudyAccess('1.2.3', 'Study', context, true);

      const stats = auditLogger.getAuditStatistics();

      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.eventsByAction).toHaveProperty('pacs.study.search');
      expect(stats.eventsByResourceType).toHaveProperty('ImagingStudy');
      expect(stats.successRate).toBeGreaterThan(0);
    });
  });
});

export default {};