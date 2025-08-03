# S3 Buckets for WebQX Healthcare Platform

# Patient Documents Bucket
resource "aws_s3_bucket" "patient_documents" {
  bucket = "${var.name_prefix}-patient-documents"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-patient-documents"
    Type = "PHI"
    DataClass = "HIPAA"
  })
}

resource "aws_s3_bucket_versioning" "patient_documents" {
  bucket = aws_s3_bucket.patient_documents.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "patient_documents" {
  bucket = aws_s3_bucket.patient_documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "patient_documents" {
  bucket = aws_s3_bucket.patient_documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Medical Images Bucket (DICOM, X-rays, etc.)
resource "aws_s3_bucket" "medical_images" {
  bucket = "${var.name_prefix}-medical-images"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-medical-images"
    Type = "PHI"
    DataClass = "HIPAA"
  })
}

resource "aws_s3_bucket_versioning" "medical_images" {
  bucket = aws_s3_bucket.medical_images.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "medical_images" {
  bucket = aws_s3_bucket.medical_images.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "medical_images" {
  bucket = aws_s3_bucket.medical_images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Application Backups Bucket
resource "aws_s3_bucket" "backups" {
  bucket = "${var.name_prefix}-backups"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-backups"
    Type = "Backup"
  })
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "backup_lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = 2555  # ~7 years for HIPAA compliance
    }
  }
}

# Audit Logs Bucket
resource "aws_s3_bucket" "audit_logs" {
  bucket = "${var.name_prefix}-audit-logs"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-audit-logs"
    Type = "Audit"
    DataClass = "HIPAA"
  })
}

resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Static Website Assets Bucket
resource "aws_s3_bucket" "static_assets" {
  bucket = "${var.name_prefix}-static-assets"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-static-assets"
    Type = "Static"
  })
}

resource "aws_s3_bucket_versioning" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}