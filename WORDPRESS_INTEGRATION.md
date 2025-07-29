# WebQX WordPress Integration

This directory contains the WordPress theme and plugin implementation for the WebQX healthcare platform, enabling seamless integration of WebQX functionality into WordPress websites.

## Overview

The WebQX WordPress integration provides:

- **WordPress Theme**: A healthcare-focused theme with WebQX branding and functionality
- **WordPress Plugin**: Comprehensive integration with WebQX backend services via shortcodes, widgets, and REST API
- **FHIR R4 Compliance**: Full FHIR integration for healthcare data exchange
- **CI/CD Pipeline**: Automated testing and deployment workflows

## Directory Structure

```
wordpress-integration/
├── wordpress-theme/              # WordPress theme files
│   ├── style.css                 # Theme stylesheet with header
│   ├── index.php                 # Main theme template
│   ├── functions.php             # Theme functions and features
│   ├── header.php               # Header template
│   ├── footer.php               # Footer template
│   ├── page.php                 # Page template
│   └── template-parts/          # Template parts
│       ├── content-single.php   # Single post content
│       └── content-none.php     # No content template
├── wordpress-plugin/            # WordPress plugin files
│   ├── webqx-integration.php    # Main plugin file
│   ├── includes/                # Plugin classes
│   │   ├── class-webqx-shortcodes.php      # Shortcode functionality
│   │   ├── class-webqx-widgets.php         # WordPress widgets
│   │   ├── class-webqx-rest-api.php        # REST API integration
│   │   ├── class-webqx-admin.php           # Admin interface
│   │   └── class-webqx-fhir-integration.php # FHIR R4 integration
│   └── assets/                  # CSS and JavaScript files
│       ├── css/webqx-integration.css
│       └── js/webqx-integration.js
└── .github/workflows/           # GitHub Actions workflows
    └── wordpress-integration.yml
```

## Installation

### WordPress Theme Installation

1. **Upload Theme**:
   ```bash
   # Copy theme to WordPress themes directory
   cp -r wordpress-theme /path/to/wordpress/wp-content/themes/webqx-healthcare
   ```

2. **Activate Theme**:
   - Go to WordPress Admin → Appearance → Themes
   - Find "WebQX Healthcare Platform" theme
   - Click "Activate"

3. **Configure Theme**:
   - Go to WordPress Admin → WebQX Settings
   - Set your WebQX API base URL
   - Configure FHIR integration settings

### WordPress Plugin Installation

1. **Upload Plugin**:
   ```bash
   # Copy plugin to WordPress plugins directory
   cp -r wordpress-plugin /path/to/wordpress/wp-content/plugins/webqx-integration
   ```

2. **Activate Plugin**:
   - Go to WordPress Admin → Plugins
   - Find "WebQX Healthcare Integration"
   - Click "Activate"

3. **Configure Plugin**:
   - Go to WordPress Admin → WebQX → Settings
   - Configure API settings, FHIR options, and other preferences

## Configuration

### Required Settings

1. **API Base URL**: Set the URL of your WebQX backend API
2. **API Timeout**: Configure request timeout (default: 30 seconds)
3. **FHIR Integration**: Enable/disable FHIR R4 support
4. **Default Language**: Set the default language for the interface
5. **Audit Logging**: Enable activity logging for compliance

### Environment Variables

The plugin supports configuration via environment variables:

```bash
# WebQX API URL
WEBQX_API_URL=https://api.webqx.health

# Enable debug mode
WP_DEBUG=true
```

## Usage

### Shortcodes

The plugin provides comprehensive shortcodes for WebQX functionality:

#### Patient Portal
```php
[webqx_patient_portal]
[webqx_appointment_booking]
[webqx_medical_records]
[webqx_secure_messaging]
[webqx_prescriptions]
```

#### Provider Panel
```php
[webqx_provider_panel]
[webqx_ehr_dashboard]
[webqx_clinical_alerts]
[webqx_voice_transcription]
[webqx_pacs_viewer study_id="123"]
```

#### FHIR Integration
```php
[webqx_fhir_tester]
```

