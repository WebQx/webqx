<?php
/**
 * WebQX API Integration
 * 
 * @package WebQX_Healthcare
 * @author WebQX Health
 * @license GPL v2 or later
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WebQX API Class
 * 
 * Handles communication with the WebQX Node.js backend
 */
class WebQX_API {

    /**
     * Class instance
     * 
     * @var WebQX_API
     */
    private static $instance = null;

    /**
     * Core instance
     * 
     * @var WebQX_Core
     */
    private $core;

    /**
     * Get instance
     * 
     * @return WebQX_API
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct() {
        $this->core = WebQX_Core::get_instance();
        $this->init_hooks();
    }

    /**
     * Initialize hooks
     */
    private function init_hooks() {
        add_action('wp_ajax_webqx_api_call', array($this, 'handle_ajax_api_call'));
        add_action('wp_ajax_nopriv_webqx_api_call', array($this, 'handle_ajax_api_call'));
        add_action('wp_ajax_webqx_check_backend', array($this, 'ajax_check_backend'));
    }

    /**
     * Make API request to WebQX backend
     * 
     * @param string $endpoint
     * @param array $args
     * @return array|WP_Error
     */
    public function make_request($endpoint, $args = array()) {
        $backend_url = rtrim($this->core->get_option('backend_url'), '/');
        $url = $backend_url . '/' . ltrim($endpoint, '/');
        
        $default_args = array(
            'timeout' => $this->core->get_option('api_timeout', 30),
            'headers' => array(
                'Content-Type' => 'application/json',
                'User-Agent' => 'WebQX-WordPress-Plugin/' . WEBQX_PLUGIN_VERSION,
            ),
        );
        
        $args = wp_parse_args($args, $default_args);
        
        // Add authentication if available
        $auth_token = $this->get_auth_token();
        if ($auth_token) {
            $args['headers']['Authorization'] = 'Bearer ' . $auth_token;
        }
        
        $this->core->log("Making API request to: {$url}", 'debug', array(
            'endpoint' => $endpoint,
            'method' => isset($args['method']) ? $args['method'] : 'GET',
        ));
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            $this->core->log("API request failed: " . $response->get_error_message(), 'error', array(
                'url' => $url,
                'args' => $args,
            ));
            return $response;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        $this->core->log("API response received", 'debug', array(
            'status_code' => $status_code,
            'url' => $url,
        ));
        
        if ($status_code >= 400) {
            return new WP_Error(
                'webqx_api_error',
                'API request failed with status ' . $status_code,
                array('status_code' => $status_code, 'body' => $body)
            );
        }
        
        $decoded = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return new WP_Error(
                'webqx_json_error',
                'Failed to decode JSON response',
                array('body' => $body)
            );
        }
        
