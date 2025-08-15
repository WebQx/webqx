/**
 * Telepsychiatry Workflow Routes
 * Handles triage queue and care planning workflows with priority queue support
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { PriorityTriageService } = require('../services/priorityTriageService');
const router = express.Router();

// Initialize priority-aware triage service
const priorityTriageService = new PriorityTriageService({
  maxQueueSize: 1000,
  enableMetrics: true,
  enableLogging: process.env.NODE_ENV === 'development'
});

// Legacy storage for non-triage data
const carePlans = new Map();
const culturalAdaptations = new Map();

/**
 * GET /workflow/triage
 * Priority-aware Triage Queue - Displays culturally adapted prompts with priority processing
 */
router.get('/triage', (req, res) => {
    try {
        const {
            status,
            priority,
            language = 'en',
            culturalContext,
            clinicianId,
            limit = 50
        } = req.query;

        // Use priority triage service for filtered results
        const filteredTriage = priorityTriageService.getFilteredTriageEntries({
            status,
            priority,
            language,
            culturalContext,
            clinicianId,
            limit
        });

        // Get queue metrics for monitoring
        const queueMetrics = priorityTriageService.getQueueMetrics();

        res.json({
            success: true,
            data: {
                triageQueue: filteredTriage,
                totalCount: filteredTriage.length,
                queueMetrics: queueMetrics,
                filters: {
                    status,
                    priority,
                    language,
                    culturalContext,
                    clinicianId
                }
            }
        });
    } catch (error) {
        console.error('Error retrieving triage queue:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve triage queue'
        });
    }
});

/**
 * POST /workflow/triage
 * Create new triage entry
 */
router.post('/triage', (req, res) => {
    try {
        const {
            patientId,
            symptoms,
            urgencyLevel,
            culturalContext,
            language = 'en',
            preferredClinician,
            notes
        } = req.body;

        if (!patientId || !symptoms) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Patient ID and symptoms are required'
            });
        }

        const triageId = uuidv4();
        const priority = determinePriority(symptoms, urgencyLevel);
        
        const triageEntry = {
            triageId,
            patientId,
            symptoms,
            priority,
            culturalContext,
            language,
            preferredClinician,
            notes,
            status: 'pending',
            createdAt: new Date().toISOString(),
            estimatedWaitTime: calculateEstimatedWaitTime(priority),
            culturallyAdaptedPrompts: generateCulturalPrompts(symptoms, culturalContext, language)
        };

        // Add to priority queue
        const queueItemId = priorityTriageService.addTriageEntry(triageEntry);

        res.json({
            success: true,
            data: {
                triageId,
                queueItemId,
                priority,
                estimatedWaitTime: triageEntry.estimatedWaitTime,
                culturallyAdaptedPrompts: triageEntry.culturallyAdaptedPrompts,
                status: 'pending'
            }
        });
    } catch (error) {
        console.error('Error creating triage entry:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create triage entry'
        });
    }
});

/**
 * PUT /workflow/triage/:id/assign
 * Assign triage entry to clinician
 */
router.put('/triage/:id/assign', (req, res) => {
    try {
        const { id: triageId } = req.params;
        const { clinicianId, notes } = req.body;

        const triage = triageQueue.get(triageId);
        if (!triage) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Triage entry not found'
            });
        }

        triage.assignedClinician = clinicianId;
        triage.status = 'assigned';
        triage.assignedAt = new Date().toISOString();
        if (notes) triage.assignmentNotes = notes;

        res.json({
            success: true,
            data: {
                triageId,
                assignedClinician: clinicianId,
                status: 'assigned',
                assignedAt: triage.assignedAt
            }
        });
    } catch (error) {
        console.error('Error assigning triage entry:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to assign triage entry'
        });
    }
});

/**
 * POST /workflow/plan
 * Generate Suggestions - Automatically composes care plans for the patient
 */
router.post('/plan', (req, res) => {
    try {
        const {
            patientId,
            sessionId,
            symptoms,
            assessmentData,
            culturalContext,
            language = 'en',
            clinicianId
        } = req.body;

        if (!patientId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Patient ID is required'
            });
        }

        const planId = uuidv4();
        const generatedPlan = generateCarePlan(symptoms, assessmentData, culturalContext, language);
        
        const carePlan = {
            planId,
            patientId,
            sessionId,
            clinicianId,
            culturalContext,
            language,
            status: 'draft',
            createdAt: new Date().toISOString(),
            ...generatedPlan
        };

        carePlans.set(planId, carePlan);

        res.json({
            success: true,
            data: {
                planId,
                carePlan: {
                    goals: carePlan.goals,
                    interventions: carePlan.interventions,
                    culturalAdaptations: carePlan.culturalAdaptations,
                    timeline: carePlan.timeline,
                    followUpSchedule: carePlan.followUpSchedule
                },
                status: 'draft'
            }
        });
    } catch (error) {
        console.error('Error generating care plan:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to generate care plan'
        });
    }
});

