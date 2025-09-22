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

## Serverless modules removed (lambda, api gateway, dynamodb)
## This Terraform stack is dormant. Prefer Docker/Railway for deployment.

# S3 Buckets for file storage
module "s3" {
  source = "./modules/s3"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  enable_versioning = true
  enable_encryption = local.enable_encryption
  
  tags = local.common_tags
}

## Monitoring removed due to dependency on removed modules

## IAM module removed (was tailored for Lambda/DynamoDB)

# Secrets Manager for sensitive configuration
## Secrets Manager resources removed