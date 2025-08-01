import React, { useState, useCallback } from 'react';
import {
  checkDrugInteractions,
  DrugInteractionResult,
  DrugInteraction
} from '../utils/api/drugInteractions';

/**
 * Props for the DrugInteractionChecker component
 */
interface DrugInteractionCheckerProps {
  /** CSS class name for additional styling */
  className?: string;
  /** Optional initial RxCUI to check */
  initialRxcui?: string;
}

/**
 * DrugInteractionChecker Component
 * 
 * A React component that allows users to check for drug interactions
 * using the FDA's RxNav API. Provides a user-friendly interface for
 * healthcare providers and patients to identify potential drug interactions.
 * 
 * Features:
 * - Input validation with real-time feedback
 * - Loading states during API calls
 * - Error handling with user-friendly messages
 * - Accessible design with ARIA labels
 * - Responsive layout
 */
const DrugInteractionChecker: React.FC<DrugInteractionCheckerProps> = ({
  className = '',
  initialRxcui = ''
}) => {
  const [rxcui, setRxcui] = useState<string>(initialRxcui);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<DrugInteractionResult | null>(null);
  const [hasChecked, setHasChecked] = useState<boolean>(false);

  /**
   * Handles the drug interaction check
   */
  const handleCheckInteractions = useCallback(async () => {
    if (!rxcui.trim()) {
      setResult({
        success: false,
        interactions: [],
        error: 'Please enter a valid RxCUI (drug identifier)',
        rxcui: rxcui
      });
      setHasChecked(true);
      return;
    }

    setIsLoading(true);
    setHasChecked(false);

    try {
      const interactionResult = await checkDrugInteractions({ rxcui: rxcui.trim() });
      setResult(interactionResult);
      setHasChecked(true);
    } catch (error) {
      setResult({
        success: false,
        interactions: [],
        error: 'An unexpected error occurred. Please try again.',
        rxcui: rxcui
      });
      setHasChecked(true);
    } finally {
      setIsLoading(false);
    }
  }, [rxcui]);

  /**
   * Handles form submission
   */
  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    handleCheckInteractions();
  }, [handleCheckInteractions]);

  /**
   * Handles input change
   */
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRxcui(event.target.value);
    // Reset results when input changes
    if (hasChecked) {
      setHasChecked(false);
      setResult(null);
    }
  }, [hasChecked]);

  /**
   * Renders a single drug interaction
   */
  const renderInteraction = (interaction: DrugInteraction, index: number) => (
    <div
      key={index}
      className="interaction-item"
      role="listitem"
      aria-label={`Drug interaction ${index + 1}`}
    >
      <div className="interaction-header">
        <span 
          className={`severity-badge severity-${interaction.severity?.toLowerCase() || 'unknown'}`}
          aria-label={`Severity: ${interaction.severity || 'Unknown'}`}
        >
          {interaction.severity || 'Unknown'}
        </span>
        <span className="source-badge" aria-label={`Source: ${interaction.source}`}>
          {interaction.source}
        </span>
      </div>
      <p className="interaction-description">
        {interaction.description}
      </p>
    </div>
  );

  return (
    <div className={`drug-interaction-checker ${className}`}>
      <div className="checker-header">
        <h3 className="checker-title">💊 Drug Interaction Checker</h3>
        <p className="checker-description">
          Enter a drug's RxCUI (RxNorm Concept Unique Identifier) to check for potential interactions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="checker-form" role="search">
        <div className="input-group">
          <label htmlFor="rxcui-input" className="input-label">
            RxCUI (Drug Identifier):
          </label>
          <div className="input-wrapper">
            <input
              id="rxcui-input"
              type="text"
              value={rxcui}
              onChange={handleInputChange}
              placeholder="e.g., 207106 (Warfarin)"
              className="rxcui-input"
              disabled={isLoading}
              aria-describedby="rxcui-help"
              pattern="[0-9]+"
              title="Please enter only numeric characters"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="check-button"
              aria-label="Check for drug interactions"
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner" aria-hidden="true"></span>
                  Checking...
                </>
              ) : (
                'Check Interactions'
              )}
            </button>
          </div>
          <div id="rxcui-help" className="input-help">
            RxCUI is a unique identifier for drugs in the RxNorm database. 
            Examples: 207106 (Warfarin), 1191 (Aspirin), 161 (Acetaminophen)
          </div>
        </div>
      </form>

      {/* Results Section */}
      {hasChecked && result && (
        <div
          className="results-section"
          role="region"
          aria-labelledby="results-heading"
          aria-live="polite"
        >
          <h4 id="results-heading" className="results-title">
            Results for RxCUI: {result.rxcui}
          </h4>

          {result.success ? (
            <div className="results-content">
              {result.interactions.length > 0 ? (
                <>
                  <div className="interaction-summary">
                    <span className="interaction-count" aria-label={`Found ${result.interactions.length} interactions`}>
                      ⚠️ {result.interactions.length} interaction{result.interactions.length !== 1 ? 's' : ''} found
                    </span>
                  </div>
                  <div className="interactions-list" role="list" aria-label="Drug interactions">
                    {result.interactions.map(renderInteraction)}
                  </div>
                </>
              ) : (
                <div className="no-interactions">
                  <span className="success-icon" aria-hidden="true">✅</span>
                  <p className="no-interactions-message">
                    No drug interactions found for this medication.
                  </p>
                  <p className="disclaimer">
                    <small>
                      <em>
                        This search is based on available data in the RxNav database. 
                        Always consult with your healthcare provider for comprehensive drug interaction information.
                      </em>
                    </small>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="error-section" role="alert">
              <span className="error-icon" aria-hidden="true">❌</span>
              <p className="error-message">
                <strong>Error:</strong> {result.error}
              </p>
              <details className="error-details">
                <summary>Troubleshooting</summary>
                <ul>
                  <li>Ensure the RxCUI contains only numeric characters</li>
                  <li>Check your internet connection</li>
                  <li>Try again in a few moments</li>
                  <li>If the problem persists, contact support</li>
                </ul>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Educational Content */}
      <div className="educational-section">
        <details className="info-details">
          <summary>ℹ️ About Drug Interaction Checking</summary>
          <div className="info-content">
            <p>
              This tool uses the FDA's RxNav API to check for known drug interactions. 
              The data comes from authoritative sources and is regularly updated.
            </p>
            <h5>Important Notes:</h5>
            <ul>
              <li>This tool is for informational purposes only</li>
              <li>Not all possible interactions may be included</li>
              <li>Always consult healthcare professionals for medical advice</li>
              <li>Consider all medications, supplements, and over-the-counter drugs</li>
            </ul>
            <h5>Common RxCUI Examples:</h5>
            <ul>
              <li>207106 - Warfarin (blood thinner)</li>
              <li>1191 - Aspirin (pain reliever)</li>
              <li>161 - Acetaminophen (pain reliever)</li>
              <li>36567 - Simvastatin (statin)</li>
            </ul>
          </div>
        </details>
      </div>

      <style>{`
        .drug-interaction-checker {
          background: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .checker-header {
          margin-bottom: 20px;
        }

        .checker-title {
          color: #2c3e50;
          margin: 0 0 8px 0;
          font-size: 1.5rem;
        }

        .checker-description {
          color: #666;
          margin: 0;
          line-height: 1.5;
        }

        .checker-form {
          margin-bottom: 20px;
        }

        .input-group {
          margin-bottom: 16px;
        }

        .input-label {
          display: block;
          font-weight: 600;
          margin-bottom: 6px;
          color: #333;
        }

        .input-wrapper {
          display: flex;
          gap: 8px;
          margin-bottom: 6px;
        }

        .rxcui-input {
          flex: 1;
          padding: 10px 12px;
          border: 2px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .rxcui-input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }

        .rxcui-input:disabled {
          background-color: #f8f9fa;
          cursor: not-allowed;
        }

        .check-button {
          padding: 10px 20px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 140px;
          justify-content: center;
        }

        .check-button:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .check-button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .input-help {
          font-size: 14px;
          color: #666;
          line-height: 1.4;
        }

        .results-section {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .results-title {
          margin: 0 0 16px 0;
          color: #495057;
          font-size: 1.2rem;
        }

        .interaction-summary {
          margin-bottom: 16px;
        }

        .interaction-count {
          background: #fff3cd;
          color: #856404;
          padding: 8px 12px;
          border-radius: 4px;
          font-weight: 600;
          display: inline-block;
        }

        .interactions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .interaction-item {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          padding: 12px;
        }

        .interaction-header {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }

        .severity-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .severity-high {
          background: #f8d7da;
          color: #721c24;
        }

        .severity-moderate {
          background: #fff3cd;
          color: #856404;
        }

        .severity-low {
          background: #d4edda;
          color: #155724;
        }

        .severity-unknown {
          background: #e2e3e5;
          color: #383d41;
        }

        .source-badge {
          background: #e9ecef;
          color: #495057;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        .interaction-description {
          margin: 0;
          line-height: 1.5;
          color: #495057;
        }

        .no-interactions {
          text-align: center;
          padding: 20px;
        }

        .success-icon {
          font-size: 2rem;
          display: block;
          margin-bottom: 8px;
        }

        .no-interactions-message {
          margin: 0 0 16px 0;
          font-size: 1.1rem;
          color: #28a745;
          font-weight: 600;
        }

        .disclaimer {
          margin: 0;
          color: #666;
        }

        .error-section {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 6px;
          padding: 16px;
          color: #721c24;
        }

        .error-icon {
          font-size: 1.2rem;
          margin-right: 8px;
        }

        .error-message {
          margin: 0 0 12px 0;
        }

        .error-details {
          margin-top: 12px;
        }

        .error-details summary {
          cursor: pointer;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .error-details ul {
          margin: 0;
          padding-left: 20px;
        }

        .educational-section {
          border-top: 1px solid #dee2e6;
          padding-top: 20px;
        }

        .info-details summary {
          cursor: pointer;
          font-weight: 600;
          color: #007bff;
          margin-bottom: 12px;
        }

        .info-content h5 {
          margin: 16px 0 8px 0;
          color: #495057;
        }

        .info-content ul {
          margin: 0 0 16px 0;
          padding-left: 20px;
        }

        .info-content p {
          line-height: 1.5;
          margin-bottom: 16px;
        }

        @media (max-width: 600px) {
          .input-wrapper {
            flex-direction: column;
          }
          
          .check-button {
            min-width: auto;
          }
          
          .interaction-header {
            flex-direction: column;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
};

export default DrugInteractionChecker;