/**
 * PostDICOM Storage Service
 * Handles cloud storage operations for DICOM images with support for AWS S3, Google Cloud, and Azure
 */

import {
  IStorageService,
  DICOMStudy,
  StudyUploadRequest,
  APIResponse,
  StorageStats,
  RetentionReport,
  CloudProvider,
  StorageConfig,
  PostDICOMError,
  ERROR_CODES
} from '../types/postdicom.types';
import { getPostDICOMConfig } from '../config/postdicom.config';

/**
 * Abstract base class for cloud storage providers
 */
abstract class CloudStorageProvider {
  protected config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  abstract uploadFile(key: string, buffer: Buffer, metadata?: any): Promise<string>;
  abstract downloadFile(key: string): Promise<Buffer>;
  abstract deleteFile(key: string): Promise<void>;
  abstract listFiles(prefix?: string): Promise<string[]>;
  abstract getFileMetadata(key: string): Promise<any>;
  abstract generatePreSignedUrl(key: string, expiresIn: number): Promise<string>;
}

/**
 * AWS S3 Storage Provider
 */
class AWSS3Provider extends CloudStorageProvider {
  private s3Client: any; // Would be AWS SDK S3 client in real implementation

  constructor(config: StorageConfig) {
    super(config);
    this.initializeS3Client();
  }

  private initializeS3Client(): void {
    // In a real implementation, this would initialize the AWS SDK
    // For this demo, we'll simulate the S3 client
    this.s3Client = {
      upload: async (params: any) => ({
        Location: `https://${this.config.bucketName}.s3.amazonaws.com/${params.Key}`,
        ETag: '"mock-etag"',
        Bucket: this.config.bucketName,
        Key: params.Key
      }),
      getObject: async (params: any) => ({
        Body: Buffer.from('mock-dicom-data'),
        Metadata: { contentType: 'application/dicom' }
      }),
      deleteObject: async (params: any) => ({}),
      listObjectsV2: async (params: any) => ({
        Contents: [{ Key: 'study1/series1/image1.dcm' }]
      }),
      headObject: async (params: any) => ({
        Metadata: { studyId: 'study-123' },
        ContentLength: 1024000
      }),
      getSignedUrl: async (operation: string, params: any) => 
        `https://${this.config.bucketName}.s3.amazonaws.com/${params.Key}?X-Amz-Signature=mock`
    };
  }

  async uploadFile(key: string, buffer: Buffer, metadata?: any): Promise<string> {
    try {
      const uploadParams = {
        Bucket: this.config.bucketName,
        Key: key,
        Body: buffer,
        ServerSideEncryption: this.config.encryption ? 'AES256' : undefined,
        Metadata: metadata || {}
      };

      const result = await this.s3Client.upload(uploadParams);
      return result.Location;
    } catch (error) {
      throw new PostDICOMError(
        `Failed to upload to S3: ${error instanceof Error ? error.message : String(error)}`,
        ERROR_CODES.STORAGE_QUOTA_EXCEEDED,
        500
      );
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    try {
      const params = {
        Bucket: this.config.bucketName,
        Key: key
      };

      const result = await this.s3Client.getObject(params);
      return result.Body;
    } catch (error) {
      throw new PostDICOMError(
        `Failed to download from S3: ${error instanceof Error ? error.message : String(error)}`,
        ERROR_CODES.STUDY_NOT_FOUND,
        404
      );
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const params = {
        Bucket: this.config.bucketName,
        Key: key
      };

      await this.s3Client.deleteObject(params);
    } catch (error) {
      throw new PostDICOMError(
        `Failed to delete from S3: ${error instanceof Error ? error.message : String(error)}`,
        ERROR_CODES.NETWORK_ERROR,
        500
      );
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const params = {
        Bucket: this.config.bucketName,
        Prefix: prefix || ''
      };

      const result = await this.s3Client.listObjectsV2(params);
      return result.Contents?.map((obj: any) => obj.Key) || [];
    } catch (error) {
      throw new PostDICOMError(
        `Failed to list S3 objects: ${error instanceof Error ? error.message : String(error)}`,
        ERROR_CODES.NETWORK_ERROR,
        500
      );
    }
  }

  async getFileMetadata(key: string): Promise<any> {
    try {
      const params = {
        Bucket: this.config.bucketName,
        Key: key
      };

      const result = await this.s3Client.headObject(params);
      return {
        size: result.ContentLength,
        metadata: result.Metadata,
        lastModified: result.LastModified
      };
    } catch (error) {
      throw new PostDICOMError(
        `Failed to get S3 metadata: ${error instanceof Error ? error.message : String(error)}`,
        ERROR_CODES.STUDY_NOT_FOUND,
        404
      );
    }
  }

  async generatePreSignedUrl(key: string, expiresIn: number): Promise<string> {
    try {
      const params = {
        Bucket: this.config.bucketName,
        Key: key,
        Expires: expiresIn
      };

      return await this.s3Client.getSignedUrl('getObject', params);
    } catch (error) {
      throw new PostDICOMError(
        `Failed to generate S3 presigned URL: ${error instanceof Error ? error.message : String(error)}`,
        ERROR_CODES.NETWORK_ERROR,
        500
      );
    }
  }
}

/**
 * Google Cloud Storage Provider
 */
class GCPStorageProvider extends CloudStorageProvider {
  // Implementation similar to AWS S3 but using Google Cloud Storage SDK
  async uploadFile(key: string, buffer: Buffer, metadata?: any): Promise<string> {
    // Mock implementation - would use @google-cloud/storage in real app
    return `gs://${this.config.bucketName}/${key}`;
  }

