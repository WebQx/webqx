<?php
/**
 * The template for displaying the footer
 *
 * @package WebQX_Healthcare_Platform
 * @since 1.0.0
 */
?>

    </div><!-- #content -->

    <footer id="colophon" class="site-footer">
        <div class="container">
            <div class="footer-content">
                
                <div class="footer-section footer-branding">
                    <h3><?php bloginfo('name'); ?></h3>
                    <p><?php bloginfo('description'); ?></p>
                    
                    <div class="webqx-compliance-badges">
                        <span class="compliance-badge" title="<?php _e('HIPAA Compliant', 'webqx'); ?>">
                            <?php _e('HIPAA', 'webqx'); ?>
                        </span>
                        <span class="compliance-badge" title="<?php _e('FHIR R4 Compatible', 'webqx'); ?>">
                            <?php _e('FHIR R4', 'webqx'); ?>
                        </span>
                        <span class="compliance-badge" title="<?php _e('HL7 Compatible', 'webqx'); ?>">
                            <?php _e('HL7', 'webqx'); ?>
                        </span>
                    </div>
                </div>

                <div class="footer-section footer-navigation">
                    <h3><?php _e('Quick Links', 'webqx'); ?></h3>
                    <?php
                    wp_nav_menu(array(
                        'theme_location' => 'footer',
                        'container'      => false,
                        'menu_class'     => 'footer-menu',
                        'fallback_cb'    => 'webqx_footer_default_menu',
                    ));
                    ?>
                </div>

                <div class="footer-section footer-specialties">
                    <h3><?php _e('Medical Specialties', 'webqx'); ?></h3>
                    <ul class="specialties-list">
                        <li><a href="<?php echo esc_url(home_url('/specialty/primary-care')); ?>"><?php _e('Primary Care', 'webqx'); ?></a></li>
                        <li><a href="<?php echo esc_url(home_url('/specialty/radiology')); ?>"><?php _e('Radiology', 'webqx'); ?></a></li>
                        <li><a href="<?php echo esc_url(home_url('/specialty/cardiology')); ?>"><?php _e('Cardiology', 'webqx'); ?></a></li>
                        <li><a href="<?php echo esc_url(home_url('/specialty/pediatrics')); ?>"><?php _e('Pediatrics', 'webqx'); ?></a></li>
                        <li><a href="<?php echo esc_url(home_url('/specialty/oncology')); ?>"><?php _e('Oncology', 'webqx'); ?></a></li>
                        <li><a href="<?php echo esc_url(home_url('/specialty/psychiatry')); ?>"><?php _e('Psychiatry', 'webqx'); ?></a></li>
                    </ul>
                </div>

                <div class="footer-section footer-contact">
                    <h3><?php _e('Contact & Support', 'webqx'); ?></h3>
                    <div class="contact-info">
                        <p>
                            <strong><?php _e('Technical Support:', 'webqx'); ?></strong><br>
                            <a href="mailto:support@webqx.health">support@webqx.health</a>
                        </p>
                        <p>
                            <strong><?php _e('Clinical Support:', 'webqx'); ?></strong><br>
                            <a href="mailto:clinical@webqx.health">clinical@webqx.health</a>
                        </p>
                        <p>
                            <strong><?php _e('Emergency Contact:', 'webqx'); ?></strong><br>
                            <span class="emergency-note"><?php _e('For medical emergencies, call 911', 'webqx'); ?></span>
                        </p>
                    </div>
                </div>

                <?php if (is_active_sidebar('footer-1')) : ?>
                    <div class="footer-section footer-widgets">
                        <?php dynamic_sidebar('footer-1'); ?>
                    </div>
                <?php endif; ?>

            </div><!-- .footer-content -->

            <div class="footer-bottom">
                <div class="footer-bottom-content">
                    <div class="copyright">
                        <p>
                            &copy; <?php echo date('Y'); ?> 
                            <a href="<?php echo esc_url(home_url('/')); ?>"><?php bloginfo('name'); ?></a>. 
                            <?php _e('All rights reserved.', 'webqx'); ?>
                        </p>
                        <p class="license-info">
                            <?php _e('Licensed under', 'webqx'); ?> 
                            <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener">
                                <?php _e('Apache 2.0 License', 'webqx'); ?>
                            </a>
                        </p>
                    </div>

                    <div class="footer-meta">
                        <div class="language-selector">
                            <?php webqx_display_language_selector(); ?>
                        </div>
                        
                        <div class="accessibility-tools">
                            <button id="webqx-font-size-toggle" class="accessibility-btn" title="<?php _e('Toggle Font Size', 'webqx'); ?>">
                                <?php _e('A+', 'webqx'); ?>
                            </button>
                            <button id="webqx-contrast-toggle" class="accessibility-btn" title="<?php _e('Toggle High Contrast', 'webqx'); ?>">
                                <?php _e('◑', 'webqx'); ?>
                            </button>
                        </div>
                    </div>
                </div>
            </div><!-- .footer-bottom -->

            <div class="webqx-system-status">
                <div class="status-indicator">
                    <span class="status-dot status-operational"></span>
                    <span class="status-text"><?php _e('All Systems Operational', 'webqx'); ?></span>
                </div>
                <div class="api-status">
                    <span id="webqx-api-status" class="api-status-text">
                        <?php _e('Checking API status...', 'webqx'); ?>
                    </span>
                </div>
            </div>

        </div><!-- .container -->
    </footer><!-- #colophon -->

