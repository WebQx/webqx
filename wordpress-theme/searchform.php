<?php
/**
 * Template for displaying search forms in WebQx Healthcare Theme
 *
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

?>

<form role="search" method="get" class="search-form" action="<?php echo esc_url(home_url('/')); ?>">
    <label>
        <span class="screen-reader-text"><?php echo esc_html_x('Search for:', 'label', 'webqx-healthcare'); ?></span>
        <input type="search" 
               class="search-field" 
               placeholder="<?php echo esc_attr_x('Search healthcare topics...', 'placeholder', 'webqx-healthcare'); ?>" 
               value="<?php echo get_search_query(); ?>" 
               name="s"
               aria-label="<?php echo esc_attr_x('Search for healthcare information', 'aria-label', 'webqx-healthcare'); ?>" />
    </label>
    <input type="submit" class="search-submit" value="<?php echo esc_attr_x('Search', 'submit button', 'webqx-healthcare'); ?>" />
</form>