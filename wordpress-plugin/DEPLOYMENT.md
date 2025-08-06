# WebQX Healthcare Platform - WordPress Plugin Deployment Guide

## Overview

This deployment guide covers the installation and configuration of the WebQX Healthcare Platform WordPress plugin, which provides WordPress integration for the WebQX Node.js healthcare backend system.

## Prerequisites

### System Requirements

#### WordPress Requirements
- WordPress 5.0 or higher
- PHP 7.4 or higher
- MySQL 5.6 or higher
- SSL certificate (required for HIPAA compliance)

#### Server Requirements
- Web server (Apache 2.4+ or Nginx 1.14+)
- SSL/TLS configuration
- Minimum 512MB PHP memory limit
- File upload limit of at least 32MB

#### PHP Extensions
The following PHP extensions are required:
- `curl` - for API communication with backend
- `json` - for data exchange
- `openssl` - for encryption and SSL
- `mbstring` - for international character support

#### WebQX Backend System
- WebQX Node.js backend server (v16.0+ recommended)
- Database server (MySQL 5.7+ or PostgreSQL 12+)
- Redis server (optional, for caching and sessions)

## Installation Methods

### Method 1: WordPress Admin (Recommended)

1. **Download the Plugin**
   - Download the latest plugin package from the WebQX releases page
   - Or obtain the plugin zip file from your healthcare provider

2. **Upload via WordPress Admin**
   ```
   1. Log in to WordPress admin
   2. Navigate to Plugins > Add New
   3. Click "Upload Plugin"
   4. Select the webqx-healthcare.zip file
   5. Click "Install Now"
   6. Click "Activate Plugin"
   ```

3. **Initial Configuration**
   - Navigate to WebQX Healthcare > Settings
   - Configure your backend server URL
   - Test the connection to ensure proper setup

### Method 2: Manual Installation

1. **Extract Plugin Files**
   ```bash
   cd /path/to/wordpress/wp-content/plugins/
   unzip webqx-healthcare.zip
   ```

2. **Set Permissions**
   ```bash
   chown -R www-data:www-data webqx-healthcare/
   chmod -R 755 webqx-healthcare/
   ```

3. **Activate Plugin**
   - Log in to WordPress admin
   - Navigate to Plugins > Installed Plugins
   - Find "WebQX Healthcare Platform" and click "Activate"

### Method 3: WP-CLI Installation

```bash
# Download and install
wp plugin install /path/to/webqx-healthcare.zip --activate

# Or install from WordPress.org (when available)
wp plugin install webqx-healthcare --activate
```

## Backend System Deployment

### Node.js Backend Setup

1. **Install Node.js Backend**
   ```bash
   # Clone the WebQX repository
   git clone https://github.com/WebQx/webqx.git
   cd webqx
   
   # Install dependencies
   npm install
   
   # Configure environment
   cp .env.example .env
   ```

2. **Configure Environment Variables**
   ```bash
   # Edit .env file
   nano .env
   ```
   
   Key settings:
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=mysql://user:pass@localhost:3306/webqx
   JWT_SECRET=your-secure-jwt-secret
   ENCRYPTION_KEY=your-32-character-encryption-key
   ENABLE_HTTPS=true
   CORS_ORIGIN=https://yourwordpresssite.com
   ```

3. **Start the Backend Service**
   ```bash
   # For production (with PM2)
   npm install -g pm2
   pm2 start ecosystem.config.js
   
   # Or using Docker
   docker-compose up -d
   ```

### Database Setup

1. **Create Database**
   ```sql
   CREATE DATABASE webqx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'webqx_user'@'localhost' IDENTIFIED BY 'secure_password';
   GRANT ALL PRIVILEGES ON webqx.* TO 'webqx_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

2. **Run Migrations**
   ```bash
   # In the backend directory
   npm run migrate
   npm run seed:basic
   ```

## WordPress Plugin Configuration

### Initial Setup

1. **Access Plugin Settings**
   - Navigate to WebQX Healthcare > Settings in WordPress admin
   - You'll see four configuration tabs

2. **Backend Configuration Tab**
   ```
   Backend URL: https://api.yourdomain.com
   API Timeout: 30 seconds
   ```
   
   - Enter your WebQX backend server URL
   - Test the connection using the "Test Connection" button

3. **Security & HIPAA Tab**
   ```
   ✓ Enable HIPAA Mode
   ✓ Require Two-Factor Authentication
   Session Timeout: 30 minutes
   ```
   
   - Enable HIPAA mode for healthcare compliance
   - Configure security settings as needed

