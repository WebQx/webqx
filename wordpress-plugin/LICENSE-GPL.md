# WebQX Healthcare Platform - WordPress Plugin License

## Plugin License: GPL v2 or later

The WebQX Healthcare Platform WordPress Plugin is licensed under the GNU General Public License v2 or later (GPLv2+).

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program; if not, write to the Free Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

## License Compatibility Notice

### WordPress Plugin Components (GPL v2+)
The following components are licensed under GPL v2 or later to ensure WordPress.org compatibility:
- WordPress plugin files (`webqx-healthcare.php` and all PHP files)
- WordPress-specific templates and partials
- WordPress admin interface components
- WordPress shortcodes and hooks
- WordPress REST API endpoints
- WordPress-specific CSS and JavaScript

### Backend Integration (Apache 2.0)
The WebQX Node.js backend system remains under Apache 2.0 license:
- Node.js server application
- Express.js routes and middleware
- Healthcare integration modules
- FHIR and HL7 processors
- EHR integration adapters
- Telehealth modules

### License Compatibility
Apache 2.0 and GPL v2+ are compatible for this integration because:
1. The WordPress plugin (GPL) interfaces with but does not incorporate the Apache 2.0 backend
2. Communication occurs via HTTP APIs, maintaining separation
3. No Apache 2.0 code is directly embedded in the GPL plugin
4. Users can operate each component under their respective licenses

## Third-Party Dependencies

### WordPress Plugin Dependencies (GPL-compatible)
All WordPress plugin dependencies use GPL-compatible licenses:
- WordPress Core APIs (GPL v2+)
- WordPress standard libraries (GPL v2+)
- No external libraries embedded in plugin code

### Backend Dependencies (Apache 2.0 compatible)
Backend dependencies maintain Apache 2.0 compatibility:
- Express.js (MIT License)
- Node.js core modules (MIT License)  
- Healthcare libraries with permissive licenses

## License Headers

All WordPress plugin files include appropriate GPL headers:
```php
/**
 * @package WebQX_Healthcare
 * @license GPL v2 or later
 * @copyright 2024 WebQX Health
 */
```

Backend files maintain Apache 2.0 headers:
```javascript
/**
 * @license Apache-2.0
 * @copyright 2024 WebQX Health
 */
```

## Distribution

### WordPress.org Distribution
The WordPress plugin distributed through WordPress.org includes only GPL-licensed components and clearly documents the requirement for the separately-licensed backend system.

### Full System Distribution
Complete WebQX deployments may include both GPL and Apache 2.0 components, with clear licensing documentation for each component.

## Commercial Usage

Both licenses permit commercial usage:
- GPL v2+ allows commercial use with source code availability requirements
- Apache 2.0 allows commercial use with attribution requirements
- Integration of both components is permitted in commercial deployments

## Compliance Requirements

### For WordPress.org Submission
- Plugin code: Must be GPL v2+ compatible ✅
- No proprietary dependencies embedded ✅  
- Clear documentation of external system requirements ✅

### For Healthcare Deployments
- HIPAA compliance requirements independent of software licensing
- Business Associate Agreements required regardless of license
- Professional services available for compliance consulting

## Contact

For licensing questions or commercial licensing options:
- Email: legal@webqx.health
- Documentation: https://docs.webqx.health/licensing
- Legal page: https://webqx.health/legal

---

*This license notice addresses WordPress.org submission requirements while maintaining compatibility with the existing Apache 2.0 backend system.*