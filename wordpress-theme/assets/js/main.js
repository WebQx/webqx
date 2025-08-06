/**
 * WebQx Healthcare Theme JavaScript
 * 
 * @package WebQx_Healthcare_Theme
 * @since 1.0.0
 */

(function($) {
    'use strict';

    $(document).ready(function() {
        
        // Mobile Navigation Toggle
        $('.menu-toggle').on('click', function() {
            var $button = $(this);
            var $navigation = $('#site-navigation');
            var isExpanded = $button.attr('aria-expanded') === 'true';
            
            $button.attr('aria-expanded', !isExpanded);
            $navigation.toggleClass('toggled');
            
            // Focus management for accessibility
            if (!isExpanded) {
                $navigation.find('a:first').focus();
            }
        });

        // Dropdown menu accessibility for keyboard navigation
        $('.main-navigation .menu-item-has-children > a').on('focus blur', function() {
            $(this).parents('.menu-item-has-children').toggleClass('focus');
        });

        // Healthcare form validation and accessibility
        $('form').each(function() {
            var $form = $(this);
            
            // Add aria-describedby for form fields with help text
            $form.find('input, textarea, select').each(function() {
                var $field = $(this);
                var fieldId = $field.attr('id');
                var $helpText = $field.siblings('.help-text, .description');
                
                if (fieldId && $helpText.length) {
                    var helpId = fieldId + '-help';
                    $helpText.attr('id', helpId);
                    $field.attr('aria-describedby', helpId);
                }
            });
            
            // Form submission validation
            $form.on('submit', function(e) {
                var isValid = true;
                var firstInvalidField = null;
                
                $(this).find('[required]').each(function() {
                    var $field = $(this);
                    var value = $field.val().trim();
                    
                    if (!value) {
                        $field.addClass('error').attr('aria-invalid', 'true');
                        
                        if (!firstInvalidField) {
                            firstInvalidField = $field;
                        }
                        
                        isValid = false;
                    } else {
                        $field.removeClass('error').removeAttr('aria-invalid');
                        
                        // Email validation
                        if ($field.attr('type') === 'email' && !isValidEmail(value)) {
                            $field.addClass('error').attr('aria-invalid', 'true');
                            if (!firstInvalidField) {
                                firstInvalidField = $field;
                            }
                            isValid = false;
                        }
                    }
                });
                
                if (!isValid) {
                    e.preventDefault();
                    
                    // Focus first invalid field
                    if (firstInvalidField) {
                        firstInvalidField.focus();
                        
                        // Show error message
                        showFormError('Please fill in all required fields correctly.');
                    }
                }
            });
            
            // Real-time validation feedback
            $form.find('input, textarea, select').on('blur', function() {
                var $field = $(this);
                var value = $field.val().trim();
                
                if ($field.attr('required') && !value) {
                    $field.addClass('error').attr('aria-invalid', 'true');
                } else {
                    $field.removeClass('error').removeAttr('aria-invalid');
                }
            });
        });

        // Medical disclaimer auto-hide functionality
        $('.medical-disclaimer').each(function() {
            var $disclaimer = $(this);
            var hideTimeout;
            
            // Auto-hide after 15 seconds
            hideTimeout = setTimeout(function() {
                $disclaimer.fadeOut(500);
            }, 15000);
            
            // Cancel auto-hide on user interaction
            $disclaimer.on('mouseenter focus', function() {
                clearTimeout(hideTimeout);
                $(this).stop().fadeIn(200);
            });
            
            // Add close button
            if (!$disclaimer.find('.close-disclaimer').length) {
                $disclaimer.append('<button type="button" class="close-disclaimer" aria-label="Close disclaimer">&times;</button>');
            }
            
            $disclaimer.find('.close-disclaimer').on('click', function() {
                $disclaimer.fadeOut(300);
            });
        });

        // Smooth scrolling for anchor links
        $('a[href*="#"]:not([href="#"])').on('click', function() {
            if (location.pathname.replace(/^\//, '') === this.pathname.replace(/^\//, '') && 
                location.hostname === this.hostname) {
                
                var target = $(this.hash);
                target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
                
                if (target.length) {
                    $('html, body').animate({
                        scrollTop: target.offset().top - 100
                    }, 800);
                    
                    // Set focus to target for accessibility
                    target.focus();
                    
                    return false;
                }
            }
        });

        // Patient portal login handling (placeholder)
        $('.portal-login-btn').on('click', function(e) {
            e.preventDefault();
            
            // This would integrate with actual patient portal
            showModalDialog(
                'Patient Portal Access', 
                '<p>You will be redirected to the secure patient portal.</p><p><strong>Remember:</strong> Never share your login credentials.</p>',
                [{
                    text: 'Continue to Portal',
                    class: 'btn btn-primary',
                    click: function() {
                        // Redirect to actual patient portal
                        window.location.href = '#patient-portal';
                    }
                }, {
                    text: 'Cancel',
                    class: 'btn btn-secondary',
                    click: function() {
                        closeModalDialog();
                    }
                }]
            );
        });

        // Emergency contact highlighting
        $('.emergency-contact, .emergency-info').on('mouseenter', function() {
            $(this).addClass('emergency-highlight');
        }).on('mouseleave', function() {
            $(this).removeClass('emergency-highlight');
        });

        // Accessibility: Skip link functionality
        $('.skip-link').on('click', function() {
            var target = $($(this).attr('href'));
            if (target.length) {
                target.attr('tabindex', '-1').focus();
            }
        });

        // Comment form enhancements
        if ($('#commentform').length) {
            // Add character counter for comment textarea
            var $commentField = $('#comment');
            var maxLength = 1000;
            
            $commentField.after('<div class="comment-counter"><span class="current">0</span>/' + maxLength + ' characters</div>');
            
            $commentField.on('input', function() {
                var currentLength = $(this).val().length;
                $('.comment-counter .current').text(currentLength);
                
                if (currentLength > maxLength * 0.9) {
                    $('.comment-counter').addClass('warning');
                } else {
                    $('.comment-counter').removeClass('warning');
                }
                
                if (currentLength > maxLength) {
                    $('.comment-counter').addClass('error');
                    $(this).addClass('error');
                } else {
                    $('.comment-counter').removeClass('error');
                    $(this).removeClass('error');
                }
            });
        }

        // Healthcare category filtering (if implemented)
        $('.healthcare-category-filter').on('change', function() {
            var selectedCategory = $(this).val();
            var $articles = $('article');
            
            if (selectedCategory === '') {
                $articles.show();
            } else {
                $articles.hide();
                $articles.filter('[data-healthcare-category="' + selectedCategory + '"]').show();
            }
        });

        // Search form enhancements
        $('.search-form input[type="search"]').on('focus', function() {
            $(this).parent().addClass('search-focused');
        }).on('blur', function() {
            $(this).parent().removeClass('search-focused');
        });

        // Print functionality
        $('.print-page').on('click', function(e) {
            e.preventDefault();
            window.print();
        });

        // Share functionality (basic)
        $('.share-button').on('click', function(e) {
            e.preventDefault();
            var url = encodeURIComponent(window.location.href);
            var title = encodeURIComponent(document.title);
            var shareUrl = 'mailto:?subject=' + title + '&body=' + url;
            window.location.href = shareUrl;
        });
    });

    // Helper Functions
    function isValidEmail(email) {
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function showFormError(message) {
        var $errorDiv = $('.form-error-message');
        
        if (!$errorDiv.length) {
            $errorDiv = $('<div class="form-error-message healthcare-highlight" role="alert"></div>');
            $('form').prepend($errorDiv);
        }
        
        $errorDiv.html('<strong>Error:</strong> ' + message).show();
        
        setTimeout(function() {
            $errorDiv.fadeOut();
        }, 5000);
    }

    function showModalDialog(title, content, buttons) {
        var modal = $('<div class="webqx-modal" role="dialog" aria-labelledby="modal-title" aria-modal="true">');
        var modalContent = $('<div class="modal-content">');
        
        modalContent.append('<h2 id="modal-title">' + title + '</h2>');
        modalContent.append('<div class="modal-body">' + content + '</div>');
        
        if (buttons && buttons.length) {
            var buttonContainer = $('<div class="modal-buttons">');
            buttons.forEach(function(button) {
                var btn = $('<button type="button" class="' + button.class + '">' + button.text + '</button>');
                btn.on('click', button.click);
                buttonContainer.append(btn);
            });
            modalContent.append(buttonContainer);
        }
        
        modal.append(modalContent);
        $('body').append(modal);
        
        // Accessibility: trap focus in modal
        modal.find('button:first').focus();
        
        // Close on backdrop click
        modal.on('click', function(e) {
            if (e.target === this) {
                closeModalDialog();
            }
        });
        
        // Close on escape key
        $(document).on('keydown.modal', function(e) {
            if (e.keyCode === 27) {
                closeModalDialog();
            }
        });
    }

    function closeModalDialog() {
        $('.webqx-modal').remove();
        $(document).off('keydown.modal');
    }

})(jQuery);