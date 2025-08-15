# Adaptive Timeout Implementation

This document describes the adaptive timeout functionality implemented for the WebQx healthcare platform to improve performance and reliability under variable network conditions.

## Overview

The adaptive timeout system dynamically adjusts timeout values for external API calls based on historical response times. This ensures better resilience and efficiency when communicating with EHR systems and other external services.

## Key Features

- **Dynamic Timeout Adjustment**: Automatically calculates optimal timeout values based on historical response times
- **Configurable Bounds**: Respects minimum and maximum timeout limits
- **Error Handling**: Provides fallback mechanisms for scenarios where response times exceed limits
- **Audit Logging**: Tracks timeout adjustments for monitoring and compliance
- **HIPAA Compliant**: Ensures no sensitive data is logged during timeout operations

## Architecture

### Components

1. **AdaptiveTimeoutManager**: Core utility class that tracks response times and calculates adaptive timeouts
2. **Service Integration**: Modified existing services (OttehrService, OpenEMR integration) to use adaptive timeouts
3. **Configuration**: Environment variable support for backward compatibility

### Algorithm

The adaptive timeout calculation follows this formula:
```typescript
adaptiveTimeout = Math.min(
  Math.max(averageResponseTime * multiplier, minTimeout),
  maxTimeout
)
```

Default configuration:
- Minimum timeout: 30 seconds
- Maximum timeout: 2 minutes
- Multiplier: 2x average response time
- Sample size: Last 20 response times

## Usage

### Basic Usage

```typescript
import { AdaptiveTimeoutManager } from './utils/adaptive-timeout';

// Create manager with custom configuration
const timeoutManager = new AdaptiveTimeoutManager({
  minTimeoutMs: 30000,      // 30 seconds minimum
  maxTimeoutMs: 120000,     // 2 minutes maximum
  timeoutMultiplier: 2,     // 2x average response time
  maxSamples: 20,           // Keep last 20 response times
  fallbackTimeoutMs: 30000, // Default fallback
  enableLogging: true       // Enable detailed logging
});

// Get adaptive timeout for an endpoint
const timeout = timeoutManager.getAdaptiveTimeout('api/patients');

// Record response time after API call
const startTime = Date.now();
// ... make API call ...
const duration = Date.now() - startTime;
timeoutManager.recordResponseTime('api/patients', duration, success);
```

### Service Integration

#### OttehrService

The OttehrService automatically uses adaptive timeouts:

```typescript
import { OttehrService } from './services/ottehrService';

const ottehrService = new OttehrService({
  apiBaseUrl: 'https://api.ottehr.com',
  apiKey: 'your-api-key',
  timeout: 30000 // Used as fallback timeout
});

// Get adaptive timeout statistics
const stats = ottehrService.getAdaptiveTimeoutStats();
console.log('Timeout stats:', stats);
```

#### OpenEMR Integration

OpenEMR integration supports adaptive timeouts through configuration:

```typescript
import { openemrConfig } from './ehr-integrations/openemr/config/default';

// Enable adaptive timeouts (enabled by default)
process.env.OPENEMR_ENABLE_ADAPTIVE_TIMEOUT = 'true';

const integration = new OpenEMRIntegration(openemrConfig);
const stats = integration.getAdaptiveTimeoutStats();
```

### Environment Variables

Adaptive timeout behavior can be controlled through environment variables:

```bash
# OpenEMR timeout settings
OPENEMR_TIMEOUT_MS=30000
OPENEMR_ENABLE_ADAPTIVE_TIMEOUT=true

# Ottehr timeout settings  
OTTEHR_TIMEOUT=30000
```

## Configuration Options

### AdaptiveTimeoutConfig

| Property | Default | Description |
|----------|---------|-------------|
| `minTimeoutMs` | 30000 | Minimum timeout value in milliseconds |
| `maxTimeoutMs` | 120000 | Maximum timeout value in milliseconds |
| `timeoutMultiplier` | 2 | Multiplier for calculated timeout |
| `maxSamples` | 20 | Maximum number of response times to track |
| `fallbackTimeoutMs` | 30000 | Fallback timeout when no historical data |
| `enableLogging` | true | Enable detailed logging |

## Monitoring and Statistics

### Endpoint Statistics

Each tracked endpoint provides comprehensive statistics:

```typescript
const stats = manager.getEndpointStats('api/patients');
console.log({
  currentTimeout: stats.currentTimeout,      // Current adaptive timeout
  adjustmentCount: stats.adjustmentCount,    // Number of adjustments made
  lastAdjusted: stats.lastAdjusted,         // Last adjustment timestamp
  sampleCount: stats.responseTimes.length,   // Number of samples
  avgResponseTime: calculateAverage(stats.responseTimes)
});
```

