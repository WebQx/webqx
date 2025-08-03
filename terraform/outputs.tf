# Outputs for WebQX Healthcare Platform Terraform Configuration

# Networking Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "VPC CIDR block"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "Database subnet IDs"
  value       = aws_subnet.database[*].id
}

output "internet_gateway_id" {
  description = "Internet Gateway ID"
  value       = aws_internet_gateway.main.id
}

output "nat_gateway_ids" {
  description = "NAT Gateway IDs"
  value       = aws_nat_gateway.main[*].id
}

# Security Outputs
output "lambda_security_group_id" {
  description = "Lambda security group ID"
  value       = aws_security_group.lambda.id
}

output "rds_security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = aws_security_group.alb.id
}

# Encryption Outputs
output "kms_key_id" {
  description = "KMS key ID for healthcare data encryption"
  value       = aws_kms_key.healthcare.key_id
}

output "kms_key_arn" {
  description = "KMS key ARN for healthcare data encryption"
  value       = aws_kms_key.healthcare.arn
  sensitive   = true
}

output "kms_key_alias" {
  description = "KMS key alias"
  value       = aws_kms_alias.healthcare.name
}

# Storage Outputs
output "healthcare_data_bucket_name" {
  description = "S3 bucket name for healthcare data"
  value       = aws_s3_bucket.healthcare_data.bucket
}

output "healthcare_data_bucket_arn" {
  description = "S3 bucket ARN for healthcare data"
  value       = aws_s3_bucket.healthcare_data.arn
}

output "audit_logs_bucket_name" {
  description = "S3 bucket name for audit logs"
  value       = aws_s3_bucket.audit_logs.bucket
}

output "audit_logs_bucket_arn" {
  description = "S3 bucket ARN for audit logs"
  value       = aws_s3_bucket.audit_logs.arn
}

# Database Outputs
output "patients_table_name" {
  description = "DynamoDB patients table name"
  value       = aws_dynamodb_table.patients.name
}

output "patients_table_arn" {
  description = "DynamoDB patients table ARN"
  value       = aws_dynamodb_table.patients.arn
}

output "patients_table_stream_arn" {
  description = "DynamoDB patients table stream ARN"
  value       = aws_dynamodb_table.patients.stream_arn
}

output "appointments_table_name" {
  description = "DynamoDB appointments table name"
  value       = aws_dynamodb_table.appointments.name
}

output "appointments_table_arn" {
  description = "DynamoDB appointments table ARN"
  value       = aws_dynamodb_table.appointments.arn
}

output "appointments_table_stream_arn" {
  description = "DynamoDB appointments table stream ARN"
  value       = aws_dynamodb_table.appointments.stream_arn
}

output "observations_table_name" {
  description = "DynamoDB observations table name"
  value       = aws_dynamodb_table.observations.name
}

output "observations_table_arn" {
  description = "DynamoDB observations table ARN"
  value       = aws_dynamodb_table.observations.arn
}

output "observations_table_stream_arn" {
  description = "DynamoDB observations table stream ARN"
  value       = aws_dynamodb_table.observations.stream_arn
}

output "audit_logs_table_name" {
  description = "DynamoDB audit logs table name"
  value       = aws_dynamodb_table.audit_logs.name
}

output "audit_logs_table_arn" {
  description = "DynamoDB audit logs table ARN"
  value       = aws_dynamodb_table.audit_logs.arn
}

output "audit_logs_table_stream_arn" {
  description = "DynamoDB audit logs table stream ARN"
  value       = aws_dynamodb_table.audit_logs.stream_arn
}

# RDS Outputs (conditional)
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = var.enable_rds ? aws_db_instance.postgresql[0].endpoint : null
}

output "rds_port" {
  description = "RDS instance port"
  value       = var.enable_rds ? aws_db_instance.postgresql[0].port : null
}

output "rds_database_name" {
  description = "RDS database name"
  value       = var.enable_rds ? aws_db_instance.postgresql[0].db_name : null
}

