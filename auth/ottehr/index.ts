/**
 * @fileoverview Ottehr Authentication Module
 * 
 * Exports all authentication-related functionality for Ottehr integration.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

export {
  OttehrAuthManager,
  createOttehrAuthManager,
  MemoryTokenStorage,
  LocalStorageTokenStorage,
  type OttehrAuthConfig,
  type TokenStorage,
  type TokenInfo,
  type AuthResult
} from './authManager';

export default OttehrAuthManager;