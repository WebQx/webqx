variable "name_prefix" {
  description = "Name prefix for all resources"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "ecs_execution_role_arn" {
  description = "ECS task execution role ARN"
  type        = string
}

variable "ecs_task_role_arn" {
  description = "ECS task role ARN"
  type        = string
}

variable "load_balancer_listener_arn" {
  description = "Load balancer listener ARN for dependencies"
  type        = string
}

variable "target_group_arn" {
  description = "Target group ARN for API service"
  type        = string
}

variable "telehealth_target_group_arn" {
  description = "Target group ARN for telehealth service"
  type        = string
}

variable "jwt_secret_arn" {
  description = "ARN of JWT secret in AWS Secrets Manager"
  type        = string
}

variable "database_secret_arn" {
  description = "ARN of database secret in AWS Secrets Manager"
  type        = string
}

# API Service Configuration
variable "api_cpu" {
  description = "CPU units for API tasks (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memory for API tasks in MB"
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Desired number of API tasks"
  type        = number
  default     = 2
}

variable "api_image" {
  description = "Docker image for API service"
  type        = string
  default     = "webqx/healthcare-api:latest"
}

# Telehealth Service Configuration
variable "telehealth_cpu" {
  description = "CPU units for telehealth tasks"
  type        = number
  default     = 1024
}

variable "telehealth_memory" {
  description = "Memory for telehealth tasks in MB"
  type        = number
  default     = 2048
}

variable "telehealth_desired_count" {
  description = "Desired number of telehealth tasks"
  type        = number
  default     = 2
}

variable "telehealth_image" {
  description = "Docker image for telehealth service"
  type        = string
  default     = "webqx/telehealth:latest"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}