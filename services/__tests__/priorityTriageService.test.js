/**
 * Tests for Priority Triage Service Integration
 */

const { PriorityTriageService } = require('../priorityTriageService');

describe('PriorityTriageService', () => {
  let triageService;

  beforeEach(() => {
    triageService = new PriorityTriageService({
      maxQueueSize: 100,
      enableMetrics: true,
      enableLogging: false
    });
  });

  afterEach(() => {
    triageService.clear();
  });

  describe('Triage Entry Management', () => {
    test('should add triage entry to priority queue', () => {
      const triageEntry = {
        triageId: 'test-123',
        patientId: 'patient-456',
        symptoms: ['anxiety', 'panic'],
        priority: 'urgent',
        culturalContext: 'hispanic',
        language: 'es',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const queueItemId = triageService.addTriageEntry(triageEntry);
      
      expect(queueItemId).toBeDefined();
      expect(typeof queueItemId).toBe('string');
      expect(queueItemId.startsWith('pq_')).toBe(true);
    });

    test('should process triage entries by priority', () => {
      // Add multiple entries with different priorities
      const lowPriorityEntry = {
        triageId: 'low-123',
        patientId: 'patient-low',
        symptoms: ['mild anxiety'],
        priority: 'low',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const urgentEntry = {
        triageId: 'urgent-456',
        patientId: 'patient-urgent',
        symptoms: ['suicidal thoughts', 'crisis'],
        priority: 'urgent',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const mediumEntry = {
        triageId: 'medium-789',
        patientId: 'patient-medium',
        symptoms: ['depression'],
        priority: 'medium',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Add in non-priority order
      triageService.addTriageEntry(lowPriorityEntry);
      triageService.addTriageEntry(mediumEntry);
      triageService.addTriageEntry(urgentEntry);

      // Get next entry should return urgent first
      const firstEntry = triageService.getNextTriageEntry();
      expect(firstEntry.triageEntry.priority).toBe('urgent');
      expect(firstEntry.triageEntry.triageId).toBe('urgent-456');

      // Mark as completed
      triageService.markTriageCompleted(firstEntry.queueItemId);

      // Next should be medium priority
      const secondEntry = triageService.getNextTriageEntry();
      expect(secondEntry.triageEntry.priority).toBe('medium');
      expect(secondEntry.triageEntry.triageId).toBe('medium-789');
    });

    test('should handle triage completion and failure', () => {
      const triageEntry = {
        triageId: 'test-completion',
        patientId: 'patient-test',
        symptoms: ['anxiety'],
        priority: 'medium',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      triageService.addTriageEntry(triageEntry);
      const processing = triageService.getNextTriageEntry();
      
      // Test completion
      const completed = triageService.markTriageCompleted(processing.queueItemId, {
        assignedClinician: 'dr-smith',
        notes: 'Successfully triaged'
      });
      
      expect(completed).toBe(true);
      expect(processing.triageEntry.status).toBe('completed');
      expect(processing.triageEntry.completionData).toBeDefined();
    });

    test('should handle triage failure with requeue', () => {
      const triageEntry = {
        triageId: 'test-failure',
        patientId: 'patient-test',
        symptoms: ['anxiety'],
        priority: 'high',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      triageService.addTriageEntry(triageEntry);
      const processing = triageService.getNextTriageEntry();
      
      // Test failure with requeue
      const failed = triageService.markTriageFailed(processing.queueItemId, true, 30);
      
      expect(failed).toBe(true);
      
      // Should be able to get the requeued entry
      const requeuEntry = triageService.getNextTriageEntry();
      expect(requeuEntry).toBeTruthy();
      expect(requeuEntry.triageEntry.triageId).toBe('test-failure');
      expect(requeuEntry.triageEntry.retryCount).toBe(1);
    });
  });

  describe('Filtering and Metrics', () => {
    test('should filter triage entries correctly', () => {
      const entries = [
        {
          triageId: 'spanish-1',
          patientId: 'patient-1',
          symptoms: ['anxiety'],
          priority: 'high',
          culturalContext: 'hispanic',
          language: 'es',
          status: 'pending',
          createdAt: new Date().toISOString()
        },
        {
          triageId: 'english-1',
          patientId: 'patient-2',
          symptoms: ['depression'],
          priority: 'medium',
          culturalContext: 'american',
          language: 'en',
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      ];

      entries.forEach(entry => triageService.addTriageEntry(entry));

      // Filter by language
      const spanishEntries = triageService.getFilteredTriageEntries({ language: 'es' });
      expect(spanishEntries.length).toBe(1);
      expect(spanishEntries[0].language).toBe('es');

      // Filter by priority
      const highPriorityEntries = triageService.getFilteredTriageEntries({ priority: 'high' });
      expect(highPriorityEntries.length).toBe(1);
      expect(highPriorityEntries[0].priority).toBe('high');

      // Filter by cultural context
      const hispanicEntries = triageService.getFilteredTriageEntries({ culturalContext: 'hispanic' });
      expect(hispanicEntries.length).toBe(1);
      expect(hispanicEntries[0].culturalContext).toBe('hispanic');
    });

    test('should provide queue metrics', () => {
      // Add some entries
      for (let i = 0; i < 5; i++) {
        triageService.addTriageEntry({
          triageId: `test-${i}`,
          patientId: `patient-${i}`,
          symptoms: ['test symptom'],
          priority: i % 2 === 0 ? 'high' : 'medium',
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }

      const metrics = triageService.getQueueMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalItems).toBe(5);
      expect(metrics.queueLengthByPriority).toBeDefined();
      expect(metrics.priorityDistribution).toBeDefined();
      expect(metrics.queueUtilization).toBeGreaterThan(0);
    });
  });

  describe('Priority Conversion', () => {
    test('should convert string priorities to numeric values correctly', () => {
      expect(triageService.convertPriorityToNumeric('urgent')).toBe(75);
      expect(triageService.convertPriorityToNumeric('high')).toBe(50);
      expect(triageService.convertPriorityToNumeric('medium')).toBe(25);
      expect(triageService.convertPriorityToNumeric('low')).toBe(10);
      expect(triageService.convertPriorityToNumeric('unknown')).toBe(25); // defaults to medium
    });

    test('should determine urgency reasons correctly', () => {
      const urgentSymptoms = ['suicidal thoughts', 'self-harm'];
      const urgencyReason = triageService.determineUrgencyReason(urgentSymptoms);
      expect(urgencyReason).toBe('life-threatening symptoms detected');

      const severeSymptoms = ['severe depression', 'panic attacks'];
      const severeReason = triageService.determineUrgencyReason(severeSymptoms);
      expect(severeReason).toBe('severe psychiatric symptoms');

      const normalSymptoms = ['mild anxiety'];
      const normalReason = triageService.determineUrgencyReason(normalSymptoms);
      expect(normalReason).toBe('standard psychiatric evaluation');
    });
  });
});