/**
 * Telepsychiatry Analytics Routes
 * Handles analytics reporting, community health data, and research pool
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage for demo purposes (use database/analytics platform in production)
const analyticsReports = new Map();
const communityData = new Map();
const researchData = new Map();
const deidentifiedData = new Map();

/**
 * POST /analytics/report
 * Submit Analytics - Sends findings to the admin dashboard with offline fallback
 */
router.post('/report', (req, res) => {
    try {
        const {
            sessionId,
            clinicianId,
            reportType,
            data,
            metrics,
            outcomes,
            culturalFactors,
            offline = false
        } = req.body;

        if (!sessionId || !reportType || !data) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Session ID, report type, and data are required'
            });
        }

        const reportId = uuidv4();
        const analyticsReport = {
            reportId,
            sessionId,
            clinicianId,
            reportType,
            data,
            metrics,
            outcomes,
            culturalFactors,
            timestamp: new Date().toISOString(),
            status: offline ? 'queued_for_sync' : 'submitted',
            submissionMethod: offline ? 'offline_cache' : 'real_time'
        };

        analyticsReports.set(reportId, analyticsReport);

        // Process for community health aggregation
        processForCommunityHealth(analyticsReport);

        // Process for research pool (if consented)
        if (data.researchConsent) {
            processForResearch(analyticsReport);
        }

        res.json({
            success: true,
            data: {
                reportId,
                status: analyticsReport.status,
                submissionMethod: analyticsReport.submissionMethod,
                timestamp: analyticsReport.timestamp,
                willSyncOnReconnect: offline
            }
        });
    } catch (error) {
        console.error('Error submitting analytics report:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to submit analytics report'
        });
    }
});

/**
 * GET /analytics/community
 * Public Health Dashboard - Displays region-specific public health summaries
 */
router.get('/community', (req, res) => {
    try {
        const {
            region,
            timeframe = '30d',
            demographic,
            condition,
            includePrivate = false
        } = req.query;

        // Aggregate community health data
        const communityStats = aggregateCommunityStats(region, timeframe, demographic, condition);
        
        // Filter private information unless authorized
        if (!includePrivate) {
            delete communityStats.detailedBreakdowns;
            delete communityStats.identifiablePatterns;
        }

        res.json({
            success: true,
            data: {
                region: region || 'all_regions',
                timeframe,
                demographic,
                condition,
                stats: communityStats,
                lastUpdated: new Date().toISOString(),
                dataPrivacy: 'aggregated_anonymous'
            }
        });
    } catch (error) {
        console.error('Error retrieving community analytics:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve community health data'
        });
    }
});

/**
 * GET /analytics/deidentified
 * Research Pool - Provides anonymized data for research purposes (opt-in)
 */
router.get('/deidentified', (req, res) => {
    try {
        const {
            researchId,
            dataType,
            condition,
            demographic,
            culturalContext,
            timeframe = '1y',
            limit = 1000
        } = req.query;

        if (!researchId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Research ID is required for accessing deidentified data'
            });
        }

        // Validate research authorization (mock validation)
        const researchAuth = validateResearchAccess(researchId);
        if (!researchAuth.valid) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Invalid or unauthorized research ID'
            });
        }

        // Filter and anonymize data based on criteria
        const deidentifiedDataset = filterAndAnonymizeData({
            dataType,
            condition,
            demographic,
            culturalContext,
            timeframe,
            limit
        });

        res.json({
            success: true,
            data: {
                researchId,
                dataset: deidentifiedDataset,
                metadata: {
                    totalRecords: deidentifiedDataset.length,
                    timeframe,
                    dataTypes: getDataTypes(deidentifiedDataset),
                    anonymizationLevel: 'full',
                    consentVerified: true
                },
                filters: {
                    dataType,
                    condition,
                    demographic,
                    culturalContext,
                    limit
                }
            }
        });
    } catch (error) {
        console.error('Error retrieving deidentified research data:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve research data'
        });
    }
});

/**
 * GET /analytics/dashboard
 * Admin analytics dashboard summary
 */
