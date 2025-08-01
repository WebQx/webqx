<?php
/**
 * WebQX™ OpenEMR Keycloak Integration Configuration
 * 
 * Configuration file for OpenEMR to integrate with Keycloak for OAuth2/OpenID Connect authentication.
 * This file should be placed in OpenEMR's sites/default/config/ directory.
 */

// Keycloak OAuth2/OpenID Connect Configuration
$GLOBALS['oauth2_keycloak_config'] = array(
    // Enable Keycloak integration
    'enabled' => true,
    
    // Keycloak Server Configuration
    'server_url' => 'http://localhost:8080/auth',
    'realm' => 'webqx-healthcare',
    
    // Client Configuration
    'client_id' => 'webqx-openemr',
    'client_secret' => 'your-client-secret-here', // Should match Keycloak client secret
    
    // OAuth2 Flow Configuration
    'grant_type' => 'authorization_code',
    'response_type' => 'code',
    'scope' => 'openid profile email healthcare',
    
    // Endpoints (auto-discovered from well-known configuration)
    'authorization_endpoint' => '',  // Will be auto-discovered
    'token_endpoint' => '',          // Will be auto-discovered
    'userinfo_endpoint' => '',       // Will be auto-discovered
    'jwks_uri' => '',               // Will be auto-discovered
    'end_session_endpoint' => '',    // Will be auto-discovered
    
    // Token Validation
    'validate_tokens' => true,
    'verify_ssl' => true,
    'token_cache_time' => 300, // seconds
    
    // User Mapping Configuration
    'user_mapping' => array(
        // Map Keycloak claims to OpenEMR user fields
        'username' => 'preferred_username',
        'email' => 'email',
        'first_name' => 'given_name',
        'last_name' => 'family_name',
        'npi' => 'npi_number',
        'dea' => 'dea_number',
        'medical_license' => 'medical_license',
        'specialty' => 'specialty',
        'department' => 'department',
        'verification_status' => 'provider_verification_status'
    ),
    
    // Role Mapping Configuration
    'role_mapping' => array(
        // Map Keycloak roles to OpenEMR ACL groups
        'patient' => 'Patient',
        'healthcare-provider' => 'Physician',
        'primary-care-physician' => 'Physician',
        'specialist-physician' => 'Physician',
        'nurse' => 'Nurse',
        'resident' => 'Resident',
        'fellow' => 'Fellow',
        'attending-physician' => 'Attending',
        'healthcare-admin' => 'Administrator',
        'billing-staff' => 'Billing',
        'pharmacist' => 'Pharmacist',
        'lab-technician' => 'Lab Tech',
        'radiology-technician' => 'Rad Tech'
    ),
    
    // Auto-registration Configuration
    'auto_register_users' => true,
    'default_facility' => 1, // Default facility ID for new users
    'default_calendar_category' => 'default',
    
    // Session Configuration
    'session_timeout' => 3600, // seconds
    'refresh_token_enabled' => true,
    'single_sign_out' => true,
    
    // Security Configuration
    'require_https' => true,
    'csrf_protection' => true,
    'audit_all_logins' => true,
    
    // Provider Verification
    'require_provider_verification' => true,
    'verify_npi' => true,
    'verify_medical_license' => true,
    'verify_dea' => false, // Optional
    
    // Logging Configuration
    'enable_debug_logging' => false,
    'log_file' => 'logs/keycloak_auth.log',
    'log_level' => 'INFO' // DEBUG, INFO, WARN, ERROR
);

// WebQX Integration Configuration
$GLOBALS['webqx_integration_config'] = array(
    'enabled' => true,
    'api_base_url' => 'http://localhost:3000/api',
    'sync_patient_data' => true,
    'sync_appointments' => true,
    'sync_lab_results' => true,
    'enable_real_time_sync' => false,
    'webhook_endpoints' => array(
        'patient_updated' => '/webhooks/patient-updated',
        'appointment_created' => '/webhooks/appointment-created',
        'lab_result_available' => '/webhooks/lab-result-available'
    )
);

// Specialty-specific Access Control
$GLOBALS['specialty_access_control'] = array(
    'PRIMARY_CARE' => array(
        'menus' => array('clinical', 'calendar', 'patients', 'reports'),
        'modules' => array('patient_tracker', 'immunizations', 'vitals'),
        'restrictions' => array()
    ),
    'CARDIOLOGY' => array(
        'menus' => array('clinical', 'calendar', 'patients', 'reports'),
        'modules' => array('cardiology', 'ecg', 'stress_tests'),
        'restrictions' => array('no_prescription_narcotics')
    ),
    'RADIOLOGY' => array(
        'menus' => array('clinical', 'imaging', 'reports'),
        'modules' => array('dicom_viewer', 'rad_reports'),
        'restrictions' => array('read_only_patient_data')
    ),
    'ONCOLOGY' => array(
        'menus' => array('clinical', 'calendar', 'patients', 'reports'),
        'modules' => array('chemotherapy', 'radiation_tracking'),
        'restrictions' => array()
    ),
    'PSYCHIATRY' => array(
        'menus' => array('clinical', 'calendar', 'patients'),
        'modules' => array('mental_health', 'therapy_notes'),
        'restrictions' => array('no_lab_orders')
    )
);

// FHIR Integration Configuration
$GLOBALS['fhir_keycloak_config'] = array(
    'enabled' => true,
    'version' => 'R4',
    'base_url' => 'http://localhost:3000/fhir',
    'require_oauth' => true,
    'validate_tokens' => true,
    'supported_resources' => array(
        'Patient', 'Practitioner', 'Organization', 'Location',
        'Encounter', 'Observation', 'DiagnosticReport', 'Medication',
        'MedicationRequest', 'Appointment', 'Schedule', 'Slot'
    ),
    'scopes' => array(
        'patient/*.read', 'patient/*.write',
        'user/*.read', 'user/*.write',
        'system/*.read'
    )
);

// Error Handling Configuration
$GLOBALS['keycloak_error_handling'] = array(
    'show_detailed_errors' => false, // Set to true only in development
    'fallback_to_local_auth' => false, // Emergency fallback
    'maintenance_mode_message' => 'Authentication service is temporarily unavailable. Please try again later.',
    'redirect_on_error' => '/login.php?error=auth_failed'
);

// Cache Configuration
$GLOBALS['keycloak_cache_config'] = array(
    'enabled' => true,
    'type' => 'file', // file, redis, memcache
    'ttl' => 300, // seconds
    'cache_dir' => 'sites/default/documents/cache/keycloak',
    // Redis configuration (if using Redis cache)
    'redis_host' => 'localhost',
    'redis_port' => 6379,
    'redis_password' => '',
    'redis_database' => 0
);

// Development/Testing Configuration
if (isset($_SERVER['SERVER_NAME']) && 
    (strpos($_SERVER['SERVER_NAME'], 'localhost') !== false || 
     strpos($_SERVER['SERVER_NAME'], 'dev') !== false)) {
    
    // Override settings for development
    $GLOBALS['oauth2_keycloak_config']['verify_ssl'] = false;
    $GLOBALS['oauth2_keycloak_config']['enable_debug_logging'] = true;
    $GLOBALS['oauth2_keycloak_config']['log_level'] = 'DEBUG';
    $GLOBALS['keycloak_error_handling']['show_detailed_errors'] = true;
}

?>