# WebQx Healthcare WordPress Theme

A professional, responsive WordPress theme designed specifically for healthcare organizations, medical practices, and wellness providers. Built with accessibility, HIPAA compliance considerations, and user experience in mind.

## 🏥 Features

### Healthcare-Focused Design
- **Medical Specialties Support**: Built-in support for 12 core medical specialties including Primary Care, Pediatrics, Cardiology, Psychiatry, Radiology, and Oncology
- **Patient-Centric Interface**: Clean, professional design that puts patients first
- **Medical Disclaimer Integration**: Automatic medical disclaimers for health-related content
- **Emergency Contact Highlighting**: Prominent emergency contact information
- **HIPAA Compliance Considerations**: Security headers and privacy-focused design

### Responsive & Accessible
- **Mobile-First Design**: Fully responsive across all devices
- **WCAG 2.1 Compliance**: Built with accessibility best practices
- **Screen Reader Friendly**: Proper ARIA labels and semantic markup
- **Keyboard Navigation**: Full keyboard accessibility support
- **High Contrast Options**: Excellent readability for all users

### WordPress Integration
- **Block Editor Support**: Full Gutenberg compatibility
- **Custom Post Types**: Healthcare-specific content organization
- **Widget Areas**: Multiple sidebar and footer widget areas
- **Menu Support**: Primary and footer navigation menus
- **Customizer Integration**: Easy theme customization through WordPress Customizer

### Performance & Security
- **Optimized Loading**: Fast loading times with optimized assets
- **Security Headers**: Built-in security headers for enhanced protection
- **SEO Friendly**: Clean, semantic HTML structure
- **Translation Ready**: Full internationalization support

## 📋 Requirements

- **WordPress Version**: 5.0 or higher
- **PHP Version**: 7.4 or higher
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Recommended Plugins**: 
  - Yoast SEO or similar for SEO optimization
  - Contact Form 7 for patient contact forms
  - WooCommerce (if e-commerce functionality needed)

## 🚀 Installation

### Method 1: Manual Installation

1. **Download the theme files**:
   ```bash
   git clone https://github.com/WebQx/webqx.git
   cd webqx/wordpress-theme
   ```

2. **Upload to WordPress**:
   - Compress the `wordpress-theme` folder into a ZIP file
   - Go to WordPress Admin → Appearance → Themes
   - Click "Add New" → "Upload Theme"
   - Select the ZIP file and click "Install Now"
   - Activate the theme

### Method 2: Direct Upload

1. **FTP Upload**:
   - Upload the theme folder to `/wp-content/themes/webqx-healthcare/`
   - Go to WordPress Admin → Appearance → Themes
   - Activate "WebQx Healthcare Theme"

## ⚙️ Configuration

### Initial Setup

1. **Go to WordPress Admin → Appearance → Customize**

2. **Configure Healthcare Options**:
   - **Contact Information**: Add phone number, email, and address
   - **Theme Colors**: Customize primary color scheme
   - **Logo**: Upload your organization's logo

3. **Set up Menus**:
   - **Primary Menu**: Main navigation (recommended pages: Home, About, Services, Providers, Appointments, Contact)
   - **Footer Menu**: Footer navigation (recommended: Privacy Policy, Terms of Service, Patient Rights)

4. **Configure Widget Areas**:
   - **Primary Sidebar**: Add relevant widgets (Search, Recent Posts, Categories)
   - **Footer Widget Areas**: Add contact information, quick links, social media

### Healthcare-Specific Configuration

#### Medical Specialties Setup
When creating posts or pages, you can assign healthcare categories:
- Primary Care
- Pediatrics  
- Cardiology
- Psychiatry
- Radiology
- Oncology

#### Medical Disclaimer
Enable medical disclaimers for health-related content by checking the "Medical Disclaimer" option in the post editor.

#### Patient Portal Integration
Update the patient portal link in the sidebar widget or customize the portal access functionality in the theme files.

## 📄 Page Templates

### Required Pages
Create these pages for optimal functionality:

