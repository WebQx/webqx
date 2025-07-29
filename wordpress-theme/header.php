<?php
/**
 * The header for the WebQX Healthcare Platform theme
 *
 * @package WebQX_Healthcare_Platform
 * @since 1.0.0
 */
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="profile" href="https://gmpg.org/xfn/11">
    
    <!-- WebQX Healthcare Platform Meta -->
    <meta name="description" content="<?php bloginfo('description'); ?>">
    <meta name="keywords" content="healthcare, medical, patient portal, FHIR, WebQX">
    <meta name="author" content="WebQX Health">
    
    <!-- Healthcare-specific meta tags -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="<?php wp_title('|', true, 'right'); ?>">
    <meta property="og:description" content="<?php bloginfo('description'); ?>">
    <meta property="og:url" content="<?php echo esc_url(home_url('/')); ?>">
    <meta property="og:site_name" content="<?php bloginfo('name'); ?>">
    
    <!-- Accessibility improvements -->
    <meta name="theme-color" content="#2c3e50">
    <link rel="icon" href="<?php echo esc_url(get_template_directory_uri() . '/assets/favicon.ico'); ?>">
    
    <?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<div id="page" class="site">
    <a class="skip-link screen-reader-text" href="#content">
        <?php _e('Skip to content', 'webqx'); ?>
    </a>

    <header id="masthead" class="site-header">
        <div class="container">
            <div class="site-branding">
                <?php if (has_custom_logo()) : ?>
                    <div class="site-logo">
                        <?php the_custom_logo(); ?>
                    </div>
                <?php else : ?>
                    <h1 class="site-title">
                        <a href="<?php echo esc_url(home_url('/')); ?>" rel="home">
                            <?php bloginfo('name'); ?>
                        </a>
                    </h1>
                    <?php
                    $description = get_bloginfo('description', 'display');
                    if ($description || is_customize_preview()) :
                        ?>
                        <p class="site-description"><?php echo $description; ?></p>
                    <?php endif; ?>
                <?php endif; ?>
            </div><!-- .site-branding -->

            <nav id="site-navigation" class="main-navigation">
                <button class="menu-toggle" aria-controls="primary-menu" aria-expanded="false">
                    <span class="screen-reader-text"><?php _e('Menu', 'webqx'); ?></span>
                    <span class="hamburger-icon"></span>
                </button>
                
                <?php
                wp_nav_menu(array(
                    'theme_location' => 'primary',
                    'menu_id'        => 'primary-menu',
                    'container'      => false,
                    'fallback_cb'    => 'webqx_default_menu',
                ));
                ?>
                
                <div class="webqx-user-actions">
                    <?php if (is_user_logged_in()) : ?>
                        <div class="user-greeting">
                            <?php
                            $current_user = wp_get_current_user();
                            printf(
                                __('Welcome, %s', 'webqx'),
                                esc_html($current_user->display_name)
                            );
                            ?>
                        </div>
                        <a href="<?php echo esc_url(wp_logout_url(home_url())); ?>" class="btn btn-secondary">
                            <?php _e('Logout', 'webqx'); ?>
                        </a>
                    <?php else : ?>
                        <a href="<?php echo esc_url(wp_login_url()); ?>" class="btn">
                            <?php _e('Patient Login', 'webqx'); ?>
                        </a>
                        <a href="<?php echo esc_url(home_url('/provider-login')); ?>" class="btn btn-secondary">
                            <?php _e('Provider Login', 'webqx'); ?>
                        </a>
                    <?php endif; ?>
                </div>
            </nav><!-- #site-navigation -->
        </div><!-- .container -->
        
        <?php if (is_front_page()) : ?>
            <div class="webqx-hero-banner">
                <div class="container">
                    <div class="hero-content">
                        <h2><?php _e('WebQX™: Modular Healthcare Platform', 'webqx'); ?></h2>
                        <p><?php _e('A multilingual, specialty-aware, and privacy-first blueprint for global clinical care.', 'webqx'); ?></p>
                        <div class="hero-actions">
                            <a href="#webqx-modules" class="btn btn-primary">
                                <?php _e('Explore Modules', 'webqx'); ?>
                            </a>
                            <a href="<?php echo esc_url(home_url('/about')); ?>" class="btn btn-secondary">
                                <?php _e('Learn More', 'webqx'); ?>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        <?php endif; ?>
        
        <?php if (function_exists('webqx_display_health_alerts')) : ?>
            <div class="webqx-health-alerts">
                <?php webqx_display_health_alerts(); ?>
            </div>
        <?php endif; ?>
    </header><!-- #masthead -->

    <div id="content" class="site-content">
        
        <?php
        // Add a notification bar for FHIR status if enabled
        if (get_option('webqx_enable_fhir', true) && current_user_can('manage_options')) :
            ?>
            <div class="webqx-fhir-status">
                <div class="container">
                    <p>
                        <strong><?php _e('FHIR R4 Integration:', 'webqx'); ?></strong>
                        <span class="status-indicator status-active"></span>
                        <?php _e('Active', 'webqx'); ?>
                    </p>
                </div>
            </div>
        <?php endif; ?>

<?php
/**
 * Default menu fallback if no menu is assigned
 */
function webqx_default_menu() {
    echo '<ul id="primary-menu" class="menu">';
    echo '<li><a href="' . esc_url(home_url('/')) . '">' . __('Home', 'webqx') . '</a></li>';
    echo '<li><a href="' . esc_url(home_url('/patient-portal')) . '">' . __('Patient Portal', 'webqx') . '</a></li>';
    echo '<li><a href="' . esc_url(home_url('/provider-panel')) . '">' . __('Provider Panel', 'webqx') . '</a></li>';
    echo '<li><a href="' . esc_url(home_url('/specialties')) . '">' . __('Specialties', 'webqx') . '</a></li>';
    echo '<li><a href="' . esc_url(home_url('/contact')) . '">' . __('Contact', 'webqx') . '</a></li>';
    echo '</ul>';
}
?>