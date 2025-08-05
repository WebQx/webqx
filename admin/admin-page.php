<?php
/**
 * Admin Page Template for WebQX Healthcare Platform
 *
 * @package WebQX_Healthcare_Platform
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="wrap">
    <h1><?php _e('WebQX Healthcare Platform', 'webqx-healthcare'); ?></h1>
    
    <div class="webqx-admin-header">
        <div class="webqx-logo">
            <h2><?php _e('WebQX™: Modular Healthcare Platform', 'webqx-healthcare'); ?></h2>
            <p><?php _e('A multilingual, specialty-aware, and privacy-first platform for global clinical care.', 'webqx-healthcare'); ?></p>
        </div>
    </div>

    <div class="webqx-admin-grid">
        <!-- Server Status Card -->
        <div class="webqx-card">
            <h3><span class="dashicons dashicons-admin-settings"></span> <?php _e('Node.js Server Status', 'webqx-healthcare'); ?></h3>
            <div class="webqx-status">
                <?php if ($node_server_status['status'] === 'online'): ?>
                    <div class="webqx-status-indicator online">
                        <span class="dashicons dashicons-yes-alt"></span>
                        <?php _e('Server Online', 'webqx-healthcare'); ?>
                    </div>
                    <p><?php printf(__('Connected to: %s', 'webqx-healthcare'), esc_url($node_server_status['url'])); ?></p>
                <?php else: ?>
                    <div class="webqx-status-indicator offline">
                        <span class="dashicons dashicons-dismiss"></span>
                        <?php _e('Server Offline', 'webqx-healthcare'); ?>
                    </div>
                    <p><?php printf(__('Error: %s', 'webqx-healthcare'), esc_html($node_server_status['message'])); ?></p>
                    <p><strong><?php _e('Please ensure the Node.js server is running:', 'webqx-healthcare'); ?></strong></p>
                    <code>npm start</code>
                <?php endif; ?>
            </div>
        </div>

        <!-- Quick Actions Card -->
        <div class="webqx-card">
            <h3><span class="dashicons dashicons-admin-tools"></span> <?php _e('Quick Actions', 'webqx-healthcare'); ?></h3>
            <div class="webqx-actions">
                <a href="<?php echo admin_url('admin.php?page=webqx-settings'); ?>" class="button button-primary">
                    <span class="dashicons dashicons-admin-settings"></span>
                    <?php _e('Settings', 'webqx-healthcare'); ?>
                </a>
                <a href="<?php echo admin_url('post-new.php?post_type=page'); ?>" class="button button-secondary">
                    <span class="dashicons dashicons-plus-alt"></span>
                    <?php _e('Create Healthcare Page', 'webqx-healthcare'); ?>
                </a>
                <a href="https://github.com/WebQx/webqx" target="_blank" class="button button-secondary">
                    <span class="dashicons dashicons-external"></span>
                    <?php _e('Documentation', 'webqx-healthcare'); ?>
                </a>
            </div>
        </div>

        <!-- Features Overview Card -->
        <div class="webqx-card webqx-features">
            <h3><span class="dashicons dashicons-heart"></span> <?php _e('Healthcare Features', 'webqx-healthcare'); ?></h3>
            <div class="webqx-feature-grid">
                <div class="webqx-feature">
                    <h4><span class="dashicons dashicons-groups"></span> <?php _e('Patient Portal', 'webqx-healthcare'); ?></h4>
                    <p><?php _e('Secure access to medical records, appointments, and lab results.', 'webqx-healthcare'); ?></p>
                    <code>[webqx_patient_portal]</code>
                </div>
                
                <div class="webqx-feature">
                    <h4><span class="dashicons dashicons-dashboard"></span> <?php _e('Provider Dashboard', 'webqx-healthcare'); ?></h4>
                    <p><?php _e('Clinical workflow management and EHR integration.', 'webqx-healthcare'); ?></p>
                    <code>[webqx_provider_dashboard]</code>
                </div>
                
                <div class="webqx-feature">
                    <h4><span class="dashicons dashicons-video-alt3"></span> <?php _e('Telehealth', 'webqx-healthcare'); ?></h4>
                    <p><?php _e('HIPAA-compliant video consultations and messaging.', 'webqx-healthcare'); ?></p>
                    <code>[webqx_telehealth]</code>
                </div>
                
                <div class="webqx-feature">
                    <h4><span class="dashicons dashicons-chart-line"></span> <?php _e('Lab Results', 'webqx-healthcare'); ?></h4>
                    <p><?php _e('FHIR-compliant laboratory results viewer.', 'webqx-healthcare'); ?></p>
                    <code>[webqx_lab_results]</code>
                </div>
            </div>
        </div>

        <!-- Getting Started Card -->
        <div class="webqx-card">
            <h3><span class="dashicons dashicons-welcome-learn-more"></span> <?php _e('Getting Started', 'webqx-healthcare'); ?></h3>
            <ol class="webqx-setup-steps">
                <li>
                    <strong><?php _e('Configure Settings', 'webqx-healthcare'); ?></strong>
                    <p><?php _e('Set up your Node.js server URL and enable desired features.', 'webqx-healthcare'); ?></p>
                </li>
                <li>
                    <strong><?php _e('Create Healthcare Pages', 'webqx-healthcare'); ?></strong>
                    <p><?php _e('Add shortcodes to WordPress pages to embed WebQX components.', 'webqx-healthcare'); ?></p>
                </li>
                <li>
                    <strong><?php _e('Configure User Roles', 'webqx-healthcare'); ?></strong>
                    <p><?php _e('Set up appropriate permissions for patients and providers.', 'webqx-healthcare'); ?></p>
                </li>
                <li>
                    <strong><?php _e('Test Integration', 'webqx-healthcare'); ?></strong>
                    <p><?php _e('Verify all features work correctly with your EHR system.', 'webqx-healthcare'); ?></p>
                </li>
            </ol>
        </div>

        <!-- System Info Card -->
        <div class="webqx-card">
            <h3><span class="dashicons dashicons-info"></span> <?php _e('System Information', 'webqx-healthcare'); ?></h3>
            <table class="webqx-system-info">
                <tr>
                    <td><strong><?php _e('Plugin Version:', 'webqx-healthcare'); ?></strong></td>
                    <td><?php echo WEBQX_VERSION; ?></td>
                </tr>
                <tr>
                    <td><strong><?php _e('WordPress Version:', 'webqx-healthcare'); ?></strong></td>
                    <td><?php echo get_bloginfo('version'); ?></td>
                </tr>
                <tr>
                    <td><strong><?php _e('PHP Version:', 'webqx-healthcare'); ?></strong></td>
                    <td><?php echo PHP_VERSION; ?></td>
                </tr>
                <tr>
                    <td><strong><?php _e('MySQL Version:', 'webqx-healthcare'); ?></strong></td>
                    <td><?php echo $GLOBALS['wpdb']->db_version(); ?></td>
                </tr>
                <tr>
                    <td><strong><?php _e('SSL Enabled:', 'webqx-healthcare'); ?></strong></td>
                    <td><?php echo is_ssl() ? __('Yes', 'webqx-healthcare') : __('No', 'webqx-healthcare'); ?></td>
                </tr>
            </table>
        </div>
    </div>

    <div class="webqx-footer">
        <p><?php printf(__('WebQX Healthcare Platform v%s | Licensed under Apache 2.0', 'webqx-healthcare'), WEBQX_VERSION); ?></p>
        <p>
            <a href="https://github.com/WebQx/webqx" target="_blank"><?php _e('GitHub Repository', 'webqx-healthcare'); ?></a> | 
            <a href="https://webqx.health" target="_blank"><?php _e('WebQX Health', 'webqx-healthcare'); ?></a> | 
            <a href="mailto:support@webqx.health"><?php _e('Support', 'webqx-healthcare'); ?></a>
        </p>
    </div>
</div>