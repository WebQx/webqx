# IAM Roles and Policies for WebQX Healthcare Platform

# Lambda execution role (already in lambda module, but included here for completeness)
resource "aws_iam_role" "lambda_execution" {
  name = "${var.name_prefix}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Policy for DynamoDB access
resource "aws_iam_policy" "dynamodb_access" {
  name        = "${var.name_prefix}-dynamodb-access"
  description = "Policy for DynamoDB access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = var.dynamodb_table_arns
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          for arn in var.dynamodb_table_arns : "${arn}/index/*"
        ]
      }
    ]
  })

  tags = var.tags
}

# Policy for S3 access
resource "aws_iam_policy" "s3_access" {
  name        = "${var.name_prefix}-s3-access"
  description = "Policy for S3 access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          for arn in var.s3_bucket_arns : "${arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = var.s3_bucket_arns
      }
    ]
  })

  tags = var.tags
}

# Healthcare compliance role
resource "aws_iam_role" "healthcare_compliance" {
  name = "${var.name_prefix}-healthcare-compliance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = ["lambda.amazonaws.com", "events.amazonaws.com"]
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Purpose = "HIPAA-Compliance"
  })
}

# Audit logging policy
resource "aws_iam_policy" "audit_logging" {
  name        = "${var.name_prefix}-audit-logging"
  description = "Policy for HIPAA-compliant audit logging"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${var.s3_bucket_arns["audit_logs"]}/*"
      }
    ]
  })

  tags = var.tags
}

# API Gateway execution role
resource "aws_iam_role" "api_gateway_execution" {
  name = "${var.name_prefix}-api-gateway-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# CloudWatch logging policy for API Gateway
resource "aws_iam_policy" "api_gateway_logging" {
  name        = "${var.name_prefix}-api-gateway-logging"
  description = "Policy for API Gateway CloudWatch logging"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents",
          "logs:GetLogEvents",
          "logs:FilterLogEvents"
        ]
        Resource = "*"
      }
    ]
  })

  tags = var.tags
}

# Role for healthcare data processing
resource "aws_iam_role" "healthcare_data_processor" {
  name = "${var.name_prefix}-healthcare-data-processor"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Purpose = "Healthcare-Data-Processing"
    DataClass = "PHI"
  })
}

# Policy attachments
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

resource "aws_iam_role_policy_attachment" "lambda_s3" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.s3_access.arn
}

resource "aws_iam_role_policy_attachment" "healthcare_compliance_audit" {
  role       = aws_iam_role.healthcare_compliance.name
  policy_arn = aws_iam_policy.audit_logging.arn
}

resource "aws_iam_role_policy_attachment" "api_gateway_logging_attachment" {
  role       = aws_iam_role.api_gateway_execution.name
  policy_arn = aws_iam_policy.api_gateway_logging.arn
}