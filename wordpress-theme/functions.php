<?php
/**
 * WebQx Healthcare Theme functions and definitions
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Theme version
 */
define('WEBQX_HEALTHCARE_VERSION', '1.0.0');

/**
 * Sets up theme defaults and registers support for various WordPress features.
 */
function webqx_healthcare_setup() {
    // Make theme available for translation
    load_theme_textdomain('webqx-healthcare', get_template_directory() . '/languages');

    // Add default posts and comments RSS feed links to head
    add_theme_support('automatic-feed-links');

    // Let WordPress manage the document title
    add_theme_support('title-tag');

    // Enable support for Post Thumbnails on posts and pages
    add_theme_support('post-thumbnails');

    // Set default thumbnail size
    set_post_thumbnail_size(300, 200, true);

    // Add additional image sizes
    add_image_size('webqx-large', 800, 400, true);
    add_image_size('webqx-medium', 400, 300, true);

    // Register navigation menus
    register_nav_menus(array(
        'primary' => __('Primary Menu', 'webqx-healthcare'),
        'footer' => __('Footer Menu', 'webqx-healthcare'),
    ));

    // Switch default core markup to output valid HTML5
    add_theme_support('html5', array(
        'search-form',
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
        'style',
        'script',
    ));

    // Add theme support for selective refresh for widgets
    add_theme_support('customize-selective-refresh-widgets');

    // Add support for core custom background feature
    add_theme_support('custom-background', array(
        'default-color' => 'f8f9fa',
        'default-image' => '',
    ));

    // Add support for custom header
    add_theme_support('custom-header', array(
        'default-image' => '',
        'width' => 1200,
        'height' => 300,
        'flex-height' => true,
        'flex-width' => true,
        'header-text' => true,
        'default-text-color' => '2c5aa0',
    ));

    // Add support for custom logo
    add_theme_support('custom-logo', array(
        'height' => 60,
        'width' => 200,
        'flex-width' => true,
        'flex-height' => true,
    ));

    // Add support for editor styles
    add_theme_support('editor-styles');
    add_editor_style('assets/css/editor-style.css');

    // Add support for responsive embedded content
    add_theme_support('responsive-embeds');

    // Add support for block editor wide and full alignments
    add_theme_support('align-wide');

    // Add support for custom line height controls
    add_theme_support('custom-line-height');

    // Add support for experimental link color controls
    add_theme_support('experimental-link-color');
}
add_action('after_setup_theme', 'webqx_healthcare_setup');

/**
 * Set the content width in pixels, based on the theme's design and stylesheet.
 */
function webqx_healthcare_content_width() {
    $GLOBALS['content_width'] = apply_filters('webqx_healthcare_content_width', 800);
}
add_action('after_setup_theme', 'webqx_healthcare_content_width', 0);

/**
 * Register widget areas
 */
function webqx_healthcare_widgets_init() {
    register_sidebar(array(
        'name' => __('Primary Sidebar', 'webqx-healthcare'),
        'id' => 'sidebar-1',
        'description' => __('Add widgets here to appear in your primary sidebar.', 'webqx-healthcare'),
        'before_widget' => '<section id="%1$s" class="widget %2$s">',
        'after_widget' => '</section>',
        'before_title' => '<h3 class="widget-title">',
        'after_title' => '</h3>',
    ));

    register_sidebar(array(
        'name' => __('Footer Widget Area 1', 'webqx-healthcare'),
        'id' => 'footer-1',
        'description' => __('Add widgets here to appear in the first footer column.', 'webqx-healthcare'),
        'before_widget' => '<section id="%1$s" class="footer-widget %2$s">',
        'after_widget' => '</section>',
        'before_title' => '<h3 class="widget-title">',
        'after_title' => '</h3>',
    ));

    register_sidebar(array(
        'name' => __('Footer Widget Area 2', 'webqx-healthcare'),
        'id' => 'footer-2',
        'description' => __('Add widgets here to appear in the second footer column.', 'webqx-healthcare'),
        'before_widget' => '<section id="%1$s" class="footer-widget %2$s">',
        'after_widget' => '</section>',
        'before_title' => '<h3 class="widget-title">',
        'after_title' => '</h3>',
    ));

    register_sidebar(array(
        'name' => __('Footer Widget Area 3', 'webqx-healthcare'),
        'id' => 'footer-3',
        'description' => __('Add widgets here to appear in the third footer column.', 'webqx-healthcare'),
        'before_widget' => '<section id="%1$s" class="footer-widget %2$s">',
        'after_widget' => '</section>',
        'before_title' => '<h3 class="widget-title">',
        'after_title' => '</h3>',
    ));
}
add_action('widgets_init', 'webqx_healthcare_widgets_init');

/**
 * Enqueue scripts and styles
 */
