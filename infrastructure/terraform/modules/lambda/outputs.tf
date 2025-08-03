output "function_names" {
  description = "Names of Lambda functions"
  value = {
    for name, func in aws_lambda_function.functions : name => func.function_name
  }
}

output "function_arns" {
  description = "ARNs of Lambda functions"
  value = {
    for name, func in aws_lambda_function.functions : name => func.arn
  }
}

output "function_invoke_arns" {
  description = "Invoke ARNs of Lambda functions"
  value = {
    for name, func in aws_lambda_function.functions : name => func.invoke_arn
  }
}

output "function_urls" {
  description = "Function URLs for Lambda functions"
  value = {
    for name, url in aws_lambda_function_url.function_urls : name => url.function_url
  }
}

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution.arn
}

output "common_layer_arn" {
  description = "ARN of the common Lambda layer"
  value       = aws_lambda_layer_version.webqx_common.arn
}