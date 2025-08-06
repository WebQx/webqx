<?php
/**
 * The template for displaying comments
 *
 * This is the template that displays the area of the page that contains both the current comments
 * and the comment form.
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

/*
 * If the current post is protected by a password and
 * the visitor has not yet entered the password we will
 * return early without loading the comments.
 */
if (post_password_required()) {
    return;
}
?>

<div id="comments" class="comments-area">

    <?php
    // You can start editing here -- including this comment!
    if (have_comments()) :
        ?>
        <h2 class="comments-title">
            <?php
            $webqx_comment_count = get_comments_number();
            if ('1' === $webqx_comment_count) {
                printf(
                    /* translators: 1: title. */
                    esc_html__('One thought on &ldquo;%1$s&rdquo;', 'webqx-healthcare'),
                    '<span>' . wp_kses_post(get_the_title()) . '</span>'
                );
            } else {
                printf( // WPCS: XSS OK.
                    /* translators: 1: comment count number, 2: title. */
                    esc_html(_nx('%1$s thought on &ldquo;%2$s&rdquo;', '%1$s thoughts on &ldquo;%2$s&rdquo;', $webqx_comment_count, 'comments title', 'webqx-healthcare')),
                    number_format_i18n($webqx_comment_count), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
                    '<span>' . wp_kses_post(get_the_title()) . '</span>'
                );
            }
            ?>
        </h2><!-- .comments-title -->

        <?php the_comments_navigation(); ?>

        <ol class="comment-list">
            <?php
            wp_list_comments(array(
                'style' => 'ol',
                'short_ping' => true,
                'callback' => 'webqx_healthcare_comment_callback',
            ));
            ?>
        </ol><!-- .comment-list -->

        <?php
        the_comments_navigation();

        // If comments are closed and there are comments, let's leave a little note, shall we?
        if (!comments_open()) :
            ?>
            <p class="no-comments"><?php esc_html_e('Comments are closed.', 'webqx-healthcare'); ?></p>
            <?php
        endif;

    endif; // Check for have_comments().

    // Healthcare-specific comment form modifications
    $commenter = wp_get_current_commenter();
    $req = get_option('require_name_email');
    $aria_req = ($req ? " aria-required='true'" : '');
    
    $comment_form_args = array(
        'class_form' => 'comment-form healthcare-form',
        'title_reply' => __('Leave a Comment', 'webqx-healthcare'),
        'title_reply_to' => __('Leave a Reply to %s', 'webqx-healthcare'),
        'cancel_reply_link' => __('Cancel Reply', 'webqx-healthcare'),
        'label_submit' => __('Post Comment', 'webqx-healthcare'),
        'comment_notes_before' => '<p class="comment-notes healthcare-highlight">' . 
                                   __('<strong>Medical Disclaimer:</strong> Comments are not a substitute for professional medical advice. Please consult with your healthcare provider for medical concerns.', 'webqx-healthcare') . 
                                   '</p>',
        'comment_notes_after' => '',
        'fields' => array(
            'author' => '<p class="comment-form-author">' .
                        '<label for="author">' . __('Name', 'webqx-healthcare') . ($req ? ' <span class="required">*</span>' : '') . '</label>' .
                        '<input id="author" name="author" type="text" value="' . esc_attr($commenter['comment_author']) . '" size="30"' . $aria_req . ' /></p>',
            'email' => '<p class="comment-form-email">' .
                       '<label for="email">' . __('Email', 'webqx-healthcare') . ($req ? ' <span class="required">*</span>' : '') . '</label>' .
                       '<input id="email" name="email" type="email" value="' . esc_attr($commenter['comment_author_email']) . '" size="30"' . $aria_req . ' /></p>',
            'url' => '<p class="comment-form-url">' .
                     '<label for="url">' . __('Website', 'webqx-healthcare') . '</label>' .
                     '<input id="url" name="url" type="url" value="' . esc_attr($commenter['comment_author_url']) . '" size="30" /></p>',
        ),
        'comment_field' => '<p class="comment-form-comment">' .
                           '<label for="comment">' . _x('Comment', 'noun', 'webqx-healthcare') . ' <span class="required">*</span></label>' .
                           '<textarea id="comment" name="comment" cols="45" rows="8" aria-required="true" placeholder="' . esc_attr__('Share your thoughts... (Remember: this is not a substitute for professional medical advice)', 'webqx-healthcare') . '"></textarea></p>',
    );

    comment_form($comment_form_args);
    ?>

</div><!-- #comments -->

<?php
/**
 * Custom comment callback function for healthcare theme
 */
function webqx_healthcare_comment_callback($comment, $args, $depth) {
    $tag = ('div' === $args['style']) ? 'div' : 'li';
    ?>
    <<?php echo $tag; ?> id="comment-<?php comment_ID(); ?>" <?php comment_class(empty($args['has_children']) ? '' : 'parent'); ?>>
        
        <article id="div-comment-<?php comment_ID(); ?>" class="comment-body">
            <footer class="comment-meta">
                <div class="comment-author vcard">
                    <?php
                    if (0 != $args['avatar_size']) {
                        echo get_avatar($comment, $args['avatar_size']);
                    }
                    ?>
                    <?php
                    /* translators: %s: comment author name */
                    printf(__('%s <span class="says">says:</span>', 'webqx-healthcare'), sprintf('<b class="fn">%s</b>', get_comment_author_link()));
                    ?>
                </div><!-- .comment-author -->

                <div class="comment-metadata">
                    <a href="<?php echo esc_url(get_comment_link($comment, $args)); ?>">
                        <time datetime="<?php comment_time('c'); ?>">
                            <?php
                            /* translators: 1: comment date, 2: comment time */
                            printf(__('%1$s at %2$s', 'webqx-healthcare'), get_comment_date('', $comment), get_comment_time());
                            ?>
                        </time>
                    </a>
                    <?php edit_comment_link(__('Edit', 'webqx-healthcare'), '<span class="edit-link">', '</span>'); ?>
                </div><!-- .comment-metadata -->

                <?php if ('0' == $comment->comment_approved) : ?>
                    <p class="comment-awaiting-moderation healthcare-highlight">
                        <?php esc_html_e('Your comment is awaiting moderation.', 'webqx-healthcare'); ?>
                    </p>
                <?php endif; ?>
            </footer><!-- .comment-meta -->

            <div class="comment-content">
                <?php comment_text(); ?>
            </div><!-- .comment-content -->

            <?php
            comment_reply_link(array_merge($args, array(
                'add_below' => 'div-comment',
                'depth' => $depth,
                'max_depth' => $args['max_depth'],
                'before' => '<div class="reply">',
                'after' => '</div>',
            )));
            ?>
        </article><!-- .comment-body -->

    <?php
    // Don't close the list item if we're using divs
    if ('div' != $args['style']) : ?>
    </<?php echo $tag; ?>>
    <?php endif;
}
?>