output "rds_username" {
  description = "RDS master username"
  value       = var.enable_rds ? aws_db_instance.postgresql[0].username : null
  sensitive   = true
}

output "db_subnet_group_name" {
  description = "Database subnet group name"
  value       = aws_db_subnet_group.main.name
}

# Secrets Manager Outputs (conditional)
output "db_credentials_secret_arn" {
  description = "Database credentials secret ARN"
  value       = var.enable_rds ? aws_secretsmanager_secret.db_credentials[0].arn : null
  sensitive   = true
}

# CloudWatch Outputs
output "lambda_log_group_name" {
  description = "Lambda CloudWatch log group name"
  value       = aws_cloudwatch_log_group.lambda.name
}

output "api_gateway_log_group_name" {
  description = "API Gateway CloudWatch log group name"
  value       = aws_cloudwatch_log_group.api_gateway.name
}

# CloudTrail Outputs
output "cloudtrail_name" {
  description = "CloudTrail name"
  value       = aws_cloudtrail.main.name
}

output "cloudtrail_arn" {
  description = "CloudTrail ARN"
  value       = aws_cloudtrail.main.arn
}

# WAF Outputs
output "waf_web_acl_id" {
  description = "WAF Web ACL ID"
  value       = aws_wafv2_web_acl.api_protection.id
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = aws_wafv2_web_acl.api_protection.arn
}

# CloudWatch Alarms Outputs
output "lambda_errors_alarm_name" {
  description = "Lambda errors CloudWatch alarm name"
  value       = aws_cloudwatch_metric_alarm.lambda_errors.alarm_name
}

output "dynamodb_throttles_alarm_name" {
  description = "DynamoDB throttles CloudWatch alarm name"
  value       = aws_cloudwatch_metric_alarm.dynamodb_throttles.alarm_name
}

# Systems Manager Parameter Store Outputs
output "jwt_secret_parameter_name" {
  description = "JWT secret SSM parameter name"
  value       = aws_ssm_parameter.jwt_secret.name
}

output "encryption_key_parameter_name" {
  description = "Encryption key SSM parameter name"
  value       = aws_ssm_parameter.encryption_key.name
}

output "whisper_api_key_parameter_name" {
  description = "Whisper API key SSM parameter name"
  value       = aws_ssm_parameter.whisper_api_key.name
}

# Terraform Backend Outputs (conditional)
output "terraform_state_bucket_name" {
  description = "Terraform state S3 bucket name"
  value       = var.create_terraform_backend ? aws_s3_bucket.terraform_state[0].bucket : null
}

output "terraform_state_bucket_arn" {
  description = "Terraform state S3 bucket ARN"
  value       = var.create_terraform_backend ? aws_s3_bucket.terraform_state[0].arn : null
}

output "terraform_locks_table_name" {
  description = "Terraform state locks DynamoDB table name"
  value       = var.create_terraform_backend ? aws_dynamodb_table.terraform_locks[0].name : null
}

output "terraform_locks_table_arn" {
  description = "Terraform state locks DynamoDB table ARN"
  value       = var.create_terraform_backend ? aws_dynamodb_table.terraform_locks[0].arn : null
}

# Environment and Region Information
output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "account_id" {
  description = "AWS account ID"
  value       = local.account_id
}

