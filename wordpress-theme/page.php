<?php
/**
 * The template for displaying all pages
 *
 * This is the template that displays all pages by default.
 * Please note that this is the WordPress construct of pages
 * and that other 'pages' on your WordPress site may use a
 * different template.
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

get_header();
?>

<main id="primary" class="site-main">
    <section class="content-area">
        <?php
        while (have_posts()) :
            the_post();
            ?>
            <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
                <header class="entry-header">
                    <?php the_title('<h1 class="entry-title">', '</h1>'); ?>
                    
                    <?php
                    // Display healthcare category if set
                    $healthcare_category = get_post_meta(get_the_ID(), '_webqx_healthcare_category', true);
                    if ($healthcare_category) :
                        $categories = array(
                            'primary-care' => __('Primary Care', 'webqx-healthcare'),
                            'pediatrics' => __('Pediatrics', 'webqx-healthcare'),
                            'cardiology' => __('Cardiology', 'webqx-healthcare'),
                            'psychiatry' => __('Psychiatry', 'webqx-healthcare'),
                            'radiology' => __('Radiology', 'webqx-healthcare'),
                            'oncology' => __('Oncology', 'webqx-healthcare'),
                        );
                        
                        if (isset($categories[$healthcare_category])) :
                            ?>
                            <div class="healthcare-category">
                                <span class="category-label"><?php echo esc_html($categories[$healthcare_category]); ?></span>
                            </div>
                            <?php
                        endif;
                    endif;
                    ?>
                </header><!-- .entry-header -->

                <?php if (has_post_thumbnail()) : ?>
                    <div class="entry-thumbnail">
                        <?php the_post_thumbnail('webqx-large', array('alt' => get_the_title())); ?>
                    </div>
                <?php endif; ?>

                <div class="entry-content">
                    <?php
                    the_content();

                    wp_link_pages(array(
                        'before' => '<div class="page-links">' . esc_html__('Pages:', 'webqx-healthcare'),
                        'after' => '</div>',
                    ));
                    ?>
                </div><!-- .entry-content -->

                <?php if (get_edit_post_link()) : ?>
                    <footer class="entry-footer">
                        <?php
                        edit_post_link(
                            sprintf(
                                wp_kses(
                                    /* translators: %s: Name of current post. Only visible to screen readers */
                                    __('Edit <span class="screen-reader-text">%s</span>', 'webqx-healthcare'),
                                    array(
                                        'span' => array(
                                            'class' => array(),
                                        ),
                                    )
                                ),
                                wp_kses_post(get_the_title())
                            ),
                            '<span class="edit-link">',
                            '</span>'
                        );
                        ?>
                    </footer><!-- .entry-footer -->
                <?php endif; ?>
            </article><!-- #post-<?php the_ID(); ?> -->

            <?php
            // If comments are open or we have at least one comment, load up the comment template.
            if (comments_open() || get_comments_number()) :
                comments_template();
            endif;

        endwhile; // End of the loop.
        ?>
    </section>

    <?php get_sidebar(); ?>
</main><!-- #main -->

<?php
get_footer();
?>