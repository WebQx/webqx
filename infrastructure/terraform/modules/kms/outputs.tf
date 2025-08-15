output "general_kms_key_arn" {
  description = "ARN of the general KMS key"
  value       = aws_kms_key.webqx_general.arn
}

output "general_kms_key_id" {
  description = "ID of the general KMS key"
  value       = aws_kms_key.webqx_general.key_id
}

output "phi_kms_key_arn" {
  description = "ARN of the PHI KMS key"
  value       = aws_kms_key.webqx_phi.arn
}

output "phi_kms_key_id" {
  description = "ID of the PHI KMS key"
  value       = aws_kms_key.webqx_phi.key_id
}

output "general_kms_alias_arn" {
  description = "ARN of the general KMS key alias"
  value       = aws_kms_alias.webqx_general.arn
}

output "phi_kms_alias_arn" {
  description = "ARN of the PHI KMS key alias"
  value       = aws_kms_alias.webqx_phi.arn
}