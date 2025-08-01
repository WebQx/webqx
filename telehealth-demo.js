/**
 * WebQX™ Telehealth Module Demo
 * 
 * Simple demonstration of the telehealth module functionality
 */

const { TelehealthManager } = require('./modules/telehealth/core/telehealth-manager');

// Demo configuration for standalone video consultation
const standaloneVideoConfig = {
  deploymentMode: 'standalone',
  enabledComponents: ['video-consultation'],
  components: {
    'video-consultation': {
      enabled: true,
      logLevel: 'info',
      healthCheckInterval: 30000,
      retryAttempts: 3,
      timeout: 5000,
      jitsi: {
        domain: 'meet.jitsi.org',
        appId: 'webqx-demo'
      },
      recording: {
        enabled: false,
        storage: 'local',
        retentionDays: 30
      },
      quality: {
        defaultResolution: '720p',
        adaptiveBitrate: true,
        maxBitrate: 2000000
      }
    }
  },
  interoperability: {
    eventBus: {
      enabled: false,
      maxListeners: 10
    },
    crossComponentAuth: false,
    sharedSession: false
  },
  security: {
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90
    },
    audit: {
      enabled: true,
      retentionDays: 365,
      includeSuccessEvents: false
    },
    compliance: {
      hipaaMode: true,
      auditAllAccess: true,
      dataRetentionDays: 365
    }
  }
};

// Demo configuration for full suite
const fullSuiteConfig = {
  deploymentMode: 'full-suite',
  enabledComponents: ['video-consultation', 'messaging'],
  components: {
    'video-consultation': {
      enabled: true,
      logLevel: 'info',
      healthCheckInterval: 30000,
      retryAttempts: 3,
      timeout: 5000,
      jitsi: {
        domain: 'meet.jitsi.org',
        appId: 'webqx-full-suite'
      },
      recording: {
        enabled: false,
        storage: 'local',
        retentionDays: 30
      },
      quality: {
        defaultResolution: '720p',
        adaptiveBitrate: true,
        maxBitrate: 2000000
      }
    },
    'messaging': {
      enabled: true,
      logLevel: 'info',
      healthCheckInterval: 30000,
      retryAttempts: 3,
      timeout: 5000,
      matrix: {
        homeserverUrl: 'https://matrix.org',
        accessToken: 'demo-token',
        userId: '@webqx-demo:matrix.org',
        deviceId: 'DEMO_DEVICE'
      },
      encryption: {
        enabled: true,
        backupEnabled: false,
        crossSigning: false
      },
      channels: {
        autoCreate: true,
        defaultPermissions: {},
        retentionDays: 30
      }
    }
  },
  interoperability: {
    eventBus: {
      enabled: true,
      maxListeners: 100
    },
    crossComponentAuth: true,
    sharedSession: true
  },
  security: {
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90
    },
    audit: {
      enabled: true,
      retentionDays: 2555,
      includeSuccessEvents: true
    },
    compliance: {
      hipaaMode: true,
      auditAllAccess: true,
      dataRetentionDays: 2555
    }
  }
};

async function demoStandaloneVideo() {
  console.log('🎥 Demo: Standalone Video Consultation');
  console.log('='.repeat(40));
  
  try {
    const manager = new TelehealthManager(standaloneVideoConfig);
    await manager.initialize();
    
    const health = manager.getHealthStatus();
    console.log('✅ Initialized successfully');
    console.log('📊 Health:', {
      healthy: health.healthy,
      mode: health.deploymentMode,
      components: Object.keys(health.components)
    });
    
    const status = manager.getComponentStatus();
    console.log('🔍 Component Status:');
    Object.entries(status).forEach(([name, stat]) => {
      console.log(`  - ${name}: ${stat.healthy ? '✅' : '❌'} (${stat.status})`);
    });
    
    await manager.shutdown();
    console.log('🔄 Shutdown completed\n');
    
  } catch (error) {
    console.error('❌ Standalone demo failed:', error.message);
  }
}

async function demoFullSuite() {
  console.log('🏥 Demo: Full Suite Deployment');
  console.log('='.repeat(40));
  
  try {
    const manager = new TelehealthManager(fullSuiteConfig);
    await manager.initialize();
    
    const health = manager.getHealthStatus();
    console.log('✅ Initialized successfully');
    console.log('📊 Health:', {
      healthy: health.healthy,
      mode: health.deploymentMode,
      components: Object.keys(health.components)
    });
    
    const status = manager.getComponentStatus();
    console.log('🔍 Component Status:');
    Object.entries(status).forEach(([name, stat]) => {
      console.log(`  - ${name}: ${stat.healthy ? '✅' : '❌'} (${stat.status})`);
    });
    
    // Demonstrate component access
    const videoComponent = manager.getComponent('video-consultation');
    const messagingComponent = manager.getComponent('messaging');
    
    console.log('🧩 Available Components:');
    console.log(`  - Video Consultation: ${videoComponent ? '✅' : '❌'}`);
    console.log(`  - Messaging: ${messagingComponent ? '✅' : '❌'}`);
    
    await manager.shutdown();
    console.log('🔄 Shutdown completed\n');
    
  } catch (error) {
    console.error('❌ Full suite demo failed:', error.message);
  }
}

async function runDemo() {
  console.log('🚀 WebQX™ Telehealth Module Demo\n');
  
  await demoStandaloneVideo();
  await demoFullSuite();
  
  console.log('✅ Demo completed successfully!');
  console.log('\n📚 Documentation available at:');
  console.log('- modules/telehealth/README.md');
  console.log('- modules/telehealth/docs/CONFIGURATION.md');
  console.log('- modules/telehealth/deployment/README.md');
  
  console.log('\n🚀 Getting Started:');
  console.log('1. Full Suite: npm run telehealth:start:full');
  console.log('2. Video Only: npm run telehealth:start:video');
  console.log('3. Messaging Only: npm run telehealth:start:messaging');
  console.log('4. Health Check: npm run telehealth:health');
}

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = {
  demoStandaloneVideo,
  demoFullSuite,
  runDemo
};