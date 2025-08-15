/**
 * Dynamic Rate Limiting Service
 * Analyzes traffic patterns and adjusts rate limits dynamically
 * to optimize performance during varying traffic conditions
 */

const EventEmitter = require('events');

class DynamicRateLimitService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            // Traffic thresholds for adjusting rate limits
            lowTrafficThreshold: options.lowTrafficThreshold || 10,
            highTrafficThreshold: options.highTrafficThreshold || 80,
            
            // Rate limit boundaries
            minRateLimit: options.minRateLimit || 50,
            maxRateLimit: options.maxRateLimit || 200,
            defaultRateLimit: options.defaultRateLimit || 100,
            
            // Monitoring intervals
            monitoringIntervalMs: options.monitoringIntervalMs || 60000, // 1 minute
            trafficAnalysisWindowMs: options.trafficAnalysisWindowMs || 300000, // 5 minutes
            
            // Prediction settings
            enablePrediction: options.enablePrediction !== false,
            predictionLookaheadMs: options.predictionLookaheadMs || 120000, // 2 minutes
            
            // Adjustment sensitivity
            adjustmentSensitivity: options.adjustmentSensitivity || 0.1, // 10% changes
            
            // Logging
            enableLogging: options.enableLogging !== false,
            logRateLimitChanges: options.logRateLimitChanges !== false
        };
        
        // Traffic data storage
        this.trafficData = new Map(); // endpoint -> traffic history
        this.currentRateLimits = new Map(); // endpoint -> current rate limit
        this.lastAdjustment = new Map(); // endpoint -> timestamp of last adjustment
        
        // Start monitoring
        this.monitoringInterval = null;
        this.isMonitoring = false;
        
        if (this.config.enableLogging) {
            console.log('[Dynamic Rate Limit] Service initialized', { config: this.config });
        }
    }
    
    /**
     * Start monitoring traffic patterns
     */
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.analyzeTrafficAndAdjustLimits();
        }, this.config.monitoringIntervalMs);
        
        if (this.config.enableLogging) {
            console.log('[Dynamic Rate Limit] Monitoring started');
        }
        
        this.emit('monitoring-started');
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        if (this.config.enableLogging) {
            console.log('[Dynamic Rate Limit] Monitoring stopped');
        }
        
        this.emit('monitoring-stopped');
    }
    
    /**
     * Record traffic data for an endpoint
     */
    recordTraffic(endpoint, requestCount = 1, timestamp = Date.now()) {
        if (!this.trafficData.has(endpoint)) {
            this.trafficData.set(endpoint, []);
        }
        
        const traffic = this.trafficData.get(endpoint);
        traffic.push({ timestamp, requestCount });
        
        // Clean old data outside analysis window
        const cutoff = timestamp - this.config.trafficAnalysisWindowMs;
        const filteredTraffic = traffic.filter(entry => entry.timestamp >= cutoff);
        this.trafficData.set(endpoint, filteredTraffic);
        
        // Initialize rate limit if not set
        if (!this.currentRateLimits.has(endpoint)) {
            this.currentRateLimits.set(endpoint, this.config.defaultRateLimit);
        }
    }
    
    /**
     * Get current rate limit for an endpoint
     */
    getCurrentRateLimit(endpoint) {
        return this.currentRateLimits.get(endpoint) || this.config.defaultRateLimit;
    }
    
    /**
     * Calculate traffic rate for an endpoint
     */
    calculateTrafficRate(endpoint, windowMs = this.config.trafficAnalysisWindowMs) {
        const traffic = this.trafficData.get(endpoint) || [];
        const now = Date.now();
        const cutoff = now - windowMs;
        
        const recentTraffic = traffic.filter(entry => entry.timestamp >= cutoff);
        const totalRequests = recentTraffic.reduce((sum, entry) => sum + entry.requestCount, 0);
        const windowSeconds = windowMs / 1000;
        
        return {
            requestsPerSecond: totalRequests / windowSeconds,
            totalRequests,
            windowSeconds,
            dataPoints: recentTraffic.length
        };
    }
    
    /**
     * Analyze traffic patterns and adjust rate limits
     */
    analyzeTrafficAndAdjustLimits() {
        for (const [endpoint, traffic] of this.trafficData.entries()) {
            if (traffic.length === 0) continue;
            
            const trafficRate = this.calculateTrafficRate(endpoint);
            const currentLimit = this.getCurrentRateLimit(endpoint);
            const newLimit = this.adjustRateLimits(trafficRate.requestsPerSecond, currentLimit);
            
            if (newLimit !== currentLimit) {
                this.updateRateLimit(endpoint, newLimit, trafficRate);
            }
        }
    }
    
    /**
     * Core algorithm to adjust rate limits based on traffic
     */
    adjustRateLimits(currentTraffic, currentLimit) {
        // Apply the algorithm from the problem statement
        if (currentTraffic > this.config.highTrafficThreshold) {
            // High traffic: reduce rate limit to manage load
            const reductionFactor = 1 - this.config.adjustmentSensitivity;
            return Math.max(
                Math.floor(currentLimit * reductionFactor),
                this.config.minRateLimit
            );
        } else if (currentTraffic < this.config.lowTrafficThreshold) {
            // Low traffic: increase rate limit to improve performance
            const increaseFactor = 1 + this.config.adjustmentSensitivity;
            return Math.min(
                Math.ceil(currentLimit * increaseFactor),
                this.config.maxRateLimit
            );
        }
        
        // Normal traffic: keep current limit
        return currentLimit;
    }
    
    /**
     * Predict traffic surge and adjust proactively
     */
    predictTrafficSurge(endpoint) {
        if (!this.config.enablePrediction) return null;
        
        const traffic = this.trafficData.get(endpoint) || [];
        if (traffic.length < 3) return null;
        
        // Simple trend analysis - check if traffic is increasing
        const recent = traffic.slice(-3);
        const rates = recent.map(entry => entry.requestCount);
        
        // Calculate trend
        let isIncreasing = true;
        for (let i = 1; i < rates.length; i++) {
            if (rates[i] <= rates[i-1]) {
                isIncreasing = false;
                break;
            }
        }
        
        if (isIncreasing) {
            const growthRate = (rates[rates.length - 1] - rates[0]) / rates[0];
            if (growthRate > 0.5) { // 50% growth indicates potential surge
                return {
                    predicted: true,
                    growthRate,
                    recommendedAction: 'reduce_limits'
                };
            }
        }
        
        return { predicted: false };
    }
    
    /**
     * Update rate limit for an endpoint
     */
    updateRateLimit(endpoint, newLimit, trafficRate) {
        const oldLimit = this.currentRateLimits.get(endpoint);
        this.currentRateLimits.set(endpoint, newLimit);
        this.lastAdjustment.set(endpoint, Date.now());
        
        const change = {
            endpoint,
            oldLimit,
            newLimit,
            trafficRate,
            timestamp: Date.now(),
            reason: this.getRateLimitChangeReason(trafficRate.requestsPerSecond)
        };
        
        if (this.config.logRateLimitChanges) {
            console.log('[Dynamic Rate Limit] Rate limit adjusted', change);
        }
        
        this.emit('rate-limit-changed', change);
        return change;
    }
    
    /**
     * Get reason for rate limit change
     */
    getRateLimitChangeReason(trafficRate) {
        if (trafficRate > this.config.highTrafficThreshold) {
            return 'HIGH_TRAFFIC_DETECTED';
        } else if (trafficRate < this.config.lowTrafficThreshold) {
            return 'LOW_TRAFFIC_OPTIMIZATION';
        }
        return 'TRAFFIC_PATTERN_ADJUSTMENT';
    }
    
    /**
     * Get traffic statistics for an endpoint
     */
    getTrafficStats(endpoint) {
        const traffic = this.trafficData.get(endpoint) || [];
        const trafficRate = this.calculateTrafficRate(endpoint);
        const currentLimit = this.getCurrentRateLimit(endpoint);
        const lastAdjustment = this.lastAdjustment.get(endpoint);
        const prediction = this.predictTrafficSurge(endpoint);
        
        return {
            endpoint,
            currentLimit,
            trafficRate,
            lastAdjustment,
            prediction,
            totalDataPoints: traffic.length,
            monitoringActive: this.isMonitoring
        };
    }
    
    /**
     * Get all traffic statistics
     */
    getAllTrafficStats() {
        const stats = {};
        for (const endpoint of this.trafficData.keys()) {
            stats[endpoint] = this.getTrafficStats(endpoint);
        }
        return {
            endpoints: stats,
            config: this.config,
            monitoringActive: this.isMonitoring,
            totalEndpoints: this.trafficData.size
        };
    }
    
    /**
     * Reset traffic data and rate limits
     */
    reset() {
        this.trafficData.clear();
        this.currentRateLimits.clear();
        this.lastAdjustment.clear();
        
        if (this.config.enableLogging) {
            console.log('[Dynamic Rate Limit] Service reset');
        }
        
        this.emit('service-reset');
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        if (this.config.enableLogging) {
            console.log('[Dynamic Rate Limit] Configuration updated', { config: this.config });
        }
        
        this.emit('config-updated', this.config);
    }
}

module.exports = DynamicRateLimitService;