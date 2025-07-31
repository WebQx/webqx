# WebQX™ Keycloak-OpenEMR Integration - Quick Start Guide

This is a quick start guide to get the Keycloak-OpenEMR integration up and running in under 30 minutes.

## Prerequisites

- Docker and Docker Compose (recommended for quick setup)
- Node.js 16+ installed
- Basic understanding of OAuth2/OpenID Connect

## 🚀 Quick Setup (Docker)

### 1. Start Keycloak with Docker

```bash
# Create a docker-compose.yml file
cat > docker-compose.yml << EOF
version: '3.8'
services:
  keycloak:
    image: quay.io/keycloak/keycloak:15.0.2
    environment:
      DB_VENDOR: H2
      KEYCLOAK_USER: admin
      KEYCLOAK_PASSWORD: admin
    ports:
      - "8080:8080"
    command:
      - "-b"
      - "0.0.0.0"
EOF

# Start Keycloak
docker-compose up -d keycloak
```

### 2. Import WebQX Healthcare Realm

Wait for Keycloak to start (about 30 seconds), then:

```bash
# Access Keycloak Admin Console
open http://localhost:8080/auth/admin

# Login with admin/admin
# Import the realm configuration:
# 1. Click "Add realm"
# 2. Click "Select file" and choose config/keycloak/webqx-healthcare-realm.json
# 3. Click "Create"
```

### 3. Configure WebQX Platform

```bash
# Clone the repository (if you haven't already)
git clone https://github.com/WebQx/webqx.git
cd webqx

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update the Keycloak configuration in .env
cat >> .env << EOF

# Keycloak Quick Start Configuration
KEYCLOAK_URL=http://localhost:8080/auth
KEYCLOAK_REALM=webqx-healthcare
KEYCLOAK_CLIENT_ID=webqx-openemr
KEYCLOAK_CLIENT_SECRET=your-client-secret-here
EOF
```

### 4. Get the Client Secret

1. Go to Keycloak Admin Console: http://localhost:8080/auth/admin
2. Select the "webqx-healthcare" realm
3. Go to "Clients" → "webqx-openemr"
4. Go to "Credentials" tab
5. Copy the "Secret" value and update your `.env` file

### 5. Start WebQX Platform

```bash
npm start
```

Your WebQX platform should now be running at http://localhost:3000 with Keycloak integration enabled!

## 🧪 Test the Integration

### Create a Test User

1. Go to Keycloak Admin Console
2. Navigate to "Users" in the webqx-healthcare realm
3. Click "Add user"
4. Fill in the details:
   - Username: `test.provider`
   - Email: `provider@example.com`
   - First Name: `Test`
   - Last Name: `Provider`
   - Email Verified: `Yes`
5. Click "Save"
6. Go to "Credentials" tab and set a password
7. Go to "Role Mappings" tab and assign the `healthcare-provider` role

### Test Authentication

```bash
# Get an access token
curl -X POST "http://localhost:8080/auth/realms/webqx-healthcare/protocol/openid_connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=webqx-openemr" \
  -d "client_secret=your-client-secret" \
  -d "username=test.provider" \
  -d "password=yourpassword"

# Use the token to access WebQX API
curl -X GET "http://localhost:3000/api/health" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📋 Common Configurations

### Basic Provider Setup

For a healthcare provider with primary care specialty:

1. Create user in Keycloak
2. Assign roles: `healthcare-provider`, `primary-care-physician`
3. Add attributes:
   - `npi_number`: `1234567890`
   - `medical_license`: `MD123456`
   - `specialty`: `PRIMARY_CARE`
   - `provider_verification_status`: `VERIFIED`

### Basic Patient Setup

For a patient user:

1. Create user in Keycloak
2. Assign role: `patient`
3. No additional attributes required

### Basic Nurse Setup

For a nursing staff member:

1. Create user in Keycloak
2. Assign role: `nurse`
3. Add attributes:
   - `department`: `General Medicine`

## 🔧 Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `KEYCLOAK_URL` | Keycloak server URL | `http://localhost:8080/auth` |
| `KEYCLOAK_REALM` | Keycloak realm name | `webqx-healthcare` |
| `KEYCLOAK_CLIENT_ID` | OAuth2 client ID | `webqx-openemr` |
| `KEYCLOAK_CLIENT_SECRET` | OAuth2 client secret | Required |
| `KEYCLOAK_ENABLE_LOGGING` | Enable debug logging | `false` |
| `OPENEMR_BASE_URL` | OpenEMR server URL | Required for OpenEMR integration |
| `OPENEMR_ENABLE_TOKEN_EXCHANGE` | Enable token exchange | `true` |

## 🛡️ Security Notes

- **Change default passwords** in production
- **Use HTTPS** for all communications in production
- **Regenerate client secrets** before deploying to production
- **Review and customize** role mappings for your organization
- **Enable audit logging** for compliance requirements

## 📚 Next Steps

1. **Production Setup**: Follow the complete setup guide in [KEYCLOAK_OPENEMR_SETUP.md](./KEYCLOAK_OPENEMR_SETUP.md)
2. **OpenEMR Integration**: Configure OpenEMR to use Keycloak authentication
3. **User Management**: Set up automated user provisioning
4. **Monitoring**: Configure health checks and monitoring
5. **Backup**: Set up database and configuration backups

## 🆘 Troubleshooting

### Issue: "Connection refused" to Keycloak

**Solution**: Ensure Keycloak is running and accessible:
```bash
docker-compose ps
curl http://localhost:8080/auth/realms/webqx-healthcare/.well-known/openid_connect_configuration
```

### Issue: "Invalid client credentials"

**Solution**: Verify client secret is correct:
1. Check Keycloak Admin Console → Clients → webqx-openemr → Credentials
2. Update the secret in your `.env` file

### Issue: "Token validation failed"

**Solution**: Check token format and claims:
```bash
# Decode token at https://jwt.io to inspect claims
# Verify issuer and audience match your configuration
```

### Issue: "Access denied"

**Solution**: Check user roles and permissions:
1. Verify user has correct roles assigned in Keycloak
2. Check role mapping configuration in your application
3. Ensure provider verification status is set correctly

## 📞 Support

- **Documentation**: [Full Setup Guide](./KEYCLOAK_OPENEMR_SETUP.md)
- **GitHub Issues**: [Report Issues](https://github.com/WebQx/webqx/issues)
- **Community**: [WebQX Community Forum](https://community.webqx.health)

---

**⚡ Quick Commands Summary:**

```bash
# Start everything
docker-compose up -d
npm install
cp .env.example .env
# (configure .env)
npm start

# Test authentication
curl -X POST "http://localhost:8080/auth/realms/webqx-healthcare/protocol/openid_connect/token" \
  -d "grant_type=password&client_id=webqx-openemr&client_secret=SECRET&username=USER&password=PASS"

# Access API
curl -H "Authorization: Bearer TOKEN" "http://localhost:3000/api/health"
```

You should be up and running in minutes! 🎉