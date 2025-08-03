# Terraform configuration for WebQX Healthcare Platform
# HIPAA-compliant AWS infrastructure with comprehensive security and compliance features

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }

  # Backend configuration for state management
  backend "s3" {
    # Configure these values when running terraform init
    # bucket         = "webqx-terraform-state"
    # key            = "webqx-healthcare/terraform.tfstate"
    # region         = "us-east-1"
    # encrypt        = true
    # dynamodb_table = "webqx-terraform-locks"
  }
}

# Configure the AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "WebQX Healthcare Platform"
      Environment = var.environment
      HIPAA       = "true"
      ManagedBy   = "Terraform"
      Owner       = "WebQX Health"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# Local values
locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
  
  common_tags = {
    Project     = "WebQX Healthcare Platform"
    Environment = var.environment
    HIPAA       = "true"
    ManagedBy   = "Terraform"
  }

  # HIPAA compliance settings
  encryption_at_rest = true
  encryption_in_transit = true
  audit_logging_enabled = true
  backup_retention_days = 2555 # 7 years

  # Network configuration
  vpc_cidr = var.vpc_cidr
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)
  
  # Naming convention
  name_prefix = "webqx-${var.environment}"
}

# Random ID for unique resource naming
resource "random_id" "suffix" {
  byte_length = 4
}

# KMS Key for HIPAA-compliant encryption
resource "aws_kms_key" "healthcare" {
  description = "WebQX Healthcare Platform HIPAA-compliant encryption key"
  
  key_usage                = "ENCRYPT_DECRYPT"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_rotation_enabled     = true
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow use of the key for healthcare services"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "dynamodb.amazonaws.com",
            "s3.amazonaws.com",
            "rds.amazonaws.com",
            "secretsmanager.amazonaws.com"
          ]
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-healthcare-kms"
  })
}

resource "aws_kms_alias" "healthcare" {
  name          = "alias/${local.name_prefix}-healthcare"
  target_key_id = aws_kms_key.healthcare.key_id
}

# VPC for secure networking
resource "aws_vpc" "main" {
  cidr_block           = local.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

# Public Subnets for NAT Gateways and Load Balancers
resource "aws_subnet" "public" {
  count = length(local.availability_zones)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(local.vpc_cidr, 8, count.index)
  availability_zone       = local.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-subnet-${count.index + 1}"
    Type = "Public"
  })
}

# Private Subnets for Lambda functions and databases
resource "aws_subnet" "private" {
  count = length(local.availability_zones)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(local.vpc_cidr, 8, count.index + 10)
  availability_zone = local.availability_zones[count.index]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-subnet-${count.index + 1}"
    Type = "Private"
  })
}

# Database Subnets for RDS
resource "aws_subnet" "database" {
  count = length(local.availability_zones)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(local.vpc_cidr, 8, count.index + 20)
  availability_zone = local.availability_zones[count.index]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-subnet-${count.index + 1}"
    Type = "Database"
  })
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count = length(local.availability_zones)

  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-eip-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

# NAT Gateways for private subnet internet access
resource "aws_nat_gateway" "main" {
  count = length(local.availability_zones)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-gw-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

resource "aws_route_table" "private" {
  count = length(local.availability_zones)

  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-rt-${count.index + 1}"
  })
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-rt"
  })
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "database" {
  count = length(aws_subnet.database)

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# Security Groups
resource "aws_security_group" "lambda" {
  name_prefix = "${local.name_prefix}-lambda-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for Lambda functions"

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound for AWS APIs"
  }

  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP outbound for package downloads"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-lambda-sg"
  })
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for RDS instances"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
    description     = "PostgreSQL access from Lambda"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg"
  })
}

resource "aws_security_group" "alb" {
  name_prefix = "${local.name_prefix}-alb-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for Application Load Balancer"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
  })
}

# S3 Buckets for HIPAA-compliant storage
resource "aws_s3_bucket" "healthcare_data" {
  bucket = "${local.name_prefix}-healthcare-data-${random_id.suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-healthcare-data"
    DataClassification = "Sensitive"
  })
}

resource "aws_s3_bucket_encryption" "healthcare_data" {
  bucket = aws_s3_bucket.healthcare_data.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = aws_kms_key.healthcare.arn
        sse_algorithm     = "aws:kms"
      }
      bucket_key_enabled = true
    }
  }
}

