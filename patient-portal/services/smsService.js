/**
 * SMS Notification Service for Patient Portal
 * Handles appointment confirmations and secure message alerts
 */

const { sendSMS } = require('../auth/mfaService');

// SMS templates for different notification types
const SMS_TEMPLATES = {
    appointment_confirmation: {
        template: 'WebQX Health: Your appointment with Dr. {doctorName} is confirmed for {date} at {time}. Location: {location}. Reply CANCEL to cancel.',
        maxLength: 160
    },
    appointment_reminder: {
        template: 'WebQX Health: Reminder - Your appointment with Dr. {doctorName} is tomorrow at {time}. Location: {location}. Reply CONF to confirm.',
        maxLength: 160
    },
    appointment_cancellation: {
        template: 'WebQX Health: Your appointment with Dr. {doctorName} on {date} at {time} has been cancelled. Please call {phone} to reschedule.',
        maxLength: 160
    },
    secure_message_alert: {
        template: 'WebQX Health: You have a new secure message from {senderName}. Login to your patient portal to view: {portalUrl}',
        maxLength: 160
    },
    lab_results_ready: {
        template: 'WebQX Health: Your lab results are ready. Login to your patient portal to view: {portalUrl}. Contact {phone} with questions.',
        maxLength: 160
    },
    prescription_ready: {
        template: 'WebQX Health: Your prescription is ready for pickup at {pharmacyName}. Address: {pharmacyAddress}. Hours: {hours}.',
        maxLength: 160
    },
    test_results_critical: {
        template: 'WebQX Health: URGENT - Critical test results require immediate attention. Please contact Dr. {doctorName} at {phone} immediately.',
        maxLength: 160
    },
    account_security: {
        template: 'WebQX Health: Security alert - Login detected from new device. If this was not you, contact support at {supportPhone}.',
        maxLength: 160
    }
};

// Message priority levels
const PRIORITY_LEVELS = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    URGENT: 'urgent'
};

// Delivery tracking (in production, use database)
const messageTracking = new Map();

/**
 * Format phone number to E.164 format
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phoneNumber) => {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (assume US +1 for demo)
    if (digits.length === 10) {
        return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
    }
    
    // Return as-is if already formatted or international
    return phoneNumber.startsWith('+') ? phoneNumber : `+${digits}`;
};

/**
 * Replace template variables with actual values
 * @param {string} template - SMS template
 * @param {Object} variables - Variables to replace
 * @returns {string} Formatted message
 */
const formatMessage = (template, variables) => {
    let message = template;
    
    // Replace all variables in the format {variableName}
    for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        message = message.replace(new RegExp(placeholder, 'g'), value || '');
    }
    
    // Clean up any remaining placeholders
    message = message.replace(/\{[^}]*\}/g, '');
    
    return message.trim();
};

/**
 * Send appointment confirmation SMS
 * @param {Object} appointmentData - Appointment details
 * @returns {Promise<Object>} Send result
 */
const sendAppointmentConfirmation = async (appointmentData) => {
    const {
        patientPhone,
        doctorName,
        appointmentDate,
        appointmentTime,
        location,
        appointmentId
    } = appointmentData;

    try {
        const template = SMS_TEMPLATES.appointment_confirmation.template;
        const message = formatMessage(template, {
            doctorName,
            date: appointmentDate,
            time: appointmentTime,
            location
        });

        const formattedPhone = formatPhoneNumber(patientPhone);
        const result = await sendSMS(formattedPhone, message);
        
        // Track message
        const trackingId = `apt_conf_${appointmentId}_${Date.now()}`;
        messageTracking.set(trackingId, {
            type: 'appointment_confirmation',
            appointmentId,
            phoneNumber: formattedPhone,
            message,
            sentAt: new Date(),
            status: result.success ? 'sent' : 'failed',
            priority: PRIORITY_LEVELS.NORMAL,
            result
        });

        return {
            success: result.success,
            trackingId,
            message: result.success ? 'Appointment confirmation sent' : 'Failed to send confirmation',
            error: result.error
        };
    } catch (error) {
        console.error('Appointment confirmation SMS error:', error);
        return {
            success: false,
            error: 'Failed to send appointment confirmation',
            code: 'SMS_SEND_FAILED'
        };
    }
};

