variable "name_prefix" {
  description = "Name prefix for all resources"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the load balancer will be created"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for the load balancer"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID for the application load balancer"
  type        = string
}

variable "ssl_certificate_arn" {
  description = "ARN of the SSL certificate for HTTPS"
  type        = string
}

variable "access_logs_bucket" {
  description = "S3 bucket name for ALB access logs"
  type        = string
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for the load balancer"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}