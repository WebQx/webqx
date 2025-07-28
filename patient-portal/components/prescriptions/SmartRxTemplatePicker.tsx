/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React, { useEffect, useState } from 'react';
import { usePrescriptions, RxTemplate } from './PrescriptionsContext';

interface SmartRxTemplatePickerProps {
  className?: string;
  onTemplateSelect?: (template: RxTemplate | null) => void;
}

/**
 * SmartRxTemplatePicker component for selecting prescription templates
 * 
 * This component provides an intelligent interface for healthcare providers
 * to quickly select and customize prescription templates, improving efficiency
 * and reducing errors in prescription creation.
 */
const SmartRxTemplatePicker: React.FC<SmartRxTemplatePickerProps> = ({
  className = '',
  onTemplateSelect
}) => {
  const { state, loadTemplates, selectTemplate } = usePrescriptions();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
  }, []); // Empty dependency array to run only on mount

  // Filter templates based on search and category
  const filteredTemplates = state.templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.medication.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const uniqueCategories = new Set(state.templates.map(t => t.category));
  const categories = ['all', ...Array.from(uniqueCategories)];

  const handleTemplateSelect = (template: RxTemplate) => {
    selectTemplate(template);
    onTemplateSelect?.(template);
    setIsExpanded(false);
  };

  const handleClearSelection = () => {
    selectTemplate(null);
    onTemplateSelect?.(null);
    setSearchTerm('');
    setSelectedCategory('all');
  };

  const handleKeyDown = (event: React.KeyboardEvent, template?: RxTemplate) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (template) {
        handleTemplateSelect(template);
      } else if (event.currentTarget.getAttribute('data-action') === 'clear') {
        handleClearSelection();
      }
    }
  };

  if (state.isLoading) {
    return (
      <div 
        className={`smart-rx-picker loading ${className}`}
        role="status"
        aria-live="polite"
        aria-label="Loading prescription templates"
      >
        <div className="loading-indicator">
          <div className="loading-spinner" aria-hidden="true">⏳</div>
          <span>Loading prescription templates...</span>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div 
        className={`smart-rx-picker error ${className}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="error-message">
          <span role="img" aria-label="Error">❌</span>
          <span>Error loading templates: {state.error}</span>
          <button 
            onClick={loadTemplates}
            className="retry-button"
            aria-label="Retry loading templates"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`smart-rx-picker ${className}`}
      role="region"
      aria-labelledby="template-picker-heading"
    >
      <div className="template-picker-header">
        <h3 id="template-picker-heading" className="picker-title">
          📋 Smart Prescription Templates
        </h3>
        <button
          className="expand-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="template-picker-content"
          aria-label={isExpanded ? 'Collapse template picker' : 'Expand template picker'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {state.selectedTemplate && (
        <div className="selected-template" role="status" aria-live="polite">
          <span className="selected-label">Selected:</span>
          <span className="selected-name">{state.selectedTemplate.name}</span>
          <button
            className="clear-selection"
            onClick={handleClearSelection}
            onKeyDown={(e) => handleKeyDown(e)}
            data-action="clear"
            aria-label="Clear selected template"
          >
            ✖
          </button>
        </div>
      )}

      <div 
        id="template-picker-content"
        className={`template-picker-content ${isExpanded ? 'expanded' : 'collapsed'}`}
        aria-hidden={!isExpanded}
      >
        {/* Search and Filter Controls */}
        <div className="picker-controls" role="group" aria-label="Template search and filter controls">
          <div className="search-container">
            <label htmlFor="template-search" className="search-label">
              Search templates:
            </label>
            <input
              id="template-search"
              type="text"
              placeholder="Search by medication or template name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              aria-describedby="search-help"
            />
            <div id="search-help" className="sr-only">
              Type to search through available prescription templates
            </div>
          </div>

          <div className="category-filter">
            <label htmlFor="category-select" className="category-label">
              Category:
            </label>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="category-select"
              aria-describedby="category-help"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
            <div id="category-help" className="sr-only">
              Filter templates by medical category
            </div>
          </div>
        </div>

        {/* Templates List */}
        <div 
          className="templates-list"
          role="list"
          aria-label="Available prescription templates"
        >
          {filteredTemplates.length === 0 ? (
            <div className="no-templates" role="status">
              <span>No templates found matching your criteria.</span>
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <div
                key={template.id}
                className={`template-item ${state.selectedTemplate?.id === template.id ? 'selected' : ''}`}
                role="listitem"
                tabIndex={0}
                onClick={() => handleTemplateSelect(template)}
                onKeyDown={(e) => handleKeyDown(e, template)}
                aria-label={`Select template: ${template.name}`}
                aria-describedby={`template-desc-${template.id}`}
              >
                <div className="template-header">
                  <h4 className="template-name">{template.name}</h4>
                  <span className="template-category">{template.category}</span>
                </div>
                <div className="template-details">
                  <p className="template-medication">
                    <strong>Medication:</strong> {template.medication}
                  </p>
                  <div className="template-options">
                    <div className="dosage-options">
                      <strong>Common dosages:</strong> {template.commonDosages.join(', ')}
                    </div>
                    <div className="frequency-options">
                      <strong>Frequencies:</strong> {template.commonFrequencies.join(', ')}
                    </div>
                  </div>
                  {template.description && (
                    <p 
                      id={`template-desc-${template.id}`}
                      className="template-description"
                    >
                      {template.description}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Usage Tips */}
        <div className="picker-help" role="region" aria-labelledby="picker-help-heading">
          <h4 id="picker-help-heading" className="help-heading">💡 Tips:</h4>
          <ul className="help-list">
            <li>Use search to quickly find specific medications</li>
            <li>Filter by category to browse related treatments</li>
            <li>Selected templates will pre-fill the prescription form</li>
            <li>You can modify any pre-filled values as needed</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SmartRxTemplatePicker;