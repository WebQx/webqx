<?php
/**
 * Plugin Name: WebQX Healthcare Integration
 * Plugin URI: https://github.com/webqx/webqx
 * Description: Integrates WebQX modular healthcare platform functionality into WordPress with shortcodes, widgets, and REST API integration.
 * Version: 1.0.0
 * Author: WebQX Health
 * Author URI: https://webqx.health
 * License: Apache-2.0
 * License URI: https://www.apache.org/licenses/LICENSE-2.0
 * Text Domain: webqx-integration
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * Network: false
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('WEBQX_PLUGIN_VERSION', '1.0.0');
define('WEBQX_PLUGIN_FILE', __FILE__);
define('WEBQX_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WEBQX_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WEBQX_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main WebQX Integration Plugin Class
 */
class WebQX_Integration_Plugin {
    
    /**
     * Plugin instance
     */
    private static $instance = null;
    
    /**
     * Get plugin instance
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
        $this->load_dependencies();
    }
    
    /**
     * Initialize hooks
     */
    private function init_hooks() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        add_action('plugins_loaded', array($this, 'load_textdomain'));
        
        // Activation and deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    /**
     * Load plugin dependencies
     */
    private function load_dependencies() {
        require_once WEBQX_PLUGIN_DIR . 'includes/class-webqx-shortcodes.php';
        require_once WEBQX_PLUGIN_DIR . 'includes/class-webqx-widgets.php';
        require_once WEBQX_PLUGIN_DIR . 'includes/class-webqx-rest-api.php';
        require_once WEBQX_PLUGIN_DIR . 'includes/class-webqx-admin.php';
        require_once WEBQX_PLUGIN_DIR . 'includes/class-webqx-fhir-integration.php';
    }
    
    /**
     * Initialize plugin
     */
    public function init() {
        // Initialize shortcodes
        WebQX_Shortcodes::init();
        
        // Initialize widgets
        WebQX_Widgets::init();
        
        // Initialize REST API
        WebQX_REST_API::init();
        
        // Initialize admin interface
        if (is_admin()) {
            WebQX_Admin::init();
        }
        
        // Initialize FHIR integration
        WebQX_FHIR_Integration::init();
    }
    
