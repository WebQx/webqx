=== WebQX Healthcare Platform ===
Contributors: webqxhealth
Tags: healthcare, medical, patient-portal, fhir, hipaa, telemedicine, appointments, ehr
Requires at least: 5.0
Tested up to: 6.4
Stable tag: 1.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

WordPress integration for WebQX™ - A comprehensive modular healthcare platform for patient portals, provider panels, and administrative functions.

== Description ==

WebQX Healthcare Platform brings enterprise-grade healthcare functionality to WordPress, providing seamless integration with the WebQX Node.js backend system. This plugin transforms your WordPress site into a comprehensive healthcare management platform supporting both patients and healthcare providers.

= Key Features =

**🌐 Multilingual Healthcare Support**
* Support for 12+ languages with healthcare-specific terminology
* Specialty-aware translations for medical specialties
* Cultural sensitivity features for global healthcare delivery

**🏥 Patient Portal**
* Secure patient dashboard with HIPAA-compliant data handling
* Appointment scheduling and management
* Lab results viewing with filtering and sorting
* Secure messaging with healthcare providers
* Prescription management and pharmacy integration
* Health literacy assistance with AI-powered explanations

**👩‍⚕️ Provider Portal**  
* EHR summary dashboard with patient overview
* Clinical decision support and alerts
* Prescription management with RxNorm integration
* CME tracking and continuing education
* Provider assistant with AI-powered insights
* Medical transcription suite with specialty macros

**🛠️ Administrative Console**
* Role-based access control with healthcare-specific permissions
* FHIR R4 integration for interoperability
* Comprehensive audit logging for compliance
* Analytics and reporting dashboard
* Integration engine for external EHR systems
* Billing and insurance management

**🔒 Security & Compliance**
* HIPAA-compliant data handling and encryption
* Two-factor authentication support
* Comprehensive audit logging
* GDPR compliance with data export/erasure
* Advanced security headers and CSP policies
* Account lockout protection against brute force attacks

**📊 Healthcare Specialties Supported**
* Primary Care
* Cardiology  
* Radiology
* Oncology
* Psychiatry & Mental Health
* Pediatrics
* Obstetrics & Gynecology
* Orthopedics
* Dermatology
* Neurology
* Emergency Medicine
* Internal Medicine

= Integration Capabilities =

**EHR Systems**
* OpenEMR integration
* OpenMRS compatibility
* Epic MyChart support
* Cerner PowerChart integration
* Custom EHR API connections

**Standards Support**
* FHIR R4 resources and APIs
* HL7 message processing
* DICOM image viewing
* X12 transaction processing
* CCD/CCR document exchange

**Third-Party Services**
* Keycloak SSO integration
* Pharmacy APIs (RxNorm, FDA Orange Book)
* Lab integration (HL7 results)
* Insurance verification APIs
* Telehealth platform connections

= Shortcodes Available =

* `[webqx_patient_portal]` - Complete patient dashboard
* `[webqx_provider_portal]` - Provider workspace
* `[webqx_appointment_booking]` - Appointment scheduler
* `[webqx_provider_directory]` - Healthcare provider listings
* `[webqx_health_dashboard]` - Personal health overview

= REST API Endpoints =

The plugin provides REST API endpoints for integration:
* `/wp-json/webqx/v1/health` - System health check
* `/wp-json/webqx/v1/patients` - Patient data management
* `/wp-json/webqx/v1/appointments` - Appointment system
* `/wp-json/webqx/v1/providers` - Provider directory
* `/wp-json/webqx/v1/fhir/*` - FHIR resource endpoints

= Requirements =

**WordPress Requirements**
* WordPress 5.0 or higher
* PHP 7.4 or higher
* MySQL 5.6 or higher
* SSL certificate (required for HIPAA compliance)

**PHP Extensions**
* cURL (for API communication)
* JSON (for data exchange)
* OpenSSL (for encryption)
* mbstring (for international support)

**External Services**
* WebQX Node.js backend server (included in full package)
* Database server (MySQL/PostgreSQL)
* Optional: Redis for caching and sessions

== Installation ==

