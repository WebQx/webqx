#!/usr/bin/env node

/**
 * WebQX Lambda Deployment Script
 * 
 * This script automates the process of creating a lambda.zip file for AWS Lambda deployment.
 * It handles dependency installation, file packaging, and proper exclusions for optimal
 * Lambda performance.
 * 
 * Features:
 * - Installs Lambda-optimized dependencies from package-lambda.json
 * - Packages only necessary files for Lambda execution
 * - Excludes development files, tests, and unnecessary assets
 * - Provides comprehensive error handling and user feedback
 * - Creates a production-ready lambda.zip file
 * 
 * Usage:
 *   node scripts/deploy-lambda.js
 *   npm run deploy:lambda
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  // Temporary directory for building the Lambda package
  tempDir: path.join(__dirname, '..', 'temp-lambda-build'),
  
  // Output file name
  outputZip: path.join(__dirname, '..', 'lambda.zip'),
  
  // Files and directories to include in the Lambda package
  includeFiles: [
    'lambda.js',
    'server-lambda.js', 
    'lambda-utils.js',
    '.env.lambda',
    'auth',
    'config',
    'fhir',
    'routes',
    'services',
    'modules',
    'interoperability',
    'ehr-integrations'
  ],
  
  // Patterns to exclude (in addition to standard exclusions)
  excludePatterns: [
    '**/.git/**',
    '**/node_modules/**',
    '**/__tests__/**',
    '**/*.test.js',
    '**/*.test.ts',
    '**/*.spec.js',
    '**/*.spec.ts',
    '**/test/**',
    '**/tests/**',
    '**/.env',
    '**/docs/**',
    '**/demo/**',
    '**/*.html',
    '**/infrastructure/**',
    '**/Dockerfile*',
    '**/.github/**',
    '**/coverage/**',
    '**/dist/**',
    '**/build/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/*.log',
    '**/temp*/**',
    '**/tmp/**'
  ],
  
  // Files to exclude by name (case-insensitive)
  excludeFileNames: [
    'README.md',
    'README',
    'CHANGELOG.md',
    'LICENSE.md',
    'CONTRIBUTING.md'
  ]
};

/**
 * Logger utility for consistent output formatting
 */
class Logger {
  static info(message) {
    console.log(`[INFO] ${message}`);
  }
  
  static success(message) {
    console.log(`[SUCCESS] ✅ ${message}`);
  }
  
  static error(message) {
    console.error(`[ERROR] ❌ ${message}`);
  }
  
  static warning(message) {
    console.warn(`[WARNING] ⚠️ ${message}`);
  }
  
  static step(message) {
    console.log(`\n[STEP] 🔧 ${message}`);
  }
}

/**
 * Utility functions for file operations
 */
