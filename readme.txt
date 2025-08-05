=== WebQX Healthcare Platform ===
Contributors: webqxhealth
Tags: healthcare, medical, patient-portal, telehealth, fhir, ehr, health-records, appointments, telemedicine
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: Apache-2.0
License URI: http://www.apache.org/licenses/LICENSE-2.0

WebQX™: Comprehensive modular healthcare platform with patient portals, provider dashboards, telehealth, and FHIR-compliant EHR integrations.

== Description ==

WebQX Healthcare Platform transforms your WordPress site into a comprehensive healthcare management system. This plugin provides a secure bridge to the WebQX™ Node.js healthcare application, offering:

**🏥 Core Healthcare Features:**
* **Patient Portal** - Secure patient access to medical records, appointments, and lab results
* **Provider Dashboard** - Clinical workflow management and patient care tools
* **Telehealth Integration** - HIPAA-compliant video consultations and messaging
* **Lab Results Viewer** - HL7/FHIR integration with filtering and sorting capabilities
* **Appointment Scheduling** - Integrated booking system with calendar sync
* **Secure Messaging** - Encrypted communication between patients and providers

**🌍 Global Healthcare Standards:**
* **FHIR R4 Compliance** - Full Fast Healthcare Interoperability Resources support
* **HL7 Integration** - Standard healthcare data exchange protocols
* **HIPAA Compliance** - Healthcare privacy and security regulations
* **Multi-language Support** - Internationalization for global accessibility
* **Audit Logging** - Complete activity tracking for regulatory compliance

**🔧 Technical Excellence:**
* **Modular Architecture** - Enable only the features you need
* **RESTful API** - Modern web service integration
* **Real-time Updates** - Live data synchronization
* **Mobile Responsive** - Optimized for all devices
* **Security First** - End-to-end encryption and secure authentication

**🏥 Specialty Support:**
WebQX supports workflows for 12+ medical specialties including:
* Primary Care
* Radiology
* Cardiology
* Pediatrics
* Oncology
* Psychiatry
* Endocrinology
* Orthopedics
* Neurology
* Gastroenterology
* Pulmonology
* Dermatology

**🔗 EHR Integrations:**
Compatible with major Electronic Health Record systems:
* OpenEMR
* OpenMRS
* HospitalRun
* GNU Health
* Epic (via FHIR)
* Cerner (via FHIR)
* Allscripts
* NextGen

**🚀 Easy WordPress Integration:**
* Simple shortcode integration: `[webqx_patient_portal]`
* WordPress user authentication
* Role-based access control
* Seamless admin interface
* One-click configuration

== Installation ==

**Minimum Requirements:**
* WordPress 5.0 or higher
* PHP 7.4 or higher
* Node.js 16.0+ (for backend service)
* MySQL 5.6+ or PostgreSQL 10+
* SSL certificate (required for healthcare data)

**Installation Steps:**

1. **Install the Plugin:**
   * Upload the plugin files to `/wp-content/plugins/webqx-healthcare-platform/`
   * Or install via WordPress Admin → Plugins → Add New → Upload Plugin
   * Activate the plugin through the 'Plugins' screen

2. **Setup Node.js Backend:**
   * Download the WebQX Node.js application from GitHub
   * Install dependencies: `npm install`
   * Configure environment variables (see Configuration section)
   * Start the server: `npm start`

