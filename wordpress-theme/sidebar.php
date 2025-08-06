<?php
/**
 * The sidebar containing the main widget area
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

if (!is_active_sidebar('sidebar-1')) {
    return;
}
?>

<aside id="secondary" class="widget-area">
    <?php if (is_active_sidebar('sidebar-1')) : ?>
        <?php dynamic_sidebar('sidebar-1'); ?>
    <?php else : ?>
        <!-- Default sidebar content when no widgets are active -->
        <section class="widget widget_search">
            <h3 class="widget-title"><?php esc_html_e('Search', 'webqx-healthcare'); ?></h3>
            <?php get_search_form(); ?>
        </section>

        <section class="widget">
            <h3 class="widget-title"><?php esc_html_e('Healthcare Services', 'webqx-healthcare'); ?></h3>
            <ul>
                <li><a href="#"><?php esc_html_e('Primary Care', 'webqx-healthcare'); ?></a></li>
                <li><a href="#"><?php esc_html_e('Pediatrics', 'webqx-healthcare'); ?></a></li>
                <li><a href="#"><?php esc_html_e('Cardiology', 'webqx-healthcare'); ?></a></li>
                <li><a href="#"><?php esc_html_e('Psychiatry', 'webqx-healthcare'); ?></a></li>
                <li><a href="#"><?php esc_html_e('Radiology', 'webqx-healthcare'); ?></a></li>
                <li><a href="#"><?php esc_html_e('Oncology', 'webqx-healthcare'); ?></a></li>
            </ul>
        </section>

        <section class="widget">
            <h3 class="widget-title"><?php esc_html_e('Patient Resources', 'webqx-healthcare'); ?></h3>
            <ul>
                <li><a href="#"><?php esc_html_e('Patient Portal', 'webqx-healthcare'); ?></a></li>
                <li><a href="#"><?php esc_html_e('Appointment Scheduling', 'webqx-healthcare'); ?></a></li>
                <li><a href="#"><?php esc_html_e('Lab Results', 'webqx-healthcare'); ?></a></li>
                <li><a href="#"><?php esc_html_e('Prescription Refills', 'webqx-healthcare'); ?></a></li>
                <li><a href="#"><?php esc_html_e('Insurance Information', 'webqx-healthcare'); ?></a></li>
            </ul>
        </section>

        <section class="widget">
            <h3 class="widget-title"><?php esc_html_e('Recent Health Articles', 'webqx-healthcare'); ?></h3>
            <?php
            $recent_posts = new WP_Query(array(
                'posts_per_page' => 5,
                'post_status' => 'publish',
                'meta_query' => array(
                    array(
                        'key' => '_webqx_healthcare_category',
                        'compare' => 'EXISTS',
                    ),
                ),
            ));

            if ($recent_posts->have_posts()) :
                echo '<ul>';
                while ($recent_posts->have_posts()) :
                    $recent_posts->the_post();
                    ?>
                    <li>
                        <a href="<?php the_permalink(); ?>" title="<?php the_title_attribute(); ?>">
                            <?php the_title(); ?>
                        </a>
                        <span class="post-date"><?php echo get_the_date(); ?></span>
                    </li>
                    <?php
                endwhile;
                echo '</ul>';
                wp_reset_postdata();
            endif;
            ?>
        </section>

        <section class="widget healthcare-highlight">
            <h3 class="widget-title"><?php esc_html_e('Emergency Information', 'webqx-healthcare'); ?></h3>
            <div class="emergency-info">
                <p><strong><?php esc_html_e('Emergency:', 'webqx-healthcare'); ?></strong> 911</p>
                <p><strong><?php esc_html_e('Poison Control:', 'webqx-healthcare'); ?></strong> 1-800-222-1222</p>
                <p><strong><?php esc_html_e('Mental Health Crisis:', 'webqx-healthcare'); ?></strong> 988</p>
                
                <?php
                $phone = get_theme_mod('webqx_phone');
                if ($phone) :
                    ?>
                    <p><strong><?php esc_html_e('Our Office:', 'webqx-healthcare'); ?></strong> 
                    <a href="tel:<?php echo esc_attr(str_replace(array(' ', '-', '(', ')'), '', $phone)); ?>">
                        <?php echo esc_html($phone); ?>
                    </a></p>
                    <?php
                endif;
                ?>
            </div>
        </section>

        <section class="widget">
            <h3 class="widget-title"><?php esc_html_e('Patient Portal Access', 'webqx-healthcare'); ?></h3>
            <div class="portal-access">
                <p><?php esc_html_e('Access your medical records, test results, and communicate with your healthcare provider.', 'webqx-healthcare'); ?></p>
                <a href="#" class="btn portal-login-btn"><?php esc_html_e('Patient Portal Login', 'webqx-healthcare'); ?></a>
                <p><small><?php esc_html_e('First time user? Contact our office to set up your account.', 'webqx-healthcare'); ?></small></p>
            </div>
        </section>

        <section class="widget">
            <h3 class="widget-title"><?php esc_html_e('Office Hours', 'webqx-healthcare'); ?></h3>
            <div class="office-hours">
                <ul>
                    <li><strong><?php esc_html_e('Monday - Friday:', 'webqx-healthcare'); ?></strong> 8:00 AM - 5:00 PM</li>
                    <li><strong><?php esc_html_e('Saturday:', 'webqx-healthcare'); ?></strong> 9:00 AM - 2:00 PM</li>
                    <li><strong><?php esc_html_e('Sunday:', 'webqx-healthcare'); ?></strong> <?php esc_html_e('Closed', 'webqx-healthcare'); ?></li>
                </ul>
                <p><em><?php esc_html_e('For after-hours emergencies, please call 911 or visit your nearest emergency room.', 'webqx-healthcare'); ?></em></p>
            </div>
        </section>
    <?php endif; ?>
</aside><!-- #secondary -->