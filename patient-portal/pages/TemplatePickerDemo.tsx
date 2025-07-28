import React, { useState } from 'react';
import SmartRxTemplatePicker, { RxTemplate } from '../components/SmartRxTemplatePicker';

/**
 * Demo page to showcase the SmartRxTemplatePicker component
 */
const TemplatePickerDemo: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<RxTemplate | null>(null);

  const customTemplates: RxTemplate[] = [
    {
      id: 'demo-1',
      name: 'Pain Management Protocol',
      description: 'Comprehensive pain management including NSAIDs and opioid alternatives',
      specialty: 'Pain Medicine'
    },
    {
      id: 'demo-2', 
      name: 'Hypertension Management',
      description: 'ACE inhibitors, ARBs, and lifestyle modification recommendations',
      specialty: 'Cardiology'
    },
    {
      id: 'demo-3',
      name: 'Diabetes Care Package',
      description: 'Metformin, insulin protocols, and glucose monitoring guidance',
      specialty: 'Endocrinology'
    }
  ];

  const handleTemplateSelection = (template: RxTemplate) => {
    setSelectedTemplate(template);
  };

  return (
    <div className="portal">
      <header className="portal-header">
        <h1 className="portal-title">SmartRx Template Picker Demo</h1>
        <p className="portal-tagline">Interactive demonstration of the template picker component</p>
      </header>

      <div className="portal-content">
        <section className="template-demo-section">
          <h2>Default Templates</h2>
          <SmartRxTemplatePicker 
            onSelect={handleTemplateSelection}
            title="Choose from Default Templates"
          />
        </section>

        <section className="template-demo-section">
          <h2>Custom Templates</h2>
          <SmartRxTemplatePicker 
            templates={customTemplates}
            onSelect={handleTemplateSelection}
            title="Choose from Custom Templates"
          />
        </section>

        {selectedTemplate && (
          <section className="selected-template-section">
            <h2>Selected Template</h2>
            <div className="selected-template-card">
              <h3>{selectedTemplate.name}</h3>
              <p><strong>Specialty:</strong> {selectedTemplate.specialty}</p>
              {selectedTemplate.description && (
                <p><strong>Description:</strong> {selectedTemplate.description}</p>
              )}
              <p><strong>Template ID:</strong> {selectedTemplate.id}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default TemplatePickerDemo;