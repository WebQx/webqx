<?php
/**
 * WebQX FHIR Integration Class
 *
 * @package WebQX_Integration
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WebQX FHIR Integration Class
 */
class WebQX_FHIR_Integration {
    
    /**
     * Initialize FHIR integration
     */
    public static function init() {
        if (!get_option('webqx_enable_fhir', true)) {
            return;
        }
        
        add_action('rest_api_init', array(__CLASS__, 'register_fhir_routes'));
        add_action('wp_ajax_webqx_fhir_test', array(__CLASS__, 'ajax_fhir_test'));
        add_action('wp_ajax_webqx_load_fhir_resources', array(__CLASS__, 'ajax_load_fhir_resources'));
    }
    
    /**
     * Register FHIR-specific REST routes
     */
    public static function register_fhir_routes() {
        // FHIR Capability Statement
        register_rest_route('webqx/fhir/v1', '/metadata', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'get_capability_statement'),
            'permission_callback' => '__return_true',
        ));
        
        // FHIR Resource endpoints
        $fhir_resources = array('Patient', 'Observation', 'Appointment', 'Practitioner', 'Organization', 'Medication', 'DiagnosticReport', 'ImagingStudy');
        
        foreach ($fhir_resources as $resource) {
            // GET /fhir/v1/Patient
            register_rest_route('webqx/fhir/v1', '/' . $resource, array(
                'methods' => 'GET',
                'callback' => array(__CLASS__, 'get_fhir_resources'),
                'permission_callback' => array(__CLASS__, 'check_fhir_permissions'),
                'args' => array(
                    'resource_type' => array(
                        'default' => $resource,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ));
            
            // GET /fhir/v1/Patient/123
            register_rest_route('webqx/fhir/v1', '/' . $resource . '/(?P<id>[a-zA-Z0-9\-]+)', array(
                'methods' => 'GET',
                'callback' => array(__CLASS__, 'get_fhir_resource_by_id'),
                'permission_callback' => array(__CLASS__, 'check_fhir_permissions'),
                'args' => array(
                    'resource_type' => array(
                        'default' => $resource,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ));
            
            // POST /fhir/v1/Patient
            register_rest_route('webqx/fhir/v1', '/' . $resource, array(
                'methods' => 'POST',
                'callback' => array(__CLASS__, 'create_fhir_resource'),
                'permission_callback' => array(__CLASS__, 'check_fhir_write_permissions'),
                'args' => array(
                    'resource_type' => array(
                        'default' => $resource,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ));
            
            // PUT /fhir/v1/Patient/123
            register_rest_route('webqx/fhir/v1', '/' . $resource . '/(?P<id>[a-zA-Z0-9\-]+)', array(
                'methods' => 'PUT',
                'callback' => array(__CLASS__, 'update_fhir_resource'),
                'permission_callback' => array(__CLASS__, 'check_fhir_write_permissions'),
                'args' => array(
                    'resource_type' => array(
                        'default' => $resource,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ));
        }
    }
    
    /**
     * Get FHIR Capability Statement
     */
    public static function get_capability_statement($request) {
        $capability = array(
            'resourceType' => 'CapabilityStatement',
            'id' => 'webqx-wordpress-integration',
            'version' => WEBQX_PLUGIN_VERSION,
            'name' => 'WebQX WordPress Integration FHIR Server',
            'status' => 'active',
            'date' => current_time('c'),
            'publisher' => 'WebQX Health',
            'description' => 'FHIR R4 capability statement for WebQX WordPress integration',
            'kind' => 'instance',
            'fhirVersion' => '4.0.1',
            'format' => array('json', 'xml'),
            'rest' => array(
                array(
                    'mode' => 'server',
                    'resource' => array(
                        array(
                            'type' => 'Patient',
                            'interaction' => array(
                                array('code' => 'read'),
                                array('code' => 'search-type'),
                                array('code' => 'create'),
                                array('code' => 'update'),
                            ),
                        ),
                        array(
                            'type' => 'Observation',
                            'interaction' => array(
                                array('code' => 'read'),
                                array('code' => 'search-type'),
                                array('code' => 'create'),
                            ),
                        ),
                        array(
                            'type' => 'Appointment',
                            'interaction' => array(
                                array('code' => 'read'),
                                array('code' => 'search-type'),
                                array('code' => 'create'),
                                array('code' => 'update'),
                            ),
                        ),
                    ),
                ),
            ),
        );
        
        return rest_ensure_response($capability);
    }
    
    /**
     * Get FHIR resources
     */
    public static function get_fhir_resources($request) {
        $resource_type = $request['resource_type'];
        $plugin = webqx_integration();
        
        // Forward request to WebQX API
        $query_params = $request->get_query_params();
        $query_string = !empty($query_params) ? '?' . http_build_query($query_params) : '';
        
        $response = $plugin->api_request("fhir/{$resource_type}{$query_string}");
        
        if (!$response['success']) {
            return new WP_Error('fhir_error', $response['error'], array('status' => 500));
        }
        
        // Ensure FHIR Bundle format
        $bundle_data = self::ensure_fhir_bundle($response['data'], $resource_type);
        
        return rest_ensure_response($bundle_data);
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
            if ($response['status_code'] === 404) {
                return new WP_Error('resource_not_found', 'Resource not found', array('status' => 404));
            }
            return new WP_Error('fhir_error', $response['error'], array('status' => 500));
        }
        
        return rest_ensure_response($response['data']);
    }
    
    /**
     * Create FHIR resource
     */
    public static function create_fhir_resource($request) {
        $resource_type = $request['resource_type'];
        $resource_data = $request->get_json_params();
        $plugin = webqx_integration();
        
        // Validate FHIR resource
        $validation_result = self::validate_fhir_resource($resource_data, $resource_type);
        if (is_wp_error($validation_result)) {
            return $validation_result;
        }
        
        $response = $plugin->api_request("fhir/{$resource_type}", 'POST', $resource_data);
        
        if (!$response['success']) {
            return new WP_Error('fhir_create_error', $response['error'], array('status' => 500));
        }
        
        // Log activity
        $plugin->log_activity('fhir', 'create', $response['data']['id'], array(
            'resource_type' => $resource_type,
            'resource_id' => $response['data']['id'],
        ));
        
        return rest_ensure_response($response['data']);
    }
    
    /**
     * Update FHIR resource
     */
    public static function update_fhir_resource($request) {
        $resource_type = $request['resource_type'];
        $resource_id = $request['id'];
        $resource_data = $request->get_json_params();
        $plugin = webqx_integration();
        
        // Validate FHIR resource
        $validation_result = self::validate_fhir_resource($resource_data, $resource_type);
        if (is_wp_error($validation_result)) {
            return $validation_result;
        }
        
        $response = $plugin->api_request("fhir/{$resource_type}/{$resource_id}", 'PUT', $resource_data);
        
        if (!$response['success']) {
            if ($response['status_code'] === 404) {
                return new WP_Error('resource_not_found', 'Resource not found', array('status' => 404));
            }
            return new WP_Error('fhir_update_error', $response['error'], array('status' => 500));
        }
        
        // Log activity
        $plugin->log_activity('fhir', 'update', $resource_id, array(
            'resource_type' => $resource_type,
            'resource_id' => $resource_id,
        ));
        
        return rest_ensure_response($response['data']);
    }
    
    /**
     * Ensure FHIR Bundle format
     */
    private static function ensure_fhir_bundle($data, $resource_type) {
        // If already a bundle, return as-is
        if (isset($data['resourceType']) && $data['resourceType'] === 'Bundle') {
            return $data;
        }
        
        // If it's an array of resources, wrap in bundle
        if (is_array($data) && !isset($data['resourceType'])) {
            $entries = array();
            foreach ($data as $resource) {
                $entries[] = array(
                    'resource' => $resource,
                    'fullUrl' => site_url("wp-json/webqx/fhir/v1/{$resource_type}/{$resource['id']}"),
                );
            }
            
            return array(
                'resourceType' => 'Bundle',
                'id' => 'webqx-search-results',
                'type' => 'searchset',
                'total' => count($entries),
                'entry' => $entries,
            );
        }
        
        // Single resource, wrap in bundle
        return array(
            'resourceType' => 'Bundle',
            'id' => 'webqx-search-results',
            'type' => 'searchset',
            'total' => 1,
            'entry' => array(
                array(
                    'resource' => $data,
                    'fullUrl' => site_url("wp-json/webqx/fhir/v1/{$resource_type}/{$data['id']}"),
                ),
            ),
        );
    }
    
    /**
     * Validate FHIR resource
     */
    private static function validate_fhir_resource($resource_data, $expected_type) {
        if (!is_array($resource_data)) {
            return new WP_Error('invalid_resource', 'Resource must be a valid JSON object', array('status' => 400));
        }
        
        if (!isset($resource_data['resourceType'])) {
            return new WP_Error('missing_resource_type', 'Resource must have a resourceType', array('status' => 400));
        }
        
        if ($resource_data['resourceType'] !== $expected_type) {
            return new WP_Error('resource_type_mismatch', "Expected {$expected_type}, got {$resource_data['resourceType']}", array('status' => 400));
        }
        
        // Basic validation passed
        return true;
    }
    
    /**
     * Check FHIR read permissions
     */
    public static function check_fhir_permissions($request) {
        // Allow read access for logged-in users or providers
        return is_user_logged_in() || current_user_can('edit_posts');
    }
    
    /**
     * Check FHIR write permissions
     */
    public static function check_fhir_write_permissions($request) {
        // Only allow write access for providers/administrators
        return current_user_can('edit_posts');
    }
    
    /**
     * AJAX handler for FHIR testing
     */
    public static function ajax_fhir_test() {
        check_ajax_referer('webqx_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(json_encode(array('success' => false, 'error' => 'Insufficient permissions')));
        }
        
        $resource_type = sanitize_text_field($_POST['resource_type']);
        $method = sanitize_text_field($_POST['method']);
        $resource_id = sanitize_text_field($_POST['resource_id']);
        
        $plugin = webqx_integration();
        
        $endpoint = "fhir/{$resource_type}";
        if ($resource_id && $method !== 'POST') {
            $endpoint .= "/{$resource_id}";
        }
        
        $response = $plugin->api_request($endpoint, $method);
        
        wp_die(json_encode($response));
    }
    
    /**
     * AJAX handler for loading FHIR resources in admin
     */
    public static function ajax_load_fhir_resources() {
        check_ajax_referer('webqx_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(json_encode(array('success' => false, 'error' => 'Insufficient permissions')));
        }
        
        $resource_type = sanitize_text_field($_POST['resource_type']);
        $plugin = webqx_integration();
        
        $response = $plugin->api_request("fhir/{$resource_type}");
        
        if ($response['success']) {
            $html = self::render_fhir_resources_table($response['data'], $resource_type);
            wp_die(json_encode(array('success' => true, 'html' => $html)));
        } else {
            wp_die(json_encode(array('success' => false, 'error' => $response['error'])));
        }
    }
    
    /**
     * Render FHIR resources table for admin
     */
    private static function render_fhir_resources_table($data, $resource_type) {
        $resources = array();
        
        // Extract resources from bundle or direct array
        if (isset($data['resourceType']) && $data['resourceType'] === 'Bundle') {
            if (isset($data['entry'])) {
                foreach ($data['entry'] as $entry) {
                    if (isset($entry['resource'])) {
                        $resources[] = $entry['resource'];
                    }
                }
            }
        } elseif (is_array($data)) {
            $resources = $data;
        }
        
        if (empty($resources)) {
            return '<p>' . __('No resources found.', 'webqx-integration') . '</p>';
        }
        
        $html = '<table class="wp-list-table widefat fixed striped">';
        $html .= '<thead><tr>';
        $html .= '<th>' . __('ID', 'webqx-integration') . '</th>';
        $html .= '<th>' . __('Type', 'webqx-integration') . '</th>';
        
        // Add resource-specific columns
        switch ($resource_type) {
            case 'Patient':
                $html .= '<th>' . __('Name', 'webqx-integration') . '</th>';
                $html .= '<th>' . __('Gender', 'webqx-integration') . '</th>';
                $html .= '<th>' . __('Birth Date', 'webqx-integration') . '</th>';
                break;
            case 'Observation':
                $html .= '<th>' . __('Code', 'webqx-integration') . '</th>';
                $html .= '<th>' . __('Value', 'webqx-integration') . '</th>';
                $html .= '<th>' . __('Date', 'webqx-integration') . '</th>';
                break;
            case 'Appointment':
                $html .= '<th>' . __('Status', 'webqx-integration') . '</th>';
                $html .= '<th>' . __('Start', 'webqx-integration') . '</th>';
                $html .= '<th>' . __('End', 'webqx-integration') . '</th>';
                break;
            default:
                $html .= '<th>' . __('Data', 'webqx-integration') . '</th>';
                break;
        }
        
        $html .= '<th>' . __('Actions', 'webqx-integration') . '</th>';
        $html .= '</tr></thead><tbody>';
        
        foreach ($resources as $resource) {
            $html .= '<tr>';
            $html .= '<td>' . esc_html($resource['id'] ?? 'N/A') . '</td>';
            $html .= '<td>' . esc_html($resource['resourceType'] ?? 'N/A') . '</td>';
            
            // Add resource-specific data
            switch ($resource_type) {
                case 'Patient':
                    $name = 'N/A';
                    if (isset($resource['name'][0])) {
                        $name_parts = array();
                        if (isset($resource['name'][0]['given'])) {
                            $name_parts = array_merge($name_parts, $resource['name'][0]['given']);
                        }
                        if (isset($resource['name'][0]['family'])) {
                            $name_parts[] = $resource['name'][0]['family'];
                        }
                        $name = implode(' ', $name_parts);
                    }
                    $html .= '<td>' . esc_html($name) . '</td>';
                    $html .= '<td>' . esc_html($resource['gender'] ?? 'N/A') . '</td>';
                    $html .= '<td>' . esc_html($resource['birthDate'] ?? 'N/A') . '</td>';
                    break;
                case 'Observation':
                    $code = $resource['code']['text'] ?? $resource['code']['coding'][0]['display'] ?? 'N/A';
                    $value = 'N/A';
                    if (isset($resource['valueQuantity'])) {
                        $value = $resource['valueQuantity']['value'] . ' ' . ($resource['valueQuantity']['unit'] ?? '');
                    } elseif (isset($resource['valueString'])) {
                        $value = $resource['valueString'];
                    }
                    $html .= '<td>' . esc_html($code) . '</td>';
                    $html .= '<td>' . esc_html($value) . '</td>';
                    $html .= '<td>' . esc_html($resource['effectiveDateTime'] ?? 'N/A') . '</td>';
                    break;
                case 'Appointment':
                    $html .= '<td>' . esc_html($resource['status'] ?? 'N/A') . '</td>';
                    $html .= '<td>' . esc_html($resource['start'] ?? 'N/A') . '</td>';
                    $html .= '<td>' . esc_html($resource['end'] ?? 'N/A') . '</td>';
                    break;
                default:
                    $html .= '<td><details><summary>' . __('View JSON', 'webqx-integration') . '</summary><pre>' . esc_html(json_encode($resource, JSON_PRETTY_PRINT)) . '</pre></details></td>';
                    break;
            }
            
            $html .= '<td>';
            $html .= '<button class="button button-small webqx-view-resource" data-id="' . esc_attr($resource['id']) . '" data-type="' . esc_attr($resource_type) . '">' . __('View', 'webqx-integration') . '</button>';
            $html .= '</td>';
            $html .= '</tr>';
        }
        
        $html .= '</tbody></table>';
        
        return $html;
    }
}
?>