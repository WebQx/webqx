# WebQx Healthcare Platform Deployment System

This directory contains the automated deployment system for the WebQx Healthcare Platform, designed for seamless deployment to the WebQx.org domain with comprehensive CI/CD integration.

## 🚀 Quick Start

### Automated Deployment
```bash
# Deploy to production
./deploy.sh deploy

# Deploy to staging
DEPLOYMENT_ENV=staging ./deploy.sh deploy

# Run health checks only
./deploy.sh health-check

# Run smoke tests only
./deploy.sh test
```

### Rollback
```bash
# Rollback to previous version
./rollback.sh

# Or use the deploy script
./deploy.sh rollback
```

## 📁 Deployment Files

| File | Description |
|------|-------------|
| `deploy.sh` | Main deployment script with build, migration, and health checks |
| `rollback.sh` | Automated rollback script with verification |
| `.env.production` | Production environment configuration |
| `deployment.conf` | Deployment configuration and settings |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD pipeline |
| `migrations/` | Database migration scripts directory |

## 🔧 Features

### ✅ Build Process
- Automated dependency installation
- TypeScript compilation and type checking
- Static asset building
- Production optimizations

### ✅ Environment Configuration
- Environment-specific configuration loading
- Secure environment variable management
- Production vs staging configurations
- HIPAA-compliant security settings

### ✅ Deployment Steps
- Zero-downtime deployment strategy
- Process management with PM2 or systemd
- SSL/TLS certificate management
- Load balancer integration

### ✅ Database Migration
- Automated SQL migration execution
- Migration ordering and validation
- Rollback-safe transaction handling
- HIPAA-compliant audit trails

### ✅ Rollback Mechanism
- Automated backup creation
- One-command rollback capability
- Database rollback support
- Verification and health checks

### ✅ Testing & Health Checks
- Comprehensive health endpoint
- Smoke test automation
- FHIR endpoint validation
- Performance monitoring

### ✅ Logging & Monitoring
- Structured deployment logging
- Audit trail compliance
- Error tracking and alerting
- Performance metrics

### ✅ CI/CD Integration
- GitHub Actions workflows
- Automated testing pipeline
- Security scanning
- Multi-environment deployment

## 🌐 Deployment Environments

### Production (webqx.org)
- **Branch**: `main`
- **Trigger**: Push to main or manual deployment
- **URL**: https://webqx.org
- **Features**: Full production configuration, SSL, monitoring

### Staging (staging.webqx.org)
- **Branch**: `develop`
- **Trigger**: Push to develop or PR creation
- **URL**: https://staging.webqx.org
- **Features**: Production-like testing environment

## 🔐 Security & Compliance

### HIPAA Compliance
- ✅ Encryption at rest and in transit
- ✅ Audit logging (7+ year retention)
- ✅ Access controls and authentication
- ✅ Data minimization practices
- ✅ Secure backup procedures

### Security Features
- ✅ Vulnerability scanning
- ✅ Dependency auditing
- ✅ SSL/TLS enforcement
- ✅ Rate limiting
- ✅ Input validation

## 📊 Monitoring & Alerting

### Health Checks
```bash
# Check application health
curl https://webqx.org/health

# Expected response:
{
  "status": "healthy",
  "service": "WebQX Healthcare Platform",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 3600,
  "features": {
    "fhir": "enabled",
    "patient_portal": "enabled"
  }
}
```

### Monitoring Endpoints
- **Health**: `/health` - Application health status
- **Metrics**: `/metrics` - Performance metrics (if enabled)
- **FHIR**: `/fhir/metadata` - FHIR capability statement

## 🗃️ Database Management

### Migrations
```bash
# Create a new migration
cat > migrations/$(date +%Y%m%d_%H%M%S)_description.sql << 'EOF'
-- Migration: Description
-- Date: $(date)

BEGIN;
-- Your SQL here
COMMIT;
EOF

# Migrations run automatically during deployment
```

### Backup & Recovery
- Automated daily backups
- Point-in-time recovery capability
- Cross-region backup replication
- 30-day backup retention policy

## 🚨 Troubleshooting

### Common Issues

**Deployment fails with "Health check timeout"**
```bash
# Check application logs
tail -f /var/log/webqx-deployment.log

# Check application status
./deploy.sh health-check

# Manual health check
curl -v http://localhost:3000/health
```

**Database migration fails**
```bash
# Check migration status
psql $DATABASE_URL -c "SELECT * FROM schema_migrations;"

# Manual migration
psql $DATABASE_URL -f migrations/filename.sql
```

**Rollback needed**
```bash
# Immediate rollback
./rollback.sh

# Check rollback status
./deploy.sh health-check
```

### Log Locations
- **Deployment**: `/var/log/webqx-deployment.log`
- **Application**: `/var/log/webqx/application.log`
- **Rollback**: `/var/log/webqx-rollback.log`
- **Audit**: `/var/log/webqx/audit.log`

## 🔧 Configuration

### Environment Variables
Key environment variables for deployment:

```bash
# Required
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_here

# Optional
DOMAIN=webqx.org
SSL_ENABLED=true
MONITORING_ENABLED=true
```

### Secrets Management
Sensitive values are managed through:
- GitHub Secrets (for CI/CD)
- Environment variables (for runtime)
- External secret management systems (production)

## 📞 Support & Maintenance

### Deployment Team Contacts
- **DevOps Lead**: devops@webqx.org
- **Security Team**: security@webqx.org
- **Emergency**: emergency@webqx.org

### Maintenance Windows
- **Production**: Sundays 2:00-4:00 AM UTC
- **Staging**: Anytime
- **Emergency**: As needed with notifications

### Change Management
1. Create feature branch
2. Develop and test locally
3. Submit PR with deployment notes
4. Code review and approval
5. Merge to develop (auto-deploy to staging)
6. Test in staging environment
7. Merge to main (auto-deploy to production)
8. Monitor and verify deployment

## 📚 Additional Resources

- [WebQx Platform Documentation](../README.md)
- [FHIR R4 Integration Guide](../ehr-integrations/README-FHIR-R4.md)
- [HIPAA Compliance Guide](../legal/)
- [API Documentation](../patient-portal/docs/)

---

*"Deploying healthcare technology with precision, security, and care."* - WebQX™ DevOps Team