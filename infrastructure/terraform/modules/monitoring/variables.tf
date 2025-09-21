variable "name_prefix" {
  description = "Name prefix for all resources"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "lambda_function_names" {
  description = "Map of Lambda function names"
  type        = map(string)
}

variable "dynamodb_table_names" {
  description = "Map of DynamoDB table names"
  type        = map(string)
}

variable "api_gateway_name" {
  description = "Name of the API Gateway"
  type        = string
}

variable "ecs_cluster_name" {
  description = "Name of the ECS cluster for monitoring"
  type        = string
  default     = ""
}

variable "alb_target_group_full_name" {
  description = "Full name of ALB target group for monitoring"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}