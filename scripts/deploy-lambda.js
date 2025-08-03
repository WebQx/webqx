const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying WebQx Healthcare Platform to AWS Lambda...');

const deploymentDir = path.join(__dirname, '..', 'aws-deployment');
const zipPath = path.join(deploymentDir, 'webqx-lambda-deployment.zip');

// Check if deployment package exists
if (!fs.existsSync(zipPath)) {
    console.error('❌ Deployment package not found. Please run "npm run lambda:package" first.');
    process.exit(1);
}

// Configuration from environment variables or defaults
const config = {
    functionName: process.env.LAMBDA_FUNCTION_NAME || 'webqx-healthcare-platform',
    runtime: 'nodejs18.x',
    handler: 'lambda-handler.handler',
    timeout: 30,
    memorySize: 512,
    role: process.env.LAMBDA_EXECUTION_ROLE_ARN,
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    description: 'WebQx Healthcare Platform - FHIR-compliant healthcare API and patient portal'
};

if (!config.role) {
    console.error('❌ AWS Lambda execution role ARN not specified.');
    console.log('Please set the LAMBDA_EXECUTION_ROLE_ARN environment variable.');
    console.log('Example: export LAMBDA_EXECUTION_ROLE_ARN=arn:aws:iam::123456789012:role/lambda-execution-role');
    process.exit(1);
}

try {
    console.log('🔍 Checking if Lambda function exists...');
    
    // Check if function exists
    let functionExists = false;
    try {
        execSync(`aws lambda get-function --function-name ${config.functionName} --region ${config.region}`, { 
            stdio: 'pipe' 
        });
        functionExists = true;
        console.log(`✅ Function ${config.functionName} exists, updating...`);
    } catch (error) {
        console.log(`📝 Function ${config.functionName} does not exist, creating...`);
    }

    if (functionExists) {
        // Update existing function
        console.log('🔄 Updating function code...');
        execSync(`aws lambda update-function-code --function-name ${config.functionName} --zip-file fileb://${zipPath} --region ${config.region}`, {
            stdio: 'inherit'
        });

        console.log('🔧 Updating function configuration...');
        execSync(`aws lambda update-function-configuration --function-name ${config.functionName} --timeout ${config.timeout} --memory-size ${config.memorySize} --description "${config.description}" --region ${config.region}`, {
            stdio: 'inherit'
        });
    } else {
        // Create new function
        console.log('🆕 Creating new Lambda function...');
        execSync(`aws lambda create-function --function-name ${config.functionName} --runtime ${config.runtime} --role ${config.role} --handler ${config.handler} --zip-file fileb://${zipPath} --timeout ${config.timeout} --memory-size ${config.memorySize} --description "${config.description}" --region ${config.region}`, {
            stdio: 'inherit'
        });
    }

    // Set environment variables
    console.log('🔧 Setting environment variables...');
    const envVars = {
        NODE_ENV: 'production',
        LAMBDA_DEPLOYMENT: 'true',
        // Add other necessary environment variables here
        // These should be set via AWS console, CLI, or infrastructure-as-code
    };

    const envVarsJson = JSON.stringify(envVars);
    execSync(`aws lambda update-function-configuration --function-name ${config.functionName} --environment "Variables=${envVarsJson}" --region ${config.region}`, {
        stdio: 'inherit'
    });

    console.log('✅ Lambda function deployed successfully!');
    console.log(`📄 Function Name: ${config.functionName}`);
    console.log(`🌐 Region: ${config.region}`);
    console.log(`💾 Memory: ${config.memorySize} MB`);
    console.log(`⏱️ Timeout: ${config.timeout} seconds`);
    
    console.log('\n📋 Next steps:');
    console.log('1. Configure API Gateway to trigger the Lambda function');
    console.log('2. Set up environment variables in AWS Lambda console');
    console.log('3. Configure VPC settings if needed for database access');
    console.log('4. Set up CloudWatch logs and monitoring');
    console.log('5. Test the deployment');

} catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure AWS CLI is installed and configured');
    console.log('2. Check AWS credentials and permissions');
    console.log('3. Verify the Lambda execution role exists and has necessary permissions');
    console.log('4. Check if the function name is already in use');
    process.exit(1);
}