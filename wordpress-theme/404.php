<?php
/**
 * The template for displaying 404 pages (not found)
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

get_header();
?>

<main id="primary" class="site-main">
    <section class="error-404 not-found">
        <header class="page-header">
            <h1 class="page-title"><?php esc_html_e('Page Not Found', 'webqx-healthcare'); ?></h1>
        </header><!-- .page-header -->

        <div class="page-content">
            <div class="error-content healthcare-highlight">
                <h2><?php esc_html_e('We\'re sorry, but the page you\'re looking for doesn\'t exist.', 'webqx-healthcare'); ?></h2>
                <p><?php esc_html_e('This might be because:', 'webqx-healthcare'); ?></p>
                <ul>
                    <li><?php esc_html_e('The page has been moved or deleted', 'webqx-healthcare'); ?></li>
                    <li><?php esc_html_e('You entered an incorrect URL', 'webqx-healthcare'); ?></li>
                    <li><?php esc_html_e('The link you clicked is broken or outdated', 'webqx-healthcare'); ?></li>
                </ul>
            </div>

            <div class="error-search">
                <h3><?php esc_html_e('Search for Healthcare Information', 'webqx-healthcare'); ?></h3>
                <?php get_search_form(); ?>
            </div>

            <div class="helpful-links">
                <h3><?php esc_html_e('Helpful Links', 'webqx-healthcare'); ?></h3>
                <div class="link-grid">
                    <div class="link-column">
                        <h4><?php esc_html_e('Patient Services', 'webqx-healthcare'); ?></h4>
                        <ul>
                            <li><a href="<?php echo esc_url(home_url('/')); ?>"><?php esc_html_e('Home', 'webqx-healthcare'); ?></a></li>
                            <li><a href="<?php echo esc_url(home_url('/appointments')); ?>"><?php esc_html_e('Schedule Appointment', 'webqx-healthcare'); ?></a></li>
                            <li><a href="<?php echo esc_url(home_url('/patient-portal')); ?>"><?php esc_html_e('Patient Portal', 'webqx-healthcare'); ?></a></li>
                            <li><a href="<?php echo esc_url(home_url('/services')); ?>"><?php esc_html_e('Our Services', 'webqx-healthcare'); ?></a></li>
                        </ul>
                    </div>
                    
                    <div class="link-column">
                        <h4><?php esc_html_e('Information', 'webqx-healthcare'); ?></h4>
                        <ul>
                            <li><a href="<?php echo esc_url(home_url('/about')); ?>"><?php esc_html_e('About Us', 'webqx-healthcare'); ?></a></li>
                            <li><a href="<?php echo esc_url(home_url('/providers')); ?>"><?php esc_html_e('Our Providers', 'webqx-healthcare'); ?></a></li>
                            <li><a href="<?php echo esc_url(home_url('/contact')); ?>"><?php esc_html_e('Contact Us', 'webqx-healthcare'); ?></a></li>
                            <li><a href="<?php echo esc_url(home_url('/faq')); ?>"><?php esc_html_e('FAQ', 'webqx-healthcare'); ?></a></li>
                        </ul>
                    </div>
                    
                    <div class="link-column">
                        <h4><?php esc_html_e('Recent Health Articles', 'webqx-healthcare'); ?></h4>
                        <?php
                        $recent_posts = new WP_Query(array(
                            'posts_per_page' => 4,
                            'post_status' => 'publish'
                        ));

                        if ($recent_posts->have_posts()) :
                            echo '<ul>';
                            while ($recent_posts->have_posts()) :
                                $recent_posts->the_post();
                                ?>
                                <li><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></li>
                                <?php
                            endwhile;
                            echo '</ul>';
                            wp_reset_postdata();
                        endif;
                        ?>
                    </div>
                </div>
            </div>

            <div class="emergency-info healthcare-highlight">
                <h3><?php esc_html_e('Need Immediate Medical Attention?', 'webqx-healthcare'); ?></h3>
                <div class="emergency-contacts">
                    <div class="emergency-item">
                        <strong><?php esc_html_e('Emergency:', 'webqx-healthcare'); ?></strong>
                        <a href="tel:911" class="emergency-number">911</a>
                    </div>
                    <div class="emergency-item">
                        <strong><?php esc_html_e('Poison Control:', 'webqx-healthcare'); ?></strong>
                        <a href="tel:1-800-222-1222">1-800-222-1222</a>
                    </div>
                    <div class="emergency-item">
                        <strong><?php esc_html_e('Crisis Hotline:', 'webqx-healthcare'); ?></strong>
                        <a href="tel:988">988</a>
                    </div>
                    <?php
                    $phone = get_theme_mod('webqx_phone');
                    if ($phone) :
                        ?>
                        <div class="emergency-item">
                            <strong><?php esc_html_e('Our Office:', 'webqx-healthcare'); ?></strong>
                            <a href="tel:<?php echo esc_attr(str_replace(array(' ', '-', '(', ')'), '', $phone)); ?>">
                                <?php echo esc_html($phone); ?>
                            </a>
                        </div>
                        <?php
                    endif;
                    ?>
                </div>
            </div>
        </div><!-- .page-content -->
    </section><!-- .error-404 -->
</main><!-- #main -->

<style>
/* 404 Page Specific Styles */
.error-404 {
    text-align: left;
    padding: 2rem;
}

.error-content {
    margin-bottom: 2rem;
}

.error-content ul {
    padding-left: 1.5rem;
    margin: 1rem 0;
}

.error-search {
    background: #fff;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin-bottom: 2rem;
}

.helpful-links {
    margin-bottom: 2rem;
}

.link-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    margin-top: 1rem;
}

.link-column {
    background: #fff;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.link-column h4 {
    color: #2c5aa0;
    margin-bottom: 1rem;
    font-size: 1.1rem;
}

.link-column ul {
    list-style: none;
    padding: 0;
}

.link-column ul li {
    padding: 0.25rem 0;
    border-bottom: 1px solid #f1f3f4;
}

.link-column ul li:last-child {
    border-bottom: none;
}

.link-column a {
    color: #333;
    text-decoration: none;
    transition: color 0.3s ease;
}

.link-column a:hover {
    color: #2c5aa0;
}

.emergency-info {
    margin-top: 2rem;
}

.emergency-contacts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
}

.emergency-item {
    text-align: center;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 4px;
}

.emergency-number {
    font-size: 1.5rem;
    font-weight: bold;
    color: #d73502;
    text-decoration: none;
    display: block;
    margin-top: 0.5rem;
}

.emergency-item a {
    color: #2c5aa0;
    text-decoration: none;
    font-weight: 600;
    display: block;
    margin-top: 0.5rem;
}

.emergency-item a:hover {
    text-decoration: underline;
}

@media (max-width: 768px) {
    .link-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
    }
    
    .emergency-contacts {
        grid-template-columns: 1fr;
    }
}
</style>

<?php
get_footer();
?>