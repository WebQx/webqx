<?php
/**
 * The template for displaying search results pages
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

get_header();
?>

<main id="primary" class="site-main">
    <section class="content-area">
        <header class="page-header">
            <h1 class="page-title">
                <?php
                printf(
                    /* translators: %s: search query. */
                    esc_html__('Search Results for: %s', 'webqx-healthcare'),
                    '<span>' . get_search_query() . '</span>'
                );
                ?>
            </h1>
            
            <div class="search-info">
                <?php
                global $wp_query;
                $total_results = $wp_query->found_posts;
                
                if ($total_results > 0) :
                    printf(
                        /* translators: %d: number of search results. */
                        esc_html(_n('%d result found', '%d results found', $total_results, 'webqx-healthcare')),
                        $total_results
                    );
                else :
                    esc_html_e('No results found', 'webqx-healthcare');
                endif;
                ?>
            </div>
            
            <!-- Search form for refined search -->
            <div class="search-refine">
                <h3><?php esc_html_e('Refine Your Search', 'webqx-healthcare'); ?></h3>
                <?php get_search_form(); ?>
            </div>
        </header><!-- .page-header -->

        <?php if (have_posts()) : ?>
            <div class="search-results">
                <?php
                // Start the Loop.
                while (have_posts()) :
                    the_post();
                    ?>
                    <article id="post-<?php the_ID(); ?>" <?php post_class('search-result'); ?>>
                        <header class="entry-header">
                            <?php the_title('<h2 class="entry-title"><a href="' . esc_url(get_permalink()) . '" rel="bookmark">', '</a></h2>'); ?>
                            
                            <div class="entry-meta">
                                <span class="post-type">
                                    <?php
                                    $post_type_obj = get_post_type_object(get_post_type());
                                    if ($post_type_obj) {
                                        echo esc_html($post_type_obj->labels->singular_name);
                                    }
                                    ?>
                                </span>
                                
                                <?php if ('post' === get_post_type()) : ?>
                                    <span class="posted-on">
                                        <time class="entry-date published" datetime="<?php echo esc_attr(get_the_date(DATE_W3C)); ?>">
                                            <?php echo esc_html(get_the_date()); ?>
                                        </time>
                                    </span>
                                <?php endif; ?>
                                
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
                        </header><!-- .entry-header -->

                        <?php if (has_post_thumbnail()) : ?>
                            <div class="entry-thumbnail">
                                <a href="<?php the_permalink(); ?>" aria-hidden="true" tabindex="-1">
                                    <?php the_post_thumbnail('webqx-medium', array('alt' => get_the_title())); ?>
                                </a>
                            </div>
                        <?php endif; ?>

                        <div class="entry-summary">
                            <?php
                            // Get excerpt with search term highlighting
                            $excerpt = get_the_excerpt();
                            $search_query = get_search_query();
                            
                            if ($search_query && $excerpt) {
                                // Highlight search terms in excerpt
                                $excerpt = preg_replace('/(' . preg_quote($search_query, '/') . ')/i', '<mark>$1</mark>', $excerpt);
                            }
                            
                            echo $excerpt;
                            ?>
                            
                            <a href="<?php the_permalink(); ?>" class="read-more">
                                <?php esc_html_e('Read More', 'webqx-healthcare'); ?>
                                <span class="screen-reader-text"><?php printf(esc_html__('about %s', 'webqx-healthcare'), get_the_title()); ?></span>
                            </a>
                        </div><!-- .entry-summary -->
                    </article><!-- #post-<?php the_ID(); ?> -->
                    <?php
                endwhile;
                ?>
            </div><!-- .search-results -->

            <?php
            // Display pagination
            the_posts_navigation(array(
                'prev_text' => __('← Previous Results', 'webqx-healthcare'),
                'next_text' => __('More Results →', 'webqx-healthcare'),
            ));

        else :
            ?>
            <div class="no-results">
                <h2><?php esc_html_e('No results found', 'webqx-healthcare'); ?></h2>
                
                <div class="search-suggestions healthcare-highlight">
                    <h3><?php esc_html_e('Search Suggestions', 'webqx-healthcare'); ?></h3>
                    <ul>
                        <li><?php esc_html_e('Check your spelling and try again', 'webqx-healthcare'); ?></li>
                        <li><?php esc_html_e('Try using fewer or more general keywords', 'webqx-healthcare'); ?></li>
                        <li><?php esc_html_e('Use different keywords that mean the same thing', 'webqx-healthcare'); ?></li>
                        <li><?php esc_html_e('Browse our most popular healthcare topics below', 'webqx-healthcare'); ?></li>
                    </ul>
                </div>

                <div class="popular-searches">
                    <h3><?php esc_html_e('Popular Healthcare Topics', 'webqx-healthcare'); ?></h3>
                    <div class="topic-grid">
                        <?php
                        // Get popular posts or create suggested searches
                        $popular_searches = array(
                            'Primary Care' => home_url('/services/primary-care/'),
                            'Pediatrics' => home_url('/services/pediatrics/'),
                            'Appointments' => home_url('/appointments/'),
                            'Patient Portal' => home_url('/patient-portal/'),
                            'Insurance' => home_url('/insurance/'),
                            'Providers' => home_url('/providers/'),
                        );

                        foreach ($popular_searches as $topic => $url) :
                            ?>
                            <a href="<?php echo esc_url($url); ?>" class="topic-link">
                                <?php echo esc_html($topic); ?>
                            </a>
                            <?php
                        endforeach;
                        ?>
                    </div>
                </div>

                <div class="recent-posts">
                    <h3><?php esc_html_e('Recent Health Articles', 'webqx-healthcare'); ?></h3>
                    <?php
                    $recent_posts = new WP_Query(array(
                        'posts_per_page' => 5,
                        'post_status' => 'publish'
                    ));

                    if ($recent_posts->have_posts()) :
                        echo '<ul>';
                        while ($recent_posts->have_posts()) :
                            $recent_posts->the_post();
                            ?>
                            <li>
                                <a href="<?php the_permalink(); ?>">
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
                </div>
            </div><!-- .no-results -->
            <?php
        endif;
        ?>
    </section>

    <?php get_sidebar(); ?>
