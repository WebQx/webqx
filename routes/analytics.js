/**
 * Data and Reporting API Routes for Telepsychiatry Platform
 * 
 * Handles anonymized data export, public health summaries, and analytical reporting
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const crypto = require('crypto');

const router = express.Router();

// In-memory storage for analytics data (use database in production)
const analyticsData = new Map();
const publicHealthSummaries = new Map();
const reportSubmissions = new Map();

// Mock data initialization
const initializeMockData = () => {
  // Sample deidentified patient data
  const mockPatientData = [
    {
      id: 'patient_001',
      demographics: {
        ageGroup: '25-34',
        gender: 'F',
        region: 'Northeast',
        language: 'en',
        culturalBackground: 'Hispanic/Latino'
      },
      conditions: ['Depression', 'Anxiety'],
      treatments: ['CBT', 'SSRI'],
      outcomes: {
        phq9_baseline: 15,
        phq9_followup: 8,
        gad7_baseline: 12,
        gad7_followup: 6,
        treatmentDuration: 16 // weeks
      },
      sessionData: {
        totalSessions: 12,
        completionRate: 0.85,
        satisfactionScore: 4.2
      }
    },
    {
      id: 'patient_002',
      demographics: {
        ageGroup: '35-44',
        gender: 'M',
        region: 'West',
        language: 'es',
        culturalBackground: 'Caucasian'
      },
      conditions: ['PTSD', 'Depression'],
      treatments: ['EMDR', 'Group Therapy'],
      outcomes: {
        pcl5_baseline: 45,
        pcl5_followup: 28,
        phq9_baseline: 18,
        phq9_followup: 12,
        treatmentDuration: 24
      },
      sessionData: {
        totalSessions: 18,
        completionRate: 0.92,
        satisfactionScore: 4.7
      }
    },
    {
      id: 'patient_003',
      demographics: {
        ageGroup: '18-24',
        gender: 'NB',
        region: 'South',
        language: 'en',
        culturalBackground: 'African American'
      },
      conditions: ['Anxiety', 'ADHD'],
      treatments: ['CBT', 'Medication Management'],
      outcomes: {
        gad7_baseline: 16,
        gad7_followup: 9,
        adhd_rating_baseline: 32,
        adhd_rating_followup: 18,
        treatmentDuration: 20
      },
      sessionData: {
        totalSessions: 15,
        completionRate: 0.78,
        satisfactionScore: 4.0
      }
    }
  ];

  mockPatientData.forEach(patient => {
    analyticsData.set(patient.id, patient);
  });

  // Initialize public health summaries
  const mockPublicHealthData = {
    'community-mental-health-2024': {
      id: 'community-mental-health-2024',
      title: 'Community Mental Health Summary 2024',
      region: 'National',
      timeframe: '2024-Q1-Q3',
      summary: {
        totalPatients: 1247,
        demographics: {
          ageGroups: {
            '18-24': 23.5,
            '25-34': 31.2,
            '35-44': 22.8,
            '45-54': 15.3,
            '55-64': 5.9,
            '65+': 1.3
          },
          genderDistribution: {
            'F': 58.2,
            'M': 38.7,
            'NB': 2.8,
            'Other': 0.3
          },
          culturalBackgrounds: {
            'Caucasian': 45.6,
            'Hispanic/Latino': 23.1,
            'African American': 15.8,
            'Asian': 8.9,
            'Native American': 3.2,
            'Other': 3.4
          }
        },
        conditions: {
          'Depression': 45.2,
          'Anxiety': 38.7,
          'PTSD': 12.3,
          'Bipolar': 8.9,
          'ADHD': 15.6,
          'Substance Use': 6.7
        },
        treatments: {
          'CBT': 52.3,
          'EMDR': 8.9,
          'Group Therapy': 23.4,
          'Medication Management': 67.8,
          'Family Therapy': 12.1
        },
        outcomes: {
          averageImprovement: {
            'PHQ-9': 42.3, // percentage improvement
            'GAD-7': 38.9,
            'PCL-5': 35.7
          },
          completionRates: {
            overall: 78.5,
            byCondition: {
              'Depression': 82.1,
              'Anxiety': 79.3,
              'PTSD': 71.2
            }
          },
          satisfactionScore: 4.3
        }
      },
      trends: {
        monthlyUtilization: [
          { month: '2024-01', sessions: 892 },
          { month: '2024-02', sessions: 943 },
          { month: '2024-03', sessions: 1021 },
          { month: '2024-04', sessions: 1156 },
          { month: '2024-05', sessions: 1203 },
          { month: '2024-06', sessions: 1287 },
          { month: '2024-07', sessions: 1334 },
          { month: '2024-08', sessions: 1298 },
          { month: '2024-09', sessions: 1245 }
        ],
        emergingConcerns: [
          'Increased anxiety among young adults',
          'Rising demand for trauma-informed care',
          'Need for culturally adapted interventions'
        ]
      },
      generatedAt: new Date().toISOString()
    }
  };

  Object.values(mockPublicHealthData).forEach(summary => {
    publicHealthSummaries.set(summary.id, summary);
  });
};

// Initialize mock data
initializeMockData();

// Middleware to validate session/auth
const requireAuth = (req, res, next) => {
  const sessionId = req.cookies?.sessionId || req.headers['x-session-id'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }
  
  // Mock user for demo - in real implementation, validate with userService
  req.user = { 
    id: 'user-123', 
    role: 'PROVIDER', 
    name: 'Dr. Smith',
    permissions: ['analytics.read', 'analytics.export', 'reports.submit']
  };
  next();
};

// Middleware to check admin permissions for sensitive data
const requireAdminAuth = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && !req.user.permissions?.includes('analytics.admin')) {
    return res.status(403).json({
      error: 'ACCESS_DENIED',
      message: 'Administrator privileges required'
    });
  }
  next();
};

// Data anonymization helper
const anonymizePatientData = (patientData) => {
  return {
    id: crypto.createHash('sha256').update(patientData.id).digest('hex').substring(0, 16),
    demographics: patientData.demographics,
    conditions: patientData.conditions,
    treatments: patientData.treatments,
    outcomes: patientData.outcomes,
    sessionData: {
      totalSessions: patientData.sessionData.totalSessions,
      completionRate: patientData.sessionData.completionRate,
      satisfactionScore: patientData.sessionData.satisfactionScore
    }
  };
};

/**
 * GET /analytics/deidentified
 * Exports anonymized data for research purposes
 */
