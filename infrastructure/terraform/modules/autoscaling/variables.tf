variable "name_prefix" {
  description = "Name prefix for all resources"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "api_service_name" {
  description = "Name of the API ECS service"
  type        = string
}

variable "telehealth_service_name" {
  description = "Name of the telehealth ECS service"
  type        = string
}

variable "api_target_group_full_name" {
  description = "Full name of the API target group for ALB metrics"
  type        = string
}

variable "telehealth_target_group_full_name" {
  description = "Full name of the telehealth target group for ALB metrics"
  type        = string
}

variable "sns_kms_key_id" {
  description = "KMS key ID for SNS topic encryption"
  type        = string
}

# API Service Auto Scaling Configuration
variable "api_min_capacity" {
  description = "Minimum number of API service tasks"
  type        = number
  default     = 2
}

variable "api_max_capacity" {
  description = "Maximum number of API service tasks"
  type        = number
  default     = 20
}

variable "api_cpu_target_value" {
  description = "Target CPU utilization percentage for API service"
  type        = number
  default     = 70.0
}

variable "api_memory_target_value" {
  description = "Target memory utilization percentage for API service"
  type        = number
  default     = 75.0
}

variable "api_request_count_target_value" {
  description = "Target request count per minute for API service"
  type        = number
  default     = 1000.0
}

# Telehealth Service Auto Scaling Configuration
variable "telehealth_min_capacity" {
  description = "Minimum number of telehealth service tasks"
  type        = number
  default     = 2
}

variable "telehealth_max_capacity" {
  description = "Maximum number of telehealth service tasks"
  type        = number
  default     = 15
}

variable "telehealth_cpu_target_value" {
  description = "Target CPU utilization percentage for telehealth service"
  type        = number
  default     = 70.0
}

variable "telehealth_memory_target_value" {
  description = "Target memory utilization percentage for telehealth service"
  type        = number
  default     = 75.0
}

variable "telehealth_request_count_target_value" {
  description = "Target request count per minute for telehealth service"
  type        = number
  default     = 500.0
}

# Healthcare-specific thresholds
variable "high_patient_load_threshold" {
  description = "Threshold for active patient sessions to trigger scaling"
  type        = number
  default     = 50
}

variable "high_video_sessions_threshold" {
  description = "Threshold for active video sessions to trigger scaling"
  type        = number
  default     = 25
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}