    /**
     * Enqueue frontend scripts and styles
     */
    public function enqueue_scripts() {
        wp_enqueue_style(
            'webqx-integration-style',
            WEBQX_PLUGIN_URL . 'assets/css/webqx-integration.css',
            array(),
            WEBQX_PLUGIN_VERSION
        );
        
        wp_enqueue_script(
            'webqx-integration-script',
            WEBQX_PLUGIN_URL . 'assets/js/webqx-integration.js',
            array('jquery'),
            WEBQX_PLUGIN_VERSION,
            true
        );
        
        // Localize script for AJAX
        wp_localize_script('webqx-integration-script', 'webqx_integration', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('webqx_integration_nonce'),
            'api_base_url' => $this->get_api_base_url(),
            'strings' => array(
                'loading' => __('Loading...', 'webqx-integration'),
                'error' => __('An error occurred. Please try again.', 'webqx-integration'),
                'success' => __('Success!', 'webqx-integration'),
            ),
        ));
    }
    
    /**
     * Enqueue admin scripts and styles
     */
    public function admin_enqueue_scripts($hook) {
        // Only load on WebQX admin pages
        if (strpos($hook, 'webqx') === false) {
            return;
        }
        
        wp_enqueue_style(
            'webqx-admin-style',
            WEBQX_PLUGIN_URL . 'assets/css/webqx-admin.css',
            array(),
            WEBQX_PLUGIN_VERSION
        );
        
        wp_enqueue_script(
            'webqx-admin-script',
            WEBQX_PLUGIN_URL . 'assets/js/webqx-admin.js',
            array('jquery'),
            WEBQX_PLUGIN_VERSION,
            true
        );
    }
    
    /**
     * Load plugin textdomain
     */
    public function load_textdomain() {
        load_plugin_textdomain(
            'webqx-integration',
            false,
            dirname(WEBQX_PLUGIN_BASENAME) . '/languages'
        );
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Create necessary database tables
        $this->create_tables();
        
        // Set default options
        $this->set_default_options();
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    /**
     * Create necessary database tables
     */
    private function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // WebQX module logs table
        $table_name = $wpdb->prefix . 'webqx_module_logs';
        
        $sql = "CREATE TABLE $table_name (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            module_type varchar(100) NOT NULL,
            module_id varchar(100) DEFAULT NULL,
            user_id bigint(20) unsigned DEFAULT NULL,
            action varchar(100) NOT NULL,
            data longtext DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY module_type (module_type),
            KEY created_at (created_at)
        ) $charset_collate;";
        
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
        
        // WebQX API cache table
        $cache_table = $wpdb->prefix . 'webqx_api_cache';
        
        $cache_sql = "CREATE TABLE $cache_table (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            cache_key varchar(255) NOT NULL,
            cache_value longtext NOT NULL,
            expires_at datetime NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY cache_key (cache_key),
            KEY expires_at (expires_at)
        ) $charset_collate;";
        
        dbDelta($cache_sql);
    }
    
    /**
     * Set default plugin options
     */
    private function set_default_options() {
        $default_options = array(
            'webqx_api_base_url' => 'http://localhost:3000',
            'webqx_api_timeout' => 30,
            'webqx_enable_cache' => true,
            'webqx_cache_duration' => 300, // 5 minutes
            'webqx_enable_fhir' => true,
            'webqx_default_language' => 'en',
            'webqx_enable_audit_log' => true,
        );
        
        foreach ($default_options as $option => $value) {
            if (get_option($option) === false) {
                add_option($option, $value);
            }
        }
    }
    
    /**
     * Get API base URL
     */
    public function get_api_base_url() {
        $api_url = get_option('webqx_api_base_url', 'http://localhost:3000');
        
        // Allow override via environment variable
        if (defined('WEBQX_API_URL')) {
            $api_url = WEBQX_API_URL;
        } elseif (getenv('WEBQX_API_URL')) {
            $api_url = getenv('WEBQX_API_URL');
        }
        
        return rtrim($api_url, '/');
    }
    
    /**
     * Make API request to WebQX backend
     */
    public function api_request($endpoint, $method = 'GET', $data = null, $headers = array()) {
        $url = $this->get_api_base_url() . '/' . ltrim($endpoint, '/');
        
        $args = array(
            'method' => $method,
            'timeout' => get_option('webqx_api_timeout', 30),
            'headers' => array_merge(array(
                'Content-Type' => 'application/json',
                'User-Agent' => 'WebQX-WordPress-Plugin/' . WEBQX_PLUGIN_VERSION,
            ), $headers),
        );
        
        if ($data && in_array($method, array('POST', 'PUT', 'PATCH'))) {
            $args['body'] = is_array($data) ? json_encode($data) : $data;
        }
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'error' => $response->get_error_message(),
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded_body = json_decode($body, true);
        
        return array(
            'success' => $status_code >= 200 && $status_code < 300,
            'status_code' => $status_code,
            'data' => $decoded_body,
            'raw_body' => $body,
        );
    }
    
    /**
     * Log module activity
     */
    public function log_activity($module_type, $action, $module_id = null, $data = null) {
        if (!get_option('webqx_enable_audit_log', true)) {
            return;
        }
        
        global $wpdb;
        
        $wpdb->insert(
            $wpdb->prefix . 'webqx_module_logs',
            array(
                'module_type' => sanitize_text_field($module_type),
                'module_id' => sanitize_text_field($module_id),
                'user_id' => get_current_user_id(),
                'action' => sanitize_text_field($action),
                'data' => is_array($data) ? json_encode($data) : $data,
            ),
            array('%s', '%s', '%d', '%s', '%s')
        );
    }
}

// Initialize the plugin
function webqx_integration_init() {
    return WebQX_Integration_Plugin::get_instance();
}

// Start the plugin
webqx_integration_init();

/**
 * Helper functions
 */

/**
 * Get plugin instance
 */
function webqx_integration() {
    return WebQX_Integration_Plugin::get_instance();
}

/**
 * Check if WebQX API is available
 */
function webqx_is_api_available() {
    $plugin = webqx_integration();
    $response = $plugin->api_request('health');
    return $response['success'];
}

/**
 * Get WebQX module data
 */
function webqx_get_module_data($module_type, $module_id = null) {
    $plugin = webqx_integration();
    $endpoint = 'modules/' . sanitize_text_field($module_type);
    
    if ($module_id) {
        $endpoint .= '/' . sanitize_text_field($module_id);
    }
    
    $response = $plugin->api_request($endpoint);
    
    if ($response['success']) {
        return $response['data'];
    }
    
    return false;
}

/**
 * Display WebQX module
 */
function webqx_display_module($module_type, $module_id = null, $attributes = array()) {
    $plugin = webqx_integration();
    
    // Log activity
    $plugin->log_activity($module_type, 'display', $module_id, $attributes);
    
    $data = webqx_get_module_data($module_type, $module_id);
    
    if (!$data) {
        return '<div class="webqx-error">' . __('Unable to load WebQX module.', 'webqx-integration') . '</div>';
    }
    
    // Start output buffering
    ob_start();
    
    // Include template if it exists
    $template_path = WEBQX_PLUGIN_DIR . 'templates/modules/' . sanitize_file_name($module_type) . '.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        // Default template
        include WEBQX_PLUGIN_DIR . 'templates/modules/default.php';
    }
    
    return ob_get_clean();
}
?>