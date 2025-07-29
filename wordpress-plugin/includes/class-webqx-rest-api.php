<?php
/**
 * WebQX REST API Integration Class
 *
 * @package WebQX_Integration
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WebQX REST API Class
 */
class WebQX_REST_API {
    
    /**
     * Initialize REST API routes
     */
    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
    }
    
    /**
     * Register REST API routes
     */
    public static function register_routes() {
        // Patient portal routes
        register_rest_route('webqx/v1', '/patient/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'get_patient_data'),
            'permission_callback' => array(__CLASS__, 'check_patient_permissions'),
        ));
        
        register_rest_route('webqx/v1', '/appointments', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'get_appointments'),
            'permission_callback' => array(__CLASS__, 'check_user_permissions'),
        ));
        
        register_rest_route('webqx/v1', '/appointments', array(
            'methods' => 'POST',
            'callback' => array(__CLASS__, 'create_appointment'),
            'permission_callback' => array(__CLASS__, 'check_user_permissions'),
        ));
        
        // Provider routes
        register_rest_route('webqx/v1', '/provider/dashboard', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'get_provider_dashboard'),
            'permission_callback' => array(__CLASS__, 'check_provider_permissions'),
        ));
        
        // EHR routes
        register_rest_route('webqx/v1', '/ehr/patients', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'get_ehr_patients'),
            'permission_callback' => array(__CLASS__, 'check_provider_permissions'),
        ));
        
        // FHIR routes
        register_rest_route('webqx/v1', '/fhir/(?P<resource_type>[a-zA-Z]+)', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'get_fhir_resource'),
            'permission_callback' => array(__CLASS__, 'check_fhir_permissions'),
        ));
        
        register_rest_route('webqx/v1', '/fhir/(?P<resource_type>[a-zA-Z]+)/(?P<id>[a-zA-Z0-9\-]+)', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'get_fhir_resource_by_id'),
            'permission_callback' => array(__CLASS__, 'check_fhir_permissions'),
        ));
        
        // Health check route
        register_rest_route('webqx/v1', '/health', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'health_check'),
            'permission_callback' => '__return_true',
        ));
    }
    
    /**
     * Get patient data
     */
    public static function get_patient_data($request) {
        $patient_id = $request['id'];
        $plugin = webqx_integration();
        
        $response = $plugin->api_request("patients/{$patient_id}");
        
        if (!$response['success']) {
            return new WP_Error('api_error', $response['error'], array('status' => 500));
        }
        
        return rest_ensure_response($response['data']);
    }
    
    /**
     * Get appointments
     */
    public static function get_appointments($request) {
        $plugin = webqx_integration();
        $user_id = get_current_user_id();
        
        $response = $plugin->api_request("appointments?user_id={$user_id}");
        
        if (!$response['success']) {
            return new WP_Error('api_error', $response['error'], array('status' => 500));
        }
        
        return rest_ensure_response($response['data']);
    }
    
    /**
     * Create appointment
     */
    public static function create_appointment($request) {
        $plugin = webqx_integration();
        $params = $request->get_json_params();
        
        // Add current user ID to appointment data
        $params['user_id'] = get_current_user_id();
        
        $response = $plugin->api_request('appointments', 'POST', $params);
        
        if (!$response['success']) {
            return new WP_Error('api_error', $response['error'], array('status' => 500));
        }
        
        // Log activity
        $plugin->log_activity('appointment', 'create', $response['data']['id'], $params);
        
        return rest_ensure_response($response['data']);
    }
    
    /**
     * Get provider dashboard data
     */
    public static function get_provider_dashboard($request) {
        $plugin = webqx_integration();
        $user_id = get_current_user_id();
        
        $response = $plugin->api_request("providers/{$user_id}/dashboard");
        
        if (!$response['success']) {
            return new WP_Error('api_error', $response['error'], array('status' => 500));
        }
        
        return rest_ensure_response($response['data']);
    }
    
    /**
     * Get EHR patients
     */
    public static function get_ehr_patients($request) {
        $plugin = webqx_integration();
        
        $response = $plugin->api_request('ehr/patients');
        
        if (!$response['success']) {
            return new WP_Error('api_error', $response['error'], array('status' => 500));
        }
        
        return rest_ensure_response($response['data']);
    }
    
    /**
     * Get FHIR resource
     */
    public static function get_fhir_resource($request) {
        $resource_type = $request['resource_type'];
        $plugin = webqx_integration();
        
        $response = $plugin->api_request("fhir/{$resource_type}");
        
        if (!$response['success']) {
            return new WP_Error('api_error', $response['error'], array('status' => 500));
        }
        
        return rest_ensure_response($response['data']);
    }
    
    /**
     * Get FHIR resource by ID
     */
    public static function get_fhir_resource_by_id($request) {
        $resource_type = $request['resource_type'];
        $resource_id = $request['id'];
        $plugin = webqx_integration();
        
        $response = $plugin->api_request("fhir/{$resource_type}/{$resource_id}");
        
        if (!$response['success']) {
            return new WP_Error('api_error', $response['error'], array('status' => 500));
        }
        
        return rest_ensure_response($response['data']);
    }
    
    /**
     * Health check endpoint
     */
    public static function health_check($request) {
        $plugin = webqx_integration();
        
        // Check if WebQX API is available
        $api_response = $plugin->api_request('health');
        
        $health_data = array(
            'wordpress' => array(
                'status' => 'operational',
                'version' => get_bloginfo('version'),
                'plugin_version' => WEBQX_PLUGIN_VERSION,
            ),
            'webqx_api' => array(
                'status' => $api_response['success'] ? 'operational' : 'error',
                'url' => $plugin->get_api_base_url(),
                'response_time' => null, // Could add timing here
            ),
            'database' => array(
                'status' => self::check_database_health() ? 'operational' : 'error',
            ),
            'features' => array(
                'fhir_enabled' => (bool) get_option('webqx_enable_fhir', true),
                'cache_enabled' => (bool) get_option('webqx_enable_cache', true),
                'audit_log_enabled' => (bool) get_option('webqx_enable_audit_log', true),
            ),
        );
        
        $overall_status = ($health_data['wordpress']['status'] === 'operational' && 
                          $health_data['webqx_api']['status'] === 'operational' && 
                          $health_data['database']['status'] === 'operational') ? 'operational' : 'degraded';
        
        $health_data['overall_status'] = $overall_status;
        $health_data['timestamp'] = current_time('mysql');
        
        return rest_ensure_response($health_data);
    }
    
    /**
     * Check database health
     */
    private static function check_database_health() {
        global $wpdb;
        
        try {
            $wpdb->get_var("SELECT 1");
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Check if user has patient permissions
     */
    public static function check_patient_permissions($request) {
        if (!is_user_logged_in()) {
            return false;
        }
        
        $patient_id = $request['id'];
        $current_user_id = get_current_user_id();
        
        // Allow users to access their own data, or providers to access any patient
        return ($current_user_id == $patient_id) || current_user_can('edit_posts');
    }
    
    /**
     * Check if user has basic user permissions
     */
    public static function check_user_permissions($request) {
        return is_user_logged_in();
    }
    
    /**
     * Check if user has provider permissions
     */
    public static function check_provider_permissions($request) {
        return current_user_can('edit_posts');
    }
    
    /**
     * Check if user has FHIR permissions
     */
    public static function check_fhir_permissions($request) {
        // FHIR access requires provider permissions or specific FHIR capability
        return current_user_can('edit_posts') || current_user_can('webqx_fhir_access');
    }
}
?>