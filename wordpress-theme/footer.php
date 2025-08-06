<?php
/**
 * The template for displaying the footer
 *
 * Contains the closing of the #content div and all content after.
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

?>

    <footer id="colophon" class="site-footer">
        <div class="footer-container">
            <?php if (is_active_sidebar('footer-1') || is_active_sidebar('footer-2') || is_active_sidebar('footer-3')) : ?>
                <div class="footer-widgets">
                    <?php if (is_active_sidebar('footer-1')) : ?>
                        <div class="footer-widget-area footer-1">
                            <?php dynamic_sidebar('footer-1'); ?>
                        </div>
                    <?php endif; ?>

                    <?php if (is_active_sidebar('footer-2')) : ?>
                        <div class="footer-widget-area footer-2">
                            <?php dynamic_sidebar('footer-2'); ?>
                        </div>
                    <?php endif; ?>

                    <?php if (is_active_sidebar('footer-3')) : ?>
                        <div class="footer-widget-area footer-3">
                            <?php dynamic_sidebar('footer-3'); ?>
                        </div>
                    <?php endif; ?>
                </div>
            <?php else : ?>
                <!-- Default footer content if no widgets are active -->
                <div class="footer-widgets">
                    <div class="footer-widget">
                        <h3><?php esc_html_e('About WebQx Healthcare', 'webqx-healthcare'); ?></h3>
                        <p><?php esc_html_e('WebQx Healthcare is a comprehensive modular healthcare platform designed to empower both patients and providers with accessible, secure, and compliant healthcare solutions.', 'webqx-healthcare'); ?></p>
                    </div>

                    <div class="footer-widget">
                        <h3><?php esc_html_e('Quick Links', 'webqx-healthcare'); ?></h3>
                        <?php
                        wp_nav_menu(array(
                            'theme_location' => 'footer',
                            'container' => '',
                            'menu_class' => 'footer-menu',
                            'fallback_cb' => 'webqx_healthcare_footer_fallback_menu',
                            'depth' => 1,
                        ));
                        ?>
                    </div>

                    <div class="footer-widget">
                        <h3><?php esc_html_e('Contact Information', 'webqx-healthcare'); ?></h3>
                        <?php
                        $phone = get_theme_mod('webqx_phone');
                        $email = get_theme_mod('webqx_email');
                        $address = get_theme_mod('webqx_address');

                        if ($address) :
                            ?>
                            <div class="footer-address">
                                <strong><?php esc_html_e('Address:', 'webqx-healthcare'); ?></strong><br>
                                <?php echo nl2br(esc_html($address)); ?>
                            </div>
                            <?php
                        endif;

                        if ($phone) :
                            ?>
                            <div class="footer-phone">
                                <strong><?php esc_html_e('Phone:', 'webqx-healthcare'); ?></strong>
                                <a href="tel:<?php echo esc_attr(str_replace(array(' ', '-', '(', ')'), '', $phone)); ?>">
                                    <?php echo esc_html($phone); ?>
                                </a>
                            </div>
                            <?php
                        endif;

                        if ($email) :
                            ?>
                            <div class="footer-email">
                                <strong><?php esc_html_e('Email:', 'webqx-healthcare'); ?></strong>
                                <a href="mailto:<?php echo esc_attr($email); ?>">
                                    <?php echo esc_html($email); ?>
                                </a>
                            </div>
                            <?php
                        endif;
                        ?>
                    </div>
                </div>
            <?php endif; ?>
        </div>

        <div class="site-info">
            <div class="footer-copyright">
                <p>
                    &copy; <?php echo date('Y'); ?> 
                    <a href="<?php echo esc_url(home_url('/')); ?>"><?php bloginfo('name'); ?></a>
                    <?php esc_html_e('All rights reserved.', 'webqx-healthcare'); ?>
                </p>
                
                <p class="privacy-notice">
                    <?php esc_html_e('This website complies with HIPAA privacy requirements. Patient information is protected and secure.', 'webqx-healthcare'); ?>
                </p>
                
                <p class="theme-credit">
                    <?php
                    printf(
                        esc_html__('Powered by %1$s | WebQx Healthcare Theme by %2$s', 'webqx-healthcare'),
                        '<a href="https://wordpress.org/" rel="nofollow">WordPress</a>',
                        '<a href="#" rel="nofollow">WebQx Team</a>'
                    );
                    ?>
                </p>
            </div>

            <!-- Emergency Contact Information -->
            <div class="emergency-contact">
                <p class="emergency-notice">
                    <strong><?php esc_html_e('Emergency Notice:', 'webqx-healthcare'); ?></strong>
                    <?php esc_html_e('If you are experiencing a medical emergency, please call 911 immediately or go to your nearest emergency room.', 'webqx-healthcare'); ?>
                </p>
            </div>

            <!-- HIPAA Compliance Notice -->
            <div class="compliance-notice">
                <p>
                    <?php esc_html_e('HIPAA Compliant | SSL Secured | Patient Privacy Protected', 'webqx-healthcare'); ?>
                </p>
            </div>
        </div><!-- .site-info -->
    </footer><!-- #colophon -->

</div><!-- #page -->

<?php wp_footer(); ?>

<script>
// Healthcare-specific JavaScript for accessibility and functionality
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navigation = document.querySelector('#site-navigation');
    
    if (menuToggle && navigation) {
        menuToggle.addEventListener('click', function() {
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', !isExpanded);
            navigation.classList.toggle('toggled');
        });
    }

    // Accessibility improvements for form validation
    const forms = document.querySelectorAll('form');
    forms.forEach(function(form) {
        form.addEventListener('submit', function(e) {
            const requiredFields = form.querySelectorAll('[required]');
            let isValid = true;
            
            requiredFields.forEach(function(field) {
                if (!field.value.trim()) {
                    field.setAttribute('aria-invalid', 'true');
                    isValid = false;
                } else {
                    field.removeAttribute('aria-invalid');
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                const firstInvalid = form.querySelector('[aria-invalid="true"]');
                if (firstInvalid) {
                    firstInvalid.focus();
                }
            }
        });
    });

    // Healthcare disclaimer auto-dismiss
    const disclaimer = document.querySelector('.medical-disclaimer');
    if (disclaimer) {
        // Auto-hide after 10 seconds unless user interacts with it
        let timeoutId = setTimeout(function() {
            disclaimer.style.opacity = '0.7';
        }, 10000);
        
        disclaimer.addEventListener('mouseenter', function() {
            clearTimeout(timeoutId);
            this.style.opacity = '1';
        });
    }

    // Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});
</script>

</body>
</html>

<?php
/**
 * Fallback function for footer navigation
 */
function webqx_healthcare_footer_fallback_menu() {
    echo '<ul class="footer-menu">';
    echo '<li><a href="' . esc_url(home_url('/')) . '">' . esc_html__('Home', 'webqx-healthcare') . '</a></li>';
    echo '<li><a href="' . esc_url(get_privacy_policy_url()) . '">' . esc_html__('Privacy Policy', 'webqx-healthcare') . '</a></li>';
    
    // Add common footer pages
    $footer_pages = array(
        'terms-of-service' => __('Terms of Service', 'webqx-healthcare'),
        'patient-rights' => __('Patient Rights', 'webqx-healthcare'),
        'accessibility' => __('Accessibility', 'webqx-healthcare'),
    );
    
    foreach ($footer_pages as $slug => $title) {
        $page = get_page_by_path($slug);
        if ($page) {
            echo '<li><a href="' . esc_url(get_permalink($page->ID)) . '">' . esc_html($title) . '</a></li>';
        }
    }
    
    echo '</ul>';
}
?>