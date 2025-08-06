<?php
/**
 * The template for displaying all single posts
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
                    <?php
                    the_title('<h1 class="entry-title">', '</h1>');

                    if ('post' === get_post_type()) :
                        ?>
                        <div class="entry-meta">
                            <?php
                            webqx_healthcare_posted_on();
                            webqx_healthcare_posted_by();
                            ?>
                        </div><!-- .entry-meta -->
                        <?php
                    endif;
                    
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
                    the_content(sprintf(
                        wp_kses(
                            /* translators: %s: Name of current post. */
                            __('Continue reading<span class="screen-reader-text"> "%s"</span>', 'webqx-healthcare'),
                            array(
                                'span' => array(
                                    'class' => array(),
                                ),
                            )
                        ),
                        wp_kses_post(get_the_title())
                    ));

                    wp_link_pages(array(
                        'before' => '<div class="page-links">' . esc_html__('Pages:', 'webqx-healthcare'),
                        'after' => '</div>',
                    ));
                    ?>
                </div><!-- .entry-content -->

                <footer class="entry-footer">
                    <?php webqx_healthcare_entry_footer(); ?>
                </footer><!-- .entry-footer -->
            </article><!-- #post-<?php the_ID(); ?> -->

            <nav class="post-navigation" aria-label="<?php esc_attr_e('Post navigation', 'webqx-healthcare'); ?>">
                <?php
                the_post_navigation(array(
                    'prev_text' => '<span class="nav-subtitle">' . esc_html__('Previous:', 'webqx-healthcare') . '</span> <span class="nav-title">%title</span>',
                    'next_text' => '<span class="nav-subtitle">' . esc_html__('Next:', 'webqx-healthcare') . '</span> <span class="nav-title">%title</span>',
                ));
                ?>
            </nav>

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

/**
 * Prints HTML with meta information for the current post-date/time.
 */
function webqx_healthcare_posted_on() {
    $time_string = '<time class="entry-date published updated" datetime="%1$s">%2$s</time>';
    if (get_the_time('U') !== get_the_modified_time('U')) {
        $time_string = '<time class="entry-date published" datetime="%1$s">%2$s</time><time class="updated" datetime="%3$s">%4$s</time>';
    }

    $time_string = sprintf(
        $time_string,
        esc_attr(get_the_date(DATE_W3C)),
        esc_html(get_the_date()),
        esc_attr(get_the_modified_date(DATE_W3C)),
        esc_html(get_the_modified_date())
    );

    $posted_on = sprintf(
        /* translators: %s: post date. */
        esc_html_x('Posted on %s', 'post date', 'webqx-healthcare'),
        '<a href="' . esc_url(get_permalink()) . '" rel="bookmark">' . $time_string . '</a>'
    );

    echo '<span class="posted-on">' . $posted_on . '</span>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}

/**
 * Prints HTML with meta information for the current author.
 */
function webqx_healthcare_posted_by() {
    $byline = sprintf(
        /* translators: %s: post author. */
        esc_html_x('by %s', 'post author', 'webqx-healthcare'),
        '<span class="author vcard"><a class="url fn n" href="' . esc_url(get_author_posts_url(get_the_author_meta('ID'))) . '">' . esc_html(get_the_author()) . '</a></span>'
    );

    echo '<span class="byline"> ' . $byline . '</span>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}

/**
 * Prints HTML with meta information for categories, tags, and comments.
 */
function webqx_healthcare_entry_footer() {
    // Hide category and tag text for pages.
    if ('post' === get_post_type()) {
        /* translators: used between list items, there is a space after the comma */
        $categories_list = get_the_category_list(esc_html__(', ', 'webqx-healthcare'));
        if ($categories_list) {
            /* translators: 1: list of categories. */
            printf('<span class="cat-links">' . esc_html__('Posted in %1$s', 'webqx-healthcare') . '</span>', $categories_list); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }

        /* translators: used between list items, there is a space after the comma */
        $tags_list = get_the_tag_list('', esc_html_x(', ', 'list item separator', 'webqx-healthcare'));
        if ($tags_list) {
            /* translators: 1: list of tags. */
            printf('<span class="tags-links">' . esc_html__('Tagged %1$s', 'webqx-healthcare') . '</span>', $tags_list); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }
    }

    if (!is_single() && !post_password_required() && (comments_open() || get_comments_number())) {
        echo '<span class="comments-link">';
        comments_popup_link(
            sprintf(
                wp_kses(
                    /* translators: %s: post title */
                    __('Leave a Comment<span class="screen-reader-text"> on %s</span>', 'webqx-healthcare'),
                    array(
                        'span' => array(
                            'class' => array(),
                        ),
                    )
                ),
                wp_kses_post(get_the_title())
            )
        );
        echo '</span>';
    }

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
}
?>