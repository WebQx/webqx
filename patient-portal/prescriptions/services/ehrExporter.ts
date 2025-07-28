/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

/**
 * EHR Exporter Service for export and reporting functionality
 * Provides multiple format exports and prescription summaries
 */

export interface PrescriptionData {
  id: string;
  patientId: string;
  patientName: string;
  medication: {
    name: string;
    rxcui: string;
    dosage: string;
    frequency: string;
    duration: string;
  };
  prescriber: {
    name: string;
    id: string;
    license: string;
  };
  dateIssued: Date;
  dateExpires?: Date;
  instructions: string;
  quantity: number;
  refills: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
}

export interface ExportFormat {
  type: 'PDF' | 'CSV' | 'JSON' | 'XML' | 'HL7_FHIR';
  mimeType: string;
  extension: string;
}

export interface ExportOptions {
  format: ExportFormat['type'];
  includePatientInfo: boolean;
  includePrescriber: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  fields?: string[];
}

export interface PrescriptionSummary {
  totalPrescriptions: number;
  activePrescriptions: number;
  expiredPrescriptions: number;
  mostPrescribedMedications: Array<{
    medication: string;
    count: number;
    percentage: number;
  }>;
  prescriptionsByMonth: Array<{
    month: string;
    count: number;
  }>;
  averageRefills: number;
}

class EHRExporter {
  private readonly supportedFormats: ExportFormat[] = [
    { type: 'PDF', mimeType: 'application/pdf', extension: '.pdf' },
    { type: 'CSV', mimeType: 'text/csv', extension: '.csv' },
    { type: 'JSON', mimeType: 'application/json', extension: '.json' },
    { type: 'XML', mimeType: 'application/xml', extension: '.xml' },
    { type: 'HL7_FHIR', mimeType: 'application/fhir+json', extension: '.json' }
  ];

  /**
   * Get all supported export formats
   */
  getSupportedFormats(): ExportFormat[] {
    return [...this.supportedFormats];
  }

