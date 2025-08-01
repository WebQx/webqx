-- WebQX Patient Portal - User Database Schema Migration
-- This script creates the User table with all required fields for patient authentication

-- Create database if it doesn't exist (adjust for your database system)
-- CREATE DATABASE IF NOT EXISTS webqx_patient_portal;
-- USE webqx_patient_portal;

-- Create Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    account_status ENUM('active', 'locked', 'suspended', 'pending') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    failed_login_attempts INT DEFAULT 0,
    password_reset_token VARCHAR(255) NULL,
    password_reset_expires TIMESTAMP NULL,
    
    -- Indexes for performance
    INDEX idx_email (email),
    INDEX idx_account_status (account_status),
    INDEX idx_created_at (created_at)
);

-- Insert test users with hashed passwords (using bcrypt with 10 rounds)
-- Note: In production, these would be inserted through the application API
INSERT INTO users (id, name, email, password, account_status) VALUES
('1f9f673c-503b-4ae3-887a-9fb5173220cf', 'John Doe', 'john.doe@example.com', '$2b$10$K.KHWJhXTGz5TQxUzYpvYe6XhLOVRhzl4ZK1XF.1Z5K1K.K1K.K1K', 'active'),
('2a8e573d-504c-5bf4-998b-8fc6284331d0', 'Jane Smith', 'jane.smith@example.com', '$2b$10$K.KHWJhXTGz5TQxUzYpvYe6XhLOVRhzl4ZK1XF.1Z5K1K.K1K.K1K', 'active'),
('3b9f684e-615d-6cf5-aa9c-9fd7395442e1', 'Locked User', 'locked@example.com', '$2b$10$K.KHWJhXTGz5TQxUzYpvYe6XhLOVRhzl4ZK1XF.1Z5K1K.K1K.K1K', 'locked')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    account_status = VALUES(account_status);

-- Create audit table for login attempts (security feature)
CREATE TABLE IF NOT EXISTS login_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36),
    email VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_email (email),
    INDEX idx_success (success),
    INDEX idx_created_at (created_at),
    
    -- Foreign key constraint
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create user sessions table (for JWT token blacklisting if needed)
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires_at (expires_at),
    
    -- Foreign key constraint
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create user profiles table (extended patient information)
CREATE TABLE IF NOT EXISTS user_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
    phone VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert sample user profiles
INSERT INTO user_profiles (user_id, date_of_birth, gender, phone, preferred_language) VALUES
('1f9f673c-503b-4ae3-887a-9fb5173220cf', '1985-06-15', 'male', '+1-555-0123', 'en'),
('2a8e573d-504c-5bf4-998b-8fc6284331d0', '1990-03-22', 'female', '+1-555-0124', 'en')
ON DUPLICATE KEY UPDATE
    date_of_birth = VALUES(date_of_birth),
    gender = VALUES(gender),
    phone = VALUES(phone);

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_token (token),
    INDEX idx_expires_at (expires_at),
    
    -- Foreign key constraint
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create stored procedure for user authentication
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS authenticate_user(
    IN p_email VARCHAR(255),
    IN p_ip_address VARCHAR(45),
    IN p_user_agent TEXT,
    IN p_success BOOLEAN,
    OUT p_user_id VARCHAR(36),
    OUT p_account_status VARCHAR(20)
)
BEGIN
    DECLARE v_user_id VARCHAR(36);
    DECLARE v_account_status VARCHAR(20);
    
    -- Get user information
    SELECT id, account_status INTO v_user_id, v_account_status
    FROM users 
    WHERE email = p_email;
    
    -- Update last login if successful
    IF p_success = TRUE AND v_user_id IS NOT NULL THEN
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0
        WHERE id = v_user_id;
    ELSEIF p_success = FALSE AND v_user_id IS NOT NULL THEN
        UPDATE users 
        SET failed_login_attempts = failed_login_attempts + 1
        WHERE id = v_user_id;
    END IF;
    
    -- Log the authentication attempt
    INSERT INTO login_audit (user_id, email, success, ip_address, user_agent)
    VALUES (v_user_id, p_email, p_success, p_ip_address, p_user_agent);
    
    -- Return user information
    SET p_user_id = v_user_id;
    SET p_account_status = v_account_status;
END //
DELIMITER ;

-- Create view for user dashboard data
CREATE VIEW IF NOT EXISTS user_dashboard_view AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.account_status,
    u.last_login,
    u.created_at as member_since,
    up.date_of_birth,
    up.gender,
    up.phone,
    up.preferred_language,
    up.timezone
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.account_status = 'active';

-- Add comments for documentation
ALTER TABLE users COMMENT = 'Main user accounts table for WebQX Patient Portal authentication';
ALTER TABLE login_audit COMMENT = 'Audit log for all login attempts (successful and failed)';
ALTER TABLE user_sessions COMMENT = 'Active user sessions for JWT token management';
ALTER TABLE user_profiles COMMENT = 'Extended patient profile information';
ALTER TABLE password_reset_tokens COMMENT = 'Password reset tokens for forgot password functionality';

-- Grant permissions (adjust for your environment)
-- GRANT SELECT, INSERT, UPDATE ON webqx_patient_portal.* TO 'app_user'@'localhost';
-- GRANT EXECUTE ON PROCEDURE webqx_patient_portal.authenticate_user TO 'app_user'@'localhost';

-- Display migration completion message
SELECT 'WebQX Patient Portal database schema migration completed successfully!' as status;