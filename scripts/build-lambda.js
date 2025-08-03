const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🏗️ Building WebQx Healthcare Platform for AWS Lambda deployment...');

// Create build directory
const buildDir = path.join(__dirname, '..', 'lambda-build');
if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
}
fs.mkdirSync(buildDir, { recursive: true });

// Files and directories to include in Lambda package
const includePatterns = [
    'lambda-handler.js',
    'server-lambda.js',
    'package.json',
    'package-lock.json',
    'auth/**/*',
    'fhir/**/*',
    'modules/**/*',
    'openehr/**/*',
    'patient-portal/**/*',
    'provider/**/*',
    'routes/**/*',
    'services/**/*',
    'sso/**/*',
    'telehealth/**/*',
    'messaging/**/*',
    'ehr-integrations/**/*',
    'interoperability/**/*',
    'config/**/*',
    // Include static files for Lambda (alternatively serve from S3)
    'index.html',
    'login.html',
    '*.html',
    'legal/**/*'
];

// Files and directories to exclude
const excludePatterns = [
    'node_modules/**/*',
    '.git/**/*',
    '.github/**/*',
    '__tests__/**/*',
    '*.test.js',
    '*.test.ts',
    'test/**/*',
    'tests/**/*',
    'coverage/**/*',
    '.env*',
    '*.log',
    'tmp/**/*',
    'temp/**/*',
    'scripts/**/*',
    'aws-deployment/**/*',
    'lambda-build/**/*',
    'demo/**/*',
    'docs/**/*'
];

console.log('📁 Copying application files...');

// Copy files recursively with pattern matching
function shouldIncludeFile(filePath) {
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);
    
    // Check exclude patterns first
    for (const pattern of excludePatterns) {
        if (matchPattern(relativePath, pattern)) {
            return false;
        }
    }
    
    // Check include patterns
    for (const pattern of includePatterns) {
        if (matchPattern(relativePath, pattern)) {
            return true;
        }
    }
    
    return false;
}

function matchPattern(filePath, pattern) {
    // Convert glob pattern to regex
    const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
}

function copyDirectory(src, dest) {
    if (!fs.existsSync(src)) return;
    
    const items = fs.readdirSync(src);
    
    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        
        if (shouldIncludeFile(srcPath)) {
            const stat = fs.statSync(srcPath);
            
            if (stat.isDirectory()) {
                fs.mkdirSync(destPath, { recursive: true });
                copyDirectory(srcPath, destPath);
            } else {
                const dir = path.dirname(destPath);
                fs.mkdirSync(dir, { recursive: true });
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

// Copy application files
copyDirectory(path.join(__dirname, '..'), buildDir);

// Create optimized package.json for Lambda (production dependencies only)
console.log('📦 Creating optimized package.json...');
const originalPackageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const lambdaPackageJson = {
    name: originalPackageJson.name,
    version: originalPackageJson.version,
    description: originalPackageJson.description + ' (AWS Lambda)',
    main: 'lambda-handler.js',
    engines: originalPackageJson.engines,
    dependencies: originalPackageJson.dependencies,
    // Remove devDependencies for production Lambda package
    scripts: {
        start: 'node lambda-handler.js'
    }
};

fs.writeFileSync(
    path.join(buildDir, 'package.json'),
    JSON.stringify(lambdaPackageJson, null, 2)
);

console.log('✅ Lambda build completed successfully!');
console.log(`📁 Build artifacts located in: ${buildDir}`);
console.log('\n📋 Next steps:');
console.log('1. Run "npm run lambda:package" to install dependencies and create deployment ZIP');
console.log('2. Run "npm run lambda:deploy" to deploy to AWS Lambda');
console.log('3. Use AWS SAM CLI for local testing: "npm run lambda:local"');