</div><!-- #page -->

<?php wp_footer(); ?>

<script>
// WebQX Theme JavaScript
(function($) {
    'use strict';
    
    $(document).ready(function() {
        // Check API status
        webqxCheckApiStatus();
        
        // Accessibility features
        $('#webqx-font-size-toggle').on('click', function() {
            $('body').toggleClass('webqx-large-fonts');
        });
        
        $('#webqx-contrast-toggle').on('click', function() {
            $('body').toggleClass('webqx-high-contrast');
        });
        
        // Mobile menu toggle
        $('.menu-toggle').on('click', function() {
            $(this).toggleClass('active');
            $('#primary-menu').toggleClass('active');
        });
    });
    
    // Check WebQX API status
    function webqxCheckApiStatus() {
        if (typeof webqx_ajax === 'undefined') {
            return;
        }
        
        $.ajax({
            url: webqx_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'webqx_api_call',
                nonce: webqx_ajax.nonce,
                endpoint: 'health',
                method: 'GET'
            },
            success: function(response) {
                var data = JSON.parse(response);
                var statusElement = $('#webqx-api-status');
                
                if (data.success) {
                    statusElement.text('<?php _e("API Online", "webqx"); ?>').addClass('status-online');
                } else {
                    statusElement.text('<?php _e("API Offline", "webqx"); ?>').addClass('status-offline');
                }
            },
            error: function() {
                $('#webqx-api-status').text('<?php _e("Connection Error", "webqx"); ?>').addClass('status-error');
            }
        });
    }
    
})(jQuery);
</script>

</body>
</html>

<?php
/**
 * Default footer menu fallback
 */
function webqx_footer_default_menu() {
    echo '<ul class="footer-menu">';
    echo '<li><a href="' . esc_url(home_url('/privacy-policy')) . '">' . __('Privacy Policy', 'webqx') . '</a></li>';
    echo '<li><a href="' . esc_url(home_url('/terms-of-service')) . '">' . __('Terms of Service', 'webqx') . '</a></li>';
    echo '<li><a href="' . esc_url(home_url('/hipaa-compliance')) . '">' . __('HIPAA Compliance', 'webqx') . '</a></li>';
    echo '<li><a href="' . esc_url(home_url('/accessibility')) . '">' . __('Accessibility', 'webqx') . '</a></li>';
    echo '<li><a href="' . esc_url(home_url('/contact')) . '">' . __('Contact Us', 'webqx') . '</a></li>';
    echo '</ul>';
}

/**
 * Display language selector
 */
function webqx_display_language_selector() {
    $current_lang = get_option('webqx_default_language', 'en');
    $languages = array(
        'en' => __('English', 'webqx'),
        'es' => __('Español', 'webqx'),
        'fr' => __('Français', 'webqx'),
        'de' => __('Deutsch', 'webqx'),
    );
    
    echo '<select id="webqx-language-selector" class="language-selector">';
    foreach ($languages as $code => $name) {
        $selected = ($code === $current_lang) ? 'selected' : '';
        echo '<option value="' . esc_attr($code) . '" ' . $selected . '>' . esc_html($name) . '</option>';
    }
    echo '</select>';
}
?>