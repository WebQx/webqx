/**
 * Dynamic Rate Limiting Configuration
 * Configuration options for adaptive rate limiting based on traffic patterns
 */

module.exports = {
    // Default configuration for dynamic rate limiting
    default: {
        // Traffic analysis thresholds (requests per second)
        lowTrafficThreshold: parseInt(process.env.DYNAMIC_RATE_LIMIT_LOW_THRESHOLD) || 10,
        highTrafficThreshold: parseInt(process.env.DYNAMIC_RATE_LIMIT_HIGH_THRESHOLD) || 80,
        
        // Rate limit boundaries
        minRateLimit: parseInt(process.env.DYNAMIC_RATE_LIMIT_MIN) || 50,
        maxRateLimit: parseInt(process.env.DYNAMIC_RATE_LIMIT_MAX) || 200,
        defaultRateLimit: parseInt(process.env.DYNAMIC_RATE_LIMIT_DEFAULT) || 100,
        
        // Monitoring and analysis intervals
        monitoringIntervalMs: parseInt(process.env.DYNAMIC_RATE_LIMIT_MONITOR_INTERVAL) || 60000, // 1 minute
        trafficAnalysisWindowMs: parseInt(process.env.DYNAMIC_RATE_LIMIT_ANALYSIS_WINDOW) || 300000, // 5 minutes
        
        // Prediction settings
        enablePrediction: process.env.DYNAMIC_RATE_LIMIT_ENABLE_PREDICTION !== 'false',
        predictionLookaheadMs: parseInt(process.env.DYNAMIC_RATE_LIMIT_PREDICTION_LOOKAHEAD) || 120000, // 2 minutes
        
        // Adjustment sensitivity (percentage change per adjustment)
        adjustmentSensitivity: parseFloat(process.env.DYNAMIC_RATE_LIMIT_SENSITIVITY) || 0.1, // 10%
        
        // Logging and monitoring
        enableLogging: process.env.DYNAMIC_RATE_LIMIT_ENABLE_LOGGING !== 'false',
        logRateLimitChanges: process.env.DYNAMIC_RATE_LIMIT_LOG_CHANGES !== 'false'
    },
    
    // Configuration for ChatEHR endpoints (healthcare-specific)
    chatEHR: {
        lowTrafficThreshold: 5, // Lower threshold for healthcare endpoints
        highTrafficThreshold: 50, // More conservative for medical data
        minRateLimit: 30,
        maxRateLimit: 150,
        defaultRateLimit: 80,
        adjustmentSensitivity: 0.05, // More gradual adjustments for healthcare
        enablePrediction: true
    },
    
    // Configuration for authentication endpoints
    auth: {
        lowTrafficThreshold: 2,
        highTrafficThreshold: 20,
        minRateLimit: 10,
        maxRateLimit: 50,
        defaultRateLimit: 25,
        adjustmentSensitivity: 0.15, // Quick response to auth traffic changes
        enablePrediction: true
    },
    
    // Configuration for API endpoints
    api: {
        lowTrafficThreshold: 15,
        highTrafficThreshold: 100,
        minRateLimit: 75,
        maxRateLimit: 300,
        defaultRateLimit: 150,
        adjustmentSensitivity: 0.1,
        enablePrediction: true
    },
    
    // Configuration for telehealth endpoints
    telehealth: {
        lowTrafficThreshold: 3,
        highTrafficThreshold: 30,
        minRateLimit: 20,
        maxRateLimit: 100,
        defaultRateLimit: 60,
        adjustmentSensitivity: 0.08, // Stable for real-time communication
        enablePrediction: true
    },
    
    // Emergency configuration (fallback to static limits)
    emergency: {
        enablePrediction: false,
        adjustmentSensitivity: 0, // No automatic adjustments
        defaultRateLimit: 50, // Conservative emergency limit
        enableLogging: true,
        logRateLimitChanges: true
    }
};