/**
 * GET /workflow/plan/:id
 * Get care plan by ID
 */
router.get('/plan/:id', (req, res) => {
    try {
        const { id: planId } = req.params;
        
        const carePlan = carePlans.get(planId);
        if (!carePlan) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Care plan not found'
            });
        }

        res.json({
            success: true,
            data: carePlan
        });
    } catch (error) {
        console.error('Error retrieving care plan:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve care plan'
        });
    }
});

/**
 * PUT /workflow/plan/:id/approve
 * Approve care plan
 */
router.put('/plan/:id/approve', (req, res) => {
    try {
        const { id: planId } = req.params;
        const { approvedBy, modifications } = req.body;

        const carePlan = carePlans.get(planId);
        if (!carePlan) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Care plan not found'
            });
        }

        carePlan.status = 'approved';
        carePlan.approvedBy = approvedBy;
        carePlan.approvedAt = new Date().toISOString();
        if (modifications) carePlan.modifications = modifications;

        res.json({
            success: true,
            data: {
                planId,
                status: 'approved',
                approvedBy,
                approvedAt: carePlan.approvedAt
            }
        });
    } catch (error) {
        console.error('Error approving care plan:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to approve care plan'
        });
    }
});

// Helper functions
function adaptTriageForCulture(triage, language, culturalContext) {
    const adapted = { ...triage };
    
    // Add culturally appropriate prompts
    adapted.culturallyAdaptedPrompts = generateCulturalPrompts(
        triage.symptoms, 
        culturalContext || triage.culturalContext, 
        language
    );
    
    return adapted;
}

function determinePriority(symptoms, urgencyLevel) {
    const urgentKeywords = ['suicide', 'self-harm', 'crisis', 'emergency', 'danger'];
    const highKeywords = ['severe', 'panic', 'psychosis', 'violent', 'threat'];
    
    const symptomsText = symptoms.join(' ').toLowerCase();
    
    if (urgencyLevel === 'urgent' || urgentKeywords.some(keyword => symptomsText.includes(keyword))) {
        return 'urgent';
    }
    
    if (urgencyLevel === 'high' || highKeywords.some(keyword => symptomsText.includes(keyword))) {
        return 'high';
    }
    
    if (urgencyLevel === 'low') {
        return 'low';
    }
    
    return 'medium';
}

function calculateEstimatedWaitTime(priority) {
    const baseTimes = {
        'urgent': 5,    // 5 minutes
        'high': 30,     // 30 minutes
        'medium': 120,  // 2 hours
        'low': 240      // 4 hours
    };
    
    return `${baseTimes[priority]} minutes`;
}

function generateCulturalPrompts(symptoms, culturalContext, language) {
    const prompts = {
        'en': {
            'hispanic': [
                "How does your family view mental health treatment?",
                "Are there cultural practices that help you cope with stress?",
                "Would you prefer to include family members in your treatment?"
            ],
            'asian': [
                "How important is maintaining harmony in your family?",
                "Do you use traditional healing practices alongside modern medicine?",
                "How do you typically express emotional distress in your culture?"
            ],
            'african_american': [
                "How has your community's experience with healthcare affected your trust?",
                "Are there community supports that are important to you?",
                "How do you typically cope with stress in your community?"
            ],
            'default': [
                "What cultural factors are important in your care?",
                "Are there family or community considerations we should include?",
                "What healing practices are meaningful to you?"
            ]
        },
        'es': {
            'hispanic': [
                "¿Cómo ve su familia el tratamiento de salud mental?",
                "¿Hay prácticas culturales que le ayuden a manejar el estrés?",
                "¿Preferiría incluir a miembros de la familia en su tratamiento?"
            ]
        }
    };
    
    const langPrompts = prompts[language] || prompts['en'];
    const contextPrompts = langPrompts[culturalContext] || langPrompts['default'] || langPrompts[Object.keys(langPrompts)[0]];
    
    return contextPrompts;
}

function generateCarePlan(symptoms, assessmentData, culturalContext, language) {
    // Mock care plan generation based on symptoms and cultural context
    const baseGoals = [
        "Reduce anxiety and stress levels",
        "Improve coping strategies",
        "Enhance overall mental well-being"
    ];
    
    const baseInterventions = [
        "Cognitive Behavioral Therapy (CBT)",
        "Mindfulness and relaxation techniques",
        "Regular follow-up sessions"
    ];
    
    const culturalAdaptations = generateCulturalAdaptations(culturalContext, language);
    
    return {
        goals: baseGoals,
        interventions: baseInterventions,
        culturalAdaptations,
        timeline: "8-12 weeks",
        followUpSchedule: [
            { type: "initial_follow_up", timeframe: "1 week" },
            { type: "progress_review", timeframe: "4 weeks" },
            { type: "outcome_assessment", timeframe: "8 weeks" }
        ],
        resources: generateCulturalResources(culturalContext, language)
    };
}

