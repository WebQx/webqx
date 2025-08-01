/**
 * WebQX™ Keycloak Authentication Provider
 * 
 * Provides OAuth2/OpenID Connect integration with Keycloak for healthcare authentication.
 * Supports role mapping and healthcare specialty-based access control.
 */

export { KeycloakAuthProvider } from './provider';
export { KeycloakConfig, KeycloakUser, KeycloakTokenInfo } from './types';
export { keycloakMiddleware, validateKeycloakToken, mapKeycloakRoles } from './middleware';
export { createKeycloakClient, getKeycloakConfig } from './client';