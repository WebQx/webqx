# 🚀 WebQX™ React Native Deployment Guide

A comprehensive guide for deploying and running the WebQX™ React Native healthcare platform, supporting patient portals, provider panels, and admin consoles across all 12 core medical specialties.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Role-Based UI Features](#role-based-ui-features)
- [Mocked Data Configuration](#mocked-data-configuration)
- [Troubleshooting](#troubleshooting)
- [Additional Resources](#additional-resources)

---

## 🛠️ Prerequisites

### Required Software and Tools

#### Core Development Environment
- **Node.js**: Version 18.x or later ([Download](https://nodejs.org/))
- **npm**: 9.x or later (comes with Node.js) or **Yarn**: 1.22.x or later ([Install Yarn](https://yarnpkg.com/getting-started/install))
- **React Native CLI**: Latest version
  ```bash
  npm install -g @react-native-community/cli
  ```

#### Mobile Development SDKs

##### Android Development
- **Android Studio**: Latest stable version ([Download](https://developer.android.com/studio))
- **Android SDK**: API level 31 or higher
- **Java Development Kit (JDK)**: Version 17 or later
- **Android SDK Platform-Tools**: Latest version
- **Android SDK Build-Tools**: Version 33.0.0 or later

##### iOS Development (macOS only)
- **Xcode**: Version 14.0 or later ([Mac App Store](https://apps.apple.com/us/app/xcode/id497799835))
- **iOS Simulator**: Included with Xcode
- **CocoaPods**: Latest version
  ```bash
  sudo gem install cocoapods
  ```

#### Additional Tools
- **Git**: Version control ([Download](https://git-scm.com/))
- **VS Code** or preferred IDE ([Download](https://code.visualstudio.com/))
- **Flipper**: For debugging (optional) ([Download](https://fbflipper.com/))

### Healthcare-Specific Dependencies
- **HIPAA-compliant encryption libraries**: For secure data handling
- **HL7/FHIR client libraries**: For healthcare interoperability
- **Biometric authentication**: For secure access controls

### Environment Variables Setup
Create a `.env` file in the project root:
```bash
# API Configuration
API_BASE_URL=https://api.webqx.health
FHIR_BASE_URL=https://fhir.webqx.health

# Security
ENCRYPTION_KEY=your_encryption_key_here
JWT_SECRET=your_jwt_secret_here

# Healthcare Integrations
EMR_API_KEY=your_emr_api_key
PHARMACY_API_KEY=your_pharmacy_api_key
LAB_API_KEY=your_lab_results_api_key

# Analytics
ANALYTICS_API_KEY=your_analytics_key
```

---

## 🌐 Environment Setup

### 1. Official Documentation Links

| Platform | Setup Guide |
|----------|-------------|
| React Native | [Official Environment Setup](https://reactnative.dev/docs/environment-setup) |
| Android Studio | [Install Android Studio](https://developer.android.com/studio/install) |
| Xcode | [Xcode Setup Guide](https://developer.apple.com/xcode/) |
| Node.js | [Node.js Installation Guide](https://nodejs.org/en/download/) |

### 2. Development Environment Verification

Run these commands to verify your setup:

```bash
# Check Node.js and npm versions
node --version
npm --version

# Check React Native CLI
npx react-native --version

# Check Android setup (if on Windows/Linux/macOS)
npx react-native doctor

# Check Java version
java -version

# Check Git
git --version
```

### 3. Android Environment Setup

Add these environment variables to your shell profile:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
# export ANDROID_HOME=$HOME/Android/Sdk        # Linux
# export ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk  # Windows

export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### 4. iOS Environment Setup (macOS only)

```bash
# Install CocoaPods
sudo gem install cocoapods

# Verify Xcode installation
xcode-select --install
```

---

## 💻 Local Development

### 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/WebQx/webqx.git
cd webqx

# Install dependencies
npm install
# or
yarn install

# iOS specific setup (macOS only)
cd ios && pod install && cd ..
```

### 2. Running the Application

#### Start Metro Bundler
```bash
# Start the React Native packager
npx react-native start
# or
yarn start
```

#### Run on Android
```bash
# Ensure Android emulator is running or device is connected
npx react-native run-android

# For specific device/emulator
npx react-native run-android --deviceId=<device_id>

# For release build
npx react-native run-android --variant=release
```

#### Run on iOS (macOS only)
```bash
# Run on iOS Simulator
npx react-native run-ios

# Run on specific simulator
npx react-native run-ios --simulator="iPhone 14 Pro"

# Run on physical device
npx react-native run-ios --device="Your Device Name"

# For release build
npx react-native run-ios --configuration Release
```

### 3. Development Commands

```bash
# Run linting
npm run lint
# or
yarn lint

# Run tests
npm test
# or
yarn test

# Type checking (if using TypeScript)
npm run tsc
# or
yarn tsc

# Reset Metro cache (if experiencing issues)
npx react-native start --reset-cache
```

---

## 🚀 Production Deployment

### Android Production Build

#### 1. Generate Signed APK

```bash
# Navigate to android directory
cd android

# Generate release APK
./gradlew assembleRelease

# Generate AAB (recommended for Play Store)
./gradlew bundleRelease
```

#### 2. Keystore Setup

Create a keystore for signing:
```bash
# Generate keystore
keytool -genkeypair -v -storetype PKCS12 \
  -keystore webqx-release-key.keystore \
  -alias webqx-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Add to `android/gradle.properties`:
```properties
WEBQX_UPLOAD_STORE_FILE=webqx-release-key.keystore
WEBQX_UPLOAD_KEY_ALIAS=webqx-key-alias
WEBQX_UPLOAD_STORE_PASSWORD=your_store_password
WEBQX_UPLOAD_KEY_PASSWORD=your_key_password
```

#### 3. Google Play Store Deployment

1. **Prepare App Bundle**: Use the AAB file generated above
2. **Create Play Console Account**: [Google Play Console](https://play.google.com/console)
3. **App Information**: Fill in healthcare app details, privacy policy
4. **Content Rating**: Select appropriate medical/health categories
5. **Data Safety**: Declare healthcare data handling practices
6. **Review**: Submit for Google's review process

### iOS Production Build

#### 1. Archive and Build

```bash
# Open project in Xcode
open ios/WebQX.xcworkspace

# Or build from command line
cd ios
xcodebuild -workspace WebQX.xcworkspace \
  -scheme WebQX \
  -configuration Release \
  -archivePath WebQX.xcarchive \
  archive
```

#### 2. Code Signing Setup

1. **Apple Developer Account**: Required for distribution
2. **Certificates**: Create distribution certificate
3. **Provisioning Profiles**: Create App Store distribution profile
4. **Bundle Identifier**: Configure unique identifier (e.g., `com.webqx.healthcare`)

#### 3. App Store Deployment

1. **App Store Connect**: Upload via Xcode or Application Loader
2. **App Information**: Complete metadata for healthcare app
3. **Privacy Details**: Declare health data collection and usage
4. **Review Guidelines**: Ensure compliance with Apple's health app guidelines
5. **Submission**: Submit for Apple's review process

### Healthcare Compliance Considerations

#### HIPAA Compliance Checklist
- ✅ End-to-end encryption implemented
- ✅ Secure authentication (biometric/multi-factor)
- ✅ Audit logging enabled
- ✅ Data minimization practices
- ✅ Business Associate Agreements (BAA) in place
- ✅ Staff training documentation

#### Security Hardening
```bash
# Enable ProGuard for Android (in android/app/build.gradle)
buildTypes {
    release {
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

---

## 👥 Role-Based UI Features

### User Roles and Access Levels

#### 1. Patient Role
**Features Available:**
- 📱 Patient Portal access
- 📅 Appointment scheduling and management
- 💊 Medication tracking and refill requests
- 🧪 Lab results viewer (read-only)
- 💬 Secure messaging with providers
- 📋 Health records access (personal data only)
- 💳 Billing and payment management

**UI Components:**
```typescript
// Example patient dashboard configuration
const PatientDashboard = {
  widgets: [
    'upcoming-appointments',
    'recent-lab-results',
    'medication-reminders',
    'secure-messages',
    'care-plan-progress'
  ],
  permissions: ['read-own-data', 'message-providers', 'schedule-appointments']
}
```

#### 2. Provider Role
**Features Available:**
- 🩺 Provider Panel access
- 📋 Patient EHR management
- 💊 Prescription management and e-prescribing
- 📊 Clinical decision support tools
- 🧠 CME tracking and continuing education
- 🤖 AI-powered provider assistant
- 📝 Clinical documentation and transcription
- 📈 Analytics and reporting dashboards

**Specialty-Specific Views:**
- **Primary Care**: Comprehensive patient overview
- **Radiology**: PACS integration and imaging viewer
- **Cardiology**: Cardiac monitoring and EKG analysis
- **Psychiatry**: Mental health assessments and care plans
- **Pediatrics**: Growth charts and vaccination tracking

#### 3. Admin Role
**Features Available:**
- 🛠️ Admin Console access
- 👥 User management and role assignment
- 🔐 Security and compliance monitoring
- 🌐 System configuration and localization
- 📊 Advanced analytics and reporting
- 🔗 Integration management (HL7/FHIR)
- 🎛️ AI tuning and configuration
- 💰 Billing logic and rule management

### Role Implementation

```typescript
// Role-based navigation configuration
export const NavigationConfig = {
  patient: {
    tabs: ['Dashboard', 'Appointments', 'Health Records', 'Messages', 'Billing'],
    permissions: ['read-own-data', 'schedule-appointments', 'message-providers']
  },
  provider: {
    tabs: ['Patient List', 'Schedule', 'Documentation', 'Prescriptions', 'Analytics'],
    permissions: ['read-patient-data', 'write-clinical-notes', 'prescribe-medications']
  },
  admin: {
    tabs: ['Users', 'System', 'Analytics', 'Compliance', 'Integrations'],
    permissions: ['manage-users', 'system-config', 'view-all-data']
  }
};
```

---

## 🗃️ Mocked Data Configuration

### Review Queues

```javascript
// Mock data for clinical review queues
export const MockReviewQueues = {
  labResults: [
    {
      id: 'lab_001',
      patientId: 'patient_123',
      testType: 'Complete Blood Count',
      status: 'pending_review',
      priority: 'normal',
      receivedDate: '2024-01-15T10:30:00Z',
      provider: 'Dr. Smith',
      specialty: 'Primary Care'
    },
    {
      id: 'lab_002',
      patientId: 'patient_456',
      testType: 'Cardiac Enzymes',
      status: 'critical',
      priority: 'urgent',
      receivedDate: '2024-01-15T14:22:00Z',
      provider: 'Dr. Johnson',
      specialty: 'Cardiology'
    }
  ],
  
  imagingStudies: [
    {
      id: 'img_001',
      patientId: 'patient_789',
      studyType: 'Chest X-Ray',
      status: 'preliminary_read',
      radiologist: 'Dr. Brown',
      urgency: 'routine',
      acquisitionDate: '2024-01-15T09:15:00Z'
    }
  ],
  
  medicationRequests: [
    {
      id: 'rx_001',
      patientId: 'patient_321',
      medication: 'Lisinopril 10mg',
      requestType: 'refill',
      status: 'pending_approval',
      prescriber: 'Dr. Davis',
      requestDate: '2024-01-15T11:45:00Z'
    }
  ]
};
```

### Audit Logs

```javascript
// Mock audit log configuration
export const MockAuditLogs = {
  userActions: [
    {
      id: 'audit_001',
      userId: 'user_123',
      userRole: 'provider',
      action: 'patient_record_access',
      resourceId: 'patient_456',
      timestamp: '2024-01-15T15:30:00Z',
      ipAddress: '192.168.1.100',
      sessionId: 'session_abc123',
      details: {
        recordType: 'medical_history',
        accessReason: 'patient_appointment'
      }
    },
    {
      id: 'audit_002',
      userId: 'admin_456',
      userRole: 'admin',
      action: 'user_role_modified',
      resourceId: 'user_789',
      timestamp: '2024-01-15T16:15:00Z',
      ipAddress: '10.0.0.50',
      sessionId: 'session_def456',
      details: {
        previousRole: 'provider',
        newRole: 'senior_provider',
        modifiedBy: 'admin_456'
      }
    }
  ],
  
  systemEvents: [
    {
      id: 'sys_001',
      eventType: 'backup_completed',
      status: 'success',
      timestamp: '2024-01-15T02:00:00Z',
      details: {
        backupSize: '2.5GB',
        duration: '45 minutes',
        location: 'cloud_storage_primary'
      }
    }
  ]
};
```

### Analytics Data

```javascript
// Mock analytics configuration
export const MockAnalytics = {
  patientEngagement: {
    portalLogins: {
      daily: 1250,
      weekly: 7800,
      monthly: 28500,
      trend: '+15%'
    },
    appointmentCompliance: {
      showRate: 0.92,
      cancelationRate: 0.08,
      noShowRate: 0.05
    },
    messageResponse: {
      providerResponseTime: '2.3 hours',
      patientEngagementRate: 0.78
    }
  },
  
  clinicalMetrics: {
    specialtyVolume: {
      'Primary Care': 2500,
      'Cardiology': 850,
      'Radiology': 1200,
      'Pediatrics': 650,
      'Psychiatry': 400
    },
    qualityMeasures: {
      medicationAdherence: 0.87,
      preventiveCareCompletion: 0.73,
      chronicDiseaseManagement: 0.82
    }
  },
  
  systemPerformance: {
    apiResponseTimes: {
      average: '245ms',
      p95: '580ms',
      p99: '1.2s'
    },
    uptime: '99.97%',
    errorRate: '0.03%'
  }
};
```

### Configuration Files

Create these configuration files for different environments:

**config/development.json**
```json
{
  "api": {
    "baseUrl": "http://localhost:3000",
    "timeout": 10000
  },
  "features": {
    "mockData": true,
    "debugging": true,
    "analytics": false
  },
  "logging": {
    "level": "debug",
    "console": true
  }
}
```

**config/production.json**
```json
{
  "api": {
    "baseUrl": "https://api.webqx.health",
    "timeout": 30000
  },
  "features": {
    "mockData": false,
    "debugging": false,
    "analytics": true
  },
  "logging": {
    "level": "error",
    "console": false
  }
}
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. React Native Setup Issues

**Problem**: `command not found: react-native`
```bash
# Solution: Install React Native CLI globally
npm install -g @react-native-community/cli
```

**Problem**: Android build fails with "SDK location not found"
```bash
# Solution: Set ANDROID_HOME environment variable
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
export ANDROID_HOME=$HOME/Android/Sdk          # Linux
```

**Problem**: iOS build fails with "No bundle URL present"
```bash
# Solution: Reset Metro cache and rebuild
npx react-native start --reset-cache
cd ios && rm -rf build && cd ..
npx react-native run-ios
```

#### 2. Dependencies and Build Issues

**Problem**: CocoaPods installation fails on iOS
```bash
# Solution: Update CocoaPods and reinstall
sudo gem install cocoapods
cd ios
pod repo update
pod install --repo-update
```

**Problem**: Android Gradle build fails
```bash
# Solution: Clean and rebuild
cd android
./gradlew clean
./gradlew assembleDebug
```

**Problem**: Metro bundler fails to start
```bash
# Solution: Reset cache and restart
npx react-native start --reset-cache
# or
rm -rf node_modules
npm install
npx react-native start
```

#### 3. Healthcare-Specific Issues

**Problem**: HIPAA compliance warnings
- **Solution**: Enable encryption modules and update security configurations
- Verify SSL/TLS certificates are properly configured
- Ensure audit logging is enabled

**Problem**: HL7/FHIR integration failures
- **Solution**: Check API endpoints and authentication tokens
- Verify FHIR version compatibility
- Review network connectivity and firewall rules

**Problem**: Biometric authentication not working
- **Solution**: Check device permissions and hardware support
- Update biometric libraries to latest versions
- Test on physical devices (biometrics don't work in simulators)

#### 4. Performance Issues

**Problem**: App crashes or freezes on large datasets
```javascript
// Solution: Implement virtualized lists
import { VirtualizedList } from 'react-native';

// Use pagination for large data sets
const ITEMS_PER_PAGE = 50;
```

**Problem**: Slow API responses
- **Solution**: Implement caching and offline capabilities
- Use React Query or Apollo Client for data management
- Optimize API queries and implement pagination

#### 5. Debugging Tools

**Enable Flipper for Advanced Debugging:**
```bash
# Install Flipper
npm install --save-dev react-native-flipper

# Enable in development builds
# Add to your app's main component
import { initializeFlipper } from 'react-native-flipper';
initializeFlipper();
```

**Remote Debugging:**
```bash
# Enable remote debugging
# In development build: Shake device -> "Debug" -> "Debug with Chrome"
```

### Device-Specific Troubleshooting

#### Android Emulator Issues
```bash
# List available emulators
emulator -list-avds

# Start specific emulator
emulator -avd <emulator_name>

# Cold boot if emulator is corrupted
emulator -avd <emulator_name> -wipe-data
```

#### iOS Simulator Issues
```bash
# Reset iOS Simulator
xcrun simctl erase all

# List available simulators
xcrun simctl list devices

# Boot specific simulator
xcrun simctl boot <device_id>
```

### Network and Security Troubleshooting

**SSL Certificate Issues:**
```bash
# For development environments with self-signed certificates
# Add to network security config (Android)
# or add certificate to iOS keychain
```

**API Connection Issues:**
```bash
# Test API connectivity
curl -v https://api.webqx.health/health
ping api.webqx.health
```

---

## 📚 Additional Resources

### Official Documentation
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Native Troubleshooting](https://reactnative.dev/docs/troubleshooting)
- [Android Developer Guides](https://developer.android.com/guide)
- [iOS Developer Documentation](https://developer.apple.com/documentation/)

### Healthcare Development Resources
- [HL7 FHIR Implementation Guide](https://www.hl7.org/fhir/)
- [HIPAA Compliance Guidelines](https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html)
- [FDA Mobile Medical App Guidance](https://www.fda.gov/medical-devices/digital-health/mobile-medical-applications)

### Community and Support
- [React Native Community](https://github.com/react-native-community)
- [Stack Overflow - React Native](https://stackoverflow.com/questions/tagged/react-native)
- [WebQX GitHub Issues](https://github.com/WebQx/webqx/issues)

### Development Tools
- [Flipper Debugging Platform](https://fbflipper.com/)
- [Reactotron](https://github.com/infinitered/reactotron)
- [React Native Debugger](https://github.com/jhen0409/react-native-debugger)

---

## 📞 Support and Contact

For deployment assistance, healthcare compliance questions, or technical support:

- **GitHub Issues**: [WebQx/webqx/issues](https://github.com/WebQx/webqx/issues)
- **Email**: support@webqx.health
- **Documentation**: [WebQx Documentation Portal](https://docs.webqx.health)

---

*"Care equity begins with code equity."* - WebQX™ Team

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Compatibility**: React Native 0.72+, iOS 14+, Android API 31+