<?php
/**
 * WebQX Security and Compliance
 * 
 * @package WebQX_Healthcare
 * @author WebQX Health
 * @license GPL v2 or later
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WebQX Security Class
 * 
 * Handles security, HIPAA compliance, and data protection
 */
class WebQX_Security {

    /**
     * Class instance
     * 
     * @var WebQX_Security
     */
    private static $instance = null;

    /**
     * Core instance
     * 
     * @var WebQX_Core
     */
    private $core;

    /**
     * Get instance
     * 
     * @return WebQX_Security
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct() {
        $this->core = WebQX_Core::get_instance();
        $this->init_hooks();
    }

    /**
     * Initialize hooks
     */
    private function init_hooks() {
        add_action('init', array($this, 'enforce_security_headers'));
        add_filter('wp_headers', array($this, 'add_security_headers'));
        add_action('wp_login', array($this, 'log_user_login'), 10, 2);
        add_action('wp_logout', array($this, 'log_user_logout'));
        add_filter('authenticate', array($this, 'additional_auth_checks'), 30, 3);
        add_action('user_register', array($this, 'log_user_registration'));
        add_filter('wp_privacy_personal_data_exporters', array($this, 'register_personal_data_exporters'));
        add_filter('wp_privacy_personal_data_erasers', array($this, 'register_personal_data_erasers'));
    }

