/**
 * User Interface Customization API Routes for Telepsychiatry Platform
 * 
 * Handles supported locales and region-specific phrases with RTL/LTR text direction support
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();

// In-memory storage for UI customizations (use database in production)
const customizations = new Map();

// Supported languages and locales
const supportedLanguages = {
  'en': {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    region: 'US',
    supported: true,
    telepsychiatrySupport: true
  },
  'es': {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    direction: 'ltr',
    region: 'ES',
    supported: true,
    telepsychiatrySupport: true
  },
  'fr': {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    region: 'FR',
    supported: true,
    telepsychiatrySupport: true
  },
  'de': {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    region: 'DE',
    supported: true,
    telepsychiatrySupport: true
  },
  'ar': {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    region: 'SA',
    supported: true,
    telepsychiatrySupport: true
  },
  'he': {
    code: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    direction: 'rtl',
    region: 'IL',
    supported: true,
    telepsychiatrySupport: true
  },
  'zh': {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    direction: 'ltr',
    region: 'CN',
    supported: true,
    telepsychiatrySupport: true
  },
  'ja': {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    direction: 'ltr',
    region: 'JP',
    supported: true,
    telepsychiatrySupport: true
  },
  'ko': {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    direction: 'ltr',
    region: 'KR',
    supported: true,
    telepsychiatrySupport: true
  },
  'pt': {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    direction: 'ltr',
    region: 'PT',
    supported: true,
    telepsychiatrySupport: true
  },
  'ru': {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    direction: 'ltr',
    region: 'RU',
    supported: true,
    telepsychiatrySupport: true
  },
  'hi': {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    direction: 'ltr',
    region: 'IN',
    supported: true,
    telepsychiatrySupport: true
  }
};

// Default telepsychiatry phrases and UI elements
const defaultPhrases = {
  en: {
    general: {
      welcome: 'Welcome to Telepsychiatry',
      sessionStarted: 'Your session has started',
      sessionEnded: 'Session completed',
      connecting: 'Connecting...',
      connected: 'Connected',
      disconnected: 'Disconnected',
      error: 'An error occurred',
      loading: 'Loading...',
      save: 'Save',
      cancel: 'Cancel',
      continue: 'Continue',
      back: 'Back',
      next: 'Next',
      finish: 'Finish'
    },
    consent: {
      title: 'Consent for Telepsychiatry Services',
      description: 'Please review and sign the consent form',
      agree: 'I agree to the terms',
      disagree: 'I do not agree',
      signed: 'Consent form signed',
      required: 'Consent is required to proceed'
    },
    session: {
      startSession: 'Start Session',
      endSession: 'End Session',
      joinSession: 'Join Session',
      waitingRoom: 'Waiting Room',
      sessionInProgress: 'Session in Progress',
      microphoneOn: 'Microphone On',
      microphoneOff: 'Microphone Off',
      cameraOn: 'Camera On',
      cameraOff: 'Camera Off',
      shareScreen: 'Share Screen',
      stopSharing: 'Stop Sharing',
      chat: 'Chat',
      participants: 'Participants'
    },
    medical: {
      symptoms: 'Symptoms',
      diagnosis: 'Diagnosis',
      treatment: 'Treatment Plan',
      medications: 'Medications',
      followUp: 'Follow-up',
      emergency: 'Emergency',
      assessment: 'Assessment',
      notes: 'Clinical Notes'
    }
  }
};

// Middleware to validate session/auth (optional for language endpoints)
const optionalAuth = (req, res, next) => {
  const sessionId = req.cookies?.sessionId || req.headers['x-session-id'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (sessionId) {
    // Mock user for demo - in real implementation, validate with userService
    req.user = { id: 'user-123', role: 'PROVIDER', preferredLanguage: 'en' };
  }
  
  next();
};

// Required auth for customization endpoints
const requireAuth = (req, res, next) => {
  const sessionId = req.cookies?.sessionId || req.headers['x-session-id'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }
  
  req.user = { id: 'user-123', role: 'PROVIDER', preferredLanguage: 'en' };
  next();
};

/**
 * GET /ui/languages
 * Lists supported locales and language information
 */
