variable "name_prefix" {
  description = "Name prefix for all resources"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for Lambda functions"
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group IDs for Lambda functions"
  type        = list(string)
}

variable "dynamodb_tables" {
  description = "DynamoDB table names"
  type        = map(string)
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}