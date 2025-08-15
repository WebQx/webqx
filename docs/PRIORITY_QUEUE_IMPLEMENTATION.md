# Priority Queue Implementation for WebQX Healthcare Platform

## Overview

This implementation introduces a robust priority queue system for handling critical data processing in the WebQX healthcare platform. The system ensures that urgent medical data, such as emergency triage cases and critical transcription jobs, are processed ahead of less critical data during high-demand periods.

## Architecture

### Core Components

1. **PriorityQueue** (`services/priorityQueue.js`)
   - Generic priority queue implementation
   - Supports healthcare-specific priority levels
   - Includes monitoring and metrics capabilities
   - Handles failed items with requeue functionality

2. **HealthcarePriorities** (in `priorityQueue.js`)
   - Standardized priority levels for healthcare operations
   - Conversion utilities between string and numeric priorities
   - Predefined constants for common scenarios

3. **PriorityTriageService** (`services/priorityTriageService.js`)
   - Specialized service for telepsychiatry triage workflows
   - Integrates with existing workflow system
   - Cultural adaptation and language support

## Priority Levels

The system uses numeric priority values with higher numbers indicating higher priority:

- **CRITICAL (100)**: Life-threatening, immediate processing
- **URGENT (75)**: Urgent care, process within minutes  
- **HIGH (50)**: High priority, process within hours
- **MEDIUM (25)**: Standard priority, process within day
- **LOW (10)**: Low priority, process when resources available
- **BACKGROUND (1)**: Background tasks, process during low activity

## Integration Points

### 1. Telepsychiatry Workflow (`routes/workflow.js`)

Enhanced the existing triage system with priority queue capabilities:

- **GET `/workflow/triage`**: Returns priority-sorted triage entries with queue metrics
- **POST `/workflow/triage`**: Creates new triage entries and adds them to priority queue
- **GET `/workflow/triage/next`**: Gets next highest priority entry for processing
- **PUT `/workflow/triage/:queueItemId/complete`**: Marks entry as completed
- **PUT `/workflow/triage/:queueItemId/fail`**: Handles failures with optional requeue
- **GET `/workflow/triage/metrics`**: Returns queue performance metrics

### 2. Priority Determination

The system automatically determines priority based on several factors:

- **Symptom Analysis**: Detects life-threatening keywords (suicide, self-harm, crisis)
- **Urgency Level**: Maps to numeric priorities
- **Department Type**: Emergency/ICU cases get highest priority
- **Study Type**: Critical imaging studies prioritized

### 3. Cultural and Language Support

- Maintains existing cultural adaptation features
- Filters by language and cultural context
- Preserves multilingual capabilities

## Usage Examples

### Basic Priority Queue Usage

```javascript
const { PriorityQueue, HealthcarePriorities } = require('./services/priorityQueue');

const queue = new PriorityQueue({
  maxQueueSize: 1000,
  enableMetrics: true,
  enableLogging: true
});

// Add critical patient data
const criticalId = queue.enqueue(
  { patientId: 'P123', type: 'emergency' },
  HealthcarePriorities.CRITICAL,
  { departmentId: 'emergency', urgencyLevel: 'stat' }
);

// Add routine data
const routineId = queue.enqueue(
  { patientId: 'P456', type: 'routine' },
  HealthcarePriorities.LOW
);

// Process highest priority first
const nextItem = queue.dequeue(); // Returns critical item first
```

### Triage Service Usage

```javascript
const { PriorityTriageService } = require('./services/priorityTriageService');

const triageService = new PriorityTriageService({
  maxQueueSize: 500,
  enableMetrics: true
});

// Add urgent triage case
const queueId = triageService.addTriageEntry({
  triageId: 'T123',
  patientId: 'P456',
  symptoms: ['suicidal thoughts', 'crisis'],
  priority: 'urgent',
  culturalContext: 'hispanic',
  language: 'es'
});

// Process next case
const nextCase = triageService.getNextTriageEntry();
console.log(`Processing: ${nextCase.triageEntry.patientId}`);

// Mark as completed
triageService.markTriageCompleted(nextCase.queueItemId, {
  assignedClinician: 'dr-smith',
  notes: 'Crisis intervention completed'
});
```

## Monitoring and Metrics

The priority queue system provides comprehensive monitoring capabilities:

### Queue Metrics

```javascript
const metrics = priorityQueue.getMetrics();
console.log({
  totalItems: metrics.totalItems,
  processingItems: metrics.processingItems,
  averageProcessingTime: metrics.averageProcessingTime,
  queueLengthByPriority: metrics.queueLengthByPriority
});
```

### Triage Service Metrics

```javascript
const triageMetrics = triageService.getQueueMetrics();
console.log({
  queueUtilization: triageMetrics.queueUtilization,
  priorityDistribution: triageMetrics.priorityDistribution,
  averageWaitTimeByPriority: triageMetrics.averageWaitTimeByPriority
});
```

## Testing

Comprehensive test suites ensure reliability:

- **Priority Queue Tests** (`services/__tests__/priorityQueue.test.ts`)
  - Basic queue operations
  - Priority handling
  - Metrics and monitoring
  - Error scenarios

- **Triage Service Tests** (`services/__tests__/priorityTriageService.test.js`)
  - Integration with priority queue
  - Filtering and cultural adaptation
  - Completion and failure handling
  - Performance metrics

## Performance Considerations

1. **Queue Size Limits**: Configurable maximum queue sizes prevent memory issues
2. **Concurrent Processing**: Supports multiple concurrent processors
3. **Efficient Sorting**: Binary search insertion for O(log n) enqueue operations
4. **Memory Management**: Automatic cleanup of completed items
5. **Metrics Overhead**: Optional metrics collection to minimize performance impact

## Future Enhancements

1. **Persistence**: Database storage for queue state across restarts
2. **Distributed Processing**: Support for multiple server instances
3. **Advanced Scheduling**: Time-based priority adjustments
4. **ML Integration**: Machine learning for automatic priority determination
5. **Batch Processing**: Enhanced batch job prioritization with resource allocation

## Configuration

### Environment Variables

- `PRIORITY_QUEUE_MAX_SIZE`: Maximum queue size (default: 1000)
- `ENABLE_QUEUE_METRICS`: Enable metrics collection (default: true)
- `ENABLE_QUEUE_LOGGING`: Enable debug logging (default: false)
- `PROCESSING_TIMEOUT_MS`: Processing timeout (default: 300000)

### Service Configuration

```javascript
const config = {
  maxQueueSize: 1000,
  enableMetrics: true,
  enableLogging: process.env.NODE_ENV === 'development',
  processingTimeoutMs: 300000,
  priorityQueueConfig: {
    maxQueueSize: 500,
    enableMetrics: true,
    enableLogging: false
  }
};
```

## Security and Compliance

- **HIPAA Compliance**: Audit logging for all queue operations
- **Data Encryption**: Sensitive metadata encryption
- **Access Control**: Role-based access to queue management endpoints
- **Data Minimization**: Only necessary data stored in queue items

## Conclusion

The priority queue implementation provides a robust foundation for handling critical healthcare data processing. It maintains backward compatibility with existing systems while adding sophisticated prioritization capabilities that improve system efficiency during high-demand periods.

The modular design allows for easy integration with other WebQX components and supports future enhancements as the platform evolves.