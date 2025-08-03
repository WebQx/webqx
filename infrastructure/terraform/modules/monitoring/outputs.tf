output "log_group_names" {
  description = "Names of CloudWatch log groups"
  value = {
    application = aws_cloudwatch_log_group.application_logs.name
    audit      = aws_cloudwatch_log_group.audit_logs.name
  }
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.webqx_dashboard.dashboard_name}"
}