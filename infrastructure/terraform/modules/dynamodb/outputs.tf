output "table_names" {
  description = "Names of all DynamoDB tables"
  value = {
    patients        = aws_dynamodb_table.patients.name
    appointments    = aws_dynamodb_table.appointments.name
    providers       = aws_dynamodb_table.providers.name
    medical_records = aws_dynamodb_table.medical_records.name
    lab_results     = aws_dynamodb_table.lab_results.name
    prescriptions   = aws_dynamodb_table.prescriptions.name
    audit_logs      = aws_dynamodb_table.audit_logs.name
    sessions        = aws_dynamodb_table.sessions.name
  }
}

output "table_arns" {
  description = "ARNs of all DynamoDB tables"
  value = {
    patients        = aws_dynamodb_table.patients.arn
    appointments    = aws_dynamodb_table.appointments.arn
    providers       = aws_dynamodb_table.providers.arn
    medical_records = aws_dynamodb_table.medical_records.arn
    lab_results     = aws_dynamodb_table.lab_results.arn
    prescriptions   = aws_dynamodb_table.prescriptions.arn
    audit_logs      = aws_dynamodb_table.audit_logs.arn
    sessions        = aws_dynamodb_table.sessions.arn
  }
}

output "stream_arns" {
  description = "Stream ARNs of DynamoDB tables"
  value = {
    patients        = aws_dynamodb_table.patients.stream_arn
    appointments    = aws_dynamodb_table.appointments.stream_arn
    providers       = aws_dynamodb_table.providers.stream_arn
    medical_records = aws_dynamodb_table.medical_records.stream_arn
    lab_results     = aws_dynamodb_table.lab_results.stream_arn
    prescriptions   = aws_dynamodb_table.prescriptions.stream_arn
    audit_logs      = aws_dynamodb_table.audit_logs.stream_arn
  }
}

output "backup_vault_arn" {
  description = "ARN of the backup vault"
  value       = aws_backup_vault.dynamodb.arn
}

output "backup_plan_arn" {
  description = "ARN of the backup plan"
  value       = aws_backup_plan.dynamodb.arn
}