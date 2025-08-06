<?php
/**
 * Plugin Name: WebQX Healthcare Platform
 * Plugin URI: https://github.com/WebQx/webqx
 * Description: WordPress integration for WebQX™ - A comprehensive modular healthcare platform for patient portals, provider panels, and administrative functions. Integrates with the WebQX Node.js backend to provide WordPress-friendly healthcare management tools.
 * Version: 1.0.0
 * Author: WebQX Health
 * Author URI: https://webqx.health
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: webqx-healthcare
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * Network: false
 * 
 * @package WebQX_Healthcare
 * @author WebQX Health
 * @copyright 2024 WebQX Health
 * @license GPL v2 or later
 * 
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
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
 * Main WebQX Healthcare Plugin Class
 * 
 * This class initializes the plugin and manages core functionality
 * for integrating WordPress with the WebQX healthcare platform.
 */
class WebQX_Healthcare_Plugin {

    /**
     * Plugin instance
     * 
     * @var WebQX_Healthcare_Plugin
     */
    private static $instance = null;

    /**
     * Get plugin instance
     * 
     * @return WebQX_Healthcare_Plugin
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
     * Initialize plugin hooks
     */
    private function init_hooks() {
        add_action('plugins_loaded', array($this, 'load_plugin'));
        add_action('init', array($this, 'init'));
        
        // Activation and deactivation hooks
        register_activation_hook(WEBQX_PLUGIN_FILE, array($this, 'activate'));
        register_deactivation_hook(WEBQX_PLUGIN_FILE, array($this, 'deactivate'));
    }

    /**
     * Load plugin functionality
     */
    public function load_plugin() {
        // Check if WordPress meets minimum requirements
        if (!$this->meets_requirements()) {
            add_action('admin_notices', array($this, 'requirements_notice'));
            return;
        }

        // Load plugin files
        $this->includes();
        
        // Initialize components
        $this->init_components();
    }

