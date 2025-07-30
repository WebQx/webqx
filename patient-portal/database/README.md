# Database Schema for WebQX Patient Portal

This directory contains the database migration scripts for the WebQX Patient Portal authentication system.

## Files

- `migration.sql` - Full MySQL migration script with all tables and features
- `simple_migration.sql` - Basic user table creation for any SQL database
- `README.md` - This documentation file

## Database Schema Overview

### Core Tables

1. **users** - Main user accounts table
   - `id` (VARCHAR(36)) - Primary key, UUID
   - `name` (VARCHAR(255)) - User's full name
   - `email` (VARCHAR(255)) - Unique email address
   - `password` (VARCHAR(255)) - Hashed password (bcrypt)
   - `account_status` (ENUM) - 'active', 'locked', 'suspended', 'pending'
   - `created_at`, `updated_at` - Timestamps
   - `last_login` - Last successful login timestamp
   - `failed_login_attempts` - Counter for security

2. **user_profiles** - Extended patient information
   - Patient demographics, contact info, preferences

3. **login_audit** - Security audit trail
   - All login attempts (successful and failed)

4. **user_sessions** - JWT token management
   - Active sessions and token blacklisting

5. **password_reset_tokens** - Password recovery
   - Secure password reset functionality

## Usage

### For MySQL/MariaDB
```bash
mysql -u root -p < migration.sql
```

### For PostgreSQL (adjust syntax in migration files)
```bash
psql -U postgres -d webqx_portal < migration.sql
```

### For SQLite (use simple_migration.sql)
```bash
sqlite3 webqx_portal.db < simple_migration.sql
```

## Security Features

- Passwords are hashed using bcrypt with 10 rounds
- Account lockout after failed login attempts
- Audit logging for all authentication events
- JWT token session management
- Secure password reset tokens

## Test Data

The migration includes test users:
- john.doe@example.com / password123 (active)
- jane.smith@example.com / password123 (active)  
- locked@example.com / password123 (locked)

## Environment Variables

Set these in your application:
- `JWT_SECRET` - Secret key for JWT token signing
- `JWT_EXPIRES_IN` - Token expiration time (default: 24h)
- `DATABASE_URL` - Database connection string

## Production Considerations

1. Change default JWT_SECRET
2. Remove test users
3. Set up proper database user permissions
4. Configure backup and monitoring
5. Implement password complexity requirements
6. Set up rate limiting at database level
7. Enable SSL/TLS for database connections