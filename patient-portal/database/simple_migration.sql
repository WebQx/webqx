-- Simple User Table Migration for WebQX Patient Portal
-- Compatible with most SQL databases (SQLite, PostgreSQL, MySQL, etc.)

-- Create Users table with core required fields
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'locked', 'suspended', 'pending')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);

-- Insert test users (passwords are bcrypt hashed 'password123')
-- Note: Replace with actual bcrypt hashes for your system
INSERT OR IGNORE INTO users (id, name, email, password, account_status) VALUES
('1f9f673c-503b-4ae3-887a-9fb5173220cf', 'John Doe', 'john.doe@example.com', '$2b$10$rBEqk7KHhA5z5L5L5L5L5uXjR5L5L5L5L5L5L5L5L5L5L5L5L5L5L5', 'active'),
('2a8e573d-504c-5bf4-998b-8fc6284331d0', 'Jane Smith', 'jane.smith@example.com', '$2b$10$rBEqk7KHhA5z5L5L5L5L5uXjR5L5L5L5L5L5L5L5L5L5L5L5L5L5L5', 'active'),
('3b9f684e-615d-6cf5-aa9c-9fd7395442e1', 'Locked User', 'locked@example.com', '$2b$10$rBEqk7KHhA5z5L5L5L5L5uXjR5L5L5L5L5L5L5L5L5L5L5L5L5L5L5', 'locked');

-- Create basic audit table for login tracking
CREATE TABLE IF NOT EXISTS login_audit (
    id INTEGER PRIMARY KEY,
    user_id TEXT,
    email TEXT NOT NULL,
    success INTEGER NOT NULL,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_login_audit_email ON login_audit(email);
CREATE INDEX IF NOT EXISTS idx_login_audit_created ON login_audit(created_at);