# Useful for Lambda Environment Variables
output "environment_variables" {
  description = "Environment variables for Lambda functions"
  value = {
    AWS_REGION                    = var.aws_region
    ENVIRONMENT                   = var.environment
    KMS_KEY_ID                   = aws_kms_key.healthcare.key_id
    HEALTHCARE_DATA_BUCKET       = aws_s3_bucket.healthcare_data.bucket
    AUDIT_LOGS_BUCKET           = aws_s3_bucket.audit_logs.bucket
    PATIENTS_TABLE              = aws_dynamodb_table.patients.name
    APPOINTMENTS_TABLE          = aws_dynamodb_table.appointments.name
    OBSERVATIONS_TABLE          = aws_dynamodb_table.observations.name
    AUDIT_LOGS_TABLE           = aws_dynamodb_table.audit_logs.name
    JWT_SECRET_PARAMETER        = aws_ssm_parameter.jwt_secret.name
    ENCRYPTION_KEY_PARAMETER    = aws_ssm_parameter.encryption_key.name
    WHISPER_API_KEY_PARAMETER   = aws_ssm_parameter.whisper_api_key.name
    DB_SUBNET_GROUP            = aws_db_subnet_group.main.name
    LAMBDA_SECURITY_GROUP      = aws_security_group.lambda.id
    CLOUDTRAIL_NAME            = aws_cloudtrail.main.name
    WAF_WEB_ACL_ARN           = aws_wafv2_web_acl.api_protection.arn
  }
  sensitive = true
}

# Infrastructure Summary
output "infrastructure_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    vpc = {
      id         = aws_vpc.main.id
      cidr_block = aws_vpc.main.cidr_block
    }
    subnets = {
      public   = length(aws_subnet.public)
      private  = length(aws_subnet.private)
      database = length(aws_subnet.database)
    }
    security_groups = {
      lambda = aws_security_group.lambda.id
      rds    = aws_security_group.rds.id
      alb    = aws_security_group.alb.id
    }
    storage = {
      healthcare_data_bucket = aws_s3_bucket.healthcare_data.bucket
      audit_logs_bucket     = aws_s3_bucket.audit_logs.bucket
    }
    encryption = {
      kms_key_id    = aws_kms_key.healthcare.key_id
      kms_key_alias = aws_kms_alias.healthcare.name
    }
    database_tables = {
      patients     = aws_dynamodb_table.patients.name
      appointments = aws_dynamodb_table.appointments.name
      observations = aws_dynamodb_table.observations.name
      audit_logs   = aws_dynamodb_table.audit_logs.name
    }
    rds_enabled = var.enable_rds
    compliance = {
      framework            = var.compliance_framework
      hipaa_compliant_mode = var.hipaa_compliant_mode
      audit_logging        = var.enable_audit_logging
      encryption_at_rest   = var.enable_encryption_at_rest
      encryption_in_transit = var.enable_encryption_in_transit
    }
  }
}

# Configuration for Other Tools
output "serverless_framework_config" {
  description = "Configuration values for Serverless Framework"
  value = {
    vpc_id               = aws_vpc.main.id
    private_subnet_ids   = aws_subnet.private[*].id
    lambda_security_group = aws_security_group.lambda.id
    kms_key_arn         = aws_kms_key.healthcare.arn
    patients_table      = aws_dynamodb_table.patients.name
    appointments_table  = aws_dynamodb_table.appointments.name
    observations_table  = aws_dynamodb_table.observations.name
    audit_logs_table   = aws_dynamodb_table.audit_logs.name
    healthcare_bucket  = aws_s3_bucket.healthcare_data.bucket
    audit_logs_bucket  = aws_s3_bucket.audit_logs.bucket
  }
}

output "sam_template_config" {
  description = "Configuration values for AWS SAM template"
  value = {
    VpcId              = aws_vpc.main.id
    PrivateSubnetIds   = join(",", aws_subnet.private[*].id)
    KMSKeyArn         = aws_kms_key.healthcare.arn
    PatientsTable     = aws_dynamodb_table.patients.name
    AppointmentsTable = aws_dynamodb_table.appointments.name
    ObservationsTable = aws_dynamodb_table.observations.name
    AuditLogsTable   = aws_dynamodb_table.audit_logs.name
    HealthcareBucket = aws_s3_bucket.healthcare_data.bucket
    AuditLogsBucket  = aws_s3_bucket.audit_logs.bucket
    LambdaSecurityGroup = aws_security_group.lambda.id
  }
}

# Resource Tags Applied
output "resource_tags" {
  description = "Common tags applied to all resources"
  value = local.common_tags
}