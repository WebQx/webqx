<?php
/**
 * Uninstall WebQX Healthcare Platform Plugin
 *
 * This file is executed when the plugin is deleted via WordPress admin.
 * It removes all plugin data including options, database tables, and transients.
 *
 * @package WebQX_Healthcare_Platform
 * @version 1.0.0
 */

// If uninstall not called from WordPress, exit
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Check if user has permission to delete plugins
if (!current_user_can('delete_plugins')) {
    exit;
}

// Define plugin constants if not already defined
if (!defined('WEBQX_VERSION')) {
    define('WEBQX_VERSION', '1.0.0');
}

/**
 * Remove plugin options
 */
function webqx_remove_options() {
    delete_option('webqx_settings');
    delete_option('webqx_version');
    delete_option('webqx_db_version');
    delete_option('webqx_activation_date');
    delete_option('webqx_last_cleanup');
    
    // Remove any transients
    delete_transient('webqx_server_status');
    delete_transient('webqx_connection_test');
    delete_transient('webqx_health_check');
}

/**
 * Remove plugin database tables
 */
function webqx_remove_database_tables() {
    global $wpdb;
    
    // List of tables to remove
    $tables = array(
        $wpdb->prefix . 'webqx_sessions',
        $wpdb->prefix . 'webqx_audit_log',
        $wpdb->prefix . 'webqx_user_mappings'
    );
    
    foreach ($tables as $table) {
        $wpdb->query($wpdb->prepare("DROP TABLE IF EXISTS %s", $table));
    }
}

/**
 * Remove user meta data
 */
function webqx_remove_user_meta() {
    global $wpdb;
    
    // Remove user meta keys related to WebQX
    $meta_keys = array(
        'webqx_patient_id',
        'webqx_provider_id', 
        'webqx_last_login',
        'webqx_session_id',
        'webqx_preferences'
    );
    
    foreach ($meta_keys as $meta_key) {
        $wpdb->delete($wpdb->usermeta, array('meta_key' => $meta_key));
    }
}

/**
 * Remove custom post types and their data
 */
function webqx_remove_custom_post_data() {
    // Currently no custom post types, but prepared for future use
    $post_types = array(
        'webqx_appointment',
        'webqx_session',
        'webqx_lab_result'
    );
    
    foreach ($post_types as $post_type) {
        $posts = get_posts(array(
            'post_type' => $post_type,
            'posts_per_page' => -1,
            'post_status' => 'any'
        ));
        
        foreach ($posts as $post) {
            wp_delete_post($post->ID, true);
        }
    }
}

/**
 * Remove scheduled cron jobs
 */
function webqx_remove_cron_jobs() {
    // Remove any scheduled events
    $cron_hooks = array(
        'webqx_health_check',
        'webqx_cleanup_sessions', 
        'webqx_audit_log_cleanup',
        'webqx_backup_cleanup'
    );
    
    foreach ($cron_hooks as $hook) {
        wp_clear_scheduled_hook($hook);
    }
}

/**
 * Remove uploaded files and directories
 */
function webqx_remove_uploads() {
    $upload_dir = wp_upload_dir();
    $webqx_upload_dir = $upload_dir['basedir'] . '/webqx-healthcare';
    
    if (is_dir($webqx_upload_dir)) {
        webqx_recursive_delete($webqx_upload_dir);
    }
}

/**
 * Recursively delete directory and contents
 *
 * @param string $dir Directory path to delete
 */
function webqx_recursive_delete($dir) {
    if (!is_dir($dir)) {
        return;
    }
    
    $files = array_diff(scandir($dir), array('.', '..'));
    
    foreach ($files as $file) {
        $file_path = $dir . '/' . $file;
        
        if (is_dir($file_path)) {
            webqx_recursive_delete($file_path);
        } else {
            unlink($file_path);
        }
    }
    
    rmdir($dir);
}

/**
 * Log uninstallation for audit purposes
 */
function webqx_log_uninstall() {
    $log_entry = array(
        'timestamp' => current_time('mysql'),
        'action' => 'plugin_uninstall',
        'user_id' => get_current_user_id(),
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    );
    
    // Log to WordPress debug log if enabled
    if (defined('WP_DEBUG') && WP_DEBUG && defined('WP_DEBUG_LOG') && WP_DEBUG_LOG) {
        error_log('WebQX Healthcare Platform Uninstalled: ' . json_encode($log_entry));
    }
}

/**
 * Main uninstall function
 */
function webqx_uninstall() {
    // Verify this is a legitimate uninstall
    if (!wp_verify_nonce($_REQUEST['_wpnonce'] ?? '', 'bulk-plugins')) {
        // For security, only proceed if this is a legitimate admin request
        if (!is_admin()) {
            exit;
        }
    }
    
    // Log the uninstallation
    webqx_log_uninstall();
    
    // Remove all plugin data
    webqx_remove_options();
    webqx_remove_database_tables();
    webqx_remove_user_meta();
    webqx_remove_custom_post_data();
    webqx_remove_cron_jobs();
    webqx_remove_uploads();
    
    // Clear any object cache
    if (function_exists('wp_cache_flush')) {
        wp_cache_flush();
    }
    
    // Clear opcache if available
    if (function_exists('opcache_reset')) {
        opcache_reset();
    }
}

// Execute uninstall
webqx_uninstall();

// Show confirmation message
if (is_admin()) {
    add_action('admin_notices', function() {
        echo '<div class="notice notice-success"><p>';
        echo __('WebQX Healthcare Platform has been completely removed from your site.', 'webqx-healthcare');
        echo '</p></div>';
    });
}