  /**
   * Export prescriptions in specified format
   */
  async exportPrescriptions(
    prescriptions: PrescriptionData[],
    options: ExportOptions
  ): Promise<{ data: string | Uint8Array; filename: string; mimeType: string }> {
    const format = this.supportedFormats.find(f => f.type === options.format);
    if (!format) {
      throw new Error(`Unsupported export format: ${options.format}`);
    }

    // Filter prescriptions based on date range if provided
    let filteredPrescriptions = prescriptions;
    if (options.dateRange) {
      filteredPrescriptions = prescriptions.filter(p => 
        p.dateIssued >= options.dateRange!.start && 
        p.dateIssued <= options.dateRange!.end
      );
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `prescriptions_${timestamp}${format.extension}`;

    switch (options.format) {
      case 'CSV':
        return {
          data: this.exportToCSV(filteredPrescriptions, options),
          filename,
          mimeType: format.mimeType
        };
      
      case 'JSON':
        return {
          data: this.exportToJSON(filteredPrescriptions, options),
          filename,
          mimeType: format.mimeType
        };
      
      case 'XML':
        return {
          data: this.exportToXML(filteredPrescriptions, options),
          filename,
          mimeType: format.mimeType
        };
      
      case 'HL7_FHIR':
        return {
          data: this.exportToHL7FHIR(filteredPrescriptions, options),
          filename,
          mimeType: format.mimeType
        };
      
      case 'PDF':
        return {
          data: await this.exportToPDF(filteredPrescriptions, options),
          filename,
          mimeType: format.mimeType
        };
      
      default:
        throw new Error(`Export format ${options.format} not implemented`);
    }
  }

  /**
   * Export to CSV format
   */
  private exportToCSV(prescriptions: PrescriptionData[], options: ExportOptions): string {
    const headers = this.getCSVHeaders(options);
    const rows = prescriptions.map(p => this.prescriptionToCSVRow(p, options));
    
    return [headers, ...rows].join('\n');
  }

  private getCSVHeaders(options: ExportOptions): string {
    const baseHeaders = ['Prescription ID', 'Medication Name', 'Dosage', 'Frequency', 'Quantity', 'Status', 'Date Issued'];
    
    if (options.includePatientInfo) {
      baseHeaders.unshift('Patient ID', 'Patient Name');
    }
    
    if (options.includePrescriber) {
      baseHeaders.push('Prescriber Name', 'Prescriber License');
    }
    
    return baseHeaders.join(',');
  }

  private prescriptionToCSVRow(prescription: PrescriptionData, options: ExportOptions): string {
    const values: string[] = [];
    
    if (options.includePatientInfo) {
      values.push(
        this.escapeCSV(prescription.patientId),
        this.escapeCSV(prescription.patientName)
      );
    }
    
    values.push(
      this.escapeCSV(prescription.id),
      this.escapeCSV(prescription.medication.name),
      this.escapeCSV(prescription.medication.dosage),
      this.escapeCSV(prescription.medication.frequency),
      prescription.quantity.toString(),
      this.escapeCSV(prescription.status),
      prescription.dateIssued.toISOString().split('T')[0]
    );
    
    if (options.includePrescriber) {
      values.push(
        this.escapeCSV(prescription.prescriber.name),
        this.escapeCSV(prescription.prescriber.license)
      );
    }
    
    return values.join(',');
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Export to JSON format
   */
  private exportToJSON(prescriptions: PrescriptionData[], options: ExportOptions): string {
    const data = {
      exportDate: new Date().toISOString(),
      totalRecords: prescriptions.length,
      options,
      prescriptions: prescriptions.map(p => this.filterPrescriptionFields(p, options))
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export to XML format
   */
  private exportToXML(prescriptions: PrescriptionData[], options: ExportOptions): string {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
    const rootOpen = '<prescriptions>\n';
    const metadata = `  <metadata>\n    <exportDate>${new Date().toISOString()}</exportDate>\n    <totalRecords>${prescriptions.length}</totalRecords>\n  </metadata>\n`;
    
    const prescriptionXML = prescriptions.map(p => this.prescriptionToXML(p, options)).join('\n');
    const rootClose = '</prescriptions>';
    
    return xmlHeader + rootOpen + metadata + prescriptionXML + rootClose;
  }

  private prescriptionToXML(prescription: PrescriptionData, options: ExportOptions): string {
    const filtered = this.filterPrescriptionFields(prescription, options);
    return `  <prescription>
    <id>${this.escapeXML(filtered.id)}</id>
    ${options.includePatientInfo ? `<patientId>${this.escapeXML(filtered.patientId)}</patientId>
    <patientName>${this.escapeXML(filtered.patientName)}</patientName>` : ''}
    <medication>
      <name>${this.escapeXML(filtered.medication.name)}</name>
      <rxcui>${this.escapeXML(filtered.medication.rxcui)}</rxcui>
      <dosage>${this.escapeXML(filtered.medication.dosage)}</dosage>
      <frequency>${this.escapeXML(filtered.medication.frequency)}</frequency>
    </medication>
    ${options.includePrescriber ? `<prescriber>
      <name>${this.escapeXML(filtered.prescriber.name)}</name>
      <license>${this.escapeXML(filtered.prescriber.license)}</license>
    </prescriber>` : ''}
    <dateIssued>${filtered.dateIssued.toISOString()}</dateIssued>
    <status>${this.escapeXML(filtered.status)}</status>
  </prescription>`;
  }

  private escapeXML(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Export to HL7 FHIR format
   */
  private exportToHL7FHIR(prescriptions: PrescriptionData[], options: ExportOptions): string {
    const bundle = {
      resourceType: 'Bundle',
      id: `prescription-export-${Date.now()}`,
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: prescriptions.length,
      entry: prescriptions.map(p => ({
        resource: this.prescriptionToFHIR(p, options)
      }))
    };
    
    return JSON.stringify(bundle, null, 2);
  }

  private prescriptionToFHIR(prescription: PrescriptionData, options: ExportOptions): any {
    return {
      resourceType: 'MedicationRequest',
      id: prescription.id,
      status: prescription.status.toLowerCase(),
      intent: 'order',
      medicationCodeableConcept: {
        coding: [{
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: prescription.medication.rxcui,
          display: prescription.medication.name
        }]
      },
      subject: options.includePatientInfo ? {
        reference: `Patient/${prescription.patientId}`,
        display: prescription.patientName
      } : undefined,
      authoredOn: prescription.dateIssued.toISOString(),
      requester: options.includePrescriber ? {
        reference: `Practitioner/${prescription.prescriber.id}`,
        display: prescription.prescriber.name
      } : undefined,
      dosageInstruction: [{
        text: prescription.instructions,
        timing: {
          repeat: {
            frequency: 1,
            period: 1,
            periodUnit: 'd'
          }
        }
      }],
      dispenseRequest: {
        quantity: {
          value: prescription.quantity
        },
        numberOfRepeatsAllowed: prescription.refills
      }
    };
  }

  /**
   * Export to PDF format (mock implementation)
   */
  private async exportToPDF(prescriptions: PrescriptionData[], options: ExportOptions): Promise<Uint8Array> {
    // Mock PDF generation - in production, you'd use a library like jsPDF or puppeteer
    const content = this.exportToJSON(prescriptions, options);
    const encoder = new TextEncoder();
    return encoder.encode(content);
  }

  /**
   * Filter prescription fields based on options
   */
  private filterPrescriptionFields(prescription: PrescriptionData, options: ExportOptions): any {
    const filtered: any = { ...prescription };
    
    if (!options.includePatientInfo) {
      delete filtered.patientId;
      delete filtered.patientName;
    }
    
    if (!options.includePrescriber) {
      delete filtered.prescriber;
    }
    
    if (options.fields && options.fields.length > 0) {
      const allowed = new Set(options.fields);
      Object.keys(filtered).forEach(key => {
        if (!allowed.has(key)) {
          delete filtered[key];
        }
      });
    }
    
    return filtered;
  }

  /**
   * Generate prescription summary report
   */
  generateSummary(prescriptions: PrescriptionData[]): PrescriptionSummary {
    const now = new Date();
    const activePrescriptions = prescriptions.filter(p => p.status === 'ACTIVE').length;
    const expiredPrescriptions = prescriptions.filter(p => 
      p.dateExpires && p.dateExpires < now
    ).length;

    // Calculate most prescribed medications
    const medicationCounts = new Map<string, number>();
    prescriptions.forEach(p => {
      const count = medicationCounts.get(p.medication.name) || 0;
      medicationCounts.set(p.medication.name, count + 1);
    });

    const sortedMedications = Array.from(medicationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([medication, count]) => ({
        medication,
        count,
        percentage: Math.round((count / prescriptions.length) * 100)
      }));

    // Calculate prescriptions by month
    const monthCounts = new Map<string, number>();
    prescriptions.forEach(p => {
      const month = p.dateIssued.toISOString().slice(0, 7); // YYYY-MM
      const count = monthCounts.get(month) || 0;
      monthCounts.set(month, count + 1);
    });

    const prescriptionsByMonth = Array.from(monthCounts.entries())
      .sort()
      .map(([month, count]) => ({ month, count }));

    // Calculate average refills
    const totalRefills = prescriptions.reduce((sum, p) => sum + p.refills, 0);
    const averageRefills = prescriptions.length > 0 ? 
      Math.round((totalRefills / prescriptions.length) * 100) / 100 : 0;

    return {
      totalPrescriptions: prescriptions.length,
      activePrescriptions,
      expiredPrescriptions,
      mostPrescribedMedications: sortedMedications,
      prescriptionsByMonth,
      averageRefills
    };
  }

  /**
   * Validate export options
   */
  validateExportOptions(options: ExportOptions): string[] {
    const errors: string[] = [];
    
    if (!this.supportedFormats.find(f => f.type === options.format)) {
      errors.push(`Unsupported format: ${options.format}`);
    }
    
    if (options.dateRange) {
      if (options.dateRange.start > options.dateRange.end) {
        errors.push('Start date must be before end date');
      }
    }
    
    return errors;
  }
}

export const ehrExporter = new EHRExporter();
export default ehrExporter;