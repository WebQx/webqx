<?php
/**
 * WebQX Widgets Class
 *
 * @package WebQX_Integration
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WebQX Widgets Class
 */
class WebQX_Widgets {
    
    /**
     * Initialize widgets
     */
    public static function init() {
        add_action('widgets_init', array(__CLASS__, 'register_widgets'));
    }
    
    /**
     * Register widgets
     */
    public static function register_widgets() {
        register_widget('WebQX_Patient_Portal_Widget');
        register_widget('WebQX_Provider_Dashboard_Widget');
        register_widget('WebQX_Appointment_Widget');
        register_widget('WebQX_Health_Status_Widget');
    }
}

/**
 * Patient Portal Widget
 */
class WebQX_Patient_Portal_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'webqx_patient_portal',
            __('WebQX Patient Portal', 'webqx-integration'),
            array('description' => __('Display patient portal access and quick links.', 'webqx-integration'))
        );
    }
    
    public function widget($args, $instance) {
        echo $args['before_widget'];
        
        if (!empty($instance['title'])) {
            echo $args['before_title'] . apply_filters('widget_title', $instance['title']) . $args['after_title'];
        }
        
        if (is_user_logged_in()) {
            ?>
            <div class="webqx-patient-widget">
                <p><?php printf(__('Welcome, %s', 'webqx-integration'), wp_get_current_user()->display_name); ?></p>
                <ul class="webqx-portal-links">
                    <li><a href="<?php echo esc_url(home_url('/patient-portal')); ?>"><?php _e('Dashboard', 'webqx-integration'); ?></a></li>
                    <li><a href="<?php echo esc_url(home_url('/appointments')); ?>"><?php _e('Appointments', 'webqx-integration'); ?></a></li>
                    <li><a href="<?php echo esc_url(home_url('/medical-records')); ?>"><?php _e('Medical Records', 'webqx-integration'); ?></a></li>
                    <li><a href="<?php echo esc_url(home_url('/messages')); ?>"><?php _e('Messages', 'webqx-integration'); ?></a></li>
                </ul>
            </div>
            <?php
        } else {
            ?>
            <div class="webqx-login-widget">
                <p><?php _e('Access your patient portal', 'webqx-integration'); ?></p>
                <a href="<?php echo esc_url(wp_login_url()); ?>" class="button"><?php _e('Login', 'webqx-integration'); ?></a>
            </div>
            <?php
        }
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        $title = !empty($instance['title']) ? $instance['title'] : __('Patient Portal', 'webqx-integration');
        ?>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('title')); ?>"><?php _e('Title:', 'webqx-integration'); ?></label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('title')); ?>" name="<?php echo esc_attr($this->get_field_name('title')); ?>" type="text" value="<?php echo esc_attr($title); ?>">
        </p>
        <?php
    }
    
    public function update($new_instance, $old_instance) {
        $instance = array();
        $instance['title'] = (!empty($new_instance['title'])) ? sanitize_text_field($new_instance['title']) : '';
        return $instance;
    }
}

/**
 * Provider Dashboard Widget
 */
