# Lambda Functions for WebQX Healthcare Platform

# Package Lambda functions
data "archive_file" "lambda_packages" {
  for_each = local.lambda_functions

  type        = "zip"
  source_dir  = "${path.root}/../../lambda/${each.key}"
  output_path = "/tmp/${each.key}.zip"
}

# Lambda function definitions
locals {
  lambda_functions = {
    "patient-api" = {
      description = "Patient portal API functions"
      handler     = "index.handler"
      runtime     = "nodejs18.x"
      timeout     = 30
      memory_size = 256
      environment_variables = {
        PATIENTS_TABLE      = var.dynamodb_tables.patients
        APPOINTMENTS_TABLE  = var.dynamodb_tables.appointments
        MEDICAL_RECORDS_TABLE = var.dynamodb_tables.medical_records
        LAB_RESULTS_TABLE   = var.dynamodb_tables.lab_results
        AUDIT_LOGS_TABLE    = var.dynamodb_tables.audit_logs
        NODE_ENV            = var.environment
      }
    }
    "provider-api" = {
      description = "Provider portal API functions"
      handler     = "index.handler"
      runtime     = "nodejs18.x"
      timeout     = 30
      memory_size = 512
      environment_variables = {
        PATIENTS_TABLE        = var.dynamodb_tables.patients
        APPOINTMENTS_TABLE    = var.dynamodb_tables.appointments
        PROVIDERS_TABLE       = var.dynamodb_tables.providers
        MEDICAL_RECORDS_TABLE = var.dynamodb_tables.medical_records
        PRESCRIPTIONS_TABLE   = var.dynamodb_tables.prescriptions
        AUDIT_LOGS_TABLE      = var.dynamodb_tables.audit_logs
        NODE_ENV              = var.environment
      }
    }
    "admin-api" = {
      description = "Admin console API functions"
      handler     = "index.handler"
      runtime     = "nodejs18.x"
      timeout     = 60
      memory_size = 512
      environment_variables = {
        PATIENTS_TABLE        = var.dynamodb_tables.patients
        APPOINTMENTS_TABLE    = var.dynamodb_tables.appointments
        PROVIDERS_TABLE       = var.dynamodb_tables.providers
        MEDICAL_RECORDS_TABLE = var.dynamodb_tables.medical_records
        LAB_RESULTS_TABLE     = var.dynamodb_tables.lab_results
        PRESCRIPTIONS_TABLE   = var.dynamodb_tables.prescriptions
        AUDIT_LOGS_TABLE      = var.dynamodb_tables.audit_logs
        SESSIONS_TABLE        = var.dynamodb_tables.sessions
        NODE_ENV              = var.environment
      }
    }
    "fhir-api" = {
      description = "FHIR R4 API implementation"
      handler     = "index.handler"
      runtime     = "nodejs18.x"
      timeout     = 30
      memory_size = 512
      environment_variables = {
        PATIENTS_TABLE        = var.dynamodb_tables.patients
        MEDICAL_RECORDS_TABLE = var.dynamodb_tables.medical_records
        LAB_RESULTS_TABLE     = var.dynamodb_tables.lab_results
        AUDIT_LOGS_TABLE      = var.dynamodb_tables.audit_logs
        FHIR_VERSION          = "R4"
        NODE_ENV              = var.environment
      }
    }
    "telehealth-api" = {
      description = "Telehealth and video consultation API"
      handler     = "index.handler"
      runtime     = "nodejs18.x"
      timeout     = 60
      memory_size = 1024
      environment_variables = {
        APPOINTMENTS_TABLE    = var.dynamodb_tables.appointments
        PROVIDERS_TABLE       = var.dynamodb_tables.providers
        PATIENTS_TABLE        = var.dynamodb_tables.patients
        AUDIT_LOGS_TABLE      = var.dynamodb_tables.audit_logs
        NODE_ENV              = var.environment
      }
    }
    "auth-api" = {
      description = "Authentication and authorization API"
      handler     = "index.handler"
      runtime     = "nodejs18.x"
      timeout     = 30
      memory_size = 256
      environment_variables = {
        SESSIONS_TABLE    = var.dynamodb_tables.sessions
        PROVIDERS_TABLE   = var.dynamodb_tables.providers
        AUDIT_LOGS_TABLE  = var.dynamodb_tables.audit_logs
        NODE_ENV          = var.environment
      }
    }
    "hl7-processor" = {
      description = "HL7 message processing for lab results"
      handler     = "index.handler"
      runtime     = "nodejs18.x"
      timeout     = 60
      memory_size = 512
      environment_variables = {
        PATIENTS_TABLE      = var.dynamodb_tables.patients
        LAB_RESULTS_TABLE   = var.dynamodb_tables.lab_results
        MEDICAL_RECORDS_TABLE = var.dynamodb_tables.medical_records
        AUDIT_LOGS_TABLE    = var.dynamodb_tables.audit_logs
        NODE_ENV            = var.environment
      }
    }
    "audit-processor" = {
      description = "Audit log processing and compliance reporting"
      handler     = "index.handler"
      runtime     = "nodejs18.x"
      timeout     = 300
      memory_size = 1024
      environment_variables = {
        AUDIT_LOGS_TABLE = var.dynamodb_tables.audit_logs
        NODE_ENV         = var.environment
      }
    }
  }
}

