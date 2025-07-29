<?php
/**
 * WebQX Healthcare Platform Theme Functions
 *
 * @package WebQX_Healthcare_Platform
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Theme setup
function webqx_theme_setup() {
    // Add theme support for various features
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', array(
        'search-form',
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
        'style',
        'script',
    ));
    add_theme_support('customize-selective-refresh-widgets');
    add_theme_support('responsive-embeds');
    
    // Register navigation menus
    register_nav_menus(array(
        'primary' => __('Primary Menu', 'webqx'),
        'footer' => __('Footer Menu', 'webqx'),
        'specialty' => __('Specialty Menu', 'webqx'),
    ));
    
    // Add support for wide and full width blocks
    add_theme_support('align-wide');
    
    // Set content width
    if (!isset($content_width)) {
        $content_width = 1200;
    }
}
add_action('after_setup_theme', 'webqx_theme_setup');

// Enqueue styles and scripts
function webqx_scripts() {
    // Theme stylesheet
    wp_enqueue_style('webqx-style', get_stylesheet_uri(), array(), '1.0.0');
    
    // WebQX custom scripts
    wp_enqueue_script('webqx-theme-js', get_template_directory_uri() . '/js/theme.js', array('jquery'), '1.0.0', true);
    
    // Localize script for AJAX
    wp_localize_script('webqx-theme-js', 'webqx_ajax', array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('webqx_nonce'),
        'api_base' => get_webqx_api_base_url(),
    ));
    
    // Load responsive navigation script
    if (has_nav_menu('primary')) {
        wp_enqueue_script('webqx-navigation', get_template_directory_uri() . '/js/navigation.js', array(), '1.0.0', true);
    }
}
add_action('wp_enqueue_scripts', 'webqx_scripts');

// Register widget areas
function webqx_widgets_init() {
    register_sidebar(array(
        'name'          => __('Sidebar', 'webqx'),
        'id'            => 'sidebar-1',
        'description'   => __('Add widgets here to appear in your sidebar.', 'webqx'),
        'before_widget' => '<section id="%1$s" class="widget %2$s">',
        'after_widget'  => '</section>',
        'before_title'  => '<h2 class="widget-title">',
        'after_title'   => '</h2>',
    ));
    
    register_sidebar(array(
        'name'          => __('Footer Widget Area', 'webqx'),
        'id'            => 'footer-1',
        'description'   => __('Add widgets here to appear in your footer.', 'webqx'),
        'before_widget' => '<div class="footer-widget %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h3 class="widget-title">',
        'after_title'   => '</h3>',
    ));
}
add_action('widgets_init', 'webqx_widgets_init');

// WebQX Healthcare Module Functions
function webqx_display_healthcare_modules() {
    ?>
    <div class="webqx-healthcare-modules">
        <div class="webqx-patient-portal">
            <h2><?php _e('Patient Portal', 'webqx'); ?></h2>
            <p><?php _e('Access your medical records, schedule appointments, and communicate with your healthcare providers.', 'webqx'); ?></p>
            <?php echo do_shortcode('[webqx_patient_portal]'); ?>
        </div>
        
        <div class="webqx-provider-panel">
            <h2><?php _e('Provider Panel', 'webqx'); ?></h2>
            <p><?php _e('Comprehensive EHR management, clinical decision support, and patient communication tools.', 'webqx'); ?></p>
            <?php echo do_shortcode('[webqx_provider_panel]'); ?>
        </div>
        
        <div class="webqx-specialties-grid">
            <h2><?php _e('Medical Specialties', 'webqx'); ?></h2>
            <?php webqx_display_specialty_cards(); ?>
        </div>
    </div>
    <?php
}

// Display specialty cards
function webqx_display_specialty_cards() {
    $specialties = webqx_get_supported_specialties();
    
    if (!empty($specialties)) {
        echo '<div class="webqx-specialties-container">';
        foreach ($specialties as $specialty) {
            ?>
            <div class="webqx-specialty-card">
                <h3><?php echo esc_html($specialty['name']); ?></h3>
                <p><?php echo esc_html($specialty['description']); ?></p>
                <a href="<?php echo esc_url($specialty['url']); ?>" class="btn">
                    <?php _e('Learn More', 'webqx'); ?>
                </a>
            </div>
            <?php
        }
        echo '</div>';
    }
}

// Get supported medical specialties
function webqx_get_supported_specialties() {
    return array(
        array(
            'name' => __('Primary Care', 'webqx'),
            'description' => __('Comprehensive primary healthcare services and preventive care.', 'webqx'),
            'url' => home_url('/specialty/primary-care'),
        ),
        array(
            'name' => __('Radiology', 'webqx'),
            'description' => __('Advanced imaging services with PACS integration.', 'webqx'),
            'url' => home_url('/specialty/radiology'),
        ),
        array(
            'name' => __('Cardiology', 'webqx'),
            'description' => __('Specialized cardiovascular care and monitoring.', 'webqx'),
            'url' => home_url('/specialty/cardiology'),
        ),
        array(
            'name' => __('Pediatrics', 'webqx'),
            'description' => __('Comprehensive healthcare for children and adolescents.', 'webqx'),
            'url' => home_url('/specialty/pediatrics'),
        ),
        array(
            'name' => __('Oncology', 'webqx'),
            'description' => __('Cancer care with multidisciplinary treatment approaches.', 'webqx'),
            'url' => home_url('/specialty/oncology'),
        ),
        array(
            'name' => __('Psychiatry', 'webqx'),
            'description' => __('Mental health services and therapeutic support.', 'webqx'),
            'url' => home_url('/specialty/psychiatry'),
        ),
    );
}

// Get WebQX API base URL from settings or environment
function get_webqx_api_base_url() {
    $api_url = get_option('webqx_api_base_url', 'http://localhost:3000');
    
    // Allow override via environment variable (for Docker/Railway deployments)
    if (defined('WEBQX_API_URL')) {
        $api_url = WEBQX_API_URL;
    } elseif (getenv('WEBQX_API_URL')) {
        $api_url = getenv('WEBQX_API_URL');
    }
    
    return rtrim($api_url, '/');
}

// AJAX handler for WebQX API calls
function webqx_ajax_api_call() {
    check_ajax_referer('webqx_nonce', 'nonce');
    
    $endpoint = sanitize_text_field($_POST['endpoint']);
    $method = sanitize_text_field($_POST['method']) ?: 'GET';
    $data = $_POST['data'] ? json_decode(stripslashes($_POST['data']), true) : null;
    
    $api_url = get_webqx_api_base_url() . '/' . ltrim($endpoint, '/');
    
    $args = array(
        'method' => $method,
        'headers' => array(
            'Content-Type' => 'application/json',
        ),
        'timeout' => 30,
    );
    
    if ($data && in_array($method, array('POST', 'PUT', 'PATCH'))) {
        $args['body'] = json_encode($data);
    }
    
    $response = wp_remote_request($api_url, $args);
    
    if (is_wp_error($response)) {
        wp_die(json_encode(array(
            'success' => false,
            'error' => $response->get_error_message(),
        )));
    }
    
    $body = wp_remote_retrieve_body($response);
    $status_code = wp_remote_retrieve_response_code($response);
    
    wp_die(json_encode(array(
        'success' => $status_code >= 200 && $status_code < 300,
        'status_code' => $status_code,
        'data' => json_decode($body, true),
    )));
}
add_action('wp_ajax_webqx_api_call', 'webqx_ajax_api_call');
add_action('wp_ajax_nopriv_webqx_api_call', 'webqx_ajax_api_call');

// Add WebQX admin settings page
function webqx_add_admin_menu() {
    add_options_page(
        __('WebQX Settings', 'webqx'),
        __('WebQX Settings', 'webqx'),
        'manage_options',
        'webqx-settings',
        'webqx_settings_page'
    );
}
add_action('admin_menu', 'webqx_add_admin_menu');

// WebQX settings page
function webqx_settings_page() {
    if (isset($_POST['submit'])) {
        update_option('webqx_api_base_url', sanitize_url($_POST['webqx_api_base_url']));
        update_option('webqx_enable_fhir', isset($_POST['webqx_enable_fhir']));
        update_option('webqx_default_language', sanitize_text_field($_POST['webqx_default_language']));
        echo '<div class="notice notice-success"><p>' . __('Settings saved!', 'webqx') . '</p></div>';
    }
    
    $api_url = get_option('webqx_api_base_url', 'http://localhost:3000');
    $enable_fhir = get_option('webqx_enable_fhir', true);
    $default_language = get_option('webqx_default_language', 'en');
    ?>
    <div class="wrap">
        <h1><?php _e('WebQX Settings', 'webqx'); ?></h1>
        <form method="post" action="">
            <table class="form-table">
                <tr>
                    <th scope="row"><?php _e('API Base URL', 'webqx'); ?></th>
                    <td>
                        <input type="url" name="webqx_api_base_url" value="<?php echo esc_attr($api_url); ?>" class="regular-text" />
                        <p class="description"><?php _e('The base URL for the WebQX API backend.', 'webqx'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e('Enable FHIR Integration', 'webqx'); ?></th>
                    <td>
                        <input type="checkbox" name="webqx_enable_fhir" value="1" <?php checked($enable_fhir); ?> />
                        <p class="description"><?php _e('Enable FHIR R4 integration for healthcare data exchange.', 'webqx'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e('Default Language', 'webqx'); ?></th>
                    <td>
                        <select name="webqx_default_language">
                            <option value="en" <?php selected($default_language, 'en'); ?>>English</option>
                            <option value="es" <?php selected($default_language, 'es'); ?>>Español</option>
                            <option value="fr" <?php selected($default_language, 'fr'); ?>>Français</option>
                            <option value="de" <?php selected($default_language, 'de'); ?>>Deutsch</option>
                        </select>
                        <p class="description"><?php _e('Default language for WebQX interface.', 'webqx'); ?></p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

// Add body classes for WebQX functionality
function webqx_body_classes($classes) {
    if (is_front_page()) {
        $classes[] = 'webqx-portal-page';
    }
    
    if (get_option('webqx_enable_fhir')) {
        $classes[] = 'webqx-fhir-enabled';
    }
    
    return $classes;
}
add_filter('body_class', 'webqx_body_classes');

// Load textdomain for translations
function webqx_load_textdomain() {
    load_theme_textdomain('webqx', get_template_directory() . '/languages');
}
add_action('after_setup_theme', 'webqx_load_textdomain');
?>