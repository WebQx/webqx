# Monitoring and Logging for WebQX Healthcare Platform

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application_logs" {
  name              = "/aws/webqx/${var.name_prefix}/application"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-application-logs"
    Type = "Application"
  })
}

resource "aws_cloudwatch_log_group" "audit_logs" {
  name              = "/aws/webqx/${var.name_prefix}/audit"
  retention_in_days = 2555  # ~7 years for HIPAA compliance

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-audit-logs"
    Type = "Audit"
    DataClass = "HIPAA"
  })
}

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.name_prefix}-alerts"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alerts"
    Type = "Alerts"
  })
}

# CloudWatch Alarms for Lambda functions
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = var.lambda_function_names

  alarm_name          = "${var.name_prefix}-lambda-errors-${each.key}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "120"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors lambda errors for ${each.key}"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = each.value
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  for_each = var.lambda_function_names

  alarm_name          = "${var.name_prefix}-lambda-duration-${each.key}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "120"
  statistic           = "Average"
  threshold           = "25000"  # 25 seconds
  alarm_description   = "This metric monitors lambda duration for ${each.key}"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = each.value
  }

  tags = var.tags
}

# CloudWatch Alarms for DynamoDB
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  for_each = var.dynamodb_table_names

  alarm_name          = "${var.name_prefix}-dynamodb-throttles-${each.key}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UserErrors"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB throttles for ${each.key}"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    TableName = each.value
  }

  tags = var.tags
}

# Custom metrics for healthcare compliance
resource "aws_cloudwatch_log_metric_filter" "phi_access" {
  name           = "${var.name_prefix}-phi-access"
  log_group_name = aws_cloudwatch_log_group.audit_logs.name
  pattern        = "[timestamp, request_id, user_id, action=\"PHI_ACCESS\", resource_type, resource_id]"

  metric_transformation {
    name      = "PHIAccessCount"
    namespace = "WebQX/Healthcare"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "phi_access_alarm" {
  alarm_name          = "${var.name_prefix}-high-phi-access"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "PHIAccessCount"
  namespace           = "WebQX/Healthcare"
  period              = "300"
  statistic           = "Sum"
  threshold           = "100"
  alarm_description   = "High volume of PHI access detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = merge(var.tags, {
    Type = "Security"
    DataClass = "PHI"
  })
}

# Custom metrics for failed login attempts
resource "aws_cloudwatch_log_metric_filter" "failed_logins" {
  name           = "${var.name_prefix}-failed-logins"
  log_group_name = aws_cloudwatch_log_group.audit_logs.name
  pattern        = "[timestamp, request_id, user_id, action=\"LOGIN_FAILED\"]"

  metric_transformation {
    name      = "FailedLoginCount"
    namespace = "WebQX/Security"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "failed_logins_alarm" {
  alarm_name          = "${var.name_prefix}-high-failed-logins"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FailedLoginCount"
  namespace           = "WebQX/Security"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "High number of failed login attempts detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = merge(var.tags, {
    Type = "Security"
  })
}

# CloudWatch Alarms for ECS Auto Scaling
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  count = var.ecs_cluster_name != "" ? 1 : 0

  alarm_name          = "${var.name_prefix}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "75"
  alarm_description   = "This metric monitors ECS cluster CPU utilization for auto-scaling"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
  }

  tags = merge(var.tags, {
    Type = "AutoScaling"
    Purpose = "ECS-CPU"
  })
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  count = var.ecs_cluster_name != "" ? 1 : 0

  alarm_name          = "${var.name_prefix}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS cluster memory utilization for auto-scaling"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
  }

  tags = merge(var.tags, {
    Type = "AutoScaling"
    Purpose = "ECS-Memory"
  })
}

# CloudWatch Alarms for ALB Request Count
resource "aws_cloudwatch_metric_alarm" "alb_request_count_high" {
  count = var.alb_target_group_full_name != "" ? 1 : 0

  alarm_name          = "${var.name_prefix}-alb-request-count-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RequestCountPerTarget"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1000"
  alarm_description   = "High request count per target - may trigger auto-scaling"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    TargetGroup = var.alb_target_group_full_name
  }

  tags = merge(var.tags, {
    Type = "AutoScaling"
    Purpose = "RequestCount"
  })
}

# CloudWatch Alarms for ALB Response Time
resource "aws_cloudwatch_metric_alarm" "alb_response_time_high" {
  count = var.alb_target_group_full_name != "" ? 1 : 0

  alarm_name          = "${var.name_prefix}-alb-response-time-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "2.0"
  alarm_description   = "High response time detected - may indicate need for scaling"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    TargetGroup = var.alb_target_group_full_name
  }

  tags = merge(var.tags, {
    Type = "AutoScaling"
    Purpose = "ResponseTime"
  })
}

# Enhanced Dashboard for WebQX Healthcare Platform with Auto-scaling Metrics
resource "aws_cloudwatch_dashboard" "webqx_dashboard" {
  dashboard_name = "${var.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            for name in keys(var.lambda_function_names) : [
              "AWS/Lambda", "Duration", "FunctionName", var.lambda_function_names[name]
            ]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Lambda Function Duration"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            for name in keys(var.lambda_function_names) : [
              "AWS/Lambda", "Errors", "FunctionName", var.lambda_function_names[name]
            ]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Lambda Function Errors"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", var.api_gateway_name],
            [".", "4XXError", ".", "."],
            [".", "5XXError", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "API Gateway Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["WebQX/Healthcare", "PHIAccessCount"],
            ["WebQX/Security", "FailedLoginCount"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Security Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 24
        width  = 12
        height = 6

        properties = {
          metrics = var.ecs_cluster_name != "" ? [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name],
            [".", "MemoryUtilization", ".", "."]
          ] : []
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "ECS Cluster Resource Utilization"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 30
        width  = 12
        height = 6

        properties = {
          metrics = var.alb_target_group_full_name != "" ? [
            ["AWS/ApplicationELB", "RequestCountPerTarget", "TargetGroup", var.alb_target_group_full_name],
            [".", "TargetResponseTime", ".", "."]
          ] : []
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Load Balancer Performance Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 36
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["WebQX/Healthcare", "ActivePatientSessions"],
            ["WebQX/Telehealth", "ActiveVideoSessions"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Healthcare Application Metrics"
          period  = 300
        }
      }
    ]
  })

  tags = var.tags
}

# Data source for current region
data "aws_region" "current" {}