    /**
     * Check if WordPress meets plugin requirements
     * 
     * @return bool
     */
    private function meets_requirements() {
        global $wp_version;
        
        // Check WordPress version
        if (version_compare($wp_version, '5.0', '<')) {
            return false;
        }
        
        // Check PHP version
        if (version_compare(PHP_VERSION, '7.4', '<')) {
            return false;
        }
        
        // Check for required PHP extensions
        $required_extensions = array('curl', 'json', 'openssl');
        foreach ($required_extensions as $extension) {
            if (!extension_loaded($extension)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Display requirements notice
     */
    public function requirements_notice() {
        ?>
        <div class="notice notice-error">
            <p><?php esc_html_e('WebQX Healthcare Plugin requires WordPress 5.0 or higher, PHP 7.4 or higher, and the following PHP extensions: curl, json, openssl.', 'webqx-healthcare'); ?></p>
        </div>
        <?php
    }

    /**
     * Include required files
     */
    private function includes() {
        // Core files
        require_once WEBQX_PLUGIN_DIR . 'includes/class-webqx-core.php';
        require_once WEBQX_PLUGIN_DIR . 'includes/class-webqx-api.php';
        require_once WEBQX_PLUGIN_DIR . 'includes/class-webqx-security.php';
        
        // Admin files
        if (is_admin()) {
            require_once WEBQX_PLUGIN_DIR . 'includes/class-webqx-admin.php';
        }
        
        // Frontend files
        if (!is_admin()) {
            require_once WEBQX_PLUGIN_DIR . 'includes/class-webqx-frontend.php';
        }
    }

    /**
     * Initialize plugin components
     */
    private function init_components() {
        // Initialize core functionality
        WebQX_Core::get_instance();
        WebQX_API::get_instance();
        WebQX_Security::get_instance();
        
        // Initialize admin or frontend
        if (is_admin()) {
            WebQX_Admin::get_instance();
        } else {
            WebQX_Frontend::get_instance();
        }
    }

    /**
     * Plugin initialization
     */
    public function init() {
        // Load textdomain for translations
        load_plugin_textdomain(
            'webqx-healthcare',
            false,
            dirname(WEBQX_PLUGIN_BASENAME) . '/languages'
        );
        
        // Add custom post types and taxonomies
        $this->register_post_types();
        
        // Add custom capabilities
        $this->add_capabilities();
        
        // Initialize REST API endpoints
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }

    /**
     * Register custom post types for healthcare data
     */
    private function register_post_types() {
        // Patient Records (for WordPress users with patient role)
        register_post_type('webqx_patient', array(
            'labels' => array(
                'name' => __('Patients', 'webqx-healthcare'),
                'singular_name' => __('Patient', 'webqx-healthcare'),
            ),
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => 'webqx-healthcare',
            'capability_type' => 'webqx_patient',
            'map_meta_cap' => true,
            'supports' => array('title', 'editor', 'custom-fields'),
            'show_in_rest' => true,
        ));

        // Appointments
        register_post_type('webqx_appointment', array(
            'labels' => array(
                'name' => __('Appointments', 'webqx-healthcare'),
                'singular_name' => __('Appointment', 'webqx-healthcare'),
            ),
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => 'webqx-healthcare',
            'capability_type' => 'webqx_appointment',
            'map_meta_cap' => true,
            'supports' => array('title', 'editor', 'custom-fields'),
            'show_in_rest' => true,
        ));

        // Healthcare Providers
        register_post_type('webqx_provider', array(
            'labels' => array(
                'name' => __('Providers', 'webqx-healthcare'),
                'singular_name' => __('Provider', 'webqx-healthcare'),
            ),
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => 'webqx-healthcare',
            'capability_type' => 'webqx_provider',
            'map_meta_cap' => true,
            'supports' => array('title', 'editor', 'custom-fields'),
            'show_in_rest' => true,
        ));
    }

    /**
     * Add custom capabilities for healthcare roles
     */
    private function add_capabilities() {
        // Add capabilities to administrator role
        $admin_role = get_role('administrator');
        if ($admin_role) {
            $admin_role->add_cap('manage_webqx');
            $admin_role->add_cap('read_webqx_patient');
            $admin_role->add_cap('edit_webqx_patients');
            $admin_role->add_cap('edit_others_webqx_patients');
            $admin_role->add_cap('publish_webqx_patients');
            $admin_role->add_cap('read_private_webqx_patients');
            $admin_role->add_cap('delete_webqx_patients');
            $admin_role->add_cap('delete_private_webqx_patients');
            $admin_role->add_cap('delete_published_webqx_patients');
            $admin_role->add_cap('delete_others_webqx_patients');
        }
    }

    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        register_rest_route('webqx/v1', '/health', array(
            'methods' => 'GET',
            'callback' => array($this, 'health_check'),
            'permission_callback' => '__return_true',
        ));
        
        register_rest_route('webqx/v1', '/backend-status', array(
            'methods' => 'GET',
            'callback' => array($this, 'backend_status'),
            'permission_callback' => array($this, 'check_backend_permission'),
        ));
    }

    /**
     * Health check endpoint
     */
    public function health_check($request) {
        return rest_ensure_response(array(
            'status' => 'ok',
            'version' => WEBQX_PLUGIN_VERSION,
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => PHP_VERSION,
        ));
    }

    /**
     * Backend status endpoint
     */
    public function backend_status($request) {
        $api = WebQX_API::get_instance();
        $status = $api->check_backend_connection();
        
        return rest_ensure_response($status);
    }

    /**
     * Check backend permission
     */
    public function check_backend_permission($request) {
        return current_user_can('manage_webqx');
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
        
        // Log activation
        error_log('WebQX Healthcare Plugin activated');
    }

    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();
        
        // Log deactivation
        error_log('WebQX Healthcare Plugin deactivated');
    }

    /**
     * Create custom database tables
     */
    private function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // Integration logs table
        $table_name = $wpdb->prefix . 'webqx_integration_logs';
        
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            timestamp datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            level varchar(20) NOT NULL,
            message text NOT NULL,
            context longtext,
            user_id bigint(20),
            ip_address varchar(45),
            PRIMARY KEY (id),
            KEY timestamp (timestamp),
            KEY level (level),
            KEY user_id (user_id)
        ) $charset_collate;";
        
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    /**
     * Set default plugin options
     */
    private function set_default_options() {
        $defaults = array(
            'webqx_backend_url' => 'http://localhost:3000',
            'webqx_api_timeout' => 30,
            'webqx_enable_logging' => true,
            'webqx_log_level' => 'info',
            'webqx_enable_hipaa_mode' => true,
            'webqx_patient_portal_enabled' => true,
            'webqx_provider_portal_enabled' => true,
            'webqx_admin_console_enabled' => true,
        );
        
        foreach ($defaults as $option => $value) {
            add_option($option, $value);
        }
    }
}

// Initialize the plugin
WebQX_Healthcare_Plugin::get_instance();