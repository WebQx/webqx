output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution.arn
}

output "healthcare_compliance_role_arn" {
  description = "ARN of the healthcare compliance role"
  value       = aws_iam_role.healthcare_compliance.arn
}

output "api_gateway_execution_role_arn" {
  description = "ARN of the API Gateway execution role"
  value       = aws_iam_role.api_gateway_execution.arn
}

output "healthcare_data_processor_role_arn" {
  description = "ARN of the healthcare data processor role"
  value       = aws_iam_role.healthcare_data_processor.arn
}