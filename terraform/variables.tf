# Variables for WebQX Healthcare Platform Terraform Configuration

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
  
  validation {
    condition = contains([
      "us-east-1", "us-east-2", "us-west-1", "us-west-2",
      "eu-west-1", "eu-west-2", "eu-central-1",
      "ap-southeast-1", "ap-southeast-2", "ap-northeast-1"
    ], var.aws_region)
    error_message = "AWS region must be a valid region that supports all healthcare compliance requirements."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

# Database Configuration
variable "enable_rds" {
  description = "Enable RDS PostgreSQL instance"
  type        = bool
  default     = false
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
  
  validation {
    condition = contains([
      "db.t3.micro", "db.t3.small", "db.t3.medium", "db.t3.large",
      "db.r5.large", "db.r5.xlarge", "db.r5.2xlarge", "db.r5.4xlarge",
      "db.r6g.large", "db.r6g.xlarge", "db.r6g.2xlarge"
    ], var.rds_instance_class)
    error_message = "RDS instance class must be a valid instance type."
  }
}

variable "rds_allocated_storage" {
  description = "Initial allocated storage for RDS instance (GB)"
  type        = number
  default     = 20
  
  validation {
    condition     = var.rds_allocated_storage >= 20 && var.rds_allocated_storage <= 65536
    error_message = "RDS allocated storage must be between 20 and 65536 GB."
  }
}

variable "rds_max_allocated_storage" {
  description = "Maximum allocated storage for RDS instance (GB)"
  type        = number
  default     = 100
  
  validation {
    condition     = var.rds_max_allocated_storage >= var.rds_allocated_storage
    error_message = "RDS max allocated storage must be greater than or equal to allocated storage."
  }
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "webqx_healthcare"
  
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.database_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores."
  }
}

variable "database_username" {
  description = "Username for the database"
  type        = string
  default     = "webqx_admin"
  sensitive   = true
  
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.database_username))
    error_message = "Database username must start with a letter and contain only alphanumeric characters and underscores."
  }
}

variable "database_password" {
  description = "Password for the database"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.database_password) >= 12
    error_message = "Database password must be at least 12 characters long for HIPAA compliance."
  }
}

# Security and Encryption
variable "jwt_secret" {
  description = "JWT secret key for authentication"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.jwt_secret) >= 32
    error_message = "JWT secret must be at least 32 characters long for security."
  }
}

variable "encryption_key" {
  description = "Encryption key for HIPAA compliance"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.encryption_key) >= 32
    error_message = "Encryption key must be at least 32 characters long for HIPAA compliance."
  }
}

variable "whisper_api_key" {
  description = "OpenAI Whisper API key for transcription services"
  type        = string
  sensitive   = true
  default     = ""
}

# Domain and SSL Configuration
variable "domain_name" {
  description = "Custom domain name for the healthcare platform"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "SSL certificate ARN for custom domain"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for custom domain"
  type        = string
  default     = ""
}

# Monitoring and Alerting
variable "sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring for RDS and Lambda"
  type        = bool
  default     = true
}

variable "enable_xray_tracing" {
  description = "Enable AWS X-Ray tracing for Lambda functions"
  type        = bool
  default     = true
}

# Backup and Retention
variable "backup_retention_days" {
  description = "Number of days to retain backups (HIPAA requires 7 years = 2555 days)"
  type        = number
  default     = 2555
  
  validation {
    condition     = var.backup_retention_days >= 2555
    error_message = "Backup retention must be at least 2555 days (7 years) for HIPAA compliance."
  }
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB tables"
  type        = bool
  default     = true
}

# Terraform Backend Configuration
variable "create_terraform_backend" {
  description = "Create S3 bucket and DynamoDB table for Terraform backend"
  type        = bool
  default     = false
}

# HIPAA Compliance Settings
variable "hipaa_compliant_mode" {
  description = "Enable HIPAA compliance mode with enhanced security"
  type        = bool
  default     = true
}

variable "enable_audit_logging" {
  description = "Enable comprehensive audit logging"
  type        = bool
  default     = true
}

variable "enable_encryption_at_rest" {
  description = "Enable encryption at rest for all data stores"
  type        = bool
  default     = true
}

variable "enable_encryption_in_transit" {
  description = "Enable encryption in transit for all communications"
  type        = bool
  default     = true
}

# Multi-AZ and High Availability
variable "enable_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = true
}

variable "availability_zones_count" {
  description = "Number of availability zones to use"
  type        = number
  default     = 3
  
  validation {
    condition     = var.availability_zones_count >= 2 && var.availability_zones_count <= 6
    error_message = "Availability zones count must be between 2 and 6."
  }
}