function webqx_healthcare_scripts() {
    // Enqueue main stylesheet
    wp_enqueue_style('webqx-healthcare-style', get_stylesheet_uri(), array(), WEBQX_HEALTHCARE_VERSION);

    // Enqueue Google Fonts
    wp_enqueue_style('webqx-healthcare-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap', array(), null);

    // Enqueue main JavaScript file
    wp_enqueue_script('webqx-healthcare-script', get_template_directory_uri() . '/assets/js/main.js', array('jquery'), WEBQX_HEALTHCARE_VERSION, true);

    // Enqueue comment reply script
    if (is_singular() && comments_open() && get_option('thread_comments')) {
        wp_enqueue_script('comment-reply');
    }

    // Localize script for AJAX
    wp_localize_script('webqx-healthcare-script', 'webqx_ajax', array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('webqx_nonce'),
    ));
}
add_action('wp_enqueue_scripts', 'webqx_healthcare_scripts');

/**
 * Add customizer support
 */
function webqx_healthcare_customize_register($wp_customize) {
    // Add Healthcare Options Panel
    $wp_customize->add_panel('webqx_healthcare_options', array(
        'title' => __('Healthcare Options', 'webqx-healthcare'),
        'description' => __('Customize healthcare-specific settings', 'webqx-healthcare'),
        'priority' => 30,
    ));

    // Add Theme Colors Section
    $wp_customize->add_section('webqx_colors', array(
        'title' => __('Theme Colors', 'webqx-healthcare'),
        'panel' => 'webqx_healthcare_options',
        'priority' => 10,
    ));

    // Primary Color Setting
    $wp_customize->add_setting('webqx_primary_color', array(
        'default' => '#2c5aa0',
        'sanitize_callback' => 'sanitize_hex_color',
        'transport' => 'refresh',
    ));

    $wp_customize->add_control(new WP_Customize_Color_Control($wp_customize, 'webqx_primary_color', array(
        'label' => __('Primary Color', 'webqx-healthcare'),
        'section' => 'webqx_colors',
        'settings' => 'webqx_primary_color',
    )));

    // Add Contact Information Section
    $wp_customize->add_section('webqx_contact', array(
        'title' => __('Contact Information', 'webqx-healthcare'),
        'panel' => 'webqx_healthcare_options',
        'priority' => 20,
    ));

    // Phone Number Setting
    $wp_customize->add_setting('webqx_phone', array(
        'default' => '',
        'sanitize_callback' => 'sanitize_text_field',
    ));

    $wp_customize->add_control('webqx_phone', array(
        'label' => __('Phone Number', 'webqx-healthcare'),
        'section' => 'webqx_contact',
        'type' => 'text',
    ));

    // Email Setting
    $wp_customize->add_setting('webqx_email', array(
        'default' => '',
        'sanitize_callback' => 'sanitize_email',
    ));

    $wp_customize->add_control('webqx_email', array(
        'label' => __('Email Address', 'webqx-healthcare'),
        'section' => 'webqx_contact',
        'type' => 'email',
    ));

    // Address Setting
    $wp_customize->add_setting('webqx_address', array(
        'default' => '',
        'sanitize_callback' => 'sanitize_textarea_field',
    ));

    $wp_customize->add_control('webqx_address', array(
        'label' => __('Address', 'webqx-healthcare'),
        'section' => 'webqx_contact',
        'type' => 'textarea',
    ));
}
add_action('customize_register', 'webqx_healthcare_customize_register');

/**
 * Custom excerpt length
 */
function webqx_healthcare_excerpt_length($length) {
    return 25;
}
add_filter('excerpt_length', 'webqx_healthcare_excerpt_length');

/**
 * Custom excerpt more string
 */
function webqx_healthcare_excerpt_more($more) {
    return '... <a href="' . get_permalink() . '" class="read-more">' . __('Read More', 'webqx-healthcare') . '</a>';
}
add_filter('excerpt_more', 'webqx_healthcare_excerpt_more');

/**
 * Add healthcare-specific body classes
 */
function webqx_healthcare_body_classes($classes) {
    // Add class for healthcare theme
    $classes[] = 'webqx-healthcare-theme';
    
    // Add class based on page type
    if (is_page()) {
        global $post;
        $classes[] = 'page-' . $post->post_name;
    }
    
    return $classes;
}
add_filter('body_class', 'webqx_healthcare_body_classes');

/**
 * Add custom meta boxes for healthcare-specific content
 */
function webqx_healthcare_add_meta_boxes() {
    add_meta_box(
        'webqx_healthcare_info',
        __('Healthcare Information', 'webqx-healthcare'),
        'webqx_healthcare_meta_box_callback',
        array('post', 'page'),
        'normal',
        'default'
    );
}
add_action('add_meta_boxes', 'webqx_healthcare_add_meta_boxes');

/**
 * Meta box callback function
 */