router.get('/languages',
  optionalAuth,
  [
    query('includeAll')
      .optional()
      .isBoolean()
      .withMessage('Include all must be a boolean'),
    query('telepsychiatryOnly')
      .optional()
      .isBoolean()
      .withMessage('Telepsychiatry only must be a boolean'),
    query('region')
      .optional()
      .isAlpha()
      .isLength({ min: 2, max: 2 })
      .withMessage('Region must be a 2-letter country code')
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

      const { includeAll = false, telepsychiatryOnly = false, region } = req.query;

      let languages = Object.values(supportedLanguages);

      // Filter by telepsychiatry support if requested
      if (telepsychiatryOnly) {
        languages = languages.filter(lang => lang.telepsychiatrySupport);
      }

      // Filter by region if specified
      if (region) {
        languages = languages.filter(lang => lang.region === region.toUpperCase());
      }

      // Filter by supported status unless includeAll is true
      if (!includeAll) {
        languages = languages.filter(lang => lang.supported);
      }

      // Add additional metadata
      const languageData = languages.map(lang => ({
        ...lang,
        hasCustomization: customizations.has(`${lang.code}_phrases`),
        defaultAvailable: defaultPhrases.hasOwnProperty(lang.code),
        rtlSupport: lang.direction === 'rtl'
      }));

      // Sort by name for consistent ordering
      languageData.sort((a, b) => a.name.localeCompare(b.name));

      // Generate summary statistics
      const summary = {
        total: languageData.length,
        rtlLanguages: languageData.filter(lang => lang.direction === 'rtl').length,
        ltrLanguages: languageData.filter(lang => lang.direction === 'ltr').length,
        withTelepsychiatrySupport: languageData.filter(lang => lang.telepsychiatrySupport).length,
        withCustomizations: languageData.filter(lang => lang.hasCustomization).length,
        regions: [...new Set(languageData.map(lang => lang.region))].sort()
      };

      res.json({
        languages: languageData,
        summary,
        metadata: {
          generatedAt: new Date().toISOString(),
          userPreferredLanguage: req.user?.preferredLanguage || 'en',
          defaultLanguage: 'en',
          supportedDirections: ['ltr', 'rtl']
        }
      });

    } catch (error) {
      console.error('[UI API] Get languages error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve language information'
      });
    }
  }
);

/**
 * POST /ui/customize
 * Configures region-specific phrases and text directions (RTL/LTR)
 */
router.post('/customize',
  requireAuth,
  [
    body('languageCode')
      .isIn(Object.keys(supportedLanguages))
      .withMessage('Supported language code is required'),
    body('region')
      .optional()
      .isAlpha()
      .isLength({ min: 2, max: 2 })
      .withMessage('Region must be a 2-letter country code'),
    body('direction')
      .optional()
      .isIn(['ltr', 'rtl'])
      .withMessage('Direction must be ltr or rtl'),
    body('phrases')
      .isObject()
      .withMessage('Phrases must be an object'),
    body('phrases.general')
      .optional()
      .isObject()
      .withMessage('General phrases must be an object'),
    body('phrases.consent')
      .optional()
      .isObject()
      .withMessage('Consent phrases must be an object'),
    body('phrases.session')
      .optional()
      .isObject()
      .withMessage('Session phrases must be an object'),
    body('phrases.medical')
      .optional()
      .isObject()
      .withMessage('Medical phrases must be an object'),
    body('customStyles')
      .optional()
      .isObject()
      .withMessage('Custom styles must be an object'),
    body('fonts')
      .optional()
      .isObject()
      .withMessage('Fonts configuration must be an object')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid customization data',
          details: errors.array()
        });
      }

      const {
        languageCode,
        region,
        direction,
        phrases,
        customStyles = {},
        fonts = {},
        description = ''
      } = req.body;

      const language = supportedLanguages[languageCode];
      if (!language) {
        return res.status(400).json({
          error: 'UNSUPPORTED_LANGUAGE',
          message: `Language ${languageCode} is not supported`
        });
      }

      // Validate direction matches language if not overridden
      const finalDirection = direction || language.direction;
      if (direction && direction !== language.direction) {
        console.warn(`Direction override: ${languageCode} default is ${language.direction}, setting to ${direction}`);
      }

      // Validate phrases structure
      const validSections = ['general', 'consent', 'session', 'medical'];
      const phraseSections = Object.keys(phrases);
      const invalidSections = phraseSections.filter(section => !validSections.includes(section));
      
      if (invalidSections.length > 0) {
        return res.status(400).json({
          error: 'INVALID_PHRASE_SECTIONS',
          message: `Invalid phrase sections: ${invalidSections.join(', ')}`,
          validSections
        });
      }

      const customizationId = `${languageCode}_phrases`;
      const timestamp = new Date().toISOString();

      const customization = {
        id: customizationId,
        languageCode,
        languageName: language.name,
        region: region || language.region,
        direction: finalDirection,
        phrases,
        customStyles,
        fonts,
        description,
        metadata: {
          createdBy: req.user.id,
          createdAt: timestamp,
          updatedAt: timestamp,
          version: '1.0',
          totalPhrases: Object.values(phrases).reduce((total, section) => 
            total + (typeof section === 'object' ? Object.keys(section).length : 0), 0
          ),
          sections: phraseSections
        }
      };

      // Store customization
      customizations.set(customizationId, customization);

      // Generate CSS for RTL/LTR support
      const cssRules = [];
      
      if (finalDirection === 'rtl') {
        cssRules.push(
          'body { direction: rtl; text-align: right; }',
          '.telepsychiatry-container { direction: rtl; }',
          '.session-controls { flex-direction: row-reverse; }',
          '.chat-messages { text-align: right; }'
        );
      } else {
        cssRules.push(
          'body { direction: ltr; text-align: left; }',
          '.telepsychiatry-container { direction: ltr; }',
          '.session-controls { flex-direction: row; }',
          '.chat-messages { text-align: left; }'
        );
      }

      // Add custom font styles
      if (fonts.primary) {
        cssRules.push(`body, .telepsychiatry-container { font-family: "${fonts.primary}", sans-serif; }`);
      }
      
      if (fonts.heading) {
        cssRules.push(`h1, h2, h3, h4, h5, h6 { font-family: "${fonts.heading}", serif; }`);
      }

      // Add custom styles
      if (customStyles.primaryColor) {
        cssRules.push(`:root { --primary-color: ${customStyles.primaryColor}; }`);
      }
      
      if (customStyles.backgroundColor) {
        cssRules.push(`:root { --background-color: ${customStyles.backgroundColor}; }`);
      }

      const generatedCSS = cssRules.join('\n');

      res.status(201).json({
        customizationId,
        status: 'created',
        language: {
          code: languageCode,
          name: language.name,
          direction: finalDirection,
          region: customization.region
        },
        summary: {
          totalPhrases: customization.metadata.totalPhrases,
          sections: phraseSections,
          hasCustomStyles: Object.keys(customStyles).length > 0,
          hasFonts: Object.keys(fonts).length > 0,
          direction: finalDirection
        },
        generatedCSS,
        timestamp,
        message: 'UI customization created successfully'
      });

    } catch (error) {
      console.error('[UI API] Create customization error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create UI customization'
      });
    }
  }
);

