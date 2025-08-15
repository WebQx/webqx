output "cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.webqx.id
}

output "cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.webqx.arn
}

output "cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.webqx.name
}

output "api_service_name" {
  description = "Name of the API ECS service"
  value       = aws_ecs_service.webqx_api.name
}

output "api_service_arn" {
  description = "ARN of the API ECS service"
  value       = aws_ecs_service.webqx_api.id
}

output "telehealth_service_name" {
  description = "Name of the telehealth ECS service"
  value       = aws_ecs_service.webqx_telehealth.name
}

output "telehealth_service_arn" {
  description = "ARN of the telehealth ECS service"
  value       = aws_ecs_service.webqx_telehealth.id
}

output "api_task_definition_arn" {
  description = "ARN of the API task definition"
  value       = aws_ecs_task_definition.webqx_api.arn
}

output "telehealth_task_definition_arn" {
  description = "ARN of the telehealth task definition"
  value       = aws_ecs_task_definition.webqx_telehealth.arn
}