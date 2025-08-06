<?php
/**
 * The header for our theme
 *
 * This is the template that displays all of the <head> section and everything up until <div id="content">
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="profile" href="https://gmpg.org/xfn/11">
    
    <?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<div id="page" class="site">
    <a class="skip-link screen-reader-text" href="#primary"><?php esc_html_e('Skip to content', 'webqx-healthcare'); ?></a>

    <header id="masthead" class="site-header">
        <div class="header-container">
            <div class="site-branding">
                <?php
                // Display custom logo or site title
                if (has_custom_logo()) :
                    the_custom_logo();
                else :
                    ?>
                    <h1 class="site-title">
                        <a href="<?php echo esc_url(home_url('/')); ?>" rel="home">
                            <?php bloginfo('name'); ?>
                        </a>
                    </h1>
                    <?php
                    $webqx_description = get_bloginfo('description', 'display');
                    if ($webqx_description || is_customize_preview()) :
                        ?>
                        <p class="site-description"><?php echo $webqx_description; ?></p>
                        <?php
                    endif;
                endif;
                ?>
            </div><!-- .site-branding -->

            <nav id="site-navigation" class="main-navigation">
                <button class="menu-toggle" aria-controls="primary-menu" aria-expanded="false">
                    <span class="screen-reader-text"><?php esc_html_e('Primary Menu', 'webqx-healthcare'); ?></span>
                    <span class="hamburger">
                        <span></span>
                        <span></span>
                        <span></span>
                    </span>
                </button>
                
                <?php
                wp_nav_menu(array(
                    'theme_location' => 'primary',
                    'menu_id' => 'primary-menu',
                    'container' => '',
                    'fallback_cb' => 'webqx_healthcare_fallback_menu',
                    'walker' => new WebQx_Walker_Nav_Menu(),
                ));
                ?>
                
                <!-- Contact Information from Customizer -->
                <div class="header-contact">
                    <?php
                    $phone = get_theme_mod('webqx_phone');
                    $email = get_theme_mod('webqx_email');
                    
                    if ($phone) :
                        ?>
                        <a href="tel:<?php echo esc_attr(str_replace(array(' ', '-', '(', ')'), '', $phone)); ?>" class="header-phone">
                            <span class="medical-icon">📞</span>
                            <?php echo esc_html($phone); ?>
                        </a>
                        <?php
                    endif;
                    
                    if ($email) :
                        ?>
                        <a href="mailto:<?php echo esc_attr($email); ?>" class="header-email">
                            <span class="medical-icon">✉</span>
                            <?php echo esc_html($email); ?>
                        </a>
                        <?php
                    endif;
                    ?>
                </div>
            </nav><!-- #site-navigation -->
        </div><!-- .header-container -->
        
        <?php
        // Display custom header image if set
        if (get_header_image()) :
            ?>
            <div class="header-image">
                <img src="<?php header_image(); ?>" width="<?php echo absint(get_custom_header()->width); ?>" height="<?php echo absint(get_custom_header()->height); ?>" alt="<?php echo esc_attr(get_bloginfo('name', 'display')); ?>">
            </div>
            <?php
        endif;
        ?>
    </header><!-- #masthead -->

    <?php
    // Display healthcare disclaimer if needed
    if (is_singular() && get_post_meta(get_the_ID(), '_webqx_medical_disclaimer', true)) :
        ?>
        <div class="medical-disclaimer healthcare-highlight">
            <strong><?php esc_html_e('Medical Disclaimer:', 'webqx-healthcare'); ?></strong>
            <?php esc_html_e('The information provided is for educational purposes only and should not be considered as medical advice. Always consult with a qualified healthcare professional for medical concerns.', 'webqx-healthcare'); ?>
        </div>
        <?php
    endif;

    /**
     * Fallback function for primary navigation
     */
    function webqx_healthcare_fallback_menu() {
        echo '<ul id="primary-menu" class="menu">';
        echo '<li><a href="' . esc_url(home_url('/')) . '">' . esc_html__('Home', 'webqx-healthcare') . '</a></li>';
        
        // Add common healthcare pages
        $healthcare_pages = array(
            'about' => __('About', 'webqx-healthcare'),
            'services' => __('Services', 'webqx-healthcare'),
            'providers' => __('Our Providers', 'webqx-healthcare'),
            'appointments' => __('Appointments', 'webqx-healthcare'),
            'contact' => __('Contact', 'webqx-healthcare'),
        );
        
        foreach ($healthcare_pages as $slug => $title) {
            $page = get_page_by_path($slug);
            if ($page) {
                echo '<li><a href="' . esc_url(get_permalink($page->ID)) . '">' . esc_html($title) . '</a></li>';
            }
        }
        
        echo '</ul>';
    }
    ?>