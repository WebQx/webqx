<?php
/**
 * Appointment Booking Partial Template
 * 
 * @package WebQX_Healthcare
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$provider_id = isset($atts['provider_id']) ? $atts['provider_id'] : '';
$specialty = isset($atts['specialty']) ? $atts['specialty'] : '';
$location = isset($atts['location']) ? $atts['location'] : '';
?>

<div class="webqx-appointment-booking">
    <div class="webqx-booking-header">
        <h3><?php esc_html_e('Book an Appointment', 'webqx-healthcare'); ?></h3>
        <p><?php esc_html_e('Schedule your appointment with one of our healthcare providers.', 'webqx-healthcare'); ?></p>
    </div>

    <form id="webqx-appointment-form" class="webqx-form">
        <?php wp_nonce_field('webqx_frontend_nonce', 'nonce'); ?>
        
        <div class="webqx-form-grid">
            <!-- Provider Selection -->
            <div class="webqx-form-group">
                <label for="webqx-provider-select" class="webqx-form-label">
                    <?php esc_html_e('Healthcare Provider', 'webqx-healthcare'); ?> *
                </label>
                <select id="webqx-provider-select" name="provider_id" class="webqx-form-select" required>
                    <option value=""><?php esc_html_e('Select a provider...', 'webqx-healthcare'); ?></option>
                    <!-- Options will be loaded via AJAX -->
                </select>
            </div>

            <!-- Specialty Filter -->
            <div class="webqx-form-group">
                <label for="webqx-specialty-filter" class="webqx-form-label">
                    <?php esc_html_e('Specialty', 'webqx-healthcare'); ?>
                </label>
                <select id="webqx-specialty-filter" name="specialty" class="webqx-form-select">
                    <option value=""><?php esc_html_e('All Specialties', 'webqx-healthcare'); ?></option>
                    <option value="primary-care" <?php selected($specialty, 'primary-care'); ?>><?php esc_html_e('Primary Care', 'webqx-healthcare'); ?></option>
                    <option value="cardiology" <?php selected($specialty, 'cardiology'); ?>><?php esc_html_e('Cardiology', 'webqx-healthcare'); ?></option>
                    <option value="dermatology" <?php selected($specialty, 'dermatology'); ?>><?php esc_html_e('Dermatology', 'webqx-healthcare'); ?></option>
                    <option value="endocrinology" <?php selected($specialty, 'endocrinology'); ?>><?php esc_html_e('Endocrinology', 'webqx-healthcare'); ?></option>
                    <option value="gastroenterology" <?php selected($specialty, 'gastroenterology'); ?>><?php esc_html_e('Gastroenterology', 'webqx-healthcare'); ?></option>
                    <option value="neurology" <?php selected($specialty, 'neurology'); ?>><?php esc_html_e('Neurology', 'webqx-healthcare'); ?></option>
                    <option value="oncology" <?php selected($specialty, 'oncology'); ?>><?php esc_html_e('Oncology', 'webqx-healthcare'); ?></option>
                    <option value="orthopedics" <?php selected($specialty, 'orthopedics'); ?>><?php esc_html_e('Orthopedics', 'webqx-healthcare'); ?></option>
                    <option value="pediatrics" <?php selected($specialty, 'pediatrics'); ?>><?php esc_html_e('Pediatrics', 'webqx-healthcare'); ?></option>
                    <option value="psychiatry" <?php selected($specialty, 'psychiatry'); ?>><?php esc_html_e('Psychiatry', 'webqx-healthcare'); ?></option>
                    <option value="radiology" <?php selected($specialty, 'radiology'); ?>><?php esc_html_e('Radiology', 'webqx-healthcare'); ?></option>
                    <option value="urology" <?php selected($specialty, 'urology'); ?>><?php esc_html_e('Urology', 'webqx-healthcare'); ?></option>
                </select>
            </div>

            <!-- Preferred Date -->
            <div class="webqx-form-group">
                <label for="webqx-appointment-date" class="webqx-form-label">
                    <?php esc_html_e('Preferred Date', 'webqx-healthcare'); ?> *
                </label>
                <input type="date" id="webqx-appointment-date" name="date" class="webqx-form-input" required />
            </div>

            <!-- Appointment Type -->
            <div class="webqx-form-group">
                <label for="webqx-appointment-type" class="webqx-form-label">
                    <?php esc_html_e('Appointment Type', 'webqx-healthcare'); ?>
                </label>
                <select id="webqx-appointment-type" name="appointment_type" class="webqx-form-select">
                    <option value="office-visit"><?php esc_html_e('Office Visit', 'webqx-healthcare'); ?></option>
                    <option value="telemedicine"><?php esc_html_e('Telemedicine', 'webqx-healthcare'); ?></option>
                    <option value="follow-up"><?php esc_html_e('Follow-up', 'webqx-healthcare'); ?></option>
                    <option value="consultation"><?php esc_html_e('Consultation', 'webqx-healthcare'); ?></option>
                    <option value="annual-physical"><?php esc_html_e('Annual Physical', 'webqx-healthcare'); ?></option>
                    <option value="urgent-care"><?php esc_html_e('Urgent Care', 'webqx-healthcare'); ?></option>
                </select>
            </div>

            <!-- Insurance Information -->
            <div class="webqx-form-group">
                <label for="webqx-insurance-provider" class="webqx-form-label">
                    <?php esc_html_e('Insurance Provider', 'webqx-healthcare'); ?>
                </label>
                <input type="text" id="webqx-insurance-provider" name="insurance_provider" 
                       class="webqx-form-input" placeholder="<?php esc_attr_e('e.g., Blue Cross Blue Shield', 'webqx-healthcare'); ?>" />
            </div>

            <!-- Reason for Visit -->
            <div class="webqx-form-group webqx-form-group-full">
                <label for="webqx-appointment-reason" class="webqx-form-label">
                    <?php esc_html_e('Reason for Visit', 'webqx-healthcare'); ?> *
                </label>
                <textarea id="webqx-appointment-reason" name="reason" class="webqx-form-textarea" 
                          required placeholder="<?php esc_attr_e('Please describe the reason for your visit...', 'webqx-healthcare'); ?>"></textarea>
            </div>
        </div>

        <!-- Available Time Slots -->
        <div class="webqx-time-selection" style="display: none;">
            <h4><?php esc_html_e('Available Times', 'webqx-healthcare'); ?></h4>
            <div id="webqx-appointment-slots">
                <!-- Time slots will be loaded via AJAX -->
            </div>
            <input type="hidden" id="webqx-selected-time" name="time" />
        </div>

        <!-- Patient Information -->
        <?php if (!is_user_logged_in()): ?>
        <div class="webqx-patient-info">
            <h4><?php esc_html_e('Patient Information', 'webqx-healthcare'); ?></h4>
            <div class="webqx-form-grid">
                <div class="webqx-form-group">
                    <label for="webqx-patient-first-name" class="webqx-form-label">
                        <?php esc_html_e('First Name', 'webqx-healthcare'); ?> *
                    </label>
                    <input type="text" id="webqx-patient-first-name" name="patient_first_name" 
                           class="webqx-form-input" required />
                </div>
                
                <div class="webqx-form-group">
                    <label for="webqx-patient-last-name" class="webqx-form-label">
                        <?php esc_html_e('Last Name', 'webqx-healthcare'); ?> *
                    </label>
                    <input type="text" id="webqx-patient-last-name" name="patient_last_name" 
                           class="webqx-form-input" required />
                </div>
                
                <div class="webqx-form-group">
                    <label for="webqx-patient-email" class="webqx-form-label">
                        <?php esc_html_e('Email Address', 'webqx-healthcare'); ?> *
                    </label>
                    <input type="email" id="webqx-patient-email" name="patient_email" 
                           class="webqx-form-input" required />
                </div>
                
                <div class="webqx-form-group">
                    <label for="webqx-patient-phone" class="webqx-form-label">
                        <?php esc_html_e('Phone Number', 'webqx-healthcare'); ?> *
                    </label>
                    <input type="tel" id="webqx-patient-phone" name="patient_phone" 
                           class="webqx-form-input" required />
                </div>
                
                <div class="webqx-form-group">
                    <label for="webqx-patient-dob" class="webqx-form-label">
                        <?php esc_html_e('Date of Birth', 'webqx-healthcare'); ?> *
                    </label>
                    <input type="date" id="webqx-patient-dob" name="patient_dob" 
                           class="webqx-form-input" required />
                </div>
            </div>
        </div>
        <?php endif; ?>

        <!-- Emergency Contact -->
        <div class="webqx-emergency-contact" style="display: none;">
            <h4><?php esc_html_e('Emergency Contact', 'webqx-healthcare'); ?></h4>
            <div class="webqx-form-grid">
                <div class="webqx-form-group">
                    <label for="webqx-emergency-name" class="webqx-form-label">
                        <?php esc_html_e('Contact Name', 'webqx-healthcare'); ?>
                    </label>
                    <input type="text" id="webqx-emergency-name" name="emergency_contact_name" 
                           class="webqx-form-input" />
                </div>
                
                <div class="webqx-form-group">
                    <label for="webqx-emergency-phone" class="webqx-form-label">
                        <?php esc_html_e('Contact Phone', 'webqx-healthcare'); ?>
                    </label>
                    <input type="tel" id="webqx-emergency-phone" name="emergency_contact_phone" 
                           class="webqx-form-input" />
                </div>
                
                <div class="webqx-form-group">
                    <label for="webqx-emergency-relationship" class="webqx-form-label">
                        <?php esc_html_e('Relationship', 'webqx-healthcare'); ?>
                    </label>
                    <select id="webqx-emergency-relationship" name="emergency_contact_relationship" 
                            class="webqx-form-select">
                        <option value=""><?php esc_html_e('Select relationship...', 'webqx-healthcare'); ?></option>
                        <option value="spouse"><?php esc_html_e('Spouse', 'webqx-healthcare'); ?></option>
                        <option value="parent"><?php esc_html_e('Parent', 'webqx-healthcare'); ?></option>
                        <option value="child"><?php esc_html_e('Child', 'webqx-healthcare'); ?></option>
                        <option value="sibling"><?php esc_html_e('Sibling', 'webqx-healthcare'); ?></option>
                        <option value="friend"><?php esc_html_e('Friend', 'webqx-healthcare'); ?></option>
                        <option value="other"><?php esc_html_e('Other', 'webqx-healthcare'); ?></option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Terms and Conditions -->
        <div class="webqx-terms-section">
            <label class="webqx-checkbox-label">
                <input type="checkbox" id="webqx-terms-agreement" name="terms_agreement" required />
                <?php esc_html_e('I agree to the', 'webqx-healthcare'); ?>
                <a href="#" target="_blank"><?php esc_html_e('Terms of Service', 'webqx-healthcare'); ?></a>
                <?php esc_html_e('and', 'webqx-healthcare'); ?>
                <a href="#" target="_blank"><?php esc_html_e('Privacy Policy', 'webqx-healthcare'); ?></a>
            </label>
            
            <label class="webqx-checkbox-label">
                <input type="checkbox" id="webqx-hipaa-agreement" name="hipaa_agreement" required />
                <?php esc_html_e('I acknowledge receipt of the', 'webqx-healthcare'); ?>
                <a href="#" target="_blank"><?php esc_html_e('HIPAA Notice of Privacy Practices', 'webqx-healthcare'); ?></a>
            </label>
            
            <label class="webqx-checkbox-label">
                <input type="checkbox" id="webqx-communication-consent" name="communication_consent" />
                <?php esc_html_e('I consent to receive appointment reminders and health information via email and SMS', 'webqx-healthcare'); ?>
            </label>
        </div>

        <!-- Form Actions -->
        <div class="webqx-form-actions">
            <button type="button" class="webqx-btn webqx-btn-secondary" id="webqx-booking-back" style="display: none;">
                <?php esc_html_e('Back', 'webqx-healthcare'); ?>
            </button>
            <button type="submit" class="webqx-btn webqx-btn-primary" id="webqx-booking-submit">
                <?php esc_html_e('Book Appointment', 'webqx-healthcare'); ?>
            </button>
        </div>
    </form>

    <!-- Booking Confirmation -->
    <div id="webqx-booking-confirmation" class="webqx-booking-confirmation" style="display: none;">
        <div class="webqx-success-message">
            <span class="dashicons dashicons-yes-alt"></span>
            <h3><?php esc_html_e('Appointment Booked Successfully!', 'webqx-healthcare'); ?></h3>
            <p><?php esc_html_e('Your appointment request has been submitted and you will receive a confirmation email shortly.', 'webqx-healthcare'); ?></p>
        </div>
        
        <div class="webqx-appointment-details" id="webqx-confirmation-details">
            <!-- Appointment details will be populated here -->
        </div>
        
        <div class="webqx-next-steps">
            <h4><?php esc_html_e('What happens next?', 'webqx-healthcare'); ?></h4>
            <ul>
                <li><?php esc_html_e('You will receive a confirmation email within 15 minutes', 'webqx-healthcare'); ?></li>
                <li><?php esc_html_e('Our office will call to confirm your appointment within 24 hours', 'webqx-healthcare'); ?></li>
                <li><?php esc_html_e('You will receive reminder notifications before your appointment', 'webqx-healthcare'); ?></li>
            </ul>
        </div>
        
        <div class="webqx-confirmation-actions">
            <button class="webqx-btn webqx-btn-primary" onclick="window.print();">
                <?php esc_html_e('Print Confirmation', 'webqx-healthcare'); ?>
            </button>
            <button class="webqx-btn webqx-btn-secondary" id="webqx-book-another">
                <?php esc_html_e('Book Another Appointment', 'webqx-healthcare'); ?>
            </button>
        </div>
    </div>
</div>

<style>
.webqx-form-group-full {
    grid-column: 1 / -1;
}

.webqx-time-selection {
    margin: 20px 0;
    padding: 20px;
    background: #f9f9f9;
    border-radius: 6px;
}

.webqx-time-slots {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
    margin-top: 15px;
}

.webqx-time-slot {
    padding: 10px 15px;
    border: 2px solid #e1e5e9;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
}

.webqx-time-slot:hover {
    border-color: #3498db;
    background: #f0f8ff;
}

.webqx-time-slot.selected {
    border-color: #3498db;
    background: #3498db;
    color: white;
}

.webqx-time-slot:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f5f5f5;
}

.webqx-patient-info,
.webqx-emergency-contact {
    margin: 30px 0;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 6px;
}

.webqx-patient-info h4,
.webqx-emergency-contact h4 {
    margin-top: 0;
    margin-bottom: 20px;
    color: #2c3e50;
}

.webqx-terms-section {
    margin: 30px 0;
    padding: 20px;
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 6px;
}

.webqx-checkbox-label {
    display: block;
    margin-bottom: 10px;
    font-size: 14px;
    line-height: 1.5;
}

.webqx-checkbox-label input[type="checkbox"] {
    margin-right: 8px;
}

.webqx-checkbox-label a {
    color: #3498db;
    text-decoration: underline;
}

.webqx-form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e1e5e9;
}

.webqx-booking-confirmation {
    text-align: center;
    padding: 40px;
}

.webqx-success-message {
    margin-bottom: 30px;
}

.webqx-success-message .dashicons {
    font-size: 48px;
    color: #2ecc71;
    margin-bottom: 15px;
}

.webqx-success-message h3 {
    color: #2c3e50;
    margin-bottom: 10px;
}

.webqx-appointment-details {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 6px;
    margin-bottom: 30px;
}

.webqx-next-steps {
    text-align: left;
    background: #e7f3ff;
    padding: 20px;
    border-radius: 6px;
    margin-bottom: 30px;
}

.webqx-next-steps ul {
    margin: 10px 0 0 20px;
}

.webqx-next-steps li {
    margin-bottom: 5px;
}

.webqx-confirmation-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
}

@media (max-width: 768px) {
    .webqx-form-grid {
        grid-template-columns: 1fr;
    }
    
    .webqx-time-slots {
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    }
    
    .webqx-form-actions {
        flex-direction: column;
        gap: 10px;
    }
    
    .webqx-confirmation-actions {
        flex-direction: column;
    }
}
</style>

<script>
jQuery(document).ready(function($) {
    var currentStep = 1;
    var totalSteps = 3;
    
    // Initialize form
    initializeBookingForm();
    
    function initializeBookingForm() {
        loadProviders();
        initializeDatePicker();
        bindEventHandlers();
    }
    
    function loadProviders() {
        var specialty = $('#webqx-specialty-filter').val();
        
        $.post(webqx_ajax.ajax_url, {
            action: 'webqx_frontend_action',
            frontend_action: 'get_providers',
            specialty: specialty,
            nonce: webqx_ajax.nonce
        }, function(response) {
            if (response.success) {
                populateProviders(response.data.providers);
            }
        });
    }
    
    function populateProviders(providers) {
        var select = $('#webqx-provider-select');
        select.find('option:not(:first)').remove();
        
        providers.forEach(function(provider) {
            select.append('<option value="' + provider.id + '">' + provider.name + ' - ' + provider.specialty + '</option>');
        });
    }
    
    function initializeDatePicker() {
        var today = new Date();
        var maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 3);
        
        $('#webqx-appointment-date').attr({
            'min': today.toISOString().split('T')[0],
            'max': maxDate.toISOString().split('T')[0]
        });
    }
    
    function bindEventHandlers() {
        $('#webqx-specialty-filter').on('change', loadProviders);
        $('#webqx-provider-select, #webqx-appointment-date').on('change', loadTimeSlots);
        $('#webqx-appointment-form').on('submit', submitBooking);
        $('#webqx-book-another').on('click', resetForm);
    }
    
    function loadTimeSlots() {
        var providerId = $('#webqx-provider-select').val();
        var date = $('#webqx-appointment-date').val();
        
        if (!providerId || !date) {
            $('.webqx-time-selection').hide();
            return;
        }
        
        $('.webqx-time-selection').show();
        $('#webqx-appointment-slots').html('<div class="webqx-loading"><span class="webqx-spinner"></span>' + 
                                          '<?php esc_js_e('Loading available times...', 'webqx-healthcare'); ?></div>');
        
        $.post(webqx_ajax.ajax_url, {
            action: 'webqx_frontend_action',
            frontend_action: 'get_available_slots',
            provider_id: providerId,
            date: date,
            nonce: webqx_ajax.nonce
        }, function(response) {
            if (response.success) {
                renderTimeSlots(response.data.slots);
            } else {
                $('#webqx-appointment-slots').html('<p><?php esc_js_e('No available times for this date.', 'webqx-healthcare'); ?></p>');
            }
        });
    }
    
    function renderTimeSlots(slots) {
        var html = '<div class="webqx-time-slots">';
        
        slots.forEach(function(slot) {
            html += '<button type="button" class="webqx-time-slot" data-time="' + slot.time + '">' + 
                    formatTime(slot.time) + '</button>';
        });
        
        html += '</div>';
        $('#webqx-appointment-slots').html(html);
        
        $('.webqx-time-slot').on('click', function() {
            $('.webqx-time-slot').removeClass('selected');
            $(this).addClass('selected');
            $('#webqx-selected-time').val($(this).data('time'));
        });
    }
    
    function submitBooking(e) {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        var submitButton = $('#webqx-booking-submit');
        submitButton.prop('disabled', true).text('<?php esc_js_e('Booking...', 'webqx-healthcare'); ?>');
        
        var formData = $(this).serialize() + '&action=webqx_frontend_action&frontend_action=book_appointment';
        
        $.post(webqx_ajax.ajax_url, formData, function(response) {
            if (response.success) {
                showConfirmation(response.data);
            } else {
                alert(response.data || '<?php esc_js_e('Booking failed. Please try again.', 'webqx-healthcare'); ?>');
            }
        }).always(function() {
            submitButton.prop('disabled', false).text('<?php esc_js_e('Book Appointment', 'webqx-healthcare'); ?>');
        });
    }
    
    function validateForm() {
        var valid = true;
        
        // Check required fields
        $('#webqx-appointment-form [required]').each(function() {
            if (!$(this).val()) {
                $(this).focus();
                valid = false;
                return false;
            }
        });
        
        // Check time selection
        if (!$('#webqx-selected-time').val()) {
            alert('<?php esc_js_e('Please select an appointment time.', 'webqx-healthcare'); ?>');
            valid = false;
        }
        
        // Check terms agreement
        if (!$('#webqx-terms-agreement').is(':checked')) {
            alert('<?php esc_js_e('Please agree to the Terms of Service.', 'webqx-healthcare'); ?>');
            valid = false;
        }
        
        if (!$('#webqx-hipaa-agreement').is(':checked')) {
            alert('<?php esc_js_e('Please acknowledge the HIPAA Notice of Privacy Practices.', 'webqx-healthcare'); ?>');
            valid = false;
        }
        
        return valid;
    }
    
    function showConfirmation(appointmentData) {
        $('#webqx-appointment-form').hide();
        $('#webqx-booking-confirmation').show();
        
        var detailsHtml = '<div class="webqx-appointment-summary">' +
                         '<h4><?php esc_js_e('Appointment Details', 'webqx-healthcare'); ?></h4>' +
                         '<p><strong><?php esc_js_e('Provider:', 'webqx-healthcare'); ?></strong> ' + appointmentData.provider_name + '</p>' +
                         '<p><strong><?php esc_js_e('Date:', 'webqx-healthcare'); ?></strong> ' + appointmentData.date + '</p>' +
                         '<p><strong><?php esc_js_e('Time:', 'webqx-healthcare'); ?></strong> ' + appointmentData.time + '</p>' +
                         '<p><strong><?php esc_js_e('Type:', 'webqx-healthcare'); ?></strong> ' + appointmentData.type + '</p>' +
                         '<p><strong><?php esc_js_e('Confirmation Number:', 'webqx-healthcare'); ?></strong> ' + appointmentData.confirmation_number + '</p>' +
                         '</div>';
        
        $('#webqx-confirmation-details').html(detailsHtml);
    }
    
    function resetForm() {
        $('#webqx-booking-confirmation').hide();
        $('#webqx-appointment-form').show()[0].reset();
        $('.webqx-time-selection').hide();
        $('#webqx-selected-time').val('');
    }
    
    function formatTime(time) {
        var date = new Date('1970-01-01T' + time + 'Z');
        return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
});
</script>