router.get('/dashboard', (req, res) => {
    try {
        const {
            timeframe = '7d',
            region,
            clinicianId
        } = req.query;

        // Generate dashboard metrics
        const dashboardData = generateDashboardMetrics(timeframe, region, clinicianId);

        res.json({
            success: true,
            data: {
                timeframe,
                region,
                clinicianId,
                metrics: dashboardData,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error generating dashboard analytics:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to generate dashboard analytics'
        });
    }
});

/**
 * POST /analytics/sync
 * Sync offline analytics data
 */
router.post('/sync', (req, res) => {
    try {
        const { offlineReports } = req.body;

        if (!Array.isArray(offlineReports)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'offlineReports must be an array'
            });
        }

        const syncResults = [];

        offlineReports.forEach(report => {
            try {
                const reportId = uuidv4();
                const syncedReport = {
                    ...report,
                    reportId,
                    syncedAt: new Date().toISOString(),
                    status: 'synced',
                    submissionMethod: 'offline_sync'
                };

                analyticsReports.set(reportId, syncedReport);

                // Process for community health and research
                processForCommunityHealth(syncedReport);
                if (report.data?.researchConsent) {
                    processForResearch(syncedReport);
                }

                syncResults.push({
                    originalId: report.localId,
                    reportId,
                    status: 'synced'
                });
            } catch (syncError) {
                syncResults.push({
                    originalId: report.localId,
                    status: 'error',
                    error: syncError.message
                });
            }
        });

        res.json({
            success: true,
            data: {
                syncResults,
                totalProcessed: offlineReports.length,
                successful: syncResults.filter(r => r.status === 'synced').length,
                failed: syncResults.filter(r => r.status === 'error').length
            }
        });
    } catch (error) {
        console.error('Error syncing offline analytics:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to sync offline analytics data'
        });
    }
});

// Helper functions
function processForCommunityHealth(report) {
    const region = report.data.region || 'unknown';
    
    if (!communityData.has(region)) {
        communityData.set(region, {
            totalSessions: 0,
            conditions: {},
            demographics: {},
            outcomes: {},
            culturalFactors: {}
        });
    }

    const regionData = communityData.get(region);
    regionData.totalSessions++;

    // Aggregate condition data
    if (report.data.conditions) {
        report.data.conditions.forEach(condition => {
            regionData.conditions[condition] = (regionData.conditions[condition] || 0) + 1;
        });
    }

    // Aggregate demographic data
    if (report.data.demographics) {
        Object.keys(report.data.demographics).forEach(key => {
            if (!regionData.demographics[key]) regionData.demographics[key] = {};
            const value = report.data.demographics[key];
            regionData.demographics[key][value] = (regionData.demographics[key][value] || 0) + 1;
        });
    }

    // Aggregate outcomes
    if (report.outcomes) {
        Object.keys(report.outcomes).forEach(outcome => {
            regionData.outcomes[outcome] = (regionData.outcomes[outcome] || 0) + 1;
        });
    }

    // Aggregate cultural factors
    if (report.culturalFactors) {
        Object.keys(report.culturalFactors).forEach(factor => {
            regionData.culturalFactors[factor] = (regionData.culturalFactors[factor] || 0) + 1;
        });
    }
}

function processForResearch(report) {
    // Create deidentified version for research
    const deidentified = {
        id: uuidv4(),
        timestamp: report.timestamp,
        reportType: report.reportType,
        demographics: anonymizeDemographics(report.data.demographics),
        conditions: report.data.conditions,
        outcomes: report.outcomes,
        culturalContext: report.culturalFactors?.culturalContext,
        sessionDuration: report.metrics?.sessionDuration,
        interventions: report.data.interventions,
        // Remove all identifying information
        sessionId: undefined,
        clinicianId: undefined,
        patientId: undefined
    };

    deidentifiedData.set(deidentified.id, deidentified);
}

function aggregateCommunityStats(region, timeframe, demographic, condition) {
    const stats = {
        totalSessions: 0,
        topConditions: [],
        demographicBreakdown: {},
        outcomeMetrics: {},
        culturalInsights: {},
        timeframeCoverage: timeframe
    };

    // Aggregate data from all regions or specific region
    const regionsToProcess = region ? [region] : Array.from(communityData.keys());

    regionsToProcess.forEach(regionKey => {
        const regionData = communityData.get(regionKey);
        if (!regionData) return;

        stats.totalSessions += regionData.totalSessions;

        // Merge conditions
        Object.keys(regionData.conditions).forEach(conditionKey => {
            stats.topConditions.push({
                condition: conditionKey,
                count: regionData.conditions[conditionKey]
            });
        });

        // Merge demographics
        Object.keys(regionData.demographics).forEach(demoKey => {
            if (!stats.demographicBreakdown[demoKey]) {
                stats.demographicBreakdown[demoKey] = {};
            }
            Object.keys(regionData.demographics[demoKey]).forEach(value => {
                const currentCount = stats.demographicBreakdown[demoKey][value] || 0;
                stats.demographicBreakdown[demoKey][value] = currentCount + regionData.demographics[demoKey][value];
            });
        });
    });

    // Sort top conditions
    stats.topConditions.sort((a, b) => b.count - a.count);
    stats.topConditions = stats.topConditions.slice(0, 10);

    return stats;
}

function validateResearchAccess(researchId) {
    // Mock research validation
    const validResearchIds = [
        'research-001',
        'research-002',
        'university-study-123'
    ];

    return {
        valid: validResearchIds.includes(researchId),
        permissions: validResearchIds.includes(researchId) ? ['read', 'aggregate'] : []
    };
}