# Lambda functions
resource "aws_lambda_function" "functions" {
  for_each = local.lambda_functions

  filename         = data.archive_file.lambda_packages[each.key].output_path
  function_name    = "${var.name_prefix}-${each.key}"
  role            = aws_iam_role.lambda_execution.arn
  handler         = each.value.handler
  runtime         = each.value.runtime
  timeout         = each.value.timeout
  memory_size     = each.value.memory_size
  source_code_hash = data.archive_file.lambda_packages[each.key].output_base64sha256

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_group_ids
  }

  environment {
    variables = each.value.environment_variables
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_execution,
    aws_cloudwatch_log_group.lambda_logs
  ]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-${each.key}"
    Function = each.key
  })
}

# CloudWatch Log Groups for Lambda functions
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = local.lambda_functions

  name              = "/aws/lambda/${var.name_prefix}-${each.key}"
  retention_in_days = 14

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-${each.key}-logs"
  })
}

# IAM role for Lambda execution
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

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# DynamoDB access policy
resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "${var.name_prefix}-lambda-dynamodb-policy"
  role = aws_iam_role.lambda_execution.id

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
        Resource = [
          for table_arn in values(var.dynamodb_tables) : 
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${table_arn}"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          for table_arn in values(var.dynamodb_tables) : 
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${table_arn}/index/*"
        ]
      }
    ]
  })
}

# Secrets Manager access policy
resource "aws_iam_role_policy" "lambda_secrets" {
  name = "${var.name_prefix}-lambda-secrets-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.name_prefix}-config*"
      }
    ]
  })
}

# Lambda function URLs for direct HTTPS access
resource "aws_lambda_function_url" "function_urls" {
  for_each = {
    for name, config in local.lambda_functions : name => config
    if contains(["patient-api", "provider-api", "admin-api", "fhir-api", "telehealth-api", "auth-api"], name)
  }

  function_name      = aws_lambda_function.functions[each.key].function_name
  authorization_type = "NONE"  # API Gateway will handle auth

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["*"]
    allow_headers     = ["date", "keep-alive"]
    expose_headers    = ["date", "keep-alive"]
    max_age          = 86400
  }
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  for_each = local.lambda_functions

  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*/*/*"
}

# Lambda Layer for common dependencies
resource "aws_lambda_layer_version" "webqx_common" {
  filename   = "${path.root}/../../lambda/layers/webqx-common.zip"
  layer_name = "${var.name_prefix}-common-layer"

  compatible_runtimes = ["nodejs18.x"]
  description         = "Common utilities and dependencies for WebQX Lambda functions"

  depends_on = [data.archive_file.common_layer]
}

data "archive_file" "common_layer" {
  type        = "zip"
  source_dir  = "${path.root}/../../lambda/layers/webqx-common"
  output_path = "${path.root}/../../lambda/layers/webqx-common.zip"
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}