### Service-Level Statistics

Services provide aggregated statistics:

```typescript
// OttehrService statistics
const ottehrStats = ottehrService.getAdaptiveTimeoutStats();

// OpenEMR statistics
const openemrStats = integration.getAdaptiveTimeoutStats();
```

## Error Handling

### Fallback Mechanisms

1. **No Historical Data**: Uses configured fallback timeout
2. **All Failed Requests**: Uses fallback timeout with 1.5x multiplier
3. **Network Errors**: Records as failed response and uses current adaptive timeout
4. **Timeout Errors**: Records as failed response for future calculations

### Logging

All timeout adjustments and errors are logged with appropriate detail levels:

```
[AdaptiveTimeout] 2024-01-15T10:30:00.000Z Adaptive timeout for api/patients: 45000ms (based on 10 samples)
[AdaptiveTimeout] 2024-01-15T10:30:05.000Z Recorded response time for api/patients: 22000ms (success: true)
```

## HIPAA Compliance

The adaptive timeout system ensures HIPAA compliance by:

- **No Sensitive Data Logging**: Only endpoint names, response times, and success status are logged
- **Audit Trail**: All timeout adjustments are tracked with timestamps
- **Secure Configuration**: Sensitive configuration values are not exposed in logs
- **Data Minimization**: Only necessary response time data is retained (configurable sample size)

## Testing

### Unit Tests

Comprehensive unit tests are provided for the adaptive timeout functionality:

```bash
npm test -- __tests__/adaptive-timeout.test.ts
```

### Integration Tests

Integration tests verify service-level adaptive timeout functionality:

```bash
npm test -- __tests__/ottehr-typescript-integration.test.ts
```

### Manual Testing

A manual test script is available to demonstrate functionality:

```bash
npx ts-node test-adaptive-timeout.ts
```

## Performance Impact

The adaptive timeout system has minimal performance impact:

- **Memory Usage**: Tracks only the last N response times per endpoint (configurable)
- **CPU Usage**: Simple calculations performed only during timeout requests
- **Network Impact**: No additional network requests; only tracks existing API calls

## Migration Guide

### Existing Services

Services already using fixed timeouts can easily adopt adaptive timeouts:

1. **Import AdaptiveTimeoutManager**:
   ```typescript
   import { AdaptiveTimeoutManager } from './utils/adaptive-timeout';
   ```

2. **Initialize manager**:
   ```typescript
   private adaptiveTimeout = new AdaptiveTimeoutManager({
     fallbackTimeoutMs: this.configuredTimeout
   });
   ```

3. **Use adaptive timeout**:
   ```typescript
   const timeout = this.adaptiveTimeout.getAdaptiveTimeout(endpointKey);
   ```

4. **Record response times**:
   ```typescript
   this.adaptiveTimeout.recordResponseTime(endpointKey, duration, success);
   ```

### Backward Compatibility

All existing timeout configurations continue to work as fallback values:

- `OPENEMR_TIMEOUT_MS` → Used as fallback for OpenEMR adaptive timeouts
- `OTTEHR_TIMEOUT` → Used as fallback for Ottehr adaptive timeouts
- Service-specific timeout configs → Used as fallback for respective services

## Troubleshooting

### Common Issues

1. **Timeouts Still Too Short**: Increase `minTimeoutMs` configuration
2. **Timeouts Too Long**: Decrease `maxTimeoutMs` or `timeoutMultiplier`
3. **Not Adapting**: Ensure sufficient sample data (`hasSufficientData()`)
4. **High Memory Usage**: Reduce `maxSamples` configuration

### Debug Information

Enable detailed logging for troubleshooting:

```typescript
const manager = new AdaptiveTimeoutManager({
  enableLogging: true
});
```

View statistics to understand current behavior:

```typescript
const stats = manager.getAllStats();
console.log('All endpoint statistics:', stats);
```

## Future Enhancements

Potential future improvements:

1. **Machine Learning**: Use ML models for more sophisticated timeout prediction
2. **Network Condition Awareness**: Factor in current network conditions
3. **Service-Specific Patterns**: Different algorithms for different service types
4. **Real-time Adjustment**: More frequent timeout adjustments during high-variance periods
5. **Cross-Service Learning**: Share timeout insights across similar services

## Support

For questions or issues related to adaptive timeouts:

1. Check the troubleshooting section above
2. Review unit test examples for usage patterns
3. Examine service integration code for implementation details
4. Consult the manual test script for real-world scenarios