resource "aws_s3_bucket_versioning" "healthcare_data" {
  bucket = aws_s3_bucket.healthcare_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "healthcare_data" {
  bucket = aws_s3_bucket.healthcare_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "healthcare_data" {
  bucket = aws_s3_bucket.healthcare_data.id

  rule {
    id     = "healthcare_data_retention"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 2555 # 7 years HIPAA retention
      storage_class = "DEEP_ARCHIVE"
    }
  }
}

# Audit Logs S3 Bucket
resource "aws_s3_bucket" "audit_logs" {
  bucket = "${local.name_prefix}-audit-logs-${random_id.suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-audit-logs"
    DataClassification = "Audit"
  })
}

resource "aws_s3_bucket_encryption" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = aws_kms_key.healthcare.arn
        sse_algorithm     = "aws:kms"
      }
      bucket_key_enabled = true
    }
  }
}

resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    id     = "audit_log_retention"
    status = "Enabled"

    expiration {
      days = local.backup_retention_days
    }
  }
}

# CloudTrail for audit logging
resource "aws_cloudtrail" "main" {
  name           = "${local.name_prefix}-cloudtrail"
  s3_bucket_name = aws_s3_bucket.audit_logs.bucket
  s3_key_prefix  = "cloudtrail/"

  enable_logging                = true
  include_global_service_events = true
  is_multi_region_trail         = true
  is_organization_trail         = false

  kms_key_id = aws_kms_key.healthcare.arn

  enable_log_file_validation = true

  insight_selector {
    insight_type = "ApiCallRateInsight"
  }

  event_selector {
    read_write_type                 = "All"
    include_management_events       = true
    exclude_management_event_sources = []

    data_resource {
      type   = "AWS::S3::Object"
      values = ["${aws_s3_bucket.healthcare_data.arn}/*"]
    }

    data_resource {
      type   = "AWS::Lambda::Function"
      values = ["arn:aws:lambda:${local.region}:${local.account_id}:function:*"]
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cloudtrail"
  })

  depends_on = [aws_s3_bucket_policy.audit_logs_cloudtrail]
}

# S3 bucket policy for CloudTrail
resource "aws_s3_bucket_policy" "audit_logs_cloudtrail" {
  bucket = aws_s3_bucket.audit_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.audit_logs.arn
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudtrail:${local.region}:${local.account_id}:trail/${local.name_prefix}-cloudtrail"
          }
        }
      },
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.audit_logs.arn}/cloudtrail/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
            "AWS:SourceArn" = "arn:aws:cloudtrail:${local.region}:${local.account_id}:trail/${local.name_prefix}-cloudtrail"
          }
        }
      }
    ]
  })
}

# DynamoDB Tables
resource "aws_dynamodb_table" "patients" {
  name           = "${local.name_prefix}-patients"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "patientId"
    type = "S"
  }

  attribute {
    name = "mrn"
    type = "S"
  }

  global_secondary_index {
    name     = "patientId-index"
    hash_key = "patientId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name     = "mrn-index"
    hash_key = "mrn"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.healthcare.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-patients-table"
  })
}

resource "aws_dynamodb_table" "appointments" {
  name           = "${local.name_prefix}-appointments"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "patientId"
    type = "S"
  }

  attribute {
    name = "providerId"
    type = "S"
  }

  attribute {
    name = "appointmentDateTime"
    type = "S"
  }

  global_secondary_index {
    name               = "patientId-appointmentDateTime-index"
    hash_key           = "patientId"
    range_key          = "appointmentDateTime"
    projection_type    = "ALL"
  }

  global_secondary_index {
    name               = "providerId-appointmentDateTime-index"
    hash_key           = "providerId"
    range_key          = "appointmentDateTime"
    projection_type    = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.healthcare.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-appointments-table"
  })
}

resource "aws_dynamodb_table" "observations" {
  name           = "${local.name_prefix}-observations"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "patientId"
    type = "S"
  }

  attribute {
    name = "effectiveDateTime"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  global_secondary_index {
    name               = "patientId-effectiveDateTime-index"
    hash_key           = "patientId"
    range_key          = "effectiveDateTime"
    projection_type    = "ALL"
  }

  global_secondary_index {
    name               = "category-effectiveDateTime-index"
    hash_key           = "category"
    range_key          = "effectiveDateTime"
    projection_type    = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.healthcare.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-observations-table"
  })
}

resource "aws_dynamodb_table" "audit_logs" {
  name           = "${local.name_prefix}-audit-logs"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "resourceType"
    type = "S"
  }

  global_secondary_index {
    name            = "timestamp-index"
    hash_key        = "timestamp"
    projection_type = "ALL"
  }

  global_secondary_index {
    name               = "userId-timestamp-index"
    hash_key           = "userId"
    range_key          = "timestamp"
    projection_type    = "ALL"
  }

  global_secondary_index {
    name               = "resourceType-timestamp-index"
    hash_key           = "resourceType"
    range_key          = "timestamp"
    projection_type    = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.healthcare.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-audit-logs-table"
  })
}

# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.database[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

# RDS Instance for PostgreSQL (optional - can be used alongside DynamoDB)
resource "aws_db_instance" "postgresql" {
  count = var.enable_rds ? 1 : 0

  identifier = "${local.name_prefix}-postgresql"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.rds_instance_class
  
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.healthcare.arn

  db_name  = var.database_name
  username = var.database_username
  password = var.database_password
  port     = 5432

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = local.backup_retention_days
  backup_window          = "03:00-04:00"
  maintenance_window     = "Sun:04:00-Sun:05:00"

  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-postgresql-final-snapshot"
  delete_automated_backups  = false

  enabled_cloudwatch_logs_exports = ["postgresql"]
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.healthcare.arn

  deletion_protection = var.environment == "prod" ? true : false

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgresql"
  })
}

# Secrets Manager for database credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  count = var.enable_rds ? 1 : 0

  name                    = "${local.name_prefix}-db-credentials"
  description             = "Database credentials for WebQX Healthcare Platform"
  kms_key_id             = aws_kms_key.healthcare.arn
  recovery_window_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  count = var.enable_rds ? 1 : 0

  secret_id = aws_secretsmanager_secret.db_credentials[0].id
  secret_string = jsonencode({
    username = var.database_username
    password = var.database_password
    engine   = "postgres"
    host     = aws_db_instance.postgresql[0].endpoint
    port     = 5432
    dbname   = var.database_name
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name_prefix}"
  retention_in_days = local.backup_retention_days
  kms_key_id        = aws_kms_key.healthcare.arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-lambda-logs"
  })
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${local.name_prefix}"
  retention_in_days = local.backup_retention_days
  kms_key_id        = aws_kms_key.healthcare.arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-api-gateway-logs"
  })
}

# WAF for API Gateway protection
resource "aws_wafv2_web_acl" "api_protection" {
  name  = "${local.name_prefix}-api-protection"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-api-protection"
  })

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-api-protection"
    sampled_requests_enabled   = true
  }
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${local.name_prefix}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors lambda errors"
  alarm_actions       = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  dimensions = {
    FunctionName = "${local.name_prefix}-*"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-lambda-errors-alarm"
  })
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  alarm_name          = "${local.name_prefix}-dynamodb-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SystemErrors"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB throttling"
  alarm_actions       = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dynamodb-throttles-alarm"
  })
}

# Systems Manager Parameter Store for configuration
resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/webqx/${var.environment}/jwt-secret"
  type  = "SecureString"
  value = var.jwt_secret
  key_id = aws_kms_key.healthcare.arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-jwt-secret"
  })
}

resource "aws_ssm_parameter" "encryption_key" {
  name  = "/webqx/${var.environment}/encryption-key"
  type  = "SecureString"
  value = var.encryption_key
  key_id = aws_kms_key.healthcare.arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-encryption-key"
  })
}

resource "aws_ssm_parameter" "whisper_api_key" {
  name  = "/webqx/${var.environment}/whisper-api-key"
  type  = "SecureString"
  value = var.whisper_api_key
  key_id = aws_kms_key.healthcare.arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-whisper-api-key"
  })
}

# S3 bucket for Terraform state (created separately)
resource "aws_s3_bucket" "terraform_state" {
  count = var.create_terraform_backend ? 1 : 0

  bucket = "${local.name_prefix}-terraform-state-${random_id.suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-terraform-state"
  })
}

resource "aws_s3_bucket_encryption" "terraform_state" {
  count = var.create_terraform_backend ? 1 : 0

  bucket = aws_s3_bucket.terraform_state[0].id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = aws_kms_key.healthcare.arn
        sse_algorithm     = "aws:kms"
      }
      bucket_key_enabled = true
    }
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  count = var.create_terraform_backend ? 1 : 0

  bucket = aws_s3_bucket.terraform_state[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  count = var.create_terraform_backend ? 1 : 0

  bucket = aws_s3_bucket.terraform_state[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB table for Terraform state locking
resource "aws_dynamodb_table" "terraform_locks" {
  count = var.create_terraform_backend ? 1 : 0

  name           = "${local.name_prefix}-terraform-locks"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.healthcare.arn
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-terraform-locks"
  })
}