class WebQX_Provider_Dashboard_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'webqx_provider_dashboard',
            __('WebQX Provider Dashboard', 'webqx-integration'),
            array('description' => __('Display provider dashboard and quick statistics.', 'webqx-integration'))
        );
    }
    
    public function widget($args, $instance) {
        if (!current_user_can('edit_posts')) {
            return;
        }
        
        echo $args['before_widget'];
        
        if (!empty($instance['title'])) {
            echo $args['before_title'] . apply_filters('widget_title', $instance['title']) . $args['after_title'];
        }
        
        ?>
        <div class="webqx-provider-widget">
            <div class="webqx-provider-stats">
                <div class="webqx-stat-item">
                    <span class="webqx-stat-label"><?php _e('Today\'s Patients:', 'webqx-integration'); ?></span>
                    <span class="webqx-stat-value" id="webqx-widget-today-patients">--</span>
                </div>
                <div class="webqx-stat-item">
                    <span class="webqx-stat-label"><?php _e('Pending Notes:', 'webqx-integration'); ?></span>
                    <span class="webqx-stat-value" id="webqx-widget-pending-notes">--</span>
                </div>
            </div>
            <ul class="webqx-provider-links">
                <li><a href="<?php echo esc_url(admin_url('admin.php?page=webqx-integration')); ?>"><?php _e('WebQX Dashboard', 'webqx-integration'); ?></a></li>
                <li><a href="<?php echo esc_url(home_url('/provider-panel')); ?>"><?php _e('Provider Panel', 'webqx-integration'); ?></a></li>
                <li><a href="<?php echo esc_url(home_url('/ehr-dashboard')); ?>"><?php _e('EHR Dashboard', 'webqx-integration'); ?></a></li>
            </ul>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            // Load provider stats
            if (typeof WebQX !== 'undefined') {
                WebQX.apiCall('provider/stats', 'GET', null, function(response) {
                    if (response.success) {
                        $('#webqx-widget-today-patients').text(response.data.today_patients || '0');
                        $('#webqx-widget-pending-notes').text(response.data.pending_notes || '0');
                    }
                });
            }
        });
        </script>
        <?php
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        $title = !empty($instance['title']) ? $instance['title'] : __('Provider Dashboard', 'webqx-integration');
        ?>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('title')); ?>"><?php _e('Title:', 'webqx-integration'); ?></label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('title')); ?>" name="<?php echo esc_attr($this->get_field_name('title')); ?>" type="text" value="<?php echo esc_attr($title); ?>">
        </p>
        <?php
    }
    
    public function update($new_instance, $old_instance) {
        $instance = array();
        $instance['title'] = (!empty($new_instance['title'])) ? sanitize_text_field($new_instance['title']) : '';
        return $instance;
    }
}

/**
 * Appointment Widget
 */
class WebQX_Appointment_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'webqx_appointments',
            __('WebQX Appointments', 'webqx-integration'),
            array('description' => __('Display upcoming appointments and booking options.', 'webqx-integration'))
        );
    }
    
    public function widget($args, $instance) {
        echo $args['before_widget'];
        
        if (!empty($instance['title'])) {
            echo $args['before_title'] . apply_filters('widget_title', $instance['title']) . $args['after_title'];
        }
        
        if (is_user_logged_in()) {
            ?>
            <div class="webqx-appointments-widget">
                <div id="webqx-widget-appointments" class="webqx-widget-appointments">
                    <div class="webqx-loading"><?php _e('Loading appointments...', 'webqx-integration'); ?></div>
                </div>
                <div class="webqx-appointment-actions">
                    <a href="<?php echo esc_url(home_url('/book-appointment')); ?>" class="button button-primary">
                        <?php _e('Book Appointment', 'webqx-integration'); ?>
                    </a>
                </div>
            </div>
            
            <script>
            jQuery(document).ready(function($) {
                if (typeof WebQX !== 'undefined') {
                    WebQX.apiCall('appointments/upcoming', 'GET', null, function(response) {
                        var container = $('#webqx-widget-appointments');
                        
                        if (response.success && response.data.appointments) {
                            var html = '<ul class="webqx-appointment-list">';
                            response.data.appointments.slice(0, 3).forEach(function(appointment) {
                                html += '<li>';
                                html += '<strong>' + appointment.date + '</strong><br>';
                                html += appointment.time + ' - ' + appointment.provider;
                                html += '</li>';
                            });
                            html += '</ul>';
                            
                            if (response.data.appointments.length > 3) {
                                html += '<p><a href="<?php echo esc_url(home_url('/appointments')); ?>"><?php _e('View all appointments', 'webqx-integration'); ?></a></p>';
                            }
                            
                            container.html(html);
                        } else {
                            container.html('<p><?php _e('No upcoming appointments.', 'webqx-integration'); ?></p>');
                        }
                    });
                }
            });
            </script>
            <?php
        } else {
            ?>
            <div class="webqx-login-required">
                <p><?php _e('Please log in to view your appointments.', 'webqx-integration'); ?></p>
                <a href="<?php echo esc_url(wp_login_url()); ?>" class="button"><?php _e('Login', 'webqx-integration'); ?></a>
            </div>
            <?php
        }
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        $title = !empty($instance['title']) ? $instance['title'] : __('Upcoming Appointments', 'webqx-integration');
        ?>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('title')); ?>"><?php _e('Title:', 'webqx-integration'); ?></label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('title')); ?>" name="<?php echo esc_attr($this->get_field_name('title')); ?>" type="text" value="<?php echo esc_attr($title); ?>">
        </p>
        <?php
    }
    
    public function update($new_instance, $old_instance) {
        $instance = array();
        $instance['title'] = (!empty($new_instance['title'])) ? sanitize_text_field($new_instance['title']) : '';
        return $instance;
    }
}

