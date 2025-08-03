# Security Guide for GitHub Webhooks

This guide covers security best practices and considerations for the WebQX GitHub webhook integration with AWS Lambda.

## Security Overview

The webhook system implements multiple layers of security to protect against:
- **Unauthorized access** - Only GitHub can trigger webhooks
- **Man-in-the-middle attacks** - HTTPS encryption and signature verification
- **Replay attacks** - Timestamp validation and request uniqueness
- **Data exposure** - Sensitive data filtering and secure logging
- **Resource abuse** - Rate limiting and timeout controls

## Core Security Features

### 1. Webhook Signature Verification

#### HMAC-SHA256 Signatures
All webhook payloads are verified using HMAC-SHA256 signatures:

```javascript
// Signature verification process
const crypto = require('crypto');

function validateWebhookSignature(payload, signature, secret) {
    const expectedSignature = signature.substring(7); // Remove "sha256=" prefix
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    const calculatedSignature = hmac.digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(calculatedSignature, 'hex')
    );
}
```

#### Best Practices for Webhook Secrets
- **Length**: Minimum 32 characters, recommend 64+
- **Randomness**: Use cryptographically secure random generation
- **Storage**: Store in AWS Secrets Manager or Parameter Store
- **Rotation**: Rotate every 90 days or when compromised
- **Access**: Limit access to webhook secret to necessary personnel only

```bash
# Generate secure webhook secret
openssl rand -hex 32

# Store in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "webqx/github/webhook-secret" \
  --description "GitHub webhook secret for WebQX platform" \
  --secret-string "your-secure-random-secret"
```

### 2. API Gateway Security

#### HTTPS Only
- All webhook endpoints use HTTPS/TLS 1.2+
- HTTP requests are automatically redirected to HTTPS
- Strong cipher suites enforced

#### Request Validation
```yaml
# API Gateway request validation
RequestValidator:
  Type: AWS::ApiGateway::RequestValidator
  Properties:
    RestApiId: !Ref WebhookApi
    ValidateRequestBody: true
    ValidateRequestParameters: true
```

#### Rate Limiting
```yaml
# Throttling configuration
ThrottleSettings:
  RateLimit: 100  # requests per second
  BurstLimit: 200 # burst capacity
```

### 3. Lambda Function Security

#### IAM Permissions (Principle of Least Privilege)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

#### Environment Variables Security
- Sensitive values encrypted at rest using AWS KMS
- No secrets in Lambda code or CloudFormation templates
- Runtime encryption for environment variables

```yaml
# KMS encryption for environment variables
Environment:
  Variables:
    WEBHOOK_SECRET: !Ref WebhookSecret
  KmsKeyArn: !GetAtt LambdaKMSKey.Arn
```

#### VPC Configuration (Optional)
For enhanced security, run Lambda in private VPC:

```yaml
VpcConfig:
  SecurityGroupIds:
    - !Ref LambdaSecurityGroup
  SubnetIds:
    - !Ref PrivateSubnet1
    - !Ref PrivateSubnet2
```

### 4. Input Validation and Sanitization

#### Payload Validation
```javascript
function validateWebhookPayload(payload) {
    const errors = [];
    
    // Required fields
    if (!payload.repository) {
        errors.push('Repository information is required');
    }
    
    if (!payload.sender) {
        errors.push('Sender information is required');
    }
    
    // Validate repository structure
    if (payload.repository && !payload.repository.full_name) {
        errors.push('Repository full_name is required');
    }
    
    return { isValid: errors.length === 0, errors };
}
```

#### Data Sanitization
```javascript
function sanitizePayloadForLogging(payload) {
    const sanitized = JSON.parse(JSON.stringify(payload));
    
    // Remove sensitive fields
    const sensitiveFields = [
        'installation.access_tokens_url',
        'repository.clone_url',
        'repository.ssh_url'
    ];
    
    sensitiveFields.forEach(field => {
        const parts = field.split('.');
        let obj = sanitized;
        for (let i = 0; i < parts.length - 1; i++) {
            if (obj[parts[i]]) obj = obj[parts[i]];
            else return;
        }
        if (obj[parts[parts.length - 1]]) {
            obj[parts[parts.length - 1]] = '[REDACTED]';
        }
    });
    
    return sanitized;
}
```

### 5. Secure Logging

#### Log Sanitization
- Remove sensitive data before logging
- Use structured logging with consistent fields
- Implement log retention policies

