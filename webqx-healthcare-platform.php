<?php
/**
 * Plugin Name: WebQX Healthcare Platform
 * Plugin URI: https://github.com/WebQx/webqx
 * Description: WebQX™: A comprehensive modular healthcare platform providing patient portals, provider dashboards, telehealth capabilities, and FHIR-compliant EHR integrations. Features include secure messaging, appointment scheduling, lab results viewing, and multilingual support for global healthcare accessibility.
 * Version: 1.0.0
 * Author: WebQX Health
 * Author URI: https://webqx.health
 * License: Apache-2.0
 * License URI: http://www.apache.org/licenses/LICENSE-2.0
 * Text Domain: webqx-healthcare
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * Network: false
 *
 * @package WebQX_Healthcare_Platform
 * @version 1.0.0
 * @author WebQX Health
 * @license Apache-2.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('WEBQX_VERSION', '1.0.0');
define('WEBQX_PLUGIN_FILE', __FILE__);
define('WEBQX_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WEBQX_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WEBQX_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main WebQX Healthcare Platform Plugin Class
 */
class WebQX_Healthcare_Platform {
    
    /**
     * Single instance of the plugin
     */
    private static $instance = null;
    
    /**
     * Get single instance of the plugin
     *
     * @return WebQX_Healthcare_Platform
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
        $this->init_hooks();
    }
    
    /**
     * Initialize hooks
     */
    private function init_hooks() {
        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'admin_menu'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        add_action('wp_ajax_webqx_proxy', array($this, 'ajax_proxy_handler'));
        add_action('wp_ajax_nopriv_webqx_proxy', array($this, 'ajax_proxy_handler'));
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        
        // Activation and deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    /**
     * Initialize plugin
     */
    public function init() {
        // Load text domain for internationalization
        load_plugin_textdomain('webqx-healthcare', false, dirname(plugin_basename(__FILE__)) . '/languages');
        
        // Initialize components
        $this->init_shortcodes();
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Create necessary database tables or options
        $this->create_tables();
        
        // Set default options
        $default_options = array(
            'node_server_url' => 'http://localhost:3000',
            'enable_patient_portal' => true,
            'enable_provider_dashboard' => true,
            'enable_telehealth' => true,
            'fhir_endpoint' => '',
            'api_key' => '',
        );
        
        add_option('webqx_settings', $default_options);
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Clean up if necessary
        flush_rewrite_rules();
    }
    
    /**
     * Create database tables
     */
    private function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // Table for WebQX sessions
        $table_name = $wpdb->prefix . 'webqx_sessions';
        $sql = "CREATE TABLE $table_name (
            id int(11) NOT NULL AUTO_INCREMENT,
            session_id varchar(255) NOT NULL,
            user_id int(11) NOT NULL,
            node_session_id varchar(255),
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY session_id (session_id),
            KEY user_id (user_id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
    
    /**
     * Add admin menu
     */
    public function admin_menu() {
        add_menu_page(
            __('WebQX Healthcare', 'webqx-healthcare'),
            __('WebQX Healthcare', 'webqx-healthcare'),
            'manage_options',
            'webqx-healthcare',
            array($this, 'admin_page'),
            'dashicons-heart',
            30
        );
        
        add_submenu_page(
            'webqx-healthcare',
            __('Settings', 'webqx-healthcare'),
            __('Settings', 'webqx-healthcare'),
            'manage_options',
            'webqx-settings',
            array($this, 'settings_page')
        );
    }
    
    /**
     * Admin page content
     */
    public function admin_page() {
        $node_server_status = $this->check_node_server_status();
        include WEBQX_PLUGIN_DIR . 'admin/admin-page.php';
    }
    
    /**
     * Settings page content
     */
    public function settings_page() {
        if (isset($_POST['submit'])) {
            $this->save_settings();
        }
        $settings = get_option('webqx_settings', array());
        include WEBQX_PLUGIN_DIR . 'admin/settings-page.php';
    }
    
    /**
     * Save settings
     */
    private function save_settings() {
        if (!current_user_can('manage_options')) {
            return;
        }
        
        $settings = array(
            'node_server_url' => sanitize_url($_POST['node_server_url']),
            'enable_patient_portal' => isset($_POST['enable_patient_portal']),
            'enable_provider_dashboard' => isset($_POST['enable_provider_dashboard']),
            'enable_telehealth' => isset($_POST['enable_telehealth']),
            'fhir_endpoint' => sanitize_url($_POST['fhir_endpoint']),
            'api_key' => sanitize_text_field($_POST['api_key']),
        );
        
        update_option('webqx_settings', $settings);
        add_action('admin_notices', function() {
            echo '<div class="notice notice-success"><p>' . __('Settings saved successfully!', 'webqx-healthcare') . '</p></div>';
        });
    }
    
    /**
     * Enqueue frontend scripts and styles
     */
    public function enqueue_scripts() {
        wp_enqueue_script(
            'webqx-frontend',
            WEBQX_PLUGIN_URL . 'assets/js/frontend.js',
            array('jquery'),
            WEBQX_VERSION,
            true
        );
        
        wp_enqueue_style(
            'webqx-frontend',
            WEBQX_PLUGIN_URL . 'assets/css/frontend.css',
            array(),
            WEBQX_VERSION
        );
        
        // Localize script with Ajax URL and nonce
        wp_localize_script('webqx-frontend', 'webqx_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('webqx_nonce'),
            'node_server_url' => $this->get_node_server_url(),
        ));
    }
    
    /**
     * Enqueue admin scripts and styles
     */
    public function admin_enqueue_scripts($hook) {
        if (strpos($hook, 'webqx-') === false) {
            return;
        }
        
        wp_enqueue_script(
            'webqx-admin',
            WEBQX_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery'),
            WEBQX_VERSION,
            true
        );
        
        wp_enqueue_style(
            'webqx-admin',
            WEBQX_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            WEBQX_VERSION
        );
    }
    
    /**
     * Initialize shortcodes
     */
    private function init_shortcodes() {
        add_shortcode('webqx_patient_portal', array($this, 'patient_portal_shortcode'));
        add_shortcode('webqx_provider_dashboard', array($this, 'provider_dashboard_shortcode'));
        add_shortcode('webqx_telehealth', array($this, 'telehealth_shortcode'));
        add_shortcode('webqx_lab_results', array($this, 'lab_results_shortcode'));
    }
    
    /**
     * Patient portal shortcode
     */
    public function patient_portal_shortcode($atts) {
        $atts = shortcode_atts(array(
            'height' => '600px',
            'patient_id' => get_current_user_id(),
        ), $atts, 'webqx_patient_portal');
        
        ob_start();
        $template_path = WEBQX_PLUGIN_DIR . 'templates/patient-portal.php';
        if (file_exists($template_path)) {
            include $template_path;
        } else {
            echo '<p>' . __('Patient portal template not found.', 'webqx-healthcare') . '</p>';
        }
        return ob_get_clean();
    }
    
    /**
     * Provider dashboard shortcode
     */
    public function provider_dashboard_shortcode($atts) {
        if (!current_user_can('edit_posts')) {
            return '<p>' . __('Access denied. Provider credentials required.', 'webqx-healthcare') . '</p>';
        }
        
        $atts = shortcode_atts(array(
            'height' => '800px',
            'provider_id' => get_current_user_id(),
        ), $atts, 'webqx_provider_dashboard');
        
        ob_start();
        $template_path = WEBQX_PLUGIN_DIR . 'templates/provider-dashboard.php';
        if (file_exists($template_path)) {
            include $template_path;
        } else {
            echo '<p>' . __('Provider dashboard template not found.', 'webqx-healthcare') . '</p>';
        }
        return ob_get_clean();
    }
    
    /**
     * Telehealth shortcode
     */
    public function telehealth_shortcode($atts) {
        $atts = shortcode_atts(array(
            'height' => '500px',
            'session_id' => '',
        ), $atts, 'webqx_telehealth');
        
        ob_start();
        $template_path = WEBQX_PLUGIN_DIR . 'templates/telehealth.php';
        if (file_exists($template_path)) {
            include $template_path;
        } else {
            echo '<p>' . __('Telehealth template not found.', 'webqx-healthcare') . '</p>';
        }
        return ob_get_clean();
    }
    
    /**
     * Lab results shortcode
     */
    public function lab_results_shortcode($atts) {
        $atts = shortcode_atts(array(
            'patient_id' => get_current_user_id(),
            'height' => '400px',
        ), $atts, 'webqx_lab_results');
        
        ob_start();
        $template_path = WEBQX_PLUGIN_DIR . 'templates/lab-results.php';
        if (file_exists($template_path)) {
            include $template_path;
        } else {
            echo '<p>' . __('Lab results template not found.', 'webqx-healthcare') . '</p>';
        }
        return ob_get_clean();
    }
    
    /**
     * AJAX proxy handler
     */
    public function ajax_proxy_handler() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'webqx_nonce')) {
            wp_die(__('Security check failed', 'webqx-healthcare'));
        }
        
        $endpoint = sanitize_text_field($_POST['endpoint']);
        $method = sanitize_text_field($_POST['method']);
        $data = $_POST['data'];
        
        $response = $this->proxy_to_node_server($endpoint, $method, $data);
        
        wp_send_json($response);
    }
    
    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        register_rest_route('webqx/v1', '/proxy/(?P<endpoint>.*)', array(
            'methods' => array('GET', 'POST', 'PUT', 'DELETE'),
            'callback' => array($this, 'rest_proxy_handler'),
            'permission_callback' => array($this, 'rest_permission_check'),
        ));
    }
    
    /**
     * REST API proxy handler
     */
    public function rest_proxy_handler($request) {
        $endpoint = $request->get_param('endpoint');
        $method = $request->get_method();
        $data = $request->get_body();
        
        return $this->proxy_to_node_server($endpoint, $method, $data);
    }
    
    /**
     * REST API permission check
     */
    public function rest_permission_check() {
        return is_user_logged_in();
    }
    
    /**
     * Proxy requests to Node.js server
     */
    private function proxy_to_node_server($endpoint, $method = 'GET', $data = null) {
        $node_server_url = $this->get_node_server_url();
        $url = rtrim($node_server_url, '/') . '/' . ltrim($endpoint, '/');
        
        $args = array(
            'method' => $method,
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-WordPress-User-ID' => get_current_user_id(),
            ),
        );
        
        if ($data && in_array($method, array('POST', 'PUT'))) {
            $args['body'] = is_array($data) ? json_encode($data) : $data;
        }
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message(),
            );
        }
        
        $body = wp_remote_retrieve_body($response);
        $code = wp_remote_retrieve_response_code($response);
        
        return array(
            'success' => $code >= 200 && $code < 300,
            'status_code' => $code,
            'data' => json_decode($body, true),
        );
    }
    
    /**
     * Get Node.js server URL
     */
    public function get_node_server_url() {
        $settings = get_option('webqx_settings', array());
        return isset($settings['node_server_url']) ? $settings['node_server_url'] : 'http://localhost:3000';
    }
    
    /**
     * Check Node.js server status
     */
    private function check_node_server_status() {
        $node_server_url = $this->get_node_server_url();
        $health_url = rtrim($node_server_url, '/') . '/health';
        
        $response = wp_remote_get($health_url, array('timeout' => 5));
        
        if (is_wp_error($response)) {
            return array(
                'status' => 'error',
                'message' => $response->get_error_message(),
            );
        }
        
        $code = wp_remote_retrieve_response_code($response);
        
        return array(
            'status' => $code === 200 ? 'online' : 'offline',
            'code' => $code,
            'url' => $node_server_url,
        );
    }
}

// Initialize the plugin
WebQX_Healthcare_Platform::get_instance();