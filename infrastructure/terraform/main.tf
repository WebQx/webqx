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