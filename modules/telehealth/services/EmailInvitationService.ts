/**
 * Email Invitation Service
 * 
 * Service for sending and managing telehealth session email invitations
 * including template management, delivery tracking, and reminder scheduling.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SessionInvitation,
  EmailTemplateData,
  EmailConfig,
  TelehealthApiResponse,
  TelehealthSession
} from '../types';

/**
 * Email Invitation Service
 * 
 * Handles all email invitation functionality for telehealth sessions
 */
export class EmailInvitationService {
  private config: EmailConfig;
  private invitations: Map<string, SessionInvitation> = new Map();

  constructor(config: EmailConfig) {
    this.config = config;
  }

  // ============================================================================
  // Invitation Management Methods
  // ============================================================================

  /**
   * Send telehealth session invitation via email
   */
  async sendInvitation(
    session: TelehealthSession,
    customMessage?: string
  ): Promise<TelehealthApiResponse<SessionInvitation>> {
    try {
      // Validate session has patient email
      if (!session.patient.email) {
        return {
          success: false,
          error: {
            code: 'MISSING_EMAIL',
            message: 'Patient email address is required'
          }
        };
      }

      // Generate invitation token and URL
      const invitationToken = this.generateInvitationToken();
      const invitationUrl = this.buildInvitationUrl(session.id, invitationToken);

      // Prepare email template data
      const templateData = this.prepareTemplateData(session, invitationUrl, customMessage);

      // Generate email content
      const emailContent = this.generateEmailContent(templateData);

      // Create invitation record
      const invitation: SessionInvitation = {
        id: uuidv4(),
        sessionId: session.id,
        patientEmail: session.patient.email,
        invitationToken,
        status: 'pending',
        invitationUrl,
        emailContent,
        expiresAt: new Date(session.scheduledDateTime.getTime() + 60 * 60 * 1000), // 1 hour after session
        sentAt: undefined,
        openedAt: undefined,
        clickedAt: undefined
      };

      // Send email
      const emailSent = await this.sendEmail(
        session.patient.email,
        emailContent.subject,
        emailContent.htmlBody,
        emailContent.textBody
      );

      if (!emailSent) {
        return {
          success: false,
          error: {
            code: 'EMAIL_SEND_FAILED',
            message: 'Failed to send invitation email'
          }
        };
      }

      // Update invitation status
      invitation.status = 'sent';
      invitation.sentAt = new Date();

      // Store invitation
      this.invitations.set(invitation.id, invitation);

      console.log(`[Email Service] Invitation sent for session ${session.id} to ${session.patient.email}`);

      return {
        success: true,
        data: invitation
      };

    } catch (error) {
      console.error('[Email Service] Send invitation error:', error);
      return {
        success: false,
        error: {
          code: 'INVITATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }

  /**
   * Send reminder email for upcoming session
   */
  async sendReminder(
    session: TelehealthSession,
    reminderType: '24h' | '1h' | '15m' = '24h'
  ): Promise<TelehealthApiResponse<boolean>> {
    try {
      if (!session.patient.email) {
        return {
          success: false,
          error: {
            code: 'MISSING_EMAIL',
            message: 'Patient email address is required'
          }
        };
      }

      // Find existing invitation
      const existingInvitation = Array.from(this.invitations.values())
        .find(inv => inv.sessionId === session.id);

      let invitationUrl: string;
      if (existingInvitation) {
        invitationUrl = existingInvitation.invitationUrl;
      } else {
        // Create new invitation token for reminder
        const token = this.generateInvitationToken();
        invitationUrl = this.buildInvitationUrl(session.id, token);
      }

      // Prepare reminder template data
      const templateData = this.prepareReminderTemplateData(session, invitationUrl, reminderType);

      // Generate reminder email content
      const emailContent = this.generateReminderContent(templateData, reminderType);

      // Send reminder email
      const emailSent = await this.sendEmail(
        session.patient.email,
        emailContent.subject,
        emailContent.htmlBody,
        emailContent.textBody
      );

      if (!emailSent) {
        return {
          success: false,
          error: {
            code: 'REMINDER_SEND_FAILED',
            message: 'Failed to send reminder email'
          }
        };
      }

      console.log(`[Email Service] ${reminderType} reminder sent for session ${session.id}`);

      return {
        success: true,
        data: true
      };

    } catch (error) {
      console.error('[Email Service] Send reminder error:', error);
      return {
        success: false,
        error: {
          code: 'REMINDER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }

  /**
   * Track invitation email opening
   */
  async trackEmailOpen(invitationId: string): Promise<TelehealthApiResponse<boolean>> {
    try {
      const invitation = this.invitations.get(invitationId);
      if (!invitation) {
        return {
          success: false,
          error: {
            code: 'INVITATION_NOT_FOUND',
            message: 'Invitation not found'
          }
        };
      }

      // Update invitation status
      if (invitation.status === 'sent') {
        invitation.status = 'opened';
        invitation.openedAt = new Date();
        this.invitations.set(invitationId, invitation);
      }

      return {
        success: true,
        data: true
      };

    } catch (error) {
      console.error('[Email Service] Track open error:', error);
      return {
        success: false,
        error: {
          code: 'TRACKING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }

  /**
   * Track invitation link click
   */
  async trackInvitationClick(invitationId: string): Promise<TelehealthApiResponse<boolean>> {
    try {
      const invitation = this.invitations.get(invitationId);
      if (!invitation) {
        return {
          success: false,
          error: {
            code: 'INVITATION_NOT_FOUND',
            message: 'Invitation not found'
          }
        };
      }

      // Update invitation status
      invitation.status = 'clicked';
      invitation.clickedAt = new Date();
      this.invitations.set(invitationId, invitation);

      return {
        success: true,
        data: true
      };

    } catch (error) {
      console.error('[Email Service] Track click error:', error);
      return {
        success: false,
        error: {
          code: 'TRACKING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }

  /**
   * Validate invitation token
   */
  async validateInvitationToken(sessionId: string, token: string): Promise<TelehealthApiResponse<SessionInvitation>> {
    try {
      const invitation = Array.from(this.invitations.values())
        .find(inv => inv.sessionId === sessionId && inv.invitationToken === token);

      if (!invitation) {
        return {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid invitation token'
          }
        };
      }

      // Check if expired
      if (invitation.expiresAt < new Date()) {
        return {
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Invitation token has expired'
          }
        };
      }

      return {
        success: true,
        data: invitation
      };

    } catch (error) {
      console.error('[Email Service] Validate token error:', error);
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Generate secure invitation token
   */
  private generateInvitationToken(): string {
    return uuidv4().replace(/-/g, '');
  }

  /**
   * Build invitation URL with token
   */
  private buildInvitationUrl(sessionId: string, token: string): string {
    return `/telehealth/invitation/${sessionId}?token=${token}`;
  }

  /**
   * Prepare template data for invitation email
   */
  private prepareTemplateData(
    session: TelehealthSession,
    invitationUrl: string,
    customMessage?: string
  ): EmailTemplateData {
    return {
      patientName: session.patient.name,
      providerName: session.provider.name,
      appointmentDateTime: this.formatDateTime(session.scheduledDateTime),
      joinUrl: invitationUrl,
      instructions: this.getSessionInstructions(session),
      customMessage,
      supportInfo: this.config.defaultSupportInfo
    };
  }

  /**
   * Prepare template data for reminder email
   */
  private prepareReminderTemplateData(
    session: TelehealthSession,
    invitationUrl: string,
    reminderType: '24h' | '1h' | '15m'
  ): EmailTemplateData & { reminderType: string } {
    const baseData = this.prepareTemplateData(session, invitationUrl);
    return {
      ...baseData,
      reminderType: this.getReminderTypeText(reminderType)
    };
  }

  /**
   * Generate email content from template
   */
  private generateEmailContent(templateData: EmailTemplateData): SessionInvitation['emailContent'] {
    const subject = `Telehealth Appointment with ${templateData.providerName} - ${templateData.appointmentDateTime}`;
    
    const htmlBody = this.generateHTMLEmailBody(templateData);
    const textBody = this.generateTextEmailBody(templateData);

    return {
      subject,
      htmlBody,
      textBody
    };
  }

  /**
   * Generate reminder email content
   */
  private generateReminderContent(
    templateData: EmailTemplateData & { reminderType: string },
    reminderType: '24h' | '1h' | '15m'
  ): SessionInvitation['emailContent'] {
    const subject = `Reminder: ${templateData.reminderType} - Telehealth Appointment with ${templateData.providerName}`;
    
    const htmlBody = this.generateReminderHTMLBody(templateData);
    const textBody = this.generateReminderTextBody(templateData);

    return {
      subject,
      htmlBody,
      textBody
    };
  }

  /**
   * Generate HTML email body
   */
  private generateHTMLEmailBody(templateData: EmailTemplateData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Telehealth Appointment Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          .footer { background: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 WebQX Telehealth</h1>
            <p>Your Virtual Healthcare Appointment</p>
          </div>
          
          <div class="content">
            <h2>Hello ${templateData.patientName},</h2>
            
            <p>You have a telehealth appointment scheduled with <strong>${templateData.providerName}</strong>.</p>
            
            <div style="background: white; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
              <h3>📅 Appointment Details</h3>
              <p><strong>Date & Time:</strong> ${templateData.appointmentDateTime}</p>
              <p><strong>Provider:</strong> ${templateData.providerName}</p>
              <p><strong>Type:</strong> Telehealth Video Consultation</p>
            </div>
            
            ${templateData.customMessage ? `
              <div style="background: #e7f3ff; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h4>💬 Message from Your Provider:</h4>
                <p>${templateData.customMessage}</p>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${templateData.joinUrl}" class="button">🎥 Join Telehealth Session</a>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <h4>📋 Before Your Appointment:</h4>
              <ul>
                <li>Test your camera and microphone</li>
                <li>Ensure stable internet connection</li>
                <li>Find a quiet, private space</li>
                <li>Have your insurance card and ID ready</li>
                <li>Prepare any questions you may have</li>
              </ul>
            </div>
            
            ${templateData.instructions ? `
              <div style="background: white; padding: 15px; border-radius: 4px;">
                <h4>📝 Additional Instructions:</h4>
                <p>${templateData.instructions}</p>
              </div>
            ` : ''}
          </div>
          
          <div class="footer">
            <p><strong>Need Help?</strong></p>
            <p>📞 ${templateData.supportInfo.phone} | ✉️ ${templateData.supportInfo.email}</p>
            <p><a href="${templateData.supportInfo.helpUrl}" style="color: #ccc;">Visit Help Center</a></p>
            <p>&copy; 2024 WebQX Healthcare Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text email body
   */
  private generateTextEmailBody(templateData: EmailTemplateData): string {
    return `
WebQX Telehealth - Your Virtual Healthcare Appointment

Hello ${templateData.patientName},

You have a telehealth appointment scheduled with ${templateData.providerName}.

APPOINTMENT DETAILS:
Date & Time: ${templateData.appointmentDateTime}
Provider: ${templateData.providerName}
Type: Telehealth Video Consultation

${templateData.customMessage ? `
MESSAGE FROM YOUR PROVIDER:
${templateData.customMessage}
` : ''}

JOIN YOUR SESSION:
${templateData.joinUrl}

BEFORE YOUR APPOINTMENT:
- Test your camera and microphone
- Ensure stable internet connection
- Find a quiet, private space
- Have your insurance card and ID ready
- Prepare any questions you may have

${templateData.instructions ? `
ADDITIONAL INSTRUCTIONS:
${templateData.instructions}
` : ''}

NEED HELP?
Phone: ${templateData.supportInfo.phone}
Email: ${templateData.supportInfo.email}
Help Center: ${templateData.supportInfo.helpUrl}

© 2024 WebQX Healthcare Platform
    `.trim();
  }

  /**
   * Generate reminder HTML body
   */
  private generateReminderHTMLBody(templateData: EmailTemplateData & { reminderType: string }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Telehealth Appointment Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ffc107; color: #333; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          .footer { background: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Appointment Reminder</h1>
            <p><strong>${templateData.reminderType}</strong></p>
          </div>
          
          <div class="content">
            <h2>Hello ${templateData.patientName},</h2>
            
            <p>This is a friendly reminder about your upcoming telehealth appointment with <strong>${templateData.providerName}</strong>.</p>
            
            <div style="background: white; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <h3>📅 Appointment Details</h3>
              <p><strong>Date & Time:</strong> ${templateData.appointmentDateTime}</p>
              <p><strong>Provider:</strong> ${templateData.providerName}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${templateData.joinUrl}" class="button">🎥 Join Telehealth Session</a>
            </div>
            
            <div style="background: #d1ecf1; padding: 15px; border-radius: 4px;">
              <h4>✅ Quick Checklist:</h4>
              <ul>
                <li>Camera and microphone working</li>
                <li>Stable internet connection</li>
                <li>Quiet, private space ready</li>
                <li>Insurance card and ID available</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Need Help?</strong></p>
            <p>📞 ${templateData.supportInfo.phone} | ✉️ ${templateData.supportInfo.email}</p>
            <p>&copy; 2024 WebQX Healthcare Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate reminder plain text body
   */
  private generateReminderTextBody(templateData: EmailTemplateData & { reminderType: string }): string {
    return `
APPOINTMENT REMINDER - ${templateData.reminderType}

Hello ${templateData.patientName},

This is a friendly reminder about your upcoming telehealth appointment with ${templateData.providerName}.

APPOINTMENT DETAILS:
Date & Time: ${templateData.appointmentDateTime}
Provider: ${templateData.providerName}

JOIN YOUR SESSION:
${templateData.joinUrl}

QUICK CHECKLIST:
- Camera and microphone working
- Stable internet connection
- Quiet, private space ready
- Insurance card and ID available

NEED HELP?
Phone: ${templateData.supportInfo.phone}
Email: ${templateData.supportInfo.email}
Help Center: ${templateData.supportInfo.helpUrl}

© 2024 WebQX Healthcare Platform
    `.trim();
  }

  /**
   * Send email using configured SMTP
   */
  private async sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): Promise<boolean> {
    try {
      // In a real implementation, this would use an SMTP library like nodemailer
      console.log(`[Email Service] Sending email to ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`HTML Body length: ${htmlBody.length}`);
      console.log(`Text Body length: ${textBody.length}`);
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true; // Simulate successful send
    } catch (error) {
      console.error('[Email Service] SMTP send error:', error);
      return false;
    }
  }

  /**
   * Format date time for display
   */
  private formatDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Get session instructions
   */
  private getSessionInstructions(session: TelehealthSession): string {
    const instructions = [
      'You can join your session up to 15 minutes before the scheduled time.',
      'The session will remain available for 30 minutes after the scheduled start time.',
    ];

    if (session.settings.requiresPassword) {
      instructions.push('A password may be required to join the session.');
    }

    if (session.settings.waitingRoomEnabled) {
      instructions.push('You may be placed in a waiting room until your provider is ready.');
    }

    return instructions.join(' ');
  }

  /**
   * Get reminder type text
   */
  private getReminderTypeText(reminderType: '24h' | '1h' | '15m'): string {
    switch (reminderType) {
      case '24h':
        return 'Your appointment is tomorrow';
      case '1h':
        return 'Your appointment is in 1 hour';
      case '15m':
        return 'Your appointment is in 15 minutes';
      default:
        return 'Upcoming appointment reminder';
    }
  }
}