const crypto = require('crypto');
const { getUserByEmail, getUserById } = require('./userService');

// In-memory store for OTP codes (in production, use Redis or database)
const otpStore = new Map();

// OTP configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;

/**
 * Generate a random OTP code
 * @param {number} length - Length of OTP
 * @returns {string} OTP code
 */
const generateOTP = (length = OTP_LENGTH) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
};

/**
 * Send SMS OTP (mock implementation for demo)
 * In production, integrate with services like Azure Communication Services
 * @param {string} phoneNumber - Phone number
 * @param {string} otp - OTP code
 * @returns {Promise<Object>} Send result
 */
const sendSMS = async (phoneNumber, otp) => {
    try {
        // Mock SMS sending - in production, use Azure Communication Services
        console.log(`[SMS Service] Sending OTP ${otp} to ${phoneNumber}`);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Mock success for demo purposes
        return {
            success: true,
            messageId: `mock_msg_${Date.now()}`,
            cost: 0.01 // Mock cost in USD
        };
    } catch (error) {
        console.error('SMS sending error:', error);
        return {
            success: false,
            error: 'Failed to send SMS',
            code: 'SMS_SEND_FAILED'
        };
    }
};

/**
 * Generate and send OTP for MFA
 * @param {string} identifier - User email or ID
 * @returns {Promise<Object>} Generation result
 */
const generateAndSendOTP = async (identifier) => {
    try {
        // Get user by email or ID
        let user = getUserByEmail(identifier);
        if (!user) {
            user = getUserById(identifier);
        }
        
        if (!user) {
            return {
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            };
        }

        if (!user.phoneNumber) {
            return {
                success: false,
                error: 'Phone number not configured for this user',
                code: 'NO_PHONE_NUMBER'
            };
        }

        // Generate OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        
        // Store OTP
        const otpKey = `${user.id}_mfa`;
        otpStore.set(otpKey, {
            otp,
            expiresAt,
            attempts: 0,
            maxAttempts: MAX_ATTEMPTS,
            phoneNumber: user.phoneNumber,
            userId: user.id
        });

        // Send SMS
        const smsResult = await sendSMS(user.phoneNumber, otp);
        
        if (!smsResult.success) {
            // Clean up stored OTP if SMS failed
            otpStore.delete(otpKey);
            return smsResult;
        }

        return {
            success: true,
            message: 'OTP sent successfully',
            expiresAt: expiresAt.toISOString(),
            phoneNumber: user.phoneNumber.replace(/(\+\d{1,3})\d+(\d{4})/, '$1****$2') // Mask phone number
        };

    } catch (error) {
        console.error('OTP generation error:', error);
        return {
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        };
    }
};

/**
 * Verify OTP for MFA
 * @param {string} userId - User ID
 * @param {string} otp - OTP code to verify
 * @returns {Object} Verification result
 */
const verifyOTP = (userId, otp) => {
    try {
        const otpKey = `${userId}_mfa`;
        const storedOTP = otpStore.get(otpKey);

        if (!storedOTP) {
            return {
                success: false,
                error: 'No OTP found or OTP expired',
                code: 'OTP_NOT_FOUND'
            };
        }

        // Check expiry
        if (new Date() > storedOTP.expiresAt) {
            otpStore.delete(otpKey);
            return {
                success: false,
                error: 'OTP has expired',
                code: 'OTP_EXPIRED'
            };
        }

        // Check attempts
        if (storedOTP.attempts >= storedOTP.maxAttempts) {
            otpStore.delete(otpKey);
            return {
                success: false,
                error: 'Maximum OTP attempts exceeded',
                code: 'MAX_ATTEMPTS_EXCEEDED'
            };
        }

        // Increment attempts
        storedOTP.attempts++;
        otpStore.set(otpKey, storedOTP);

        // Verify OTP
        if (storedOTP.otp !== otp) {
            return {
                success: false,
                error: 'Invalid OTP',
                code: 'INVALID_OTP',
                attemptsRemaining: storedOTP.maxAttempts - storedOTP.attempts
            };
        }

        // OTP verified successfully
        otpStore.delete(otpKey);
        return {
            success: true,
            message: 'OTP verified successfully'
        };

    } catch (error) {
        console.error('OTP verification error:', error);
        return {
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        };
    }
};

/**
 * Clean up expired OTPs (should be called periodically)
 */
const cleanupExpiredOTPs = () => {
    const now = new Date();
    for (const [key, otp] of otpStore.entries()) {
        if (now > otp.expiresAt) {
            otpStore.delete(key);
        }
    }
};

/**
 * Get OTP status for a user (for debugging/testing)
 * @param {string} userId - User ID
 * @returns {Object} OTP status
 */
const getOTPStatus = (userId) => {
    const otpKey = `${userId}_mfa`;
    const storedOTP = otpStore.get(otpKey);
    
    if (!storedOTP) {
        return { exists: false };
    }
    
    return {
        exists: true,
        expiresAt: storedOTP.expiresAt,
        attempts: storedOTP.attempts,
        maxAttempts: storedOTP.maxAttempts,
        isExpired: new Date() > storedOTP.expiresAt
    };
};

// Clean up expired OTPs every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

module.exports = {
    generateAndSendOTP,
    verifyOTP,
    cleanupExpiredOTPs,
    getOTPStatus,
    sendSMS // Export for potential external use
};