/**
 * Frontend JavaScript for WebQX Healthcare Platform
 */

(function($) {
    'use strict';

    // WebQX Healthcare Frontend Handler
    var WebQXFrontend = {
        
        init: function() {
            this.bindEvents();
            this.initIframes();
            this.checkConnectivity();
        },
        
        bindEvents: function() {
            // Handle iframe communication
            $(window).on('message', this.handleIframeMessage);
            
            // Handle connection errors
            $(document).on('webqx:connection-error', this.handleConnectionError);
            
            // Handle authentication events
            $(document).on('webqx:auth-required', this.handleAuthRequired);
        },
        
        initIframes: function() {
            // Set up iframe security and communication
            $('iframe[id^="webqx-"]').each(function() {
                var $iframe = $(this);
                var iframeId = $iframe.attr('id');
                
                // Add load event handlers
                $iframe.on('load', function() {
                    WebQXFrontend.onIframeLoad($iframe);
                });
                
                // Add error event handlers
                $iframe.on('error', function() {
                    WebQXFrontend.onIframeError($iframe);
                });
                
                // Set up periodic health checks
                if (webqx_ajax && webqx_ajax.node_server_url) {
                    setTimeout(function() {
                        WebQXFrontend.healthCheck($iframe);
                    }, 5000);
                }
            });
        },
        
        onIframeLoad: function($iframe) {
            var $container = $iframe.closest('.webqx-iframe-container');
            var $loading = $container.find('.webqx-loading');
            
            // Hide loading indicator
            $loading.hide();
            $iframe.show();
            
            // Set up cross-frame communication
            this.setupFrameCommunication($iframe);
            
            // Trigger loaded event
            $iframe.trigger('webqx:iframe-loaded');
        },
        
        onIframeError: function($iframe) {
            var $container = $iframe.closest('.webqx-iframe-container');
            var $loading = $container.find('.webqx-loading');
            
            $loading.html('<div class="webqx-error">' +
                '<p>Failed to load WebQX component. Please check your connection and try again.</p>' +
                '<button type="button" class="button button-secondary webqx-retry">Retry</button>' +
                '</div>');
            
            // Add retry functionality
            $loading.find('.webqx-retry').on('click', function() {
                location.reload();
            });
        },
        
        setupFrameCommunication: function($iframe) {
            // Send WordPress user context to iframe
            var userData = {
                wpUserId: webqx_ajax.wp_user_id || null,
                nonce: webqx_ajax.nonce,
                action: 'webqx_user_context'
            };
            
            // Wait for iframe to be ready
            setTimeout(function() {
                if ($iframe[0].contentWindow) {
                    $iframe[0].contentWindow.postMessage({
                        type: 'webqx-wp-context',
                        data: userData
                    }, '*');
                }
            }, 1000);
        },
        
        handleIframeMessage: function(event) {
            var data = event.originalEvent.data;
            
            if (!data || typeof data !== 'object' || !data.type) {
                return;
            }
            
            switch (data.type) {
                case 'webqx-height-change':
                    WebQXFrontend.adjustIframeHeight(data.height);
                    break;
                    
                case 'webqx-navigation':
                    WebQXFrontend.handleNavigation(data.url);
                    break;
                    
                case 'webqx-error':
                    WebQXFrontend.handleWebQXError(data.error);
                    break;
                    
                case 'webqx-auth-check':
                    WebQXFrontend.verifyAuthentication();
                    break;
                    
                case 'webqx-notification':
                    WebQXFrontend.showNotification(data.message, data.type);
                    break;
            }
        },
        
        adjustIframeHeight: function(height) {
            if (height && height > 200) {
                $('iframe[id^="webqx-"]').css('height', height + 'px');
            }
        },
        
        handleNavigation: function(url) {
            if (url && typeof url === 'string') {
                window.location.href = url;
            }
        },
        
        handleWebQXError: function(error) {
            console.error('WebQX Error:', error);
            this.showNotification('A system error occurred. Please try again later.', 'error');
        },
        
        verifyAuthentication: function() {
            $.ajax({
                url: webqx_ajax.ajax_url,
                type: 'POST',
                data: {
                    action: 'webqx_verify_auth',
                    nonce: webqx_ajax.nonce
                },
                success: function(response) {
                    $('iframe[id^="webqx-"]').each(function() {
                        if (this.contentWindow) {
                            this.contentWindow.postMessage({
                                type: 'webqx-auth-status',
                                authenticated: response.success,
                                user: response.data
                            }, '*');
                        }
                    });
                }
            });
        },
        
        showNotification: function(message, type) {
            type = type || 'info';
            
            var $notification = $('<div class="webqx-notification webqx-notification-' + type + '">' +
                '<p>' + message + '</p>' +
                '<button type="button" class="webqx-notification-close">&times;</button>' +
                '</div>');
            
            $('body').append($notification);
            
            // Auto-hide after 5 seconds
            setTimeout(function() {
                $notification.fadeOut(300, function() {
                    $(this).remove();
                });
            }, 5000);
            
            // Manual close
            $notification.find('.webqx-notification-close').on('click', function() {
                $notification.fadeOut(300, function() {
                    $(this).remove();
                });
            });
        },
        
        checkConnectivity: function() {
            if (!webqx_ajax || !webqx_ajax.node_server_url) {
                return;
            }
            
            // Periodic health check every 30 seconds
            setInterval(function() {
                WebQXFrontend.healthCheck();
            }, 30000);
        },
        
        healthCheck: function($iframe) {
            $.ajax({
                url: webqx_ajax.ajax_url,
                type: 'POST',
                data: {
                    action: 'webqx_health_check',
                    nonce: webqx_ajax.nonce
                },
                timeout: 10000,
                success: function(response) {
                    if (!response.success) {
                        WebQXFrontend.handleConnectionError();
                    }
                },
                error: function() {
                    WebQXFrontend.handleConnectionError();
                }
            });
        },
        
        handleConnectionError: function() {
            $('.webqx-iframe-container iframe').hide();
            $('.webqx-iframe-container .webqx-loading').show().html(
                '<div class="webqx-error">' +
                '<p>Unable to connect to WebQX healthcare services.</p>' +
                '<p>Please check that the Node.js server is running and try again.</p>' +
                '<button type="button" class="button button-secondary webqx-retry">Retry Connection</button>' +
                '</div>'
            );
            
            // Add retry functionality
            $('.webqx-retry').on('click', function() {
                location.reload();
            });
        },
        
        handleAuthRequired: function() {
            var loginUrl = webqx_ajax.login_url || '/wp-login.php';
            this.showNotification('Authentication required. Please log in to continue.', 'warning');
            
            setTimeout(function() {
                window.location.href = loginUrl + '?redirect_to=' + encodeURIComponent(window.location.href);
            }, 2000);
        }
    };
    
    // Utility functions
    WebQXFrontend.utils = {
        
        // Format dates for display
        formatDate: function(dateString) {
            var date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        },
        
        // Sanitize HTML content
        sanitizeHTML: function(html) {
            var div = document.createElement('div');
            div.textContent = html;
            return div.innerHTML;
        },
        
        // Generate unique session IDs
        generateSessionId: function() {
            return 'webqx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        },
        
        // Check if user has required capabilities
        hasCapability: function(capability) {
            return webqx_ajax.user_capabilities && 
                   webqx_ajax.user_capabilities.indexOf(capability) !== -1;
        }
    };
    
    // Initialize when document is ready
    $(document).ready(function() {
        WebQXFrontend.init();
    });
    
    // Expose to global scope for external access
    window.WebQXFrontend = WebQXFrontend;
    
})(jQuery);

// Add notification styles dynamically
(function() {
    var style = document.createElement('style');
    style.textContent = `
        .webqx-notification {
            position: fixed;
            top: 32px;
            right: 20px;
            z-index: 10000;
            min-width: 300px;
            max-width: 400px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 15px 40px 15px 15px;
            margin-bottom: 10px;
        }
        
        .webqx-notification-info {
            border-left: 4px solid #0073aa;
        }
        
        .webqx-notification-success {
            border-left: 4px solid #00a32a;
        }
        
        .webqx-notification-warning {
            border-left: 4px solid #dba617;
        }
        
        .webqx-notification-error {
            border-left: 4px solid #d63638;
        }
        
        .webqx-notification p {
            margin: 0;
            color: #333;
        }
        
        .webqx-notification-close {
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #999;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .webqx-notification-close:hover {
            color: #666;
        }
    `;
    
    document.head.appendChild(style);
})();