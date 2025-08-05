/**
 * Clinical Workflow Automation API Routes for Telepsychiatry Platform
 * 
 * Provides culturally adapted triage prompts and automated care plan generation
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const crypto = require('crypto');

const router = express.Router();

// In-memory storage for workflow data (use database in production)
const triageProfiles = new Map();
const carePlans = new Map();
const workflowTemplates = new Map();

// Initialize default triage prompts and templates
const initializeDefaultWorkflows = () => {
  // Cultural triage prompts for different regions/languages
  const culturalTriagePrompts = {
    'en-US': {
      id: 'triage-en-us',
      language: 'en',
      region: 'US',
      culture: 'Western',
      prompts: {
        greeting: "Hello, I'm here to help assess your mental health needs today. How are you feeling?",
        moodAssessment: "On a scale of 1-10, how would you rate your overall mood this week?",
        sleepPattern: "Have you experienced any changes in your sleep patterns recently?",
        appetite: "Have you noticed any changes in your appetite or eating habits?",
        socialInteraction: "How comfortable do you feel in social situations lately?",
        stressFactors: "What are the main sources of stress in your life right now?",
        culturalFactors: "Are there any cultural or family expectations affecting your wellbeing?",
        emergency: "Are you having thoughts of hurting yourself or others?"
      },
      flowLogic: {
        emergencyThreshold: 8,
        severeThreshold: 7,
        moderateThreshold: 5,
        followUpQuestions: {
          high: ["Tell me more about these feelings", "When did this start?"],
          moderate: ["How long have you been feeling this way?", "What helps you cope?"],
          low: ["What's going well in your life?", "Any recent positive changes?"]
        }
      }
    },
    'es-ES': {
      id: 'triage-es-es',
      language: 'es',
      region: 'ES',
      culture: 'Mediterranean',
      prompts: {
        greeting: "Hola, estoy aquí para ayudar a evaluar sus necesidades de salud mental hoy. ¿Cómo se siente?",
        moodAssessment: "En una escala del 1 al 10, ¿cómo calificaría su estado de ánimo general esta semana?",
        sleepPattern: "¿Ha experimentado algún cambio en sus patrones de sueño recientemente?",
        appetite: "¿Ha notado algún cambio en su apetito o hábitos alimentarios?",
        socialInteraction: "¿Qué tan cómodo se siente en situaciones sociales últimamente?",
        stressFactors: "¿Cuáles son las principales fuentes de estrés en su vida ahora mismo?",
        culturalFactors: "¿Hay expectativas culturales o familiares que afecten su bienestar?",
        emergency: "¿Está teniendo pensamientos de hacerse daño a sí mismo o a otros?"
      },
      flowLogic: {
        emergencyThreshold: 8,
        severeThreshold: 7,
        moderateThreshold: 5,
        followUpQuestions: {
          high: ["Cuénteme más sobre estos sentimientos", "¿Cuándo comenzó esto?"],
          moderate: ["¿Cuánto tiempo se ha sentido así?", "¿Qué le ayuda a sobrellevar?"],
          low: ["¿Qué va bien en su vida?", "¿Algún cambio positivo reciente?"]
        }
      }
    },
    'ar-SA': {
      id: 'triage-ar-sa',
      language: 'ar',
      region: 'SA',
      culture: 'Middle Eastern',
      prompts: {
        greeting: "السلام عليكم، أنا هنا لمساعدتك في تقييم احتياجاتك للصحة النفسية اليوم. كيف تشعر؟",
        moodAssessment: "على مقياس من 1 إلى 10، كيف تقيم مزاجك العام هذا الأسبوع؟",
        sleepPattern: "هل واجهت أي تغييرات في أنماط نومك مؤخراً؟",
        appetite: "هل لاحظت أي تغييرات في شهيتك أو عادات الأكل؟",
        socialInteraction: "كيف تشعر بالراحة في المواقف الاجتماعية مؤخراً؟",
        stressFactors: "ما هي مصادر التوتر الرئيسية في حياتك الآن؟",
        culturalFactors: "هل هناك توقعات ثقافية أو عائلية تؤثر على رفاهيتك؟",
        emergency: "هل لديك أفكار إيذاء نفسك أو الآخرين؟"
      },
      flowLogic: {
        emergencyThreshold: 8,
        severeThreshold: 7,
        moderateThreshold: 5,
        followUpQuestions: {
          high: ["أخبرني المزيد عن هذه المشاعر", "متى بدأ هذا؟"],
          moderate: ["كم من الوقت تشعر بهذا؟", "ما الذي يساعدك على التأقلم؟"],
          low: ["ما الذي يسير بشكل جيد في حياتك؟", "أي تغييرات إيجابية حديثة؟"]
        }
      }
    }
  };

  // Care plan templates
  const carePlanTemplates = {
    'depression-mild': {
      id: 'depression-mild',
      condition: 'Depression',
      severity: 'mild',
      template: {
        goals: [
          'Improve mood and emotional regulation',
          'Increase daily activity levels',
          'Develop coping strategies'
        ],
        interventions: [
          {
            type: 'therapy',
            intervention: 'Cognitive Behavioral Therapy (CBT)',
            frequency: 'Weekly sessions for 12 weeks',
            priority: 'high'
          },
          {
            type: 'lifestyle',
            intervention: 'Regular exercise routine',
            frequency: '30 minutes, 3 times per week',
            priority: 'medium'
          },
          {
            type: 'monitoring',
            intervention: 'Daily mood tracking',
            frequency: 'Daily via mobile app',
            priority: 'medium'
          }
        ],
        medications: [],
        followUp: {
          initial: '2 weeks',
          ongoing: '4 weeks',
          emergency: 'Contact provider if symptoms worsen'
        }
      }
    },
    'anxiety-moderate': {
      id: 'anxiety-moderate',
      condition: 'Anxiety',
      severity: 'moderate',
      template: {
        goals: [
          'Reduce anxiety symptoms',
          'Improve stress management',
          'Enhance quality of life'
        ],
        interventions: [
          {
            type: 'therapy',
            intervention: 'Exposure Response Prevention (ERP)',
            frequency: 'Bi-weekly sessions for 16 weeks',
            priority: 'high'
          },
          {
            type: 'medication',
            intervention: 'SSRI consideration',
            frequency: 'As prescribed by psychiatrist',
            priority: 'medium'
          },
          {
            type: 'lifestyle',
            intervention: 'Mindfulness meditation',
            frequency: '10 minutes daily',
            priority: 'medium'
          }
        ],
        medications: [
          {
            class: 'SSRI',
            examples: ['Sertraline', 'Escitalopram'],
            considerations: 'Start low, titrate slowly'
          }
        ],
        followUp: {
          initial: '1 week',
          ongoing: '2 weeks',
          emergency: '24/7 crisis hotline available'
        }
      }
    }
  };

  // Store initial data
  Object.values(culturalTriagePrompts).forEach(prompt => {
    triageProfiles.set(prompt.id, prompt);
  });

  Object.values(carePlanTemplates).forEach(template => {
    workflowTemplates.set(template.id, template);
  });
};

// Initialize on module load
initializeDefaultWorkflows();

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
  req.user = { id: 'user-123', role: 'PROVIDER', name: 'Dr. Smith', preferredLanguage: 'en' };
  next();
};

/**
 * GET /workflow/triage
 * Provides culturally adapted triage prompts based on language/region
 */
