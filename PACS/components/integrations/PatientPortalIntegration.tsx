/**
 * PACS Integration with Patient Portal
 * 
 * Integration component to connect PACS functionality with the existing patient portal.
 */

import React from 'react';
import { PACSPatientViewer } from '../patient/PACSPatientViewer';

interface PatientPortalPACSIntegrationProps {
  patientID: string;
  isAuthenticated: boolean;
  className?: string;
}

export const PatientPortalPACSIntegration: React.FC<PatientPortalPACSIntegrationProps> = ({
  patientID,
  isAuthenticated,
  className = ''
}) => {
  if (!isAuthenticated) {
    return (
      <div className={`pacs-integration auth-required ${className}`}>
        <div className="auth-message">
          <h3>🔒 Authentication Required</h3>
          <p>Please log in to view your medical imaging studies.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`pacs-integration patient-portal ${className}`}>
      <PACSPatientViewer
        patientID={patientID}
        enableEducationalContent={true}
        enableDownload={false}
        enableSharing={true}
        className="patient-portal-viewer"
      />
    </div>
  );
};

export default PatientPortalPACSIntegration;