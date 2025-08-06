/* WebQX Healthcare Frontend JavaScript */

(function($) {
    'use strict';

    // Initialize frontend functionality
    $(document).ready(function() {
        initializePortals();
        initializeAppointmentBooking();
        initializeProviderDirectory();
        initializeHealthDashboard();
        initializeSecurityFeatures();
    });

    // Portal functionality
    function initializePortals() {
        // Tab navigation
        $('.webqx-portal-nav .webqx-nav-item').on('click', function(e) {
            e.preventDefault();
            
            var target = $(this).data('target');
            var nav = $(this).closest('.webqx-portal-nav');
            var container = nav.siblings('.webqx-portal-content');
            
            // Update active states
            nav.find('.webqx-nav-item').removeClass('active');
            $(this).addClass('active');
            
            // Show/hide content sections
            container.find('.webqx-portal-section').hide();
            container.find('#' + target).show();
            
            // Load section data if needed
            loadSectionData(target);
        });
        
        // Initialize first tab
        $('.webqx-portal-nav .webqx-nav-item:first').click();
    }

    // Appointment booking
    function initializeAppointmentBooking() {
        // Provider selection
        $('#webqx-provider-select').on('change', function() {
            var providerId = $(this).val();
            if (providerId) {
                loadAvailableSlots(providerId);
            } else {
                $('#webqx-appointment-slots').empty();
            }
        });
        
        // Date selection
        $('#webqx-appointment-date').on('change', function() {
            var providerId = $('#webqx-provider-select').val();
            var date = $(this).val();
            
            if (providerId && date) {
                loadAvailableSlots(providerId, date);
            }
        });
        
        // Appointment booking form
        $('#webqx-appointment-form').on('submit', function(e) {
            e.preventDefault();
            submitAppointmentBooking($(this));
        });
        
        // Initialize date picker with restrictions
        initializeDatePicker();
    }

    // Provider directory
    function initializeProviderDirectory() {
        // Filters
        $('.webqx-provider-filter').on('change', function() {
            filterProviders();
        });
        
        // Search
        $('#webqx-provider-search').on('input', debounce(function() {
            searchProviders($(this).val());
        }, 300));
        
        // Load more providers
        $('#webqx-load-more-providers').on('click', function(e) {
            e.preventDefault();
            loadMoreProviders();
        });
        
        // Provider card actions
        $(document).on('click', '.webqx-book-appointment', function(e) {
            e.preventDefault();
            var providerId = $(this).data('provider-id');
            openAppointmentModal(providerId);
        });
        
        // Initial load
        loadProviders();
    }

    // Health dashboard
    function initializeHealthDashboard() {
        // Refresh data
        $('#webqx-refresh-dashboard').on('click', function(e) {
            e.preventDefault();
            refreshHealthData();
        });
        
        // Chart interactions
        initializeHealthCharts();
        
        // Medication reminders
        initializeMedicationReminders();
        
        // Vital signs tracking
        initializeVitalSigns();
        
        // Load initial data
        loadHealthDashboardData();
    }

    // Security features
    function initializeSecurityFeatures() {
        // Session timeout warning
        initializeSessionTimeout();
        
        // HIPAA compliance notices
        showHIPAANotices();
        
        // Secure form handling
        initializeSecureForms();
    }

    // Load section data
    function loadSectionData(section) {
        var loadingHtml = '<div class="webqx-loading"><span class="webqx-spinner"></span>Loading...</div>';
        var container = $('#' + section);
        
        if (container.data('loaded')) {
            return; // Already loaded
        }
        
        container.html(loadingHtml);
        
        $.post(webqx_ajax.ajax_url, {
            action: 'webqx_frontend_action',
            frontend_action: 'load_section',
            section: section,
            nonce: webqx_ajax.nonce
        })
        .done(function(response) {
            if (response.success) {
                container.html(response.data.html);
                container.data('loaded', true);
                
                // Trigger section-specific initialization
                $(document).trigger('webqx:section:loaded', [section, response.data]);
            } else {
                container.html('<div class="webqx-error">Failed to load data: ' + response.data + '</div>');
            }
        })
        .fail(function() {
            container.html('<div class="webqx-error">Failed to load data. Please try again.</div>');
        });
    }

    // Load available appointment slots
    function loadAvailableSlots(providerId, date) {
        var slotsContainer = $('#webqx-appointment-slots');
        slotsContainer.html('<div class="webqx-loading"><span class="webqx-spinner"></span>Loading available times...</div>');
        
        $.post(webqx_ajax.ajax_url, {
            action: 'webqx_frontend_action',
            frontend_action: 'get_available_slots',
            provider_id: providerId,
            date: date,
            nonce: webqx_ajax.nonce
        })
        .done(function(response) {
            if (response.success && response.data.slots) {
                renderAppointmentSlots(response.data.slots);
            } else {
                slotsContainer.html('<p>No available appointments for this date.</p>');
            }
        })
        .fail(function() {
            slotsContainer.html('<p class="webqx-error">Failed to load available times.</p>');
        });
    }

    // Render appointment slots
    function renderAppointmentSlots(slots) {
        var container = $('#webqx-appointment-slots');
        var html = '<div class="webqx-time-slots">';
        
        slots.forEach(function(slot) {
            html += '<button type="button" class="webqx-time-slot" data-time="' + slot.time + '">' + 
                    formatTime(slot.time) + '</button>';
        });
        
        html += '</div>';
        container.html(html);
        
        // Handle slot selection
        container.find('.webqx-time-slot').on('click', function() {
            container.find('.webqx-time-slot').removeClass('selected');
            $(this).addClass('selected');
            $('#webqx-selected-time').val($(this).data('time'));
        });
    }

    // Submit appointment booking
    function submitAppointmentBooking(form) {
        var submitButton = form.find('[type="submit"]');
        var originalText = submitButton.text();
        
        // Validate form
        if (!validateAppointmentForm(form)) {
            return;
        }
        
        submitButton.prop('disabled', true).text('Booking...');
        
        var formData = form.serialize() + '&action=webqx_frontend_action&frontend_action=book_appointment&nonce=' + webqx_ajax.nonce;
        
        $.post(webqx_ajax.ajax_url, formData)
            .done(function(response) {
                if (response.success) {
                    showAlert('success', 'Appointment booked successfully!');
                    form[0].reset();
                    $('#webqx-appointment-slots').empty();
                    
                    // Redirect to appointments page
                    setTimeout(function() {
                        window.location.href = response.data.redirect_url || '#appointments';
                    }, 2000);
                } else {
                    showAlert('error', response.data || 'Failed to book appointment');
                }
            })
            .fail(function() {
                showAlert('error', 'Booking request failed. Please try again.');
            })
            .always(function() {
                submitButton.prop('disabled', false).text(originalText);
            });
    }

    // Filter providers
    function filterProviders() {
        var filters = {};
        
        $('.webqx-provider-filter').each(function() {
            var name = $(this).attr('name');
            var value = $(this).val();
            
            if (value) {
                filters[name] = value;
            }
        });
        
        loadProviders(filters);
    }

    // Search providers
    function searchProviders(query) {
        var filters = { search: query };
        
        $('.webqx-provider-filter').each(function() {
            var name = $(this).attr('name');
            var value = $(this).val();
            
            if (value) {
                filters[name] = value;
            }
        });
        
        loadProviders(filters);
    }

    // Load providers
    function loadProviders(filters) {
        var container = $('#webqx-provider-results');
        container.html('<div class="webqx-loading"><span class="webqx-spinner"></span>Loading providers...</div>');
        
        filters = filters || {};
        filters.action = 'webqx_frontend_action';
        filters.frontend_action = 'get_providers';
        filters.nonce = webqx_ajax.nonce;
        
        $.post(webqx_ajax.ajax_url, filters)
            .done(function(response) {
                if (response.success && response.data.providers) {
                    renderProviders(response.data.providers);
                } else {
                    container.html('<p>No providers found matching your criteria.</p>');
                }
            })
            .fail(function() {
                container.html('<p class="webqx-error">Failed to load providers. Please try again.</p>');
            });
    }

    // Render providers
    function renderProviders(providers) {
        var container = $('#webqx-provider-results');
        var html = '<div class="webqx-provider-grid">';
        
        providers.forEach(function(provider) {
            html += renderProviderCard(provider);
        });
        
        html += '</div>';
        container.html(html);
    }

    // Render provider card
    function renderProviderCard(provider) {
        var rating = provider.rating ? '★'.repeat(Math.floor(provider.rating)) : '';
        
        return '<div class="webqx-provider-card">' +
               '<div class="webqx-provider-name">' + escapeHtml(provider.name) + '</div>' +
               '<div class="webqx-provider-specialty">' + escapeHtml(provider.specialty) + '</div>' +
               '<div class="webqx-provider-rating">' + rating + ' (' + (provider.rating || 'No rating') + ')</div>' +
               '<div class="webqx-provider-info">' + escapeHtml(provider.location) + '</div>' +
               '<div class="webqx-provider-actions">' +
               '<button class="webqx-btn webqx-btn-primary webqx-book-appointment" data-provider-id="' + provider.id + '">' +
               'Book Appointment</button>' +
               '<button class="webqx-btn webqx-btn-secondary" onclick="viewProviderProfile(' + provider.id + ')">' +
               'View Profile</button>' +
               '</div></div>';
    }

    // Initialize date picker
    function initializeDatePicker() {
        var today = new Date();
        var maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 3); // 3 months ahead
        
        $('#webqx-appointment-date').attr({
            'min': today.toISOString().split('T')[0],
            'max': maxDate.toISOString().split('T')[0]
        });
    }

    // Validate appointment form
    function validateAppointmentForm(form) {
        var valid = true;
        
        // Required fields
        form.find('[required]').each(function() {
            if (!$(this).val()) {
                showFieldError($(this), 'This field is required');
                valid = false;
            } else {
                hideFieldError($(this));
            }
        });
        
        // Time slot selection
        if (!$('#webqx-selected-time').val()) {
            showAlert('warning', 'Please select an appointment time');
            valid = false;
        }
        
        return valid;
    }

    // Session timeout handling
    function initializeSessionTimeout() {
        var timeoutWarning = 5 * 60 * 1000; // 5 minutes before timeout
        var sessionTimeout = 30 * 60 * 1000; // 30 minutes total
        
        setTimeout(function() {
            showSessionWarning();
        }, sessionTimeout - timeoutWarning);
        
        setTimeout(function() {
            handleSessionTimeout();
        }, sessionTimeout);
    }

    function showSessionWarning() {
        var modal = $('<div class="webqx-modal webqx-session-warning">' +
                     '<div class="webqx-modal-content">' +
                     '<h3>Session Expiring</h3>' +
                     '<p>Your session will expire in 5 minutes. Would you like to extend it?</p>' +
                     '<div class="webqx-modal-actions">' +
                     '<button class="webqx-btn webqx-btn-primary" id="webqx-extend-session">Extend Session</button>' +
                     '<button class="webqx-btn webqx-btn-secondary" id="webqx-logout-now">Logout Now</button>' +
                     '</div></div></div>');
        
        $('body').append(modal);
        
        modal.find('#webqx-extend-session').on('click', function() {
            extendSession();
            modal.remove();
        });
        
        modal.find('#webqx-logout-now').on('click', function() {
            window.location.href = '/wp-login.php?action=logout';
        });
    }

    function extendSession() {
        $.post(webqx_ajax.ajax_url, {
            action: 'webqx_extend_session',
            nonce: webqx_ajax.nonce
        });
    }

    function handleSessionTimeout() {
        showAlert('warning', 'Your session has expired. You will be redirected to login.');
        setTimeout(function() {
            window.location.href = '/wp-login.php?action=logout&redirect_to=' + encodeURIComponent(window.location.href);
        }, 3000);
    }

    // Utility functions
    function showAlert(type, message) {
        var alertHtml = '<div class="webqx-alert webqx-alert-' + type + '">' +
                       '<span class="dashicons dashicons-' + getAlertIcon(type) + '"></span>' +
                       message + '</div>';
        
        var alert = $(alertHtml);
        $('.webqx-wrapper').prepend(alert);
        
        setTimeout(function() {
            alert.fadeOut(function() { $(this).remove(); });
        }, 5000);
    }

    function getAlertIcon(type) {
        switch(type) {
            case 'success': return 'yes-alt';
            case 'error': return 'warning';
            case 'warning': return 'info';
            default: return 'info';
        }
    }

    function showFieldError(field, message) {
        hideFieldError(field);
        var error = $('<div class="webqx-field-error">' + message + '</div>');
        field.after(error);
        field.addClass('webqx-invalid');
    }

    function hideFieldError(field) {
        field.removeClass('webqx-invalid');
        field.next('.webqx-field-error').remove();
    }

    function formatTime(time) {
        var date = new Date('1970-01-01T' + time + 'Z');
        return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    function escapeHtml(text) {
        return $('<div>').text(text).html();
    }

    function debounce(func, wait) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Global functions for external access
    window.webqxFrontend = {
        loadSectionData: loadSectionData,
        showAlert: showAlert,
        refreshHealthData: function() {
            loadHealthDashboardData();
        }
    };

})(jQuery);