        return $decoded;
    }

    /**
     * Get authentication token
     * 
     * @return string|false
     */
    private function get_auth_token() {
        // Try to get token from user meta or session
        $user_id = get_current_user_id();
        if ($user_id) {
            $token = get_user_meta($user_id, '_webqx_auth_token', true);
            if ($token) {
                // Validate token expiration
                $token_expiry = get_user_meta($user_id, '_webqx_auth_token_expiry', true);
                if ($token_expiry && time() < $token_expiry) {
                    return $token;
                } else {
                    // Token expired, remove it
                    delete_user_meta($user_id, '_webqx_auth_token');
                    delete_user_meta($user_id, '_webqx_auth_token_expiry');
                }
            }
        }
        
        return false;
    }

    /**
     * Set authentication token
     * 
     * @param string $token
     * @param int $expires_in Seconds until expiration
     * @return bool
     */
    public function set_auth_token($token, $expires_in = 3600) {
        $user_id = get_current_user_id();
        if (!$user_id) {
            return false;
        }
        
        $expiry = time() + $expires_in;
        
        update_user_meta($user_id, '_webqx_auth_token', sanitize_text_field($token));
        update_user_meta($user_id, '_webqx_auth_token_expiry', $expiry);
        
        return true;
    }

    /**
     * Check backend connection
     * 
     * @return array
     */
    public function check_backend_connection() {
        $response = $this->make_request('/health');
        
        if (is_wp_error($response)) {
            return array(
                'connected' => false,
                'error' => $response->get_error_message(),
                'status' => 'error',
            );
        }
        
        return array(
            'connected' => true,
            'status' => 'ok',
            'backend_info' => $response,
        );
    }

    /**
     * Get patient data
     * 
     * @param int $patient_id
     * @return array|WP_Error
     */
    public function get_patient($patient_id) {
        return $this->make_request("/api/patients/{$patient_id}");
    }

    /**
     * Create patient
     * 
     * @param array $patient_data
     * @return array|WP_Error
     */
    public function create_patient($patient_data) {
        $args = array(
            'method' => 'POST',
            'body' => json_encode($patient_data),
        );
        
        return $this->make_request('/api/patients', $args);
    }

    /**
     * Update patient
     * 
     * @param int $patient_id
     * @param array $patient_data
     * @return array|WP_Error
     */
    public function update_patient($patient_id, $patient_data) {
        $args = array(
            'method' => 'PUT',
            'body' => json_encode($patient_data),
        );
        
        return $this->make_request("/api/patients/{$patient_id}", $args);
    }

    /**
     * Get appointments
     * 
     * @param array $filters
     * @return array|WP_Error
     */
    public function get_appointments($filters = array()) {
        $query_string = !empty($filters) ? '?' . http_build_query($filters) : '';
        return $this->make_request("/api/appointments{$query_string}");
    }

    /**
     * Create appointment
     * 
     * @param array $appointment_data
     * @return array|WP_Error
     */
    public function create_appointment($appointment_data) {
        $args = array(
            'method' => 'POST',
            'body' => json_encode($appointment_data),
        );
        
        return $this->make_request('/api/appointments', $args);
    }

    /**
     * Get providers
     * 
     * @param array $filters
     * @return array|WP_Error
     */
    public function get_providers($filters = array()) {
        $query_string = !empty($filters) ? '?' . http_build_query($filters) : '';
        return $this->make_request("/api/providers{$query_string}");
    }

    /**
     * Get FHIR resources
     * 
     * @param string $resource_type
     * @param array $params
     * @return array|WP_Error
     */
    public function get_fhir_resources($resource_type, $params = array()) {
        $query_string = !empty($params) ? '?' . http_build_query($params) : '';
        return $this->make_request("/fhir/{$resource_type}{$query_string}");
    }

    /**
     * Handle AJAX API call
     */
    public function handle_ajax_api_call() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'webqx_frontend_nonce') && 
            !wp_verify_nonce($_POST['nonce'], 'webqx_admin_nonce')) {
            wp_die(__('Security check failed', 'webqx-healthcare'));
        }
        
        $endpoint = sanitize_text_field($_POST['endpoint'] ?? '');
        $method = sanitize_text_field($_POST['method'] ?? 'GET');
        $data = isset($_POST['data']) ? json_decode(stripslashes($_POST['data']), true) : array();
        
        if (empty($endpoint)) {
            wp_send_json_error(__('Endpoint is required', 'webqx-healthcare'));
        }
        
        // Check permissions
        if (!current_user_can('read') && !$this->is_public_endpoint($endpoint)) {
            wp_send_json_error(__('Insufficient permissions', 'webqx-healthcare'));
        }
        
        // Sanitize healthcare data if HIPAA mode is enabled
        if ($this->core->is_hipaa_mode_enabled()) {
            $data = $this->core->sanitize_healthcare_data($data);
        }
        
        $args = array('method' => $method);
        if (!empty($data)) {
            $args['body'] = json_encode($data);
        }
        
        $response = $this->make_request($endpoint, $args);
        
        if (is_wp_error($response)) {
            wp_send_json_error($response->get_error_message());
        }
        
        wp_send_json_success($response);
    }

    /**
     * Check if endpoint is public
     * 
     * @param string $endpoint
     * @return bool
     */
    private function is_public_endpoint($endpoint) {
        $public_endpoints = array(
            '/health',
            '/api/public/providers',
            '/api/public/specialties',
        );
        
        return in_array($endpoint, $public_endpoints, true);
    }

    /**
     * AJAX check backend connection
     */
    public function ajax_check_backend() {
        if (!wp_verify_nonce($_POST['nonce'], 'webqx_admin_nonce')) {
            wp_die(__('Security check failed', 'webqx-healthcare'));
        }
        
        if (!current_user_can('manage_webqx')) {
            wp_send_json_error(__('Insufficient permissions', 'webqx-healthcare'));
        }
        
        $status = $this->check_backend_connection();
        wp_send_json_success($status);
    }

    /**
     * Authenticate user with WebQX backend
     * 
     * @param string $username
     * @param string $password
     * @return array|WP_Error
     */
    public function authenticate_user($username, $password) {
        $args = array(
            'method' => 'POST',
            'body' => json_encode(array(
                'username' => sanitize_text_field($username),
                'password' => $password, // Don't sanitize password
            )),
        );
        
        $response = $this->make_request('/api/auth/login', $args);
        
        if (!is_wp_error($response) && isset($response['token'])) {
            // Set the token for future requests
            $expires_in = isset($response['expires_in']) ? $response['expires_in'] : 3600;
            $this->set_auth_token($response['token'], $expires_in);
        }
        
        return $response;
    }

    /**
     * Logout user from WebQX backend
     * 
     * @return array|WP_Error
     */
    public function logout_user() {
        $response = $this->make_request('/api/auth/logout', array('method' => 'POST'));
        
        // Remove token regardless of response
        $user_id = get_current_user_id();
        if ($user_id) {
            delete_user_meta($user_id, '_webqx_auth_token');
            delete_user_meta($user_id, '_webqx_auth_token_expiry');
        }
        
        return $response;
    }
}