class FileUtils {
  /**
   * Check if a file or directory exists
   */
  static exists(filePath) {
    try {
      fs.accessSync(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Create directory recursively if it doesn't exist
   */
  static ensureDir(dirPath) {
    if (!this.exists(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  
  /**
   * Remove directory and all contents
   */
  static removeDir(dirPath) {
    if (this.exists(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }
  
  /**
   * Copy file from source to destination
   */
  static copyFile(src, dest) {
    this.ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
  
  /**
   * Copy directory recursively with exclusion patterns
   */
  static copyDir(src, dest, excludePatterns = []) {
    if (!this.exists(src)) {
      return;
    }
    
    this.ensureDir(dest);
    const items = fs.readdirSync(src);
    
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const relativePath = path.relative(process.cwd(), srcPath);
      
      // Check if item should be excluded
      const shouldExclude = excludePatterns.some(pattern => {
        try {
          const minimatch = require('minimatch');
          return minimatch(relativePath, pattern) || minimatch(item, pattern);
        } catch {
          // Fallback to simple string matching if minimatch is not available
          const simplePattern = pattern.replace('**/', '').replace('/**', '').replace('*', '');
          return relativePath.includes(simplePattern) || item.includes(simplePattern);
        }
      }) || config.excludeFileNames.some(fileName => 
        item.toLowerCase() === fileName.toLowerCase() || 
        item.toLowerCase().startsWith(fileName.toLowerCase().replace('.md', ''))
      );
      
      if (shouldExclude) {
        continue;
      }
      
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        this.copyDir(srcPath, destPath, excludePatterns);
      } else {
        this.copyFile(srcPath, destPath);
      }
    }
  }
}

/**
 * Main deployment class
 */
class LambdaDeployer {
  constructor() {
    this.rootDir = path.join(__dirname, '..');
    this.tempDir = config.tempDir;
    this.outputZip = config.outputZip;
  }
  
  /**
   * Validate prerequisites before starting deployment
   */
  validatePrerequisites() {
    Logger.step('Validating prerequisites');
    
    // Check if required files exist
    const requiredFiles = ['package-lambda.json', 'lambda.js', 'server-lambda.js'];
    for (const file of requiredFiles) {
      const filePath = path.join(this.rootDir, file);
      if (!FileUtils.exists(filePath)) {
        throw new Error(`Required file not found: ${file}`);
      }
    }
    
    // Check if npm is available
    try {
      execSync('npm --version', { stdio: 'ignore' });
    } catch {
      throw new Error('npm is not available. Please install Node.js and npm.');
    }
    
    Logger.success('Prerequisites validated');
  }
  
  /**
   * Prepare temporary build directory
   */
  prepareBuildDirectory() {
    Logger.step('Preparing build directory');
    
    // Clean up any existing temp directory
    FileUtils.removeDir(this.tempDir);
    
    // Create fresh temp directory
    FileUtils.ensureDir(this.tempDir);
    
    Logger.success(`Build directory prepared: ${this.tempDir}`);
  }
  
  /**
   * Install Lambda-specific dependencies
   */
  installDependencies() {
    Logger.step('Installing Lambda dependencies');
    
    try {
      // Copy package-lambda.json to temp directory as package.json
      const lambdaPackageJson = path.join(this.rootDir, 'package-lambda.json');
      const tempPackageJson = path.join(this.tempDir, 'package.json');
      FileUtils.copyFile(lambdaPackageJson, tempPackageJson);
      
      // Install dependencies in temp directory
      Logger.info('Running npm install for Lambda dependencies...');
      execSync('npm install --production --no-optional', { 
        cwd: this.tempDir,
        stdio: 'inherit'
      });
      
      Logger.success('Lambda dependencies installed successfully');
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error.message}`);
    }
  }
  
  /**
   * Copy necessary files to build directory
   */
  copyFiles() {
    Logger.step('Copying application files');
    
    try {
      // Copy individual files and directories from include list
      for (const item of config.includeFiles) {
        const srcPath = path.join(this.rootDir, item);
        const destPath = path.join(this.tempDir, item);
        
        if (!FileUtils.exists(srcPath)) {
          Logger.warning(`Source not found, skipping: ${item}`);
          continue;
        }
        
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
          Logger.info(`Copying directory: ${item}`);
          FileUtils.copyDir(srcPath, destPath, config.excludePatterns);
        } else {
          Logger.info(`Copying file: ${item}`);
          FileUtils.copyFile(srcPath, destPath);
        }
      }
      
      Logger.success('Application files copied successfully');
    } catch (error) {
      throw new Error(`Failed to copy files: ${error.message}`);
    }
  }
  
  /**
   * Create the lambda.zip file
   */
  async createZipFile() {
    Logger.step('Creating lambda.zip file');
    
    // Require archiver here after it's installed
    const archiver = require('archiver');
    
    return new Promise((resolve, reject) => {
      // Remove existing zip file if it exists
      if (FileUtils.exists(this.outputZip)) {
        fs.unlinkSync(this.outputZip);
      }
      
      // Create zip archive
      const output = fs.createWriteStream(this.outputZip);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Handle archive events
      output.on('close', () => {
        const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
        Logger.success(`lambda.zip created successfully (${sizeInMB} MB)`);
        resolve();
      });
      
      archive.on('error', (err) => {
        reject(new Error(`Failed to create zip file: ${err.message}`));
      });
      
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          Logger.warning(`File not found during archiving: ${err.message}`);
        } else {
          reject(err);
        }
      });
      
      // Pipe archive to output file
      archive.pipe(output);
      
      // Add all files from temp directory to archive
      archive.directory(this.tempDir, false);
      
      // Finalize the archive
      archive.finalize();
    });
  }
  
  /**
   * Clean up temporary files
   */
  cleanup() {
    Logger.step('Cleaning up temporary files');
    
    try {
      FileUtils.removeDir(this.tempDir);
      Logger.success('Cleanup completed');
    } catch (error) {
      Logger.warning(`Cleanup failed: ${error.message}`);
    }
  }
  
  /**
   * Validate the created zip file
   */
  validateZipFile() {
    Logger.step('Validating lambda.zip file');
    
    if (!FileUtils.exists(this.outputZip)) {
      throw new Error('lambda.zip file was not created');
    }
    
    const stats = fs.statSync(this.outputZip);
    const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
    
    // Check if file size is reasonable (not empty, not too large)
    if (stats.size === 0) {
      throw new Error('lambda.zip file is empty');
    }
    
    if (stats.size > 50 * 1024 * 1024) { // 50MB limit warning
      Logger.warning(`lambda.zip file is large (${sizeInMB} MB). Consider optimizing dependencies.`);
    }
    
    Logger.success(`lambda.zip validation passed (${sizeInMB} MB)`);
  }
  
  /**
   * Main deployment process
   */
  async deploy() {
    const startTime = Date.now();
    
    try {
      Logger.info('🚀 Starting Lambda deployment package creation...\n');
      
      // Execute deployment steps
      this.validatePrerequisites();
      this.prepareBuildDirectory();
      this.installDependencies();
      this.copyFiles();
      await this.createZipFile();
      this.validateZipFile();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      Logger.info('\n🎉 Deployment package created successfully!');
      Logger.info(`⏱️  Total time: ${duration} seconds`);
      Logger.info(`📦 Output: ${this.outputZip}`);
      Logger.info('\nNext steps:');
      Logger.info('1. Upload lambda.zip to AWS Lambda console');
      Logger.info('2. Or use AWS CLI: aws lambda update-function-code --function-name your-function --zip-file fileb://lambda.zip');
      Logger.info('3. Or use serverless framework: serverless deploy');
      
    } catch (error) {
      Logger.error(`Deployment failed: ${error.message}`);
      throw error;
    } finally {
      this.cleanup();
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Install required dependencies
    Logger.info('Installing required dependencies...');
    try {
      require('archiver');
      require('minimatch');
    } catch {
      execSync('npm install archiver minimatch --no-save', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      Logger.success('Required dependencies installed');
    }
    
    const deployer = new LambdaDeployer();
    await deployer.deploy();
    
    process.exit(0);
  } catch (error) {
    Logger.error(`Failed to create Lambda deployment package: ${error.message}`);
    process.exit(1);
  }
}

// Run main function if script is executed directly
if (require.main === module) {
  main();
}

module.exports = { LambdaDeployer, Logger, FileUtils };