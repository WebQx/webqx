/* WebQX Healthcare Admin JavaScript */

(function($) {
    'use strict';

    // Initialize admin functionality
    $(document).ready(function() {
        initializeConnectionTesting();
        initializeSettingsForm();
        initializeTabs();
        initializeAjaxForms();
    });

    // Connection Testing
    function initializeConnectionTesting() {
        $('#webqx-test-connection').on('click', function(e) {
            e.preventDefault();
            
            var button = $(this);
            var originalText = button.text();
            var backendUrl = $('#webqx_backend_url').val() || button.data('backend-url');
            
            button.prop('disabled', true)
                  .html('<span class="webqx-spinner"></span> Testing...');
            
            $.post(ajaxurl, {
                action: 'webqx_test_connection',
                nonce: webqx_admin_ajax.nonce,
                backend_url: backendUrl
            })
            .done(function(response) {
                if (response.success && response.data.connected) {
                    showConnectionResult('success', 'Connection successful! Backend is responding.');
                } else {
                    var errorMsg = response.data && response.data.error ? response.data.error : 'Connection failed';
                    showConnectionResult('error', 'Connection failed: ' + errorMsg);
                }
            })
            .fail(function() {
                showConnectionResult('error', 'Connection test failed. Please check your settings.');
            })
            .always(function() {
                button.prop('disabled', false).text(originalText);
            });
        });
    }

    // Settings Form
    function initializeSettingsForm() {
        $('#webqx-settings-form').on('submit', function(e) {
            e.preventDefault();
            
            var form = $(this);
            var submitButton = form.find('input[type="submit"]');
            var originalText = submitButton.val();
            
            submitButton.prop('disabled', true).val('Saving...');
            
            var formData = {
                action: 'webqx_save_settings',
                nonce: webqx_admin_ajax.nonce,
                settings: {}
            };
            
            // Collect form data
            form.find('input, select, textarea').each(function() {
                var field = $(this);
                var name = field.attr('name');
                
                if (name && name !== 'submit') {
                    if (field.attr('type') === 'checkbox') {
                        formData.settings[name] = field.is(':checked') ? '1' : '0';
                    } else {
                        formData.settings[name] = field.val();
                    }
                }
            });
            
            $.post(ajaxurl, formData)
                .done(function(response) {
                    if (response.success) {
                        showNotice('success', response.data.message);
                    } else {
                        showNotice('error', response.data.message || 'Settings save failed');
                    }
                })
                .fail(function() {
                    showNotice('error', 'Failed to save settings. Please try again.');
                })
                .always(function() {
                    submitButton.prop('disabled', false).val(originalText);
                });
        });
    }

    // Tab Navigation
    function initializeTabs() {
        $('.webqx-tab-nav a').on('click', function(e) {
            e.preventDefault();
            
            var target = $(this).attr('href');
            var tabNav = $(this).closest('.webqx-tab-nav');
            var tabContainer = tabNav.next('.webqx-tab-container');
            
            // Update active states
            tabNav.find('a').removeClass('nav-tab-active');
            $(this).addClass('nav-tab-active');
            
            // Show/hide tab content
            tabContainer.find('.webqx-tab-content').hide();
            tabContainer.find(target).show();
            
            // Update URL without page reload
            if (history.pushState) {
                var url = new URL(window.location);
                url.searchParams.set('tab', target.substring(1));
                history.pushState({}, '', url);
            }
        });
        
        // Initialize based on URL parameter
        var urlParams = new URLSearchParams(window.location.search);
        var activeTab = urlParams.get('tab');
        if (activeTab) {
            $('.webqx-tab-nav a[href="#' + activeTab + '"]').click();
        }
    }

    // AJAX Forms
    function initializeAjaxForms() {
        $('.webqx-ajax-form').on('submit', function(e) {
            e.preventDefault();
            
            var form = $(this);
            var action = form.data('action');
            var submitButton = form.find('[type="submit"]');
            var originalText = submitButton.val() || submitButton.text();
            
            if (!action) {
                showNotice('error', 'Form action not specified');
                return;
            }
            
            submitButton.prop('disabled', true)
                        .val('Processing...')
                        .text('Processing...');
            
            var formData = form.serialize() + '&action=' + action + '&nonce=' + webqx_admin_ajax.nonce;
            
            $.post(ajaxurl, formData)
                .done(function(response) {
                    if (response.success) {
                        showNotice('success', response.data.message || 'Operation completed successfully');
                        
                        // Trigger custom event for form success
                        form.trigger('webqx:form:success', [response.data]);
                    } else {
                        showNotice('error', response.data.message || 'Operation failed');
                    }
                })
                .fail(function(xhr) {
                    var message = 'Request failed';
                    if (xhr.responseJSON && xhr.responseJSON.data) {
                        message = xhr.responseJSON.data;
                    }
                    showNotice('error', message);
                })
                .always(function() {
                    submitButton.prop('disabled', false)
                                .val(originalText)
                                .text(originalText);
                });
        });
    }

    // Show connection test result
    function showConnectionResult(type, message) {
        var resultDiv = $('#webqx-connection-result');
        
        if (resultDiv.length === 0) {
            resultDiv = $('<div id="webqx-connection-result" class="webqx-connection-result"></div>');
            $('#webqx-test-connection').after(resultDiv);
        }
        
        resultDiv.removeClass('success error')
                 .addClass(type)
                 .html('<span class="dashicons dashicons-' + (type === 'success' ? 'yes-alt' : 'warning') + '"></span> ' + message)
                 .show();
        
        // Auto-hide after 5 seconds
        setTimeout(function() {
            resultDiv.fadeOut();
        }, 5000);
    }

    // Show admin notice
    function showNotice(type, message) {
        var notice = $('<div class="notice notice-' + type + ' is-dismissible"><p>' + message + '</p></div>');
        
        $('.wrap h1').after(notice);
        
        // Auto-dismiss after 5 seconds
        setTimeout(function() {
            notice.fadeOut(function() {
                $(this).remove();
            });
        }, 5000);
        
        // Handle manual dismiss
        notice.find('.notice-dismiss').on('click', function() {
            notice.fadeOut(function() {
                $(this).remove();
            });
        });
    }

    // Real-time validation
    function initializeValidation() {
        // Backend URL validation
        $('#webqx_backend_url').on('blur', function() {
            var url = $(this).val();
            var field = $(this);
            
            if (url && !isValidUrl(url)) {
                field.addClass('webqx-invalid');
                showFieldError(field, 'Please enter a valid URL');
            } else {
                field.removeClass('webqx-invalid');
                hideFieldError(field);
            }
        });
        
        // API timeout validation
        $('#webqx_api_timeout').on('input', function() {
            var timeout = parseInt($(this).val());
            var field = $(this);
            
            if (timeout < 1 || timeout > 300) {
                field.addClass('webqx-invalid');
                showFieldError(field, 'Timeout must be between 1 and 300 seconds');
            } else {
                field.removeClass('webqx-invalid');
                hideFieldError(field);
            }
        });
    }

    // Utility functions
    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    function showFieldError(field, message) {
        var errorDiv = field.next('.webqx-field-error');
        if (errorDiv.length === 0) {
            errorDiv = $('<div class="webqx-field-error" style="color: #d63638; font-size: 12px; margin-top: 4px;"></div>');
            field.after(errorDiv);
        }
        errorDiv.text(message);
    }

    function hideFieldError(field) {
        field.next('.webqx-field-error').remove();
    }

    // Dashboard functionality
    function initializeDashboard() {
        // Refresh stats periodically
        if ($('.webqx-dashboard-wrapper').length > 0) {
            setInterval(refreshDashboardStats, 300000); // 5 minutes
        }
        
        // Handle quick actions
        $('.webqx-quick-action').on('click', function(e) {
            var action = $(this).data('action');
            if (action) {
                handleQuickAction(action);
            }
        });
    }

    function refreshDashboardStats() {
        $.post(ajaxurl, {
            action: 'webqx_get_dashboard_stats',
            nonce: webqx_admin_ajax.nonce
        })
        .done(function(response) {
            if (response.success) {
                updateDashboardStats(response.data);
            }
        });
    }

    function updateDashboardStats(stats) {
        $('.webqx-stat-number').each(function() {
            var card = $(this).closest('.webqx-stat-card');
            var type = card.data('type');
            if (stats[type] !== undefined) {
                $(this).text(stats[type]);
            }
        });
    }

    function handleQuickAction(action) {
        switch (action) {
            case 'sync_data':
                syncBackendData();
                break;
            case 'clear_cache':
                clearCache();
                break;
            case 'export_logs':
                exportLogs();
                break;
            default:
                console.log('Unknown quick action:', action);
        }
    }

    function syncBackendData() {
        var button = $('.webqx-quick-action[data-action="sync_data"]');
        var originalText = button.text();
        
        button.prop('disabled', true).text('Syncing...');
        
        $.post(ajaxurl, {
            action: 'webqx_sync_backend_data',
            nonce: webqx_admin_ajax.nonce
        })
        .done(function(response) {
            if (response.success) {
                showNotice('success', 'Data sync completed successfully');
            } else {
                showNotice('error', 'Data sync failed: ' + (response.data.message || 'Unknown error'));
            }
        })
        .fail(function() {
            showNotice('error', 'Data sync request failed');
        })
        .always(function() {
            button.prop('disabled', false).text(originalText);
        });
    }

    // Initialize validation
    initializeValidation();
    initializeDashboard();

})(jQuery);