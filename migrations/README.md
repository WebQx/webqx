# Database Migrations

This directory contains SQL migration files for the WebQx Healthcare Platform database.

## Migration Naming Convention

Use the following format for migration files:
```
YYYYMMDD_HHMMSS_description.sql
```

Example: `20240115_143000_create_users_table.sql`

## Migration Order

Migrations are executed in alphabetical order based on the filename. The timestamp prefix ensures proper ordering.

## Example Migration Structure

```sql
-- Migration: Create users table
-- Date: 2024-01-15
-- Description: Initial user management table for healthcare platform

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'patient',
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- Add audit trail
CREATE TABLE IF NOT EXISTS user_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    changed_fields JSONB,
    changed_by INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
```

## HIPAA Compliance Notes

All migrations should consider HIPAA compliance requirements:

1. **Audit Logging**: Include audit trail tables for sensitive operations
2. **Data Encryption**: Use appropriate encryption for PHI fields
3. **Access Control**: Implement proper role-based access controls
4. **Data Retention**: Consider retention policies for audit logs (7+ years)

## Running Migrations

Migrations are automatically executed during deployment via the `deploy.sh` script.

To run migrations manually:
```bash
./deploy.sh migrate
```

## Rollback Considerations

- Always test migrations in a staging environment first
- Consider creating rollback scripts for complex migrations
- Use transactions (BEGIN/COMMIT) to ensure atomicity
- Backup database before running migrations in production

## Healthcare-Specific Tables

Consider these common healthcare platform tables:

- `patients` - Patient demographic information
- `providers` - Healthcare provider information
- `appointments` - Appointment scheduling
- `medical_records` - Patient medical records
- `prescriptions` - Medication prescriptions
- `insurance_info` - Insurance information
- `audit_logs` - HIPAA-compliant audit trails
- `consent_records` - Patient consent tracking