/**
 * GET /ui/customize/:languageCode
 * Retrieves customization for a specific language
 */
router.get('/customize/:languageCode',
  optionalAuth,
  [
    param('languageCode')
      .isIn(Object.keys(supportedLanguages))
      .withMessage('Supported language code is required'),
    query('includeCss')
      .optional()
      .isBoolean()
      .withMessage('Include CSS must be a boolean'),
    query('section')
      .optional()
      .isIn(['general', 'consent', 'session', 'medical'])
      .withMessage('Invalid section name')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid parameters',
          details: errors.array()
        });
      }

      const { languageCode } = req.params;
      const { includeCss = false, section } = req.query;

      const customizationId = `${languageCode}_phrases`;
      const customization = customizations.get(customizationId);
      const language = supportedLanguages[languageCode];

      if (!language) {
        return res.status(404).json({
          error: 'LANGUAGE_NOT_FOUND',
          message: `Language ${languageCode} not found`
        });
      }

      // Use default phrases if no customization exists
      let phrases = defaultPhrases[languageCode] || defaultPhrases.en;
      let metadata = {
        isDefault: true,
        direction: language.direction,
        region: language.region
      };

      if (customization) {
        phrases = customization.phrases;
        metadata = {
          ...customization.metadata,
          isDefault: false,
          direction: customization.direction,
          region: customization.region
        };
      }

      // Filter by section if requested
      if (section && phrases[section]) {
        phrases = { [section]: phrases[section] };
      }

      const response = {
        languageCode,
        languageName: language.name,
        direction: metadata.direction,
        region: metadata.region,
        phrases,
        metadata
      };

      // Include CSS if requested
      if (includeCss && customization) {
        const cssRules = [];
        
        if (customization.direction === 'rtl') {
          cssRules.push(
            'body { direction: rtl; text-align: right; }',
            '.telepsychiatry-container { direction: rtl; }'
          );
        } else {
          cssRules.push(
            'body { direction: ltr; text-align: left; }',
            '.telepsychiatry-container { direction: ltr; }'
          );
        }

        if (customization.fonts.primary) {
          cssRules.push(`body { font-family: "${customization.fonts.primary}", sans-serif; }`);
        }

        response.css = cssRules.join('\n');
        response.customStyles = customization.customStyles;
        response.fonts = customization.fonts;
      }

      res.json(response);

    } catch (error) {
      console.error('[UI API] Get customization error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve UI customization'
      });
    }
  }
);

/**
 * DELETE /ui/customize/:languageCode
 * Removes customization for a specific language (resets to default)
 */
router.delete('/customize/:languageCode',
  requireAuth,
  [
    param('languageCode')
      .isIn(Object.keys(supportedLanguages))
      .withMessage('Supported language code is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid language code',
          details: errors.array()
        });
      }

      const { languageCode } = req.params;
      const customizationId = `${languageCode}_phrases`;
      
      const existed = customizations.has(customizationId);
      if (existed) {
        customizations.delete(customizationId);
      }

      res.json({
        languageCode,
        status: existed ? 'deleted' : 'not_found',
        message: existed 
          ? 'Customization deleted, language reset to default'
          : 'No customization found for this language',
        resetToDefault: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[UI API] Delete customization error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete UI customization'
      });
    }
  }
);

module.exports = router;