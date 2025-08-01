import { v4 as uuidv4 } from 'uuid';

/**
 * FHIR Messaging interfaces
 */
interface FHIRMessage {
  resourceType: 'Bundle';
  id: string;
  meta: {
    lastUpdated: string;
    profile: string[];
  };
  type: 'message';
  timestamp: string;
  entry: FHIRBundleEntry[];
}

interface FHIRBundleEntry {
  resource: any;
  fullUrl?: string;
}

interface PostVisitSummary {
  sessionId: string;
  patientId: string;
  providerId: string;
  visitDate: string;
  summary: string;
  diagnosis?: string[];
  medications?: any[];
  followUpInstructions?: string;
  nextAppointment?: string;
  language?: string;
}

interface FHIRMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveryStatus?: 'sent' | 'delivered' | 'failed';
}

/**
 * FHIR Messaging Service for Telehealth
 * 
 * Handles post-visit communication using FHIR Messaging standards
 * to send summaries, instructions, and follow-up information to patients.
 */
export class TelehealthMessagingService {
  private messagingEndpoint: string;
  private fhirServerUrl: string;

  constructor(config: { messagingEndpoint?: string; fhirServerUrl?: string } = {}) {
    this.messagingEndpoint = config.messagingEndpoint || '/fhir/messaging';
    this.fhirServerUrl = config.fhirServerUrl || '/fhir';
  }

  /**
   * Sends a post-visit summary to the patient
   * @param summary - Post-visit summary data
   * @returns Promise<FHIRMessageResponse>
   */
  async sendPostVisitSummary(summary: PostVisitSummary): Promise<FHIRMessageResponse> {
    try {
      const message = await this.createPostVisitMessage(summary);
      return await this.sendFHIRMessage(message);
    } catch (error) {
      console.error('[Telehealth Messaging] Failed to send post-visit summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Sends follow-up instructions to the patient
   * @param instructions - Follow-up instruction data
   * @returns Promise<FHIRMessageResponse>
   */
  async sendFollowUpInstructions(instructions: {
    sessionId: string;
    patientId: string;
    providerId: string;
    instructions: string;
    priority?: 'routine' | 'urgent' | 'asap' | 'stat';
    dueDate?: string;
    language?: string;
  }): Promise<FHIRMessageResponse> {
    try {
      const message = await this.createFollowUpMessage(instructions);
      return await this.sendFHIRMessage(message);
    } catch (error) {
      console.error('[Telehealth Messaging] Failed to send follow-up instructions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Creates a FHIR Message Bundle for post-visit summary
   * @param summary - Post-visit summary data
   * @returns Promise<FHIRMessage>
   */
  private async createPostVisitMessage(summary: PostVisitSummary): Promise<FHIRMessage> {
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create MessageHeader
    const messageHeader = {
      resourceType: 'MessageHeader',
      id: uuidv4(),
      meta: {
        lastUpdated: timestamp,
        profile: ['http://hl7.org/fhir/StructureDefinition/MessageHeader']
      },
      eventCoding: {
        system: 'http://terminology.hl7.org/CodeSystem/message-events',
        code: 'patient-summary',
        display: 'Patient Summary'
      },
      destination: [{
        name: 'Patient Portal',
        endpoint: `Patient/${summary.patientId}`
      }],
      sender: {
        reference: `Practitioner/${summary.providerId}`
      },
      source: {
        name: 'WebQX Telehealth Platform',
        endpoint: 'https://webqx.health/telehealth'
      },
      focus: [{
        reference: `Encounter/${summary.sessionId}`
      }]
    };

    // Create Communication resource for the summary
    const communication = {
      resourceType: 'Communication',
      id: uuidv4(),
      meta: {
        lastUpdated: timestamp,
        profile: ['http://hl7.org/fhir/StructureDefinition/Communication']
      },
      status: 'completed',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/communication-category',
          code: 'care-coordination',
          display: 'Care Coordination'
        }]
      }],
      subject: {
        reference: `Patient/${summary.patientId}`
      },
      sender: {
        reference: `Practitioner/${summary.providerId}`
      },
      sent: timestamp,
      payload: [{
        contentString: this.formatPostVisitSummary(summary)
      }],
      // Add telehealth-specific extensions
      extension: [
        {
          url: 'http://webqx.health/fhir/extensions/telehealth/session-id',
          valueString: summary.sessionId
        },
        {
          url: 'http://webqx.health/fhir/extensions/telehealth/message-type',
          valueString: 'post-visit-summary'
        }
      ]
    };

    // Add language extension if specified
    if (summary.language) {
      communication.extension.push({
        url: 'http://webqx.health/fhir/extensions/telehealth/language',
        valueString: summary.language
      });
    }

    // Create the message bundle
    const message: FHIRMessage = {
      resourceType: 'Bundle',
      id: messageId,
      meta: {
        lastUpdated: timestamp,
        profile: ['http://hl7.org/fhir/StructureDefinition/Bundle']
      },
      type: 'message',
      timestamp,
      entry: [
        {
          fullUrl: `MessageHeader/${messageHeader.id}`,
          resource: messageHeader
        },
        {
          fullUrl: `Communication/${communication.id}`,
          resource: communication
        }
      ]
    };

    // Add diagnosis resources if provided
    if (summary.diagnosis && summary.diagnosis.length > 0) {
      summary.diagnosis.forEach(diagnosisText => {
        const condition = {
          resourceType: 'Condition',
          id: uuidv4(),
          meta: {
            lastUpdated: timestamp,
            profile: ['http://hl7.org/fhir/StructureDefinition/Condition']
          },
          clinicalStatus: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active'
            }]
          },
          verificationStatus: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
              code: 'confirmed'
            }]
          },
          code: {
            text: diagnosisText
          },
          subject: {
            reference: `Patient/${summary.patientId}`
          },
          recordedDate: summary.visitDate
        };