router.get('/deidentified',
  requireAuth,
  [
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be in ISO 8601 format'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be in ISO 8601 format'),
    query('conditions')
      .optional()
      .isString()
      .withMessage('Conditions must be a comma-separated string'),
    query('ageGroup')
      .optional()
      .isIn(['18-24', '25-34', '35-44', '45-54', '55-64', '65+'])
      .withMessage('Invalid age group'),
    query('region')
      .optional()
      .isIn(['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West', 'National'])
      .withMessage('Invalid region'),
    query('format')
      .optional()
      .isIn(['json', 'csv'])
      .withMessage('Format must be json or csv'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array()
        });
      }

      const {
        dateFrom,
        dateTo,
        conditions,
        ageGroup,
        region,
        format = 'json',
        limit = 100
      } = req.query;

      // Filter and anonymize patient data
      let filteredData = Array.from(analyticsData.values());

      if (conditions) {
        const conditionList = conditions.split(',').map(c => c.trim());
        filteredData = filteredData.filter(patient => 
          patient.conditions.some(condition => 
            conditionList.includes(condition)
          )
        );
      }

      if (ageGroup) {
        filteredData = filteredData.filter(patient => 
          patient.demographics.ageGroup === ageGroup
        );
      }

      if (region) {
        filteredData = filteredData.filter(patient => 
          patient.demographics.region === region
        );
      }

      // Apply limit
      filteredData = filteredData.slice(0, parseInt(limit));

      // Anonymize data
      const anonymizedData = filteredData.map(anonymizePatientData);

      // Generate aggregated statistics
      const statistics = {
        totalRecords: anonymizedData.length,
        demographics: {
          ageGroups: {},
          genders: {},
          regions: {},
          languages: {},
          culturalBackgrounds: {}
        },
        conditions: {},
        treatments: {},
        outcomes: {
          averageImprovements: {},
          completionRates: [],
          satisfactionScores: []
        }
      };

      // Calculate statistics
      anonymizedData.forEach(patient => {
        // Demographics
        const demo = patient.demographics;
        statistics.demographics.ageGroups[demo.ageGroup] = 
          (statistics.demographics.ageGroups[demo.ageGroup] || 0) + 1;
        statistics.demographics.genders[demo.gender] = 
          (statistics.demographics.genders[demo.gender] || 0) + 1;
        statistics.demographics.regions[demo.region] = 
          (statistics.demographics.regions[demo.region] || 0) + 1;
        statistics.demographics.languages[demo.language] = 
          (statistics.demographics.languages[demo.language] || 0) + 1;
        statistics.demographics.culturalBackgrounds[demo.culturalBackground] = 
          (statistics.demographics.culturalBackgrounds[demo.culturalBackground] || 0) + 1;

        // Conditions
        patient.conditions.forEach(condition => {
          statistics.conditions[condition] = (statistics.conditions[condition] || 0) + 1;
        });

        // Treatments
        patient.treatments.forEach(treatment => {
          statistics.treatments[treatment] = (statistics.treatments[treatment] || 0) + 1;
        });

        // Outcomes
        statistics.outcomes.completionRates.push(patient.sessionData.completionRate);
        statistics.outcomes.satisfactionScores.push(patient.sessionData.satisfactionScore);
      });

      // Calculate averages
      if (statistics.outcomes.completionRates.length > 0) {
        statistics.outcomes.averageCompletionRate = 
          statistics.outcomes.completionRates.reduce((a, b) => a + b, 0) / statistics.outcomes.completionRates.length;
      }

      if (statistics.outcomes.satisfactionScores.length > 0) {
        statistics.outcomes.averageSatisfactionScore = 
          statistics.outcomes.satisfactionScores.reduce((a, b) => a + b, 0) / statistics.outcomes.satisfactionScores.length;
      }

      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: req.user.id,
          datasetId: `export_${Date.now()}`,
          filters: {
            dateFrom,
            dateTo,
            conditions: conditions?.split(','),
            ageGroup,
            region,
            limit: parseInt(limit)
          },
          anonymizationMethod: 'SHA-256 hashing with demographic preservation',
          complianceNote: 'All personally identifiable information removed'
        },
        statistics,
        data: anonymizedData
      };

      // Return data in requested format
      if (format === 'csv') {
        // Convert to CSV format
        const csvHeader = 'PatientID,AgeGroup,Gender,Region,Language,CulturalBackground,Conditions,Treatments,TotalSessions,CompletionRate,SatisfactionScore\n';
        const csvRows = anonymizedData.map(patient => {
          return [
            patient.id,
            patient.demographics.ageGroup,
            patient.demographics.gender,
            patient.demographics.region,
            patient.demographics.language,
            patient.demographics.culturalBackground,
            patient.conditions.join(';'),
            patient.treatments.join(';'),
            patient.sessionData.totalSessions,
            patient.sessionData.completionRate,
            patient.sessionData.satisfactionScore
          ].join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="telepsychiatry_data_${Date.now()}.csv"`);
        res.send(csvHeader + csvRows);
      } else {
        res.json(exportData);
      }

    } catch (error) {
      console.error('[Analytics API] Export deidentified data error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to export anonymized data'
      });
    }
  }
);

/**
 * GET /analytics/community
 * Provides public health summaries
 */
router.get('/community',
  requireAuth,
  [
    query('region')
      .optional()
      .isIn(['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West', 'National'])
      .withMessage('Invalid region'),
    query('timeframe')
      .optional()
      .isString()
      .withMessage('Timeframe must be a string'),
    query('includesTrends')
      .optional()
      .isBoolean()
      .withMessage('Include trends must be a boolean'),
    query('summaryType')
      .optional()
      .isIn(['overview', 'detailed', 'trends'])
      .withMessage('Invalid summary type')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array()
        });
      }

      const {
        region,
        timeframe,
        includesTrends = true,
        summaryType = 'overview'
      } = req.query;

      // Filter public health summaries
      let summaries = Array.from(publicHealthSummaries.values());

      if (region && region !== 'National') {
        summaries = summaries.filter(summary => 
          summary.region === region || summary.region === 'National'
        );
      }

      if (timeframe) {
        summaries = summaries.filter(summary => 
          summary.timeframe.includes(timeframe)
        );
      }

      // Sort by most recent
      summaries.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));

      // Format summaries based on type
      const formattedSummaries = summaries.map(summary => {
        const formatted = {
          id: summary.id,
          title: summary.title,
          region: summary.region,
          timeframe: summary.timeframe,
          generatedAt: summary.generatedAt
        };

        if (summaryType === 'overview' || summaryType === 'detailed') {
          formatted.summary = {
            totalPatients: summary.summary.totalPatients,
            topConditions: Object.entries(summary.summary.conditions)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([condition, percentage]) => ({ condition, percentage })),
            demographics: summary.summary.demographics,
            outcomes: summary.summary.outcomes
          };
        }

        if (summaryType === 'detailed') {
          formatted.fullSummary = summary.summary;
        }

        if ((summaryType === 'trends' || includesTrends) && summary.trends) {
          formatted.trends = summary.trends;
        }

        return formatted;
      });

      // Generate insights
      const insights = {
        totalSummaries: formattedSummaries.length,
        latestPeriod: formattedSummaries.length > 0 ? formattedSummaries[0].timeframe : null,
        keyFindings: [
          'Mental health service utilization continues to grow',
          'Anxiety and depression remain the most common conditions',
          'Telepsychiatry shows positive treatment outcomes',
          'Cultural adaptation improves engagement rates'
        ],
        recommendations: [
          'Expand access to underserved populations',
          'Invest in culturally competent care models',
          'Enhance early intervention programs',
          'Strengthen provider training in telepsychiatry'
        ]
      };

      res.json({
        summaries: formattedSummaries,
        insights,
        metadata: {
          requestedAt: new Date().toISOString(),
          filters: { region, timeframe, summaryType },
          dataSourceNote: 'Aggregated from anonymized patient records'
        }
      });

    } catch (error) {
      console.error('[Analytics API] Get community summaries error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve public health summaries'
      });
    }
  }
);

/**
 * POST /analytics/report
 * Submits analytical findings to the admin dashboard
 */
router.post('/report',
  requireAuth,
  [
    body('title')
      .notEmpty()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters'),
    body('type')
      .isIn(['outcome_analysis', 'utilization_report', 'quality_metrics', 'research_findings', 'safety_report'])
      .withMessage('Valid report type is required'),
    body('summary')
      .notEmpty()
      .isLength({ min: 20, max: 1000 })
      .withMessage('Summary must be between 20 and 1000 characters'),
    body('findings')
      .isArray()
      .withMessage('Findings must be an array'),
    body('data')
      .optional()
      .isObject()
      .withMessage('Data must be an object'),
    body('recommendations')
      .optional()
      .isArray()
      .withMessage('Recommendations must be an array'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid priority level'),
    body('confidential')
      .optional()
      .isBoolean()
      .withMessage('Confidential must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid report data',
          details: errors.array()
        });
      }

      const {
        title,
        type,
        summary,
        findings,
        data = {},
        recommendations = [],
        priority = 'medium',
        confidential = false,
        tags = []
      } = req.body;

      const reportId = `report_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const timestamp = new Date().toISOString();

      const report = {
        id: reportId,
        title,
        type,
        summary,
        findings,
        data,
        recommendations,
        priority,
        confidential,
        tags,
        metadata: {
          submittedBy: req.user.id,
          submitterName: req.user.name,
          submittedAt: timestamp,
          status: 'submitted',
          reviewStatus: 'pending',
          version: '1.0'
        }
      };

      // Store the report
      reportSubmissions.set(reportId, report);

      // Generate report summary for response
      const reportSummary = {
        reportId,
        status: 'submitted',
        title: report.title,
        type: report.type,
        priority: report.priority,
        findingsCount: findings.length,
        recommendationsCount: recommendations.length,
        submittedAt: timestamp,
        estimatedReviewTime: priority === 'critical' ? '2-4 hours' : 
                           priority === 'high' ? '1-2 days' : 
                           priority === 'medium' ? '3-5 days' : '1-2 weeks'
      };

      // Send notification to admin dashboard (mock)
      const notificationId = `notification_${Date.now()}`;
      console.log(`[Admin Dashboard] New ${priority} priority report submitted: ${title}`);

      res.status(201).json({
        reportId,
        status: 'submitted',
        reportSummary,
        notificationId,
        nextSteps: [
          'Report submitted to admin dashboard',
          'Automated analysis will be performed',
          'Admin team will review findings',
          'Follow-up communication as needed'
        ],
        message: 'Analytical report submitted successfully'
      });

    } catch (error) {
      console.error('[Analytics API] Submit report error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to submit analytical report'
      });
    }
  }
);

