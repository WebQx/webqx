/**
 * WebQX Integration Plugin JavaScript
 * Version: 1.0.0
 */

(function($) {
    'use strict';
    
    // Global WebQX object
    window.WebQX = window.WebQX || {};
    
    /**
     * Initialize WebQX functionality
     */
    $(document).ready(function() {
        WebQX.init();
    });
    
    /**
     * Main WebQX object
     */
    WebQX = {
        
        /**
         * Initialize WebQX
         */
        init: function() {
            this.bindEvents();
            this.initModules();
        },
        
        /**
         * Bind global events
         */
        bindEvents: function() {
            // Navigation buttons
            $(document).on('click', '.webqx-nav-btn', this.handleNavigation);
            
            // Tab buttons
            $(document).on('click', '.webqx-tab-btn', this.handleTabSwitch);
            
            // Form submissions
            $(document).on('click', '#webqx-book-appointment', this.handleAppointmentBooking);
            $(document).on('click', '#webqx-send-message', this.handleMessageSend);
            $(document).on('click', '#webqx-test-fhir', this.handleFHIRTest);
        },
        
        /**
         * Initialize modules
         */
        initModules: function() {
            // Auto-load any WebQX modules on the page
            $('.webqx-patient-portal').each(function() {
                var view = $(this).find('.webqx-nav-btn.active').data('view') || 'dashboard';
                webqxLoadPatientPortal(view);
            });
            
            $('.webqx-provider-panel').each(function() {
                var view = $(this).find('.webqx-nav-btn.active').data('view') || 'dashboard';
                webqxLoadProviderPanel(view);
            });
        },
        
        /**
         * Handle navigation clicks
         */
        handleNavigation: function(e) {
            e.preventDefault();
            
            var $btn = $(this);
            var view = $btn.data('view');
            var $container = $btn.closest('.webqx-patient-portal, .webqx-provider-panel');
            
            // Update active state
            $btn.siblings('.webqx-nav-btn').removeClass('active');
            $btn.addClass('active');
            
            // Load appropriate content
            if ($container.hasClass('webqx-patient-portal')) {
                webqxLoadPatientPortal(view);
            } else if ($container.hasClass('webqx-provider-panel')) {
                webqxLoadProviderPanel(view);
            }
        },
        
        /**
         * Handle tab switching
         */
        handleTabSwitch: function(e) {
            e.preventDefault();
            
            var $btn = $(this);
            var status = $btn.data('status');
            
            // Update active state
            $btn.siblings('.webqx-tab-btn').removeClass('active');
            $btn.addClass('active');
            
            // Load content based on context
            if ($btn.closest('.webqx-prescriptions').length) {
                webqxLoadPrescriptions(status);
            }
        },
        
        /**
         * Handle appointment booking
         */
        handleAppointmentBooking: function(e) {
            e.preventDefault();
            
            var appointmentData = {
                type: $('#webqx-appointment-type').val(),
                date: $('#webqx-appointment-date').val(),
                time: $('#webqx-appointment-time').val(),
                notes: $('#webqx-appointment-notes').val()
            };
            
            if (!appointmentData.type || !appointmentData.date || !appointmentData.time) {
                WebQX.showError('Please fill in all required fields.');
                return;
            }
            
            WebQX.apiCall('appointments', 'POST', appointmentData, function(response) {
                if (response.success) {
                    WebQX.showSuccess('Appointment booked successfully!');
                    $('#webqx-booking-result').html('<div class="webqx-success">Appointment booked for ' + appointmentData.date + ' at ' + appointmentData.time + '</div>').show();
                } else {
                    WebQX.showError('Failed to book appointment: ' + response.message);
                }
            });
        },
        
        /**
         * Handle message sending
         */
        handleMessageSend: function(e) {
            e.preventDefault();
            
            var message = $('#webqx-new-message').val().trim();
            
            if (!message) {
                WebQX.showError('Please enter a message.');
                return;
            }
            
            WebQX.apiCall('messages', 'POST', { message: message }, function(response) {
                if (response.success) {
                    $('#webqx-new-message').val('');
                    webqxLoadSecureMessaging(); // Reload messages
                } else {
                    WebQX.showError('Failed to send message: ' + response.message);
                }
            });
        },
        
        /**
         * Handle FHIR testing
         */
        handleFHIRTest: function(e) {
            e.preventDefault();
            
            var resourceType = $('#webqx-fhir-resource').val();
            var method = $('#webqx-fhir-method').val();
            var resourceId = $('#webqx-fhir-id').val();
            
            var endpoint = 'fhir/' + resourceType;
            if (resourceId) {
                endpoint += '/' + resourceId;
            }
            
            WebQX.apiCall(endpoint, method, null, function(response) {
                $('#webqx-fhir-response-content').text(JSON.stringify(response, null, 2));
                $('#webqx-fhir-response').show();
            });
        },
        
        /**
         * Make API call to WebQX REST API
         */
        apiCall: function(endpoint, method, data, callback) {
            method = method || 'GET';
            
            var ajaxData = {
                url: webqx_integration.ajax_url,
                type: 'POST',
                data: {
                    action: 'webqx_api_call',
                    nonce: webqx_integration.nonce,
                    endpoint: endpoint,
                    method: method
                },
                success: function(response) {
                    try {
                        var parsedResponse = JSON.parse(response);
                        if (callback) callback(parsedResponse);
                    } catch (e) {
                        console.error('Failed to parse API response:', e);
                        if (callback) callback({ success: false, message: 'Invalid response format' });
                    }
                },
                error: function(xhr, status, error) {
                    console.error('API call failed:', error);
                    if (callback) callback({ success: false, message: 'Network error: ' + error });
                }
            };
            
            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                ajaxData.data.data = JSON.stringify(data);
            }
            
            $.ajax(ajaxData);
        },
        
        /**
         * Show loading state
         */
        showLoading: function(container) {
            $(container).html('<div class="webqx-loading">Loading...</div>');
        },
        
        /**
         * Show error message
         */
        showError: function(message, container) {
            var errorHtml = '<div class="webqx-error">' + message + '</div>';
            if (container) {
                $(container).html(errorHtml);
            } else {
                // Show global error notification
                $('body').prepend('<div class="webqx-global-error">' + errorHtml + '</div>');
                setTimeout(function() {
                    $('.webqx-global-error').fadeOut();
                }, 5000);
            }
        },
        
        /**
         * Show success message
         */
        showSuccess: function(message, container) {
            var successHtml = '<div class="webqx-success">' + message + '</div>';
            if (container) {
                $(container).html(successHtml);
            } else {
                // Show global success notification
                $('body').prepend('<div class="webqx-global-success">' + successHtml + '</div>');
                setTimeout(function() {
                    $('.webqx-global-success').fadeOut();
                }, 3000);
            }
        }
    };
    
    /**
     * Load Patient Portal content
     */
    window.webqxLoadPatientPortal = function(view) {
        view = view || 'dashboard';
        
        var $loading = $('#webqx-portal-loading');
        var $content = $('#webqx-portal-data');
        var $error = $('#webqx-portal-error');
        
        $loading.show();
        $content.hide();
        $error.hide();
        
        WebQX.apiCall('patient/portal/' + view, 'GET', null, function(response) {
            $loading.hide();
            
            if (response.success) {
                $content.html(response.data.html || response.data).addClass('webqx-fade-in').show();
            } else {
                $error.html('Failed to load patient portal: ' + (response.message || 'Unknown error')).show();
            }
        });
    };
    
    /**
     * Load Provider Panel content
     */
    window.webqxLoadProviderPanel = function(view) {
        view = view || 'dashboard';
        
        var $loading = $('#webqx-panel-loading');
        var $content = $('#webqx-panel-data');
        
        $loading.show();
        $content.hide();
        
        WebQX.apiCall('provider/panel/' + view, 'GET', null, function(response) {
            $loading.hide();
            
            if (response.success) {
                $content.html(response.data.html || response.data).addClass('webqx-fade-in').show();
            } else {
                $content.html('<div class="webqx-error">Failed to load provider panel: ' + (response.message || 'Unknown error') + '</div>').show();
            }
        });
    };
    
    /**
     * Initialize appointment booking
     */
    window.webqxInitAppointmentBooking = function() {
        // Load available time slots when date changes
        $('#webqx-appointment-date').on('change', function() {
            var selectedDate = $(this).val();
            if (selectedDate) {
                WebQX.apiCall('appointments/slots?date=' + selectedDate, 'GET', null, function(response) {
                    var $timeSelect = $('#webqx-appointment-time');
                    $timeSelect.empty().append('<option value="">Select time slot</option>');
                    
                    if (response.success && response.data.slots) {
                        response.data.slots.forEach(function(slot) {
                            $timeSelect.append('<option value="' + slot.time + '">' + slot.time + ' (' + slot.duration + ')</option>');
                        });
                    }
                });
            }
        });
    };
    
    /**
     * Load medical records
     */
    window.webqxLoadMedicalRecords = function(type) {
        type = type || 'all';
        
        var $content = $('#webqx-records-content');
        WebQX.showLoading($content);
        
        WebQX.apiCall('medical-records?type=' + type, 'GET', null, function(response) {
            if (response.success) {
                var html = '';
                if (response.data.records && response.data.records.length > 0) {
                    response.data.records.forEach(function(record) {
                        html += '<div class="webqx-record-item">';
                        html += '<h5>' + record.title + '</h5>';
                        html += '<p>' + record.date + ' - ' + record.provider + '</p>';
                        html += '<p>' + record.summary + '</p>';
                        html += '</div>';
                    });
                } else {
                    html = '<p>No medical records found.</p>';
                }
                $content.html(html);
            } else {
                WebQX.showError('Failed to load medical records: ' + (response.message || 'Unknown error'), $content);
            }
        });
        
        // Update filter
        $('#webqx-records-type').val(type);
    };
    
    /**
     * Load secure messaging
     */
    window.webqxLoadSecureMessaging = function() {
        var $threads = $('#webqx-message-threads');
        WebQX.showLoading($threads);
        
        WebQX.apiCall('messages', 'GET', null, function(response) {
            if (response.success) {
                var html = '';
                if (response.data.threads && response.data.threads.length > 0) {
                    response.data.threads.forEach(function(thread) {
                        html += '<div class="webqx-message-thread">';
                        html += '<h5>' + thread.subject + '</h5>';
                        html += '<p><strong>' + thread.from + '</strong> - ' + thread.date + '</p>';
                        html += '<p>' + thread.preview + '</p>';
                        html += '</div>';
                    });
                } else {
                    html = '<p>No messages found.</p>';
                }
                $threads.html(html);
                $('#webqx-message-composer').show();
            } else {
                WebQX.showError('Failed to load messages: ' + (response.message || 'Unknown error'), $threads);
            }
        });
    };
    
    /**
     * Load prescriptions
     */
    window.webqxLoadPrescriptions = function(status) {
        status = status || 'active';
        
        var $list = $('#webqx-prescription-list');
        WebQX.showLoading($list);
        
        WebQX.apiCall('prescriptions?status=' + status, 'GET', null, function(response) {
            if (response.success) {
                var html = '';
                if (response.data.prescriptions && response.data.prescriptions.length > 0) {
                    response.data.prescriptions.forEach(function(prescription) {
                        html += '<div class="webqx-prescription-item">';
                        html += '<h5>' + prescription.medication + '</h5>';
                        html += '<p><strong>Dosage:</strong> ' + prescription.dosage + '</p>';
                        html += '<p><strong>Prescribed:</strong> ' + prescription.date + '</p>';
                        html += '<p><strong>Provider:</strong> ' + prescription.provider + '</p>';
                        if (prescription.refills_remaining) {
                            html += '<p><strong>Refills remaining:</strong> ' + prescription.refills_remaining + '</p>';
                        }
                        html += '</div>';
                    });
                } else {
                    html = '<p>No prescriptions found.</p>';
                }
                $list.html(html);
            } else {
                WebQX.showError('Failed to load prescriptions: ' + (response.message || 'Unknown error'), $list);
            }
        });
    };
    
    /**
     * Load EHR Dashboard
     */
    window.webqxLoadEHRDashboard = function() {
        WebQX.apiCall('provider/dashboard', 'GET', null, function(response) {
            if (response.success) {
                var data = response.data;
                $('#webqx-today-patients').text(data.today_patients || '0');
                $('#webqx-pending-notes').text(data.pending_notes || '0');
                $('#webqx-system-status').text(data.system_status || 'Unknown').removeClass().addClass('webqx-stat-status');
                
                var $content = $('#webqx-ehr-content');
                var html = '<h5>Recent Activity</h5>';
                if (data.recent_activity && data.recent_activity.length > 0) {
                    html += '<ul>';
                    data.recent_activity.forEach(function(activity) {
                        html += '<li>' + activity.description + ' - ' + activity.time + '</li>';
                    });
                    html += '</ul>';
                } else {
                    html += '<p>No recent activity.</p>';
                }
                $content.html(html);
            } else {
                WebQX.showError('Failed to load EHR dashboard: ' + (response.message || 'Unknown error'), '#webqx-ehr-content');
            }
        });
    };
    
    /**
     * Load clinical alerts
     */
    window.webqxLoadClinicalAlerts = function() {
        var $list = $('#webqx-alerts-list');
        WebQX.showLoading($list);
        
        WebQX.apiCall('clinical-alerts', 'GET', null, function(response) {
            if (response.success) {
                var html = '';
                if (response.data.alerts && response.data.alerts.length > 0) {
                    response.data.alerts.forEach(function(alert) {
                        html += '<div class="webqx-alert-item webqx-alert-' + alert.severity + '">';
                        html += '<h5>' + alert.title + '</h5>';
                        html += '<p>' + alert.description + '</p>';
                        html += '<small>' + alert.time + '</small>';
                        html += '</div>';
                    });
                } else {
                    html = '<p>No clinical alerts.</p>';
                }
                $list.html(html);
            } else {
                WebQX.showError('Failed to load clinical alerts: ' + (response.message || 'Unknown error'), $list);
            }
        });
    };
    
    /**
     * Initialize voice transcription
     */
    window.webqxInitVoiceTranscription = function() {
        // This would integrate with the WebQX Whisper service
        $('#webqx-start-recording').on('click', function() {
            // Start recording logic here
            $(this).prop('disabled', true);
            $('#webqx-stop-recording').prop('disabled', false);
            $('#webqx-transcription-text').val('Recording started...');
        });
        
        $('#webqx-stop-recording').on('click', function() {
            // Stop recording logic here
            $(this).prop('disabled', true);
            $('#webqx-start-recording').prop('disabled', false);
            $('#webqx-transcription-text').val('Transcription complete.');
        });
        
        $('#webqx-clear-transcription').on('click', function() {
            $('#webqx-transcription-text').val('');
        });
        
        $('#webqx-save-transcription').on('click', function() {
            var text = $('#webqx-transcription-text').val();
            if (text) {
                WebQX.apiCall('transcription/save', 'POST', { text: text }, function(response) {
                    if (response.success) {
                        WebQX.showSuccess('Transcription saved to EHR.');
                    } else {
                        WebQX.showError('Failed to save transcription: ' + (response.message || 'Unknown error'));
                    }
                });
            }
        });
    };
    
    /**
     * Load PACS viewer
     */
    window.webqxLoadPACSViewer = function(studyId) {
        var $content = $('#webqx-pacs-content');
        WebQX.showLoading($content);
        
        var endpoint = 'pacs/studies';
        if (studyId) {
            endpoint += '/' + studyId;
        }
        
        WebQX.apiCall(endpoint, 'GET', null, function(response) {
            if (response.success) {
                var html = '<div class="webqx-pacs-studies">';
                if (response.data.studies && response.data.studies.length > 0) {
                    response.data.studies.forEach(function(study) {
                        html += '<div class="webqx-study-item">';
                        html += '<h5>' + study.description + '</h5>';
                        html += '<p>Date: ' + study.date + '</p>';
                        html += '<p>Modality: ' + study.modality + '</p>';
                        html += '</div>';
                    });
                } else {
                    html += '<p>No imaging studies found.</p>';
                }
                html += '</div>';
                $content.html(html);
            } else {
                WebQX.showError('Failed to load PACS data: ' + (response.message || 'Unknown error'), $content);
            }
        });
    };
    
    /**
     * Initialize FHIR tester
     */
    window.webqxInitFHIRTester = function() {
        $('#webqx-test-fhir').on('click', function() {
            var $btn = $(this);
            var originalText = $btn.text();
            
            $btn.text('Testing...').prop('disabled', true);
            
            setTimeout(function() {
                $btn.text(originalText).prop('disabled', false);
            }, 2000);
        });
    };
    
})(jQuery);