3. **Configure WordPress Plugin:**
   * Go to WebQX Healthcare → Settings in WordPress Admin
   * Enter your Node.js server URL (default: http://localhost:3000)
   * Configure FHIR endpoint if using external EHR
   * Enable desired features (Patient Portal, Provider Dashboard, Telehealth)

4. **Add to Pages:**
   * Create new pages for healthcare features
   * Use shortcodes to embed WebQX components:
     * `[webqx_patient_portal]` - Patient portal interface
     * `[webqx_provider_dashboard]` - Provider clinical dashboard
     * `[webqx_telehealth session_id="123"]` - Telehealth consultation
     * `[webqx_lab_results]` - Laboratory results viewer

**Quick Start:**
For testing, you can use the included mock servers by setting `NODE_ENV=development` when starting the Node.js application.

== Configuration ==

**WordPress Settings:**
Navigate to **WebQX Healthcare → Settings** to configure:

* **Node.js Server URL** - URL where your WebQX Node.js application is running
* **FHIR Endpoint** - External FHIR server URL (if using)
* **API Authentication** - API keys for secure communication
* **Feature Toggles** - Enable/disable specific modules
* **Telehealth Settings** - Video server configuration
* **Audit Logging** - Compliance tracking options

**Environment Variables:**
Configure these in your Node.js application's `.env` file:

```
# Server Configuration
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@localhost/webqx

# Security
JWT_SECRET=your-256-bit-secret
ENCRYPTION_KEY=your-encryption-key

# FHIR Configuration
FHIR_SERVER_URL=https://your-fhir-server.com/fhir
FHIR_CLIENT_ID=your-client-id

# Telehealth
JITSI_DOMAIN=meet.jit.si
WHISPER_API_KEY=your-whisper-key

# Compliance
ENABLE_AUDIT_LOGGING=true
HIPAA_COMPLIANCE_MODE=true
```

**SSL Requirements:**
Healthcare data requires HTTPS. Ensure your WordPress site has a valid SSL certificate installed.

== Frequently Asked Questions ==

= Is this HIPAA compliant? =
Yes, WebQX is designed with HIPAA compliance in mind. The platform includes:
* End-to-end encryption for all patient data
* Comprehensive audit logging
* Role-based access controls
* Secure authentication mechanisms
* Data breach notification systems

However, HIPAA compliance also requires proper configuration, staff training, and business associate agreements. Consult with healthcare compliance experts for your specific implementation.

= What EHR systems does WebQX integrate with? =
WebQX supports both open-source and commercial EHR systems through:
* **Direct Integration**: OpenEMR, OpenMRS, HospitalRun, GNU Health
* **FHIR APIs**: Epic, Cerner, Allscripts, NextGen, and any FHIR R4 compliant system
* **HL7 Interfaces**: Legacy systems via Mirth Connect
* **Custom APIs**: RESTful web services for proprietary systems

= Can I use this without medical training? =
While WebQX provides the technical platform, it's designed for use by licensed healthcare professionals. The system should be implemented and managed by qualified medical personnel who understand healthcare regulations and patient safety requirements.

= Does this work with my existing WordPress theme? =
Yes! WebQX is designed to work with any properly coded WordPress theme. The healthcare components are embedded using shortcodes and styled to match your site's appearance.

= Is patient data stored in WordPress? =
No, patient data is stored securely in the Node.js backend application, not in WordPress. WordPress only serves as the presentation layer and authentication gateway. This architecture provides better security isolation and HIPAA compliance.

= Can I customize the healthcare modules? =
Absolutely! WebQX features a modular architecture. You can:
* Enable/disable specific features
* Customize the user interface
* Add specialty-specific workflows
* Integrate with additional EHR systems
* Modify FHIR resource mappings

= What about mobile devices? =
WebQX is fully responsive and optimized for mobile devices. Patients and providers can access all features from smartphones and tablets with full functionality.

= Do you provide support? =
Community support is available through the WordPress.org plugin forums. For enterprise implementations, professional support and customization services are available through WebQX Health.

== Screenshots ==

1. **Admin Dashboard** - WebQX Healthcare settings and Node.js server status monitoring
2. **Patient Portal** - Secure patient interface for appointments, records, and messaging  
3. **Provider Dashboard** - Clinical workflow management with EHR integration
4. **Telehealth Interface** - HIPAA-compliant video consultations with real-time chat
5. **Lab Results Viewer** - FHIR-compliant laboratory results with filtering and sorting
6. **Settings Page** - Easy configuration of all WebQX features and integrations

== Changelog ==

= 1.0.0 =
* Initial WordPress.org release
* Full WordPress integration with shortcode support
* Node.js backend proxy with secure authentication
* Patient Portal with appointment scheduling and secure messaging
* Provider Dashboard with EHR integration capabilities
* Telehealth module with video consultations
* Lab Results Viewer with FHIR compliance
* Multi-language support and accessibility features
* HIPAA-compliant audit logging and security measures
* Integration support for major EHR systems
* Mobile-responsive design for all devices
* Comprehensive admin interface for configuration
* RESTful API endpoints for custom integrations

== Upgrade Notice ==

= 1.0.0 =
Welcome to WebQX Healthcare Platform! This initial release provides a complete healthcare management system for WordPress. Please ensure your Node.js backend is properly configured before activating.

== Additional Information ==

**License Compatibility:**
WebQX Healthcare Platform is licensed under Apache 2.0, which is compatible with WordPress's GPL licensing requirements. All dependencies use GPL-compatible licenses.

**Professional Services:**
For enterprise implementations, custom development, or compliance consulting, contact WebQX Health at https://webqx.health

**Contributing:**
WebQX is open source! Contribute to the project on GitHub: https://github.com/WebQx/webqx

**Healthcare Disclaimer:**
This software is provided as a platform for healthcare applications but should not be used for medical diagnosis or treatment without proper medical oversight. Always consult qualified healthcare professionals for medical decisions.