# Outputs for WebQX Healthcare Platform Infrastructure

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

# API Gateway Outputs
output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = module.api_gateway.api_url
  sensitive   = false
}

output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = module.api_gateway.api_id
}

output "api_gateway_stage_name" {
  description = "Stage name of the API Gateway"
  value       = module.api_gateway.stage_name
}

# Lambda Outputs
output "lambda_function_names" {
  description = "Names of the Lambda functions"
  value       = module.lambda.function_names
}

output "lambda_function_arns" {
  description = "ARNs of the Lambda functions"
  value       = module.lambda.function_arns
  sensitive   = true
}

# DynamoDB Outputs
output "dynamodb_table_names" {
  description = "Names of the DynamoDB tables"
  value       = module.dynamodb.table_names
}

output "dynamodb_table_arns" {
  description = "ARNs of the DynamoDB tables"
  value       = module.dynamodb.table_arns
  sensitive   = true
}

# S3 Outputs
output "s3_bucket_names" {
  description = "Names of the S3 buckets"
  value       = module.s3.bucket_names
}

output "s3_bucket_arns" {
  description = "ARNs of the S3 buckets"
  value       = module.s3.bucket_arns
  sensitive   = true
}

# IAM Outputs
output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = module.iam.lambda_execution_role_arn
  sensitive   = true
}

# Security Outputs
output "lambda_security_group_id" {
  description = "ID of the Lambda security group"
  value       = module.security_groups.lambda_security_group_id
}

output "api_gateway_security_group_id" {
  description = "ID of the API Gateway security group"
  value       = module.security_groups.api_gateway_security_group_id
}

# Monitoring Outputs
output "cloudwatch_log_groups" {
  description = "CloudWatch log group names"
  value       = module.monitoring.log_group_names
}

output "sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = module.monitoring.sns_topic_arn
  sensitive   = true
}

# Secrets Manager Outputs
output "secrets_manager_secret_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.webqx_config.arn
  sensitive   = true
}

# Healthcare-specific Outputs
output "fhir_api_endpoint" {
  description = "FHIR API endpoint URL"
  value       = "${module.api_gateway.api_url}/fhir"
}

output "patient_portal_endpoint" {
  description = "Patient portal API endpoint URL"
  value       = "${module.api_gateway.api_url}/patient"
}

output "provider_portal_endpoint" {
  description = "Provider portal API endpoint URL"
  value       = "${module.api_gateway.api_url}/provider"
}

output "admin_console_endpoint" {
  description = "Admin console API endpoint URL"
  value       = "${module.api_gateway.api_url}/admin"
}

output "telehealth_endpoint" {
  description = "Telehealth API endpoint URL"
  value       = "${module.api_gateway.api_url}/telehealth"
}

# Regional Information
output "aws_region" {
  description = "AWS region where resources are deployed"
  value       = data.aws_region.current.name
}

output "aws_account_id" {
  description = "AWS account ID"
  value       = data.aws_caller_identity.current.account_id
  sensitive   = true
}

# Environment Information
output "environment" {
  description = "Deployment environment"
  value       = var.environment
}

output "name_prefix" {
  description = "Name prefix used for resources"
  value       = local.name_prefix
}

# KMS Outputs
output "general_kms_key_arn" {
  description = "ARN of the general KMS key"
  value       = module.kms.general_kms_key_arn
  sensitive   = true
}

output "phi_kms_key_arn" {
  description = "ARN of the PHI KMS key"
  value       = module.kms.phi_kms_key_arn
  sensitive   = true
}

# Load Balancer Outputs (conditional)
output "load_balancer_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = var.enable_ecs ? module.load_balancer[0].load_balancer_dns_name : null
}

output "load_balancer_arn" {
  description = "ARN of the Application Load Balancer"
  value       = var.enable_ecs ? module.load_balancer[0].load_balancer_arn : null
  sensitive   = true
}

# ECS Outputs (conditional)
output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = var.enable_ecs ? module.ecs[0].cluster_name : null
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = var.enable_ecs ? module.ecs[0].cluster_arn : null
  sensitive   = true
}

output "api_service_name" {
  description = "Name of the API ECS service"
  value       = var.enable_ecs ? module.ecs[0].api_service_name : null
}

output "telehealth_service_name" {
  description = "Name of the telehealth ECS service"
  value       = var.enable_ecs ? module.ecs[0].telehealth_service_name : null
}

# Auto Scaling Outputs (conditional)
output "autoscaling_notifications_topic_arn" {
  description = "ARN of the auto scaling notifications SNS topic"
  value       = var.enable_ecs ? module.autoscaling[0].autoscaling_notifications_topic_arn : null
  sensitive   = true
}

# Enhanced Endpoints (with load balancer if enabled)
output "primary_api_endpoint" {
  description = "Primary API endpoint (ALB if ECS enabled, API Gateway otherwise)"
  value       = var.enable_ecs ? "https://${module.load_balancer[0].load_balancer_dns_name}" : module.api_gateway.api_url
}

output "telehealth_direct_endpoint" {
  description = "Direct telehealth endpoint (ALB-based if ECS enabled)"
  value       = var.enable_ecs ? "https://${module.load_balancer[0].load_balancer_dns_name}/telehealth" : "${module.api_gateway.api_url}/telehealth"
}