/**
 * GET /analytics/reports
 * Lists submitted reports (admin only)
 */
router.get('/reports',
  requireAuth,
  requireAdminAuth,
  [
    query('type')
      .optional()
      .isIn(['outcome_analysis', 'utilization_report', 'quality_metrics', 'research_findings', 'safety_report'])
      .withMessage('Invalid report type'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid priority level'),
    query('status')
      .optional()
      .isIn(['submitted', 'under_review', 'approved', 'rejected'])
      .withMessage('Invalid status'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array()
        });
      }

      const { type, priority, status, limit = 50 } = req.query;

      // Filter reports
      let reports = Array.from(reportSubmissions.values());

      if (type) {
        reports = reports.filter(report => report.type === type);
      }

      if (priority) {
        reports = reports.filter(report => report.priority === priority);
      }

      if (status) {
        reports = reports.filter(report => report.metadata.reviewStatus === status);
      }

      // Sort by submission date (most recent first)
      reports.sort((a, b) => new Date(b.metadata.submittedAt) - new Date(a.metadata.submittedAt));

      // Apply limit
      reports = reports.slice(0, parseInt(limit));

      // Generate summary statistics
      const allReports = Array.from(reportSubmissions.values());
      const statistics = {
        total: allReports.length,
        byType: {},
        byPriority: {},
        byStatus: {},
        recentActivity: allReports.filter(r => 
          new Date(r.metadata.submittedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length
      };

      allReports.forEach(report => {
        statistics.byType[report.type] = (statistics.byType[report.type] || 0) + 1;
        statistics.byPriority[report.priority] = (statistics.byPriority[report.priority] || 0) + 1;
        statistics.byStatus[report.metadata.reviewStatus] = (statistics.byStatus[report.metadata.reviewStatus] || 0) + 1;
      });

      // Sanitize reports for response
      const sanitizedReports = reports.map(report => ({
        id: report.id,
        title: report.title,
        type: report.type,
        summary: report.summary,
        priority: report.priority,
        findingsCount: report.findings.length,
        recommendationsCount: report.recommendations.length,
        submittedBy: report.metadata.submitterName,
        submittedAt: report.metadata.submittedAt,
        reviewStatus: report.metadata.reviewStatus,
        confidential: report.confidential
      }));

      res.json({
        reports: sanitizedReports,
        statistics,
        metadata: {
          retrievedAt: new Date().toISOString(),
          filters: { type, priority, status, limit: parseInt(limit) },
          totalAvailable: Array.from(reportSubmissions.values()).length
        }
      });

    } catch (error) {
      console.error('[Analytics API] Get reports error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve reports'
      });
    }
  }
);

module.exports = router;