4. **Module Settings Tab**
   ```
   ✓ Patient Portal
   ✓ Provider Portal
   ✓ Admin Console
   ```
   
   - Enable the modules you want to use
   - Each module can be toggled independently

5. **Logging Tab**
   ```
   ✓ Enable Logging
   Log Level: Info
   ```
   
   - Enable comprehensive audit logging
   - Set appropriate log level for your environment

### User Roles and Permissions

1. **Create Healthcare Roles**
   ```php
   // Add to your theme's functions.php or use a plugin
   add_role('healthcare_provider', 'Healthcare Provider', array(
       'read' => true,
       'read_webqx_patient' => true,
       'edit_webqx_patients' => true,
       'read_webqx_appointment' => true,
       'edit_webqx_appointments' => true,
   ));
   
   add_role('patient', 'Patient', array(
       'read' => true,
       'read_webqx_patient' => true,
       'edit_own_webqx_patient' => true,
   ));
   ```

2. **Assign Capabilities to Existing Roles**
   - Administrators automatically get all WebQX capabilities
   - Editors can be granted healthcare management permissions
   - Custom roles can be created for specific healthcare functions

### Frontend Integration

1. **Create Portal Pages**
   ```
   Patient Portal Page:
   Title: Patient Portal
   Content: [webqx_patient_portal]
   
   Provider Portal Page:
   Title: Provider Portal  
   Content: [webqx_provider_portal]
   
   Book Appointment Page:
   Title: Book Appointment
   Content: [webqx_appointment_booking]
   
   Find a Provider Page:
   Title: Find a Provider
   Content: [webqx_provider_directory]
   ```

2. **Configure Navigation**
   - Add portal pages to your WordPress menus
   - Set appropriate permissions for menu items
   - Consider creating role-specific navigation menus

3. **Customize Styling**
   ```css
   /* Add to your theme's style.css */
   .webqx-patient-portal {
       /* Custom styles for patient portal */
   }
   
   .webqx-provider-portal {
       /* Custom styles for provider portal */
   }
   ```

## SSL and Security Configuration

### SSL Certificate Setup

1. **Obtain SSL Certificate**
   - Use Let's Encrypt for free certificates
   - Or purchase from a commercial CA
   - Ensure certificate covers all subdomains

