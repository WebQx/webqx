output "api_autoscaling_target_arn" {
  description = "ARN of the API service auto scaling target"
  value       = aws_appautoscaling_target.api_target.arn
}

output "telehealth_autoscaling_target_arn" {
  description = "ARN of the telehealth service auto scaling target"
  value       = aws_appautoscaling_target.telehealth_target.arn
}

output "api_cpu_scaling_policy_arn" {
  description = "ARN of the API CPU-based scaling policy"
  value       = aws_appautoscaling_policy.api_scale_up_cpu.arn
}

output "api_memory_scaling_policy_arn" {
  description = "ARN of the API memory-based scaling policy"
  value       = aws_appautoscaling_policy.api_scale_up_memory.arn
}

output "api_request_scaling_policy_arn" {
  description = "ARN of the API request count-based scaling policy"
  value       = aws_appautoscaling_policy.api_scale_up_requests.arn
}

output "telehealth_cpu_scaling_policy_arn" {
  description = "ARN of the telehealth CPU-based scaling policy"
  value       = aws_appautoscaling_policy.telehealth_scale_up_cpu.arn
}

output "telehealth_memory_scaling_policy_arn" {
  description = "ARN of the telehealth memory-based scaling policy"
  value       = aws_appautoscaling_policy.telehealth_scale_up_memory.arn
}

output "telehealth_request_scaling_policy_arn" {
  description = "ARN of the telehealth request count-based scaling policy"
  value       = aws_appautoscaling_policy.telehealth_scale_up_requests.arn
}

output "autoscaling_notifications_topic_arn" {
  description = "ARN of the auto scaling notifications SNS topic"
  value       = aws_sns_topic.autoscaling_notifications.arn
}

output "high_patient_load_alarm_arn" {
  description = "ARN of the high patient load CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.api_high_patient_load.arn
}

output "high_video_sessions_alarm_arn" {
  description = "ARN of the high video sessions CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.telehealth_high_video_sessions.arn
}