    /**
     * Enforce security headers
     */
    public function enforce_security_headers() {
        if ($this->core->is_hipaa_mode_enabled()) {
            // Enforce HTTPS in HIPAA mode
            if (!is_ssl() && !WP_DEBUG) {
                wp_redirect('https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'], 301);
                exit;
            }
        }
    }

    /**
     * Add security headers
     * 
     * @param array $headers
     * @return array
     */
    public function add_security_headers($headers) {
        // HIPAA compliant security headers
        $headers['X-Content-Type-Options'] = 'nosniff';
        $headers['X-Frame-Options'] = 'DENY';
        $headers['X-XSS-Protection'] = '1; mode=block';
        $headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
        
        if ($this->core->is_hipaa_mode_enabled()) {
            $headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
            $headers['Content-Security-Policy'] = $this->get_csp_header();
        }
        
        return $headers;
    }

    /**
     * Get Content Security Policy header
     * 
     * @return string
     */
    private function get_csp_header() {
        $backend_url = $this->core->get_option('backend_url');
        $parsed_url = parse_url($backend_url);
        $backend_domain = $parsed_url['scheme'] . '://' . $parsed_url['host'];
        
        if (isset($parsed_url['port'])) {
            $backend_domain .= ':' . $parsed_url['port'];
        }
        
        return "default-src 'self'; " .
               "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " .
               "style-src 'self' 'unsafe-inline'; " .
               "img-src 'self' data: https:; " .
               "connect-src 'self' {$backend_domain}; " .
               "font-src 'self'; " .
               "object-src 'none'; " .
               "base-uri 'self'; " .
               "form-action 'self';";
    }

    /**
     * Log user login
     * 
     * @param string $user_login
     * @param WP_User $user
     */
    public function log_user_login($user_login, $user) {
        $this->core->log("User login: {$user_login}", 'info', array(
            'user_id' => $user->ID,
            'user_login' => $user_login,
            'user_email' => $user->user_email,
            'ip_address' => $this->get_client_ip(),
            'user_agent' => isset($_SERVER['HTTP_USER_AGENT']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_USER_AGENT'])) : '',
        ));
        
        // Update last login time
        update_user_meta($user->ID, '_webqx_last_login', current_time('mysql'));
    }

    /**
     * Log user logout
     * 
     * @param int $user_id
     */
    public function log_user_logout($user_id = null) {
        if (!$user_id) {
            $user_id = get_current_user_id();
        }
        
        $user = get_userdata($user_id);
        if ($user) {
            $this->core->log("User logout: {$user->user_login}", 'info', array(
                'user_id' => $user_id,
                'user_login' => $user->user_login,
                'ip_address' => $this->get_client_ip(),
            ));
        }
        
        // Clear WebQX auth tokens
        delete_user_meta($user_id, '_webqx_auth_token');
        delete_user_meta($user_id, '_webqx_auth_token_expiry');
    }

    /**
     * Additional authentication checks
     * 
     * @param null|WP_User|WP_Error $user
     * @param string $username
     * @param string $password
     * @return null|WP_User|WP_Error
     */
    public function additional_auth_checks($user, $username, $password) {
        if (!is_wp_error($user) && $user instanceof WP_User) {
            // Check if user account is locked due to failed attempts
            $failed_attempts = get_user_meta($user->ID, '_webqx_failed_login_attempts', true);
            $lockout_time = get_user_meta($user->ID, '_webqx_account_lockout_time', true);
            
            if ($lockout_time && time() < $lockout_time) {
                return new WP_Error(
                    'account_locked',
                    __('Account temporarily locked due to multiple failed login attempts. Please try again later.', 'webqx-healthcare')
                );
            }
            
            // Check for healthcare-specific user requirements
            if ($this->core->is_hipaa_mode_enabled()) {
                // Check if password meets healthcare security requirements
                if (!$this->validate_healthcare_password($password)) {
                    return new WP_Error(
                        'weak_password',
                        __('Password does not meet healthcare security requirements.', 'webqx-healthcare')
                    );
                }
                
                // Check if user account requires two-factor authentication
                if (get_user_meta($user->ID, '_webqx_require_2fa', true) && !$this->verify_2fa($user->ID)) {
                    return new WP_Error(
                        'two_factor_required',
                        __('Two-factor authentication is required for this account.', 'webqx-healthcare')
                    );
                }
            }
            
            // Reset failed attempts on successful login
            delete_user_meta($user->ID, '_webqx_failed_login_attempts');
            delete_user_meta($user->ID, '_webqx_account_lockout_time');
        } elseif (is_wp_error($user) && $username) {
            // Log failed login attempt
            $wp_user = get_user_by('login', $username);
            if ($wp_user) {
                $failed_attempts = (int) get_user_meta($wp_user->ID, '_webqx_failed_login_attempts', true);
                $failed_attempts++;
                update_user_meta($wp_user->ID, '_webqx_failed_login_attempts', $failed_attempts);
                
                // Lock account after 5 failed attempts
                if ($failed_attempts >= 5) {
                    update_user_meta($wp_user->ID, '_webqx_account_lockout_time', time() + (15 * 60)); // 15 minutes
                }
                
                $this->core->log("Failed login attempt: {$username}", 'warning', array(
                    'user_id' => $wp_user->ID,
                    'attempts' => $failed_attempts,
                    'ip_address' => $this->get_client_ip(),
                ));
            }
        }
        
        return $user;
    }

    /**
     * Log user registration
     * 
     * @param int $user_id
     */
    public function log_user_registration($user_id) {
        $user = get_userdata($user_id);
        if ($user) {
            $this->core->log("User registration: {$user->user_login}", 'info', array(
                'user_id' => $user_id,
                'user_login' => $user->user_login,
                'user_email' => $user->user_email,
                'ip_address' => $this->get_client_ip(),
            ));
        }
    }

    /**
     * Validate healthcare password requirements
     * 
     * @param string $password
     * @return bool
     */
    private function validate_healthcare_password($password) {
        // HIPAA-compliant password requirements
        if (strlen($password) < 8) {
            return false;
        }
        
        // Must contain uppercase, lowercase, number, and special character
        if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/', $password)) {
            return false;
        }
        
        return true;
    }

    /**
     * Verify two-factor authentication
     * 
     * @param int $user_id
     * @return bool
     */
    private function verify_2fa($user_id) {
        // Check if 2FA token is provided and valid
        $token = isset($_POST['webqx_2fa_token']) ? sanitize_text_field($_POST['webqx_2fa_token']) : '';
        
        if (empty($token)) {
            return false;
        }
        
        // Verify token against user's secret
        $secret = get_user_meta($user_id, '_webqx_2fa_secret', true);
        if (!$secret) {
            return false;
        }
        
        // This would integrate with TOTP library in production
        return $this->verify_totp_token($secret, $token);
    }

    /**
     * Verify TOTP token (simplified implementation)
     * 
     * @param string $secret
     * @param string $token
     * @return bool
     */
    private function verify_totp_token($secret, $token) {
        // In production, use a proper TOTP library like Google Authenticator
        // This is a placeholder implementation
        return !empty($secret) && !empty($token) && strlen($token) === 6;
    }

    /**
     * Get client IP address
     * 
     * @return string
     */
    private function get_client_ip() {
        $ip_keys = array('HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CLIENT_IP', 'REMOTE_ADDR');
        
        foreach ($ip_keys as $key) {
            if (!empty($_SERVER[$key])) {
                $ip = sanitize_text_field(wp_unslash($_SERVER[$key]));
                if (strpos($ip, ',') !== false) {
                    $ip = trim(explode(',', $ip)[0]);
                }
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }
        
        return '127.0.0.1';
    }

    /**
     * Register personal data exporters for GDPR compliance
     * 
     * @param array $exporters
     * @return array
     */
    public function register_personal_data_exporters($exporters) {
        $exporters['webqx-healthcare-data'] = array(
            'exporter_friendly_name' => __('WebQX Healthcare Data', 'webqx-healthcare'),
            'callback' => array($this, 'export_personal_data'),
        );
        
        return $exporters;
    }

    /**
     * Register personal data erasers for GDPR compliance
     * 
     * @param array $erasers
     * @return array
     */
    public function register_personal_data_erasers($erasers) {
        $erasers['webqx-healthcare-data'] = array(
            'eraser_friendly_name' => __('WebQX Healthcare Data', 'webqx-healthcare'),
            'callback' => array($this, 'erase_personal_data'),
        );
        
        return $erasers;
    }

    /**
     * Export personal data for GDPR compliance
     * 
     * @param string $email_address
     * @param int $page
     * @return array
     */
    public function export_personal_data($email_address, $page = 1) {
        $user = get_user_by('email', $email_address);
        if (!$user) {
            return array(
                'data' => array(),
                'done' => true,
            );
        }
        
        $personal_data = array();
        
        // Export WebQX specific user data
        $webqx_data = array(
            'last_login' => get_user_meta($user->ID, '_webqx_last_login', true),
            'hipaa_acknowledgment' => get_user_meta($user->ID, '_webqx_hipaa_acknowledgment', true),
            'privacy_consent' => get_user_meta($user->ID, '_webqx_privacy_consent', true),
        );
        
        if (!empty(array_filter($webqx_data))) {
            $personal_data[] = array(
                'group_id' => 'webqx-healthcare',
                'group_label' => __('WebQX Healthcare Data', 'webqx-healthcare'),
                'item_id' => 'webqx-user-' . $user->ID,
                'data' => $webqx_data,
            );
        }
        
        // Export integration logs (limited to recent entries)
        global $wpdb;
        $table_name = $wpdb->prefix . 'webqx_integration_logs';
        $logs = $wpdb->get_results($wpdb->prepare(
            "SELECT timestamp, level, message FROM {$table_name} WHERE user_id = %d ORDER BY timestamp DESC LIMIT 100",
            $user->ID
        ), ARRAY_A);
        
        if (!empty($logs)) {
            $personal_data[] = array(
                'group_id' => 'webqx-logs',
                'group_label' => __('WebQX Integration Logs', 'webqx-healthcare'),
                'item_id' => 'webqx-logs-' . $user->ID,
                'data' => $logs,
            );
        }
        
        return array(
            'data' => $personal_data,
            'done' => true,
        );
    }

    /**
     * Erase personal data for GDPR compliance
     * 
     * @param string $email_address
     * @param int $page
     * @return array
     */
    public function erase_personal_data($email_address, $page = 1) {
        $user = get_user_by('email', $email_address);
        if (!$user) {
            return array(
                'items_removed' => false,
                'items_retained' => false,
                'messages' => array(),
                'done' => true,
            );
        }
        
        $items_removed = false;
        $messages = array();
        
        // Remove WebQX specific user meta
        $webqx_meta_keys = array(
            '_webqx_auth_token',
            '_webqx_auth_token_expiry',
            '_webqx_last_login',
            '_webqx_failed_login_attempts',
            '_webqx_account_lockout_time',
            '_webqx_2fa_secret',
            '_webqx_hipaa_acknowledgment',
            '_webqx_privacy_consent',
        );
        
        foreach ($webqx_meta_keys as $meta_key) {
            if (delete_user_meta($user->ID, $meta_key)) {
                $items_removed = true;
            }
        }
        
        // Remove integration logs (but keep them for legal/audit purposes if required)
        if (!$this->core->is_hipaa_mode_enabled()) {
            global $wpdb;
            $table_name = $wpdb->prefix . 'webqx_integration_logs';
            $deleted = $wpdb->delete($table_name, array('user_id' => $user->ID), array('%d'));
            
            if ($deleted > 0) {
                $items_removed = true;
                $messages[] = sprintf(__('Removed %d integration log entries.', 'webqx-healthcare'), $deleted);
            }
        } else {
            $messages[] = __('Integration logs retained for legal/audit compliance.', 'webqx-healthcare');
        }
        
        return array(
            'items_removed' => $items_removed,
            'items_retained' => false,
            'messages' => $messages,
            'done' => true,
        );
    }
}