/**
 * Imaging Utilities
 * 
 * Utility functions for imaging operations, format conversions, and calculations.
 */

import { DICOMStudy, DICOMSeries, DICOMInstance } from '../types';

export class ImagingUtils {

  /**
   * Format patient name from DICOM format (Last^First^Middle) to display format
   */
  static formatPatientName(dicomName: string): string {
    if (!dicomName) return 'Unknown Patient';
    
    const parts = dicomName.split('^');
    const lastName = parts[0] || '';
    const firstName = parts[1] || '';
    const middleName = parts[2] || '';
    
    let formatted = '';
    if (firstName) formatted += firstName;
    if (middleName) formatted += ` ${middleName}`;
    if (lastName) formatted += ` ${lastName}`;
    
    return formatted.trim() || 'Unknown Patient';
  }

  /**
   * Format DICOM date (YYYYMMDD) to readable format
   */
  static formatDICOMDate(dicomDate: string): string {
    if (!dicomDate || dicomDate.length !== 8) {
      return 'Unknown Date';
    }
    
    const year = dicomDate.substring(0, 4);
    const month = dicomDate.substring(4, 6);
    const day = dicomDate.substring(6, 8);
    
    try {
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  }

  /**
   * Format DICOM time (HHMMSS) to readable format
   */
  static formatDICOMTime(dicomTime: string): string {
    if (!dicomTime || dicomTime.length < 6) {
      return 'Invalid Time';
    }
    
    const hours = dicomTime.substring(0, 2);
    const minutes = dicomTime.substring(2, 4);
    const seconds = dicomTime.substring(4, 6);
    
    // Validate that hours, minutes, seconds are numeric
    if (!/^\d{2}$/.test(hours) || !/^\d{2}$/.test(minutes) || !/^\d{2}$/.test(seconds)) {
      return 'Invalid Time';
    }
    
    try {
      const time = new Date();
      time.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds));
      return time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Invalid Time';
    }
  }

  /**
   * Get human-readable modality name
   */
  static getModalityName(modality: string): string {
    const modalityNames: Record<string, string> = {
      'CT': 'CT Scan',
      'MR': 'MRI',
      'XR': 'X-Ray',
      'US': 'Ultrasound',
      'MG': 'Mammography',
      'PT': 'PET Scan',
      'NM': 'Nuclear Medicine',
      'RF': 'Fluoroscopy',
      'DX': 'Digital Radiography',
      'CR': 'Computed Radiography',
      'MX': 'Mammography',
      'IO': 'Intra-Oral Radiography',
      'PX': 'Panoramic X-Ray',
      'GM': 'General Microscopy',
      'SM': 'Slide Microscopy',
      'XA': 'X-Ray Angiography',
      'BI': 'Biomagnetic Imaging',
      'DG': 'Diaphanography',
      'ES': 'Endoscopy',
      'LS': 'Laser Surface Scan',
      'OP': 'Ophthalmic Photography',
      'OT': 'Other',
      'SC': 'Secondary Capture',
      'ST': 'Structured Report',
      'TG': 'Thermography',
      'RTIMAGE': 'Radiotherapy Image',
      'RTDOSE': 'Radiotherapy Dose',
      'RTSTRUCT': 'Radiotherapy Structure Set',
      'RTPLAN': 'Radiotherapy Plan',
      'RTRECORD': 'RT Treatment Record',
      'HC': 'Hard Copy',
      'AU': 'Audio',
      'ECG': 'Electrocardiography',
      'EPS': 'Cardiac Electrophysiology',
      'HD': 'Hemodynamic Waveform',
      'EEG': 'Electroencephalography',
      'EMG': 'Electromyography',
      'EOG': 'Electrooculography',
      'EP': 'Evoked Potential',
      'IVOCT': 'Intravascular OCT',
      'IVUS': 'Intravascular Ultrasound',
      'KER': 'Keratometry',
      'LEN': 'Lensometry',
      'OAM': 'Ophthalmic Axial Measurements',
      'OCT': 'Optical Coherence Tomography',
      'OPM': 'Ophthalmic Mapping',
      'OPT': 'Ophthalmic Tomography',
      'OPV': 'Ophthalmic Visual Field',
      'OSS': 'Optical Surface Scan',
      'PLAN': 'Plan',
      'REG': 'Registration',
      'RESP': 'Respiratory Waveform',
      'RWV': 'Real World Value Map',
      'SEG': 'Segmentation',
      'SMR': 'Stereometric Relationship',
      'SR': 'SR Document',
      'SRF': 'Subjective Refraction',
      'STAIN': 'Automated Slide Stainer',
      'VA': 'Visual Acuity',
      'XC': 'External Camera Photography'
    };
    
    return modalityNames[modality.toUpperCase()] || modality;
  }

  /**
   * Get modality icon/emoji
   */
  static getModalityIcon(modality: string): string {
    const modalityIcons: Record<string, string> = {
      'CT': '🏥',
      'MR': '🧲',
      'XR': '🦴',
      'US': '〰️',
      'MG': '🔍',
      'PT': '☢️',
      'NM': '☢️',
      'RF': '📹',
      'DX': '📸',
      'CR': '📸',
      'ECG': '💓',
      'EEG': '🧠',
      'EMG': '💪',
      'AU': '🔊'
    };
    
    return modalityIcons[modality.toUpperCase()] || '📸';
  }

  /**
   * Calculate study size in MB
   */
  static calculateStudySize(study: DICOMStudy): number {
    // Estimate based on modality and number of images
    const sizePerImageMB: Record<string, number> = {
      'CT': 0.5,    // ~512KB per CT slice
      'MR': 0.25,   // ~256KB per MR slice
      'XR': 8,      // ~8MB per X-ray
      'US': 0.1,    // ~100KB per US frame
      'MG': 50,     // ~50MB per mammogram
      'PT': 2,      // ~2MB per PET slice
      'NM': 0.5,    // ~512KB per NM image
      'RF': 1,      // ~1MB per fluoro frame
      'DX': 8       // ~8MB per digital X-ray
    };
    
    let totalSize = 0;
    for (const modality of study.modalities) {
      const imageSize = sizePerImageMB[modality] || 1;
      totalSize += study.numberOfImages * imageSize;
    }
    
    return Math.round(totalSize * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Format file size to human readable format
   */
  static formatFileSize(sizeInMB: number): string {
    if (sizeInMB < 1) {
      return `${Math.round(sizeInMB * 1024)} KB`;
    } else if (sizeInMB < 1024) {
      return `${Math.round(sizeInMB * 100) / 100} MB`;
    } else {
      return `${Math.round(sizeInMB / 1024 * 100) / 100} GB`;
    }
  }

  /**
   * Get body part display name
   */
  static getBodyPartName(bodyPart: string): string {
    const bodyPartNames: Record<string, string> = {
      'CHEST': 'Chest',
      'ABDOMEN': 'Abdomen',
      'PELVIS': 'Pelvis',
      'HEAD': 'Head',
      'NECK': 'Neck',
      'SPINE': 'Spine',
      'EXTREMITY': 'Extremity',
      'BREAST': 'Breast',
      'HEART': 'Heart',
      'LUNG': 'Lung',
      'LIVER': 'Liver',
      'KIDNEY': 'Kidney',
      'BRAIN': 'Brain',
      'SKULL': 'Skull',
      'SINUS': 'Sinus',
      'JAW': 'Jaw',
      'TOOTH': 'Tooth',
      'EYE': 'Eye',
      'EAR': 'Ear',
      'NOSE': 'Nose',
      'THROAT': 'Throat',
      'ARM': 'Arm',
      'LEG': 'Leg',
      'HAND': 'Hand',
      'FOOT': 'Foot',
      'SHOULDER': 'Shoulder',
      'ELBOW': 'Elbow',
      'WRIST': 'Wrist',
      'HIP': 'Hip',
      'KNEE': 'Knee',
      'ANKLE': 'Ankle'
    };
    
    return bodyPartNames[bodyPart.toUpperCase()] || bodyPart;
  }

  /**
   * Sort studies by date (newest first)
   */
  static sortStudiesByDate(studies: DICOMStudy[]): DICOMStudy[] {
    return [...studies].sort((a, b) => {
      const dateA = parseInt(a.studyDate + a.studyTime);
      const dateB = parseInt(b.studyDate + b.studyTime);
      return dateB - dateA; // Newest first
    });
  }

  /**
   * Filter studies by modality
   */
  static filterStudiesByModality(studies: DICOMStudy[], modalities: string[]): DICOMStudy[] {
    if (modalities.length === 0) return studies;
    
    return studies.filter(study => 
      study.modalities.some(modality => 
        modalities.includes(modality.toUpperCase())
      )
    );
  }

  /**
   * Filter studies by date range
   */
  static filterStudiesByDateRange(
    studies: DICOMStudy[], 
    startDate: string, 
    endDate: string
  ): DICOMStudy[] {
    const start = parseInt(startDate.replace(/-/g, ''));
    const end = parseInt(endDate.replace(/-/g, ''));
    
    return studies.filter(study => {
      const studyDate = parseInt(study.studyDate);
      return studyDate >= start && studyDate <= end;
    });
  }

  /**
   * Group studies by modality
   */
  static groupStudiesByModality(studies: DICOMStudy[]): Record<string, DICOMStudy[]> {
    const grouped: Record<string, DICOMStudy[]> = {};
    
    studies.forEach(study => {
      study.modalities.forEach(modality => {
        if (!grouped[modality]) {
          grouped[modality] = [];
        }
        if (!grouped[modality].some(s => s.studyInstanceUID === study.studyInstanceUID)) {
          grouped[modality].push(study);
        }
      });
    });
    
    return grouped;
  }

  /**
   * Get study statistics
   */
  static getStudyStatistics(studies: DICOMStudy[]): {
    totalStudies: number;
    totalSeries: number;
    totalImages: number;
    modalityCounts: Record<string, number>;
    totalSizeMB: number;
    dateRange: { earliest: string; latest: string };
  } {
    const modalityCounts: Record<string, number> = {};
    let totalSeries = 0;
    let totalImages = 0;
    let totalSizeMB = 0;
    let earliestDate = '';
    let latestDate = '';
    
    studies.forEach(study => {
      totalSeries += study.numberOfSeries;
      totalImages += study.numberOfImages;
      totalSizeMB += this.calculateStudySize(study);
      
      study.modalities.forEach(modality => {
        modalityCounts[modality] = (modalityCounts[modality] || 0) + 1;
      });
      
      if (!earliestDate || study.studyDate < earliestDate) {
        earliestDate = study.studyDate;
      }
      
      if (!latestDate || study.studyDate > latestDate) {
        latestDate = study.studyDate;
      }
    });
    
    return {
      totalStudies: studies.length,
      totalSeries,
      totalImages,
      modalityCounts,
      totalSizeMB: Math.round(totalSizeMB * 100) / 100,
      dateRange: {
        earliest: this.formatDICOMDate(earliestDate),
        latest: this.formatDICOMDate(latestDate)
      }
    };
  }

  /**
   * Generate study summary text
   */
  static generateStudySummary(study: DICOMStudy): string {
    const patientName = this.formatPatientName(study.patientName);
    const studyDate = this.formatDICOMDate(study.studyDate);
    const modalities = study.modalities.map(m => this.getModalityName(m)).join(', ');
    const size = this.formatFileSize(this.calculateStudySize(study));
    
    return `${patientName} - ${study.studyDescription} (${studyDate}) - ${modalities} - ${study.numberOfImages} images (${size})`;
  }

  /**
   * Extract age from DICOM date and birth date
   */
  static calculateAge(birthDate: string, studyDate: string): number | null {
    if (!birthDate || !studyDate || birthDate.length !== 8 || studyDate.length !== 8) {
      return null;
    }
    
    try {
      const birth = new Date(
        parseInt(birthDate.substring(0, 4)),
        parseInt(birthDate.substring(4, 6)) - 1,
        parseInt(birthDate.substring(6, 8))
      );
      
      const study = new Date(
        parseInt(studyDate.substring(0, 4)),
        parseInt(studyDate.substring(4, 6)) - 1,
        parseInt(studyDate.substring(6, 8))
      );
      
      let age = study.getFullYear() - birth.getFullYear();
      const monthDiff = study.getMonth() - birth.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && study.getDate() < birth.getDate())) {
        age--;
      }
      
      return age >= 0 ? age : null;
    } catch {
      return null;
    }
  }

  /**
   * Generate DICOM web URL for instance
   */
  static generateDICOMWebURL(
    baseUrl: string,
    studyUID: string,
    seriesUID?: string,
    instanceUID?: string
  ): string {
    let url = `${baseUrl}/studies/${studyUID}`;
    
    if (seriesUID) {
      url += `/series/${seriesUID}`;
      
      if (instanceUID) {
        url += `/instances/${instanceUID}`;
      }
    }
    
    return url;
  }

  /**
   * Convert ISO date to DICOM date format
   */
  static isoToDICOMDate(isoDate: string): string {
    const date = new Date(isoDate);
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return year + month + day;
  }

  /**
   * Convert ISO time to DICOM time format
   */
  static isoToDICOMTime(isoDateTime: string): string {
    const date = new Date(isoDateTime);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return hours + minutes + seconds;
  }
}