  async downloadFile(key: string): Promise<Buffer> {
    return Buffer.from('mock-gcp-dicom-data');
  }

  async deleteFile(key: string): Promise<void> {
    // Mock implementation
  }

  async listFiles(prefix?: string): Promise<string[]> {
    return ['study1/series1/image1.dcm'];
  }

  async getFileMetadata(key: string): Promise<any> {
    return { size: 1024000, metadata: {} };
  }

  async generatePreSignedUrl(key: string, expiresIn: number): Promise<string> {
    return `https://storage.googleapis.com/${this.config.bucketName}/${key}?X-Goog-Signature=mock`;
  }
}

/**
 * Azure Blob Storage Provider
 */
class AzureStorageProvider extends CloudStorageProvider {
  // Implementation similar to AWS S3 but using Azure Storage SDK
  async uploadFile(key: string, buffer: Buffer, metadata?: any): Promise<string> {
    // Mock implementation - would use @azure/storage-blob in real app
    return `https://${this.config.bucketName}.blob.core.windows.net/${key}`;
  }

  async downloadFile(key: string): Promise<Buffer> {
    return Buffer.from('mock-azure-dicom-data');
  }

  async deleteFile(key: string): Promise<void> {
    // Mock implementation
  }

  async listFiles(prefix?: string): Promise<string[]> {
    return ['study1/series1/image1.dcm'];
  }

  async getFileMetadata(key: string): Promise<any> {
    return { size: 1024000, metadata: {} };
  }

  async generatePreSignedUrl(key: string, expiresIn: number): Promise<string> {
    return `https://${this.config.bucketName}.blob.core.windows.net/${key}?sv=mock`;
  }
}

/**
 * PostDICOM Storage Service
 * Main service class that implements IStorageService interface
 */
export class PostDICOMStorageService implements IStorageService {
  private provider: CloudStorageProvider;
  private config: StorageConfig;

  constructor(customConfig?: Partial<StorageConfig>) {
    const fullConfig = getPostDICOMConfig();
    this.config = { ...fullConfig.storage, ...customConfig };
    this.provider = this.createProvider();
  }

