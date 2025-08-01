# Patient Access Portal - Email and Cell Phone Login Guide

## Overview

The WebQX Patient Access Portal supports secure authentication using both email/password and Microsoft Entra ID integration, with multi-factor authentication (MFA) via SMS for enhanced security.

## Login Methods

### 1. Email and Password Login

#### Creating a Local Account
1. Visit the patient portal registration page
2. Fill in the required information:
   - **Full Name**: Your legal name
   - **Email Address**: Valid email for account verification
   - **Password**: Must be at least 8 characters with uppercase, lowercase, and numbers
   - **Phone Number** (Optional): In E.164 format (e.g., +1234567890)

3. Click "Register" to create your account
4. You'll receive a confirmation email to verify your account

#### Signing In
1. Go to the patient portal login page
2. Enter your email and password
3. If MFA is enabled, you'll receive an SMS with a 6-digit code
4. Enter the code to complete login

### 2. Microsoft Entra ID Single Sign-On (SSO)

#### Prerequisites
- Your healthcare organization must have Microsoft Entra ID configured
- You must have an active Microsoft work or school account
- Your account must be assigned appropriate healthcare roles

#### Using SSO Login
1. Click "Sign in with Microsoft" on the login page
2. You'll be redirected to Microsoft's login page
3. Enter your organizational credentials
4. Complete any required MFA steps (handled by Microsoft)
5. You'll be redirected back to the patient portal, automatically logged in

## Multi-Factor Authentication (MFA)

### Enabling MFA
1. Log into your account
2. Go to Account Settings → Security
3. Toggle "Enable Multi-Factor Authentication"
4. Ensure your phone number is verified

### Using MFA
1. Enter your email and password
2. Click "Send Code" when prompted
3. Check your phone for a 6-digit SMS code
4. Enter the code within 5 minutes
5. Complete login

### MFA via Microsoft Entra ID
When using SSO, MFA is handled by your organization's Microsoft Entra ID policies:
- SMS to registered mobile device
- Microsoft Authenticator app
- Phone call verification
- Hardware security keys (if configured)

## Phone Number Setup

### Adding Your Phone Number
1. During registration, enter your phone number in international format
2. Or add it later in Account Settings → Contact Information

### Phone Number Format
- Use E.164 international format
- Examples:
  - US: +1234567890
  - UK: +441234567890
  - Canada: +1234567890

### Phone Number Verification
1. Save your phone number in settings
2. Click "Verify Phone Number"
3. You'll receive an SMS with a verification code
4. Enter the code to confirm your number

## SMS Notifications

Once your phone number is verified, you'll receive SMS notifications for:

### Appointment Confirmations
- Sent when appointments are scheduled
- Include date, time, provider, and location
- Reply options for cancellation

### Appointment Reminders
- Sent 24 hours before appointments
- Include confirmation options

### Secure Messages
- Alerts when you receive new messages from providers
- Include link to portal

### Lab Results
- Notification when results are available
- Direct link to view results

### Critical Alerts
- Urgent medical notifications
- Direct contact information for immediate follow-up

### Security Alerts
- Login from new devices
- Account security changes

## Security Features

### Conditional Access Policies
Your organization may have configured additional security requirements:
- **Compliant Device Required**: Only approved devices can access
- **Location Restrictions**: Access limited to certain locations
- **Time-based Access**: Login restricted to business hours
- **Risk-based Policies**: Additional verification for suspicious activity

### Account Security
- Passwords are securely encrypted
- All login attempts are logged
- Failed login attempts are tracked and limited
- Sessions automatically expire for security

## Troubleshooting

### Can't Receive SMS Codes
1. Check your phone number format (must include country code)
2. Ensure your phone has signal and can receive texts
3. Check spam/blocked messages
4. Wait 60 seconds between retry attempts
5. Contact support if issues persist

### Microsoft SSO Issues
1. Ensure you're using your work/school account, not personal
2. Contact your IT administrator for account access
3. Clear browser cache and cookies
4. Try incognito/private browsing mode

### Account Locked
- Accounts lock after 5 failed login attempts
- Wait 15 minutes before trying again
- Or contact support for immediate unlock

### Forgot Password
1. Click "Forgot Password" on login page
2. Enter your email address
3. Check email for reset instructions
4. Follow the link to create a new password

## Mobile App Access

The patient portal is mobile-friendly and works on all devices:
- Responsive design adapts to screen size
- Touch-optimized interface
- Offline viewing for downloaded content
- Push notifications (when enabled)

## Privacy and Compliance

### HIPAA Compliance
- All communications are encrypted
- Access logs are maintained
- Data is stored securely in compliance with healthcare regulations

### Data Protection
- Your information is never shared without consent
- Strong encryption protects data in transit and at rest
- Regular security audits ensure system integrity

## Support

### Getting Help
- **Technical Support**: 1-800-WEBQX-HELP
- **Medical Questions**: Contact your provider directly
- **Account Issues**: Use the "Contact Support" form in the portal

### Support Hours
- Monday-Friday: 8 AM - 8 PM
- Saturday: 9 AM - 5 PM
- Sunday: Closed
- Emergency support available 24/7

## Quick Reference

### Login URL
- Portal: https://portal.webqx.health
- Microsoft SSO: Click "Sign in with Microsoft" button

### Phone Format Examples
- US/Canada: +1 (area code) (number) → +12345678901
- International: +(country code)(number) → +441234567890

### MFA Code
- 6 digits sent via SMS
- Valid for 5 minutes
- 3 attempts allowed per request

### Emergency Access
If you can't access your account during a medical emergency:
1. Contact your healthcare provider directly
2. Call the emergency support line: 1-800-WEBQX-911
3. Visit the emergency department with photo ID

## Feature Updates

This system includes the latest security features:
- ✅ Email/password authentication
- ✅ Microsoft Entra ID SSO integration
- ✅ SMS multi-factor authentication
- ✅ Phone number verification
- ✅ Automated appointment notifications
- ✅ Secure message alerts
- ✅ Conditional access policies
- ✅ Healthcare role-based access

For the most current information, check the portal's Help section or contact support.