</main><!-- #main -->

<style>
/* Search Results Specific Styles */
.search-results .search-result {
    border-bottom: 1px solid #e9ecef;
    padding-bottom: 2rem;
    margin-bottom: 2rem;
}

.search-results .search-result:last-child {
    border-bottom: none;
}

.search-refine {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 4px;
    margin-top: 1rem;
}

.search-refine h3 {
    margin-bottom: 0.5rem;
    font-size: 1rem;
    color: #2c5aa0;
}

.entry-meta .post-type {
    background: #2c5aa0;
    color: #fff;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.8rem;
    text-transform: uppercase;
    margin-right: 1rem;
}

.entry-summary mark {
    background: #fff3cd;
    padding: 0.1em 0.2em;
    border-radius: 2px;
}

.search-suggestions ul {
    padding-left: 1.5rem;
}

.search-suggestions li {
    margin-bottom: 0.5rem;
}

.popular-searches {
    margin: 2rem 0;
}

.topic-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
}

.topic-link {
    display: block;
    padding: 1rem;
    background: #fff;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    text-decoration: none;
    text-align: center;
    color: #333;
    transition: all 0.3s ease;
}

.topic-link:hover {
    background: #2c5aa0;
    color: #fff;
    transform: translateY(-2px);
}

.recent-posts ul {
    list-style: none;
    padding: 0;
}

.recent-posts li {
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f3f4;
}

.recent-posts li:last-child {
    border-bottom: none;
}

.recent-posts .post-date {
    color: #666;
    font-size: 0.9rem;
    margin-left: 0.5rem;
}

.search-info {
    color: #666;
    margin-bottom: 1rem;
    font-style: italic;
}

@media (max-width: 768px) {
    .topic-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
</style>

<?php
get_footer();
?>