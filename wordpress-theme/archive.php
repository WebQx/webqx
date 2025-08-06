<?php
/**
 * The template for displaying archive pages
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

get_header();
?>

<main id="primary" class="site-main">
    <section class="content-area">
        <?php if (have_posts()) : ?>
            <header class="page-header">
                <?php
                the_archive_title('<h1 class="page-title">', '</h1>');
                the_archive_description('<div class="archive-description">', '</div>');
                ?>
                
                <div class="archive-meta">
                    <?php
                    global $wp_query;
                    $total_posts = $wp_query->found_posts;
                    
                    if ($total_posts > 0) :
                        printf(
                            /* translators: %d: number of posts in archive. */
                            esc_html(_n('%d article found', '%d articles found', $total_posts, 'webqx-healthcare')),
                            $total_posts
                        );
                    endif;
                    ?>
                </div>
            </header><!-- .page-header -->

            <div class="archive-posts">
                <?php
                // Start the Loop.
                while (have_posts()) :
                    the_post();
                    
                    /*
                     * Include the Post-Type-specific template for the content.
                     * If you want to override this in a child theme, then include a file
                     * called content-___.php (where ___ is the Post Type name) and that will be used instead.
                     */
                    get_template_part('template-parts/content', get_post_type());

                endwhile;
            </div><!-- .archive-posts -->

            <?php
            // Display pagination
            the_posts_navigation(array(
                'prev_text' => __('← Older articles', 'webqx-healthcare'),
                'next_text' => __('Newer articles →', 'webqx-healthcare'),
            ));

        else :
            ?>
            <header class="page-header">
                <h1 class="page-title"><?php esc_html_e('No articles found', 'webqx-healthcare'); ?></h1>
            </header>
            
            <?php get_template_part('template-parts/content', 'none'); ?>
            <?php
        endif;
        ?>
    </section>

    <?php get_sidebar(); ?>
</main><!-- #main -->

<style>
/* Archive page specific styles */
.archive-description {
    font-size: 1.1rem;
    color: #666;
    margin-top: 1rem;
    line-height: 1.6;
}

.archive-meta {
    color: #666;
    font-style: italic;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e9ecef;
}

.archive-posts {
    margin-top: 2rem;
}

.archive-posts article {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #e9ecef;
}

.archive-posts article:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
}

/* Healthcare category archives styling */
.category-primary-care .page-header {
    background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
    padding: 2rem;
    border-radius: 8px;
    border-left: 4px solid #2c5aa0;
}

.category-pediatrics .page-header {
    background: linear-gradient(135deg, #fff3e0 0%, #f3e5f5 100%);
    padding: 2rem;
    border-radius: 8px;
    border-left: 4px solid #ff9800;
}

.category-cardiology .page-header {
    background: linear-gradient(135deg, #ffebee 0%, #f3e5f5 100%);
    padding: 2rem;
    border-radius: 8px;
    border-left: 4px solid #f44336;
}

.category-psychiatry .page-header {
    background: linear-gradient(135deg, #f3e5f5 0%, #e8f5e8 100%);
    padding: 2rem;
    border-radius: 8px;
    border-left: 4px solid #9c27b0;
}

.category-radiology .page-header {
    background: linear-gradient(135deg, #e0f2f1 0%, #f3e5f5 100%);
    padding: 2rem;
    border-radius: 8px;
    border-left: 4px solid #009688;
}

.category-oncology .page-header {
    background: linear-gradient(135deg, #fce4ec 0%, #f3e5f5 100%);
    padding: 2rem;
    border-radius: 8px;
    border-left: 4px solid #e91e63;
}
</style>

<?php
get_footer();
?>