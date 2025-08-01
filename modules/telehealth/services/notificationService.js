/**
 * Telehealth Notification Service
 * Handles secure email and SMS notifications for telehealth session links
 */
class TelehealthNotificationService {
    constructor(options = {}) {
        this.options = {
            emailProvider: options.emailProvider || 'smtp', // smtp, ses, sendgrid
            smsProvider: options.smsProvider || 'twilio', // twilio, aws-sns
            fromEmail: options.fromEmail || process.env.TELEHEALTH_FROM_EMAIL || 'noreply@webqx.health',
            fromName: options.fromName || 'WebQX Telehealth',
            smtpConfig: options.smtpConfig || this.getDefaultSmtpConfig(),
            twilioConfig: options.twilioConfig || this.getDefaultTwilioConfig(),
            enableEmailNotifications: options.enableEmailNotifications !== false,
            enableSmsNotifications: options.enableSmsNotifications !== false,
            ...options
        };
        
        this.emailClient = null;
        this.smsClient = null;
        this.initializeClients();
    }

    /**
     * Initialize email and SMS clients
     */
    initializeClients() {
        // Initialize email client based on provider
        if (this.options.enableEmailNotifications) {
            try {
                switch (this.options.emailProvider) {
                    case 'smtp':
                        // Note: In a real implementation, you'd use nodemailer
                        this.emailClient = {
                            send: this.mockEmailSend.bind(this)
                        };
                        break;
                    default:
                        console.warn('[Telehealth Notifications] Email provider not configured, using mock');
                        this.emailClient = {
                            send: this.mockEmailSend.bind(this)
                        };
                }
            } catch (error) {
                console.error('[Telehealth Notifications] Failed to initialize email client:', error);
                this.emailClient = null;
            }
        }

        // Initialize SMS client
        if (this.options.enableSmsNotifications) {
            try {
                switch (this.options.smsProvider) {
                    case 'twilio':
                        // Note: In a real implementation, you'd use twilio SDK
                        this.smsClient = {
                            send: this.mockSmsSend.bind(this)
                        };
                        break;
                    default:
                        console.warn('[Telehealth Notifications] SMS provider not configured, using mock');
                        this.smsClient = {
                            send: this.mockSmsSend.bind(this)
                        };
                }
            } catch (error) {
                console.error('[Telehealth Notifications] Failed to initialize SMS client:', error);
                this.smsClient = null;
            }
        }
    }

    /**
     * Sends telehealth session invitation via preferred method
     * @param {Object} sessionData - Session information
     * @param {Object} notificationData - Notification details
     * @returns {Object} Notification result
     */
    async sendSessionInvitation(sessionData, notificationData) {
        try {
            const results = [];
            const preferredMethod = notificationData.preferredMethod || 'email';

            // Prepare notification content
            const content = this.prepareNotificationContent(sessionData, notificationData);

            // Send via preferred method first
            if (preferredMethod === 'email' && notificationData.email) {
                const emailResult = await this.sendEmailInvitation(notificationData.email, content);
                results.push(emailResult);
            } else if (preferredMethod === 'sms' && notificationData.phone) {
                const smsResult = await this.sendSmsInvitation(notificationData.phone, content);
                results.push(smsResult);
            }

            // Send backup notification if configured and different from preferred
            if (notificationData.sendBackup && preferredMethod !== 'email' && notificationData.email) {
                const emailResult = await this.sendEmailInvitation(notificationData.email, content);
                emailResult.isBackup = true;
                results.push(emailResult);
            }

            if (notificationData.sendBackup && preferredMethod !== 'sms' && notificationData.phone) {
                const smsResult = await this.sendSmsInvitation(notificationData.phone, content);
                smsResult.isBackup = true;
                results.push(smsResult);
            }

            console.log(`[Telehealth Notifications] Session invitation sent for ${sessionData.sessionId}:`, 
                results.map(r => `${r.method}: ${r.success ? 'success' : 'failed'}`).join(', '));

            return {
                success: results.some(r => r.success),
                results,
                sessionId: sessionData.sessionId
            };

        } catch (error) {
            console.error('[Telehealth Notifications] Failed to send session invitation:', error);
            throw error;
        }
    }

