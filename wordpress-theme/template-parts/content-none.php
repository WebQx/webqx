<?php
/**
 * Template part for displaying a message that posts cannot be found
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

?>

<section class="no-results not-found">
    <header class="page-header">
        <h1 class="page-title"><?php esc_html_e('Nothing here', 'webqx-healthcare'); ?></h1>
    </header><!-- .page-header -->

    <div class="page-content">
        <?php
        if (is_home() && current_user_can('publish_posts')) :

            printf(
                '<p>' . wp_kses(
                    /* translators: 1: link to WP admin new post page. */
                    __('Ready to publish your first post? <a href="%1$s">Get started here</a>.', 'webqx-healthcare'),
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

            <p><?php esc_html_e('Sorry, but nothing matched your search terms. Please try again with some different keywords.', 'webqx-healthcare'); ?></p>
            <?php
            get_search_form();

        else :
            ?>

            <p><?php esc_html_e('It seems we can&rsquo;t find what you&rsquo;re looking for. Perhaps searching can help.', 'webqx-healthcare'); ?></p>
            <?php
            get_search_form();

        endif;
        ?>
        
        <div class="healthcare-resources">
            <h3><?php esc_html_e('Healthcare Resources', 'webqx-healthcare'); ?></h3>
            <p><?php esc_html_e('While you\'re here, you might be interested in these healthcare resources:', 'webqx-healthcare'); ?></p>
            <ul>
                <li><a href="<?php echo esc_url(home_url('/services')); ?>"><?php esc_html_e('Our Services', 'webqx-healthcare'); ?></a></li>
                <li><a href="<?php echo esc_url(home_url('/providers')); ?>"><?php esc_html_e('Meet Our Providers', 'webqx-healthcare'); ?></a></li>
                <li><a href="<?php echo esc_url(home_url('/appointments')); ?>"><?php esc_html_e('Schedule an Appointment', 'webqx-healthcare'); ?></a></li>
                <li><a href="<?php echo esc_url(home_url('/patient-portal')); ?>"><?php esc_html_e('Patient Portal', 'webqx-healthcare'); ?></a></li>
            </ul>
        </div>
    </div><!-- .page-content -->
</section><!-- .no-results -->