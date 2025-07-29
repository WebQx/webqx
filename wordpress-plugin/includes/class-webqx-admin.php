<?php
/**
 * WebQX Admin Interface Class
 *
 * @package WebQX_Integration
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WebQX Admin Class
 */
class WebQX_Admin {
    
    /**
     * Initialize admin interface
     */
    public static function init() {
        add_action('admin_menu', array(__CLASS__, 'add_admin_menus'));
        add_action('admin_init', array(__CLASS__, 'register_settings'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'enqueue_admin_scripts'));
    }
    
    /**
     * Add admin menus
     */
    public static function add_admin_menus() {
        // Main menu
        add_menu_page(
            __('WebQX Integration', 'webqx-integration'),
            __('WebQX', 'webqx-integration'),
            'manage_options',
            'webqx-integration',
            array(__CLASS__, 'admin_dashboard_page'),
            'data:image/svg+xml;base64,' . base64_encode('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7v10c0 5.55 3.84 9.99 9 11 5.16-1.01 9-5.45 9-11V7l-10-5z" stroke="currentColor" stroke-width="2"/></svg>'),
            30
        );
        
        // Submenus
        add_submenu_page(
            'webqx-integration',
            __('Dashboard', 'webqx-integration'),
            __('Dashboard', 'webqx-integration'),
            'manage_options',
            'webqx-integration',
            array(__CLASS__, 'admin_dashboard_page')
        );
        
        add_submenu_page(
            'webqx-integration',
            __('Settings', 'webqx-integration'),
            __('Settings', 'webqx-integration'),
            'manage_options',
            'webqx-settings',
            array(__CLASS__, 'admin_settings_page')
        );
        
        add_submenu_page(
            'webqx-integration',
            __('Module Logs', 'webqx-integration'),
            __('Module Logs', 'webqx-integration'),
            'manage_options',
            'webqx-logs',
            array(__CLASS__, 'admin_logs_page')
        );
        
        add_submenu_page(
            'webqx-integration',
            __('FHIR Resources', 'webqx-integration'),
            __('FHIR Resources', 'webqx-integration'),
            'manage_options',
            'webqx-fhir',
            array(__CLASS__, 'admin_fhir_page')
        );
    }
    
    /**
     * Register settings
     */
    public static function register_settings() {
        // API Settings
        register_setting('webqx_api_settings', 'webqx_api_base_url');
        register_setting('webqx_api_settings', 'webqx_api_timeout');
        register_setting('webqx_api_settings', 'webqx_enable_cache');
        register_setting('webqx_api_settings', 'webqx_cache_duration');
        
        // FHIR Settings
        register_setting('webqx_fhir_settings', 'webqx_enable_fhir');
        register_setting('webqx_fhir_settings', 'webqx_fhir_base_url');
        
        // General Settings
        register_setting('webqx_general_settings', 'webqx_default_language');
        register_setting('webqx_general_settings', 'webqx_enable_audit_log');
    }
    
