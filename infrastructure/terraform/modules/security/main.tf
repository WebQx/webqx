# Security Groups for WebQX Healthcare Platform

# Security Group for Lambda functions
resource "aws_security_group" "lambda" {
  name        = "${var.name_prefix}-lambda-sg"
  description = "Security group for Lambda functions"
  vpc_id      = var.vpc_id

  # Outbound rules
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  # HTTPS outbound for external API calls
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound"
  }

  # HTTP outbound for internal services
  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "HTTP outbound to internal services"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-lambda-sg"
    Type = "Lambda"
  })
}

# Security Group for API Gateway (if using VPC endpoints)
resource "aws_security_group" "api_gateway" {
  name        = "${var.name_prefix}-api-gateway-sg"
  description = "Security group for API Gateway VPC endpoints"
  vpc_id      = var.vpc_id

  # Inbound HTTPS traffic
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS inbound"
  }

  # Outbound to Lambda functions
  egress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.lambda.id]
    description     = "Outbound to Lambda functions"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-gateway-sg"
    Type = "API Gateway"
  })
}

# Security Group for Database (if using RDS in future)
resource "aws_security_group" "database" {
  name        = "${var.name_prefix}-database-sg"
  description = "Security group for database instances"
  vpc_id      = var.vpc_id

  # PostgreSQL port from Lambda
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
    description     = "PostgreSQL from Lambda"
  }

  # MySQL port from Lambda (for legacy EHR integrations)
  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
    description     = "MySQL from Lambda"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-database-sg"
    Type = "Database"
  })
}

# Security Group for internal services
resource "aws_security_group" "internal_services" {
  name        = "${var.name_prefix}-internal-services-sg"
  description = "Security group for internal healthcare services"
  vpc_id      = var.vpc_id

  # Allow communication between internal services
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
    description = "Internal service communication"
  }

  # FHIR server communication
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
    description     = "FHIR server from Lambda"
  }

  # Keycloak authentication
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
    description     = "Keycloak auth from Lambda"
  }

  # Mirth Connect HL7 processing
  ingress {
    from_port       = 6661
    to_port         = 6661
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
    description     = "Mirth Connect from Lambda"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-internal-services-sg"
    Type = "Internal Services"
  })
}

# Security Group for monitoring and logging
resource "aws_security_group" "monitoring" {
  name        = "${var.name_prefix}-monitoring-sg"
  description = "Security group for monitoring and logging services"
  vpc_id      = var.vpc_id

  # CloudWatch logs
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "CloudWatch logs"
  }

  # X-Ray tracing
  egress {
    from_port   = 2000
    to_port     = 2000
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "X-Ray tracing"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-monitoring-sg"
    Type = "Monitoring"
  })
}

# WAF Web ACL for API Gateway (HIPAA compliance)
resource "aws_wafv2_web_acl" "api_protection" {
  name  = "${var.name_prefix}-api-protection"
  description = "WAF protection for WebQX Healthcare API"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }

    action {
      block {}
    }
  }

  # AWS Managed Rules - Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # SQL Injection protection
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLiRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-protection"
    Type = "WAF"
  })

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-api-protection"
    sampled_requests_enabled   = true
  }
}

# Network ACLs for additional security layers
resource "aws_network_acl" "private" {
  vpc_id     = var.vpc_id
  subnet_ids = []  # Will be associated with private subnets

  # Allow internal traffic
  ingress {
    rule_no    = 100
    protocol   = "-1"
    from_port  = 0
    to_port    = 0
    cidr_block = "10.0.0.0/8"
    action     = "allow"
  }

  # Allow HTTPS inbound
  ingress {
    rule_no    = 110
    protocol   = "tcp"
    from_port  = 443
    to_port    = 443
    cidr_block = "0.0.0.0/0"
    action     = "allow"
  }

  # Allow return traffic
  ingress {
    rule_no    = 120
    protocol   = "tcp"
    from_port  = 1024
    to_port    = 65535
    cidr_block = "0.0.0.0/0"
    action     = "allow"
  }

  # Allow all outbound
  egress {
    rule_no    = 100
    protocol   = "-1"
    from_port  = 0
    to_port    = 0
    cidr_block = "0.0.0.0/0"
    action     = "allow"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-nacl"
    Type = "Network ACL"
  })
}

# Security Group for Application Load Balancer
resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = var.vpc_id

  # HTTP inbound (will redirect to HTTPS)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP inbound"
  }

  # HTTPS inbound
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS inbound"
  }

  # Outbound to ECS tasks
  egress {
    from_port       = 3000
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
    description     = "HTTP to ECS tasks"
  }

  # Health check outbound
  egress {
    from_port       = 3000
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
    description     = "Health checks to ECS tasks"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alb-sg"
    Type = "LoadBalancer"
    DataClass = "HIPAA"
  })
}

# Security Group for ECS Tasks
resource "aws_security_group" "ecs" {
  name        = "${var.name_prefix}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  # HTTP inbound from ALB
  ingress {
    from_port       = 3000
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "HTTP from ALB"
  }

  # Allow communication between ECS tasks
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
    description = "Inter-task communication"
  }

  # HTTPS outbound for external API calls
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound"
  }

  # Database connectivity (for future RDS)
  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.database.id]
    description     = "PostgreSQL outbound"
  }

  # DynamoDB via HTTPS
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "DynamoDB access"
  }

  # CloudWatch Logs
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "CloudWatch Logs"
  }

  # Secrets Manager
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Secrets Manager"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-ecs-sg"
    Type = "ECS"
    DataClass = "HIPAA"
  })
}