/**
 * Send appointment reminder SMS
 * @param {Object} appointmentData - Appointment details
 * @returns {Promise<Object>} Send result
 */
const sendAppointmentReminder = async (appointmentData) => {
    const {
        patientPhone,
        doctorName,
        appointmentTime,
        location,
        appointmentId
    } = appointmentData;

    try {
        const template = SMS_TEMPLATES.appointment_reminder.template;
        const message = formatMessage(template, {
            doctorName,
            time: appointmentTime,
            location
        });

        const formattedPhone = formatPhoneNumber(patientPhone);
        const result = await sendSMS(formattedPhone, message);
        
        // Track message
        const trackingId = `apt_rem_${appointmentId}_${Date.now()}`;
        messageTracking.set(trackingId, {
            type: 'appointment_reminder',
            appointmentId,
            phoneNumber: formattedPhone,
            message,
            sentAt: new Date(),
            status: result.success ? 'sent' : 'failed',
            priority: PRIORITY_LEVELS.NORMAL,
            result
        });

        return {
            success: result.success,
            trackingId,
            message: result.success ? 'Appointment reminder sent' : 'Failed to send reminder',
            error: result.error
        };
    } catch (error) {
        console.error('Appointment reminder SMS error:', error);
        return {
            success: false,
            error: 'Failed to send appointment reminder',
            code: 'SMS_SEND_FAILED'
        };
    }
};

/**
 * Send secure message alert SMS
 * @param {Object} messageData - Message details
 * @returns {Promise<Object>} Send result
 */
const sendSecureMessageAlert = async (messageData) => {
    const {
        patientPhone,
        senderName,
        portalUrl,
        messageId
    } = messageData;

    try {
        const template = SMS_TEMPLATES.secure_message_alert.template;
        const message = formatMessage(template, {
            senderName,
            portalUrl
        });

        const formattedPhone = formatPhoneNumber(patientPhone);
        const result = await sendSMS(formattedPhone, message);
        
        // Track message
        const trackingId = `msg_alert_${messageId}_${Date.now()}`;
        messageTracking.set(trackingId, {
            type: 'secure_message_alert',
            messageId,
            phoneNumber: formattedPhone,
            message,
            sentAt: new Date(),
            status: result.success ? 'sent' : 'failed',
            priority: PRIORITY_LEVELS.HIGH,
            result
        });

        return {
            success: result.success,
            trackingId,
            message: result.success ? 'Message alert sent' : 'Failed to send alert',
            error: result.error
        };
    } catch (error) {
        console.error('Secure message alert SMS error:', error);
        return {
            success: false,
            error: 'Failed to send message alert',
            code: 'SMS_SEND_FAILED'
        };
    }
};

/**
 * Send lab results ready notification
 * @param {Object} labData - Lab results details
 * @returns {Promise<Object>} Send result
 */
const sendLabResultsReady = async (labData) => {
    const {
        patientPhone,
        portalUrl,
        supportPhone,
        labId
    } = labData;

    try {
        const template = SMS_TEMPLATES.lab_results_ready.template;
        const message = formatMessage(template, {
            portalUrl,
            phone: supportPhone
        });

        const formattedPhone = formatPhoneNumber(patientPhone);
        const result = await sendSMS(formattedPhone, message);
        
        // Track message
        const trackingId = `lab_ready_${labId}_${Date.now()}`;
        messageTracking.set(trackingId, {
            type: 'lab_results_ready',
            labId,
            phoneNumber: formattedPhone,
            message,
            sentAt: new Date(),
            status: result.success ? 'sent' : 'failed',
            priority: PRIORITY_LEVELS.HIGH,
            result
        });

        return {
            success: result.success,
            trackingId,
            message: result.success ? 'Lab results notification sent' : 'Failed to send notification',
            error: result.error
        };
    } catch (error) {
        console.error('Lab results notification SMS error:', error);
        return {
            success: false,
            error: 'Failed to send lab results notification',
            code: 'SMS_SEND_FAILED'
        };
    }
};

/**
 * Send critical test results alert
 * @param {Object} alertData - Critical alert details
 * @returns {Promise<Object>} Send result
 */