router.get('/triage',
  requireAuth,
  [
    query('language')
      .optional()
      .isLength({ min: 2, max: 5 })
      .withMessage('Language must be 2-5 characters'),
    query('region')
      .optional()
      .isAlpha()
      .isLength({ min: 2, max: 2 })
      .withMessage('Region must be 2-letter country code'),
    query('culture')
      .optional()
      .isString()
      .withMessage('Culture must be a string'),
    query('patientAge')
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage('Patient age must be between 0 and 120'),
    query('severity')
      .optional()
      .isIn(['low', 'moderate', 'high', 'emergency'])
      .withMessage('Invalid severity level')
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
        language = req.user.preferredLanguage || 'en',
        region = 'US',
        culture,
        patientAge,
        severity
      } = req.query;

      // Find best matching triage profile
      const profileKey = `${language.toLowerCase()}-${region.toUpperCase()}`;
      let triageProfile = triageProfiles.get(`triage-${profileKey}`);

      // Fallback to English if specific language/region not found
      if (!triageProfile) {
        triageProfile = triageProfiles.get('triage-en-us');
      }

      if (!triageProfile) {
        return res.status(404).json({
          error: 'TRIAGE_PROFILE_NOT_FOUND',
          message: 'No triage profile available for the specified criteria'
        });
      }

      // Customize prompts based on patient age
      let customizedPrompts = { ...triageProfile.prompts };
      
      if (patientAge && parseInt(patientAge) < 18) {
        // Adapt language for minors
        customizedPrompts.greeting = customizedPrompts.greeting.replace(
          'How are you feeling?',
          'How have you been feeling lately? It\'s okay to share with me.'
        );
        customizedPrompts.moodAssessment = 'Using our feeling faces chart, how would you describe your mood this week?';
      } else if (patientAge && parseInt(patientAge) > 65) {
        // Adapt language for seniors
        customizedPrompts.greeting = 'Good day. I\'m here to discuss how you\'ve been feeling and help identify the best support for you.';
      }

      // Filter prompts based on severity if specified
      let selectedPrompts = customizedPrompts;
      if (severity) {
        const priorityPrompts = {
          'emergency': ['greeting', 'emergency', 'stressFactors'],
          'high': ['greeting', 'moodAssessment', 'emergency', 'sleepPattern', 'stressFactors'],
          'moderate': ['greeting', 'moodAssessment', 'sleepPattern', 'appetite', 'socialInteraction'],
          'low': ['greeting', 'moodAssessment', 'socialInteraction']
        };

        if (priorityPrompts[severity]) {
          selectedPrompts = {};
          priorityPrompts[severity].forEach(key => {
            if (customizedPrompts[key]) {
              selectedPrompts[key] = customizedPrompts[key];
            }
          });
        }
      }

      // Generate triage flow
      const triageFlow = {
        sessionId: `triage_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        profile: {
          language: triageProfile.language,
          region: triageProfile.region,
          culture: triageProfile.culture
        },
        prompts: selectedPrompts,
        flowLogic: triageProfile.flowLogic,
        metadata: {
          patientAge: patientAge ? parseInt(patientAge) : null,
          severityFilter: severity || null,
          adaptedFor: patientAge ? (parseInt(patientAge) < 18 ? 'minor' : parseInt(patientAge) > 65 ? 'senior' : 'adult') : 'adult',
          generatedAt: new Date().toISOString(),
          estimatedDuration: Object.keys(selectedPrompts).length * 2 // 2 minutes per prompt
        }
      };

      res.json({
        triageFlow,
        instructions: {
          usage: 'Present prompts in order, use follow-up questions based on responses',
          scoring: 'Rate responses 1-10, apply thresholds from flowLogic',
          emergency: 'If emergency threshold exceeded, escalate immediately',
          culturalNotes: culture ? `Adapted for ${culture} cultural context` : 'Standard cultural adaptation applied'
        },
        availableProfiles: Array.from(triageProfiles.keys()),
        supportedLanguages: [...new Set(Array.from(triageProfiles.values()).map(p => p.language))]
      });

    } catch (error) {
      console.error('[Workflow API] Get triage error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve triage prompts'
      });
    }
  }
);

/**
 * POST /workflow/plan
 * Automatically generates care plans based on assessment data
 */
router.post('/plan',
  requireAuth,
  [
    body('patientId')
      .notEmpty()
      .withMessage('Patient ID is required'),
    body('assessmentData')
      .isObject()
      .withMessage('Assessment data is required'),
    body('assessmentData.primaryCondition')
      .notEmpty()
      .withMessage('Primary condition is required'),
    body('assessmentData.severity')
      .isIn(['mild', 'moderate', 'severe', 'critical'])
      .withMessage('Valid severity level is required'),
    body('assessmentData.symptoms')
      .isArray()
      .withMessage('Symptoms must be an array'),
    body('preferences')
      .optional()
      .isObject()
      .withMessage('Preferences must be an object'),
    body('culturalFactors')
      .optional()
      .isObject()
      .withMessage('Cultural factors must be an object'),
    body('language')
      .optional()
      .isLength({ min: 2, max: 5 })
      .withMessage('Language must be 2-5 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid care plan data',
          details: errors.array()
        });
      }

      const {
        patientId,
        assessmentData,
        preferences = {},
        culturalFactors = {},
        language = 'en'
      } = req.body;

      const { primaryCondition, severity, symptoms, comorbidities = [] } = assessmentData;

      // Find matching care plan template
      const templateKey = `${primaryCondition.toLowerCase()}-${severity}`;
      let template = workflowTemplates.get(templateKey);

      // Fallback to condition-specific template if severity-specific not found
      if (!template) {
        const fallbackKeys = Array.from(workflowTemplates.keys()).filter(key => 
          key.startsWith(primaryCondition.toLowerCase())
        );
        if (fallbackKeys.length > 0) {
          template = workflowTemplates.get(fallbackKeys[0]);
        }
      }

      if (!template) {
        return res.status(404).json({
          error: 'TEMPLATE_NOT_FOUND',
          message: `No care plan template found for ${primaryCondition} with ${severity} severity`
        });
      }

      const carePlanId = `careplan_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const timestamp = new Date().toISOString();

      // Customize care plan based on patient preferences and cultural factors
      let customizedPlan = JSON.parse(JSON.stringify(template.template)); // Deep copy

      // Adjust interventions based on preferences
      if (preferences.therapyPreference) {
        customizedPlan.interventions.forEach(intervention => {
          if (intervention.type === 'therapy' && preferences.therapyPreference !== 'any') {
            intervention.intervention = preferences.therapyPreference;
            intervention.notes = 'Adjusted based on patient preference';
          }
        });
      }

      // Add cultural adaptations
      if (culturalFactors.religiousConsiderations) {
        customizedPlan.interventions.push({
          type: 'cultural',
          intervention: 'Religious/spiritual counseling integration',
          frequency: 'As appropriate',
          priority: 'low',
          notes: 'Incorporate religious/spiritual practices as appropriate'
        });
      }

      if (culturalFactors.familyInvolvement === 'high') {
        customizedPlan.interventions.push({
          type: 'family',
          intervention: 'Family therapy sessions',
          frequency: 'Monthly',
          priority: 'medium',
          notes: 'High family involvement requested'
        });
      }

      // Adjust for comorbidities
      comorbidities.forEach(comorbidity => {
        if (comorbidity.toLowerCase().includes('anxiety') && primaryCondition.toLowerCase() === 'depression') {
          customizedPlan.interventions.push({
            type: 'therapy',
            intervention: 'Anxiety management techniques',
            frequency: 'Weekly',
            priority: 'medium',
            notes: 'Addressing comorbid anxiety'
          });
        }
      });

      // Generate medication recommendations based on severity and condition
      if (severity === 'moderate' || severity === 'severe') {
        if (!customizedPlan.medications.length && primaryCondition.toLowerCase() === 'depression') {
          customizedPlan.medications.push({
            class: 'SSRI',
            examples: ['Sertraline 50mg', 'Escitalopram 10mg'],
            considerations: 'Start with lowest effective dose, monitor for side effects'
          });
        }
      }

      // Set appropriate follow-up intervals
      if (severity === 'severe' || severity === 'critical') {
        customizedPlan.followUp.initial = '1 week';
        customizedPlan.followUp.ongoing = '2 weeks';
      }

      const carePlan = {
        id: carePlanId,
        patientId,
        condition: primaryCondition,
        severity,
        symptoms,
        comorbidities,
        goals: customizedPlan.goals,
        interventions: customizedPlan.interventions,
        medications: customizedPlan.medications,
        followUp: customizedPlan.followUp,
        preferences,
        culturalFactors,
        metadata: {
          templateUsed: template.id,
          generatedBy: req.user.id,
          generatedAt: timestamp,
          language,
          estimatedDuration: '12-16 weeks',
          reviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          version: '1.0'
        },
        status: 'draft'
      };

      // Store the care plan
      carePlans.set(carePlanId, carePlan);

      // Generate summary
      const summary = {
        totalGoals: customizedPlan.goals.length,
        totalInterventions: customizedPlan.interventions.length,
        interventionTypes: [...new Set(customizedPlan.interventions.map(i => i.type))],
        medicationRecommended: customizedPlan.medications.length > 0,
        culturalAdaptations: Object.keys(culturalFactors).length,
        estimatedCost: calculateEstimatedCost(customizedPlan),
        riskLevel: severity === 'severe' || severity === 'critical' ? 'high' : severity === 'moderate' ? 'medium' : 'low'
      };

      res.status(201).json({
        carePlanId,
        status: 'generated',
        carePlan: {
          condition: carePlan.condition,
          severity: carePlan.severity,
          goals: carePlan.goals,
          interventions: carePlan.interventions,
          medications: carePlan.medications,
          followUp: carePlan.followUp
        },
        summary,
        nextSteps: [
          'Review care plan with patient',
          'Obtain patient consent for treatment',
          'Schedule initial intervention appointments',
          'Set up monitoring and follow-up'
        ],
        message: 'Care plan generated successfully'
      });

    } catch (error) {
      console.error('[Workflow API] Generate care plan error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to generate care plan'
      });
    }
  }
);

/**
 * GET /workflow/plan/:planId
 * Retrieves a specific care plan
 */
router.get('/plan/:planId',
  requireAuth,
  [
    param('planId')
      .notEmpty()
      .matches(/^careplan_\d+_[a-f0-9]+$/)
      .withMessage('Valid care plan ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid care plan ID',
          details: errors.array()
        });
      }

      const { planId } = req.params;
      const carePlan = carePlans.get(planId);

      if (!carePlan) {
        return res.status(404).json({
          error: 'CARE_PLAN_NOT_FOUND',
          message: 'Care plan not found'
        });
      }

      // Check if user has access to this care plan
      // In real implementation, verify provider has access to patient
      
      res.json({
        carePlan,
        accessedAt: new Date().toISOString(),
        accessedBy: req.user.id
      });

    } catch (error) {
      console.error('[Workflow API] Get care plan error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve care plan'
      });
    }
  }
);

/**
 * PUT /workflow/plan/:planId
 * Updates an existing care plan
 */
router.put('/plan/:planId',
  requireAuth,
  [
    param('planId')
      .notEmpty()
      .matches(/^careplan_\d+_[a-f0-9]+$/)
      .withMessage('Valid care plan ID is required'),
    body('status')
      .optional()
      .isIn(['draft', 'active', 'completed', 'cancelled'])
      .withMessage('Invalid status'),
    body('goals')
      .optional()
      .isArray()
      .withMessage('Goals must be an array'),
    body('interventions')
      .optional()
      .isArray()
      .withMessage('Interventions must be an array'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 2000 })
      .withMessage('Notes must be less than 2000 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid update data',
          details: errors.array()
        });
      }

      const { planId } = req.params;
      const updates = req.body;
      
      const carePlan = carePlans.get(planId);
      if (!carePlan) {
        return res.status(404).json({
          error: 'CARE_PLAN_NOT_FOUND',
          message: 'Care plan not found'
        });
      }

      // Update care plan
      const updatedPlan = {
        ...carePlan,
        ...updates,
        metadata: {
          ...carePlan.metadata,
          lastUpdatedBy: req.user.id,
          lastUpdatedAt: new Date().toISOString(),
          version: (parseFloat(carePlan.metadata.version) + 0.1).toFixed(1)
        }
      };

      carePlans.set(planId, updatedPlan);

      res.json({
        carePlanId: planId,
        status: 'updated',
        updatedFields: Object.keys(updates),
        version: updatedPlan.metadata.version,
        message: 'Care plan updated successfully'
      });

    } catch (error) {
      console.error('[Workflow API] Update care plan error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update care plan'
      });
    }
  }
);

// Helper function to estimate care plan cost
function calculateEstimatedCost(plan) {
  let totalCost = 0;
  
  plan.interventions.forEach(intervention => {
    switch (intervention.type) {
      case 'therapy':
        totalCost += 150 * 12; // Assume $150 per session, 12 sessions
        break;
      case 'medication':
        totalCost += 50 * 12; // Assume $50 per month, 12 months
        break;
      case 'lifestyle':
        totalCost += 25; // One-time setup cost
        break;
    }
  });
  
  return Math.round(totalCost);
}

module.exports = router;