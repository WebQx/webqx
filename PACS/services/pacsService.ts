/**
 * PACS Service
 * 
 * Core service for Picture Archiving and Communication System operations.
 * Handles DICOM queries, study retrieval, and integration with multiple PACS servers.
 */

import { 
  PACSServerConfig, 
  DICOMStudy, 
  ImagingSearchCriteria, 
  ImagingSearchResult,
  PACSResponse,
  ImagingSession,
  PatientImagingAccess
} from '../types';
import { defaultPACSServers, pacsConfig } from '../config/pacsConfig';

export class PACSService {
  private servers: Map<string, PACSServerConfig> = new Map();
  private primaryServer: PACSServerConfig | null = null;

  constructor(customServers?: PACSServerConfig[]) {
    this.initializeServers(customServers || defaultPACSServers);
  }

  /**
   * Initialize PACS servers configuration
   */
  private initializeServers(servers: PACSServerConfig[]): void {
    this.servers.clear();
    
    servers.forEach(server => {
      if (server.isActive) {
        this.servers.set(server.id, server);
        
        // Set primary server
        if (server.id === pacsConfig.primaryServer) {
          this.primaryServer = server;
        }
      }
    });

    // If no primary server found, use the first available
    if (!this.primaryServer && this.servers.size > 0) {
      this.primaryServer = Array.from(this.servers.values())[0];
    }

    if (pacsConfig.enableAuditLogging) {
      console.log(`[PACS Service] Initialized with ${this.servers.size} active servers`);
    }
  }

  /**
   * Search for imaging studies based on criteria
   */
  async searchStudies(criteria: ImagingSearchCriteria): Promise<PACSResponse<ImagingSearchResult>> {
    if (!this.primaryServer) {
      return {
        success: false,
        error: {
          code: 'NO_PACS_SERVER',
          message: 'No active PACS server available'
        }
      };
    }

    try {
      const searchResult = await this.performStudySearch(this.primaryServer, criteria);
      
      return {
        success: true,
        data: searchResult,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: this.primaryServer.id
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Search operation failed',
          details: { criteria }
        }
      };
    }
  }

  /**
   * Get detailed study information
   */
  async getStudyDetails(studyInstanceUID: string): Promise<PACSResponse<DICOMStudy>> {
    if (!this.primaryServer) {
      return {
        success: false,
        error: {
          code: 'NO_PACS_SERVER',
          message: 'No active PACS server available'
        }
      };
    }

    try {
      const study = await this.retrieveStudyDetails(this.primaryServer, studyInstanceUID);
      
      return {
        success: true,
        data: study,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: this.primaryServer.id
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'STUDY_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Study retrieval failed',
          details: { studyInstanceUID }
        }
      };
    }
  }

  /**
   * Create patient imaging session for secure viewing
   */
  async createPatientSession(
    patientID: string, 
    studyInstanceUID: string,
    accessType: 'view' | 'download' | 'share' = 'view'
  ): Promise<PACSResponse<ImagingSession>> {
    try {
      // Verify patient access permissions
      const hasAccess = await this.verifyPatientAccess(patientID, studyInstanceUID, accessType);
      
      if (!hasAccess) {
        return {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Patient does not have access to this study'
          }
        };
      }

      const session: ImagingSession = {
        sessionID: this.generateSessionId(),
        patientID,
        studyInstanceUID,
        viewerType: 'ohif',
        startTime: new Date().toISOString(),
        actions: []
      };

      return {
        success: true,
        data: session,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: this.primaryServer?.id || 'unknown'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SESSION_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Session creation failed'
        }
      };
    }
  }

  /**
   * Get viewer URL for embedding
   */
  getViewerURL(studyInstanceUID: string, sessionID?: string): string {
    const viewerServer = Array.from(this.servers.values())
      .find(server => server.type === 'ohif' && server.isActive);

    if (!viewerServer) {
      throw new Error('No OHIF viewer server available');
    }

    const baseUrl = `${viewerServer.protocol}://${viewerServer.baseUrl}:${viewerServer.port}`;
    const params = new URLSearchParams({
      studyInstanceUIDs: studyInstanceUID
    });

    if (sessionID) {
      params.set('sessionId', sessionID);
    }

    return `${baseUrl}/viewer?${params.toString()}`;
  }

  /**
   * Verify patient access to imaging study
   */
  private async verifyPatientAccess(
    patientID: string, 
    studyInstanceUID: string, 
    accessType: string
  ): Promise<boolean> {
    // In a real implementation, this would check:
    // 1. Patient consent records
    // 2. Provider sharing permissions
    // 3. Study ownership/association
    // 4. Access expiry dates
    // 5. Compliance requirements

    if (!pacsConfig.enablePatientAccess) {
      return false;
    }

    // Mock implementation - in real scenario, query database
    return true;
  }

  /**
   * Perform study search against PACS server
   */
  private async performStudySearch(
    server: PACSServerConfig, 
    criteria: ImagingSearchCriteria
  ): Promise<ImagingSearchResult> {
    // Mock implementation - in real scenario, make actual PACS API calls
    const mockStudies: DICOMStudy[] = [
      {
        studyInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.78',
        patientID: criteria.patientID || 'PAT001',
        patientName: 'Test^Patient',
        studyDate: '20240115',
        studyTime: '143000',
        studyDescription: 'Chest CT',
        numberOfSeries: 1,
        numberOfImages: 120,
        modalities: ['CT'],
        series: []
      }
    ];

    return {
      total: mockStudies.length,
      studies: mockStudies.slice(0, criteria.limit || 10),
      hasMore: mockStudies.length > (criteria.limit || 10)
    };
  }

  /**
   * Retrieve detailed study information
   */
  private async retrieveStudyDetails(
    server: PACSServerConfig, 
    studyInstanceUID: string
  ): Promise<DICOMStudy> {
    // Mock implementation - in real scenario, make actual PACS API calls
    return {
      studyInstanceUID,
      patientID: 'PAT001',
      patientName: 'Test^Patient',
      studyDate: '20240115',
      studyTime: '143000',
      studyDescription: 'Chest CT',
      numberOfSeries: 1,
      numberOfImages: 120,
      modalities: ['CT'],
      series: [
        {
          seriesInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.79',
          studyInstanceUID,
          seriesNumber: 1,
          modality: 'CT',
          seriesDescription: 'Axial Chest',
          numberOfImages: 120,
          instances: []
        }
      ]
    };
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `pacs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get available PACS servers
   */
  getAvailableServers(): PACSServerConfig[] {
    return Array.from(this.servers.values());
  }

  /**
   * Test connection to PACS server
   */
  async testConnection(serverId: string): Promise<PACSResponse<boolean>> {
    const server = this.servers.get(serverId);
    
    if (!server) {
      return {
        success: false,
        error: {
          code: 'SERVER_NOT_FOUND',
          message: `PACS server '${serverId}' not found`
        }
      };
    }

    try {
      // Mock connection test - in real scenario, ping the server
      const isConnected = true;
      
      return {
        success: true,
        data: isConnected,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: serverId
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: error instanceof Error ? error.message : 'Connection test failed'
        }
      };
    }
  }
}