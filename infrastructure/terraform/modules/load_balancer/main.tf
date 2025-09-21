# Application Load Balancer for WebQX Healthcare Platform
# HIPAA-compliant load balancer with SSL/TLS encryption

# Application Load Balancer
resource "aws_lb" "webqx" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.enable_deletion_protection

  # Enable access logs for audit trail
  access_logs {
    bucket  = var.access_logs_bucket
    prefix  = "alb"
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alb"
    Type = "LoadBalancer"
    DataClass = "HIPAA"
  })
}

# Target Group for API Service
resource "aws_lb_target_group" "api" {
  name        = "${var.name_prefix}-api-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-target-group"
    Type = "TargetGroup"
  })
}

# Target Group for Telehealth Service
resource "aws_lb_target_group" "telehealth" {
  name        = "${var.name_prefix}-telehealth-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health/telehealth"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-telehealth-target-group"
    Type = "TargetGroup"
  })
}

# HTTPS Listener for secure HIPAA-compliant communication
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.webqx.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.ssl_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  tags = var.tags
}

# HTTP Listener (redirect to HTTPS for security)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.webqx.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = var.tags
}

# Listener Rule for API paths
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/fhir/*", "/ehr/*"]
    }
  }

  tags = var.tags
}

# Listener Rule for Telehealth paths
resource "aws_lb_listener_rule" "telehealth" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.telehealth.arn
  }

  condition {
    path_pattern {
      values = ["/telehealth/*", "/video/*", "/messaging/*"]
    }
  }

  tags = var.tags
}

# WAF Web ACL for additional security
resource "aws_wafv2_web_acl" "webqx" {
  name  = "${var.name_prefix}-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rule to block common attacks
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

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

  # Rule to block known bad inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

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

  # Rate limiting rule for HIPAA compliance
  rule {
    name     = "RateLimitRule"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRuleMetric"
      sampled_requests_enabled   = true
    }
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-waf"
    Type = "WAF"
    DataClass = "HIPAA"
  })

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "webqxWAF"
    sampled_requests_enabled   = true
  }
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "webqx" {
  resource_arn = aws_lb.webqx.arn
  web_acl_arn  = aws_wafv2_web_acl.webqx.arn
}