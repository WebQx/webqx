<?php
/**
 * Telehealth Template
 *
 * @package WebQX_Healthcare_Platform
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$height = esc_attr($atts['height']);
$session_id = esc_attr($atts['session_id']);
$current_user = wp_get_current_user();
?>

<div class="webqx-telehealth-container" style="height: <?php echo $height; ?>;">
    <?php if (is_user_logged_in()): ?>
        <div id="webqx-telehealth" class="webqx-iframe-container">
            <div class="webqx-loading">
                <div class="webqx-spinner"></div>
                <p><?php _e('Initializing secure telehealth session...', 'webqx-healthcare'); ?></p>
            </div>
            <iframe 
                id="webqx-telehealth-iframe"
                src="about:blank"
                style="width: 100%; height: 100%; border: none; display: none;"
                title="<?php _e('WebQX Telehealth Consultation', 'webqx-healthcare'); ?>"
                allow="camera; microphone; display-capture"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox">
            </iframe>
        </div>
        
        <div class="webqx-telehealth-controls" style="margin-top: 10px;">
            <div class="webqx-privacy-notice">
                <p><small>
                    <span class="dashicons dashicons-lock"></span>
                    <?php _e('This is a HIPAA-compliant secure telehealth session. All communications are encrypted.', 'webqx-healthcare'); ?>
                </small></p>
            </div>
        </div>
        
        <script>
        (function() {
            var iframe = document.getElementById('webqx-telehealth-iframe');
            var loading = document.querySelector('.webqx-loading');
            var nodeServerUrl = '<?php echo esc_js(WebQX_Healthcare_Platform::get_instance()->get_node_server_url()); ?>';
            var sessionId = '<?php echo esc_js($session_id); ?>';
            var wpUserId = '<?php echo esc_js($current_user->ID); ?>';
            
            // Build the telehealth URL
            var telehealthUrl = nodeServerUrl.replace(/\/$/, '') + '/telehealth';
            var urlParams = new URLSearchParams();
            urlParams.append('wp_user_id', wpUserId);
            if (sessionId) {
                urlParams.append('session_id', sessionId);
            }
            urlParams.append('wp_nonce', '<?php echo wp_create_nonce('webqx_telehealth'); ?>');
            
            telehealthUrl += '?' + urlParams.toString();
            
            iframe.onload = function() {
                loading.style.display = 'none';
                iframe.style.display = 'block';
            };
            
            iframe.onerror = function() {
                loading.innerHTML = '<div class="webqx-error"><p><?php _e('Failed to load telehealth interface. Please check your server connection.', 'webqx-healthcare'); ?></p></div>';
            };
            
            // Check for camera/microphone permissions
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .then(function(stream) {
                        // Permissions granted, load the iframe
                        iframe.src = telehealthUrl;
                        // Stop the stream since we were just checking permissions
                        stream.getTracks().forEach(track => track.stop());
                    })
                    .catch(function(err) {
                        loading.innerHTML = '<div class="webqx-error"><p><?php _e('Camera and microphone access is required for telehealth sessions. Please grant permissions and refresh.', 'webqx-healthcare'); ?></p></div>';
                    });
            } else {
                // Fallback for browsers without getUserMedia support
                iframe.src = telehealthUrl;
            }
        })();
        </script>
    <?php else: ?>
        <div class="webqx-login-required">
            <div class="webqx-card">
                <h3><?php _e('Authentication Required', 'webqx-healthcare'); ?></h3>
                <p><?php _e('Please log in to access the telehealth consultation.', 'webqx-healthcare'); ?></p>
                <a href="<?php echo wp_login_url(get_permalink()); ?>" class="button button-primary">
                    <?php _e('Login', 'webqx-healthcare'); ?>
                </a>
            </div>
        </div>
    <?php endif; ?>
</div>