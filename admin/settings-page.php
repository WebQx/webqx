<?php
/**
 * Settings Page Template for WebQX Healthcare Platform
 *
 * @package WebQX_Healthcare_Platform
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="wrap">
    <h1><?php _e('WebQX Healthcare Settings', 'webqx-healthcare'); ?></h1>

    <form method="post" action="">
        <?php wp_nonce_field('webqx_settings_nonce'); ?>
        
        <table class="form-table">
            <!-- Server Configuration -->
            <tr>
                <th colspan="2">
                    <h2><?php _e('Server Configuration', 'webqx-healthcare'); ?></h2>
                </th>
            </tr>
            
            <tr>
                <th scope="row">
                    <label for="node_server_url"><?php _e('Node.js Server URL', 'webqx-healthcare'); ?></label>
                </th>
                <td>
                    <input type="url" id="node_server_url" name="node_server_url" 
                           value="<?php echo esc_attr($settings['node_server_url'] ?? 'http://localhost:3000'); ?>" 
                           class="regular-text" required />
                    <p class="description">
                        <?php _e('URL where your WebQX Node.js application is running. Include http:// or https://.', 'webqx-healthcare'); ?>
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row">
                    <label for="fhir_endpoint"><?php _e('FHIR Server Endpoint', 'webqx-healthcare'); ?></label>
                </th>
                <td>
                    <input type="url" id="fhir_endpoint" name="fhir_endpoint" 
                           value="<?php echo esc_attr($settings['fhir_endpoint'] ?? ''); ?>" 
                           class="regular-text" />
                    <p class="description">
                        <?php _e('Optional: External FHIR server URL for EHR integration.', 'webqx-healthcare'); ?>
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row">
                    <label for="api_key"><?php _e('API Key', 'webqx-healthcare'); ?></label>
                </th>
                <td>
                    <input type="password" id="api_key" name="api_key" 
                           value="<?php echo esc_attr($settings['api_key'] ?? ''); ?>" 
                           class="regular-text" />
                    <p class="description">
                        <?php _e('Optional: API key for secure communication with the Node.js server.', 'webqx-healthcare'); ?>
                    </p>
                </td>
            </tr>

            <!-- Feature Toggles -->
            <tr>
                <th colspan="2">
                    <h2><?php _e('Feature Configuration', 'webqx-healthcare'); ?></h2>
                </th>
            </tr>
            
            <tr>
                <th scope="row"><?php _e('Healthcare Features', 'webqx-healthcare'); ?></th>
                <td>
                    <fieldset>
                        <label>
                            <input type="checkbox" name="enable_patient_portal" 
                                   <?php checked($settings['enable_patient_portal'] ?? true); ?> />
                            <?php _e('Enable Patient Portal', 'webqx-healthcare'); ?>
                        </label>
                        <br />
                        
                        <label>
                            <input type="checkbox" name="enable_provider_dashboard" 
                                   <?php checked($settings['enable_provider_dashboard'] ?? true); ?> />
                            <?php _e('Enable Provider Dashboard', 'webqx-healthcare'); ?>
                        </label>
                        <br />
                        
                        <label>
                            <input type="checkbox" name="enable_telehealth" 
                                   <?php checked($settings['enable_telehealth'] ?? true); ?> />
                            <?php _e('Enable Telehealth Module', 'webqx-healthcare'); ?>
                        </label>
                        <br />
                        
                        <label>
                            <input type="checkbox" name="enable_lab_results" 
                                   <?php checked($settings['enable_lab_results'] ?? true); ?> />
                            <?php _e('Enable Lab Results Viewer', 'webqx-healthcare'); ?>
                        </label>
                    </fieldset>
                </td>
            </tr>

            <!-- Security Settings -->
            <tr>
                <th colspan="2">
                    <h2><?php _e('Security & Compliance', 'webqx-healthcare'); ?></h2>
                </th>
            </tr>
            
            <tr>
                <th scope="row"><?php _e('HIPAA Compliance Mode', 'webqx-healthcare'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="hipaa_compliance_mode" 
                               <?php checked($settings['hipaa_compliance_mode'] ?? true); ?> />
                        <?php _e('Enable HIPAA compliance features', 'webqx-healthcare'); ?>
                    </label>
                    <p class="description">
                        <?php _e('Enables additional security measures, audit logging, and data encryption.', 'webqx-healthcare'); ?>
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row"><?php _e('Audit Logging', 'webqx-healthcare'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="enable_audit_logging" 
                               <?php checked($settings['enable_audit_logging'] ?? true); ?> />
                        <?php _e('Enable comprehensive audit logging', 'webqx-healthcare'); ?>
                    </label>
                    <p class="description">
                        <?php _e('Records all user actions for compliance and security monitoring.', 'webqx-healthcare'); ?>
                    </p>
                </td>
            </tr>

            <!-- Integration Settings -->
            <tr>
                <th colspan="2">
                    <h2><?php _e('EHR Integration', 'webqx-healthcare'); ?></h2>
                </th>
            </tr>
            
            <tr>
                <th scope="row">
                    <label for="ehr_system"><?php _e('Primary EHR System', 'webqx-healthcare'); ?></label>
                </th>
                <td>
                    <select id="ehr_system" name="ehr_system" class="regular-text">
                        <option value=""><?php _e('Select EHR System', 'webqx-healthcare'); ?></option>
                        <option value="openemr" <?php selected($settings['ehr_system'] ?? '', 'openemr'); ?>>OpenEMR</option>
                        <option value="openmrs" <?php selected($settings['ehr_system'] ?? '', 'openmrs'); ?>>OpenMRS</option>
                        <option value="hospitalrun" <?php selected($settings['ehr_system'] ?? '', 'hospitalrun'); ?>>HospitalRun</option>
                        <option value="gnuhealth" <?php selected($settings['ehr_system'] ?? '', 'gnuhealth'); ?>>GNU Health</option>
                        <option value="epic" <?php selected($settings['ehr_system'] ?? '', 'epic'); ?>>Epic (FHIR)</option>
                        <option value="cerner" <?php selected($settings['ehr_system'] ?? '', 'cerner'); ?>>Cerner (FHIR)</option>
                        <option value="custom" <?php selected($settings['ehr_system'] ?? '', 'custom'); ?>>Custom/Other</option>
                    </select>
                    <p class="description">
                        <?php _e('Select your primary EHR system for optimal integration.', 'webqx-healthcare'); ?>
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row">
                    <label for="hl7_endpoint"><?php _e('HL7 Mirth Connect URL', 'webqx-healthcare'); ?></label>
                </th>
                <td>
                    <input type="url" id="hl7_endpoint" name="hl7_endpoint" 
                           value="<?php echo esc_attr($settings['hl7_endpoint'] ?? ''); ?>" 
                           class="regular-text" />
                    <p class="description">
                        <?php _e('Optional: Mirth Connect server for HL7 message processing.', 'webqx-healthcare'); ?>
                    </p>
                </td>
            </tr>

            <!-- Telehealth Settings -->
            <tr>
                <th colspan="2">
                    <h2><?php _e('Telehealth Configuration', 'webqx-healthcare'); ?></h2>
                </th>
            </tr>
            
            <tr>
                <th scope="row">
                    <label for="jitsi_domain"><?php _e('Jitsi Meet Domain', 'webqx-healthcare'); ?></label>
                </th>
                <td>
                    <input type="text" id="jitsi_domain" name="jitsi_domain" 
                           value="<?php echo esc_attr($settings['jitsi_domain'] ?? 'meet.jit.si'); ?>" 
                           class="regular-text" />
                    <p class="description">
                        <?php _e('Jitsi Meet server for video consultations. Use meet.jit.si for testing.', 'webqx-healthcare'); ?>
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row"><?php _e('Recording Features', 'webqx-healthcare'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="enable_session_recording" 
                               <?php checked($settings['enable_session_recording'] ?? false); ?> />
                        <?php _e('Enable session recording (requires consent)', 'webqx-healthcare'); ?>
                    </label>
                    <p class="description">
                        <?php _e('Allows recording of telehealth sessions with proper patient consent.', 'webqx-healthcare'); ?>
                    </p>
                </td>
            </tr>
        </table>

        <div class="webqx-settings-actions">
            <p class="submit">
                <input type="submit" name="submit" class="button-primary" 
                       value="<?php _e('Save Settings', 'webqx-healthcare'); ?>" />
                <a href="<?php echo admin_url('admin.php?page=webqx-healthcare'); ?>" class="button button-secondary">
                    <?php _e('Back to Dashboard', 'webqx-healthcare'); ?>
                </a>
            </p>
        </div>
    </form>

    <!-- Connection Test -->
    <div class="webqx-connection-test">
        <h2><?php _e('Connection Test', 'webqx-healthcare'); ?></h2>
        <p><?php _e('Test the connection to your Node.js server:', 'webqx-healthcare'); ?></p>
        <button type="button" id="test-connection" class="button button-secondary">
            <?php _e('Test Connection', 'webqx-healthcare'); ?>
        </button>
        <div id="connection-result" style="margin-top: 10px;"></div>
    </div>

    <!-- Shortcode Reference -->
    <div class="webqx-shortcode-reference">
        <h2><?php _e('Shortcode Reference', 'webqx-healthcare'); ?></h2>
        <p><?php _e('Use these shortcodes to embed WebQX components in your WordPress pages:', 'webqx-healthcare'); ?></p>
        
        <div class="webqx-shortcode-grid">
            <div class="webqx-shortcode-item">
                <h4><?php _e('Patient Portal', 'webqx-healthcare'); ?></h4>
                <code>[webqx_patient_portal height="600px"]</code>
                <p><?php _e('Displays the complete patient portal interface.', 'webqx-healthcare'); ?></p>
            </div>
            
            <div class="webqx-shortcode-item">
                <h4><?php _e('Provider Dashboard', 'webqx-healthcare'); ?></h4>
                <code>[webqx_provider_dashboard height="800px"]</code>
                <p><?php _e('Shows the provider clinical dashboard (requires appropriate permissions).', 'webqx-healthcare'); ?></p>
            </div>
            
            <div class="webqx-shortcode-item">
                <h4><?php _e('Telehealth', 'webqx-healthcare'); ?></h4>
                <code>[webqx_telehealth session_id="abc123"]</code>
                <p><?php _e('Embeds the telehealth consultation interface.', 'webqx-healthcare'); ?></p>
            </div>
            
            <div class="webqx-shortcode-item">
                <h4><?php _e('Lab Results', 'webqx-healthcare'); ?></h4>
                <code>[webqx_lab_results patient_id="123"]</code>
                <p><?php _e('Displays laboratory results viewer.', 'webqx-healthcare'); ?></p>
            </div>
        </div>
    </div>
</div>

<script>
jQuery(document).ready(function($) {
    $('#test-connection').on('click', function() {
        var $button = $(this);
        var $result = $('#connection-result');
        var serverUrl = $('#node_server_url').val();
        
        $button.prop('disabled', true).text('<?php _e('Testing...', 'webqx-healthcare'); ?>');
        $result.html('<div class="notice notice-info"><p><?php _e('Testing connection...', 'webqx-healthcare'); ?></p></div>');
        
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'webqx_test_connection',
                server_url: serverUrl,
                nonce: '<?php echo wp_create_nonce('webqx_test_connection'); ?>'
            },
            success: function(response) {
                if (response.success) {
                    $result.html('<div class="notice notice-success"><p><?php _e('Connection successful!', 'webqx-healthcare'); ?></p></div>');
                } else {
                    $result.html('<div class="notice notice-error"><p><?php _e('Connection failed:', 'webqx-healthcare'); ?> ' + response.data + '</p></div>');
                }
            },
            error: function() {
                $result.html('<div class="notice notice-error"><p><?php _e('Connection test failed. Please check your server URL.', 'webqx-healthcare'); ?></p></div>');
            },
            complete: function() {
                $button.prop('disabled', false).text('<?php _e('Test Connection', 'webqx-healthcare'); ?>');
            }
        });
    });
});
</script>