function filterAndAnonymizeData(filters) {
    const results = [];

    for (const [id, data] of deidentifiedData.entries()) {
        let matches = true;

        if (filters.condition && !data.conditions?.includes(filters.condition)) {
            matches = false;
        }

        if (filters.culturalContext && data.culturalContext !== filters.culturalContext) {
            matches = false;
        }

        if (filters.dataType) {
            // Filter by data type (e.g., 'outcomes', 'demographics', 'interventions')
            if (!data[filters.dataType]) {
                matches = false;
            }
        }

        if (matches) {
            results.push(data);
        }

        if (results.length >= parseInt(filters.limit)) {
            break;
        }
    }

    return results;
}

function anonymizeDemographics(demographics) {
    if (!demographics) return null;

    // Anonymize demographic data
    return {
        ageRange: getAgeRange(demographics.age),
        gender: demographics.gender,
        ethnicity: demographics.ethnicity,
        region: demographics.region ? getRegionCategory(demographics.region) : null
        // Remove specific identifying information
    };
}

function getAgeRange(age) {
    if (!age) return 'unknown';
    const ageNum = parseInt(age);
    if (ageNum < 18) return '0-17';
    if (ageNum < 25) return '18-24';
    if (ageNum < 35) return '25-34';
    if (ageNum < 45) return '35-44';
    if (ageNum < 55) return '45-54';
    if (ageNum < 65) return '55-64';
    return '65+';
}

function getRegionCategory(region) {
    // Generalize regions to protect privacy
    const regionMappings = {
        'california': 'west_coast',
        'texas': 'southwest',
        'florida': 'southeast',
        'new_york': 'northeast'
    };
    
    return regionMappings[region.toLowerCase()] || 'other';
}

function generateDashboardMetrics(timeframe, region, clinicianId) {
    return {
        sessionsCompleted: Math.floor(Math.random() * 100) + 50,
        averageSessionDuration: '45 minutes',
        patientSatisfactionScore: 4.6,
        topConditionsTreated: [
            { condition: 'Anxiety Disorders', count: 45, percentage: 35 },
            { condition: 'Depression', count: 38, percentage: 30 },
            { condition: 'PTSD', count: 25, percentage: 20 },
            { condition: 'ADHD', count: 19, percentage: 15 }
        ],
        culturalDistribution: {
            'hispanic': 35,
            'asian': 25,
            'african_american': 20,
            'caucasian': 15,
            'other': 5
        },
        outcomeMetrics: {
            improvementRate: 78,
            completionRate: 85,
            followUpCompliance: 72
        },
        trends: {
            sessionGrowth: '+12%',
            satisfactionTrend: '+0.3',
            newPatients: 23
        }
    };
}

function getDataTypes(dataset) {
    const types = new Set();
    dataset.forEach(record => {
        Object.keys(record).forEach(key => {
            if (record[key] !== undefined && record[key] !== null) {
                types.add(key);
            }
        });
    });
    return Array.from(types);
}

// Initialize some sample data for demo
function initializeSampleAnalytics() {
    // Sample community data
    communityData.set('california', {
        totalSessions: 150,
        conditions: {
            'anxiety': 45,
            'depression': 38,
            'ptsd': 25,
            'adhd': 19
        },
        demographics: {
            'ethnicity': {
                'hispanic': 35,
                'asian': 25,
                'african_american': 20,
                'caucasian': 15
            }
        },
        outcomes: {
            'improved': 120,
            'maintained': 25,
            'declined': 5
        }
    });

    // Sample deidentified research data
    for (let i = 0; i < 50; i++) {
        const record = {
            id: uuidv4(),
            timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            reportType: 'session_outcome',
            demographics: {
                ageRange: ['18-24', '25-34', '35-44', '45-54'][Math.floor(Math.random() * 4)],
                gender: ['male', 'female', 'other'][Math.floor(Math.random() * 3)],
                ethnicity: ['hispanic', 'asian', 'african_american', 'caucasian'][Math.floor(Math.random() * 4)]
            },
            conditions: [['anxiety', 'depression', 'ptsd', 'adhd'][Math.floor(Math.random() * 4)]],
            outcomes: ['improved', 'maintained', 'declined'][Math.floor(Math.random() * 3)],
            culturalContext: ['hispanic', 'asian', 'african_american'][Math.floor(Math.random() * 3)],
            sessionDuration: Math.floor(Math.random() * 60) + 30,
            interventions: ['CBT', 'mindfulness', 'medication_management'][Math.floor(Math.random() * 3)]
        };
        
        deidentifiedData.set(record.id, record);
    }
}

// Initialize sample data
initializeSampleAnalytics();

module.exports = router;