#### Generic Module
```php
[webqx_module type="patient-portal" id="123"]
```

### Widgets

Available widgets for sidebars and widget areas:

1. **WebQX Patient Portal Widget**: Patient login and quick links
2. **WebQX Provider Dashboard Widget**: Provider statistics and links
3. **WebQX Appointments Widget**: Upcoming appointments display
4. **WebQX Health Status Widget**: System status indicators

### REST API Endpoints

The plugin exposes REST API endpoints for integration:

#### WordPress REST API
- `GET /wp-json/webqx/v1/patient/{id}` - Get patient data
- `GET /wp-json/webqx/v1/appointments` - Get appointments
- `POST /wp-json/webqx/v1/appointments` - Create appointment
- `GET /wp-json/webqx/v1/health` - Health check

#### FHIR R4 API
- `GET /wp-json/webqx/fhir/v1/metadata` - FHIR capability statement
- `GET /wp-json/webqx/fhir/v1/Patient` - Get patients
- `GET /wp-json/webqx/fhir/v1/Patient/{id}` - Get specific patient
- `POST /wp-json/webqx/fhir/v1/Patient` - Create patient
- `PUT /wp-json/webqx/fhir/v1/Patient/{id}` - Update patient

### Admin Interface

The plugin provides a comprehensive admin interface:

1. **Dashboard**: System status, usage statistics, quick actions
2. **Settings**: API configuration, FHIR settings, general options
3. **Module Logs**: Activity logging and audit trail
4. **FHIR Resources**: FHIR resource browser and management

## Development

### Local Development Setup

1. **WordPress Environment**:
   ```bash
   # Using Local by Flywheel, XAMPP, or similar
   # Create a new WordPress site
   ```

2. **Install WebQX Integration**:
   ```bash
   # Clone the repository
   git clone https://github.com/webqx/webqx.git
   
   # Copy WordPress files
   cp -r webqx/wordpress-theme /path/to/wordpress/wp-content/themes/webqx-healthcare
   cp -r webqx/wordpress-plugin /path/to/wordpress/wp-content/plugins/webqx-integration
   ```

3. **Configure Development Environment**:
   ```php
   // wp-config.php
   define('WP_DEBUG', true);
   define('WP_DEBUG_LOG', true);
   define('WEBQX_API_URL', 'http://localhost:3000');
   ```

### Testing

#### Manual Testing
1. Activate the theme and plugin
2. Test shortcodes in posts/pages
3. Verify widget functionality
4. Check admin interface

#### Automated Testing
The GitHub Actions workflow automatically tests:
- PHP syntax validation
- WordPress coding standards
- Security scanning
- Integration testing

### Contributing

1. **Code Standards**: Follow WordPress coding standards
2. **Security**: Always sanitize input and escape output
3. **Documentation**: Update documentation for new features
4. **Testing**: Add tests for new functionality

## Security Considerations

### Data Protection
- All user input is sanitized and validated
- Nonce verification for AJAX requests
- Proper capability checks for admin functions
- Secure API communication with authentication

### HIPAA Compliance
- Audit logging for all patient data access
- Secure data transmission (HTTPS required)
- Data encryption for sensitive information
- Access controls based on user roles

### FHIR Security
- OAuth 2.0 authentication for FHIR endpoints
- Scope-based access control
- Audit trail for all FHIR operations

## Troubleshooting

### Common Issues

1. **API Connection Failed**:
   - Check WebQX API URL in settings
   - Verify API server is running
   - Check network connectivity

2. **FHIR Endpoints Not Working**:
   - Ensure FHIR integration is enabled
   - Check user permissions
   - Verify FHIR server configuration

3. **Shortcodes Not Displaying**:
   - Confirm plugin is activated
   - Check for JavaScript errors
   - Verify API connectivity

### Debug Mode

Enable debug mode for detailed logging:

```php
// wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

Check logs in `/wp-content/debug.log` for error details.

## Support

- **Documentation**: See WordPress integration documentation
- **Issues**: Report issues on GitHub
- **Community**: Join WebQX community forums

## License

This WordPress integration is licensed under the Apache 2.0 License, consistent with the main WebQX project.