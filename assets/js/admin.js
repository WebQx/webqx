/**
 * Admin JavaScript for WebQX Healthcare Platform
 */

(function($) {
    'use strict';

    // WebQX Admin Handler
    var WebQXAdmin = {
        
        init: function() {
            this.bindEvents();
            this.initConnectionTest();
            this.monitorServerStatus();
        },
        
        bindEvents: function() {
            // Settings form validation
            $('form').on('submit', this.validateSettingsForm);
            
            // Connection test button
            $(document).on('click', '#test-connection', this.testConnection);
            
            // Server URL field validation
            $('#node_server_url').on('blur', this.validateServerUrl);
            
            // Feature toggle dependencies
            $('input[name="enable_telehealth"]').on('change', this.toggleTelehealthSettings);
            $('input[name="enable_lab_results"]').on('change', this.toggleLabSettings);
            
            // EHR system selection
            $('#ehr_system').on('change', this.updateEHRSettings);
            
            // Copy shortcode buttons
            $(document).on('click', '.webqx-copy-shortcode', this.copyShortcode);
        },
        
        validateSettingsForm: function(e) {
            var isValid = true;
            var errors = [];
            
            // Validate Node.js server URL
            var serverUrl = $('#node_server_url').val();
            if (!serverUrl) {
                isValid = false;
                errors.push('Node.js Server URL is required.');
                $('#node_server_url').addClass('error');
            } else if (!WebQXAdmin.isValidUrl(serverUrl)) {
                isValid = false;
                errors.push('Please enter a valid Node.js Server URL (including http:// or https://).');
                $('#node_server_url').addClass('error');
            }
            
            // Validate FHIR endpoint if provided
            var fhirEndpoint = $('#fhir_endpoint').val();
            if (fhirEndpoint && !WebQXAdmin.isValidUrl(fhirEndpoint)) {
                isValid = false;
                errors.push('Please enter a valid FHIR Server Endpoint URL.');
                $('#fhir_endpoint').addClass('error');
            }
            
            // Show validation errors
            if (!isValid) {
                e.preventDefault();
                WebQXAdmin.showValidationErrors(errors);
                return false;
            }
            
            return true;
        },
        
        validateServerUrl: function() {
            var $field = $(this);
            var url = $field.val();
            
            if (url && !WebQXAdmin.isValidUrl(url)) {
                $field.addClass('error');
                WebQXAdmin.showFieldError($field, 'Please enter a valid URL (including http:// or https://).');
            } else {
                $field.removeClass('error');
                WebQXAdmin.clearFieldError($field);
            }
        },
        
        testConnection: function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var $result = $('#connection-result');
            var serverUrl = $('#node_server_url').val();
            
            if (!serverUrl) {
                $result.html('<div class="notice notice-error"><p>Please enter a Node.js Server URL first.</p></div>');
                return;
            }
            
            $button.prop('disabled', true).text('Testing...');
            $result.html('<div class="notice notice-info"><p>Testing connection...</p></div>');
            
            $.ajax({
                url: ajaxurl,
                type: 'POST',
                data: {
                    action: 'webqx_test_connection',
                    server_url: serverUrl,
                    nonce: $('#webqx_test_nonce').val()
                },
                timeout: 15000,
                success: function(response) {
                    if (response.success) {
                        $result.html('<div class="notice notice-success"><p><span class="dashicons dashicons-yes-alt"></span> Connection successful! Server is responding.</p></div>');
                        
                        // Show server information if available
                        if (response.data && response.data.version) {
                            $result.append('<div class="notice notice-info"><p>WebQX Server Version: ' + response.data.version + '</p></div>');
                        }
                    } else {
                        var errorMessage = response.data || 'Connection failed';
                        $result.html('<div class="notice notice-error"><p><span class="dashicons dashicons-dismiss"></span> ' + errorMessage + '</p></div>');
                    }
                },
                error: function(xhr, status, error) {
                    var errorMessage = 'Connection test failed: ';
                    
                    if (status === 'timeout') {
                        errorMessage += 'Request timed out. Please check if the server is running.';
                    } else if (xhr.status === 0) {
                        errorMessage += 'Network error. Please check your server URL and network connection.';
                    } else {
                        errorMessage += error || 'Unknown error occurred';
                    }
                    
                    $result.html('<div class="notice notice-error"><p><span class="dashicons dashicons-dismiss"></span> ' + errorMessage + '</p></div>');
                },
                complete: function() {
                    $button.prop('disabled', false).text('Test Connection');
                }
            });
        },
        
        monitorServerStatus: function() {
            // Only monitor if we're on the main admin page
            if (!$('.webqx-status-indicator').length) {
                return;
            }
            
            // Check server status every 30 seconds
            setInterval(function() {
                WebQXAdmin.checkServerStatus();
            }, 30000);
        },
        
        checkServerStatus: function() {
            $.ajax({
                url: ajaxurl,
                type: 'POST',
                data: {
                    action: 'webqx_server_status',
                    nonce: webqx_admin.nonce
                },
                success: function(response) {
                    var $indicator = $('.webqx-status-indicator');
                    
                    if (response.success) {
                        $indicator.removeClass('offline').addClass('online')
                            .html('<span class="dashicons dashicons-yes-alt"></span> Server Online');
                    } else {
                        $indicator.removeClass('online').addClass('offline')
                            .html('<span class="dashicons dashicons-dismiss"></span> Server Offline');
                    }
                },
                error: function() {
                    $('.webqx-status-indicator').removeClass('online').addClass('offline')
                        .html('<span class="dashicons dashicons-dismiss"></span> Server Offline');
                }
            });
        },
        
        toggleTelehealthSettings: function() {
            var isEnabled = $(this).is(':checked');
            var $telehealthSettings = $('.telehealth-settings');
            
            if (isEnabled) {
                $telehealthSettings.slideDown();
            } else {
                $telehealthSettings.slideUp();
            }
        },
        
        toggleLabSettings: function() {
            var isEnabled = $(this).is(':checked');
            var $labSettings = $('.lab-settings');
            
            if (isEnabled) {
                $labSettings.slideDown();
            } else {
                $labSettings.slideUp();
            }
        },
        
        updateEHRSettings: function() {
            var selectedSystem = $(this).val();
            var $ehrSettings = $('.ehr-specific-settings');
            
            // Hide all EHR-specific settings
            $ehrSettings.hide();
            
            // Show relevant settings based on selection
            if (selectedSystem) {
                $('.ehr-settings-' + selectedSystem).show();
            }
            
            // Update help text
            var helpTexts = {
                'openemr': 'OpenEMR integration uses REST API endpoints. Ensure your OpenEMR installation has API access enabled.',
                'openmrs': 'OpenMRS integration requires the REST Web Services module to be installed and configured.',
                'epic': 'Epic integration uses FHIR R4 APIs. You will need Epic App Orchard credentials.',
                'cerner': 'Cerner integration uses SMART on FHIR. Register your application with Cerner.',
                'custom': 'For custom EHR systems, ensure your API endpoints follow HL7 FHIR R4 standards.'
            };
            
            if (helpTexts[selectedSystem]) {
                $('#ehr-help-text').html('<p class="description">' + helpTexts[selectedSystem] + '</p>');
            } else {
                $('#ehr-help-text').empty();
            }
        },
        
        copyShortcode: function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var shortcode = $button.data('shortcode');
            
            // Create temporary textarea for copying
            var $temp = $('<textarea>');
            $('body').append($temp);
            $temp.val(shortcode).select();
            document.execCommand('copy');
            $temp.remove();
            
            // Show feedback
            var originalText = $button.text();
            $button.text('Copied!').prop('disabled', true);
            
            setTimeout(function() {
                $button.text(originalText).prop('disabled', false);
            }, 2000);
        },
        
        initConnectionTest: function() {
            // Add hidden nonce field for connection testing
            if ($('#test-connection').length && !$('#webqx_test_nonce').length) {
                $('<input>').attr({
                    type: 'hidden',
                    id: 'webqx_test_nonce',
                    value: webqx_admin.test_nonce
                }).appendTo('body');
            }
        },
        
        // Utility functions
        isValidUrl: function(string) {
            try {
                var url = new URL(string);
                return url.protocol === 'http:' || url.protocol === 'https:';
            } catch (_) {
                return false;
            }
        },
        
        showValidationErrors: function(errors) {
            var $errorContainer = $('#webqx-validation-errors');
            
            if (!$errorContainer.length) {
                $errorContainer = $('<div id="webqx-validation-errors" class="notice notice-error"></div>');
                $('h1').after($errorContainer);
            }
            
            var errorHtml = '<p><strong>Please correct the following errors:</strong></p><ul>';
            errors.forEach(function(error) {
                errorHtml += '<li>' + error + '</li>';
            });
            errorHtml += '</ul>';
            
            $errorContainer.html(errorHtml).show();
            
            // Scroll to errors
            $('html, body').animate({
                scrollTop: $errorContainer.offset().top - 50
            }, 500);
        },
        
        showFieldError: function($field, message) {
            var $error = $field.next('.field-error');
            
            if (!$error.length) {
                $error = $('<div class="field-error"></div>');
                $field.after($error);
            }
            
            $error.html('<p style="color: #d63638; margin: 5px 0;">' + message + '</p>').show();
        },
        
        clearFieldError: function($field) {
            $field.next('.field-error').remove();
        }
    };
    
    // Initialize when document is ready
    $(document).ready(function() {
        WebQXAdmin.init();
    });
    
    // Expose to global scope
    window.WebQXAdmin = WebQXAdmin;
    
})(jQuery);

// Add copy buttons to shortcode examples
(function($) {
    $(document).ready(function() {
        $('.webqx-shortcode-item code').each(function() {
            var $code = $(this);
            var shortcode = $code.text();
            
            var $copyButton = $('<button type="button" class="button button-small webqx-copy-shortcode" data-shortcode="' + shortcode + '">Copy</button>');
            
            $code.after($copyButton);
        });
    });
})(jQuery);