  /**
   * Upload a DICOM study to cloud storage
   */
  async uploadStudy(request: StudyUploadRequest): Promise<APIResponse<DICOMStudy>> {
    try {
      this.validateUploadRequest(request);

      const studyInstanceUID = this.generateStudyUID();
      const studyKey = this.generateStudyKey(studyInstanceUID, request.patientID);
      
      const uploadPromises = request.files.map(async (file, index) => {
        const fileKey = `${studyKey}/image_${index + 1}.dcm`;
        const buffer = await this.fileToBuffer(file);
        
        const metadata = {
          patientID: request.patientID,
          studyInstanceUID: studyInstanceUID,
          modality: request.modality,
          accessLevel: request.accessLevel,
          uploadedAt: new Date().toISOString(),
          ...request.metadata
        };

        return await this.provider.uploadFile(fileKey, buffer, metadata);
      });

      const uploadResults = await Promise.all(uploadPromises);

      const study: DICOMStudy = {
        studyInstanceUID,
        patientID: request.patientID,
        patientName: request.metadata?.patientName || 'Unknown',
        studyDate: new Date().toISOString().split('T')[0],
        studyDescription: request.studyDescription,
        modality: request.modality,
        seriesCount: 1,
        imageCount: request.files.length,
        studySize: request.files.reduce((total, file) => total + file.size, 0),
        accessLevel: request.accessLevel,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.indexStudy(study);

      return {
        success: true,
        data: study
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: (error && typeof error === 'object' && 'code' in error ? String(error.code) : null) || ERROR_CODES.NETWORK_ERROR,
          message: error instanceof Error ? error.message : String(error),
          details: error && typeof error === 'object' && 'details' in error ? error.details : undefined
        }
      };
    }
  }

