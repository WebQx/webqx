<?php
/**
 * Admin Settings Partial
 * 
 * @package WebQX_Healthcare
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$core = WebQX_Core::get_instance();
$options = $core->get_options();
?>

<div class="wrap">
    <h1><?php esc_html_e('WebQX Healthcare Settings', 'webqx-healthcare'); ?></h1>
    
    <div class="webqx-settings-wrapper">
        <!-- Tab Navigation -->
        <div class="webqx-tab-nav nav-tab-wrapper">
            <a href="#backend" class="nav-tab <?php echo $active_tab === 'backend' ? 'nav-tab-active' : ''; ?>">
                <?php esc_html_e('Backend Configuration', 'webqx-healthcare'); ?>
            </a>
            <a href="#security" class="nav-tab <?php echo $active_tab === 'security' ? 'nav-tab-active' : ''; ?>">
                <?php esc_html_e('Security & HIPAA', 'webqx-healthcare'); ?>
            </a>
            <a href="#modules" class="nav-tab <?php echo $active_tab === 'modules' ? 'nav-tab-active' : ''; ?>">
                <?php esc_html_e('Module Settings', 'webqx-healthcare'); ?>
            </a>
            <a href="#logging" class="nav-tab <?php echo $active_tab === 'logging' ? 'nav-tab-active' : ''; ?>">
                <?php esc_html_e('Logging', 'webqx-healthcare'); ?>
            </a>
        </div>

        <!-- Tab Content -->
        <div class="webqx-tab-container">
            <!-- Backend Configuration Tab -->
            <div id="backend" class="webqx-tab-content" style="<?php echo $active_tab === 'backend' ? 'display:block' : 'display:none'; ?>">
                <form method="post" id="webqx-settings-form" class="webqx-ajax-form" data-action="webqx_save_settings">
                    <?php wp_nonce_field('webqx_admin_nonce', 'nonce'); ?>
                    
                    <div class="webqx-form-section">
                        <h3><?php esc_html_e('WebQX Backend Server', 'webqx-healthcare'); ?></h3>
                        <table class="form-table">
                            <tbody>
                                <tr>
                                    <th scope="row">
                                        <label for="webqx_backend_url"><?php esc_html_e('Backend URL', 'webqx-healthcare'); ?></label>
                                    </th>
                                    <td>
                                        <input type="url" id="webqx_backend_url" name="webqx_backend_url" 
                                               value="<?php echo esc_attr($options['backend_url']); ?>" 
                                               class="regular-text" required />
                                        <p class="description">
                                            <?php esc_html_e('The URL of your WebQX Node.js backend server (e.g., https://api.yoursite.com)', 'webqx-healthcare'); ?>
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row">
                                        <label for="webqx_api_timeout"><?php esc_html_e('API Timeout (seconds)', 'webqx-healthcare'); ?></label>
                                    </th>
                                    <td>
                                        <input type="number" id="webqx_api_timeout" name="webqx_api_timeout" 
                                               value="<?php echo absint($options['api_timeout']); ?>" 
                                               min="1" max="300" class="small-text" />
                                        <p class="description">
                                            <?php esc_html_e('Maximum time to wait for API responses (1-300 seconds)', 'webqx-healthcare'); ?>
                                        </p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        
                        <div class="webqx-connection-test">
                            <button type="button" id="webqx-test-connection" class="button">
                                <?php esc_html_e('Test Connection', 'webqx-healthcare'); ?>
                            </button>
                        </div>
                    </div>
                    
                    <p class="submit">
                        <input type="submit" class="button-primary" value="<?php esc_attr_e('Save Backend Settings', 'webqx-healthcare'); ?>" />
                    </p>
                </form>
            </div>

            <!-- Security & HIPAA Tab -->
            <div id="security" class="webqx-tab-content" style="<?php echo $active_tab === 'security' ? 'display:block' : 'display:none'; ?>">
                <form method="post" class="webqx-ajax-form" data-action="webqx_save_settings">
                    <?php wp_nonce_field('webqx_admin_nonce', 'nonce'); ?>
                    
                    <div class="webqx-form-section">
                        <h3><?php esc_html_e('HIPAA Compliance', 'webqx-healthcare'); ?></h3>
                        
                        <?php if ($options['enable_hipaa_mode']): ?>
                        <div class="webqx-hipaa-mode">
                            <span class="dashicons dashicons-lock"></span>
                            <?php esc_html_e('HIPAA mode is enabled. Enhanced security measures are active.', 'webqx-healthcare'); ?>
                        </div>
                        <?php endif; ?>
                        
                        <table class="form-table">
                            <tbody>
                                <tr>
                                    <th scope="row"><?php esc_html_e('Enable HIPAA Mode', 'webqx-healthcare'); ?></th>
                                    <td>
                                        <label>
                                            <input type="checkbox" name="webqx_enable_hipaa_mode" value="1" 
                                                   <?php checked($options['enable_hipaa_mode']); ?> />
                                            <?php esc_html_e('Enable enhanced security and compliance features', 'webqx-healthcare'); ?>
                                        </label>
                                        <p class="description">
                                            <?php esc_html_e('Enables HTTPS enforcement, data encryption, enhanced logging, and other HIPAA compliance features.', 'webqx-healthcare'); ?>
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><?php esc_html_e('Two-Factor Authentication', 'webqx-healthcare'); ?></th>
                                    <td>
                                        <label>
                                            <input type="checkbox" name="webqx_require_2fa" value="1" 
                                                   <?php checked(get_option('webqx_require_2fa')); ?> />
                                            <?php esc_html_e('Require two-factor authentication for healthcare users', 'webqx-healthcare'); ?>
                                        </label>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="webqx-form-section">
                        <h3><?php esc_html_e('Security Settings', 'webqx-healthcare'); ?></h3>
                        <table class="form-table">
                            <tbody>
                                <tr>
                                    <th scope="row"><?php esc_html_e('Session Timeout', 'webqx-healthcare'); ?></th>
                                    <td>
                                        <select name="webqx_session_timeout">
                                            <option value="15" <?php selected(get_option('webqx_session_timeout', 30), 15); ?>>15 minutes</option>
                                            <option value="30" <?php selected(get_option('webqx_session_timeout', 30), 30); ?>>30 minutes</option>
                                            <option value="60" <?php selected(get_option('webqx_session_timeout', 30), 60); ?>>1 hour</option>
                                            <option value="120" <?php selected(get_option('webqx_session_timeout', 30), 120); ?>>2 hours</option>
                                        </select>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <p class="submit">
                        <input type="submit" class="button-primary" value="<?php esc_attr_e('Save Security Settings', 'webqx-healthcare'); ?>" />
                    </p>
                </form>
            </div>

            <!-- Module Settings Tab -->
            <div id="modules" class="webqx-tab-content" style="<?php echo $active_tab === 'modules' ? 'display:block' : 'display:none'; ?>">
                <form method="post" class="webqx-ajax-form" data-action="webqx_save_settings">
                    <?php wp_nonce_field('webqx_admin_nonce', 'nonce'); ?>
                    
                    <div class="webqx-form-section">
                        <h3><?php esc_html_e('WebQX Modules', 'webqx-healthcare'); ?></h3>
                        <table class="form-table">
                            <tbody>
                                <tr>
                                    <th scope="row"><?php esc_html_e('Patient Portal', 'webqx-healthcare'); ?></th>
                                    <td>
                                        <label>
                                            <input type="checkbox" name="webqx_patient_portal_enabled" value="1" 
                                                   <?php checked($options['patient_portal_enabled']); ?> />
                                            <?php esc_html_e('Enable patient portal functionality', 'webqx-healthcare'); ?>
                                        </label>
                                        <div class="webqx-security-indicator <?php echo $options['patient_portal_enabled'] ? 'webqx-security-enabled' : 'webqx-security-disabled'; ?>">
                                            <span class="dashicons dashicons-<?php echo $options['patient_portal_enabled'] ? 'yes-alt' : 'warning'; ?>"></span>
                                            <?php echo $options['patient_portal_enabled'] ? esc_html__('Enabled', 'webqx-healthcare') : esc_html__('Disabled', 'webqx-healthcare'); ?>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><?php esc_html_e('Provider Portal', 'webqx-healthcare'); ?></th>
                                    <td>
                                        <label>
                                            <input type="checkbox" name="webqx_provider_portal_enabled" value="1" 
                                                   <?php checked($options['provider_portal_enabled']); ?> />
                                            <?php esc_html_e('Enable provider portal functionality', 'webqx-healthcare'); ?>
                                        </label>
                                        <div class="webqx-security-indicator <?php echo $options['provider_portal_enabled'] ? 'webqx-security-enabled' : 'webqx-security-disabled'; ?>">
                                            <span class="dashicons dashicons-<?php echo $options['provider_portal_enabled'] ? 'yes-alt' : 'warning'; ?>"></span>
                                            <?php echo $options['provider_portal_enabled'] ? esc_html__('Enabled', 'webqx-healthcare') : esc_html__('Disabled', 'webqx-healthcare'); ?>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><?php esc_html_e('Admin Console', 'webqx-healthcare'); ?></th>
                                    <td>
                                        <label>
                                            <input type="checkbox" name="webqx_admin_console_enabled" value="1" 
                                                   <?php checked($options['admin_console_enabled']); ?> />
                                            <?php esc_html_e('Enable administrative console features', 'webqx-healthcare'); ?>
                                        </label>
                                        <div class="webqx-security-indicator <?php echo $options['admin_console_enabled'] ? 'webqx-security-enabled' : 'webqx-security-disabled'; ?>">
                                            <span class="dashicons dashicons-<?php echo $options['admin_console_enabled'] ? 'yes-alt' : 'warning'; ?>"></span>
                                            <?php echo $options['admin_console_enabled'] ? esc_html__('Enabled', 'webqx-healthcare') : esc_html__('Disabled', 'webqx-healthcare'); ?>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <p class="submit">
                        <input type="submit" class="button-primary" value="<?php esc_attr_e('Save Module Settings', 'webqx-healthcare'); ?>" />
                    </p>
                </form>
            </div>

            <!-- Logging Tab -->
            <div id="logging" class="webqx-tab-content" style="<?php echo $active_tab === 'logging' ? 'display:block' : 'display:none'; ?>">
                <form method="post" class="webqx-ajax-form" data-action="webqx_save_settings">
                    <?php wp_nonce_field('webqx_admin_nonce', 'nonce'); ?>
                    
                    <div class="webqx-form-section">
                        <h3><?php esc_html_e('Audit Logging', 'webqx-healthcare'); ?></h3>
                        <table class="form-table">
                            <tbody>
                                <tr>
                                    <th scope="row"><?php esc_html_e('Enable Logging', 'webqx-healthcare'); ?></th>
                                    <td>
                                        <label>
                                            <input type="checkbox" name="webqx_enable_logging" value="1" 
                                                   <?php checked($options['enable_logging']); ?> />
                                            <?php esc_html_e('Enable comprehensive audit logging', 'webqx-healthcare'); ?>
                                        </label>
                                        <p class="description">
                                            <?php esc_html_e('Required for HIPAA compliance. Logs all user activities and system events.', 'webqx-healthcare'); ?>
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row">
                                        <label for="webqx_log_level"><?php esc_html_e('Log Level', 'webqx-healthcare'); ?></label>
                                    </th>
                                    <td>
                                        <select id="webqx_log_level" name="webqx_log_level">
                                            <option value="debug" <?php selected($options['log_level'], 'debug'); ?>>Debug</option>
                                            <option value="info" <?php selected($options['log_level'], 'info'); ?>>Info</option>
                                            <option value="warning" <?php selected($options['log_level'], 'warning'); ?>>Warning</option>
                                            <option value="error" <?php selected($options['log_level'], 'error'); ?>>Error</option>
                                        </select>
                                        <p class="description">
                                            <?php esc_html_e('Minimum level of events to log. Debug provides most detail.', 'webqx-healthcare'); ?>
                                        </p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="webqx-form-section">
                        <h3><?php esc_html_e('Log Management', 'webqx-healthcare'); ?></h3>
                        <p><?php esc_html_e('Recent log entries:', 'webqx-healthcare'); ?></p>
                        <?php
                        global $wpdb;
                        $table_name = $wpdb->prefix . 'webqx_integration_logs';
                        $recent_logs = $wpdb->get_results(
                            "SELECT * FROM {$table_name} ORDER BY timestamp DESC LIMIT 5",
                            ARRAY_A
                        );
                        ?>
                        
                        <?php if (!empty($recent_logs)): ?>
                        <table class="wp-list-table widefat fixed striped">
                            <thead>
                                <tr>
                                    <th><?php esc_html_e('Time', 'webqx-healthcare'); ?></th>
                                    <th><?php esc_html_e('Level', 'webqx-healthcare'); ?></th>
                                    <th><?php esc_html_e('Message', 'webqx-healthcare'); ?></th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($recent_logs as $log): ?>
                                <tr>
                                    <td><?php echo esc_html(mysql2date('M j, Y g:i A', $log['timestamp'])); ?></td>
                                    <td>
                                        <span class="webqx-log-level webqx-log-<?php echo esc_attr($log['level']); ?>">
                                            <?php echo esc_html(ucfirst($log['level'])); ?>
                                        </span>
                                    </td>
                                    <td><?php echo esc_html($log['message']); ?></td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                        <?php else: ?>
                        <p><?php esc_html_e('No log entries found.', 'webqx-healthcare'); ?></p>
                        <?php endif; ?>
                    </div>
                    
                    <p class="submit">
                        <input type="submit" class="button-primary" value="<?php esc_attr_e('Save Logging Settings', 'webqx-healthcare'); ?>" />
                    </p>
                </form>
            </div>
        </div>
    </div>
</div>