    /**
     * Enqueue admin scripts
     */
    public static function enqueue_admin_scripts($hook) {
        if (strpos($hook, 'webqx') === false) {
            return;
        }
        
        wp_enqueue_style('webqx-admin-style', WEBQX_PLUGIN_URL . 'assets/css/webqx-admin.css', array(), WEBQX_PLUGIN_VERSION);
        wp_enqueue_script('webqx-admin-script', WEBQX_PLUGIN_URL . 'assets/js/webqx-admin.js', array('jquery'), WEBQX_PLUGIN_VERSION, true);
        
        wp_localize_script('webqx-admin-script', 'webqx_admin', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('webqx_admin_nonce'),
            'strings' => array(
                'confirm_delete' => __('Are you sure you want to delete this?', 'webqx-integration'),
                'loading' => __('Loading...', 'webqx-integration'),
            ),
        ));
    }
    
    /**
     * Admin dashboard page
     */
    public static function admin_dashboard_page() {
        $plugin = webqx_integration();
        $api_status = $plugin->api_request('health');
        
        ?>
        <div class="wrap">
            <h1><?php _e('WebQX Integration Dashboard', 'webqx-integration'); ?></h1>
            
            <div class="webqx-admin-dashboard">
                <div class="webqx-dashboard-widgets">
                    
                    <!-- System Status Widget -->
                    <div class="webqx-widget">
                        <h3><?php _e('System Status', 'webqx-integration'); ?></h3>
                        <div class="webqx-status-grid">
                            <div class="webqx-status-item">
                                <span class="webqx-status-label"><?php _e('WordPress:', 'webqx-integration'); ?></span>
                                <span class="webqx-status-value webqx-status-online">
                                    <?php _e('Online', 'webqx-integration'); ?>
                                </span>
                            </div>
                            
                            <div class="webqx-status-item">
                                <span class="webqx-status-label"><?php _e('WebQX API:', 'webqx-integration'); ?></span>
                                <span class="webqx-status-value <?php echo $api_status['success'] ? 'webqx-status-online' : 'webqx-status-offline'; ?>">
                                    <?php echo $api_status['success'] ? __('Online', 'webqx-integration') : __('Offline', 'webqx-integration'); ?>
                                </span>
                            </div>
                            
                            <div class="webqx-status-item">
                                <span class="webqx-status-label"><?php _e('FHIR Integration:', 'webqx-integration'); ?></span>
                                <span class="webqx-status-value <?php echo get_option('webqx_enable_fhir') ? 'webqx-status-online' : 'webqx-status-disabled'; ?>">
                                    <?php echo get_option('webqx_enable_fhir') ? __('Enabled', 'webqx-integration') : __('Disabled', 'webqx-integration'); ?>
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Quick Actions Widget -->
                    <div class="webqx-widget">
                        <h3><?php _e('Quick Actions', 'webqx-integration'); ?></h3>
                        <div class="webqx-quick-actions">
                            <a href="<?php echo admin_url('admin.php?page=webqx-settings'); ?>" class="button button-primary">
                                <?php _e('Configure Settings', 'webqx-integration'); ?>
                            </a>
                            <a href="<?php echo admin_url('admin.php?page=webqx-fhir'); ?>" class="button">
                                <?php _e('FHIR Resources', 'webqx-integration'); ?>
                            </a>
                            <a href="<?php echo admin_url('admin.php?page=webqx-logs'); ?>" class="button">
                                <?php _e('View Logs', 'webqx-integration'); ?>
                            </a>
                        </div>
                    </div>
                    
                    <!-- Usage Statistics Widget -->
                    <div class="webqx-widget">
                        <h3><?php _e('Usage Statistics', 'webqx-integration'); ?></h3>
                        <div class="webqx-stats">
                            <?php
                            global $wpdb;
                            $logs_table = $wpdb->prefix . 'webqx_module_logs';
                            
                            // Get statistics
                            $today_count = $wpdb->get_var($wpdb->prepare(
                                "SELECT COUNT(*) FROM {$logs_table} WHERE DATE(created_at) = %s",
                                current_time('Y-m-d')
                            ));
                            
                            $total_count = $wpdb->get_var("SELECT COUNT(*) FROM {$logs_table}");
                            
                            $popular_modules = $wpdb->get_results($wpdb->prepare(
                                "SELECT module_type, COUNT(*) as count FROM {$logs_table} 
                                 WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
                                 GROUP BY module_type ORDER BY count DESC LIMIT %d",
                                5
                            ));
                            ?>
                            
                            <p><strong><?php _e('Today\'s Activity:', 'webqx-integration'); ?></strong> <?php echo number_format($today_count); ?></p>
                            <p><strong><?php _e('Total Activity:', 'webqx-integration'); ?></strong> <?php echo number_format($total_count); ?></p>
                            
                            <?php if (!empty($popular_modules)) : ?>
                                <h4><?php _e('Popular Modules (Last 7 days)', 'webqx-integration'); ?></h4>
                                <ul>
                                    <?php foreach ($popular_modules as $module) : ?>
                                        <li><?php echo esc_html($module->module_type); ?> (<?php echo number_format($module->count); ?>)</li>
                                    <?php endforeach; ?>
                                </ul>
                            <?php endif; ?>
                        </div>
                    </div>
                    
                </div>
            </div>
        </div>
        <?php
    }
    
    /**
     * Admin settings page
     */
    public static function admin_settings_page() {
        if (isset($_POST['submit'])) {
            // Save settings
            update_option('webqx_api_base_url', sanitize_url($_POST['webqx_api_base_url']));
            update_option('webqx_api_timeout', intval($_POST['webqx_api_timeout']));
            update_option('webqx_enable_cache', isset($_POST['webqx_enable_cache']));
            update_option('webqx_cache_duration', intval($_POST['webqx_cache_duration']));
            update_option('webqx_enable_fhir', isset($_POST['webqx_enable_fhir']));
            update_option('webqx_default_language', sanitize_text_field($_POST['webqx_default_language']));
            update_option('webqx_enable_audit_log', isset($_POST['webqx_enable_audit_log']));
            
            echo '<div class="notice notice-success"><p>' . __('Settings saved!', 'webqx-integration') . '</p></div>';
        }
        
        ?>
        <div class="wrap">
            <h1><?php _e('WebQX Integration Settings', 'webqx-integration'); ?></h1>
            
            <form method="post" action="">
                <?php wp_nonce_field('webqx_settings_nonce'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('API Base URL', 'webqx-integration'); ?></th>
                        <td>
                            <input type="url" name="webqx_api_base_url" value="<?php echo esc_attr(get_option('webqx_api_base_url', 'http://localhost:3000')); ?>" class="regular-text" />
                            <p class="description"><?php _e('The base URL for the WebQX API backend.', 'webqx-integration'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('API Timeout (seconds)', 'webqx-integration'); ?></th>
                        <td>
                            <input type="number" name="webqx_api_timeout" value="<?php echo esc_attr(get_option('webqx_api_timeout', 30)); ?>" min="5" max="300" />
                            <p class="description"><?php _e('How long to wait for API responses.', 'webqx-integration'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Enable Caching', 'webqx-integration'); ?></th>
                        <td>
                            <input type="checkbox" name="webqx_enable_cache" value="1" <?php checked(get_option('webqx_enable_cache', true)); ?> />
                            <p class="description"><?php _e('Cache API responses to improve performance.', 'webqx-integration'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Cache Duration (seconds)', 'webqx-integration'); ?></th>
                        <td>
                            <input type="number" name="webqx_cache_duration" value="<?php echo esc_attr(get_option('webqx_cache_duration', 300)); ?>" min="60" max="3600" />
                            <p class="description"><?php _e('How long to cache API responses.', 'webqx-integration'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Enable FHIR Integration', 'webqx-integration'); ?></th>
                        <td>
                            <input type="checkbox" name="webqx_enable_fhir" value="1" <?php checked(get_option('webqx_enable_fhir', true)); ?> />
                            <p class="description"><?php _e('Enable FHIR R4 integration for healthcare data exchange.', 'webqx-integration'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Default Language', 'webqx-integration'); ?></th>
                        <td>
                            <select name="webqx_default_language">
                                <?php
                                $languages = array(
                                    'en' => 'English',
                                    'es' => 'Español',
                                    'fr' => 'Français',
                                    'de' => 'Deutsch',
                                );
                                $current_lang = get_option('webqx_default_language', 'en');
                                foreach ($languages as $code => $name) {
                                    echo '<option value="' . esc_attr($code) . '" ' . selected($current_lang, $code, false) . '>' . esc_html($name) . '</option>';
                                }
                                ?>
                            </select>
                            <p class="description"><?php _e('Default language for WebQX interface.', 'webqx-integration'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Enable Audit Logging', 'webqx-integration'); ?></th>
                        <td>
                            <input type="checkbox" name="webqx_enable_audit_log" value="1" <?php checked(get_option('webqx_enable_audit_log', true)); ?> />
                            <p class="description"><?php _e('Log module usage for compliance and debugging.', 'webqx-integration'); ?></p>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button(); ?>
            </form>
            
            <h2><?php _e('Test API Connection', 'webqx-integration'); ?></h2>
            <p><?php _e('Click the button below to test the connection to your WebQX API.', 'webqx-integration'); ?></p>
            <button type="button" id="webqx-test-connection" class="button"><?php _e('Test Connection', 'webqx-integration'); ?></button>
            <div id="webqx-connection-result" style="margin-top: 10px;"></div>
        </div>
        <?php
    }
    
    /**
     * Admin logs page
     */
    public static function admin_logs_page() {
        global $wpdb;
        
        $logs_table = $wpdb->prefix . 'webqx_module_logs';
        $per_page = 20;
        $page = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $offset = ($page - 1) * $per_page;
        
        // Get total count
        $total_logs = $wpdb->get_var("SELECT COUNT(*) FROM {$logs_table}");
        
        // Get logs
        $logs = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$logs_table} ORDER BY created_at DESC LIMIT %d OFFSET %d",
            $per_page,
            $offset
        ));
        
        ?>
        <div class="wrap">
            <h1><?php _e('WebQX Module Logs', 'webqx-integration'); ?></h1>
            
            <div class="webqx-logs-stats">
                <p><strong><?php _e('Total Logs:', 'webqx-integration'); ?></strong> <?php echo number_format($total_logs); ?></p>
            </div>
            
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th><?php _e('Date/Time', 'webqx-integration'); ?></th>
                        <th><?php _e('Module Type', 'webqx-integration'); ?></th>
                        <th><?php _e('Module ID', 'webqx-integration'); ?></th>
                        <th><?php _e('Action', 'webqx-integration'); ?></th>
                        <th><?php _e('User', 'webqx-integration'); ?></th>
                        <th><?php _e('Data', 'webqx-integration'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!empty($logs)) : ?>
                        <?php foreach ($logs as $log) : ?>
                            <tr>
                                <td><?php echo esc_html($log->created_at); ?></td>
                                <td><?php echo esc_html($log->module_type); ?></td>
                                <td><?php echo esc_html($log->module_id ?: '—'); ?></td>
                                <td><?php echo esc_html($log->action); ?></td>
                                <td>
                                    <?php
                                    if ($log->user_id) {
                                        $user = get_user_by('id', $log->user_id);
                                        echo $user ? esc_html($user->display_name) : __('Unknown User', 'webqx-integration');
                                    } else {
                                        echo '—';
                                    }
                                    ?>
                                </td>
                                <td>
                                    <?php if ($log->data) : ?>
                                        <details>
                                            <summary><?php _e('View Data', 'webqx-integration'); ?></summary>
                                            <pre><?php echo esc_html(substr($log->data, 0, 200)) . (strlen($log->data) > 200 ? '...' : ''); ?></pre>
                                        </details>
                                    <?php else : ?>
                                        —
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php else : ?>
                        <tr>
                            <td colspan="6"><?php _e('No logs found.', 'webqx-integration'); ?></td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>
            
            <?php
            // Pagination
            $total_pages = ceil($total_logs / $per_page);
            if ($total_pages > 1) {
                echo '<div class="tablenav bottom">';
                echo '<div class="tablenav-pages">';
                echo paginate_links(array(
                    'base' => add_query_arg('paged', '%#%'),
                    'format' => '',
                    'prev_text' => __('&laquo;', 'webqx-integration'),
                    'next_text' => __('&raquo;', 'webqx-integration'),
                    'total' => $total_pages,
                    'current' => $page,
                ));
                echo '</div>';
                echo '</div>';
            }
            ?>
        </div>
        <?php
    }
    
    /**
     * Admin FHIR page
     */
    public static function admin_fhir_page() {
        ?>
        <div class="wrap">
            <h1><?php _e('FHIR Resources', 'webqx-integration'); ?></h1>
            
            <?php if (!get_option('webqx_enable_fhir')) : ?>
                <div class="notice notice-warning">
                    <p><?php _e('FHIR integration is currently disabled.', 'webqx-integration'); ?> 
                    <a href="<?php echo admin_url('admin.php?page=webqx-settings'); ?>"><?php _e('Enable it in settings', 'webqx-integration'); ?></a></p>
                </div>
            <?php endif; ?>
            
            <div class="webqx-fhir-tools">
                <h2><?php _e('FHIR Resource Browser', 'webqx-integration'); ?></h2>
                
                <div class="webqx-fhir-browser">
                    <div class="webqx-form-group">
                        <label for="webqx-fhir-resource-type"><?php _e('Resource Type:', 'webqx-integration'); ?></label>
                        <select id="webqx-fhir-resource-type" class="regular-text">
                            <option value="Patient">Patient</option>
                            <option value="Observation">Observation</option>
                            <option value="Appointment">Appointment</option>
                            <option value="Practitioner">Practitioner</option>
                            <option value="Organization">Organization</option>
                            <option value="Medication">Medication</option>
                            <option value="DiagnosticReport">DiagnosticReport</option>
                            <option value="ImagingStudy">ImagingStudy</option>
                        </select>
                    </div>
                    
                    <button type="button" id="webqx-load-fhir-resources" class="button button-primary">
                        <?php _e('Load Resources', 'webqx-integration'); ?>
                    </button>
                    
                    <div id="webqx-fhir-results" class="webqx-fhir-results">
                        <p><?php _e('Select a resource type and click "Load Resources" to view FHIR data.', 'webqx-integration'); ?></p>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}
?>