        message.entry.push({
          fullUrl: `Condition/${condition.id}`,
          resource: condition
        });
      });
    }

    return message;
  }

  /**
   * Creates a FHIR Message Bundle for follow-up instructions
   */
  private async createFollowUpMessage(instructions: any): Promise<FHIRMessage> {
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    const messageHeader = {
      resourceType: 'MessageHeader',
      id: uuidv4(),
      meta: {
        lastUpdated: timestamp,
        profile: ['http://hl7.org/fhir/StructureDefinition/MessageHeader']
      },
      eventCoding: {
        system: 'http://terminology.hl7.org/CodeSystem/message-events',
        code: 'care-plan-update',
        display: 'Care Plan Update'
      },
      destination: [{
        name: 'Patient Portal',
        endpoint: `Patient/${instructions.patientId}`
      }],
      sender: {
        reference: `Practitioner/${instructions.providerId}`
      },
      source: {
        name: 'WebQX Telehealth Platform',
        endpoint: 'https://webqx.health/telehealth'
      }
    };

    const communication = {
      resourceType: 'Communication',
      id: uuidv4(),
      meta: {
        lastUpdated: timestamp,
        profile: ['http://hl7.org/fhir/StructureDefinition/Communication']
      },
      status: 'completed',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/communication-category',
          code: 'instruction',
          display: 'Instruction'
        }]
      }],
      priority: instructions.priority || 'routine',
      subject: {
        reference: `Patient/${instructions.patientId}`
      },
      sender: {
        reference: `Practitioner/${instructions.providerId}`
      },
      sent: timestamp,
      payload: [{
        contentString: instructions.instructions
      }],
      extension: [
        {
          url: 'http://webqx.health/fhir/extensions/telehealth/session-id',
          valueString: instructions.sessionId
        },
        {
          url: 'http://webqx.health/fhir/extensions/telehealth/message-type',
          valueString: 'follow-up-instructions'
        }
      ]
    };

    if (instructions.language) {
      communication.extension.push({
        url: 'http://webqx.health/fhir/extensions/telehealth/language',
        valueString: instructions.language
      });
    }

    if (instructions.dueDate) {
      communication.extension.push({
        url: 'http://webqx.health/fhir/extensions/telehealth/due-date',
        valueDateTime: instructions.dueDate
      });
    }

    return {
      resourceType: 'Bundle',
      id: messageId,
      meta: {
        lastUpdated: timestamp,
        profile: ['http://hl7.org/fhir/StructureDefinition/Bundle']
      },
      type: 'message',
      timestamp,
      entry: [
        {
          fullUrl: `MessageHeader/${messageHeader.id}`,
          resource: messageHeader
        },
        {
          fullUrl: `Communication/${communication.id}`,
          resource: communication
        }
      ]
    };
  }

  /**
   * Formats the post-visit summary into a readable format
   */
  private formatPostVisitSummary(summary: PostVisitSummary): string {
    let formatted = `Post-Visit Summary\n`;
    formatted += `Visit Date: ${new Date(summary.visitDate).toLocaleDateString()}\n\n`;
    formatted += `Summary:\n${summary.summary}\n\n`;

    if (summary.diagnosis && summary.diagnosis.length > 0) {
      formatted += `Diagnosis:\n`;
      summary.diagnosis.forEach(dx => {
        formatted += `• ${dx}\n`;
      });
      formatted += '\n';
    }

    if (summary.medications && summary.medications.length > 0) {
      formatted += `Medications:\n`;
      summary.medications.forEach(med => {
        formatted += `• ${med.name || med.display || med}\n`;
      });
      formatted += '\n';
    }

    if (summary.followUpInstructions) {
      formatted += `Follow-up Instructions:\n${summary.followUpInstructions}\n\n`;
    }

    if (summary.nextAppointment) {
      formatted += `Next Appointment: ${summary.nextAppointment}\n`;
    }

    formatted += `\nIf you have any questions, please contact your healthcare provider.`;

    return formatted;
  }

  /**
   * Sends a FHIR message to the messaging endpoint
   */
  private async sendFHIRMessage(message: FHIRMessage): Promise<FHIRMessageResponse> {
    try {
      const response = await fetch(this.messagingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
          'Accept': 'application/fhir+json'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        messageId: message.id,
        deliveryStatus: 'sent'
      };

    } catch (error) {
      console.error('[Telehealth Messaging] Message delivery failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Message delivery failed'
      };
    }
  }

  /**
   * Gets message templates for different types of communications
   */
  getMessageTemplates() {
    return {
      postVisitSummary: {
        title: 'Post-Visit Summary',
        template: `Your telehealth appointment on {visitDate} has been completed.

Summary: {summary}

Diagnosis: {diagnosis}

Medications: {medications}

Follow-up Instructions: {followUpInstructions}

Next Appointment: {nextAppointment}

Please contact us if you have any questions.`
      },
      followUpInstructions: {
        title: 'Follow-up Instructions',
        template: `Follow-up instructions from your recent telehealth visit:

{instructions}

Priority: {priority}
Due Date: {dueDate}

Please follow these instructions carefully and contact us if you have questions.`
      },
      appointmentReminder: {
        title: 'Appointment Reminder',
        template: `This is a reminder of your upcoming telehealth appointment:

Date: {appointmentDate}
Time: {appointmentTime}
Provider: {providerName}

Join the session 5-10 minutes early to test your connection.`
      }
    };
  }

  /**
   * Validates a FHIR message before sending
   */
  private validateMessage(message: FHIRMessage): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (message.resourceType !== 'Bundle') {
      errors.push('Message must be a Bundle resource');
    }

    if (message.type !== 'message') {
      errors.push('Bundle type must be "message"');
    }

    if (!message.entry || message.entry.length === 0) {
      errors.push('Message must contain at least one entry');
    }

    const messageHeader = message.entry.find(entry => 
      entry.resource?.resourceType === 'MessageHeader'
    );

    if (!messageHeader) {
      errors.push('Message must contain a MessageHeader');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}