import React, { useState } from 'react';
import PharmacyLocator from '../components/PharmacyLocator';
import '../styles/PharmacyDemo.css';

/**
 * PharmacyDemo component - Demonstration page for the PharmacyLocator component
 * 
 * This page allows users to test different scenarios with the PharmacyLocator:
 * - Different medication types (generic, brand, etc.)
 * - Error conditions
 * - Empty results
 */

interface PharmacyDemoProps {
  /** CSS class name for additional styling */
  className?: string;
}

const PharmacyDemo: React.FC<PharmacyDemoProps> = ({ className = "" }) => {
  const [selectedRxcui, setSelectedRxcui] = useState<string>('demo-medication');

  const rxcuiOptions = [
    { value: 'demo-medication', label: 'Demo Medication (Regular)' },
    { value: 'generic-medication', label: 'Generic Medication (Lower Prices)' },
    { value: 'brand-medication', label: 'Brand Medication (Higher Prices)' },
    { value: 'empty', label: 'No Results Available' },
    { value: '', label: 'Empty RxCUI (No Fetch)' }
  ];

  return (
    <main 
      className={`pharmacy-demo ${className}`}
      role="main"
      aria-label="Pharmacy Locator Demo Page"
    >
      <header className="demo-header">
        <h1>📍 Pharmacy Locator Component Demo</h1>
        <p>
          This demo showcases the enhanced PharmacyLocator component with improved 
          TypeScript support, error handling, loading states, and accessibility features.
        </p>
      </header>

      <section className="demo-controls" role="region" aria-labelledby="demo-controls-heading">
        <h2 id="demo-controls-heading">Demo Controls</h2>
        <div className="control-group">
          <label htmlFor="rxcui-select">
            <strong>Select Medication Type:</strong>
          </label>
          <select
            id="rxcui-select"
            value={selectedRxcui}
            onChange={(e) => setSelectedRxcui(e.target.value)}
            aria-describedby="rxcui-help"
          >
            {rxcuiOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p id="rxcui-help" className="help-text">
            Choose different scenarios to see how the component handles various data states.
          </p>
        </div>
      </section>

      <section className="demo-component" role="region" aria-labelledby="demo-component-heading">
        <h2 id="demo-component-heading">PharmacyLocator Component</h2>
        <div className="component-wrapper">
          <PharmacyLocator 
            rxcui={selectedRxcui}
            className="demo-pharmacy-locator"
          />
        </div>
      </section>

      <section className="demo-features" role="region" aria-labelledby="demo-features-heading">
        <h2 id="demo-features-heading">Component Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>🔒 TypeScript Enhanced</h3>
            <ul>
              <li>Strong type safety with custom interfaces</li>
              <li>No more 'any' types</li>
              <li>Comprehensive type definitions</li>
            </ul>
          </div>
          
          <div className="feature-card">
            <h3>⚠️ Error Handling</h3>
            <ul>
              <li>Graceful error messages</li>
              <li>Retry functionality</li>
              <li>Network failure recovery</li>
            </ul>
          </div>
          
          <div className="feature-card">
            <h3>⏳ Loading States</h3>
            <ul>
              <li>Visual loading indicators</li>
              <li>Accessible status updates</li>
              <li>Smooth state transitions</li>
            </ul>
          </div>
          
          <div className="feature-card">
            <h3>♿ Accessibility</h3>
            <ul>
              <li>Semantic HTML structure</li>
              <li>ARIA labels and roles</li>
              <li>Screen reader support</li>
            </ul>
          </div>
          
          <div className="feature-card">
            <h3>🎨 UI Enhancements</h3>
            <ul>
              <li>Visual price highlighting</li>
              <li>Distance-based organization</li>
              <li>Status indicators</li>
            </ul>
          </div>
          
          <div className="feature-card">
            <h3>🧪 Comprehensive Testing</h3>
            <ul>
              <li>Unit test coverage</li>
              <li>Error scenario testing</li>
              <li>Accessibility testing</li>
            </ul>
          </div>
        </div>
      </section>


    </main>
  );
};

export default PharmacyDemo;