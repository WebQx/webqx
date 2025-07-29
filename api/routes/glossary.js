const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();

/**
 * Sample medical glossary terms
 * In production, this would be stored in a database with multilingual support
 */
const MEDICAL_GLOSSARY = [
    {
        id: 'glucose',
        term: 'Glucose',
        category: 'laboratory-values',
        definition: 'A simple sugar that is the primary source of energy for the body\'s cells.',
        plainLanguage: 'Blood sugar - the main type of sugar your body uses for energy.',
        normalRange: '70-100 mg/dL (fasting)',
        examples: ['Blood glucose test', 'Fasting glucose', 'Random glucose'],
        relatedTerms: ['diabetes', 'insulin', 'hypoglycemia', 'hyperglycemia'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'cholesterol',
        term: 'Cholesterol',
        category: 'laboratory-values',
        definition: 'A waxy, fat-like substance found in all cells of the body, needed to make hormones and digest foods.',
        plainLanguage: 'A type of fat in your blood that your body needs, but too much can be harmful.',
        normalRange: 'Total: <200 mg/dL',
        examples: ['Total cholesterol', 'Lipid panel', 'Cholesterol screening'],
        relatedTerms: ['hdl', 'ldl', 'triglycerides', 'lipid-panel'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'hdl',
        term: 'HDL Cholesterol',
        category: 'laboratory-values',
        definition: 'High-density lipoprotein cholesterol, often called "good" cholesterol because it helps remove other forms of cholesterol from the bloodstream.',
        plainLanguage: 'Good cholesterol - helps clean up bad cholesterol from your blood vessels.',
        normalRange: '>40 mg/dL (men), >50 mg/dL (women)',
        examples: ['HDL-C', 'Good cholesterol', 'High-density lipoprotein'],
        relatedTerms: ['cholesterol', 'ldl', 'lipid-panel'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'ldl',
        term: 'LDL Cholesterol',
        category: 'laboratory-values',
        definition: 'Low-density lipoprotein cholesterol, often called "bad" cholesterol because it can build up in artery walls.',
        plainLanguage: 'Bad cholesterol - can stick to your blood vessel walls and cause blockages.',
        normalRange: '<100 mg/dL',
        examples: ['LDL-C', 'Bad cholesterol', 'Low-density lipoprotein'],
        relatedTerms: ['cholesterol', 'hdl', 'atherosclerosis'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'triglycerides',
        term: 'Triglycerides',
        category: 'laboratory-values',
        definition: 'A type of fat found in the blood that the body uses for energy.',
        plainLanguage: 'A type of fat in your blood that comes from food and can be made by your body.',
        normalRange: '<150 mg/dL',
        examples: ['Triglyceride level', 'Blood fats', 'Lipid screening'],
        relatedTerms: ['cholesterol', 'lipid-panel', 'diabetes'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'lipid-panel',
        term: 'Lipid Panel',
        category: 'tests',
        definition: 'A blood test that measures different types of cholesterol and triglycerides.',
        plainLanguage: 'A blood test that checks the levels of different fats in your blood.',
        normalRange: 'Varies by component',
        examples: ['Cholesterol test', 'Lipid profile', 'Lipid screening'],
        relatedTerms: ['cholesterol', 'hdl', 'ldl', 'triglycerides'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'saturated-fat',
        term: 'Saturated Fat',
        category: 'nutrition',
        definition: 'A type of dietary fat that is typically solid at room temperature and can raise cholesterol levels.',
        plainLanguage: 'A type of fat found in foods like butter and meat that can raise your cholesterol.',
        normalRange: '<10% of daily calories',
        examples: ['Butter', 'Red meat', 'Coconut oil'],
        relatedTerms: ['cholesterol', 'trans-fat', 'unsaturated-fat'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'lungs',
        term: 'Lungs',
        category: 'anatomy',
        definition: 'Paired organs in the chest responsible for breathing and gas exchange.',
        plainLanguage: 'The two organs in your chest that help you breathe.',
        normalRange: 'N/A',
        examples: ['Pulmonary system', 'Respiratory organs'],
        relatedTerms: ['respiratory-system', 'bronchi', 'alveoli'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'consolidation',
        term: 'Consolidation',
        category: 'radiology',
        definition: 'An area of lung tissue that has filled with liquid instead of air, often due to pneumonia.',
        plainLanguage: 'When part of your lung fills with fluid instead of air, usually from infection.',
        normalRange: 'None present',
        examples: ['Pneumonia consolidation', 'Lung consolidation'],
        relatedTerms: ['pneumonia', 'infiltrate', 'opacity'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'pneumothorax',
        term: 'Pneumothorax',
        category: 'radiology',
        definition: 'A collapsed lung caused by air leaking into the space between the lung and chest wall.',
        plainLanguage: 'A collapsed lung - when air gets trapped outside the lung causing it to collapse.',
        normalRange: 'None present',
        examples: ['Collapsed lung', 'Air in chest cavity'],
        relatedTerms: ['pleural-space', 'chest-tube', 'tension-pneumothorax'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'pleural-effusion',
        term: 'Pleural Effusion',
        category: 'radiology',
        definition: 'Excess fluid that accumulates in the pleural space around the lungs.',
        plainLanguage: 'Extra fluid that builds up around your lungs.',
        normalRange: 'None present',
        examples: ['Fluid around lungs', 'Water on lungs'],
        relatedTerms: ['pleural-space', 'thoracentesis', 'pleuritis'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'cardiac-silhouette',
        term: 'Cardiac Silhouette',
        category: 'radiology',
        definition: 'The outline or shadow of the heart as seen on a chest X-ray.',
        plainLanguage: 'The shape and size of your heart as it appears on an X-ray.',
        normalRange: 'Normal size and shape',
        examples: ['Heart shadow', 'Cardiac outline'],
        relatedTerms: ['heart', 'cardiomegaly', 'chest-xray'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    },
    {
        id: 'osseous',
        term: 'Osseous',
        category: 'anatomy',
        definition: 'Relating to or composed of bone.',
        plainLanguage: 'Related to bones.',
        normalRange: 'N/A',
        examples: ['Bone tissue', 'Skeletal system'],
        relatedTerms: ['bone', 'skeleton', 'fracture'],
        audioUrl: null,
        imageUrl: null,
        lastUpdated: '2024-01-15T00:00:00Z'
    }
];

const GLOSSARY_CATEGORIES = [
    {
        id: 'laboratory-values',
        name: 'Laboratory Values',
        description: 'Blood tests and lab results',
        termCount: 6
    },
    {
        id: 'tests',
        name: 'Medical Tests',
        description: 'Diagnostic tests and procedures',
        termCount: 1
    },
    {
        id: 'nutrition',
        name: 'Nutrition',
        description: 'Diet and nutrition related terms',
        termCount: 1
    },
    {
        id: 'anatomy',
        name: 'Anatomy',
        description: 'Body parts and structures',
        termCount: 2
    },
    {
        id: 'radiology',
        name: 'Radiology',
        description: 'Medical imaging terms',
        termCount: 4
    }
];

/**
 * GET /api/glossary/medical-terms
 * Get medical glossary terms with optional filtering
 */
router.get('/medical-terms', [
    query('search').optional().isString().trim(),
    query('category').optional().isString(),
    query('language').optional().isString(),
    query('_offset').optional().isInt({ min: 0 }),
    query('_count').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
    try {
        // Validate query parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Invalid query parameters',
                details: errors.array()
            });
        }

        const { search, category, language = 'en', _offset = 0, _count = 50 } = req.query;

        // Filter terms based on query parameters
        let filteredTerms = MEDICAL_GLOSSARY;

        if (category) {
            filteredTerms = filteredTerms.filter(term => term.category === category);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            filteredTerms = filteredTerms.filter(term => 
                term.term.toLowerCase().includes(searchLower) ||
                term.definition.toLowerCase().includes(searchLower) ||
                term.plainLanguage.toLowerCase().includes(searchLower) ||
                term.examples?.some(example => example.toLowerCase().includes(searchLower))
            );
        }

        // Sort alphabetically
        filteredTerms.sort((a, b) => a.term.localeCompare(b.term));

        // Apply pagination
        const total = filteredTerms.length;
        const paginatedTerms = filteredTerms.slice(_offset, _offset + _count);

        const response = {
            terms: paginatedTerms,
            categories: GLOSSARY_CATEGORIES,
            total: total,
            offset: _offset,
            count: paginatedTerms.length,
            language: language
        };

        // Log access for audit purposes
        console.log(`Glossary access: User ${req.user?.sub || 'anonymous'} searched terms with params:`, req.query);

        res.json(response);
    } catch (error) {
        console.error('Glossary API error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/glossary/medical-terms/:id
 * Get a specific medical term by ID
 */
router.get('/medical-terms/:id', [
    param('id').isString().trim(),
    query('language').optional().isString()
], async (req, res) => {
    try {
        // Validate parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Invalid term ID',
                details: errors.array()
            });
        }

        const { id } = req.params;
        const { language = 'en' } = req.query;
        
        const term = MEDICAL_GLOSSARY.find(t => t.id === id);

        if (!term) {
            return res.status(404).json({
                error: 'Term not found',
                message: `No glossary term found with ID: ${id}`
            });
        }

        // Log access for audit purposes
        console.log(`Glossary term access: User ${req.user?.sub || 'anonymous'} accessed term ${id}`);

        res.json({
            ...term,
            language: language
        });
    } catch (error) {
        console.error('Glossary term API error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/glossary/categories
 * Get all glossary categories
 */
router.get('/categories', [
    query('language').optional().isString()
], async (req, res) => {
    try {
        const { language = 'en' } = req.query;

        // Log access for audit purposes
        console.log(`Glossary categories access: User ${req.user?.sub || 'anonymous'} accessed categories`);

        res.json({
            categories: GLOSSARY_CATEGORIES,
            language: language
        });
    } catch (error) {
        console.error('Glossary categories API error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * POST /api/glossary/medical-terms/:id/audio
 * Generate or retrieve audio pronunciation for a term
 */
router.post('/:id/audio', [
    param('id').isString().trim(),
    query('language').optional().isString()
], async (req, res) => {
    try {
        // Validate parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Invalid term ID',
                details: errors.array()
            });
        }

        const { id } = req.params;
        const { language = 'en' } = req.query;
        
        const term = MEDICAL_GLOSSARY.find(t => t.id === id);

        if (!term) {
            return res.status(404).json({
                error: 'Term not found',
                message: `No glossary term found with ID: ${id}`
            });
        }

        // In a real implementation, this would generate or retrieve audio
        // For now, we'll return a mock response
        const audioResponse = {
            termId: id,
            term: term.term,
            audioUrl: term.audioUrl || null,
            speechSynthesisSupported: true,
            language: language,
            message: term.audioUrl ? 'Audio URL available' : 'Use browser speech synthesis'
        };

        // Log access for audit purposes
        console.log(`Audio request: User ${req.user?.sub || 'anonymous'} requested audio for term ${id}`);

        res.json(audioResponse);
    } catch (error) {
        console.error('Audio generation API error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

module.exports = router;