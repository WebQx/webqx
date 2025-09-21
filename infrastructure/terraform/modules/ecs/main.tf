# ECS/Fargate Module for WebQX Healthcare Platform
# Provides containerized workloads that can auto-scale

# ECS Cluster
resource "aws_ecs_cluster" "webqx" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-ecs-cluster"
    Type = "ECS"
  })
}

# ECS Cluster Capacity Provider
resource "aws_ecs_cluster_capacity_providers" "webqx" {
  cluster_name = aws_ecs_cluster.webqx.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# Task Definition for WebQX Healthcare API
resource "aws_ecs_task_definition" "webqx_api" {
  family                   = "${var.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = var.api_cpu
  memory                  = var.api_memory
  execution_role_arn      = var.ecs_execution_role_arn
  task_role_arn          = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name  = "webqx-api"
      image = var.api_image
      
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "HIPAA_COMPLIANCE_MODE"
          value = "true"
        },
        {
          name  = "ENCRYPTION_AT_REST"
          value = "true"
        },
        {
          name  = "TLS_VERSION"
          value = "1.3"
        }
      ]

      secrets = [
        {
          name      = "JWT_SECRET"
          valueFrom = var.jwt_secret_arn
        },
        {
          name      = "DATABASE_URL"
          valueFrom = var.database_secret_arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/${var.name_prefix}/api"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      essential = true
    }
  ])

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-task"
    Type = "ECS-Task"
  })
}

# ECS Service for WebQX Healthcare API
resource "aws_ecs_service" "webqx_api" {
  name            = "${var.name_prefix}-api"
  cluster         = aws_ecs_cluster.webqx.id
  task_definition = aws_ecs_task_definition.webqx_api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "webqx-api"
    container_port   = 3000
  }

  # Enable auto-scaling
  depends_on = [var.load_balancer_listener_arn]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-service"
    Type = "ECS-Service"
  })
}

# CloudWatch Log Group for ECS
resource "aws_cloudwatch_log_group" "ecs_api" {
  name              = "/ecs/${var.name_prefix}/api"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-ecs-api-logs"
    Type = "ECS-Logs"
    DataClass = "HIPAA"
  })
}

# Task Definition for Telehealth Services
resource "aws_ecs_task_definition" "webqx_telehealth" {
  family                   = "${var.name_prefix}-telehealth"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = var.telehealth_cpu
  memory                  = var.telehealth_memory
  execution_role_arn      = var.ecs_execution_role_arn
  task_role_arn          = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name  = "webqx-telehealth"
      image = var.telehealth_image
      
      portMappings = [
        {
          containerPort = 3001
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "TELEHEALTH_DEPLOYMENT_MODE"
          value = "ecs"
        },
        {
          name  = "MATRIX_ENABLE_E2EE"
          value = "true"
        },
        {
          name  = "HIPAA_COMPLIANCE_MODE"
          value = "true"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/${var.name_prefix}/telehealth"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3001/health/telehealth || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      essential = true
    }
  ])

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-telehealth-task"
    Type = "ECS-Task"
  })
}

# ECS Service for Telehealth
resource "aws_ecs_service" "webqx_telehealth" {
  name            = "${var.name_prefix}-telehealth"
  cluster         = aws_ecs_cluster.webqx.id
  task_definition = aws_ecs_task_definition.webqx_telehealth.arn
  desired_count   = var.telehealth_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.telehealth_target_group_arn
    container_name   = "webqx-telehealth"
    container_port   = 3001
  }

  depends_on = [var.load_balancer_listener_arn]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-telehealth-service"
    Type = "ECS-Service"
  })
}

# CloudWatch Log Group for Telehealth
resource "aws_cloudwatch_log_group" "ecs_telehealth" {
  name              = "/ecs/${var.name_prefix}/telehealth"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-ecs-telehealth-logs"
    Type = "ECS-Logs"
    DataClass = "HIPAA"
  })
}