1. **Home**: Main landing page
2. **About**: Information about your practice/organization
3. **Services**: List of medical services offered
4. **Providers**: Meet the healthcare team
5. **Appointments**: Appointment scheduling information
6. **Contact**: Contact information and location
7. **Patient Portal**: Link to patient portal access
8. **Privacy Policy**: HIPAA-compliant privacy policy
9. **Terms of Service**: Legal terms and conditions

### Recommended Pages
- **Patient Rights**: Patient rights and responsibilities
- **Insurance**: Accepted insurance information
- **Forms**: Downloadable patient forms
- **FAQs**: Frequently asked questions
- **Accessibility**: Accessibility statement

## 🎨 Customization

### Theme Customizer Options

Access via **WordPress Admin → Appearance → Customize**:

#### Healthcare Options
- **Primary Color**: Main theme color (default: #2c5aa0)
- **Contact Information**: Phone, email, address
- **Office Hours**: Display operating hours

#### Site Identity
- **Logo**: Upload custom logo
- **Site Title & Tagline**: Organization name and description
- **Site Icon**: Favicon for browser tabs

#### Header & Navigation
- **Custom Header**: Add header image
- **Menu Locations**: Assign menus to locations

### CSS Customization

Add custom CSS via **WordPress Admin → Appearance → Customize → Additional CSS**:

```css
/* Example: Change primary color */
:root {
    --primary-color: #your-color;
}

/* Example: Customize header */
.site-header {
    background: linear-gradient(135deg, #your-color1, #your-color2);
}

/* Example: Custom button styles */
.btn {
    border-radius: 25px;
    text-transform: uppercase;
}
```

### PHP Customization

For advanced customization, create a child theme:

1. **Create child theme directory**: `/wp-content/themes/webqx-healthcare-child/`

2. **Create style.css**:
```css
/*
Theme Name: WebQx Healthcare Child
Template: webqx-healthcare
Version: 1.0.0
*/

@import url("../webqx-healthcare/style.css");

/* Your custom styles here */
```

3. **Create functions.php**:
```php
<?php
function webqx_child_enqueue_styles() {
    wp_enqueue_style('parent-style', get_template_directory_uri() . '/style.css');
}
add_action('wp_enqueue_scripts', 'webqx_child_enqueue_styles');

// Your custom functions here
?>
```

## 🔌 Plugin Compatibility

### Recommended Plugins

#### Essential Plugins
- **Yoast SEO**: Search engine optimization
- **Contact Form 7**: Patient contact forms
- **UpdraftPlus**: Backup solution
- **Wordfence Security**: Security enhancement

#### Healthcare-Specific Plugins
- **Appointment Booking**: Online appointment scheduling
- **Patient Management**: Patient data management (ensure HIPAA compliance)
- **Medical Forms**: Custom form creation for patient intake
- **Telehealth Integration**: Video consultation capabilities

#### Performance Plugins
- **WP Rocket**: Caching and performance optimization
- **Smush**: Image optimization
- **Autoptimize**: CSS/JS optimization

### Plugin Configuration Tips

1. **Contact Form 7 Setup**:
   - Create forms for: Contact, Appointment Requests, Patient Registration
   - Include medical disclaimer in all forms
   - Set up email notifications to appropriate staff

2. **SEO Configuration**:
   - Set up local SEO for medical practice
   - Configure schema markup for healthcare organization
   - Optimize for medical keywords

## 🔒 Security & Compliance

### HIPAA Considerations

While this theme includes security-focused features, achieving HIPAA compliance requires:

1. **Hosting**: Use HIPAA-compliant hosting provider
2. **SSL Certificate**: Ensure HTTPS is enabled
3. **Backup Encryption**: Use encrypted backup solutions
4. **Access Controls**: Implement proper user roles and permissions
5. **Regular Updates**: Keep WordPress, themes, and plugins updated

### Security Features Included

- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **File Edit Disable**: Prevents file editing from WordPress admin
- **Form Validation**: Client and server-side form validation
- **Secure Comments**: Medical disclaimer for comment forms

### Additional Security Recommendations

1. **Install security plugins** (Wordfence, Sucuri)
2. **Use strong passwords** and two-factor authentication
3. **Regular backups** with secure storage
4. **Monitor access logs** for suspicious activity
5. **Regular security audits** of the website

## 🌐 Translation & Localization

### Built-in Language Support

The theme is translation-ready with:
- Text domain: `webqx-healthcare`
- POT file included for translation
- RTL (Right-to-Left) language support

### Adding Translations

1. **Create language files**:
   - Copy `/languages/webqx-healthcare.pot`
   - Rename to `webqx-healthcare-[language_code].po`
   - Translate strings using Poedit or similar tool
   - Generate `.mo` file

2. **Upload language files** to `/wp-content/themes/webqx-healthcare/languages/`

## 🐛 Troubleshooting

### Common Issues

#### Theme Not Displaying Correctly
- **Check PHP version**: Ensure PHP 7.4 or higher
- **Plugin conflicts**: Deactivate all plugins and test
- **Browser cache**: Clear browser and any caching plugin cache

#### Customizer Changes Not Saving
- **Memory limits**: Increase PHP memory limit
- **File permissions**: Check WordPress file permissions
- **Plugin interference**: Test with default theme

#### Mobile Responsiveness Issues
- **Viewport meta tag**: Ensure it's present in header
- **CSS conflicts**: Check for conflicting CSS
- **Image sizes**: Optimize large images

### Getting Help

1. **Check documentation**: Review this README thoroughly
2. **WordPress forums**: Search WordPress.org support forums
3. **Theme support**: Contact WebQx development team
4. **Professional help**: Consider hiring WordPress developer for complex issues

## 📞 Support & Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Update WordPress core, themes, and plugins
   - Check for broken links
   - Review site performance

2. **Monthly**:
   - Full site backup
   - Security scan
   - Review analytics and SEO performance

3. **Quarterly**:
   - Content audit and updates
   - Accessibility review
   - Performance optimization

### Performance Optimization

1. **Image Optimization**:
   - Use WebP format when possible
   - Compress images before upload
   - Use appropriate image sizes

2. **Caching**:
   - Implement page caching
   - Use CDN for static assets
   - Enable browser caching

3. **Database Optimization**:
   - Regular database cleanup
   - Remove unused plugins/themes
   - Optimize database tables

## 📊 Analytics & Tracking

### Recommended Tracking Setup

1. **Google Analytics**: Website traffic and user behavior
2. **Google Search Console**: Search performance and SEO
3. **Local SEO**: Google My Business integration
4. **Conversion Tracking**: Track appointment requests and form submissions

### Privacy Considerations

- **Cookie Consent**: Implement cookie consent banner
- **Privacy Policy**: Keep updated with data collection practices
- **GDPR Compliance**: If serving EU users
- **Patient Privacy**: Never track personal health information

## 🔄 Updates & Changelog

### Version 1.0.0 (Current)
- Initial release
- Healthcare-focused design
- WordPress 6.4 compatibility
- Accessibility features
- Security enhancements
- Mobile responsiveness
- Customizer integration

### Planned Updates
- **v1.1.0**: Enhanced block editor support
- **v1.2.0**: Additional healthcare templates
- **v1.3.0**: Telehealth integration features

## 📄 License

This theme is licensed under the GPL v2 or later.
- **Theme License**: GPL v2 or later
- **Included Libraries**: Check individual library licenses
- **Font Licenses**: Google Fonts (Open Font License)

## 🤝 Contributing

We welcome contributions to improve this theme:

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/new-feature`
3. **Commit changes**: `git commit -am 'Add new feature'`
4. **Push to branch**: `git push origin feature/new-feature`
5. **Submit pull request**

### Contribution Guidelines
- Follow WordPress coding standards
- Include proper documentation
- Test across multiple browsers and devices
- Ensure accessibility compliance

## 📧 Support

For theme support and questions:
- **GitHub Issues**: Report bugs and request features
- **Email**: [Contact WebQx Team]
- **Documentation**: This README and inline code comments

---

**Note**: This theme is designed for healthcare organizations but is not a substitute for professional HIPAA compliance consultation. Always consult with healthcare compliance experts for regulatory requirements.