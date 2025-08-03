# DynamoDB Tables for WebQX Healthcare Platform

# Patients Table
resource "aws_dynamodb_table" "patients" {
  name           = "${var.name_prefix}-patients"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "patient_id"
  stream_enabled = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "patient_id"
    type = "S"
  }

  attribute {
    name = "mrn"
    type = "S"
  }

  global_secondary_index {
    name     = "MRN-Index"
    hash_key = "mrn"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-patients"
    Type = "PHI"
    DataClass = "HIPAA"
  })
}

# Appointments Table
resource "aws_dynamodb_table" "appointments" {
  name           = "${var.name_prefix}-appointments"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "appointment_id"
  range_key      = "appointment_date"
  stream_enabled = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "appointment_id"
    type = "S"
  }

  attribute {
    name = "appointment_date"
    type = "S"
  }

  attribute {
    name = "patient_id"
    type = "S"
  }

  attribute {
    name = "provider_id"
    type = "S"
  }

  global_secondary_index {
    name     = "PatientAppointments-Index"
    hash_key = "patient_id"
    range_key = "appointment_date"
  }

  global_secondary_index {
    name     = "ProviderAppointments-Index"
    hash_key = "provider_id"
    range_key = "appointment_date"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-appointments"
    Type = "Clinical"
  })
}

# Providers Table
resource "aws_dynamodb_table" "providers" {
  name           = "${var.name_prefix}-providers"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "provider_id"
  stream_enabled = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "provider_id"
    type = "S"
  }

  attribute {
    name = "specialty"
    type = "S"
  }

  attribute {
    name = "npi"
    type = "S"
  }

  global_secondary_index {
    name     = "Specialty-Index"
    hash_key = "specialty"
  }

  global_secondary_index {
    name     = "NPI-Index"
    hash_key = "npi"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-providers"
    Type = "Directory"
  })
}

# Medical Records Table (FHIR Resources)
resource "aws_dynamodb_table" "medical_records" {
  name           = "${var.name_prefix}-medical-records"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "resource_id"
  range_key      = "resource_type"
  stream_enabled = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "resource_id"
    type = "S"
  }

  attribute {
    name = "resource_type"
    type = "S"
  }

  attribute {
    name = "patient_id"
    type = "S"
  }

  attribute {
    name = "created_date"
    type = "S"
  }

  global_secondary_index {
    name     = "PatientRecords-Index"
    hash_key = "patient_id"
    range_key = "created_date"
  }

  global_secondary_index {
    name     = "ResourceType-Index"
    hash_key = "resource_type"
    range_key = "created_date"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-medical-records"
    Type = "PHI"
    DataClass = "HIPAA"
  })
}

# Lab Results Table
resource "aws_dynamodb_table" "lab_results" {
  name           = "${var.name_prefix}-lab-results"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "lab_id"
  range_key      = "test_date"
  stream_enabled = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "lab_id"
    type = "S"
  }

  attribute {
    name = "test_date"
    type = "S"
  }

  attribute {
    name = "patient_id"
    type = "S"
  }

  global_secondary_index {
    name     = "PatientLabs-Index"
    hash_key = "patient_id"
    range_key = "test_date"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-lab-results"
    Type = "PHI"
    DataClass = "HIPAA"
  })
}

# Prescriptions Table
resource "aws_dynamodb_table" "prescriptions" {
  name           = "${var.name_prefix}-prescriptions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "prescription_id"
  stream_enabled = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "prescription_id"
    type = "S"
  }

  attribute {
    name = "patient_id"
    type = "S"
  }

  attribute {
    name = "provider_id"
    type = "S"
  }

  attribute {
    name = "prescribed_date"
    type = "S"
  }

  global_secondary_index {
    name     = "PatientPrescriptions-Index"
    hash_key = "patient_id"
    range_key = "prescribed_date"
  }

  global_secondary_index {
    name     = "ProviderPrescriptions-Index"
    hash_key = "provider_id"
    range_key = "prescribed_date"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-prescriptions"
    Type = "PHI"
    DataClass = "HIPAA"
  })
}

# Audit Logs Table
resource "aws_dynamodb_table" "audit_logs" {
  name           = "${var.name_prefix}-audit-logs"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "log_id"
  range_key      = "timestamp"
  stream_enabled = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "log_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "action_type"
    type = "S"
  }

  global_secondary_index {
    name     = "UserAudit-Index"
    hash_key = "user_id"
    range_key = "timestamp"
  }

  global_secondary_index {
    name     = "ActionType-Index"
    hash_key = "action_type"
    range_key = "timestamp"
  }

  # Long retention for compliance
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-audit-logs"
    Type = "Audit"
    DataClass = "HIPAA"
  })
}

# Sessions Table
resource "aws_dynamodb_table" "sessions" {
  name           = "${var.name_prefix}-sessions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "session_id"
  stream_enabled = false

  attribute {
    name = "session_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name     = "UserSessions-Index"
    hash_key = "user_id"
  }

  # Auto-expire sessions
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-sessions"
    Type = "Auth"
  })
}

# Backup configuration for all tables
resource "aws_backup_vault" "dynamodb" {
  name        = "${var.name_prefix}-dynamodb-backup-vault"
  kms_key_arn = aws_kms_key.backup.arn

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-dynamodb-backup-vault"
  })
}

resource "aws_kms_key" "backup" {
  description             = "KMS key for DynamoDB backups"
  deletion_window_in_days = 7

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-backup-key"
  })
}

resource "aws_backup_plan" "dynamodb" {
  name = "${var.name_prefix}-dynamodb-backup-plan"

  rule {
    rule_name         = "dynamodb_backup_rule"
    target_vault_name = aws_backup_vault.dynamodb.name
    schedule          = "cron(0 5 ? * * *)"  # Daily at 5 AM UTC

    lifecycle {
      cold_storage_after = 30
      delete_after       = var.backup_retention_days
    }

    recovery_point_tags = merge(var.tags, {
      BackupType = "Scheduled"
    })
  }

  tags = var.tags
}

resource "aws_iam_role" "backup" {
  name = "${var.name_prefix}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}