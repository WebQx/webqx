/**
 * WebQX™ Orthanc PACS Integration - Cloud Storage Plugin
 * Enables cloud storage for DICOM files with configurable retention policies
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { 
  CloudStorageConfig, 
  StorageMetadata, 
  DicomEvent,
  PluginConfig,
  HealthStatus 
} from '../types';
import { OrthancClient } from '../utils/orthancClient';

export class CloudStoragePlugin extends EventEmitter {
  private config: CloudStorageConfig;
  private pluginConfig: PluginConfig;
  private orthancClient: OrthancClient;
  private storageProvider: CloudStorageProvider;
  private storageIndex: Map<string, StorageMetadata> = new Map();
  private isInitialized = false;

  constructor(
    config: CloudStorageConfig,
    pluginConfig: PluginConfig,
    orthancClient: OrthancClient
  ) {
    super();
    this.config = config;
    this.pluginConfig = pluginConfig;
    this.orthancClient = orthancClient;
    this.storageProvider = this.createStorageProvider();
  }

  /**
   * Initialize the cloud storage plugin
   */
  async initialize(): Promise<void> {
    try {
      // Validate configuration
      await this.validateConfiguration();
      
      // Initialize storage provider
      await this.storageProvider.initialize();
      
      // Load existing storage index
      await this.loadStorageIndex();
      
      // Set up event listeners for DICOM events
      this.setupEventListeners();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('[Cloud Storage Plugin] Successfully initialized');
    } catch (error) {
      this.emit('error', {
        code: 'INITIALIZATION_FAILED',
        message: 'Failed to initialize cloud storage plugin',
        details: error,
        timestamp: new Date(),
        pluginName: 'CloudStoragePlugin',
        severity: 'critical'
      });
      throw error;
    }
  }

  /**
   * Get health status of the plugin
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      if (!this.isInitialized) {
        return {
          status: 'unhealthy',
          message: 'Plugin not initialized',
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      // Check storage provider health
      const providerHealth = await this.storageProvider.healthCheck();
      
      // Check Orthanc connectivity
      const orthancHealth = await this.orthancClient.healthCheck();

      if (!orthancHealth) {
        return {
          status: 'degraded',
          message: 'Orthanc server not accessible',
          details: { orthancHealth, providerHealth },
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      if (!providerHealth) {
        return {
          status: 'degraded',
          message: 'Cloud storage provider not accessible',
          details: { orthancHealth, providerHealth },
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      return {
        status: 'healthy',
        message: 'All systems operational',
        details: { 
          orthancHealth, 
          providerHealth,
          storedFiles: this.storageIndex.size,
          provider: this.config.provider
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Health check failed',
        details: error,
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  }

  /**
   * Handle DICOM file storage event
   */
  async handleDicomEvent(event: DicomEvent): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Plugin not initialized');
    }

    switch (event.type) {
      case 'study_created':
      case 'instance_uploaded':
        if (event.instanceId) {
          await this.storeInstance(event.instanceId);
        } else if (event.studyId) {
          await this.storeStudy(event.studyId);
        }
        break;
      case 'study_deleted':
        if (event.studyId) {
          await this.deleteStudyFromCloud(event.studyId);
        }
        break;
    }
  }

  /**
   * Store a single DICOM instance in cloud storage
   */
  async storeInstance(instanceId: string): Promise<StorageMetadata> {
    try {
      // Check if already stored
      const existing = this.storageIndex.get(instanceId);
      if (existing && !this.shouldRestore(existing)) {
        existing.lastAccessedAt = new Date();
        return existing;
      }

      // Download DICOM file from Orthanc
      const fileResponse = await this.orthancClient.downloadDicomFile(instanceId);
      if (!fileResponse.success || !fileResponse.data) {
        throw new Error(`Failed to download instance ${instanceId} from Orthanc`);
      }

      // Get instance metadata
      const tagsResponse = await this.orthancClient.getInstanceTags(instanceId);
      const tags = tagsResponse.data || {};

      // Generate cloud path
      const cloudPath = this.generateCloudPath(instanceId, tags);
      
      // Calculate checksum
      const checksum = this.calculateChecksum(fileResponse.data);

      // Upload to cloud storage
      await this.storageProvider.uploadFile(
        cloudPath,
        fileResponse.data,
        {
          contentType: 'application/dicom',
          metadata: {
            instanceId,
            patientId: tags.PatientID || '',
            studyInstanceUID: tags.StudyInstanceUID || '',
            seriesInstanceUID: tags.SeriesInstanceUID || '',
            sopInstanceUID: tags.SOPInstanceUID || '',
            modality: tags.Modality || '',
            checksum
          }
        }
      );

      // Create storage metadata
      const storageMetadata: StorageMetadata = {
        originalPath: `/instances/${instanceId}`,
        cloudPath,
        uploadedAt: new Date(),
        lastAccessedAt: new Date(),
        fileSize: fileResponse.data.byteLength,
        checksum,
        isArchived: false,
        encryptionKey: this.config.encryptionEnabled ? this.generateEncryptionKey() : undefined
      };

      // Update storage index
      this.storageIndex.set(instanceId, storageMetadata);
      await this.saveStorageIndex();

      this.emit('instance_stored', { instanceId, metadata: storageMetadata });

      return storageMetadata;
    } catch (error) {
      this.emit('error', {
        code: 'STORAGE_FAILED',
        message: `Failed to store instance ${instanceId}`,
        details: error,
        timestamp: new Date(),
        pluginName: 'CloudStoragePlugin',
        severity: 'high'
      });
      throw error;
    }
  }

  /**
   * Store all instances in a study
   */
  async storeStudy(studyId: string): Promise<StorageMetadata[]> {
    const seriesResponse = await this.orthancClient.getStudySeries(studyId);
    if (!seriesResponse.success || !seriesResponse.data) {
      throw new Error(`Failed to get series for study ${studyId}`);
    }

    const results: StorageMetadata[] = [];
    
    for (const seriesId of seriesResponse.data) {
      const instancesResponse = await this.orthancClient.getSeriesInstances(seriesId);
      if (instancesResponse.success && instancesResponse.data) {
        for (const instanceId of instancesResponse.data) {
          try {
            const metadata = await this.storeInstance(instanceId);
            results.push(metadata);
          } catch (error) {
            console.error(`Failed to store instance ${instanceId}:`, error);
          }
        }
      }
    }

    return results;
  }

  /**
   * Retrieve a DICOM instance from cloud storage
   */
  async retrieveInstance(instanceId: string): Promise<ArrayBuffer> {
    const metadata = this.storageIndex.get(instanceId);
    if (!metadata) {
      throw new Error(`Instance ${instanceId} not found in cloud storage`);
    }

    try {
      const fileData = await this.storageProvider.downloadFile(metadata.cloudPath);
      
      // Verify checksum
      const checksum = this.calculateChecksum(fileData);
      if (checksum !== metadata.checksum) {
        throw new Error(`Checksum mismatch for instance ${instanceId}`);
      }

      // Update last accessed time
      metadata.lastAccessedAt = new Date();
      await this.saveStorageIndex();

      return fileData;
    } catch (error) {
      this.emit('error', {
        code: 'RETRIEVAL_FAILED',
        message: `Failed to retrieve instance ${instanceId}`,
        details: error,
        timestamp: new Date(),
        pluginName: 'CloudStoragePlugin',
        severity: 'high'
      });
      throw error;
    }
  }

  /**
   * Delete study from cloud storage
   */
  async deleteStudyFromCloud(studyId: string): Promise<void> {
    const instancesToDelete: string[] = [];
    
    // Find all instances for this study
    for (const [instanceId, metadata] of this.storageIndex.entries()) {
      if (metadata.originalPath.includes(studyId)) {
        instancesToDelete.push(instanceId);
      }
    }

    // Delete from cloud storage
    for (const instanceId of instancesToDelete) {
      const metadata = this.storageIndex.get(instanceId);
      if (metadata) {
        try {
          await this.storageProvider.deleteFile(metadata.cloudPath);
          this.storageIndex.delete(instanceId);
        } catch (error) {
          console.error(`Failed to delete instance ${instanceId} from cloud:`, error);
        }
      }
    }

    await this.saveStorageIndex();
  }

  /**
   * Apply retention policies
   */
  async applyRetentionPolicies(): Promise<void> {
    const now = new Date();
    const instancesToArchive: string[] = [];
    const instancesToDelete: string[] = [];

    for (const [instanceId, metadata] of this.storageIndex.entries()) {
      const daysSinceUpload = Math.floor((now.getTime() - metadata.uploadedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      // Get modality-specific retention
      const modality = await this.getInstanceModality(instanceId);
      const retentionDays = this.config.retentionPolicy.modalitySpecificRetention[modality] || 
                           this.config.retentionPolicy.defaultRetentionDays;

      // Check for archival
      if (daysSinceUpload >= this.config.retentionPolicy.archiveAfterDays && !metadata.isArchived) {
        instancesToArchive.push(instanceId);
      }

      // Check for deletion (if policy is set)
      if (this.config.retentionPolicy.deleteAfterDays && 
          daysSinceUpload >= this.config.retentionPolicy.deleteAfterDays) {
        instancesToDelete.push(instanceId);
      }
    }

    // Archive instances
    for (const instanceId of instancesToArchive) {
      await this.archiveInstance(instanceId);
    }

    // Delete instances
    for (const instanceId of instancesToDelete) {
      await this.deleteInstanceFromCloud(instanceId);
    }
  }

  private createStorageProvider(): CloudStorageProvider {
    switch (this.config.provider) {
      case 'aws':
        return new AWSStorageProvider(this.config);
      case 'azure':
        return new AzureStorageProvider(this.config);
      case 'gcp':
        return new GCPStorageProvider(this.config);
      default:
        throw new Error(`Unsupported storage provider: ${this.config.provider}`);
    }
  }

  private async validateConfiguration(): Promise<void> {
    if (!this.config.bucketName) {
      throw new Error('Bucket name is required');
    }
    
    if (!this.config.credentials) {
      throw new Error('Storage credentials are required');
    }

    // Provider-specific validation
    const provider = this.config.credentials[this.config.provider];
    if (!provider) {
      throw new Error(`Credentials for ${this.config.provider} provider are missing`);
    }
  }

  private setupEventListeners(): void {
    // Monitor Orthanc changes
    setInterval(async () => {
      try {
        await this.monitorOrthancChanges();
      } catch (error) {
        console.error('Error monitoring Orthanc changes:', error);
      }
    }, 30000); // Check every 30 seconds

    // Apply retention policies daily
    setInterval(async () => {
      try {
        await this.applyRetentionPolicies();
      } catch (error) {
        console.error('Error applying retention policies:', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily
  }

  private async monitorOrthancChanges(): Promise<void> {
    // Implementation would monitor Orthanc changes feed
    // and trigger storage operations for new instances
  }

  private generateCloudPath(instanceId: string, tags: any): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return this.config.pathTemplate
      .replace('{year}', year.toString())
      .replace('{month}', month)
      .replace('{studyId}', tags.StudyInstanceUID || 'unknown')
      .replace('{seriesId}', tags.SeriesInstanceUID || 'unknown')
      .replace('{instanceId}', instanceId);
  }

  private calculateChecksum(data: ArrayBuffer): string {
    const hash = createHash('sha256');
    hash.update(Buffer.from(data));
    return hash.digest('hex');
  }

  private generateEncryptionKey(): string {
    return createHash('sha256').update(Math.random().toString()).digest('hex');
  }

  private shouldRestore(metadata: StorageMetadata): boolean {
    // Check if file should be restored from archive based on access patterns
    const daysSinceAccess = Math.floor((Date.now() - metadata.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceAccess > 30; // Restore if not accessed in 30 days
  }

  private async getInstanceModality(instanceId: string): Promise<string> {
    const tagsResponse = await this.orthancClient.getInstanceTags(instanceId);
    return tagsResponse.data?.Modality || 'UNKNOWN';
  }

  private async archiveInstance(instanceId: string): Promise<void> {
    const metadata = this.storageIndex.get(instanceId);
    if (metadata) {
      // Implementation would move to archive storage tier
      metadata.isArchived = true;
      await this.saveStorageIndex();
    }
  }

  private async deleteInstanceFromCloud(instanceId: string): Promise<void> {
    const metadata = this.storageIndex.get(instanceId);
    if (metadata) {
      await this.storageProvider.deleteFile(metadata.cloudPath);
      this.storageIndex.delete(instanceId);
      await this.saveStorageIndex();
    }
  }

  private async loadStorageIndex(): Promise<void> {
    // Implementation would load storage index from persistent storage
    // For now, keeping in memory
  }

  private async saveStorageIndex(): Promise<void> {
    // Implementation would save storage index to persistent storage
    // For now, keeping in memory
  }
}

// Abstract base class for cloud storage providers
abstract class CloudStorageProvider {
  protected config: CloudStorageConfig;

  constructor(config: CloudStorageConfig) {
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract healthCheck(): Promise<boolean>;
  abstract uploadFile(path: string, data: ArrayBuffer, options?: any): Promise<void>;
  abstract downloadFile(path: string): Promise<ArrayBuffer>;
  abstract deleteFile(path: string): Promise<void>;
}

// AWS S3 Storage Provider
class AWSStorageProvider extends CloudStorageProvider {
  async initialize(): Promise<void> {
    // AWS SDK initialization would go here
    console.log('[AWS Storage] Initialized AWS S3 storage provider');
  }

  async healthCheck(): Promise<boolean> {
    // AWS S3 health check implementation
    return true; // Simplified for demo
  }

  async uploadFile(path: string, data: ArrayBuffer, options?: any): Promise<void> {
    // AWS S3 upload implementation
    console.log(`[AWS Storage] Uploading file to S3: ${path}`);
  }

  async downloadFile(path: string): Promise<ArrayBuffer> {
    // AWS S3 download implementation
    console.log(`[AWS Storage] Downloading file from S3: ${path}`);
    return new ArrayBuffer(0); // Simplified for demo
  }

  async deleteFile(path: string): Promise<void> {
    // AWS S3 delete implementation
    console.log(`[AWS Storage] Deleting file from S3: ${path}`);
  }
}

// Azure Blob Storage Provider
class AzureStorageProvider extends CloudStorageProvider {
  async initialize(): Promise<void> {
    console.log('[Azure Storage] Initialized Azure Blob storage provider');
  }

  async healthCheck(): Promise<boolean> {
    return true; // Simplified for demo
  }

  async uploadFile(path: string, data: ArrayBuffer, options?: any): Promise<void> {
    console.log(`[Azure Storage] Uploading file to Blob: ${path}`);
  }

  async downloadFile(path: string): Promise<ArrayBuffer> {
    console.log(`[Azure Storage] Downloading file from Blob: ${path}`);
    return new ArrayBuffer(0); // Simplified for demo
  }

  async deleteFile(path: string): Promise<void> {
    console.log(`[Azure Storage] Deleting file from Blob: ${path}`);
  }
}

// Google Cloud Storage Provider
class GCPStorageProvider extends CloudStorageProvider {
  async initialize(): Promise<void> {
    console.log('[GCP Storage] Initialized Google Cloud Storage provider');
  }

  async healthCheck(): Promise<boolean> {
    return true; // Simplified for demo
  }

  async uploadFile(path: string, data: ArrayBuffer, options?: any): Promise<void> {
    console.log(`[GCP Storage] Uploading file to GCS: ${path}`);
  }

  async downloadFile(path: string): Promise<ArrayBuffer> {
    console.log(`[GCP Storage] Downloading file from GCS: ${path}`);
    return new ArrayBuffer(0); // Simplified for demo
  }

  async deleteFile(path: string): Promise<void> {
    console.log(`[GCP Storage] Deleting file from GCS: ${path}`);
  }
}