/**
 * Health Status Widget
 */
class WebQX_Health_Status_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'webqx_health_status',
            __('WebQX Health Status', 'webqx-integration'),
            array('description' => __('Display system health and status indicators.', 'webqx-integration'))
        );
    }
    
    public function widget($args, $instance) {
        echo $args['before_widget'];
        
        if (!empty($instance['title'])) {
            echo $args['before_title'] . apply_filters('widget_title', $instance['title']) . $args['after_title'];
        }
        
        $plugin = webqx_integration();
        $api_status = $plugin->api_request('health');
        
        ?>
        <div class="webqx-health-widget">
            <div class="webqx-health-indicators">
                <div class="webqx-health-item">
                    <span class="webqx-health-label"><?php _e('WebQX API:', 'webqx-integration'); ?></span>
                    <span class="webqx-health-status <?php echo $api_status['success'] ? 'status-online' : 'status-offline'; ?>">
                        <?php echo $api_status['success'] ? __('Online', 'webqx-integration') : __('Offline', 'webqx-integration'); ?>
                    </span>
                </div>
                
                <div class="webqx-health-item">
                    <span class="webqx-health-label"><?php _e('FHIR:', 'webqx-integration'); ?></span>
                    <span class="webqx-health-status <?php echo get_option('webqx_enable_fhir') ? 'status-enabled' : 'status-disabled'; ?>">
                        <?php echo get_option('webqx_enable_fhir') ? __('Enabled', 'webqx-integration') : __('Disabled', 'webqx-integration'); ?>
                    </span>
                </div>
                
                <?php if (current_user_can('manage_options')) : ?>
                    <div class="webqx-health-item">
                        <span class="webqx-health-label"><?php _e('Cache:', 'webqx-integration'); ?></span>
                        <span class="webqx-health-status <?php echo get_option('webqx_enable_cache') ? 'status-enabled' : 'status-disabled'; ?>">
                            <?php echo get_option('webqx_enable_cache') ? __('Enabled', 'webqx-integration') : __('Disabled', 'webqx-integration'); ?>
                        </span>
                    </div>
                <?php endif; ?>
            </div>
            
            <?php if (current_user_can('manage_options')) : ?>
                <div class="webqx-health-actions">
                    <a href="<?php echo admin_url('admin.php?page=webqx-integration'); ?>" class="button button-small">
                        <?php _e('Dashboard', 'webqx-integration'); ?>
                    </a>
                </div>
            <?php endif; ?>
        </div>
        <?php
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        $title = !empty($instance['title']) ? $instance['title'] : __('System Status', 'webqx-integration');
        ?>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('title')); ?>"><?php _e('Title:', 'webqx-integration'); ?></label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('title')); ?>" name="<?php echo esc_attr($this->get_field_name('title')); ?>" type="text" value="<?php echo esc_attr($title); ?>">
        </p>
        <?php
    }
    
    public function update($new_instance, $old_instance) {
        $instance = array();
        $instance['title'] = (!empty($new_instance['title'])) ? sanitize_text_field($new_instance['title']) : '';
        return $instance;
    }
}
?>