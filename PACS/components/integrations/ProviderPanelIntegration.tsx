/**
 * PACS Integration with Provider Panel
 * 
 * Integration component to connect PACS functionality with provider interfaces.
 */

import React from 'react';
import { PACSProviderDashboard } from '../provider/PACSProviderDashboard';
import { DICOMStudy, ImagingOrder } from '../../types';

interface ProviderPanelPACSIntegrationProps {
  providerID: string;
  isAuthenticated: boolean;
  specialty?: string;
  className?: string;
  onStudySelect?: (study: DICOMStudy) => void;
  onOrderCreate?: (order: ImagingOrder) => void;
}

export const ProviderPanelPACSIntegration: React.FC<ProviderPanelPACSIntegrationProps> = ({
  providerID,
  isAuthenticated,
  specialty,
  className = '',
  onStudySelect,
  onOrderCreate
}) => {
  if (!isAuthenticated) {
    return (
      <div className={`pacs-integration auth-required ${className}`}>
        <div className="auth-message">
          <h3>🔒 Provider Authentication Required</h3>
          <p>Please authenticate to access the PACS provider dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`pacs-integration provider-panel ${className}`}>
      <div className="integration-header">
        <h2>Medical Imaging Dashboard</h2>
        {specialty && (
          <div className="specialty-indicator">
            <span className="specialty-label">Specialty:</span>
            <span className="specialty-value">{specialty}</span>
          </div>
        )}
      </div>
      
      <PACSProviderDashboard
        providerID={providerID}
        onStudySelect={onStudySelect}
        onOrderCreate={onOrderCreate}
        className="provider-dashboard"
      />
    </div>
  );
};

export default ProviderPanelPACSIntegration;