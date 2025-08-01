/**
 * WebQX™ Telehealth Module Example
 * 
 * Demonstrates how to use the telehealth module in both
 * full-suite and standalone deployment modes
 */

import { TelehealthManager } from './modules/telehealth/core/telehealth-manager';
import { TelehealthConfig } from './modules/telehealth/core/types/telehealth.types';

// Example 1: Full Suite Deployment
async function exampleFullSuiteDeployment() {
  console.log('🏥 Example: Full Suite Telehealth Deployment');
  
  const fullSuiteConfig: TelehealthConfig = {
    deploymentMode: 'full-suite',
    enabledComponents: ['video-consultation', 'messaging', 'ehr-integration', 'fhir-sync'],
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
          backupEnabled: true,
          crossSigning: true
        },
        channels: {
          autoCreate: true,
          defaultPermissions: {},
          retentionDays: 2555
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

  try {
    const telehealthManager = new TelehealthManager(fullSuiteConfig);
    
    // Initialize the full suite
    await telehealthManager.initialize();
    console.log('✅ Full suite initialized successfully');
    
    // Get health status
    const health = telehealthManager.getHealthStatus();
    console.log('📊 Health Status:', {
      healthy: health.healthy,
      deploymentMode: health.deploymentMode,
      componentCount: Object.keys(health.components).length
    });
    
    // Demonstrate video consultation
    const videoComponent = telehealthManager.getComponent('video-consultation');
    if (videoComponent) {
      console.log('🎥 Video consultation component available');
      // In a real application, you would create consultations here
    }
    
    // Demonstrate messaging
    const messagingComponent = telehealthManager.getComponent('messaging');
    if (messagingComponent) {
      console.log('💬 Messaging component available');
      // In a real application, you would create channels here
    }
    
    // Clean shutdown
    await telehealthManager.shutdown();
    console.log('🔄 Full suite shutdown completed');
    
  } catch (error) {
    console.error('❌ Full suite deployment failed:', error.message);
  }
}

// Example 2: Standalone Video Consultation Deployment
async function exampleStandaloneVideoDeployment() {
  console.log('\n🎥 Example: Standalone Video Consultation Deployment');
  
  const standaloneConfig: TelehealthConfig = {
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
          appId: 'webqx-video-only'
        },
        recording: {
          enabled: true,
          storage: 'local',
          retentionDays: 90
        },
        quality: {
          defaultResolution: '1080p',
          adaptiveBitrate: true,
          maxBitrate: 4000000
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

  try {
    const videoOnlyManager = new TelehealthManager(standaloneConfig);
    
    // Initialize standalone video component
    await videoOnlyManager.initialize();
    console.log('✅ Standalone video consultation initialized');
    
    // Get health status
    const health = videoOnlyManager.getHealthStatus();
    console.log('📊 Health Status:', {
      healthy: health.healthy,
      deploymentMode: health.deploymentMode,
      components: Object.keys(health.components)
    });
    
    // Demonstrate video functionality
    const videoComponent = videoOnlyManager.getComponent('video-consultation');
    if (videoComponent) {
      console.log('🎥 Creating demo video consultation...');
      
      // Create a sample consultation
      const consultation = await videoComponent.createConsultation({
        appointmentId: 'demo-apt-001',
        providerId: 'demo-provider-001',
        patientId: 'demo-patient-001',
        consultationType: 'routine',
        specialty: 'general'
      });
      
      console.log('✅ Demo consultation created:', {
        sessionId: consultation.sessionId,
        roomName: consultation.roomName,
        participants: consultation.participants
      });
      
      // Simulate joining the consultation
      const joinInfo = await videoComponent.joinConsultation(
        consultation.sessionId,
        'demo-provider-001',
        'provider'
      );
      
      console.log('🚪 Join information generated:', {
        hasJoinUrl: !!joinInfo.joinUrl,
        hasRoomConfig: !!joinInfo.roomConfig
      });
      
      // End the consultation
      await videoComponent.endConsultation(consultation.sessionId);
      console.log('🏁 Demo consultation ended');
    }
    
    // Clean shutdown
    await videoOnlyManager.shutdown();
    console.log('🔄 Standalone video deployment shutdown completed');
    
  } catch (error) {
    console.error('❌ Standalone video deployment failed:', error.message);
  }
}

// Example 3: Mixed Standalone Deployment (Video + Messaging)
async function exampleMixedStandaloneDeployment() {
  console.log('\n🔀 Example: Mixed Standalone Deployment (Video + Messaging)');
  
  const mixedConfig: TelehealthConfig = {
    deploymentMode: 'standalone',
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
          appId: 'webqx-mixed'
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
          userId: '@webqx-mixed:matrix.org',
          deviceId: 'MIXED_DEVICE'
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
        maxListeners: 50
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

  try {
    const mixedManager = new TelehealthManager(mixedConfig);
    
    // Initialize mixed deployment
    await mixedManager.initialize();
    console.log('✅ Mixed standalone deployment initialized');
    
    // Get health status
    const health = mixedManager.getHealthStatus();
    console.log('📊 Health Status:', {
      healthy: health.healthy,
      deploymentMode: health.deploymentMode,
      components: Object.keys(health.components)
    });
    
    // Demonstrate combined functionality
    const videoComponent = mixedManager.getComponent('video-consultation');
    const messagingComponent = mixedManager.getComponent('messaging');
    
    if (videoComponent && messagingComponent) {
      console.log('🎥💬 Both video and messaging components available');
      
      // Create messaging channel first
      const channel = await messagingComponent.createConsultationChannel('demo-consultation-001');
      console.log('💬 Consultation channel created:', channel.channelId);
      
      // Add participants to channel
      await messagingComponent.addParticipant(channel.channelId, 'demo-provider-001');
      await messagingComponent.addParticipant(channel.channelId, 'demo-patient-001');
      console.log('👥 Participants added to channel');
      
      // Send a welcome message
      const messageId = await messagingComponent.sendMessage(
        channel.channelId,
        'Welcome to your telehealth consultation. The video call will begin shortly.',
        'demo-provider-001',
        'text'
      );
      console.log('📩 Welcome message sent:', messageId);
      
      // Create video consultation
      const consultation = await videoComponent.createConsultation({
        appointmentId: 'demo-apt-002',
        providerId: 'demo-provider-001',
        patientId: 'demo-patient-001',
        consultationType: 'routine',
        specialty: 'telemedicine'
      });
      console.log('🎥 Video consultation created alongside messaging');
      
      // Send video link via message
      await messagingComponent.sendMessage(
        channel.channelId,
        `Your video consultation is ready. Join here: ${consultation.roomName}`,
        'demo-provider-001',
        'text'
      );
      console.log('🔗 Video link shared via messaging');
      
      // Clean up
      await videoComponent.endConsultation(consultation.sessionId);
      await messagingComponent.archiveChannel(channel.channelId);
      console.log('🧹 Consultation and channel cleaned up');
    }
    
    // Clean shutdown
    await mixedManager.shutdown();
    console.log('🔄 Mixed deployment shutdown completed');
    
  } catch (error) {
    console.error('❌ Mixed deployment failed:', error.message);
  }
}

// Run all examples
async function runExamples() {
  console.log('🚀 WebQX™ Telehealth Module Examples\n');
  console.log('='.repeat(50));
  
  await exampleFullSuiteDeployment();
  await exampleStandaloneVideoDeployment();
  await exampleMixedStandaloneDeployment();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ All examples completed successfully!');
  console.log('\n📚 For more information, see:');
  console.log('- README: modules/telehealth/README.md');
  console.log('- Documentation: modules/telehealth/docs/CONFIGURATION.md');
  console.log('- Deployment: modules/telehealth/deployment/README.md');
}

// Export for use in other files
export {
  exampleFullSuiteDeployment,
  exampleStandaloneVideoDeployment,
  exampleMixedStandaloneDeployment,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}