  /**
   * Download a DICOM image from cloud storage
   */
  async downloadImage(sopInstanceUID: string): Promise<APIResponse<Blob>> {
    try {
      const imageKey = await this.findImageKey(sopInstanceUID);
      if (!imageKey) {
        throw new PostDICOMError(
          'Image not found',
          ERROR_CODES.STUDY_NOT_FOUND,
          404
        );
      }

      const buffer = await this.provider.downloadFile(imageKey);
      const blob = new Blob([buffer], { type: 'application/dicom' });

      return {
        success: true,
        data: blob
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: (error && typeof error === 'object' && 'code' in error ? String(error.code) : null) || ERROR_CODES.NETWORK_ERROR,
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Delete a DICOM study from cloud storage
   */
  async deleteStudy(studyInstanceUID: string): Promise<APIResponse<void>> {
    try {
      const studyFiles = await this.provider.listFiles(`studies/${studyInstanceUID}/`);
      
      const deletePromises = studyFiles.map(file => 
        this.provider.deleteFile(file)
      );

      await Promise.all(deletePromises);
      await this.removeStudyIndex(studyInstanceUID);

      return {
        success: true
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: (error && typeof error === 'object' && 'code' in error ? String(error.code) : null) || ERROR_CODES.NETWORK_ERROR,
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<APIResponse<StorageStats>> {
    try {
      const allFiles = await this.provider.listFiles('studies/');
      let totalSize = 0;
      let totalImages = 0;

      const metadataPromises = allFiles.map(async (file) => {
        const metadata = await this.provider.getFileMetadata(file);
        totalSize += metadata.size;
        totalImages++;
        return metadata;
      });

      await Promise.all(metadataPromises);

      const stats: StorageStats = {
        totalStudies: await this.countStudies(),
        totalImages,
        totalSize,
        storageUtilization: this.calculateStorageUtilization(totalSize),
        oldestStudy: new Date('2020-01-01'), // Mock data
        newestStudy: new Date()
      };

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: (error && typeof error === 'object' && 'code' in error ? String(error.code) : null) || ERROR_CODES.NETWORK_ERROR,
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Validate data retention policy and identify studies for deletion
   */
  async validateRetentionPolicy(): Promise<APIResponse<RetentionReport>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const eligibleStudies = await this.findStudiesOlderThan(cutoffDate);
      const totalSizeToDelete = eligibleStudies.reduce((total, study) => total + study.studySize, 0);

      const report: RetentionReport = {
        eligibleForDeletion: eligibleStudies,
        totalSizeToDelete,
        estimatedSavings: this.calculateSavings(totalSizeToDelete)
      };

      return {
        success: true,
        data: report
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: (error && typeof error === 'object' && 'code' in error ? String(error.code) : null) || ERROR_CODES.RETENTION_POLICY_ERROR,
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Generate pre-signed URL for direct access
   */
  async generatePreSignedUrl(sopInstanceUID: string, expiresIn: number = 3600): Promise<string> {
    const imageKey = await this.findImageKey(sopInstanceUID);
    if (!imageKey) {
      throw new PostDICOMError(
        'Image not found',
        ERROR_CODES.STUDY_NOT_FOUND,
        404
      );
    }

    return await this.provider.generatePreSignedUrl(imageKey, expiresIn);
  }

  // Private helper methods

  private createProvider(): CloudStorageProvider {
    switch (this.config.provider) {
      case 'aws':
        return new AWSS3Provider(this.config);
      case 'gcp':
        return new GCPStorageProvider(this.config);
      case 'azure':
        return new AzureStorageProvider(this.config);
      default:
        throw new PostDICOMError(
          `Unsupported storage provider: ${this.config.provider}`,
          ERROR_CODES.INVALID_CREDENTIALS,
          400
        );
    }
  }

  private validateUploadRequest(request: StudyUploadRequest): void {
    if (!request.files || request.files.length === 0) {
      throw new PostDICOMError(
        'No files provided for upload',
        ERROR_CODES.INVALID_DICOM_FILE,
        400
      );
    }

    if (!request.patientID) {
      throw new PostDICOMError(
        'Patient ID is required',
        ERROR_CODES.INVALID_DICOM_FILE,
        400
      );
    }

    // Validate file types
    request.files.forEach((file, index) => {
      if (!this.isDICOMFile(file)) {
        throw new PostDICOMError(
          `File ${index + 1} is not a valid DICOM file`,
          ERROR_CODES.INVALID_DICOM_FILE,
          400
        );
      }
    });
  }

  private isDICOMFile(file: File): boolean {
    // In a real implementation, this would check DICOM file headers
    return file.name.toLowerCase().endsWith('.dcm') || 
           file.type === 'application/dicom';
  }

  private async fileToBuffer(file: File): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        resolve(Buffer.from(arrayBuffer));
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  private generateStudyUID(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `1.2.826.0.1.3680043.8.498.${timestamp}.${random}`;
  }

  private generateStudyKey(studyUID: string, patientID: string): string {
    return `studies/${patientID}/${studyUID}`;
  }

  private async indexStudy(study: DICOMStudy): Promise<void> {
    // In a real implementation, this would index the study in a database
    console.log(`Indexing study: ${study.studyInstanceUID}`);
  }

  private async removeStudyIndex(studyUID: string): Promise<void> {
    // In a real implementation, this would remove the study from the database
    console.log(`Removing study index: ${studyUID}`);
  }

  private async findImageKey(sopInstanceUID: string): Promise<string | null> {
    // In a real implementation, this would query the database for the image key
    return `studies/patient-123/study-123/image-${sopInstanceUID}.dcm`;
  }

  private async countStudies(): Promise<number> {
    // Mock implementation
    return 150;
  }

  private calculateStorageUtilization(totalSize: number): number {
    const maxStorage = this.parseStorageSize(this.config.bucketName || '100GB');
    return (totalSize / maxStorage) * 100;
  }

  private parseStorageSize(sizeStr: string): number {
    const units = { GB: 1024 * 1024 * 1024, TB: 1024 * 1024 * 1024 * 1024 };
    const match = sizeStr.match(/(\d+)(GB|TB)/);
    if (match) {
      return parseInt(match[1]) * units[match[2] as keyof typeof units];
    }
    return 100 * 1024 * 1024 * 1024; // Default 100GB
  }

  private async findStudiesOlderThan(cutoffDate: Date): Promise<DICOMStudy[]> {
    // Mock implementation - would query database in real app
    return [];
  }

  private calculateSavings(sizeToDelete: number): number {
    // Calculate estimated cost savings based on storage provider pricing
    const costPerGB = this.config.provider === 'aws' ? 0.023 : 0.020; // USD per GB per month
    const gbToDelete = sizeToDelete / (1024 * 1024 * 1024);
    return gbToDelete * costPerGB * 12; // Annual savings
  }
}

export default PostDICOMStorageService;