output "load_balancer_arn" {
  description = "ARN of the application load balancer"
  value       = aws_lb.webqx.arn
}

output "load_balancer_dns_name" {
  description = "DNS name of the application load balancer"
  value       = aws_lb.webqx.dns_name
}

output "load_balancer_zone_id" {
  description = "Hosted zone ID of the application load balancer"
  value       = aws_lb.webqx.zone_id
}

output "https_listener_arn" {
  description = "ARN of the HTTPS listener"
  value       = aws_lb_listener.https.arn
}

output "api_target_group_arn" {
  description = "ARN of the API target group"
  value       = aws_lb_target_group.api.arn
}

output "api_target_group_full_name" {
  description = "Full name of the API target group for ALB metrics"
  value       = aws_lb_target_group.api.arn_suffix
}

output "telehealth_target_group_arn" {
  description = "ARN of the telehealth target group"
  value       = aws_lb_target_group.telehealth.arn
}

output "telehealth_target_group_full_name" {
  description = "Full name of the telehealth target group for ALB metrics"
  value       = aws_lb_target_group.telehealth.arn_suffix
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.webqx.arn
}