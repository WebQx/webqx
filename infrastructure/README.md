# WebQX Healthcare Platform - Infrastructure as Code

This directory contains Infrastructure as Code (IaC) configurations for deploying the WebQX Healthcare Platform. The primary deployment targets are container-based (Docker) on Railway (or equivalent container platforms). AWS-specific Serverless (Lambda, API Gateway, DynamoDB, CloudFormation) paths have been deprecated and removed from the active stack.

## 🏗️ Architecture Overview

The WebQX Healthcare Platform uses a containerized, microservices architecture designed for:
- HIPAA-grade controls: end-to-end encryption, audit logging, access controls
- Horizontal scalability via containers and queue-based processing
- High availability using platform-native scaling and health checks
- Security through network segmentation and least-privilege service accounts

### Core Platform Services

- Nginx: reverse proxy / TLS termination
- Django + DRF (PostgreSQL)
- OpenEMR (MariaDB)
- RabbitMQ + Celery (Redis broker)
- Redis: cache and Celery broker
- Whisper STT service
- Optional Keycloak for SSO

## 📁 Directory Structure

```
infrastructure/
├── terraform/           # Terraform configurations
│   ├── main.tf         # Main infrastructure definition
│   ├── variables.tf    # Input variables
│   ├── outputs.tf      # Output values
│   └── modules/        # Reusable Terraform modules
│       ├── vpc/        # VPC and networking
│       ├── vpc/        # (legacy AWS) VPC and networking (optional)
│       ├── security/   # Security groups / WAF (if applicable)
│       └── monitoring/ # Platform metrics/alerts (container focused)
└── scripts/            # Deployment scripts
  └── deploy-terraform.sh
```

## 🚀 Deployment Options

### Option 1: Docker + Railway (Recommended)

Best for: Teams wanting fast, managed container deployments.

Features:
- Simple Dockerfile-based deploys (Nginx, Django, OpenEMR, workers)
- Environment variables and secrets managed by the platform
- Built-in HTTP routing, TLS, health checks

Quick Start:
1) Build images locally and push or let Railway auto-build from repo
2) Configure environment variables (DB URLs, API_BASE, EMR_BASE)
3) Set up Postgres, Redis, RabbitMQ services
4) Point Nginx service to Django/OpenEMR backends

Note: AWS CloudFormation and Serverless Framework paths are retired in this repository to focus on the containerized stack.

## ⚙️ Configuration

### Environment Variables

Core application variables are documented in `.env.example`. For managed platforms, set them via the dashboard or CLI.

### Terraform (Optional)

If you maintain AWS infrastructure, keep Terraform focused on container runtimes and data stores. Remove Lambda/Dynamo/API Gateway modules.

## 🔒 Security & Compliance

### HIPAA Compliance Features

- **Encryption**: All data encrypted at rest and in transit
- **Audit Logging**: Comprehensive audit trails for all healthcare data access
- **Access Controls**: Role-based access with IAM policies
- **Network Security**: VPC isolation, security groups, NACLs
- **Data Retention**: Configurable retention policies for compliance

### Security Best Practices

1. **Least Privilege**: IAM roles with minimal required permissions
2. **Network Isolation**: Resources deployed in private subnets
3. **WAF Protection**: Web Application Firewall for API endpoints
4. **Secrets Management**: Sensitive data stored in AWS Secrets Manager
5. **Monitoring**: Real-time security monitoring and alerting

## 📊 Monitoring & Logging

### Platform Monitoring

Dashboards should cover:
- App latency and error rate
- Worker queue depth and processing times
- Database health and slow queries

### Audit Logging

Healthcare-specific audit logging includes:
- PHI access tracking
- User authentication events
- Data modification logs
- System security events

### Alerts

Automated alerts for:
- High error rates
- Performance degradation
- Security violations
- HIPAA compliance issues

## 🧪 Testing

### Infrastructure Testing

If using Terraform, run `terraform validate` and `terraform plan` within `infrastructure/terraform`.

### Integration Testing

```bash
# Run infrastructure tests
npm run test:infrastructure

# Run API endpoint tests
npm run test:api

# Run security compliance tests
npm run test:security
```

## 🔄 CI/CD Integration

### GitHub Actions

CI/CD can validate builds, run tests, and deploy containers to Railway or similar.

### Example Workflow

```yaml
name: Deploy Infrastructure
on:
  push:
    branches: [main]
    paths: ['infrastructure/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy Terraform
        run: ./infrastructure/scripts/deploy-terraform.sh prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## 🚨 Troubleshooting

### Common Issues

**Terraform State Conflicts**:
```bash
# Force unlock state
terraform force-unlock <lock-id>

# Import existing resources
terraform import aws_dynamodb_table.patients webqx-dev-patients
```

Remove serverless-specific troubleshooting; focus on container health checks and logs.

### Support Resources

- **Documentation**: Comprehensive guides in `/docs`
- **Examples**: Sample configurations in `/examples`
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions

## 📄 Cost Optimization

### Resource Sizing

Use modest container sizes initially; scale replicas horizontally. Set retention on logs and metrics to control cost.

### Monitoring Costs

```bash
# Check AWS costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-02-01 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Set up billing alerts
aws budgets create-budget --account-id 123456789012 \
  --budget file://budget.json
```

## 🆕 Updates & Maintenance

### Regular Maintenance Tasks

1. **Security Updates**: Keep all dependencies current
2. **Backup Verification**: Test restore procedures monthly
3. **Access Review**: Audit user permissions quarterly
4. **Compliance Audit**: Annual HIPAA compliance review

### Version Updates

- Update Terraform providers: `terraform init -upgrade`
- Keep Docker base images and packages patched

## 📞 Support

For technical support and questions:

- **GitHub Issues**: Bug reports and feature requests
- **Email**: infrastructure@webqx.health
- **Documentation**: https://docs.webqx.health
- **Community**: https://community.webqx.health

---

*WebQX Healthcare Platform - Infrastructure as Code*  
*Version 1.0.0 | Last Updated: January 2024*