    /**
     * Sends email invitation for telehealth session
     * @param {string} email - Recipient email
     * @param {Object} content - Email content
     * @returns {Object} Send result
     */
    async sendEmailInvitation(email, content) {
        try {
            if (!this.emailClient) {
                throw new Error('Email client not initialized');
            }

            const emailData = {
                to: email,
                from: {
                    email: this.options.fromEmail,
                    name: this.options.fromName
                },
                subject: content.emailSubject,
                html: content.emailHtml,
                text: content.emailText,
                headers: {
                    'X-WebQX-Type': 'telehealth-invitation',
                    'X-WebQX-Session': content.sessionId
                }
            };

            const result = await this.emailClient.send(emailData);

            return {
                method: 'email',
                success: true,
                messageId: result.messageId,
                recipient: email,
                sentAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('[Telehealth Notifications] Email send failed:', error);
            return {
                method: 'email',
                success: false,
                error: error.message,
                recipient: email,
                attemptedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Sends SMS invitation for telehealth session
     * @param {string} phone - Recipient phone number
     * @param {Object} content - SMS content
     * @returns {Object} Send result
     */
    async sendSmsInvitation(phone, content) {
        try {
            if (!this.smsClient) {
                throw new Error('SMS client not initialized');
            }

            const smsData = {
                to: phone,
                from: this.options.smsFromNumber || '+1234567890',
                body: content.smsText
            };

            const result = await this.smsClient.send(smsData);

            return {
                method: 'sms',
                success: true,
                messageId: result.sid,
                recipient: phone,
                sentAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('[Telehealth Notifications] SMS send failed:', error);
            return {
                method: 'sms',
                success: false,
                error: error.message,
                recipient: phone,
                attemptedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Prepares notification content for session invitation
     * @param {Object} sessionData - Session information
     * @param {Object} notificationData - Notification details
     * @returns {Object} Prepared content
     */
    prepareNotificationContent(sessionData, notificationData) {
        const patientName = notificationData.patientName || 'Patient';
        const providerName = notificationData.providerName || 'Healthcare Provider';
        const scheduledDate = new Date(sessionData.scheduledFor);
        const formattedDate = scheduledDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        // Email content
        const emailSubject = `Your Telehealth Appointment with ${providerName} - ${formattedDate}`;
        
        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telehealth Appointment</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .appointment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
        .join-button { display: inline-block; background: #16a34a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
        .security-notice { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .footer { color: #6b7280; font-size: 12px; text-align: center; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏥 WebQX Telehealth</h1>
        <p>Your secure telehealth appointment is ready</p>
    </div>
    
    <div class="content">
        <h2>Hello ${patientName},</h2>
        
        <p>Your telehealth appointment has been scheduled and is ready to join.</p>
        
        <div class="appointment-details">
            <h3>📅 Appointment Details</h3>
            <p><strong>Provider:</strong> ${providerName}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            ${sessionData.metadata.specialty ? `<p><strong>Specialty:</strong> ${sessionData.metadata.specialty}</p>` : ''}
            <p><strong>Session Type:</strong> ${sessionData.metadata.sessionType || 'Consultation'}</p>
        </div>
        
        <div style="text-align: center;">
            <a href="${sessionData.accessLink}" class="join-button">Join Telehealth Session</a>
        </div>
        
        <div class="security-notice">
            <h4>🔒 Important Security Information</h4>
            <ul>
                <li>This link is secure and personalized for you</li>
                <li>You'll be asked to provide consent before joining</li>
                <li>Do not share this link with others</li>
                <li>The link expires on ${new Date(sessionData.expiresAt).toLocaleString()}</li>
            </ul>
        </div>
        
        <h3>📋 Before You Join:</h3>
        <ul>
            <li>Ensure you have a stable internet connection</li>
            <li>Test your camera and microphone</li>
            <li>Find a quiet, private space</li>
            <li>Have your ID and insurance information ready</li>
        </ul>
        
        <h3>💻 Technical Requirements:</h3>
        <ul>
            <li>Modern web browser (Chrome, Firefox, Safari, Edge)</li>
            <li>Webcam and microphone</li>
            <li>Broadband internet connection</li>
        </ul>
        
        <p>If you experience any technical difficulties, please contact our support team.</p>
        
        <p>We look forward to providing you with excellent care through our secure telehealth platform.</p>
        
        <p>Best regards,<br>The WebQX Healthcare Team</p>
    </div>
    
    <div class="footer">
        <p>This email contains confidential healthcare information intended only for ${patientName}.</p>
        <p>If you received this email in error, please delete it immediately.</p>
        <p>© 2024 WebQX Health. All rights reserved.</p>
    </div>
</body>
</html>`;

        const emailText = `
WebQX Telehealth - Appointment Invitation

Hello ${patientName},

Your telehealth appointment has been scheduled:

Provider: ${providerName}
Date: ${formattedDate}
Time: ${formattedTime}
${sessionData.metadata.specialty ? `Specialty: ${sessionData.metadata.specialty}` : ''}
Session Type: ${sessionData.metadata.sessionType || 'Consultation'}

Join your session: ${sessionData.accessLink}

IMPORTANT SECURITY INFORMATION:
- This link is secure and personalized for you
- You'll be asked to provide consent before joining
- Do not share this link with others
- Link expires: ${new Date(sessionData.expiresAt).toLocaleString()}

Before you join:
- Ensure stable internet connection
- Test camera and microphone
- Find a quiet, private space
- Have ID and insurance information ready

Technical requirements:
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Webcam and microphone
- Broadband internet connection

If you need technical support, please contact our team.

Best regards,
The WebQX Healthcare Team

This message contains confidential healthcare information.
        `.trim();

        // SMS content
        const smsText = `WebQX Telehealth: Your appointment with ${providerName} is ready. Join securely: ${sessionData.accessLink} (expires ${new Date(sessionData.expiresAt).toLocaleDateString()}). Do not share this link.`;

        return {
            sessionId: sessionData.sessionId,
            emailSubject,
            emailHtml,
            emailText,
            smsText
        };
    }

    /**
     * Sends reminder notification for upcoming session
     * @param {Object} sessionData - Session information
     * @param {Object} notificationData - Notification details
     * @returns {Object} Notification result
     */
    async sendSessionReminder(sessionData, notificationData) {
        try {
            const reminderContent = this.prepareReminderContent(sessionData, notificationData);
            const results = [];

            if (notificationData.email) {
                const emailResult = await this.sendEmailReminder(notificationData.email, reminderContent);
                results.push(emailResult);
            }

            if (notificationData.phone) {
                const smsResult = await this.sendSmsReminder(notificationData.phone, reminderContent);
                results.push(smsResult);
            }

            return {
                success: results.some(r => r.success),
                results,
                sessionId: sessionData.sessionId
            };

        } catch (error) {
            console.error('[Telehealth Notifications] Failed to send reminder:', error);
            throw error;
        }
    }

    /**
     * Mock implementations for development/testing
     */
    async mockEmailSend(emailData) {
        console.log('[Mock Email] Sending email:', {
            to: emailData.to,
            subject: emailData.subject,
            from: emailData.from
        });
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
            messageId: `mock-email-${Date.now()}`,
            accepted: [emailData.to],
            rejected: []
        };
    }

    async mockSmsSend(smsData) {
        console.log('[Mock SMS] Sending SMS:', {
            to: smsData.to,
            from: smsData.from,
            body: smsData.body.substring(0, 50) + '...'
        });
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
            sid: `mock-sms-${Date.now()}`,
            status: 'queued'
        };
    }

    /**
     * Helper methods for configuration
     */
    getDefaultSmtpConfig() {
        return {
            host: process.env.SMTP_HOST || 'localhost',
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        };
    }

    getDefaultTwilioConfig() {
        return {
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            authToken: process.env.TWILIO_AUTH_TOKEN,
            fromNumber: process.env.TWILIO_FROM_NUMBER
        };
    }

    prepareReminderContent(sessionData, notificationData) {
        const timeUntil = Math.round((new Date(sessionData.scheduledFor).getTime() - Date.now()) / (1000 * 60));
        
        return {
            emailSubject: `Reminder: Telehealth appointment in ${timeUntil} minutes`,
            smsText: `Reminder: Your telehealth appointment starts in ${timeUntil} minutes. Join: ${sessionData.accessLink}`
        };
    }

    async sendEmailReminder(email, content) {
        // Implementation similar to sendEmailInvitation but with reminder content
        return this.mockEmailSend({
            to: email,
            subject: content.emailSubject
        });
    }

    async sendSmsReminder(phone, content) {
        // Implementation similar to sendSmsInvitation but with reminder content
        return this.mockSmsSend({
            to: phone,
            body: content.smsText
        });
    }
}

module.exports = TelehealthNotificationService;