```javascript
function secureLog(level, message, data = {}) {
    const sanitizedData = sanitizePayloadForLogging(data);
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        requestId: context.awsRequestId,
        data: sanitizedData
    };
    
    console.log(JSON.stringify(logEntry));
}
```

#### CloudWatch Security
```yaml
# Log group with encryption
WebhookLogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: !Sub '/aws/lambda/webqx-github-webhooks-${Environment}'
    RetentionInDays: 14
    KmsKeyId: !GetAtt LogsKMSKey.Arn
```

## Advanced Security Configurations

### 1. AWS WAF Integration

Protect API Gateway with AWS WAF:

```yaml
WebACL:
  Type: AWS::WAFv2::WebACL
  Properties:
    Name: !Sub 'webqx-webhooks-waf-${Environment}'
    Scope: REGIONAL
    DefaultAction:
      Allow: {}
    Rules:
      - Name: RateLimitRule
        Priority: 1
        Statement:
          RateBasedStatement:
            Limit: 1000
            AggregateKeyType: IP
        Action:
          Block: {}
      - Name: IPWhitelistRule
        Priority: 2
        Statement:
          IPSetReferenceStatement:
            Arn: !GetAtt GitHubIPSet.Arn
        Action:
          Allow: {}
```

### 2. GitHub IP Whitelist

Restrict access to GitHub's webhook IP ranges:

```yaml
GitHubIPSet:
  Type: AWS::WAFv2::IPSet
  Properties:
    Name: GitHubWebhookIPs
    Scope: REGIONAL
    IPAddressVersion: IPV4
    Addresses:
      - "140.82.112.0/20"   # GitHub webhook IPs
      - "185.199.108.0/22"
      - "192.30.252.0/22"
      - "143.55.64.0/20"
```

### 3. API Key Authentication

Add additional API key layer:

```yaml
ApiKey:
  Type: AWS::ApiGateway::ApiKey
  Properties:
    Name: !Sub 'webqx-webhooks-key-${Environment}'
    Description: 'API key for WebQX GitHub webhooks'
    Enabled: true

UsagePlan:
  Type: AWS::ApiGateway::UsagePlan
  Properties:
    UsagePlanName: !Sub 'webqx-webhooks-plan-${Environment}'
    ApiStages:
      - ApiId: !Ref WebhookApi
        Stage: !Ref Environment
    Throttle:
      RateLimit: 100
      BurstLimit: 200
    Quota:
      Limit: 10000
      Period: DAY
```

### 4. Network Security

#### VPC Endpoints
Use VPC endpoints for AWS service communication:

```yaml
# VPC Endpoint for CloudWatch Logs
CloudWatchLogsEndpoint:
  Type: AWS::EC2::VPCEndpoint
  Properties:
    VpcId: !Ref VPC
    ServiceName: !Sub 'com.amazonaws.${AWS::Region}.logs'
    VpcEndpointType: Interface
    SubnetIds:
      - !Ref PrivateSubnet1
      - !Ref PrivateSubnet2
```

#### Security Groups
```yaml
LambdaSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Security group for webhook Lambda function
    VpcId: !Ref VPC
    SecurityGroupEgress:
      - IpProtocol: tcp
        FromPort: 443
        ToPort: 443
        CidrIp: 0.0.0.0/0  # HTTPS outbound for AWS APIs
        Description: Allow HTTPS outbound
```

## Security Monitoring

### 1. CloudWatch Alarms

Set up security-focused alarms:

```yaml
# Failed authentication attempts
AuthFailureAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub 'webqx-webhooks-auth-failures-${Environment}'
    AlarmDescription: 'High number of authentication failures'
    MetricName: 4XXError
    Namespace: AWS/ApiGateway
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 2
    Threshold: 10
    ComparisonOperator: GreaterThanThreshold

# Unusual traffic patterns
HighVolumeAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub 'webqx-webhooks-high-volume-${Environment}'
    AlarmDescription: 'Unusually high webhook volume'
    MetricName: Count
    Namespace: AWS/ApiGateway
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 1
    Threshold: 1000
    ComparisonOperator: GreaterThanThreshold
```

### 2. AWS CloudTrail

Enable API call logging:

```yaml
CloudTrail:
  Type: AWS::CloudTrail::Trail
  Properties:
    TrailName: !Sub 'webqx-webhooks-trail-${Environment}'
    S3BucketName: !Ref CloudTrailBucket
    IncludeGlobalServiceEvents: true
    IsLogging: true
    IsMultiRegionTrail: true
    EnableLogFileValidation: true
```

### 3. AWS Config

Monitor configuration compliance:

```yaml
ConfigRule:
  Type: AWS::Config::ConfigRule
  Properties:
    ConfigRuleName: lambda-function-security-check
    Source:
      Owner: AWS
      SourceIdentifier: LAMBDA_FUNCTION_PUBLIC_ACCESS_PROHIBITED
```

## Incident Response

### 1. Security Incident Procedures

#### Immediate Response
1. **Identify the threat** - Check CloudWatch logs and alarms
2. **Isolate affected resources** - Disable webhook if necessary
3. **Assess impact** - Determine scope of potential data exposure
4. **Contain the incident** - Block malicious IPs, rotate secrets

#### Investigation Steps
```bash
# Check recent webhook deliveries
aws logs filter-log-events \
  --log-group-name /aws/lambda/webqx-github-webhooks-prod \
  --filter-pattern "ERROR" \
  --start-time $(date -d '24 hours ago' +%s)000

# Review API Gateway access logs
aws logs filter-log-events \
  --log-group-name API-Gateway-Execution-Logs_${API_ID}/prod \
  --filter-pattern "401" \
  --start-time $(date -d '24 hours ago' +%s)000

# Check CloudTrail for unusual API calls
aws logs filter-log-events \
  --log-group-name CloudTrail/webqx-webhooks \
  --filter-pattern "UpdateFunctionConfiguration" \
  --start-time $(date -d '24 hours ago' +%s)000
```

### 2. Recovery Procedures

#### Secret Rotation
```bash
# Generate new webhook secret
NEW_SECRET=$(openssl rand -hex 32)

# Update AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id "webqx/github/webhook-secret" \
  --secret-string "$NEW_SECRET"

# Update Lambda environment
aws lambda update-function-configuration \
  --function-name webqx-github-webhooks-prod \
  --environment Variables="{WEBHOOK_SECRET=$NEW_SECRET}"

# Update GitHub webhook
# (Manual step in GitHub UI or via API)
```

#### Function Rollback
```bash
# List function versions
aws lambda list-versions-by-function \
  --function-name webqx-github-webhooks-prod

# Rollback to previous version
aws lambda update-alias \
  --function-name webqx-github-webhooks-prod \
  --name LIVE \
  --function-version 2
```

## Compliance Considerations

### HIPAA Compliance (for Healthcare Data)

1. **Data Encryption**
   - Encrypt data in transit (HTTPS/TLS)
   - Encrypt data at rest (KMS encryption)
   - Use encrypted log groups

2. **Access Controls**
   - Role-based access control (RBAC)
   - Multi-factor authentication (MFA)
   - Audit trail for all access

3. **Data Handling**
   - Sanitize logs to remove PHI
   - Implement data retention policies
   - Secure data disposal procedures

### SOC 2 Compliance

1. **Security Controls**
   - Regular security assessments
   - Vulnerability management
   - Incident response procedures

2. **Availability Controls**
   - Monitoring and alerting
   - Disaster recovery planning
   - Backup and restore procedures

3. **Processing Integrity**
   - Input validation
   - Error handling
   - Data quality checks

## Security Checklist

Use this checklist to ensure proper security configuration:

### Deployment Security
- [ ] Strong webhook secret (32+ characters)
- [ ] Secrets stored in AWS Secrets Manager
- [ ] HTTPS-only API Gateway
- [ ] IAM roles follow least privilege
- [ ] Lambda environment variables encrypted
- [ ] CloudWatch log groups encrypted
- [ ] API Gateway request validation enabled
- [ ] Rate limiting configured

### Runtime Security
- [ ] Webhook signature verification working
- [ ] Input validation implemented
- [ ] Error handling prevents information disclosure
- [ ] Logs sanitized for sensitive data
- [ ] Timeout controls in place

### Monitoring Security
- [ ] CloudWatch alarms for errors and authentication failures
- [ ] CloudTrail logging enabled
- [ ] Security-focused dashboards created
- [ ] Incident response procedures documented
- [ ] Regular security reviews scheduled

### Compliance Security
- [ ] Data encryption at rest and in transit
- [ ] Access controls implemented
- [ ] Audit logging configured
- [ ] Data retention policies defined
- [ ] Incident response plan tested

## Additional Resources

- [AWS Lambda Security Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/lambda-security.html)
- [API Gateway Security](https://docs.aws.amazon.com/apigateway/latest/developerguide/security.html)
- [GitHub Webhook Security](https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks)
- [OWASP Serverless Top 10](https://owasp.org/www-project-serverless-top-10/)
- [AWS Security Best Practices](https://aws.amazon.com/architecture/security-identity-compliance/)