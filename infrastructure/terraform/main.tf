# WebQX Healthcare Platform - Main Terraform Configuration
# Infrastructure as Code for AWS deployment

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "WebQX-Healthcare-Platform"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "WebQX-Health"
    }
  }
}

# Local values for resource naming and configuration
locals {
  name_prefix = "webqx-${var.environment}"
  
  common_tags = {
    Project     = "WebQX-Healthcare-Platform"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "WebQX-Health"
  }

  # Healthcare-specific configurations
  hipaa_compliance = true
  enable_encryption = true
  backup_retention_days = 7
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# VPC Configuration
module "vpc" {
  source = "./modules/vpc"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  vpc_cidr = var.vpc_cidr
  availability_zones = var.availability_zones
  
  tags = local.common_tags
}

# Security Groups
module "security_groups" {
  source = "./modules/security"
  
  name_prefix = local.name_prefix
  vpc_id = module.vpc.vpc_id
  
  tags = local.common_tags
}

# API Gateway
module "api_gateway" {
  source = "./modules/api_gateway"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  # Lambda function ARNs (will be provided by lambda module)
  lambda_function_arns = module.lambda.function_arns
  
  tags = local.common_tags
}

# Lambda Functions
module "lambda" {
  source = "./modules/lambda"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  subnet_ids = module.vpc.private_subnet_ids
  security_group_ids = [module.security_groups.lambda_security_group_id]
  
  # DynamoDB table names for environment variables
  dynamodb_tables = module.dynamodb.table_names
  
  tags = local.common_tags
}

# DynamoDB Tables
module "dynamodb" {
  source = "./modules/dynamodb"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  backup_retention_days = local.backup_retention_days
  
  tags = local.common_tags
}

# S3 Buckets for file storage
module "s3" {
  source = "./modules/s3"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  enable_versioning = true
  enable_encryption = local.enable_encryption
  
  tags = local.common_tags
}

# CloudWatch Monitoring
module "monitoring" {
  source = "./modules/monitoring"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  # Resources to monitor
  lambda_function_names = module.lambda.function_names
  dynamodb_table_names = module.dynamodb.table_names
  api_gateway_name = module.api_gateway.api_name
  
  # Auto-scaling monitoring
  ecs_cluster_name = try(module.ecs[0].cluster_name, "")
  alb_target_group_full_name = try(module.load_balancer[0].api_target_group_full_name, "")
  
  tags = local.common_tags
}

# KMS for HIPAA-compliant encryption
module "kms" {
  source = "./modules/kms"
  
  name_prefix = local.name_prefix
  
  tags = local.common_tags
}

# Application Load Balancer (conditional)
module "load_balancer" {
  count = var.enable_ecs ? 1 : 0
  source = "./modules/load_balancer"
  
  name_prefix = local.name_prefix
  vpc_id = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  alb_security_group_id = module.security_groups.alb_security_group_id
  ssl_certificate_arn = var.ssl_certificate_arn
  access_logs_bucket = module.s3.bucket_names["access_logs"]
  
  tags = local.common_tags
}

# ECS Cluster and Services (conditional)
module "ecs" {
  count = var.enable_ecs ? 1 : 0
  source = "./modules/ecs"
  
  name_prefix = local.name_prefix
  environment = var.environment
  aws_region = var.aws_region
  
  # Networking
  private_subnet_ids = module.vpc.private_subnet_ids
  ecs_security_group_id = module.security_groups.ecs_security_group_id
  
  # IAM
  ecs_execution_role_arn = module.iam.ecs_task_execution_role_arn
  ecs_task_role_arn = module.iam.ecs_task_role_arn
  
  # Load Balancer
  load_balancer_listener_arn = module.load_balancer[0].https_listener_arn
  target_group_arn = module.load_balancer[0].api_target_group_arn
  telehealth_target_group_arn = module.load_balancer[0].telehealth_target_group_arn
  
  # Secrets
  jwt_secret_arn = aws_secretsmanager_secret.webqx_config.arn
  database_secret_arn = aws_secretsmanager_secret.webqx_config.arn
  
  tags = local.common_tags
}

# Auto Scaling for ECS (conditional)
module "autoscaling" {
  count = var.enable_ecs ? 1 : 0
  source = "./modules/autoscaling"
  
  name_prefix = local.name_prefix
  
  # ECS Configuration
  cluster_name = module.ecs[0].cluster_name
  api_service_name = module.ecs[0].api_service_name
  telehealth_service_name = module.ecs[0].telehealth_service_name
  
  # Target Groups for request-based scaling
  api_target_group_full_name = module.load_balancer[0].api_target_group_full_name
  telehealth_target_group_full_name = module.load_balancer[0].telehealth_target_group_full_name
  
  # Encryption
  sns_kms_key_id = module.kms.general_kms_key_id
  
  # Scaling Configuration
  api_min_capacity = var.api_min_capacity
  api_max_capacity = var.api_max_capacity
  telehealth_min_capacity = var.telehealth_min_capacity
  telehealth_max_capacity = var.telehealth_max_capacity
  
  tags = local.common_tags
}

# IAM Roles and Policies
module "iam" {
  source = "./modules/iam"
  
  name_prefix = local.name_prefix
  
  # DynamoDB table ARNs for policies
  dynamodb_table_arns = module.dynamodb.table_arns
  s3_bucket_arns = module.s3.bucket_arns
  
  tags = local.common_tags
}

# Secrets Manager for sensitive configuration
resource "aws_secretsmanager_secret" "webqx_config" {
  name = "${local.name_prefix}-config"
  description = "WebQX Healthcare Platform configuration secrets"
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-config"
    Type = "Configuration"
  })
}

resource "aws_secretsmanager_secret_version" "webqx_config" {
  secret_id = aws_secretsmanager_secret.webqx_config.id
  secret_string = jsonencode({
    database_url = "placeholder"
    jwt_secret = "placeholder"
    encryption_key = "placeholder"
    fhir_server_url = "placeholder"
    keycloak_config = "placeholder"
  })
  
  lifecycle {
    ignore_changes = [secret_string]
  }
}