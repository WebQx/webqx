/**
 * Imaging Workflow Service
 * 
 * Service for managing imaging workflows, orders, reports, and provider-patient interactions.
 * Handles the clinical workflow aspects of PACS integration.
 */

import { 
  ImagingOrder, 
  ImagingReport, 
  ProviderImagingWorkflow,
  PatientImagingAccess,
  PACSResponse,
  DICOMStudy
} from '../types';
import { PACSService } from './pacsService';

export class ImagingWorkflowService {
  private pacsService: PACSService;

  constructor(pacsService?: PACSService) {
    this.pacsService = pacsService || new PACSService();
  }

  /**
   * Create new imaging order
   */
  async createImagingOrder(orderData: Omit<ImagingOrder, 'orderID' | 'status'>): Promise<PACSResponse<ImagingOrder>> {
    try {
      const order: ImagingOrder = {
        ...orderData,
        orderID: this.generateOrderId(),
        status: 'ordered'
      };

      // In real implementation, save to database
      await this.saveOrder(order);

      return {
        success: true,
        data: order,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: 'workflow-service'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ORDER_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create imaging order'
        }
      };
    }
  }

  /**
   * Update imaging order status
   */
  async updateOrderStatus(
    orderID: string, 
    status: ImagingOrder['status'], 
    notes?: string
  ): Promise<PACSResponse<ImagingOrder>> {
    try {
      const order = await this.getOrderById(orderID);
      
      if (!order) {
        return {
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: `Imaging order ${orderID} not found`
          }
        };
      }

      order.status = status;
      await this.saveOrder(order);

      return {
        success: true,
        data: order,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: 'workflow-service'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ORDER_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to update order status'
        }
      };
    }
  }

  /**
   * Create imaging report
   */
  async createImagingReport(reportData: Omit<ImagingReport, 'reportID'>): Promise<PACSResponse<ImagingReport>> {
    try {
      const report: ImagingReport = {
        ...reportData,
        reportID: this.generateReportId()
      };

      // In real implementation, save to database
      await this.saveReport(report);

      // Update related order status if final report
      if (report.status === 'final') {
        await this.updateOrderStatus(
          await this.getOrderIdByStudy(report.studyInstanceUID), 
          'completed'
        );
      }

      return {
        success: true,
        data: report,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: 'workflow-service'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REPORT_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create imaging report'
        }
      };
    }
  }

  /**
   * Get provider workflow for patient
   */
  async getProviderWorkflow(
    providerID: string, 
    patientID: string
  ): Promise<PACSResponse<ProviderImagingWorkflow>> {
    try {
      const workflow = await this.buildProviderWorkflow(providerID, patientID);

      return {
        success: true,
        data: workflow,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: 'workflow-service'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'WORKFLOW_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve provider workflow'
        }
      };
    }
  }

  /**
   * Grant patient access to imaging study
   */
  async grantPatientAccess(
    patientID: string,
    studyInstanceUID: string,
    accessType: 'view' | 'download' | 'share',
    providerID: string,
    expiryDays: number = 30
  ): Promise<PACSResponse<PatientImagingAccess>> {
    try {
      const access: PatientImagingAccess = {
        patientID,
        studyInstanceUID,
        accessType,
        consentGiven: true,
        consentDate: new Date().toISOString(),
        accessExpiry: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      };

      // In real implementation, save to database
      await this.savePatientAccess(access);

      return {
        success: true,
        data: access,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: 'workflow-service'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ACCESS_GRANT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to grant patient access'
        }
      };
    }
  }

  /**
   * Get patient's accessible imaging studies
   */
  async getPatientAccessibleStudies(patientID: string): Promise<PACSResponse<DICOMStudy[]>> {
    try {
      // Get all studies where patient has access
      const accessRecords = await this.getPatientAccessRecords(patientID);
      const studies: DICOMStudy[] = [];

      for (const access of accessRecords) {
        if (this.isAccessValid(access)) {
          const studyResult = await this.pacsService.getStudyDetails(access.studyInstanceUID);
          if (studyResult.success && studyResult.data) {
            studies.push(studyResult.data);
          }
        }
      }

      return {
        success: true,
        data: studies,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: 'workflow-service'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PATIENT_STUDIES_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve patient studies'
        }
      };
    }
  }

  /**
   * Get orders by provider
   */
  async getOrdersByProvider(
    providerID: string, 
    status?: ImagingOrder['status']
  ): Promise<PACSResponse<ImagingOrder[]>> {
    try {
      const orders = await this.queryOrdersByProvider(providerID, status);

      return {
        success: true,
        data: orders,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: 'workflow-service'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ORDERS_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve provider orders'
        }
      };
    }
  }

  /**
   * Get reports by study
   */
  async getReportsByStudy(studyInstanceUID: string): Promise<PACSResponse<ImagingReport[]>> {
    try {
      const reports = await this.queryReportsByStudy(studyInstanceUID);

      return {
        success: true,
        data: reports,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          server: 'workflow-service'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REPORTS_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve study reports'
        }
      };
    }
  }

  // Private helper methods

  private async buildProviderWorkflow(
    providerID: string, 
    patientID: string
  ): Promise<ProviderImagingWorkflow> {
    const orders = await this.queryOrdersByProvider(providerID);
    const patientOrders = orders.filter(order => order.patientID === patientID);
    
    const studies: DICOMStudy[] = [];
    const reports: ImagingReport[] = [];

    // Get studies and reports for each order
    for (const order of patientOrders) {
      // In real implementation, link orders to studies
      const studyResult = await this.pacsService.searchStudies({ patientID });
      if (studyResult.success && studyResult.data) {
        studies.push(...studyResult.data.studies);
      }

      // Get reports for studies
      for (const study of studies) {
        const studyReports = await this.queryReportsByStudy(study.studyInstanceUID);
        reports.push(...studyReports);
      }
    }

    return {
      workflowID: this.generateWorkflowId(),
      providerID,
      patientID,
      orders: patientOrders,
      studies,
      reports,
      status: this.determineWorkflowStatus(patientOrders, reports),
      lastUpdated: new Date().toISOString()
    };
  }

  private determineWorkflowStatus(
    orders: ImagingOrder[], 
    reports: ImagingReport[]
  ): 'active' | 'completed' | 'pending-review' {
    if (orders.some(order => order.status === 'in-progress')) {
      return 'active';
    }
    
    if (reports.some(report => report.status === 'preliminary')) {
      return 'pending-review';
    }
    
    if (orders.every(order => order.status === 'completed')) {
      return 'completed';
    }
    
    return 'active';
  }

  private isAccessValid(access: PatientImagingAccess): boolean {
    if (!access.consentGiven) {
      return false;
    }

    if (access.accessExpiry) {
      return new Date(access.accessExpiry) > new Date();
    }

    return true;
  }

  // Mock data operations - in real implementation, these would interact with database

  private async saveOrder(order: ImagingOrder): Promise<void> {
    // Mock save operation
    console.log(`[Workflow Service] Saved order ${order.orderID}`);
  }

  private async saveReport(report: ImagingReport): Promise<void> {
    // Mock save operation
    console.log(`[Workflow Service] Saved report ${report.reportID}`);
  }

  private async savePatientAccess(access: PatientImagingAccess): Promise<void> {
    // Mock save operation
    console.log(`[Workflow Service] Granted access for patient ${access.patientID}`);
  }

  private async getOrderById(orderID: string): Promise<ImagingOrder | null> {
    // Mock implementation
    return {
      orderID,
      patientID: 'PAT001',
      providerID: 'PROV001',
      orderDate: '2024-01-15',
      modality: 'CT',
      bodyPart: 'Chest',
      clinicalIndication: 'Shortness of breath',
      urgency: 'routine',
      status: 'ordered'
    };
  }

  private async getOrderIdByStudy(studyInstanceUID: string): Promise<string> {
    // Mock implementation - find order associated with study
    return 'ORD001';
  }

  private async queryOrdersByProvider(
    providerID: string, 
    status?: ImagingOrder['status']
  ): Promise<ImagingOrder[]> {
    // Mock implementation
    const allOrders: ImagingOrder[] = [
      {
        orderID: 'ORD001',
        patientID: 'PAT001',
        providerID,
        orderDate: '2024-01-15',
        modality: 'CT',
        bodyPart: 'Chest',
        clinicalIndication: 'Shortness of breath',
        urgency: 'routine',
        status: 'completed'
      }
    ];

    return status ? allOrders.filter(order => order.status === status) : allOrders;
  }

  private async queryReportsByStudy(studyInstanceUID: string): Promise<ImagingReport[]> {
    // Mock implementation
    return [
      {
        reportID: 'RPT001',
        studyInstanceUID,
        patientID: 'PAT001',
        radiologistID: 'RAD001',
        reportDate: '2024-01-15',
        findings: 'No acute findings',
        impression: 'Normal chest CT',
        status: 'final',
        isAbnormal: false
      }
    ];
  }

  private async getPatientAccessRecords(patientID: string): Promise<PatientImagingAccess[]> {
    // Mock implementation
    return [
      {
        patientID,
        studyInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.78',
        accessType: 'view',
        consentGiven: true,
        consentDate: '2024-01-15T00:00:00Z',
        accessExpiry: '2024-02-15T00:00:00Z'
      }
    ];
  }

  // ID generators

  private generateOrderId(): string {
    return `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateReportId(): string {
    return `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateWorkflowId(): string {
    return `WF_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateRequestId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}