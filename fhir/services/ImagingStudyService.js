/**
 * FHIR ImagingStudy Service
 * 
 * Provides FHIR R4 compliant ImagingStudy resource management,
 * integrating with PACS and specialty routing services.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

/**
 * FHIR ImagingStudy Service Class
 */
class ImagingStudyService {
  constructor() {
    // Mock routing service - in real implementation would integrate with actual services
    this.routingService = {
      routeStudy: async (dicomImage, patientContext) => {
        // Basic routing logic
        const modality = dicomImage.metadata.modality;
        const bodyPart = dicomImage.metadata.bodyPart;
        
        let primarySpecialty = 'radiology';
        if (bodyPart.includes('HEART')) {
          primarySpecialty = 'cardiology';
        } else if (modality === 'XR' && bodyPart.includes('EXTREMITY')) {
          primarySpecialty = 'orthopedics';
        } else if (bodyPart.includes('HEAD') || bodyPart.includes('BRAIN')) {
          primarySpecialty = 'neurology';
        }
        
        return {
          primarySpecialty,
          secondarySpecialties: [],
          priority: patientContext?.urgency === 'urgent' ? 'urgent' : 'normal',
          routingRuleApplied: 'default-routing'
        };
      }
    };
  }

  /**
   * Search for ImagingStudy resources
   */
  async searchImagingStudies(params) {
    // Mock implementation - in real system would query PACS
    const mockStudies = [
      {
        resourceType: 'ImagingStudy',
        id: 'study-123',
        status: 'available',
        modality: [
          {
            system: 'http://dicom.nema.org/resources/ontology/DCM',
            code: 'CT',
            display: 'Computed Tomography'
          }
        ],
        subject: {
          reference: params.patient || 'Patient/patient-123',
          display: 'John Doe'
        },
        started: '2024-01-15T10:00:00Z',
        numberOfSeries: 1,
        numberOfInstances: 25,
        description: 'CT Chest with Contrast',
        series: [
          {
            uid: '1.2.3.4.5.6789.1',
            number: 1,
            modality: {
              system: 'http://dicom.nema.org/resources/ontology/DCM',
              code: 'CT',
              display: 'Computed Tomography'
            },
            description: 'Axial CT Images',
            numberOfInstances: 25,
            bodySite: {
              system: 'http://snomed.info/sct',
              code: '51185008',
              display: 'Chest'
            }
          }
        ],
        extension: [
          {
            url: 'http://webqx.health/fhir/extension/primary-specialty',
            valueString: 'radiology'
          },
          {
            url: 'http://webqx.health/fhir/extension/study-priority',
            valueCode: 'normal'
          }
        ]
      }
    ];

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: mockStudies.length,
      entry: mockStudies.map(study => ({ resource: study }))
    };
  }

  /**
   * Get a specific ImagingStudy by ID
   */
  async getImagingStudy(id) {
    // Mock implementation
    const mockStudy = {
      resourceType: 'ImagingStudy',
      id: id,
      status: 'available',
      modality: [
        {
          system: 'http://dicom.nema.org/resources/ontology/DCM',
          code: 'CT',
          display: 'Computed Tomography'
        }
      ],
      subject: {
        reference: 'Patient/patient-123',
        display: 'John Doe'
      },
      started: '2024-01-15T10:00:00Z',
      numberOfSeries: 1,
      numberOfInstances: 25,
      description: 'CT Chest with Contrast',
      series: [
        {
          uid: '1.2.3.4.5.6789.1',
          number: 1,
          modality: {
            system: 'http://dicom.nema.org/resources/ontology/DCM',
            code: 'CT',
            display: 'Computed Tomography'
          },
          description: 'Axial CT Images',
          numberOfInstances: 25
        }
      ]
    };

    return mockStudy;
  }

  /**
   * Create routing for an ImagingStudy
   */
  async routeImagingStudy(imagingStudy, patientContext) {
    // Convert FHIR ImagingStudy back to DicomImage for routing
    const mockDicomImage = {
      studyInstanceUID: imagingStudy.identifier?.[0]?.value || imagingStudy.id || '',
      seriesInstanceUID: imagingStudy.series?.[0]?.uid || '',
      sopInstanceUID: imagingStudy.series?.[0]?.instance?.[0]?.uid || '',
      imageUrl: '',
      metadata: {
        patientID: imagingStudy.subject.reference.split('/')[1] || '',
        patientName: imagingStudy.subject.display || '',
        studyDate: imagingStudy.started?.split('T')[0] || '',
        studyTime: imagingStudy.started?.split('T')[1] || '',
        modality: imagingStudy.modality?.[0]?.code || '',
        bodyPart: imagingStudy.series?.[0]?.bodySite?.display || '',
        studyDescription: imagingStudy.description || '',
        seriesDescription: imagingStudy.series?.[0]?.description || '',
        institutionName: 'WebQX Medical Center',
        referringPhysician: imagingStudy.referrer?.display || ''
      }
    };

    return await this.routingService.routeStudy(mockDicomImage, patientContext);
  }
}

module.exports = ImagingStudyService;