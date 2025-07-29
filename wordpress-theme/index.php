<?php
/**
 * The main template file for the WebQX Healthcare Platform theme
 *
 * This is the most generic template file in a WordPress theme
 * and one of the two required files for a theme (the other being style.css).
 *
 * @package WebQX_Healthcare_Platform
 * @since 1.0.0
 */

get_header(); ?>

<div class="container">
    <main id="main" class="site-main">
        
        <?php if (have_posts()) : ?>
            
            <?php if (is_home() && !is_front_page()) : ?>
                <header class="entry-header">
                    <h1 class="entry-title"><?php single_post_title(); ?></h1>
                </header>
            <?php endif; ?>

            <?php
            // Start the Loop
            while (have_posts()) :
                the_post();
                
                if (is_singular()) :
                    get_template_part('template-parts/content', 'single');
                else :
                    get_template_part('template-parts/content', get_post_type());
                endif;
                
            endwhile;
            
            // Previous/next page navigation
            the_posts_navigation();
            
        else :
            
            get_template_part('template-parts/content', 'none');
            
        endif;
        ?>

        <?php
        // Display WebQX modules if on front page
        if (is_front_page() || is_page_template('page-webqx-portal.php')) :
            webqx_display_healthcare_modules();
        endif;
        ?>

    </main><!-- #main -->
</div><!-- .container -->

<?php
get_sidebar();
get_footer();
?>