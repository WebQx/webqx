/**
 * @fileoverview Report Access Page Component
 * 
 * Main page for patients to access their medical reports with annotations
 * and integrated glossary support. Provides secure, HIPAA-compliant access
 * to diagnostic reports with enhanced readability features.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../components/Header';
import AnnotatedReportViewer from '../components/AnnotatedReportViewer';
import MedicalGlossary from '../components/MedicalGlossary';
import { DiagnosticReport, MedicalGlossaryTerm } from '../types/reports';
import { SupportedLanguage } from '../types/localization';

interface ReportAccessProps {
  patientId?: string;
  initialLanguage?: SupportedLanguage;
  onLanguageChange?: (language: SupportedLanguage) => void;
}

/**
 * ReportAccess Page Component
 * 
 * Provides secure access to medical reports with glossary integration
 */
const ReportAccess: React.FC<ReportAccessProps> = ({
  patientId = 'patient-123',
  initialLanguage = 'en',
  onLanguageChange
}) => {
  const { t, i18n } = useTranslation();
  
  // Component state
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(initialLanguage);
  const [availableReports, setAvailableReports] = useState<DiagnosticReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<MedicalGlossaryTerm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load available reports for the patient
   */
  const loadAvailableReports = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get authentication token for FHIR API
      const tokenResponse = await fetch('/dev/token');
      const tokenData = await tokenResponse.json();

      const response = await fetch(`/fhir/DiagnosticReport?patient=${patientId}&_count=50`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/fhir+json',
          'Accept-Language': currentLanguage
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load reports');
      }

      const bundle = await response.json();
      const reports = bundle.entry?.map((entry: any) => entry.resource) || [];
      setAvailableReports(reports);

      // Auto-select first report if available
      if (reports.length > 0 && !selectedReportId) {
        setSelectedReportId(reports[0].id);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle language change
   */
  const handleLanguageChange = (language: SupportedLanguage) => {
    setCurrentLanguage(language);
    i18n.changeLanguage(language);
    onLanguageChange?.(language);
  };

  /**
   * Handle term selection from report or glossary
   */
  const handleTermSelect = (term: MedicalGlossaryTerm) => {
    setSelectedTerm(term);
    setShowGlossary(true);
  };

  /**
   * Handle report selection
   */
  const handleReportSelect = (reportId: string) => {
    setSelectedReportId(reportId);
  };

  // Load reports on component mount or when language changes
  useEffect(() => {
    loadAvailableReports();
  }, [patientId, currentLanguage]);

  return (
    <div className="report-access-page">
      {/* Header */}
      <Header 
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        showLanguageSelector={true}
      />

      {/* Main Content */}
      <main className="report-access-main">
        <div className="page-header">
          <h1>{t('reports.page_title')}</h1>
          <p>{t('reports.page_description')}</p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>{t('reports.loading_reports')}</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-container">
            <h2>{t('reports.error_title')}</h2>
            <p>{error}</p>
            <button onClick={loadAvailableReports} className="retry-button">
              {t('reports.retry')}
            </button>
          </div>
        )}

        {/* Content Layout */}
        {!isLoading && !error && (
          <div className="report-access-content">
            {/* Sidebar with report list and glossary toggle */}
            <aside className="reports-sidebar">
              <div className="reports-list-section">
                <h2>{t('reports.available_reports')}</h2>
                {availableReports.length === 0 ? (
                  <p>{t('reports.no_reports_available')}</p>
                ) : (
                  <ul className="reports-list">
                    {availableReports.map(report => (
                      <li key={report.id}>
                        <button
                          className={`report-item ${selectedReportId === report.id ? 'selected' : ''}`}
                          onClick={() => handleReportSelect(report.id)}
                        >
                          <div className="report-title">
                            {report.code.coding[0].display}
                          </div>
                          <div className="report-date">
                            {new Date(report.effectiveDateTime).toLocaleDateString()}
                          </div>
                          <div className="report-status">
                            {t(`reports.status_${report.status}`)}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="glossary-section">
                <button
                  className={`glossary-toggle ${showGlossary ? 'active' : ''}`}
                  onClick={() => setShowGlossary(!showGlossary)}
                  aria-pressed={showGlossary}
                >
                  📖 {t('reports.medical_glossary')}
                </button>
                
                {showGlossary && (
                  <div className="sidebar-glossary">
                    <MedicalGlossary
                      embedded={true}
                      language={currentLanguage}
                      onTermSelect={handleTermSelect}
                      className="embedded-glossary"
                    />
                  </div>
                )}
              </div>
            </aside>

            {/* Main report viewer */}
            <div className="report-viewer-section">
              {selectedReportId ? (
                <AnnotatedReportViewer
                  reportId={selectedReportId}
                  config={{
                    showAnnotations: true,
                    enableGlossary: true,
                    language: currentLanguage,
                    accessLevel: 'patient',
                    auditLogging: true
                  }}
                  onTermSelect={handleTermSelect}
                  onError={(error) => setError(error.message)}
                />
              ) : (
                <div className="no-report-selected">
                  <h2>{t('reports.select_report')}</h2>
                  <p>{t('reports.select_report_message')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer with security notice */}
      <footer className="report-access-footer">
        <div className="security-notice">
          <p>🔒 {t('reports.security_notice')}</p>
          <p>{t('reports.hipaa_compliance')}</p>
        </div>
      </footer>
    </div>
  );
};

export default ReportAccess;