= Automatic Installation =

1. Log in to your WordPress admin panel
2. Navigate to Plugins > Add New
3. Search for "WebQX Healthcare Platform"
4. Click "Install Now" and then "Activate"
5. Follow the setup wizard to configure your backend connection

= Manual Installation =

1. Download the plugin zip file
2. Upload to your WordPress plugins directory (`/wp-content/plugins/`)
3. Extract the files
4. Activate the plugin through the WordPress admin interface
5. Configure the plugin settings under WebQX Healthcare > Settings

= Backend Setup =

1. Deploy the WebQX Node.js backend (see deployment documentation)
2. Configure your backend URL in WordPress admin
3. Test the connection using the built-in connectivity checker
4. Configure user roles and permissions as needed
5. Set up your healthcare modules (Patient Portal, Provider Portal, etc.)

== Frequently Asked Questions ==

= Is this plugin HIPAA compliant? =

Yes, when properly configured and used with appropriate infrastructure. The plugin includes HIPAA-specific security features, audit logging, encryption, and data handling procedures. However, HIPAA compliance requires proper deployment, training, and business associate agreements.

= Can I use this without the WebQX backend? =

The plugin is designed to work with the WebQX Node.js backend system. While some basic WordPress functionality will work independently, full healthcare features require the backend integration.

= Which EHR systems are supported? =

The plugin supports integration with major EHR systems including OpenEMR, OpenMRS, Epic, Cerner, and others through FHIR R4 APIs. Custom integrations can be developed for proprietary systems.

= Is multi-site supported? =

Yes, the plugin supports WordPress multisite installations with site-specific configuration and shared user authentication across the network.

= What about mobile compatibility? =

The plugin includes responsive design templates optimized for mobile devices, tablets, and desktop computers. Native mobile apps can integrate using the REST API endpoints.

= How do I migrate from other healthcare systems? =

The plugin includes data migration tools for common formats (FHIR, HL7, CSV). Professional services are available for complex migrations from proprietary systems.

== Screenshots ==

1. Patient Portal Dashboard - Complete overview of patient health information
2. Provider Portal - Healthcare provider workspace with patient management
3. Appointment Booking System - Easy-to-use appointment scheduler  
4. Admin Settings Panel - Comprehensive configuration options
5. FHIR Integration Dashboard - Real-time EHR system connectivity
6. Security Audit Log - HIPAA-compliant activity monitoring
7. Provider Directory - Searchable healthcare provider listings
8. Mobile Patient Portal - Responsive design for mobile devices

== Changelog ==

= 1.0.0 =
* Initial release
* Patient portal functionality
* Provider portal with EHR integration
* FHIR R4 API support
* HIPAA compliance features
* Multi-language support
* Comprehensive security framework
* WordPress multisite compatibility
* REST API endpoints
* Keycloak SSO integration
* Audit logging system
* Custom post types for healthcare data
* Role-based access control
* Two-factor authentication
* GDPR compliance tools

== Upgrade Notice ==

= 1.0.0 =
Initial release of WebQX Healthcare Platform. Please review the installation and configuration documentation before deploying in production environments.

== Privacy Policy ==

This plugin integrates with external healthcare systems and may collect, process, and store protected health information (PHI). Please ensure:

1. You have appropriate business associate agreements
2. Your hosting environment meets HIPAA requirements  
3. SSL certificates are properly configured
4. Regular security audits are performed
5. Staff receives appropriate HIPAA training

For detailed privacy and security documentation, visit: https://docs.webqx.health/privacy

== Support ==

**Community Support**
* WordPress.org support forums
* GitHub issues and discussions
* Community documentation wiki

**Commercial Support**
* Priority technical support
* Professional services for deployment
* Custom integration development
* HIPAA compliance consulting
* Training and certification programs

**Documentation**
* Installation guides: https://docs.webqx.health/installation
* API documentation: https://api.webqx.health/docs
* Integration examples: https://github.com/WebQx/webqx-examples
* Video tutorials: https://tutorials.webqx.health

== License ==

This plugin is licensed under the GPL v2 or later.

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.