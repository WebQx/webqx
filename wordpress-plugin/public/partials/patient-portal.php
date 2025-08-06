<?php
/**
 * Patient Portal Partial Template
 * 
 * @package WebQX_Healthcare
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$user = wp_get_current_user();
$view = isset($atts['view']) ? $atts['view'] : 'dashboard';
$user_id = isset($atts['user_id']) ? $atts['user_id'] : get_current_user_id();
?>

<div class="webqx-wrapper">
    <div class="webqx-patient-portal" id="webqx-patient-portal">
        <!-- Portal Header -->
        <div class="webqx-portal-header">
            <h2 class="webqx-portal-title">
                <?php esc_html_e('Patient Portal', 'webqx-healthcare'); ?>
            </h2>
            <div class="webqx-user-info">
                <div class="webqx-user-avatar">
                    <?php echo esc_html(substr($user->display_name, 0, 1)); ?>
                </div>
                <div class="webqx-user-details">
                    <div class="webqx-user-name"><?php echo esc_html($user->display_name); ?></div>
                    <div class="webqx-user-role"><?php esc_html_e('Patient', 'webqx-healthcare'); ?></div>
                </div>
            </div>
        </div>

        <!-- Portal Navigation -->
        <nav class="webqx-portal-nav">
            <button class="webqx-nav-item active" data-target="dashboard">
                <span class="dashicons dashicons-dashboard"></span>
                <?php esc_html_e('Dashboard', 'webqx-healthcare'); ?>
            </button>
            <button class="webqx-nav-item" data-target="appointments">
                <span class="dashicons dashicons-calendar-alt"></span>
                <?php esc_html_e('Appointments', 'webqx-healthcare'); ?>
            </button>
            <button class="webqx-nav-item" data-target="health-records">
                <span class="dashicons dashicons-media-document"></span>
                <?php esc_html_e('Health Records', 'webqx-healthcare'); ?>
            </button>
            <button class="webqx-nav-item" data-target="medications">
                <span class="dashicons dashicons-plus-alt2"></span>
                <?php esc_html_e('Medications', 'webqx-healthcare'); ?>
            </button>
            <button class="webqx-nav-item" data-target="messages">
                <span class="dashicons dashicons-email"></span>
                <?php esc_html_e('Messages', 'webqx-healthcare'); ?>
            </button>
            <button class="webqx-nav-item" data-target="billing">
                <span class="dashicons dashicons-money-alt"></span>
                <?php esc_html_e('Billing', 'webqx-healthcare'); ?>
            </button>
        </nav>

        <!-- Portal Content -->
        <div class="webqx-portal-content">
            <!-- Dashboard Section -->
            <div id="dashboard" class="webqx-portal-section">
                <div class="webqx-dashboard-grid">
                    <!-- Upcoming Appointments Card -->
                    <div class="webqx-dashboard-card" data-type="appointments">
                        <div class="webqx-card-header">
                            <div class="webqx-card-icon appointments">
                                <span class="dashicons dashicons-calendar-alt"></span>
                            </div>
                            <h3 class="webqx-card-title"><?php esc_html_e('Upcoming Appointments', 'webqx-healthcare'); ?></h3>
                        </div>
                        <div class="webqx-card-content">
                            <div class="webqx-card-metric" id="appointment-count">-</div>
                            <p><?php esc_html_e('Next 30 days', 'webqx-healthcare'); ?></p>
                            <button class="webqx-btn webqx-btn-primary" data-target="appointments">
                                <?php esc_html_e('View All', 'webqx-healthcare'); ?>
                            </button>
                        </div>
                    </div>

                    <!-- Active Medications Card -->
                    <div class="webqx-dashboard-card" data-type="medications">
                        <div class="webqx-card-header">
                            <div class="webqx-card-icon medications">
                                <span class="dashicons dashicons-plus-alt2"></span>
                            </div>
                            <h3 class="webqx-card-title"><?php esc_html_e('Active Medications', 'webqx-healthcare'); ?></h3>
                        </div>
                        <div class="webqx-card-content">
                            <div class="webqx-card-metric" id="medication-count">-</div>
                            <p><?php esc_html_e('Current prescriptions', 'webqx-healthcare'); ?></p>
                            <button class="webqx-btn webqx-btn-primary" data-target="medications">
                                <?php esc_html_e('Manage', 'webqx-healthcare'); ?>
                            </button>
                        </div>
                    </div>

                    <!-- Recent Lab Results Card -->
                    <div class="webqx-dashboard-card" data-type="lab-results">
                        <div class="webqx-card-header">
                            <div class="webqx-card-icon lab-results">
                                <span class="dashicons dashicons-analytics"></span>
                            </div>
                            <h3 class="webqx-card-title"><?php esc_html_e('Recent Lab Results', 'webqx-healthcare'); ?></h3>
                        </div>
                        <div class="webqx-card-content">
                            <div class="webqx-card-metric" id="lab-results-count">-</div>
                            <p><?php esc_html_e('New results available', 'webqx-healthcare'); ?></p>
                            <button class="webqx-btn webqx-btn-primary" data-target="health-records">
                                <?php esc_html_e('View Results', 'webqx-healthcare'); ?>
                            </button>
                        </div>
                    </div>

                    <!-- Messages Card -->
                    <div class="webqx-dashboard-card" data-type="messages">
                        <div class="webqx-card-header">
                            <div class="webqx-card-icon messages">
                                <span class="dashicons dashicons-email"></span>
                            </div>
                            <h3 class="webqx-card-title"><?php esc_html_e('Messages', 'webqx-healthcare'); ?></h3>
                        </div>
                        <div class="webqx-card-content">
                            <div class="webqx-card-metric" id="message-count">-</div>
                            <p><?php esc_html_e('Unread messages', 'webqx-healthcare'); ?></p>
                            <button class="webqx-btn webqx-btn-primary" data-target="messages">
                                <?php esc_html_e('Read Messages', 'webqx-healthcare'); ?>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Recent Activity -->
                <div class="webqx-recent-activity">
                    <h3><?php esc_html_e('Recent Activity', 'webqx-healthcare'); ?></h3>
                    <div id="recent-activity-list">
                        <div class="webqx-loading">
                            <span class="webqx-spinner"></span>
                            <?php esc_html_e('Loading recent activity...', 'webqx-healthcare'); ?>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Appointments Section -->
            <div id="appointments" class="webqx-portal-section" style="display: none;">
                <div class="webqx-section-header">
                    <h3><?php esc_html_e('My Appointments', 'webqx-healthcare'); ?></h3>
                    <button class="webqx-btn webqx-btn-primary" id="book-new-appointment">
                        <?php esc_html_e('Book New Appointment', 'webqx-healthcare'); ?>
                    </button>
                </div>
                <div id="appointments-list">
                    <!-- Appointments will be loaded via AJAX -->
                </div>
            </div>

            <!-- Health Records Section -->
            <div id="health-records" class="webqx-portal-section" style="display: none;">
                <div class="webqx-section-header">
                    <h3><?php esc_html_e('Health Records', 'webqx-healthcare'); ?></h3>
                    <div class="webqx-record-filters">
                        <select id="record-type-filter">
                            <option value=""><?php esc_html_e('All Records', 'webqx-healthcare'); ?></option>
                            <option value="lab-results"><?php esc_html_e('Lab Results', 'webqx-healthcare'); ?></option>
                            <option value="imaging"><?php esc_html_e('Imaging', 'webqx-healthcare'); ?></option>
                            <option value="visit-notes"><?php esc_html_e('Visit Notes', 'webqx-healthcare'); ?></option>
                            <option value="immunizations"><?php esc_html_e('Immunizations', 'webqx-healthcare'); ?></option>
                        </select>
                        <input type="date" id="record-date-filter" />
                    </div>
                </div>
                <div id="health-records-list">
                    <!-- Health records will be loaded via AJAX -->
                </div>
            </div>

            <!-- Medications Section -->
            <div id="medications" class="webqx-portal-section" style="display: none;">
                <div class="webqx-section-header">
                    <h3><?php esc_html_e('My Medications', 'webqx-healthcare'); ?></h3>
                    <div class="webqx-medication-actions">
                        <button class="webqx-btn webqx-btn-secondary" id="request-refill">
                            <?php esc_html_e('Request Refill', 'webqx-healthcare'); ?>
                        </button>
                        <button class="webqx-btn webqx-btn-secondary" id="medication-reminders">
                            <?php esc_html_e('Set Reminders', 'webqx-healthcare'); ?>
                        </button>
                    </div>
                </div>
                <div id="medications-list">
                    <!-- Medications will be loaded via AJAX -->
                </div>
            </div>

            <!-- Messages Section -->
            <div id="messages" class="webqx-portal-section" style="display: none;">
                <div class="webqx-section-header">
                    <h3><?php esc_html_e('Secure Messages', 'webqx-healthcare'); ?></h3>
                    <button class="webqx-btn webqx-btn-primary" id="compose-message">
                        <?php esc_html_e('New Message', 'webqx-healthcare'); ?>
                    </button>
                </div>
                <div class="webqx-message-interface">
                    <div class="webqx-message-sidebar">
                        <div id="message-threads">
                            <!-- Message threads will be loaded via AJAX -->
                        </div>
                    </div>
                    <div class="webqx-message-content">
                        <div id="message-conversation">
                            <p><?php esc_html_e('Select a message to view conversation', 'webqx-healthcare'); ?></p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Billing Section -->
            <div id="billing" class="webqx-portal-section" style="display: none;">
                <div class="webqx-section-header">
                    <h3><?php esc_html_e('Billing & Insurance', 'webqx-healthcare'); ?></h3>
                    <button class="webqx-btn webqx-btn-secondary" id="update-insurance">
                        <?php esc_html_e('Update Insurance Info', 'webqx-healthcare'); ?>
                    </button>
                </div>
                
                <div class="webqx-billing-summary">
                    <div class="webqx-billing-card">
                        <h4><?php esc_html_e('Account Balance', 'webqx-healthcare'); ?></h4>
                        <div class="webqx-balance-amount" id="account-balance">$0.00</div>
                        <button class="webqx-btn webqx-btn-primary" id="make-payment">
                            <?php esc_html_e('Make Payment', 'webqx-healthcare'); ?>
                        </button>
                    </div>
                    
                    <div class="webqx-billing-card">
                        <h4><?php esc_html_e('Insurance Coverage', 'webqx-healthcare'); ?></h4>
                        <div id="insurance-info">
                            <!-- Insurance information will be loaded via AJAX -->
                        </div>
                    </div>
                </div>
                
                <div id="billing-statements">
                    <!-- Billing statements will be loaded via AJAX -->
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Appointment Booking Modal -->
<div id="appointment-modal" class="webqx-modal" style="display: none;">
    <div class="webqx-modal-content">
        <div class="webqx-modal-header">
            <h3><?php esc_html_e('Book New Appointment', 'webqx-healthcare'); ?></h3>
            <button class="webqx-modal-close">&times;</button>
        </div>
        <div class="webqx-modal-body">
            <?php echo do_shortcode('[webqx_appointment_booking]'); ?>
        </div>
    </div>
</div>

<script>
jQuery(document).ready(function($) {
    // Load initial dashboard data
    loadPatientDashboard();
    
    // Handle section navigation
    $('.webqx-nav-item').on('click', function() {
        var target = $(this).data('target');
        switchPortalSection(target);
    });
    
    // Handle modal actions
    $('#book-new-appointment').on('click', function() {
        $('#appointment-modal').show();
    });
    
    $('.webqx-modal-close').on('click', function() {
        $('.webqx-modal').hide();
    });
    
    function loadPatientDashboard() {
        $.post(webqx_ajax.ajax_url, {
            action: 'webqx_frontend_action',
            frontend_action: 'get_patient_dashboard',
            nonce: webqx_ajax.nonce
        }, function(response) {
            if (response.success) {
                updateDashboardCards(response.data);
            }
        });
    }
    
    function updateDashboardCards(data) {
        $('#appointment-count').text(data.upcoming_appointments || 0);
        $('#medication-count').text(data.active_medications || 0);
        $('#lab-results-count').text(data.new_lab_results || 0);
        $('#message-count').text(data.unread_messages || 0);
        
        // Update account balance
        $('#account-balance').text(data.account_balance || '$0.00');
    }
    
    function switchPortalSection(target) {
        $('.webqx-nav-item').removeClass('active');
        $('.webqx-nav-item[data-target="' + target + '"]').addClass('active');
        
        $('.webqx-portal-section').hide();
        $('#' + target).show();
        
        // Load section data if not already loaded
        if (!$('#' + target).data('loaded')) {
            loadSectionData(target);
        }
    }
});
</script>