function webqx_healthcare_meta_box_callback($post) {
    wp_nonce_field('webqx_healthcare_meta_box', 'webqx_healthcare_meta_box_nonce');
    
    $medical_disclaimer = get_post_meta($post->ID, '_webqx_medical_disclaimer', true);
    $healthcare_category = get_post_meta($post->ID, '_webqx_healthcare_category', true);
    
    echo '<table class="form-table">';
    echo '<tr>';
    echo '<th><label for="webqx_healthcare_category">' . __('Healthcare Category', 'webqx-healthcare') . '</label></th>';
    echo '<td>';
    echo '<select id="webqx_healthcare_category" name="webqx_healthcare_category">';
    echo '<option value="">' . __('Select Category', 'webqx-healthcare') . '</option>';
    $categories = array(
        'primary-care' => __('Primary Care', 'webqx-healthcare'),
        'pediatrics' => __('Pediatrics', 'webqx-healthcare'),
        'cardiology' => __('Cardiology', 'webqx-healthcare'),
        'psychiatry' => __('Psychiatry', 'webqx-healthcare'),
        'radiology' => __('Radiology', 'webqx-healthcare'),
        'oncology' => __('Oncology', 'webqx-healthcare'),
    );
    foreach ($categories as $value => $label) {
        echo '<option value="' . esc_attr($value) . '"' . selected($healthcare_category, $value, false) . '>' . esc_html($label) . '</option>';
    }
    echo '</select>';
    echo '</td>';
    echo '</tr>';
    echo '<tr>';
    echo '<th><label for="webqx_medical_disclaimer">' . __('Medical Disclaimer', 'webqx-healthcare') . '</label></th>';
    echo '<td>';
    echo '<input type="checkbox" id="webqx_medical_disclaimer" name="webqx_medical_disclaimer" value="1"' . checked($medical_disclaimer, 1, false) . '>';
    echo '<label for="webqx_medical_disclaimer">' . __('This content requires a medical disclaimer', 'webqx-healthcare') . '</label>';
    echo '</td>';
    echo '</tr>';
    echo '</table>';
}

/**
 * Save meta box data
 */
function webqx_healthcare_save_meta_box($post_id) {
    if (!isset($_POST['webqx_healthcare_meta_box_nonce'])) {
        return;
    }
    
    if (!wp_verify_nonce($_POST['webqx_healthcare_meta_box_nonce'], 'webqx_healthcare_meta_box')) {
        return;
    }
    
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }
    
    if (isset($_POST['webqx_healthcare_category'])) {
        update_post_meta($post_id, '_webqx_healthcare_category', sanitize_text_field($_POST['webqx_healthcare_category']));
    }
    
    if (isset($_POST['webqx_medical_disclaimer'])) {
        update_post_meta($post_id, '_webqx_medical_disclaimer', 1);
    } else {
        delete_post_meta($post_id, '_webqx_medical_disclaimer');
    }
}
add_action('save_post', 'webqx_healthcare_save_meta_box');

/**
 * Security and HIPAA compliance helpers
 */
function webqx_healthcare_security_headers() {
    if (!is_admin()) {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('X-XSS-Protection: 1; mode=block');
    }
}
add_action('send_headers', 'webqx_healthcare_security_headers');

/**
 * Disable file editing in admin for security
 */
if (!defined('DISALLOW_FILE_EDIT')) {
    define('DISALLOW_FILE_EDIT', true);
}

/**
 * Custom walker for navigation menus with accessibility improvements
 */
class WebQx_Walker_Nav_Menu extends Walker_Nav_Menu {
    public function start_lvl(&$output, $depth = 0, $args = null) {
        $indent = str_repeat("\t", $depth);
        $output .= "\n$indent<ul class=\"sub-menu\">\n";
    }
    
    public function start_el(&$output, $item, $depth = 0, $args = null, $id = 0) {
        $classes = empty($item->classes) ? array() : (array) $item->classes;
        $classes[] = 'menu-item-' . $item->ID;
        
        $class_names = join(' ', apply_filters('nav_menu_css_class', array_filter($classes), $item, $args));
        $class_names = $class_names ? ' class="' . esc_attr($class_names) . '"' : '';
        
        $id = apply_filters('nav_menu_item_id', 'menu-item-' . $item->ID, $item, $args);
        $id = $id ? ' id="' . esc_attr($id) . '"' : '';
        
        $output .= '<li' . $id . $class_names . '>';
        
        $attributes = !empty($item->attr_title) ? ' title="' . esc_attr($item->attr_title) . '"' : '';
        $attributes .= !empty($item->target) ? ' target="' . esc_attr($item->target) . '"' : '';
        $attributes .= !empty($item->xfn) ? ' rel="' . esc_attr($item->xfn) . '"' : '';
        $attributes .= !empty($item->url) ? ' href="' . esc_attr($item->url) . '"' : '';
        
        $item_output = isset($args->before) ? $args->before : '';
        $item_output .= '<a' . $attributes . '>';
        $item_output .= (isset($args->link_before) ? $args->link_before : '') . apply_filters('the_title', $item->title, $item->ID) . (isset($args->link_after) ? $args->link_after : '');
        $item_output .= '</a>';
        $item_output .= isset($args->after) ? $args->after : '';
        
        $output .= apply_filters('walker_nav_menu_start_el', $item_output, $item, $depth, $args);
    }
}
?>