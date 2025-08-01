/**
 * Telehealth Module
 * 
 * Comprehensive telehealth module providing Jitsi integration, session management,
 * multilingual transcription/translation, and analytics dashboard integration.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

export * from './types';
export * from './services/jitsiService';
export * from './services/telehealthService';

// Re-export convenience functions
export { createTelehealthRoom } from './services/jitsiService';

// Default exports for convenience
export { jitsiService as JitsiService } from './services/jitsiService';
export { telehealthService as TelehealthService } from './services/telehealthService';