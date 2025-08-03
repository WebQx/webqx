# API Gateway for WebQX Healthcare Platform

# REST API Gateway
resource "aws_api_gateway_rest_api" "webqx" {
  name        = "${var.name_prefix}-api"
  description = "WebQX Healthcare Platform API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api"
  })
}

# API Gateway Resources and Methods
locals {
  api_routes = {
    "patient" = {
      lambda_function = "patient-api"
      description     = "Patient portal endpoints"
      cors_enabled    = true
    }
    "provider" = {
      lambda_function = "provider-api"
      description     = "Provider portal endpoints"
      cors_enabled    = true
    }
    "admin" = {
      lambda_function = "admin-api"
      description     = "Admin console endpoints"
      cors_enabled    = true
    }
    "fhir" = {
      lambda_function = "fhir-api"
      description     = "FHIR R4 API endpoints"
      cors_enabled    = true
    }
    "telehealth" = {
      lambda_function = "telehealth-api"
      description     = "Telehealth and video consultation endpoints"
      cors_enabled    = true
    }
    "auth" = {
      lambda_function = "auth-api"
      description     = "Authentication endpoints"
      cors_enabled    = true
    }
  }
}

# Resources for each API route
resource "aws_api_gateway_resource" "routes" {
  for_each = local.api_routes

  rest_api_id = aws_api_gateway_rest_api.webqx.id
  parent_id   = aws_api_gateway_rest_api.webqx.root_resource_id
  path_part   = each.key
}

# Proxy resources for handling all sub-paths
resource "aws_api_gateway_resource" "proxy" {
  for_each = local.api_routes

  rest_api_id = aws_api_gateway_rest_api.webqx.id
  parent_id   = aws_api_gateway_resource.routes[each.key].id
  path_part   = "{proxy+}"
}

# ANY method for proxy resources
resource "aws_api_gateway_method" "proxy" {
  for_each = local.api_routes

  rest_api_id   = aws_api_gateway_rest_api.webqx.id
  resource_id   = aws_api_gateway_resource.proxy[each.key].id
  http_method   = "ANY"
  authorization = "NONE"

  request_parameters = {
    "method.request.path.proxy" = true
  }
}

# ANY method for root resources
resource "aws_api_gateway_method" "root" {
  for_each = local.api_routes

  rest_api_id   = aws_api_gateway_rest_api.webqx.id
  resource_id   = aws_api_gateway_resource.routes[each.key].id
  http_method   = "ANY"
  authorization = "NONE"
}

# Lambda integrations for proxy resources
resource "aws_api_gateway_integration" "proxy" {
  for_each = local.api_routes

  rest_api_id = aws_api_gateway_rest_api.webqx.id
  resource_id = aws_api_gateway_resource.proxy[each.key].id
  http_method = aws_api_gateway_method.proxy[each.key].http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_function_arns[each.value.lambda_function]

  request_parameters = {
    "integration.request.path.proxy" = "method.request.path.proxy"
  }
}

# Lambda integrations for root resources
resource "aws_api_gateway_integration" "root" {
  for_each = local.api_routes

  rest_api_id = aws_api_gateway_rest_api.webqx.id
  resource_id = aws_api_gateway_resource.routes[each.key].id
  http_method = aws_api_gateway_method.root[each.key].http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_function_arns[each.value.lambda_function]
}

# CORS support
resource "aws_api_gateway_method" "cors" {
  for_each = {
    for name, config in local.api_routes : name => config
    if config.cors_enabled
  }

  rest_api_id   = aws_api_gateway_rest_api.webqx.id
  resource_id   = aws_api_gateway_resource.routes[each.key].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors" {
  for_each = {
    for name, config in local.api_routes : name => config
    if config.cors_enabled
  }

  rest_api_id = aws_api_gateway_rest_api.webqx.id
  resource_id = aws_api_gateway_resource.routes[each.key].id
  http_method = aws_api_gateway_method.cors[each.key].http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "cors" {
  for_each = {
    for name, config in local.api_routes : name => config
    if config.cors_enabled
  }

  rest_api_id = aws_api_gateway_rest_api.webqx.id
  resource_id = aws_api_gateway_resource.routes[each.key].id
  http_method = aws_api_gateway_method.cors[each.key].http_method
  status_code = "200"

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "cors" {
  for_each = {
    for name, config in local.api_routes : name => config
    if config.cors_enabled
  }

  rest_api_id = aws_api_gateway_rest_api.webqx.id
  resource_id = aws_api_gateway_resource.routes[each.key].id
  http_method = aws_api_gateway_method.cors[each.key].http_method
  status_code = aws_api_gateway_method_response.cors[each.key].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,DELETE'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "webqx" {
  depends_on = [
    aws_api_gateway_integration.proxy,
    aws_api_gateway_integration.root,
    aws_api_gateway_integration.cors
  ]

  rest_api_id = aws_api_gateway_rest_api.webqx.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.routes,
      aws_api_gateway_method.proxy,
      aws_api_gateway_method.root,
      aws_api_gateway_integration.proxy,
      aws_api_gateway_integration.root,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "webqx" {
  deployment_id = aws_api_gateway_deployment.webqx.id
  rest_api_id   = aws_api_gateway_rest_api.webqx.id
  stage_name    = var.environment

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      caller         = "$context.identity.caller"
      user           = "$context.identity.user"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      responseTime   = "$context.responseTime"
      error          = "$context.error.message"
      integrationError = "$context.integration.error"
    })
  }

  xray_tracing_enabled = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-stage"
  })
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.name_prefix}"
  retention_in_days = 14

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-logs"
  })
}

# CloudWatch alarms for API Gateway
resource "aws_cloudwatch_metric_alarm" "api_4xx_errors" {
  alarm_name          = "${var.name_prefix}-api-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = "120"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors API Gateway 4XX errors"
  alarm_actions       = []

  dimensions = {
    ApiName = aws_api_gateway_rest_api.webqx.name
    Stage   = aws_api_gateway_stage.webqx.stage_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${var.name_prefix}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "120"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors API Gateway 5XX errors"
  alarm_actions       = []

  dimensions = {
    ApiName = aws_api_gateway_rest_api.webqx.name
    Stage   = aws_api_gateway_stage.webqx.stage_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${var.name_prefix}-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = "120"
  statistic           = "Average"
  threshold           = "5000"
  alarm_description   = "This metric monitors API Gateway latency"
  alarm_actions       = []

  dimensions = {
    ApiName = aws_api_gateway_rest_api.webqx.name
    Stage   = aws_api_gateway_stage.webqx.stage_name
  }

  tags = var.tags
}

# API usage plan for rate limiting
resource "aws_api_gateway_usage_plan" "webqx" {
  name         = "${var.name_prefix}-usage-plan"
  description  = "Usage plan for WebQX Healthcare Platform"

  api_stages {
    api_id = aws_api_gateway_rest_api.webqx.id
    stage  = aws_api_gateway_stage.webqx.stage_name
  }

  quota_settings {
    limit  = 10000
    period = "DAY"
  }

  throttle_settings {
    rate_limit  = 100
    burst_limit = 200
  }

  tags = var.tags
}