2. **Configure Web Server**
   
   **Apache Configuration:**
   ```apache
   <VirtualHost *:443>
       ServerName yourdomain.com
       DocumentRoot /var/www/html
       
       SSLEngine on
       SSLCertificateFile /path/to/certificate.crt
       SSLCertificateKeyFile /path/to/private.key
       SSLCertificateChainFile /path/to/chain.crt
       
       # Security headers
       Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
       Header always set X-Content-Type-Options "nosniff"
       Header always set X-Frame-Options "DENY"
   </VirtualHost>
   ```
   
   **Nginx Configuration:**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name yourdomain.com;
       
       ssl_certificate /path/to/certificate.crt;
       ssl_certificate_key /path/to/private.key;
       
       # Security headers
       add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header X-Frame-Options "DENY" always;
   }
   ```

### WordPress Security Hardening

1. **WordPress Configuration**
   ```php
   // Add to wp-config.php
   define('FORCE_SSL_ADMIN', true);
   define('DISALLOW_FILE_EDIT', true);
   define('AUTOMATIC_UPDATER_DISABLED', false);
   ```

2. **Security Plugins** (Optional but recommended)
   - Wordfence Security
   - Sucuri Security
   - iThemes Security Pro

## HIPAA Compliance Configuration

### Required Settings

1. **Enable HIPAA Mode**
   - Navigate to WebQX Healthcare > Settings > Security & HIPAA
   - Check "Enable HIPAA Mode"
   - This enforces HTTPS and additional security measures

2. **Configure Audit Logging**
   - Enable comprehensive logging in the Logging tab
   - Set log level to "Info" or "Debug" for complete audit trails
   - Regularly review and archive logs

3. **User Access Controls**
   - Implement strong password policies
   - Enable two-factor authentication
   - Regular access reviews and deactivation of unused accounts

4. **Data Backup and Recovery**
   ```bash
   # Automated database backup
   mysqldump -u root -p webqx > webqx_backup_$(date +%Y%m%d_%H%M%S).sql
   
   # WordPress files backup
   tar -czf wp_backup_$(date +%Y%m%d_%H%M%S).tar.gz /var/www/html/
   ```

### Business Associate Agreements

1. **Hosting Provider BAA**
   - Ensure your hosting provider signs a BAA
   - Verify HIPAA-compliant hosting environment

2. **Third-Party Services BAA**
   - Email service providers
   - SMS/notification services
   - Payment processors
   - Cloud storage services

## Testing and Validation

### Functionality Testing

1. **Backend Connectivity**
   - Test API connection from WordPress admin
   - Verify all endpoints are responding correctly
   - Check authentication and authorization

2. **User Workflows**
   - Patient registration and login
   - Appointment booking process
   - Provider portal functionality
   - Admin panel operations

3. **Security Testing**
   - SSL certificate validation
   - HTTPS redirection
   - Security headers verification
   - Authentication bypass testing

### Performance Testing

1. **Load Testing**
   ```bash
   # Using Apache Bench
   ab -n 1000 -c 50 https://yourdomain.com/patient-portal/
   
   # Using curl
   curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/
   ```

2. **Database Performance**
   ```sql
   -- Check slow queries
   SHOW VARIABLES LIKE 'slow_query_log';
   SHOW VARIABLES LIKE 'long_query_time';
   ```

## Maintenance and Updates

### Regular Maintenance Tasks

1. **Weekly Tasks**
   - Review audit logs
   - Check system health dashboard
   - Verify backup integrity
   - Update WordPress core and plugins

2. **Monthly Tasks**
   - Review user access permissions
   - Analyze security logs
   - Performance optimization
   - Documentation updates

3. **Quarterly Tasks**
   - Full security audit
   - HIPAA compliance review
   - Disaster recovery testing
   - Staff training updates

### Update Procedures

1. **Plugin Updates**
   ```bash
   # Backup before updating
   wp db export backup_before_update.sql
   tar -czf wp_files_backup.tar.gz /var/www/html/
   
   # Update plugin
   wp plugin update webqx-healthcare
   
   # Test functionality
   wp plugin status webqx-healthcare
   ```

2. **Backend Updates**
   ```bash
   # In backend directory
   git pull origin main
   npm install
   npm run migrate
   pm2 restart webqx
   ```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   ```
   Problem: "Unable to connect to WebQX Backend"
   Solution: 
   - Check backend server is running
   - Verify firewall rules allow connections
   - Confirm SSL certificates are valid
   ```

2. **SSL Certificate Issues**
   ```
   Problem: SSL certificate errors
   Solution:
   - Verify certificate is not expired
   - Check certificate chain is complete
   - Ensure certificate matches domain name
   ```

3. **Permission Errors**
   ```
   Problem: "Insufficient permissions" messages
   Solution:
   - Check user roles and capabilities
   - Verify WebQX capabilities are assigned
   - Review HIPAA mode restrictions
   ```

### Debug Mode

1. **Enable WordPress Debug Mode**
   ```php
   // Add to wp-config.php
   define('WP_DEBUG', true);
   define('WP_DEBUG_LOG', true);
   define('WP_DEBUG_DISPLAY', false);
   ```

2. **Enable WebQX Debug Logging**
   - Navigate to WebQX Healthcare > Settings > Logging
   - Set log level to "Debug"
   - Monitor logs in real-time

### Support Resources

1. **Documentation**
   - Plugin documentation: `/wordpress-plugin/docs/`
   - API documentation: `https://api.webqx.health/docs`
   - Video tutorials: `https://tutorials.webqx.health`

2. **Community Support**
   - GitHub issues: `https://github.com/WebQx/webqx/issues`
   - WordPress.org support forum
   - Community Slack channel

3. **Commercial Support**
   - Priority technical support
   - Professional services for deployment
   - Custom integration development
   - HIPAA compliance consulting

## Compliance and Legal Considerations

### HIPAA Compliance Checklist

- [ ] Business Associate Agreements signed
- [ ] Staff training completed
- [ ] Access controls implemented
- [ ] Audit logging enabled
- [ ] Encryption configured
- [ ] Backup and recovery procedures tested
- [ ] Incident response plan documented
- [ ] Risk assessment completed

### Documentation Requirements

1. **Maintain Documentation**
   - System architecture diagrams
   - Network security documentation
   - User access procedures
   - Incident response procedures
   - Backup and recovery procedures

2. **Regular Reviews**
   - Quarterly security reviews
   - Annual HIPAA compliance audits
   - Risk assessments
   - Policy updates

---

For additional support or questions about deployment, please contact:
- Email: support@webqx.health
- Documentation: https://docs.webqx.health
- Emergency Support: Available 24/7 for critical healthcare systems