function generateCulturalAdaptations(culturalContext, language) {
    const adaptations = {
        'hispanic': [
            "Include family-centered approach to treatment",
            "Consider religious/spiritual practices in healing",
            "Provide materials in Spanish when needed"
        ],
        'asian': [
            "Respect for family hierarchy and decision-making",
            "Integration of traditional and Western approaches",
            "Consideration of stigma and face-saving concerns"
        ],
        'african_american': [
            "Address historical trauma and systemic issues",
            "Incorporate community and church support systems",
            "Consider cultural expressions of distress"
        ]
    };
    
    return adaptations[culturalContext] || [
        "Respect cultural values and beliefs",
        "Include culturally relevant coping strategies",
        "Consider family and community support systems"
    ];
}

function generateCulturalResources(culturalContext, language) {
    return [
        "Culturally appropriate support groups",
        "Community mental health resources",
        "Educational materials in preferred language",
        "Traditional healing practice integration options"
    ];
}

// Initialize some sample triage entries for demo
function initializeSampleTriage() {
    const sampleEntries = [
        {
            patientId: 'patient-123',
            symptoms: ['anxiety', 'sleep difficulties', 'work stress'],
            priority: 'medium',
            culturalContext: 'hispanic',
            language: 'es',
            status: 'pending'
        },
        {
            patientId: 'patient-456',
            symptoms: ['depression', 'isolation', 'family conflicts'],
            priority: 'high',
            culturalContext: 'asian',
            language: 'en',
            status: 'pending'
        }
    ];

    sampleEntries.forEach(entry => {
        const triageId = uuidv4();
        const triageEntry = {
            triageId,
            ...entry,
            createdAt: new Date().toISOString(),
            estimatedWaitTime: calculateEstimatedWaitTime(entry.priority),
            culturallyAdaptedPrompts: generateCulturalPrompts(entry.symptoms, entry.culturalContext, entry.language)
        };
        
        priorityTriageService.addTriageEntry(triageEntry);
    });
}

/**
 * GET /workflow/triage/next
 * Get next highest priority triage entry for processing
 */
router.get('/triage/next', (req, res) => {
    try {
        const nextEntry = priorityTriageService.getNextTriageEntry();
        
        if (!nextEntry) {
            return res.json({
                success: true,
                data: null,
                message: 'No pending triage entries'
            });
        }

        res.json({
            success: true,
            data: nextEntry
        });
    } catch (error) {
        console.error('Error getting next triage entry:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get next triage entry'
        });
    }
});

/**
 * PUT /workflow/triage/:queueItemId/complete
 * Mark triage entry as completed
 */
router.put('/triage/:queueItemId/complete', (req, res) => {
    try {
        const { queueItemId } = req.params;
        const { completionData } = req.body;

        const success = priorityTriageService.markTriageCompleted(queueItemId, completionData);
        
        if (!success) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Triage entry not found or not in processing state'
            });
        }

        res.json({
            success: true,
            message: 'Triage entry marked as completed'
        });
    } catch (error) {
        console.error('Error completing triage entry:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to complete triage entry'
        });
    }
});

/**
 * PUT /workflow/triage/:queueItemId/fail
 * Mark triage entry as failed and optionally requeue
 */
router.put('/triage/:queueItemId/fail', (req, res) => {
    try {
        const { queueItemId } = req.params;
        const { requeue = false, adjustedPriority } = req.body;

        const success = priorityTriageService.markTriageFailed(queueItemId, requeue, adjustedPriority);
        
        if (!success) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Triage entry not found or not in processing state'
            });
        }

        res.json({
            success: true,
            message: `Triage entry marked as failed${requeue ? ' and requeued' : ''}`
        });
    } catch (error) {
        console.error('Error failing triage entry:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to mark triage entry as failed'
        });
    }
});

/**
 * GET /workflow/triage/metrics
 * Get priority queue metrics and performance data
 */
router.get('/triage/metrics', (req, res) => {
    try {
        const metrics = priorityTriageService.getQueueMetrics();
        
        res.json({
            success: true,
            data: {
                metrics,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error getting triage metrics:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get triage metrics'
        });
    }
});

// Initialize sample data
initializeSampleTriage();

module.exports = router;

module.exports = router;