/**
 * @fileoverview Annotated Report Viewer Component
 * 
 * Provides a secure, accessible interface for patients to view medical reports
 * with highlighted medical terms that link to glossary definitions.
 * 
 * Features:
 * - FHIR-compliant report display
 * - Interactive medical term annotations
 * - Integrated glossary popup/sidebar
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Multilingual support
 * - Audit logging
 * - Print and download functionality
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DiagnosticReport,
  MedicalGlossaryTerm,
  TermAnnotation,
  ReportViewerConfig,
  ReportAccessError,
  AnnotatedReportViewerProps
} from '../types/reports';

/**
 * Default configuration for the report viewer
 */
const DEFAULT_CONFIG: ReportViewerConfig = {
  showAnnotations: true,
  enableGlossary: true,
  language: 'en',
  accessLevel: 'patient',
  auditLogging: true
};

/**
 * AnnotatedReportViewer Component
 * 
 * Displays medical reports with interactive annotations and glossary integration
 */
export const AnnotatedReportViewer: React.FC<AnnotatedReportViewerProps> = ({
  reportId,
  config = {},
  onTermSelect,
  onError,
  className = ''
}) => {
  const { t, i18n } = useTranslation();
  const viewerConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Component state
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [glossaryTerms, setGlossaryTerms] = useState<Map<string, MedicalGlossaryTerm>>(new Map());
  const [selectedTerm, setSelectedTerm] = useState<MedicalGlossaryTerm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ReportAccessError | null>(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const [highlightedTerms, setHighlightedTerms] = useState<Set<string>>(new Set());
  
  // Refs for accessibility and interaction
  const reportContentRef = useRef<HTMLDivElement>(null);
  const glossaryRef = useRef<HTMLDivElement>(null);

  /**
   * Load the diagnostic report from the API
   */
  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get authentication token for FHIR API
      const tokenResponse = await fetch('/dev/token');
      const tokenData = await tokenResponse.json();

      const response = await fetch(`/fhir/DiagnosticReport/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/fhir+json',
          'Accept-Language': viewerConfig.language
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Report not found');
        } else if (response.status === 403) {
          throw new Error('Access denied');
        } else {
          throw new Error('Failed to load report');
        }
      }

      const reportData: DiagnosticReport = await response.json();
      setReport(reportData);

      // Load glossary terms for annotations
      if (reportData.annotations && viewerConfig.enableGlossary) {
        await loadGlossaryTerms(reportData.annotations);
      }

      // Log access for audit purposes
      if (viewerConfig.auditLogging) {
        console.log(`Report viewed: ${reportId} by user at ${new Date().toISOString()}`);
      }

    } catch (err) {
      const error: ReportAccessError = {
        code: err instanceof Error && err.message.includes('not found') ? 'NOT_FOUND' :
              err instanceof Error && err.message.includes('denied') ? 'ACCESS_DENIED' : 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error occurred'
      };
      setError(error);
      onError?.(new Error(error.message));
    } finally {
      setIsLoading(false);
    }
  }, [reportId, viewerConfig.language, viewerConfig.enableGlossary, viewerConfig.auditLogging, onError]);

  /**
   * Load glossary terms for the annotations in the report
   */
  const loadGlossaryTerms = async (annotations: TermAnnotation[]) => {
    const termIds = Array.from(new Set(annotations.map(ann => ann.termId)));
    const termsMap = new Map<string, MedicalGlossaryTerm>();

    try {
      // Load terms in batches
      const promises = termIds.map(async (termId) => {
        const response = await fetch(`/api/glossary/medical-terms/${termId}?language=${viewerConfig.language}`);
        if (response.ok) {
          const term: MedicalGlossaryTerm = await response.json();
          return { termId, term };
        }
        return null;
      });

      const results = await Promise.all(promises);
      results.forEach(result => {
        if (result) {
          termsMap.set(result.termId, result.term);
        }
      });

      setGlossaryTerms(termsMap);
    } catch (err) {
      console.warn('Failed to load some glossary terms:', err);
    }
  };

  /**
   * Handle term selection from annotations
   */
  const handleTermSelect = (termId: string, event: React.MouseEvent) => {
    event.preventDefault();
    const term = glossaryTerms.get(termId);
    
    if (term) {
      setSelectedTerm(term);
      setShowGlossary(true);
      onTermSelect?.(term);

      // Log glossary access for audit purposes
      if (viewerConfig.auditLogging) {
        console.log(`Glossary term accessed: ${termId} from report ${reportId}`);
      }

      // Focus management for accessibility
      setTimeout(() => {
        glossaryRef.current?.focus();
      }, 100);
    }
  };

  /**
   * Process report content to add interactive annotations
   */
  const processReportContent = (htmlContent: string, annotations: TermAnnotation[]): string => {
    if (!viewerConfig.showAnnotations || !viewerConfig.enableGlossary) {
      return htmlContent;
    }

    let processedContent = htmlContent;

    // Sort annotations by position (reverse order to maintain positions)
    const sortedAnnotations = [...annotations].sort((a, b) => 
      b.positions[0].start - a.positions[0].start
    );

    sortedAnnotations.forEach(annotation => {
      annotation.positions.forEach(position => {
        const term = glossaryTerms.get(annotation.termId);
        if (term) {
          const beforeText = processedContent.substring(0, position.start);
          const termText = processedContent.substring(position.start, position.end);
          const afterText = processedContent.substring(position.end);

          const annotatedTerm = `
            <button 
              class="medical-term-annotation" 
              data-term-id="${annotation.termId}"
              aria-describedby="term-${annotation.termId}-description"
              title="${term.plainLanguage}"
              onclick="handleTermClick('${annotation.termId}', event)"
            >
              ${termText}
            </button>
            <div id="term-${annotation.termId}-description" class="sr-only">
              ${term.plainLanguage}
            </div>
          `;

          processedContent = beforeText + annotatedTerm + afterText;
        }
      });
    });

    return processedContent;
  };

  /**
   * Handle print functionality
   */
  const handlePrint = () => {
    window.print();
    
    if (viewerConfig.auditLogging) {
      console.log(`Report printed: ${reportId} at ${new Date().toISOString()}`);
    }
  };

  /**
   * Handle download functionality
   */
  const handleDownload = () => {
    if (!report?.presentedForm?.[0]) return;

    try {
      const content = atob(report.presentedForm[0].data);
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `medical-report-${reportId}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (viewerConfig.auditLogging) {
        console.log(`Report downloaded: ${reportId} at ${new Date().toISOString()}`);
      }
    } catch (err) {
      console.error('Failed to download report:', err);
    }
  };

  /**
   * Close glossary panel
   */
  const closeGlossary = () => {
    setShowGlossary(false);
    setSelectedTerm(null);
  };

  // Load report on component mount or when reportId changes
  useEffect(() => {
    if (reportId) {
      loadReport();
    }
  }, [reportId, loadReport]);

  // Set up global click handler for annotations
  useEffect(() => {
    // @ts-ignore
    window.handleTermClick = handleTermSelect;
    
    return () => {
      // @ts-ignore
      delete window.handleTermClick;
    };
  }, [glossaryTerms, viewerConfig.auditLogging]);

  if (isLoading) {
    return (
      <div className={`report-viewer loading ${className}`}>
        <div className="loading-container">
          <div className="loading-spinner" aria-label={t('reports.loading')} />
          <p>{t('reports.loading_message')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`report-viewer error ${className}`}>
        <div className="error-container">
          <h2>{t('reports.error_title')}</h2>
          <p>{t(`reports.error_${error.code.toLowerCase()}`, error.message)}</p>
          <button onClick={loadReport} className="retry-button">
            {t('reports.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={`report-viewer empty ${className}`}>
        <p>{t('reports.no_report')}</p>
      </div>
    );
  }

  const reportContent = report.presentedForm?.[0] ? 
    atob(report.presentedForm[0].data) : '';
  
  const processedContent = report.annotations ? 
    processReportContent(reportContent, report.annotations) : reportContent;

  return (
    <div className={`report-viewer ${className}`}>
      {/* Report Header */}
      <header className="report-header">
        <div className="report-meta">
          <h1>{report.code.coding[0].display}</h1>
          <div className="report-details">
            <span className="report-date">
              {t('reports.date')}: {new Date(report.effectiveDateTime).toLocaleDateString()}
            </span>
            <span className="report-status">
              {t('reports.status')}: {t(`reports.status_${report.status}`)}
            </span>
          </div>
        </div>
        
        <div className="report-actions">
          <button onClick={handlePrint} className="action-button print-button">
            🖨️ {t('reports.print')}
          </button>
          <button onClick={handleDownload} className="action-button download-button">
            💾 {t('reports.download')}
          </button>
          {viewerConfig.enableGlossary && (
            <button 
              onClick={() => setShowGlossary(!showGlossary)}
              className="action-button glossary-button"
              aria-pressed={showGlossary}
            >
              📖 {t('reports.glossary')}
            </button>
          )}
        </div>
      </header>

      <div className="report-content-container">
        {/* Main Report Content */}
        <main className="report-content" ref={reportContentRef}>
          <div 
            dangerouslySetInnerHTML={{ __html: processedContent }}
            className="report-html-content"
          />
        </main>

        {/* Glossary Sidebar */}
        {showGlossary && viewerConfig.enableGlossary && (
          <aside 
            className="glossary-sidebar"
            ref={glossaryRef}
            tabIndex={-1}
            aria-label={t('reports.glossary_sidebar')}
          >
            <div className="glossary-header">
              <h2>{t('reports.medical_glossary')}</h2>
              <button 
                onClick={closeGlossary}
                className="close-button"
                aria-label={t('reports.close_glossary')}
              >
                ✕
              </button>
            </div>

            {selectedTerm ? (
              <div className="term-details">
                <h3>{selectedTerm.term}</h3>
                
                <div className="definition-section">
                  <h4>{t('reports.medical_definition')}</h4>
                  <p>{selectedTerm.definition}</p>
                </div>

                <div className="plain-language-section">
                  <h4>{t('reports.simple_explanation')}</h4>
                  <p>{selectedTerm.plainLanguage}</p>
                </div>

                {selectedTerm.normalRange && (
                  <div className="normal-range-section">
                    <h4>{t('reports.normal_range')}</h4>
                    <p>{selectedTerm.normalRange}</p>
                  </div>
                )}

                {selectedTerm.examples && selectedTerm.examples.length > 0 && (
                  <div className="examples-section">
                    <h4>{t('reports.examples')}</h4>
                    <ul>
                      {selectedTerm.examples.map((example, index) => (
                        <li key={index}>{example}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedTerm.relatedTerms && selectedTerm.relatedTerms.length > 0 && (
                  <div className="related-terms-section">
                    <h4>{t('reports.related_terms')}</h4>
                    <div className="related-terms">
                      {selectedTerm.relatedTerms.map(relatedId => {
                        const relatedTerm = glossaryTerms.get(relatedId);
                        return relatedTerm ? (
                          <button
                            key={relatedId}
                            className="related-term-button"
                            onClick={() => setSelectedTerm(relatedTerm)}
                          >
                            {relatedTerm.term}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glossary-help">
                <p>{t('reports.glossary_help')}</p>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};

export default AnnotatedReportViewer;