const sendCriticalAlert = async (alertData) => {
    const {
        patientPhone,
        doctorName,
        doctorPhone,
        testId
    } = alertData;

    try {
        const template = SMS_TEMPLATES.test_results_critical.template;
        const message = formatMessage(template, {
            doctorName,
            phone: doctorPhone
        });

        const formattedPhone = formatPhoneNumber(patientPhone);
        const result = await sendSMS(formattedPhone, message);
        
        // Track message
        const trackingId = `critical_${testId}_${Date.now()}`;
        messageTracking.set(trackingId, {
            type: 'test_results_critical',
            testId,
            phoneNumber: formattedPhone,
            message,
            sentAt: new Date(),
            status: result.success ? 'sent' : 'failed',
            priority: PRIORITY_LEVELS.URGENT,
            result
        });

        return {
            success: result.success,
            trackingId,
            message: result.success ? 'Critical alert sent' : 'Failed to send critical alert',
            error: result.error
        };
    } catch (error) {
        console.error('Critical alert SMS error:', error);
        return {
            success: false,
            error: 'Failed to send critical alert',
            code: 'SMS_SEND_FAILED'
        };
    }
};

/**
 * Send security alert SMS
 * @param {Object} securityData - Security alert details
 * @returns {Promise<Object>} Send result
 */
const sendSecurityAlert = async (securityData) => {
    const {
        patientPhone,
        supportPhone,
        alertId
    } = securityData;

    try {
        const template = SMS_TEMPLATES.account_security.template;
        const message = formatMessage(template, {
            supportPhone
        });

        const formattedPhone = formatPhoneNumber(patientPhone);
        const result = await sendSMS(formattedPhone, message);
        
        // Track message
        const trackingId = `security_${alertId}_${Date.now()}`;
        messageTracking.set(trackingId, {
            type: 'account_security',
            alertId,
            phoneNumber: formattedPhone,
            message,
            sentAt: new Date(),
            status: result.success ? 'sent' : 'failed',
            priority: PRIORITY_LEVELS.URGENT,
            result
        });

        return {
            success: result.success,
            trackingId,
            message: result.success ? 'Security alert sent' : 'Failed to send security alert',
            error: result.error
        };
    } catch (error) {
        console.error('Security alert SMS error:', error);
        return {
            success: false,
            error: 'Failed to send security alert',
            code: 'SMS_SEND_FAILED'
        };
    }
};

/**
 * Get message delivery status
 * @param {string} trackingId - Message tracking ID
 * @returns {Object} Delivery status
 */
const getMessageStatus = (trackingId) => {
    const message = messageTracking.get(trackingId);
    
    if (!message) {
        return {
            found: false,
            error: 'Message not found'
        };
    }
    
    return {
        found: true,
        type: message.type,
        sentAt: message.sentAt,
        status: message.status,
        priority: message.priority,
        phoneNumber: message.phoneNumber.replace(/(\+\d{1,3})\d+(\d{4})/, '$1****$2') // Mask phone
    };
};

/**
 * Get message statistics
 * @param {Object} filters - Optional filters
 * @returns {Object} Message statistics
 */
const getMessageStats = (filters = {}) => {
    const messages = Array.from(messageTracking.values());
    
    let filteredMessages = messages;
    
    // Apply filters
    if (filters.type) {
        filteredMessages = filteredMessages.filter(msg => msg.type === filters.type);
    }
    
    if (filters.since) {
        const since = new Date(filters.since);
        filteredMessages = filteredMessages.filter(msg => msg.sentAt >= since);
    }
    
    // Calculate statistics
    const stats = {
        total: filteredMessages.length,
        sent: filteredMessages.filter(msg => msg.status === 'sent').length,
        failed: filteredMessages.filter(msg => msg.status === 'failed').length,
        byType: {},
        byPriority: {}
    };
    
    // Group by type
    for (const message of filteredMessages) {
        stats.byType[message.type] = (stats.byType[message.type] || 0) + 1;
        stats.byPriority[message.priority] = (stats.byPriority[message.priority] || 0) + 1;
    }
    
    stats.successRate = stats.total > 0 ? (stats.sent / stats.total * 100).toFixed(2) : 0;
    
    return stats;
};

module.exports = {
    sendAppointmentConfirmation,
    sendAppointmentReminder,
    sendSecureMessageAlert,
    sendLabResultsReady,
    sendCriticalAlert,
    sendSecurityAlert,
    getMessageStatus,
    getMessageStats,
    formatPhoneNumber,
    PRIORITY_LEVELS,
    SMS_TEMPLATES
};