# Lambda Configuration
variable "lambda_runtime" {
  description = "Lambda runtime version"
  type        = string
  default     = "nodejs18.x"
  
  validation {
    condition = contains([
      "nodejs16.x", "nodejs18.x", "nodejs20.x",
      "python3.9", "python3.10", "python3.11"
    ], var.lambda_runtime)
    error_message = "Lambda runtime must be a supported version."
  }
}

variable "lambda_memory_size" {
  description = "Default memory size for Lambda functions (MB)"
  type        = number
  default     = 512
  
  validation {
    condition     = var.lambda_memory_size >= 128 && var.lambda_memory_size <= 10240
    error_message = "Lambda memory size must be between 128 and 10240 MB."
  }
}

variable "lambda_timeout" {
  description = "Default timeout for Lambda functions (seconds)"
  type        = number
  default     = 30
  
  validation {
    condition     = var.lambda_timeout >= 1 && var.lambda_timeout <= 900
    error_message = "Lambda timeout must be between 1 and 900 seconds."
  }
}

# API Gateway Configuration
variable "api_throttle_rate_limit" {
  description = "API Gateway throttle rate limit (requests per second)"
  type        = number
  default     = 1000
  
  validation {
    condition     = var.api_throttle_rate_limit >= 1
    error_message = "API throttle rate limit must be at least 1 request per second."
  }
}

variable "api_throttle_burst_limit" {
  description = "API Gateway throttle burst limit"
  type        = number
  default     = 2000
  
  validation {
    condition     = var.api_throttle_burst_limit >= var.api_throttle_rate_limit
    error_message = "API throttle burst limit must be greater than or equal to rate limit."
  }
}

# Healthcare-Specific Configuration
variable "fhir_version" {
  description = "FHIR version to support"
  type        = string
  default     = "R4"
  
  validation {
    condition     = contains(["R4", "R5"], var.fhir_version)
    error_message = "FHIR version must be R4 or R5."
  }
}

variable "enable_telehealth" {
  description = "Enable telehealth services"
  type        = bool
  default     = true
}

variable "enable_ai_transcription" {
  description = "Enable AI-powered transcription services"
  type        = bool
  default     = true
}

variable "supported_languages" {
  description = "List of supported languages for the platform"
  type        = list(string)
  default     = ["en", "es", "fr", "de", "pt", "zh", "ar", "hi", "ja"]
  
  validation {
    condition     = contains(var.supported_languages, "en")
    error_message = "English (en) must be included in supported languages."
  }
}

# Cost Optimization
variable "enable_cost_optimization" {
  description = "Enable cost optimization features"
  type        = bool
  default     = true
}

variable "lambda_reserved_concurrency" {
  description = "Reserved concurrency for Lambda functions (0 for unlimited)"
  type        = number
  default     = 0
  
  validation {
    condition     = var.lambda_reserved_concurrency >= 0
    error_message = "Lambda reserved concurrency must be non-negative."
  }
}

# Tagging
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "project_name" {
  description = "Name of the project for tagging"
  type        = string
  default     = "WebQX Healthcare Platform"
}

variable "owner" {
  description = "Owner of the resources for tagging"
  type        = string
  default     = "WebQX Health"
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "Healthcare Technology"
}

# Development and Testing
variable "enable_debug_logging" {
  description = "Enable debug logging for development"
  type        = bool
  default     = false
}

variable "enable_local_testing" {
  description = "Enable resources for local testing"
  type        = bool
  default     = false
}

# Compliance and Governance
variable "compliance_framework" {
  description = "Primary compliance framework"
  type        = string
  default     = "HIPAA"
  
  validation {
    condition     = contains(["HIPAA", "GDPR", "SOC2", "FedRAMP"], var.compliance_framework)
    error_message = "Compliance framework must be one of: HIPAA, GDPR, SOC2, FedRAMP."
  }
}

variable "data_residency_region" {
  description = "Region where data must reside for compliance"
  type        = string
  default     = ""
}

variable "enable_data_classification" {
  description = "Enable automatic data classification"
  type        = bool
  default     = true
}

# Disaster Recovery
variable "enable_cross_region_backup" {
  description = "Enable cross-region backup for disaster recovery"
  type        = bool
  default     = false
}

variable "backup_region" {
  description = "Secondary region for disaster recovery backups"
  type        = string
  default     = ""
}

variable "rto_hours" {
  description = "Recovery Time Objective in hours"
  type        = number
  default     = 4
  
  validation {
    condition     = var.rto_hours >= 1 && var.rto_hours <= 72
    error_message = "RTO must be between 1 and 72 hours."
  }
}

variable "rpo_hours" {
  description = "Recovery Point Objective in hours"
  type        = number
  default     = 1
  
  validation {
    condition     = var.rpo_hours >= 0.25 && var.rpo_hours <= 24
    error_message = "RPO must be between 0.25 and 24 hours."
  }
}