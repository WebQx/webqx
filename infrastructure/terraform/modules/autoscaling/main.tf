# Auto Scaling Configuration for WebQX Healthcare Platform
# Implements CloudWatch-triggered auto scaling for ECS services

# Auto Scaling Target for API Service
resource "aws_appautoscaling_target" "api_target" {
  max_capacity       = var.api_max_capacity
  min_capacity       = var.api_min_capacity
  resource_id        = "service/${var.cluster_name}/${var.api_service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-autoscaling-target"
    Type = "AutoScaling"
  })
}

# Auto Scaling Target for Telehealth Service
resource "aws_appautoscaling_target" "telehealth_target" {
  max_capacity       = var.telehealth_max_capacity
  min_capacity       = var.telehealth_min_capacity
  resource_id        = "service/${var.cluster_name}/${var.telehealth_service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-telehealth-autoscaling-target"
    Type = "AutoScaling"
  })
}

# CPU-based Auto Scaling Policy for API Service - Scale Up
resource "aws_appautoscaling_policy" "api_scale_up_cpu" {
  name               = "${var.name_prefix}-api-scale-up-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api_target.resource_id
  scalable_dimension = aws_appautoscaling_target.api_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    
    target_value       = var.api_cpu_target_value
    scale_out_cooldown = 300
    scale_in_cooldown  = 300
  }
}

# Memory-based Auto Scaling Policy for API Service
resource "aws_appautoscaling_policy" "api_scale_up_memory" {
  name               = "${var.name_prefix}-api-scale-up-memory"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api_target.resource_id
  scalable_dimension = aws_appautoscaling_target.api_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    
    target_value       = var.api_memory_target_value
    scale_out_cooldown = 300
    scale_in_cooldown  = 300
  }
}

# Request Count-based Auto Scaling Policy for API Service
resource "aws_appautoscaling_policy" "api_scale_up_requests" {
  name               = "${var.name_prefix}-api-scale-up-requests"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api_target.resource_id
  scalable_dimension = aws_appautoscaling_target.api_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = var.api_target_group_full_name
    }
    
    target_value       = var.api_request_count_target_value
    scale_out_cooldown = 180  # Faster scaling for request spikes
    scale_in_cooldown  = 300
  }
}

# CPU-based Auto Scaling Policy for Telehealth Service
resource "aws_appautoscaling_policy" "telehealth_scale_up_cpu" {
  name               = "${var.name_prefix}-telehealth-scale-up-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.telehealth_target.resource_id
  scalable_dimension = aws_appautoscaling_target.telehealth_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.telehealth_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    
    target_value       = var.telehealth_cpu_target_value
    scale_out_cooldown = 300
    scale_in_cooldown  = 300
  }
}

# Memory-based Auto Scaling Policy for Telehealth Service
resource "aws_appautoscaling_policy" "telehealth_scale_up_memory" {
  name               = "${var.name_prefix}-telehealth-scale-up-memory"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.telehealth_target.resource_id
  scalable_dimension = aws_appautoscaling_target.telehealth_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.telehealth_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    
    target_value       = var.telehealth_memory_target_value
    scale_out_cooldown = 300
    scale_in_cooldown  = 300
  }
}

# Request Count-based Auto Scaling Policy for Telehealth Service
resource "aws_appautoscaling_policy" "telehealth_scale_up_requests" {
  name               = "${var.name_prefix}-telehealth-scale-up-requests"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.telehealth_target.resource_id
  scalable_dimension = aws_appautoscaling_target.telehealth_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.telehealth_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = var.telehealth_target_group_full_name
    }
    
    target_value       = var.telehealth_request_count_target_value
    scale_out_cooldown = 180  # Faster scaling for request spikes
    scale_in_cooldown  = 300
  }
}

# Custom CloudWatch Metric for Healthcare-specific scaling
resource "aws_cloudwatch_metric_alarm" "api_high_patient_load" {
  alarm_name          = "${var.name_prefix}-api-high-patient-load"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ActivePatientSessions"
  namespace           = "WebQX/Healthcare"
  period              = 120
  statistic           = "Average"
  threshold           = var.high_patient_load_threshold
  alarm_description   = "High patient load detected - trigger scaling"
  alarm_actions       = [aws_appautoscaling_policy.api_scale_up_cpu.arn]

  dimensions = {
    ServiceName = var.api_service_name
  }

  tags = merge(var.tags, {
    Type = "AutoScaling"
    Purpose = "PatientLoad"
    DataClass = "PHI"
  })
}

# CloudWatch Metric for Video Session Count
resource "aws_cloudwatch_metric_alarm" "telehealth_high_video_sessions" {
  alarm_name          = "${var.name_prefix}-telehealth-high-video-sessions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ActiveVideoSessions"
  namespace           = "WebQX/Telehealth"
  period              = 120
  statistic           = "Average"
  threshold           = var.high_video_sessions_threshold
  alarm_description   = "High video session count - trigger scaling"
  alarm_actions       = [aws_appautoscaling_policy.telehealth_scale_up_cpu.arn]

  dimensions = {
    ServiceName = var.telehealth_service_name
  }

  tags = merge(var.tags, {
    Type = "AutoScaling"
    Purpose = "VideoSessions"
    DataClass = "PHI"
  })
}

# SNS Topic for Auto Scaling Notifications
resource "aws_sns_topic" "autoscaling_notifications" {
  name = "${var.name_prefix}-autoscaling-notifications"

  # Enable encryption for HIPAA compliance
  kms_master_key_id = var.sns_kms_key_id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-autoscaling-notifications"
    Type = "AutoScaling"
    DataClass = "HIPAA"
  })
}

# SNS Topic Policy for encrypted communication
resource "aws_sns_topic_policy" "autoscaling_notifications_policy" {
  arn = aws_sns_topic.autoscaling_notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "autoscaling.amazonaws.com"
        }
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.autoscaling_notifications.arn
        Condition = {
          StringEquals = {
            "sns:Protocol" = ["https", "sqs"]
          }
        }
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "application-autoscaling.amazonaws.com"
        }
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.autoscaling_notifications.arn
      }
    ]
  })
}