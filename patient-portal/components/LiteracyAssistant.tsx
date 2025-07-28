/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React, { useState } from 'react';

/**
 * LiteracyAssistant component provides health literacy support
 * Helps patients understand medical terms and procedures
 */
interface LiteracyAssistantProps {
  /** CSS class name for styling */
  className?: string;
  /** Whether the assistant is initially expanded */
  initiallyExpanded?: boolean;
}

export const LiteracyAssistant: React.FC<LiteracyAssistantProps> = ({
  className = "",
  initiallyExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [searchTerm, setSearchTerm] = useState("");

  // Sample medical terms for demonstration
  const medicalTerms = [
    { term: "Hypertension", definition: "High blood pressure" },
    { term: "Diabetes", definition: "A condition where blood sugar levels are too high" },
    { term: "Prescription", definition: "A written order from a doctor for medication" },
    { term: "Laboratory", definition: "Medical tests performed on blood, urine, or other samples" }
  ];

  const filteredTerms = medicalTerms.filter(item =>
    item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div 
      className={`literacy-assistant ${className}`}
      role="region"
      aria-label="Health Literacy Assistant"
    >
      <div className="literacy-assistant-header">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="literacy-assistant-content"
          className="literacy-toggle-btn"
        >
          📚 Health Literacy Assistant {isExpanded ? '▼' : '▶'}
        </button>
      </div>
      
      {isExpanded && (
        <div 
          id="literacy-assistant-content"
          className="literacy-assistant-content"
          role="region"
          aria-label="Medical terms glossary"
        >
          <div className="literacy-search">
            <label htmlFor="medical-term-search" className="sr-only">
              Search medical terms
            </label>
            <input
              id="medical-term-search"
              type="text"
              placeholder="Search medical terms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="literacy-search-input"
              aria-describedby="search-help"
            />
            <div id="search-help" className="sr-only">
              Type to search for medical terms and their definitions
            </div>
          </div>
          
          <div className="literacy-terms" role="list">
            {filteredTerms.length > 0 ? (
              filteredTerms.map((item, index) => (
                <div key={index} className="literacy-term-item" role="listitem">
                  <dt className="literacy-term">
                    <strong>{item.term}</strong>
                  </dt>
                  <dd className="literacy-definition">{item.definition}</dd>
                </div>
              ))
            ) : (
              <p className="no-results">No medical terms found matching your search.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiteracyAssistant;