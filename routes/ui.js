/**
 * Telepsychiatry UI Customization Routes
 * Handles cultural and linguistic adaptations for care plans and UI
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage for demo purposes (use database in production)
const customizations = new Map();
const culturalTemplates = new Map();
const languagePreferences = new Map();

/**
 * POST /ui/customize
 * Customize by Culture/Language - Adapts care plans to specific cultural or linguistic needs
 */
router.post('/customize', (req, res) => {
    try {
        const {
            userId,
            culturalContext,
            language,
            customizationType, // 'care_plan', 'ui_theme', 'communication_style', 'content_adaptation'
            preferences,
            carePlanId
        } = req.body;

        if (!userId || !culturalContext || !language || !customizationType) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'User ID, cultural context, language, and customization type are required'
            });
        }

        const customizationId = uuidv4();
        const customization = {
            customizationId,
            userId,
            culturalContext,
            language,
            customizationType,
            preferences,
            carePlanId,
            adaptations: generateCulturalAdaptations(culturalContext, language, customizationType, preferences),
            timestamp: new Date().toISOString(),
            status: 'active'
        };

        customizations.set(customizationId, customization);

        res.json({
            success: true,
            data: {
                customizationId,
                culturalContext,
                language,
                customizationType,
                adaptations: customization.adaptations,
                timestamp: customization.timestamp
            }
        });
    } catch (error) {
        console.error('Error creating UI customization:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create UI customization'
        });
    }
});

/**
 * GET /ui/customize/:id
 * Get customization by ID
 */
router.get('/customize/:id', (req, res) => {
    try {
        const { id: customizationId } = req.params;

        const customization = customizations.get(customizationId);
        if (!customization) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Customization not found'
            });
        }

        res.json({
            success: true,
            data: customization
        });
    } catch (error) {
        console.error('Error retrieving customization:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve customization'
        });
    }
});

/**
 * GET /ui/templates
 * Get cultural templates for different contexts
 */
router.get('/templates', (req, res) => {
    try {
        const {
            culturalContext,
            language,
            templateType, // 'care_plan', 'assessment', 'communication', 'resources'
            specialty = 'psychiatry'
        } = req.query;

        const templates = getCulturalTemplates(culturalContext, language, templateType, specialty);

        res.json({
            success: true,
            data: {
                templates,
                culturalContext,
                language,
                templateType,
                specialty,
                totalTemplates: templates.length
            }
        });
    } catch (error) {
        console.error('Error retrieving cultural templates:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve cultural templates'
        });
    }
});

/**
 * POST /ui/preferences
 * Set user language and cultural preferences
 */
router.post('/preferences', (req, res) => {
    try {
        const {
            userId,
            primaryLanguage,
            secondaryLanguage,
            culturalContext,
            communicationStyle, // 'direct', 'indirect', 'formal', 'informal'
            familyInvolvement, // 'high', 'medium', 'low', 'none'
            religiousConsiderations,
            accessibilityNeeds
        } = req.body;

        if (!userId || !primaryLanguage || !culturalContext) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'User ID, primary language, and cultural context are required'
            });
        }

        const preferenceId = uuidv4();
        const preferences = {
            preferenceId,
            userId,
            primaryLanguage,
            secondaryLanguage,
            culturalContext,
            communicationStyle,
            familyInvolvement,
            religiousConsiderations,
            accessibilityNeeds,
            timestamp: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };

        languagePreferences.set(userId, preferences);

        res.json({
            success: true,
            data: {
                preferenceId,
                userId,
                preferences: {
                    primaryLanguage,
                    secondaryLanguage,
                    culturalContext,
                    communicationStyle,
                    familyInvolvement
                },
                timestamp: preferences.timestamp
            }
        });
    } catch (error) {
        console.error('Error setting user preferences:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to set user preferences'
        });
    }
});

/**
 * GET /ui/preferences/:userId
 * Get user preferences
 */
router.get('/preferences/:userId', (req, res) => {
    try {
        const { userId } = req.params;

        const preferences = languagePreferences.get(userId);
        if (!preferences) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User preferences not found'
            });
        }

        res.json({
            success: true,
            data: preferences
        });
    } catch (error) {
        console.error('Error retrieving user preferences:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve user preferences'
        });
    }
});

/**
 * POST /ui/adapt-content
 * Adapt content based on cultural and linguistic preferences
 */
router.post('/adapt-content', (req, res) => {
    try {
        const {
            content,
            contentType, // 'care_plan', 'assessment_question', 'resource', 'instruction'
            targetCulture,
            targetLanguage,
            userId
        } = req.body;

        if (!content || !contentType || !targetCulture || !targetLanguage) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Content, content type, target culture, and target language are required'
            });
        }

        const adaptedContent = adaptContentForCulture(content, contentType, targetCulture, targetLanguage);
        
        // Get user preferences for additional context
        const userPrefs = languagePreferences.get(userId);
        if (userPrefs) {
            adaptedContent.communicationStyle = adaptCommunicationStyle(
                adaptedContent.adaptedText,
                userPrefs.communicationStyle
            );
        }

        res.json({
            success: true,
            data: {
                originalContent: content,
                adaptedContent,
                targetCulture,
                targetLanguage,
                adaptationId: uuidv4(),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error adapting content:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to adapt content'
        });
    }
});

/**
 * GET /ui/cultural-insights/:context
 * Get cultural insights and considerations for a specific context
 */
router.get('/cultural-insights/:context', (req, res) => {
    try {
        const { context: culturalContext } = req.params;
        const { specialty = 'psychiatry', language = 'en' } = req.query;

        const insights = getCulturalInsights(culturalContext, specialty, language);

        res.json({
            success: true,
            data: {
                culturalContext,
                specialty,
                language,
                insights,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error retrieving cultural insights:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve cultural insights'
        });
    }
});

// Helper functions
function generateCulturalAdaptations(culturalContext, language, customizationType, preferences) {
    const adaptations = {
        culturalContext,
        language,
        customizationType,
        adaptations: []
    };

    switch (customizationType) {
        case 'care_plan':
            adaptations.adaptations = generateCarePlanAdaptations(culturalContext, language, preferences);
            break;
        case 'ui_theme':
            adaptations.adaptations = generateUIThemeAdaptations(culturalContext, preferences);
            break;
        case 'communication_style':
            adaptations.adaptations = generateCommunicationAdaptations(culturalContext, language);
            break;
        case 'content_adaptation':
            adaptations.adaptations = generateContentAdaptations(culturalContext, language, preferences);
            break;
        default:
            adaptations.adaptations = generateDefaultAdaptations(culturalContext, language);
    }

    return adaptations;
}

function generateCarePlanAdaptations(culturalContext, language, preferences) {
    const adaptations = {
        'hispanic': [
            'Include family-centered approach to treatment planning',
            'Consider religious/spiritual practices in healing process',
            'Provide bilingual resources and materials',
            'Respect for traditional healing practices alongside modern treatment',
            'Consider extended family dynamics in care decisions'
        ],
        'asian': [
            'Emphasize harmony and balance in treatment approach',
            'Respect for family hierarchy in decision-making',
            'Integration of traditional medicine concepts',
            'Consider stigma reduction strategies',
            'Include community support systems'
        ],
        'african_american': [
            'Address historical trauma and healthcare distrust',
            'Include community and faith-based support systems',
            'Consider cultural expressions of mental health',
            'Address systemic factors affecting mental health',
            'Promote culturally relevant coping strategies'
        ],
        'middle_eastern': [
            'Respect religious observances and prayer times',
            'Consider gender-specific treatment preferences',
            'Include cultural concepts of honor and family',
            'Address immigration and acculturation stress',
            'Provide culturally appropriate resources'
        ]
    };

    return adaptations[culturalContext] || [
        'Respect cultural values and beliefs in treatment',
        'Include culturally appropriate coping strategies',
        'Consider family and community support systems',
        'Address cultural factors affecting treatment adherence'
    ];
}

function generateUIThemeAdaptations(culturalContext, preferences) {
    return {
        colorScheme: getCulturalColorScheme(culturalContext),
        layout: getCulturalLayoutPreferences(culturalContext),
        typography: getCulturalTypography(culturalContext),
        imagery: getCulturalImagery(culturalContext),
        accessibility: getAccessibilityAdaptations(preferences?.accessibilityNeeds)
    };
}

function generateCommunicationAdaptations(culturalContext, language) {
    const adaptations = {
        'hispanic': {
            greeting: 'Personal and warm greetings',
            formality: 'Respectful formal address initially',
            directness: 'Indirect communication style preferred',
            family: 'Include family in discussions when appropriate'
        },
        'asian': {
            greeting: 'Respectful and formal greetings',
            formality: 'High level of formality',
            directness: 'Indirect communication to preserve face',
            hierarchy: 'Respect for age and authority'
        },
        'african_american': {
            greeting: 'Warm and personable approach',
            trust: 'Build trust through consistency and respect',
            community: 'Acknowledge community and historical context',
            strength: 'Recognize resilience and strength'
        }
    };

    return adaptations[culturalContext] || {
        greeting: 'Professional and respectful approach',
        communication: 'Clear and culturally sensitive',
        respect: 'Honor cultural values and practices'
    };
}

function generateContentAdaptations(culturalContext, language, preferences) {
    return [
        `Translate content to ${language}`,
        `Adapt examples to ${culturalContext} cultural context`,
        'Use culturally appropriate metaphors and analogies',
        'Include culturally relevant resources and references',
        'Adjust communication style based on cultural norms'
    ];
}

function generateDefaultAdaptations(culturalContext, language) {
    return [
        `Provide content in ${language}`,
        `Respect ${culturalContext} cultural values`,
        'Include culturally appropriate resources',
        'Consider cultural factors in treatment approach'
    ];
}

function getCulturalTemplates(culturalContext, language, templateType, specialty) {
    // Mock templates - in production, these would come from a template database
    const templates = [
        {
            id: 'template-1',
            name: 'Hispanic Family-Centered Care Plan',
            culturalContext: 'hispanic',
            language: 'es',
            templateType: 'care_plan',
            specialty: 'psychiatry',
            content: {
                goals: ['Mejorar el bienestar mental', 'Fortalecer el apoyo familiar'],
                interventions: ['Terapia familiar', 'Prácticas espirituales'],
                resources: ['Grupos de apoyo en español', 'Recursos comunitarios']
            }
        },
        {
            id: 'template-2',
            name: 'Asian Cultural Assessment Questions',
            culturalContext: 'asian',
            language: 'en',
            templateType: 'assessment',
            specialty: 'psychiatry',
            content: {
                questions: [
                    'How does your family view mental health treatment?',
                    'What traditional healing practices do you use?',
                    'How important is maintaining family harmony?'
                ]
            }
        }
    ];

    return templates.filter(template => {
        return (!culturalContext || template.culturalContext === culturalContext) &&
               (!language || template.language === language) &&
               (!templateType || template.templateType === templateType) &&
               (!specialty || template.specialty === specialty);
    });
}

function adaptContentForCulture(content, contentType, targetCulture, targetLanguage) {
    // Mock content adaptation - in production, this would use NLP and cultural databases
    const adaptedContent = {
        originalText: content,
        adaptedText: content, // Would be translated/adapted
        culturalAdaptations: [],
        linguisticAdaptations: []
    };

    // Add cultural adaptations based on target culture
    switch (targetCulture) {
        case 'hispanic':
            adaptedContent.culturalAdaptations.push('Added family-inclusive language');
            adaptedContent.culturalAdaptations.push('Included spiritual/religious considerations');
            break;
        case 'asian':
            adaptedContent.culturalAdaptations.push('Used indirect communication style');
            adaptedContent.culturalAdaptations.push('Added respect for hierarchy');
            break;
        case 'african_american':
            adaptedContent.culturalAdaptations.push('Acknowledged historical context');
            adaptedContent.culturalAdaptations.push('Emphasized community strength');
            break;
    }

    // Add linguistic adaptations
    if (targetLanguage !== 'en') {
        adaptedContent.linguisticAdaptations.push(`Translated to ${targetLanguage}`);
        adaptedContent.linguisticAdaptations.push('Adapted idioms and expressions');
    }

    return adaptedContent;
}

function adaptCommunicationStyle(content, style) {
    // Mock communication style adaptation
    const styleAdaptations = {
        'formal': 'Used formal language and respectful address',
        'informal': 'Used conversational and approachable language',
        'direct': 'Used clear and straightforward communication',
        'indirect': 'Used gentle and indirect communication style'
    };

    return {
        style,
        adaptation: styleAdaptations[style] || 'No specific style adaptation',
        adaptedContent: content // Would be modified based on style
    };
}

function getCulturalInsights(culturalContext, specialty, language) {
    const insights = {
        'hispanic': {
            mentalHealthViews: 'Mental health may be viewed through spiritual/religious lens',
            familyRole: 'Family plays central role in healthcare decisions',
            communicationStyle: 'Prefer personal relationships and indirect communication',
            treatmentPreferences: 'May prefer family therapy and spiritual integration',
            barriers: 'Language barriers, stigma, immigration concerns'
        },
        'asian': {
            mentalHealthViews: 'Mental health stigma may be significant',
            familyRole: 'Family honor and hierarchy are important',
            communicationStyle: 'Indirect communication to preserve face',
            treatmentPreferences: 'May prefer individual therapy, respect for authority',
            barriers: 'Cultural stigma, language barriers, model minority myth'
        },
        'african_american': {
            mentalHealthViews: 'Historical trauma and healthcare distrust',
            familyRole: 'Extended family and community support important',
            communicationStyle: 'Direct but relationship-based communication',
            treatmentPreferences: 'Community-based and culturally affirming approaches',
            barriers: 'Healthcare access, systemic racism, economic factors'
        }
    };

    return insights[culturalContext] || {
        mentalHealthViews: 'Varies by individual and cultural background',
        familyRole: 'Consider family involvement preferences',
        communicationStyle: 'Adapt to individual preferences',
        treatmentPreferences: 'Culturally responsive approaches',
        barriers: 'Individual and systemic factors may apply'
    };
}

function getCulturalColorScheme(culturalContext) {
    const colorSchemes = {
        'hispanic': { primary: '#C8102E', secondary: '#FFD700', accent: '#228B22' },
        'asian': { primary: '#DC143C', secondary: '#FFD700', accent: '#000000' },
        'african_american': { primary: '#000000', secondary: '#DC143C', accent: '#228B22' },
        'middle_eastern': { primary: '#006400', secondary: '#FFD700', accent: '#000080' }
    };

    return colorSchemes[culturalContext] || { primary: '#0066CC', secondary: '#666666', accent: '#009900' };
}

function getCulturalLayoutPreferences(culturalContext) {
    return {
        textDirection: culturalContext === 'middle_eastern' ? 'rtl' : 'ltr',
        density: culturalContext === 'asian' ? 'compact' : 'comfortable',
        hierarchy: culturalContext === 'asian' ? 'formal' : 'relaxed'
    };
}

function getCulturalTypography(culturalContext) {
    return {
        fontFamily: culturalContext === 'asian' ? 'serif' : 'sans-serif',
        fontSize: 'medium',
        lineHeight: 'comfortable'
    };
}

function getCulturalImagery(culturalContext) {
    return {
        style: 'inclusive_diverse',
        representation: culturalContext,
        symbols: getCulturalSymbols(culturalContext)
    };
}

function getCulturalSymbols(culturalContext) {
    const symbols = {
        'hispanic': ['family', 'community', 'spiritual'],
        'asian': ['harmony', 'balance', 'respect'],
        'african_american': ['strength', 'community', 'resilience'],
        'middle_eastern': ['family', 'tradition', 'hospitality']
    };

    return symbols[culturalContext] || ['diversity', 'inclusion', 'respect'];
}

function getAccessibilityAdaptations(accessibilityNeeds) {
    if (!accessibilityNeeds) return {};

    return {
        visualImpairment: accessibilityNeeds.includes('visual') ? 'high_contrast_large_text' : null,
        hearingImpairment: accessibilityNeeds.includes('hearing') ? 'visual_indicators' : null,
        motorImpairment: accessibilityNeeds.includes('motor') ? 'large_click_targets' : null,
        cognitiveSupport: accessibilityNeeds.includes('cognitive') ? 'simplified_language' : null
    };
}

// Initialize sample customizations for demo
function initializeSampleCustomizations() {
    const sampleCustomizations = [
        {
            userId: 'patient-123',
            culturalContext: 'hispanic',
            language: 'es',
            customizationType: 'care_plan',
            preferences: { familyInvolvement: 'high', religiousConsiderations: true }
        },
        {
            userId: 'patient-456',
            culturalContext: 'asian',
            language: 'en',
            customizationType: 'communication_style',
            preferences: { communicationStyle: 'indirect', familyInvolvement: 'medium' }
        }
    ];

    sampleCustomizations.forEach(customization => {
        const customizationId = uuidv4();
        const fullCustomization = {
            customizationId,
            ...customization,
            adaptations: generateCulturalAdaptations(
                customization.culturalContext,
                customization.language,
                customization.customizationType,
                customization.preferences
            ),
            timestamp: new Date().toISOString(),
            status: 'active'
        };

        customizations.set(customizationId, fullCustomization);
        languagePreferences.set(customization.userId, {
            preferenceId: uuidv4(),
            userId: customization.userId,
            primaryLanguage: customization.language,
            culturalContext: customization.culturalContext,
            ...customization.preferences,
            timestamp: new Date().toISOString()
        });
    });
}

// Initialize sample data
initializeSampleCustomizations();

module.exports = router;