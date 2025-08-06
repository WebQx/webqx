<?php
/**
 * Provider Dashboard Template
 *
 * @package WebQX_Healthcare_Platform
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$height = esc_attr($atts['height']);
$provider_id = esc_attr($atts['provider_id']);
$current_user = wp_get_current_user();
?>

<div class="webqx-provider-dashboard-container" style="height: <?php echo $height; ?>;">
    <?php if (current_user_can('edit_posts')): ?>
        <div id="webqx-provider-dashboard" class="webqx-iframe-container">
            <div class="webqx-loading">
                <div class="webqx-spinner"></div>
                <p><?php _e('Loading provider dashboard...', 'webqx-healthcare'); ?></p>
            </div>
            <iframe 
                id="webqx-provider-iframe"
                src="about:blank"
                style="width: 100%; height: 100%; border: none; display: none;"
                title="<?php _e('WebQX Provider Dashboard', 'webqx-healthcare'); ?>"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox">
            </iframe>
        </div>
        
        <script>
        (function() {
            var iframe = document.getElementById('webqx-provider-iframe');
            var loading = document.querySelector('.webqx-loading');
            var nodeServerUrl = '<?php echo esc_js(WebQX_Healthcare_Platform::get_instance()->get_node_server_url()); ?>';
            var providerId = '<?php echo esc_js($provider_id); ?>';
            var wpUserId = '<?php echo esc_js($current_user->ID); ?>';
            
            // Build the provider dashboard URL
            var dashboardUrl = nodeServerUrl.replace(/\/$/, '') + '/provider-dashboard';
            var urlParams = new URLSearchParams();
            urlParams.append('wp_user_id', wpUserId);
            urlParams.append('provider_id', providerId);
            urlParams.append('wp_nonce', '<?php echo wp_create_nonce('webqx_provider_dashboard'); ?>');
            
            dashboardUrl += '?' + urlParams.toString();
            
            iframe.onload = function() {
                loading.style.display = 'none';
                iframe.style.display = 'block';
            };
            
            iframe.onerror = function() {
                loading.innerHTML = '<div class="webqx-error"><p><?php _e('Failed to load provider dashboard. Please check your server connection.', 'webqx-healthcare'); ?></p></div>';
            };
            
            iframe.src = dashboardUrl;
        })();
        </script>
    <?php else: ?>
        <div class="webqx-access-denied">
            <div class="webqx-card">
                <h3><?php _e('Access Denied', 'webqx-healthcare'); ?></h3>
                <p><?php _e('Provider credentials are required to access this dashboard.', 'webqx-healthcare'); ?></p>
                <p><?php _e('Please contact your administrator if you believe you should have access to this area.', 'webqx-healthcare'); ?></p>
                <a href="<?php echo home_url(); ?>" class="button button-secondary">
                    <?php _e('Return to Home', 'webqx-healthcare'); ?>
                </a>
            </div>
        </div>
    <?php endif; ?>
</div>