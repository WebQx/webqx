<?php
/**
 * Patient Portal Template
 *
 * @package WebQX_Healthcare_Platform
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$height = esc_attr($atts['height']);
$patient_id = esc_attr($atts['patient_id']);
$current_user = wp_get_current_user();
?>

<div class="webqx-patient-portal-container" style="height: <?php echo $height; ?>;">
    <?php if (is_user_logged_in()): ?>
        <div id="webqx-patient-portal" class="webqx-iframe-container">
            <div class="webqx-loading">
                <div class="webqx-spinner"></div>
                <p><?php _e('Loading patient portal...', 'webqx-healthcare'); ?></p>
            </div>
            <iframe 
                id="webqx-patient-iframe"
                src="about:blank"
                style="width: 100%; height: 100%; border: none; display: none;"
                title="<?php _e('WebQX Patient Portal', 'webqx-healthcare'); ?>"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox">
            </iframe>
        </div>
        
        <script>
        (function() {
            var iframe = document.getElementById('webqx-patient-iframe');
            var loading = document.querySelector('.webqx-loading');
            var nodeServerUrl = '<?php echo esc_js(WebQX_Healthcare_Platform::get_instance()->get_node_server_url()); ?>';
            var patientId = '<?php echo esc_js($patient_id); ?>';
            var wpUserId = '<?php echo esc_js($current_user->ID); ?>';
            
            // Build the patient portal URL
            var portalUrl = nodeServerUrl.replace(/\/$/, '') + '/patient-portal';
            var urlParams = new URLSearchParams();
            urlParams.append('wp_user_id', wpUserId);
            urlParams.append('patient_id', patientId);
            urlParams.append('wp_nonce', '<?php echo wp_create_nonce('webqx_patient_portal'); ?>');
            
            portalUrl += '?' + urlParams.toString();
            
            iframe.onload = function() {
                loading.style.display = 'none';
                iframe.style.display = 'block';
            };
            
            iframe.onerror = function() {
                loading.innerHTML = '<div class="webqx-error"><p><?php _e('Failed to load patient portal. Please check your server connection.', 'webqx-healthcare'); ?></p></div>';
            };
            
            iframe.src = portalUrl;
        })();
        </script>
    <?php else: ?>
        <div class="webqx-login-required">
            <div class="webqx-card">
                <h3><?php _e('Login Required', 'webqx-healthcare'); ?></h3>
                <p><?php _e('Please log in to access your patient portal.', 'webqx-healthcare'); ?></p>
                <a href="<?php echo wp_login_url(get_permalink()); ?>" class="button button-primary">
                    <?php _e('Login', 'webqx-healthcare'); ?>
                </a>
                <a href="<?php echo wp_registration_url(); ?>" class="button button-secondary">
                    <?php _e('Register', 'webqx-healthcare'); ?>
                </a>
            </div>
        </div>
    <?php endif; ?>
</div>