# Variables for WebQX Healthcare Platform Infrastructure

variable "aws_region" {
  description = "AWS region for the WebQX infrastructure"
  type        = string
  default     = "us-east-1"
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
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# Healthcare Platform Configuration
variable "enable_hipaa_logging" {
  description = "Enable HIPAA-compliant audit logging"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "enable_multi_az" {
  description = "Enable multi-AZ deployment for high availability"
  type        = bool
  default     = true
}

# Lambda Configuration
variable "lambda_runtime" {
  description = "Runtime for Lambda functions"
  type        = string
  default     = "nodejs18.x"
}

variable "lambda_timeout" {
  description = "Timeout for Lambda functions in seconds"
  type        = number
  default     = 30
}

variable "lambda_memory_size" {
  description = "Memory size for Lambda functions in MB"
  type        = number
  default     = 256
}

# DynamoDB Configuration
variable "dynamodb_billing_mode" {
  description = "Billing mode for DynamoDB tables"
  type        = string
  default     = "PAY_PER_REQUEST"
  
  validation {
    condition     = contains(["PROVISIONED", "PAY_PER_REQUEST"], var.dynamodb_billing_mode)
    error_message = "Billing mode must be either PROVISIONED or PAY_PER_REQUEST."
  }
}

# API Gateway Configuration
variable "api_gateway_stage_name" {
  description = "Stage name for API Gateway"
  type        = string
  default     = "v1"
}

variable "enable_api_gateway_logging" {
  description = "Enable API Gateway access logging"
  type        = bool
  default     = true
}

# Security Configuration
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the infrastructure"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Restrict this in production
}

variable "enable_waf" {
  description = "Enable AWS WAF for API Gateway"
  type        = bool
  default     = false  # Set to true for production
}

# Healthcare-specific configurations
variable "fhir_version" {
  description = "FHIR version to support"
  type        = string
  default     = "R4"
}

variable "enable_phi_encryption" {
  description = "Enable encryption for PHI (Protected Health Information)"
  type        = bool
  default     = true
}

variable "audit_log_retention_days" {
  description = "Number of days to retain audit logs"
  type        = number
  default     = 2555  # ~7 years for HIPAA compliance
}

# Monitoring Configuration
variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "sns_alarm_endpoint" {
  description = "SNS endpoint for alarms (email)"
  type        = string
  default     = ""
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name for the WebQX platform"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  default     = ""
}

# ECS Configuration
variable "enable_ecs" {
  description = "Enable ECS containerized services for auto-scaling"
  type        = bool
  default     = true
}

variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate for ALB HTTPS listener"
  type        = string
  default     = ""
}

# Auto Scaling Configuration
variable "api_min_capacity" {
  description = "Minimum number of API service tasks"
  type        = number
  default     = 2
}

variable "api_max_capacity" {
  description = "Maximum number of API service tasks"
  type        = number
  default     = 20
}

variable "telehealth_min_capacity" {
  description = "Minimum number of telehealth service tasks"
  type        = number
  default     = 2
}

variable "telehealth_max_capacity" {
  description = "Maximum number of telehealth service tasks"
  type        = number
  default     = 15
}

# Auto Scaling Thresholds
variable "cpu_target_utilization" {
  description = "Target CPU utilization percentage for auto-scaling"
  type        = number
  default     = 70.0
}

variable "memory_target_utilization" {
  description = "Target memory utilization percentage for auto-scaling"
  type        = number
  default     = 75.0
}

variable "request_count_target" {
  description = "Target request count per minute for auto-scaling"
  type        = number
  default     = 1000.0
}