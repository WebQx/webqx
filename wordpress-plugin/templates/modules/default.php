<?php
/**
 * Default template for WebQX modules
 *
 * @package WebQX_Integration
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$module_type = isset($module_type) ? $module_type : 'unknown';
$module_id = isset($module_id) ? $module_id : '';
$data = isset($data) ? $data : array();
?>

<div class="webqx-module webqx-module-<?php echo esc_attr($module_type); ?>">
    <div class="webqx-module-header">
        <h4 class="webqx-module-title">
            <?php echo esc_html(ucwords(str_replace('-', ' ', $module_type))); ?>
            <?php if ($module_id) : ?>
                <span class="webqx-module-id">(ID: <?php echo esc_html($module_id); ?>)</span>
            <?php endif; ?>
        </h4>
    </div>
    
    <div class="webqx-module-content">
        <?php if (!empty($data)) : ?>
            <div class="webqx-module-data">
                <?php if (isset($data['title'])) : ?>
                    <h5><?php echo esc_html($data['title']); ?></h5>
                <?php endif; ?>
                
                <?php if (isset($data['description'])) : ?>
                    <p><?php echo esc_html($data['description']); ?></p>
                <?php endif; ?>
                
                <?php if (isset($data['content'])) : ?>
                    <div class="webqx-module-body">
                        <?php echo wp_kses_post($data['content']); ?>
                    </div>
                <?php endif; ?>
                
                <?php if (isset($data['actions']) && is_array($data['actions'])) : ?>
                    <div class="webqx-module-actions">
                        <?php foreach ($data['actions'] as $action) : ?>
                            <a href="<?php echo esc_url($action['url']); ?>" class="webqx-btn webqx-btn-primary">
                                <?php echo esc_html($action['label']); ?>
                            </a>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        <?php else : ?>
            <div class="webqx-module-placeholder">
                <p><?php _e('WebQX module data is loading...', 'webqx-integration'); ?></p>
                <div class="webqx-loading"></div>
            </div>
        <?php endif; ?>
    </div>
    
    <div class="webqx-module-footer">
        <small class="webqx-module-meta">
            <?php printf(__('Powered by WebQX - Module: %s', 'webqx-integration'), esc_html($module_type)); ?>
        </small>
    </div>
</div>

<script>
// Auto-refresh module data if needed
jQuery(document).ready(function($) {
    var moduleContainer = $('.webqx-module-<?php echo esc_js($module_type); ?>');
    
    // If module has a placeholder, try to load real data
    if (moduleContainer.find('.webqx-module-placeholder').length > 0) {
        if (typeof WebQX !== 'undefined') {
            WebQX.apiCall('modules/<?php echo esc_js($module_type); ?><?php echo $module_id ? '/' . esc_js($module_id) : ''; ?>', 'GET', null, function(response) {
                if (response.success && response.data) {
                    // Update module content with real data
                    var newContent = '';
                    
                    if (response.data.title) {
                        newContent += '<h5>' + response.data.title + '</h5>';
                    }
                    
                    if (response.data.description) {
                        newContent += '<p>' + response.data.description + '</p>';
                    }
                    
                    if (response.data.content) {
                        newContent += '<div class="webqx-module-body">' + response.data.content + '</div>';
                    }
                    
                    if (response.data.actions && response.data.actions.length > 0) {
                        newContent += '<div class="webqx-module-actions">';
                        response.data.actions.forEach(function(action) {
                            newContent += '<a href="' + action.url + '" class="webqx-btn webqx-btn-primary">' + action.label + '</a>';
                        });
                        newContent += '</div>';
                    }
                    
                    moduleContainer.find('.webqx-module-content').html('<div class="webqx-module-data">' + newContent + '</div>');
                }
            });
        }
    }
});
</script>