variable "name_prefix" {
  description = "Name prefix for all resources"
  type        = string
}

variable "dynamodb_table_arns" {
  description = "ARNs of DynamoDB tables"
  type        = map(string)
}

variable "s3_bucket_arns" {
  description = "ARNs of S3 buckets"
  type        = map(string)
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}