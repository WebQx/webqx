output "bucket_names" {
  description = "Names of all S3 buckets"
  value = {
    patient_documents = aws_s3_bucket.patient_documents.bucket
    medical_images    = aws_s3_bucket.medical_images.bucket
    backups          = aws_s3_bucket.backups.bucket
    audit_logs       = aws_s3_bucket.audit_logs.bucket
    static_assets    = aws_s3_bucket.static_assets.bucket
  }
}

output "bucket_arns" {
  description = "ARNs of all S3 buckets"
  value = {
    patient_documents = aws_s3_bucket.patient_documents.arn
    medical_images    = aws_s3_bucket.medical_images.arn
    backups          = aws_s3_bucket.backups.arn
    audit_logs       = aws_s3_bucket.audit_logs.arn
    static_assets    = aws_s3_bucket.static_assets.arn
  }
}