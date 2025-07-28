import React from 'react';

/**
 * Template interface for specialty prescription templates
 */
export interface RxTemplate {
  /** Unique identifier for the template */
  id: string;
  /** Display name of the template */
  name: string;
  /** Description of the template */
  description?: string;
  /** The specialty this template is for */
  specialty: string;
}

/**
 * SmartRxTemplatePicker component displays a list of specialty prescription templates
 * Allows users to select from available templates with proper accessibility support
 */
interface SmartRxTemplatePickerProps {
  /** Array of template objects to display */
  templates?: RxTemplate[];
  /** Callback function called when a template is selected */
  onSelect?: (template: RxTemplate) => void;
  /** CSS class name for styling */
  className?: string;
  /** Title for the template picker section */
  title?: string;
}

export const SmartRxTemplatePicker: React.FC<SmartRxTemplatePickerProps> = ({
  templates = [
    {
      id: 'cardiology-1',
      name: 'Hypertension Management',
      description: 'Standard antihypertensive medication template',
      specialty: 'Cardiology'
    },
    {
      id: 'endocrinology-1', 
      name: 'Diabetes Type 2',
      description: 'Glucose management and insulin protocols',
      specialty: 'Endocrinology'
    },
    {
      id: 'orthopedics-1',
      name: 'Post-Surgical Recovery',
      description: 'Pain management and recovery medications',
      specialty: 'Orthopedics'
    },
    {
      id: 'dermatology-1',
      name: 'Chronic Skin Conditions',
      description: 'Topical treatments and systemic therapies',
      specialty: 'Dermatology'
    }
  ],
  onSelect,
  className = "",
  title = "Select Prescription Template"
}) => {
  const handleTemplateSelect = (template: RxTemplate) => {
    if (onSelect) {
      onSelect(template);
    }
  };

  return (
    <div 
      className={`smart-rx-template-picker ${className}`}
      role="region"
      aria-label="Prescription template picker"
    >
      <h3 className="template-picker-title">{title}</h3>
      <div 
        className="template-picker-grid"
        role="list"
        aria-label={`${templates.length} available prescription templates`}
      >
        {templates.map((template) => (
          <button
            key={template.id}
            className="template-picker-button"
            onClick={() => handleTemplateSelect(template)}
            role="listitem"
            aria-label={`Select ${template.name} template for ${template.specialty}`}
            {...(template.description && { 'aria-describedby': `template-desc-${template.id}` })}
          >
            <div className="template-button-content">
              <div className="template-name">{template.name}</div>
              <div className="template-specialty">{template.specialty}</div>
              {template.description && (
                <div 
                  id={`template-desc-${template.id}`}
                  className="template-description"
                >
                  {template.description}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      {templates.length === 0 && (
        <p className="no-templates" role="status">
          No prescription templates available.
        </p>
      )}
    </div>
  );
};

export default SmartRxTemplatePicker;