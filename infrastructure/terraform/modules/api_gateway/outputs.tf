output "api_id" {
  description = "ID of the API Gateway"
  value       = aws_api_gateway_rest_api.webqx.id
}

output "api_name" {
  description = "Name of the API Gateway"
  value       = aws_api_gateway_rest_api.webqx.name
}

output "api_url" {
  description = "URL of the API Gateway"
  value       = "https://${aws_api_gateway_rest_api.webqx.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_stage.webqx.stage_name}"
}

output "stage_name" {
  description = "Stage name of the API Gateway"
  value       = aws_api_gateway_stage.webqx.stage_name
}

output "deployment_id" {
  description = "Deployment ID of the API Gateway"
  value       = aws_api_gateway_deployment.webqx.id
}

output "usage_plan_id" {
  description = "Usage plan ID"
  value       = aws_api_gateway_usage_plan.webqx.id
}

# Data source for current region
data "aws_region" "current" {}