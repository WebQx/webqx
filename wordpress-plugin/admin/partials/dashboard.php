<?php
/**
 * Admin Dashboard Partial
 * 
 * @package WebQX_Healthcare
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$admin = WebQX_Admin::get_instance();
$stats = $admin->get_dashboard_stats();
$system_info = $admin->get_system_info();
?>

<div class="wrap">
    <h1><?php esc_html_e('WebQX Healthcare Dashboard', 'webqx-healthcare'); ?></h1>
    
    <div class="webqx-dashboard-wrapper">
        <!-- Connection Status -->
        <div class="webqx-status-card">
            <h2><?php esc_html_e('Backend Connection Status', 'webqx-healthcare'); ?></h2>
            <?php if ($backend_status['connected']): ?>
                <div class="webqx-status-success">
                    <span class="dashicons dashicons-yes-alt"></span>
                    <?php esc_html_e('Connected to WebQX Backend', 'webqx-healthcare'); ?>
                </div>
                <?php if (isset($backend_status['backend_info']['version'])): ?>
                    <p><small><?php printf(esc_html__('Backend Version: %s', 'webqx-healthcare'), esc_html($backend_status['backend_info']['version'])); ?></small></p>
                <?php endif; ?>
            <?php else: ?>
                <div class="webqx-status-error">
                    <span class="dashicons dashicons-warning"></span>
                    <?php esc_html_e('Unable to connect to WebQX Backend', 'webqx-healthcare'); ?>
                </div>
                <?php if (isset($backend_status['error'])): ?>
                    <p><small><?php echo esc_html($backend_status['error']); ?></small></p>
                <?php endif; ?>
                <p><a href="<?php echo esc_url(admin_url('admin.php?page=webqx-settings')); ?>"><?php esc_html_e('Check Settings', 'webqx-healthcare'); ?></a></p>
            <?php endif; ?>
        </div>

        <!-- Statistics -->
        <div class="webqx-stats-grid">
            <div class="webqx-stat-card">
                <h3><?php esc_html_e('Patients', 'webqx-healthcare'); ?></h3>
                <span class="webqx-stat-number"><?php echo absint($stats['patients']); ?></span>
            </div>
            <div class="webqx-stat-card">
                <h3><?php esc_html_e('Appointments', 'webqx-healthcare'); ?></h3>
                <span class="webqx-stat-number"><?php echo absint($stats['appointments']); ?></span>
            </div>
            <div class="webqx-stat-card">
                <h3><?php esc_html_e('Providers', 'webqx-healthcare'); ?></h3>
                <span class="webqx-stat-number"><?php echo absint($stats['providers']); ?></span>
            </div>
        </div>

        <!-- Recent Activity -->
        <div class="webqx-recent-activity">
            <h2><?php esc_html_e('Recent Activity', 'webqx-healthcare'); ?></h2>
            <?php if (!empty($stats['recent_activity'])): ?>
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Time', 'webqx-healthcare'); ?></th>
                            <th><?php esc_html_e('Level', 'webqx-healthcare'); ?></th>
                            <th><?php esc_html_e('Message', 'webqx-healthcare'); ?></th>
                            <th><?php esc_html_e('User', 'webqx-healthcare'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($stats['recent_activity'] as $activity): ?>
                            <tr>
                                <td><?php echo esc_html(mysql2date('M j, Y g:i A', $activity['timestamp'])); ?></td>
                                <td>
                                    <span class="webqx-log-level webqx-log-<?php echo esc_attr($activity['level']); ?>">
                                        <?php echo esc_html(ucfirst($activity['level'])); ?>
                                    </span>
                                </td>
                                <td><?php echo esc_html($activity['message']); ?></td>
                                <td>
                                    <?php 
                                    if ($activity['user_id']) {
                                        $user = get_userdata($activity['user_id']);
                                        echo esc_html($user ? $user->display_name : 'Unknown');
                                    } else {
                                        esc_html_e('System', 'webqx-healthcare');
                                    }
                                    ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <p><?php esc_html_e('No recent activity found.', 'webqx-healthcare'); ?></p>
            <?php endif; ?>
        </div>

        <!-- System Information -->
        <div class="webqx-system-info">
            <h2><?php esc_html_e('System Information', 'webqx-healthcare'); ?></h2>
            <table class="form-table">
                <tbody>
                    <tr>
                        <th scope="row"><?php esc_html_e('Plugin Version', 'webqx-healthcare'); ?></th>
                        <td><?php echo esc_html($system_info['plugin_version']); ?></td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e('WordPress Version', 'webqx-healthcare'); ?></th>
                        <td><?php echo esc_html($system_info['wordpress_version']); ?></td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e('PHP Version', 'webqx-healthcare'); ?></th>
                        <td><?php echo esc_html($system_info['php_version']); ?></td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e('Required Extensions', 'webqx-healthcare'); ?></th>
                        <td>
                            <?php foreach ($system_info['extensions'] as $ext => $loaded): ?>
                                <span class="webqx-extension-status webqx-extension-<?php echo $loaded ? 'loaded' : 'missing'; ?>">
                                    <?php echo esc_html($ext); ?>: 
                                    <?php echo $loaded ? esc_html__('✓', 'webqx-healthcare') : esc_html__('✗', 'webqx-healthcare'); ?>
                                </span>
                            <?php endforeach; ?>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Quick Actions -->
        <div class="webqx-quick-actions">
            <h2><?php esc_html_e('Quick Actions', 'webqx-healthcare'); ?></h2>
            <div class="webqx-actions-grid">
                <a href="<?php echo esc_url(admin_url('admin.php?page=webqx-settings')); ?>" class="button button-primary">
                    <?php esc_html_e('Configure Settings', 'webqx-healthcare'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=webqx-patients')); ?>" class="button">
                    <?php esc_html_e('Manage Patients', 'webqx-healthcare'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=webqx-appointments')); ?>" class="button">
                    <?php esc_html_e('View Appointments', 'webqx-healthcare'); ?>
                </a>
                <button id="webqx-test-connection" class="button">
                    <?php esc_html_e('Test Backend Connection', 'webqx-healthcare'); ?>
                </button>
            </div>
        </div>
    </div>
</div>

<script>
jQuery(document).ready(function($) {
    $('#webqx-test-connection').on('click', function() {
        var button = $(this);
        button.prop('disabled', true).text('<?php esc_js_e('Testing...', 'webqx-healthcare'); ?>');
        
        $.post(ajaxurl, {
            action: 'webqx_check_backend',
            nonce: webqx_admin_ajax.nonce
        }, function(response) {
            if (response.success && response.data.connected) {
                alert('<?php esc_js_e('Connection successful!', 'webqx-healthcare'); ?>');
            } else {
                alert('<?php esc_js_e('Connection failed. Please check your settings.', 'webqx-healthcare'); ?>');
            }
        }).always(function() {
            button.prop('disabled', false).text('<?php esc_js_e('Test Backend Connection', 'webqx-healthcare'); ?>');
        });
    });
});
</script>