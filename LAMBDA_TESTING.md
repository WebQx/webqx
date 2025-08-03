# Quick Lambda Test Guide

Since some of the existing test infrastructure has configuration issues, here's a quick manual verification guide for the Lambda deployment:

## 🧪 Testing Lambda Components

### 1. Module Loading Test
```bash
cd /home/runner/work/webqx/webqx
node -e "
const app = require('./server-lambda.js');
const handler = require('./lambda-handler.js');
console.log('✅ Lambda modules loaded successfully');
console.log('✅ Express app type:', typeof app);
console.log('✅ Lambda handler type:', typeof handler.handler);
"
```

### 2. Build Verification
```bash
npm run lambda:build
ls -la lambda-build/
```

### 3. Package Creation (with dependencies)
```bash
npm run lambda:package
ls -la aws-deployment/
```

### 4. Local SAM Testing (if SAM CLI is available)
```bash
sam local start-api
# Test at http://localhost:3000/health
```

## 🚀 Deployment Process

### Option 1: Quick Deploy Script
```bash
chmod +x deploy-lambda.sh
./deploy-lambda.sh dev
```

### Option 2: Manual Deploy Steps
```bash
# 1. Build
npm run lambda:build

# 2. Package 
npm run lambda:package

# 3. Deploy infrastructure first
aws cloudformation create-stack \
  --stack-name webqx-infrastructure-dev \
  --template-body file://aws-deployment/infrastructure.yaml \
  --parameters ParameterKey=Environment,ParameterValue=dev \
               ParameterKey=DatabaseMasterPassword,ParameterValue=SecurePassword123! \
  --capabilities CAPABILITY_IAM

# 4. Deploy application
sam deploy --guided
```

## 📊 Verification

After deployment, test these endpoints:

1. **Health Check**: `GET /health`
2. **FHIR Metadata**: `GET /fhir/metadata`
3. **Translation API**: `POST /api/whisper/translate`

## 🔧 Configuration

Set these environment variables in Lambda:
- `NODE_ENV=production`
- `DATABASE_URL=postgresql://...`
- `JWT_SECRET=your-secret`
- `OAUTH2_CLIENT_SECRET=your-secret`

## 📚 Documentation

Full documentation available in `LAMBDA_DEPLOYMENT.md`