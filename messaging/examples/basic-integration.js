/**
 * WebQX™ Messaging Basic Integration Example
 * 
 * Demonstrates basic integration of the Matrix-based messaging infrastructure
 * with WebQX™ healthcare platform. Shows common usage patterns and best practices.
 */

const { MatrixMessaging } = require('../core/matrix-client');
const { PatientProviderChannel } = require('../channels/patient-provider');
const { ProviderAdminChannel } = require('../channels/provider-admin');
const { SpecialtyChannels } = require('../channels/specialty-channels');
const { EncryptionManager } = require('../core/encryption');
const config = require('../core/config');

class WebQXMessagingExample {
  constructor() {
    this.messaging = null;
    this.patientProviderChannels = null;
    this.adminChannels = null;
    this.specialtyChannels = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the messaging system
   */
  async initialize() {
    try {
      console.log('🏥 Initializing WebQX™ Messaging System...');

      // Initialize core Matrix messaging client
      this.messaging = new MatrixMessaging({
        homeserverUrl: config.MATRIX_HOMESERVER_URL,
        accessToken: config.MATRIX_ACCESS_TOKEN,
        userId: config.MATRIX_USER_ID,
        deviceId: config.MATRIX_DEVICE_ID,
        enableE2EE: config.MATRIX_ENABLE_E2EE
      });

      // Start the Matrix client
      await this.messaging.start();
      console.log('✅ Matrix client connected successfully');

      // Initialize channel managers
      this.patientProviderChannels = new PatientProviderChannel(this.messaging, {
        enableEncryption: true,
        enableFileSharing: true,
        maxParticipants: 10
      });

      this.adminChannels = new ProviderAdminChannel(this.messaging, {
        enableEncryption: true,
        enableBroadcast: true,
        requireAdminApproval: false
      });

      this.specialtyChannels = new SpecialtyChannels(this.messaging, {
        enableEncryption: true,
        enableSpecialtyBots: true,
        enableCrossSpecialtyConsults: true
      });

      // Register example plugins (if available)
      await this.registerExamplePlugins();

      this.isInitialized = true;
      console.log('🎉 WebQX™ Messaging System initialized successfully!');

      return true;

    } catch (error) {
      console.error('❌ Failed to initialize messaging system:', error.message);
      throw error;
    }
  }

  /**
   * Example: Create a patient-provider communication channel
   */
  async createPatientProviderExample() {
    if (!this.isInitialized) {
      throw new Error('Messaging system not initialized');
    }

    console.log('\n📱 Creating Patient-Provider Channel Example...');

    try {
      // Create a channel between patient and primary care provider
      const roomId = await this.patientProviderChannels.createPatientProviderChannel(
        '@patient-john-doe:matrix.webqx.health',
        '@dr-smith:matrix.webqx.health',
        {
          specialty: 'primary-care',
          patientName: 'John Doe',
          providerName: 'Dr. Smith',
          careTeamMembers: [
            '@nurse-jane:matrix.webqx.health'
          ]
        }
      );

      console.log(`✅ Patient-Provider channel created: ${roomId}`);

      // Send a sample message
      const messageId = await this.patientProviderChannels.sendMessage(
        roomId,
        '@dr-smith:matrix.webqx.health',
        'Hello John, this is Dr. Smith. How are you feeling today?',
        {
          urgency: 'normal',
          messageType: 'check_in'
        }
      );

      console.log(`📩 Message sent: ${messageId}`);

      // Simulate file sharing (lab results)
      if (typeof window !== 'undefined' && window.File) {
        // Browser environment - create a mock file
        const mockLabResults = new File(
          ['Mock lab results content'],
          'lab-results-2024.pdf',
          { type: 'application/pdf' }
        );

        const fileEventId = await this.patientProviderChannels.shareFile(
          roomId,
          '@dr-smith:matrix.webqx.health',
          mockLabResults,
          {
            documentType: 'lab_result',
            patientId: '@patient-john-doe:matrix.webqx.health'
          }
        );

        console.log(`📄 Lab results shared: ${fileEventId}`);
      }

      return roomId;

    } catch (error) {
      console.error('❌ Failed to create patient-provider channel:', error.message);
      throw error;
    }
  }

  /**
   * Example: Create an administrative broadcast
   */
  async createAdminBroadcastExample() {
    if (!this.isInitialized) {
      throw new Error('Messaging system not initialized');
    }

    console.log('\n📢 Creating Admin Broadcast Example...');

    try {
      // Create an admin channel for policy updates
      const adminRoomId = await this.adminChannels.createProviderAdminChannel(
        '@admin-sarah:matrix.webqx.health',
        {
          channelType: 'policy_updates',
          department: 'Quality Assurance',
          isBroadcast: true,
          topic: 'Policy updates and quality assurance announcements'
        }
      );

      console.log(`✅ Admin channel created: ${adminRoomId}`);

      // Send a policy update broadcast
      const broadcast = await this.adminChannels.sendPolicyUpdate(
        'POLICY-2024-001',
        '2.1',
        {
          summary: 'Updated patient communication protocols',
          effectiveDate: '2024-02-01',
          changes: [
            'All patient communications must be documented in EHR within 24 hours',
            'Critical lab results require immediate notification protocols',
            'Telehealth consultations now require encrypted messaging platforms'
          ],
          actionRequired: 'Review new protocols and acknowledge understanding',
          deadline: '2024-01-15'
        },
        {
          senderId: '@admin-sarah:matrix.webqx.health',
          priority: 'high',
          department: 'Quality Assurance'
        }
      );

      console.log(`📋 Policy update broadcast: ${broadcast.broadcastId}`);

      return adminRoomId;

    } catch (error) {
      console.error('❌ Failed to create admin broadcast:', error.message);
      throw error;
    }
  }

  /**
   * Example: Create a specialty consultation
   */
  async createSpecialtyConsultationExample() {
    if (!this.isInitialized) {
      throw new Error('Messaging system not initialized');
    }

    console.log('\n🩺 Creating Specialty Consultation Example...');

    try {
      // Create a cardiology consultation channel
      const specialtyRoomId = await this.specialtyChannels.createSpecialtyChannel(
        'cardiology',
        '@dr-cardiologist:matrix.webqx.health',
        {
          channelType: 'case_discussion',
          department: 'Cardiovascular',
          teamMembers: [
            '@cardiac-nurse:matrix.webqx.health',
            '@echo-tech:matrix.webqx.health'
          ]
        }
      );

      console.log(`✅ Cardiology channel created: ${specialtyRoomId}`);

      // Create a cross-specialty consultation
      const consultation = await this.specialtyChannels.createConsultationChannel(
        'primary-care',
        'cardiology',
        '@dr-smith:matrix.webqx.health',
        {
          patientId: '@patient-john-doe:matrix.webqx.health',
          caseId: 'CASE-2024-001',
          urgency: 'urgent',
          reason: 'Patient presenting with chest pain and elevated troponins. Need cardiology evaluation for possible ACS.'
        }
      );

      console.log(`🔄 Consultation created: ${consultation.consultationId}`);

      // Add a cardiologist to the consultation
      await this.specialtyChannels.addSpecialistToConsultation(
        consultation.roomId,
        '@dr-cardiologist:matrix.webqx.health',
        '@dr-smith:matrix.webqx.health',
        'consultant'
      );

      // Send consultation message with clinical data
      const consultMessageId = await this.specialtyChannels.sendSpecialtyMessage(
        consultation.roomId,
        '@dr-cardiologist:matrix.webqx.health',
        'Based on the ECG and troponin levels, recommend immediate cardiac catheterization. Will see patient in next 30 minutes.',
        {
          messageType: 'clinical_recommendation',
          urgency: 'urgent',
          clinicalRecommendation: {
            recommendation: 'Immediate cardiac catheterization',
            reasoning: 'Elevated troponins with ECG changes suggestive of STEMI',
            timeline: 'Within 30 minutes'
          }
        }
      );

      console.log(`💬 Consultation message sent: ${consultMessageId}`);

      return consultation.roomId;

    } catch (error) {
      console.error('❌ Failed to create specialty consultation:', error.message);
      throw error;
    }
  }

  /**
   * Example: Handle emergency communication
   */
  async handleEmergencyExample() {
    if (!this.isInitialized) {
      throw new Error('Messaging system not initialized');
    }

    console.log('\n🚨 Handling Emergency Communication Example...');

    try {
      // Create emergency broadcast
      const emergencyBroadcast = await this.adminChannels.broadcastToProviders(
        '@admin-emergency:matrix.webqx.health',
        '🚨 HOSPITAL EMERGENCY ALERT 🚨\n\nMass casualty incident reported. All available staff report to Emergency Department immediately. Activate disaster protocols.',
        {
          broadcastType: 'emergency',
          priority: 'critical',
          requiresAck: true,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
        }
      );

      console.log(`🚨 Emergency broadcast sent: ${emergencyBroadcast.broadcastId}`);

      // Create emergency consultation for critical patient
      const emergencyConsult = await this.specialtyChannels.createConsultationChannel(
        'emergency-medicine',
        'trauma-surgery',
        '@dr-emergency:matrix.webqx.health',
        {
          patientId: '@patient-trauma-001:matrix.webqx.health',
          urgency: 'critical',
          reason: 'Multi-trauma patient with internal bleeding. Need immediate surgical evaluation.'
        }
      );

      console.log(`⚡ Emergency consultation: ${emergencyConsult.consultationId}`);

      return emergencyBroadcast.broadcastId;

    } catch (error) {
      console.error('❌ Failed to handle emergency communication:', error.message);
      throw error;
    }
  }

  /**
   * Register example plugins
   */
  async registerExamplePlugins() {
    try {
      // Example logging plugin
      const loggingPlugin = {
        name: 'message-logger',
        version: '1.0.0',
        enabled: true,
        
        async onMessage(message, channel) {
          console.log(`📝 Plugin logged message in ${channel.channelType} channel:`, {
            content: `${message.body?.substring(0, 50)  }...`,
            sender: message['webqx.metadata']?.senderId,
            specialty: message['webqx.metadata']?.specialty
          });
        },

        async onFileUpload(file, options) {
          console.log(`📎 Plugin logged file upload:`, {
            filename: file.name,
            size: file.size,
            type: options.documentType,
            patientId: options.patientId
          });
        }
      };

      this.messaging.registerPlugin('message-logger', loggingPlugin);
      console.log('🔌 Example logging plugin registered');

    } catch (error) {
      console.log('⚠️ Plugin registration failed (this is expected in example):', error.message);
    }
  }

  /**
   * Get system status and statistics
   */
  async getSystemStatus() {
    if (!this.isInitialized) {
      return { error: 'System not initialized' };
    }

    try {
      const status = {
        messaging: this.messaging.getStatus(),
        patientProviderChannels: this.patientProviderChannels.getChannelStats(),
        adminChannels: this.adminChannels.getAdminChannelStats(),
        specialtyChannels: this.specialtyChannels.getSpecialtyChannelStats(),
        timestamp: new Date().toISOString()
      };

      console.log('\n📊 System Status:', JSON.stringify(status, null, 2));
      return status;

    } catch (error) {
      console.error('❌ Failed to get system status:', error.message);
      throw error;
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    if (this.messaging) {
      console.log('\n🔌 Shutting down WebQX™ Messaging System...');
      await this.messaging.stop();
      console.log('✅ Messaging system shutdown complete');
    }
  }

  /**
   * Run complete example workflow
   */
  async runCompleteExample() {
    try {
      console.log('🚀 Starting WebQX™ Messaging Integration Example\n');

      // Initialize the system
      await this.initialize();

      // Wait a moment for initialization to complete
      await this.delay(1000);

      // Run examples
      await this.createPatientProviderExample();
      await this.delay(1000);

      await this.createAdminBroadcastExample();
      await this.delay(1000);

      await this.createSpecialtyConsultationExample();
      await this.delay(1000);

      await this.handleEmergencyExample();
      await this.delay(1000);

      // Show final status
      await this.getSystemStatus();

      console.log('\n🎉 All examples completed successfully!');
      console.log('\n📚 What was demonstrated:');
      console.log('   ✓ Patient-Provider secure communication');
      console.log('   ✓ Administrative broadcasts and policy updates');
      console.log('   ✓ Specialty consultations and cross-specialty collaboration');
      console.log('   ✓ Emergency communication protocols');
      console.log('   ✓ File sharing and document management');
      console.log('   ✓ Audit logging and compliance tracking');
      console.log('   ✓ Plugin system integration');

    } catch (error) {
      console.error('\n❌ Example workflow failed:', error.message);
      throw error;
    } finally {
      // Cleanup
      setTimeout(() => this.shutdown(), 2000);
    }
  }

  /**
   * Utility function for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use in other modules
module.exports = { WebQXMessagingExample };

// If running directly, execute the example
if (require.main === module) {
  const example = new WebQXMessagingExample();
  
  example.runCompleteExample()
    .then(() => {
      console.log('\n✨ Example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Example failed:', error);
      process.exit(1);
    });
}

// Usage examples for different scenarios:

/**
 * Basic Usage Example:
 * 
 * const { WebQXMessagingExample } = require('./messaging/examples/basic-integration');
 * 
 * const messaging = new WebQXMessagingExample();
 * await messaging.initialize();
 * 
 * // Create patient-provider channel
 * const roomId = await messaging.createPatientProviderExample();
 * 
 * // Send message
 * await messaging.patientProviderChannels.sendMessage(
 *   roomId, 
 *   '@provider:matrix.webqx.health', 
 *   'How are you feeling today?'
 * );
 */

/**
 * Advanced Usage Example:
 * 
 * // Custom configuration
 * const messaging = new MatrixMessaging({
 *   homeserverUrl: 'https://your-matrix-server.com',
 *   accessToken: 'your-access-token',
 *   enableE2EE: true,
 *   enableAuditLogging: true
 * });
 * 
 * // Start messaging
 * await messaging.start();
 * 
 * // Create channels with custom options
 * const patientChannels = new PatientProviderChannel(messaging, {
 *   maxParticipants: 15,
 *   enableFileSharing: true,
 *   messageRetentionDays: 2555
 * });
 */

/**
 * Integration with WebQX™ Platform:
 * 
 * // In your WebQX™ application
 * import { MatrixMessaging, PatientProviderChannel } from './messaging/core/matrix-client';
 * 
 * class HealthcarePlatform {
 *   async initializeMessaging() {
 *     this.messaging = new MatrixMessaging(this.config.messaging);
 *     await this.messaging.start();
 *     
 *     this.patientChannels = new PatientProviderChannel(this.messaging);
 *   }
 * 
 *   async createPatientChannel(patientId, providerId) {
 *     return await this.patientChannels.createPatientProviderChannel(
 *       patientId, 
 *       providerId,
 *       { specialty: this.getProviderSpecialty(providerId) }
 *     );
 *   }
 * }
 */