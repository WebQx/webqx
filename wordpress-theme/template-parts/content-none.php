<?php
/**
 * Template part for displaying a message that posts cannot be found
 *
 * @package WebQX_Healthcare_Platform
 * @since 1.0.0
 */
?>

<section class="no-results not-found">
    <header class="page-header">
        <h1 class="page-title"><?php _e('Nothing here', 'webqx'); ?></h1>
    </header><!-- .page-header -->

    <div class="page-content">
        <?php
        if (is_home() && current_user_can('publish_posts')) :
            
            printf(
                '<p>' . wp_kses(
                    __('Ready to publish your first post? <a href="%1$s">Get started here</a>.', 'webqx'),
                    array(
                        'a' => array(
                            'href' => array(),
                        ),
                    )
                ) . '</p>',
                esc_url(admin_url('post-new.php'))
            );

        elseif (is_search()) :
            ?>

            <p><?php _e('Sorry, but nothing matched your search terms. Please try again with some different keywords.', 'webqx'); ?></p>
            <?php
            get_search_form();

        else :
            ?>

            <p><?php _e('It seems we can&rsquo;t find what you&rsquo;re looking for. Perhaps searching can help.', 'webqx'); ?></p>
            <?php
            get_search_form();

        endif;
        ?>
        
        <div class="webqx-helpful-links">
            <h3><?php _e('You might be looking for:', 'webqx'); ?></h3>
            <ul>
                <li><a href="<?php echo esc_url(home_url('/patient-portal')); ?>"><?php _e('Patient Portal', 'webqx'); ?></a></li>
                <li><a href="<?php echo esc_url(home_url('/provider-panel')); ?>"><?php _e('Provider Panel', 'webqx'); ?></a></li>
                <li><a href="<?php echo esc_url(home_url('/specialties')); ?>"><?php _e('Medical Specialties', 'webqx'); ?></a></li>
                <li><a href="<?php echo esc_url(home_url('/contact')); ?>"><?php _e('Contact Support', 'webqx'); ?></a></li>
            </ul>
        </div>
    </div><!-- .page-content -->
</section><!-- .no-results -->