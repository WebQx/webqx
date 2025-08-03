const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

console.log('📦 Packaging WebQx Healthcare Platform for AWS Lambda deployment...');

const buildDir = path.join(__dirname, '..', 'lambda-build');
const deploymentDir = path.join(__dirname, '..', 'aws-deployment');

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
    console.error('❌ Build directory not found. Please run "npm run lambda:build" first.');
    process.exit(1);
}

// Create deployment directory
if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
}

console.log('🔄 Installing production dependencies...');

try {
    // Install production dependencies in build directory
    execSync('npm ci --only=production', {
        cwd: buildDir,
        stdio: 'inherit'
    });
} catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
}

console.log('🗜️ Creating deployment ZIP package...');

const zipPath = path.join(deploymentDir, 'webqx-lambda-deployment.zip');

// Remove existing ZIP if it exists
if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
}

// Create ZIP archive
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`✅ Deployment package created: ${zipPath}`);
    console.log(`📏 Package size: ${sizeInMB} MB`);
    
    if (archive.pointer() > 50 * 1024 * 1024) {
        console.warn('⚠️ Warning: Package size exceeds 50MB. Consider optimizing dependencies or using Lambda layers.');
    }
    
    console.log('\n📋 Next steps:');
    console.log('1. Upload the ZIP file to AWS Lambda manually, or');
    console.log('2. Use AWS CLI/SAM for automated deployment: "npm run lambda:deploy"');
    console.log('3. Configure environment variables in AWS Lambda console');
});

archive.on('error', (err) => {
    console.error('❌ Error creating ZIP archive:', err);
    process.exit(1);
});

archive.pipe(output);

// Add all files from build directory to ZIP
archive.directory(buildDir, false);

// Finalize the archive
archive.finalize();