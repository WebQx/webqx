<?php
/**
 * Template part for displaying posts
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

?>

<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
    <header class="entry-header">
        <?php
        if (is_singular()) :
            the_title('<h1 class="entry-title">', '</h1>');
        else :
            the_title('<h2 class="entry-title"><a href="' . esc_url(get_permalink()) . '" rel="bookmark">', '</a></h2>');
        endif;

        if ('post' === get_post_type()) :
            ?>
            <div class="entry-meta">
                <span class="posted-on">
                    <time class="entry-date published" datetime="<?php echo esc_attr(get_the_date(DATE_W3C)); ?>">
                        <?php echo esc_html(get_the_date()); ?>
                    </time>
                </span>
                <span class="byline">
                    <?php esc_html_e('by', 'webqx-healthcare'); ?> 
                    <span class="author vcard">
                        <a class="url fn n" href="<?php echo esc_url(get_author_posts_url(get_the_author_meta('ID'))); ?>">
                            <?php echo esc_html(get_the_author()); ?>
                        </a>
                    </span>
                </span>
                
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
                        <span class="healthcare-category">
                            <span class="category-label"><?php echo esc_html($categories[$healthcare_category]); ?></span>
                        </span>
                        <?php
                    endif;
                endif;
                ?>
            </div><!-- .entry-meta -->
            <?php
        endif;
        ?>
    </header><!-- .entry-header -->

    <?php if (has_post_thumbnail() && !is_singular()) : ?>
        <div class="entry-thumbnail">
            <a href="<?php the_permalink(); ?>" aria-hidden="true" tabindex="-1">
                <?php the_post_thumbnail('webqx-medium', array('alt' => get_the_title())); ?>
            </a>
        </div>
    <?php endif; ?>

    <div class="entry-content">
        <?php
        if (is_singular()) :
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
        else :
            the_excerpt();
        endif;
        ?>
    </div><!-- .entry-content -->

    <footer class="entry-footer">
        <?php if (!is_singular()) : ?>
            <div class="entry-footer-meta">
                <?php
                // Categories
                $categories_list = get_the_category_list(esc_html__(', ', 'webqx-healthcare'));
                if ($categories_list) {
                    printf('<span class="cat-links"><span class="screen-reader-text">%1$s </span>%2$s</span>',
                        esc_html__('Categories:', 'webqx-healthcare'),
                        $categories_list
                    );
                }

                // Tags
                $tags_list = get_the_tag_list('', esc_html_x(', ', 'list item separator', 'webqx-healthcare'));
                if ($tags_list) {
                    printf('<span class="tags-links"><span class="screen-reader-text">%1$s </span>%2$s</span>',
                        esc_html__('Tags:', 'webqx-healthcare'),
                        $tags_list
                    );
                }

                // Comments
                if (!post_password_required() && (comments_open() || get_comments_number())) {
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
                ?>
            </div>
        <?php endif; ?>

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
</article><!-- #post-<?php the_ID(); ?> -->