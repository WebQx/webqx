# WebQX Healthcare Platform - Installation Guide

## Overview

The WebQX Healthcare Platform WordPress plugin provides a bridge between your WordPress site and the WebQX Node.js healthcare application, enabling comprehensive healthcare management features directly within WordPress.

## System Requirements

### WordPress Environment
- WordPress 5.0 or higher
- PHP 7.4 or higher  
- MySQL 5.6+ or PostgreSQL 10+
- SSL certificate (required for healthcare data)
- Minimum 512MB PHP memory limit
- Maximum execution time of at least 60 seconds

### WebQX Node.js Backend
- Node.js 16.0 or higher
- npm or yarn package manager
- PostgreSQL or MySQL database
- Redis (optional but recommended for session management)
- Minimum 1GB RAM
- SSL certificate for production deployments

## Installation Steps

### 1. Install the WordPress Plugin

#### Via WordPress Admin (Recommended)
1. Download the plugin zip file
2. Go to WordPress Admin → Plugins → Add New → Upload Plugin
3. Select the downloaded zip file and click "Install Now"
4. Activate the plugin after installation

#### Via FTP
1. Extract the plugin zip file
2. Upload the `webqx-healthcare-platform` folder to `/wp-content/plugins/`
3. Activate the plugin through the WordPress Admin → Plugins screen

### 2. Setup the Node.js Backend

#### Download and Install
```bash
# Clone the WebQX repository
git clone https://github.com/WebQx/webqx.git
cd webqx

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

#### Configure Environment Variables
Edit the `.env` file with your settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=production
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/webqx

# Security
JWT_SECRET=your-256-bit-secret-key-here
ENCRYPTION_KEY=your-32-char-encryption-key-here

# WordPress Integration
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_API_KEY=your-api-key-here

# FHIR Configuration (if using external EHR)
FHIR_SERVER_URL=https://your-fhir-server.com/fhir
FHIR_CLIENT_ID=your-fhir-client-id
FHIR_CLIENT_SECRET=your-fhir-client-secret

# Telehealth Configuration
JITSI_DOMAIN=meet.jit.si
ENABLE_RECORDING=false

# Compliance
HIPAA_COMPLIANCE_MODE=true
ENABLE_AUDIT_LOGGING=true
```

#### Database Setup
```bash
# For PostgreSQL
createdb webqx
npm run db:migrate

# For MySQL
mysql -u root -p -e "CREATE DATABASE webqx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
npm run db:migrate
```

#### Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start

# Using PM2 (recommended for production)
npm install -g pm2
pm2 start ecosystem.config.js
```

### 3. Configure the WordPress Plugin

1. Go to WordPress Admin → WebQX Healthcare → Settings
2. Configure the following settings:

#### Server Configuration
- **Node.js Server URL**: `http://localhost:3000` (or your server URL)
- **FHIR Server Endpoint**: Your FHIR server URL (if applicable)
- **API Key**: Secure key for WordPress-Node.js communication

#### Feature Configuration
- Enable desired features:
  - ✅ Patient Portal
  - ✅ Provider Dashboard  
  - ✅ Telehealth Module
  - ✅ Lab Results Viewer

#### Security Settings
- ✅ HIPAA Compliance Mode
- ✅ Audit Logging
- Configure SSL certificates

#### EHR Integration
- Select your primary EHR system
- Configure HL7/FHIR endpoints
- Set up authentication credentials

### 4. Test the Integration

1. Click "Test Connection" in the WordPress settings
2. Verify server status shows "Online"
3. Create a test page with shortcode: `[webqx_patient_portal]`
4. View the page to ensure the iframe loads correctly

## WordPress Integration

### Shortcodes

Add these shortcodes to your WordPress pages:

```shortcode
[webqx_patient_portal height="600px"]
[webqx_provider_dashboard height="800px"]
[webqx_telehealth session_id="optional"]
[webqx_lab_results patient_id="optional"]
```

### User Roles

Configure WordPress user roles for healthcare access:

- **Patient**: Can access patient portal and lab results
- **Editor/Author**: Can access provider dashboard (healthcare providers)
- **Administrator**: Full access to all features and settings

### Theme Integration

The plugin works with any WordPress theme. For custom styling:

1. Copy CSS from `assets/css/frontend.css`
2. Modify to match your theme
3. Add custom CSS via WordPress Customizer or child theme

## Production Deployment

### Security Checklist

- [ ] SSL certificates installed on both WordPress and Node.js
- [ ] Strong passwords and API keys configured
- [ ] HIPAA compliance mode enabled
- [ ] Audit logging enabled
- [ ] Regular backups configured
- [ ] Firewall rules configured
- [ ] Database access secured

### Performance Optimization

- [ ] Redis configured for session management
- [ ] Database indexes optimized
- [ ] CDN configured for static assets
- [ ] Monitoring tools installed (e.g., PM2, New Relic)
- [ ] Log rotation configured

### Backup Strategy

- [ ] WordPress database and files
- [ ] Node.js application and configuration
- [ ] PostgreSQL/MySQL healthcare database
- [ ] SSL certificates and keys
- [ ] Log files and audit trails

## Troubleshooting

### Common Issues

#### Plugin Shows "Server Offline"
1. Verify Node.js server is running: `curl http://localhost:3000/health`
2. Check server URL in WordPress settings
3. Verify firewall and network connectivity
4. Check Node.js server logs for errors

#### Shortcodes Show "Template Not Found"
1. Verify plugin files are properly uploaded
2. Check file permissions (755 for directories, 644 for files)
3. Deactivate and reactivate the plugin
4. Clear any caching plugins

#### FHIR Integration Errors
1. Verify FHIR server URL and credentials
2. Check FHIR server logs for authentication issues
3. Ensure FHIR server supports required operations
4. Test FHIR endpoints manually

#### Telehealth Not Loading
1. Verify camera/microphone permissions in browser
2. Check Jitsi domain configuration
3. Ensure HTTPS is properly configured
4. Test with different browsers

### Log Files

Check these log locations for debugging:

- **WordPress**: `/wp-content/debug.log` (if WP_DEBUG enabled)
- **Node.js**: Application logs via PM2 or console output
- **WebQX Audit**: Configured audit log location
- **Database**: Database server error logs

### Support Resources

- **GitHub Repository**: https://github.com/WebQx/webqx
- **Documentation**: https://github.com/WebQx/webqx/docs
- **Issue Tracker**: https://github.com/WebQx/webqx/issues
- **Community Forum**: WordPress.org plugin support forum

## Healthcare Compliance

### HIPAA Compliance

To maintain HIPAA compliance:

1. Enable HIPAA compliance mode in both WordPress and Node.js
2. Sign Business Associate Agreements with hosting providers
3. Implement proper access controls and audit logging
4. Encrypt all data in transit and at rest
5. Train staff on HIPAA requirements
6. Implement incident response procedures

### Data Security

- All patient data is stored in the Node.js backend, not WordPress
- WordPress only handles authentication and UI presentation
- Communications are encrypted using TLS 1.2+
- User sessions are managed securely
- Regular security audits should be performed

---

For additional support or enterprise consulting, contact WebQX Health at support@webqx.health