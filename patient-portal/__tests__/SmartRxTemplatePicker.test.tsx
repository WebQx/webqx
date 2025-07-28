import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SmartRxTemplatePicker, { RxTemplate } from '../components/SmartRxTemplatePicker';

describe('SmartRxTemplatePicker Component', () => {
  const mockTemplates: RxTemplate[] = [
    {
      id: 'test-1',
      name: 'Test Template 1',
      description: 'First test template',
      specialty: 'Cardiology'
    },
    {
      id: 'test-2', 
      name: 'Test Template 2',
      description: 'Second test template',
      specialty: 'Endocrinology'
    }
  ];

  const mockOnSelect = jest.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  it('renders correctly with provided templates', () => {
    render(
      <SmartRxTemplatePicker 
        templates={mockTemplates}
        onSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText('Select Prescription Template')).toBeInTheDocument();
    expect(screen.getByText('Test Template 1')).toBeInTheDocument();
    expect(screen.getByText('Test Template 2')).toBeInTheDocument();
    expect(screen.getByText('Cardiology')).toBeInTheDocument();
    expect(screen.getByText('Endocrinology')).toBeInTheDocument();
    expect(screen.getByText('First test template')).toBeInTheDocument();
    expect(screen.getByText('Second test template')).toBeInTheDocument();
  });

  it('renders with default templates when no templates prop is provided', () => {
    render(<SmartRxTemplatePicker onSelect={mockOnSelect} />);
    
    expect(screen.getByText('Hypertension Management')).toBeInTheDocument();
    expect(screen.getByText('Diabetes Type 2')).toBeInTheDocument();
    expect(screen.getByText('Post-Surgical Recovery')).toBeInTheDocument();
    expect(screen.getByText('Chronic Skin Conditions')).toBeInTheDocument();
  });

  it('calls onSelect callback when template button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <SmartRxTemplatePicker 
        templates={mockTemplates}
        onSelect={mockOnSelect}
      />
    );
    
    const firstTemplateButton = screen.getByRole('listitem', { 
      name: /Select Test Template 1 template for Cardiology/ 
    });
    
    await user.click(firstTemplateButton);
    
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('handles missing onSelect callback gracefully', async () => {
    const user = userEvent.setup();
    
    render(<SmartRxTemplatePicker templates={mockTemplates} />);
    
    const firstTemplateButton = screen.getByRole('listitem', { 
      name: /Select Test Template 1 template for Cardiology/ 
    });
    
    // Should not throw error
    await user.click(firstTemplateButton);
  });

  it('has proper accessibility attributes', () => {
    render(
      <SmartRxTemplatePicker 
        templates={mockTemplates}
        onSelect={mockOnSelect}
      />
    );
    
    const picker = screen.getByRole('region', { name: 'Prescription template picker' });
    expect(picker).toBeInTheDocument();
    
    const templateGrid = screen.getByRole('list', { 
      name: '2 available prescription templates' 
    });
    expect(templateGrid).toBeInTheDocument();
    
    const buttons = screen.getAllByRole('listitem');
    expect(buttons).toHaveLength(2);
    
    const firstButton = screen.getByRole('listitem', { 
      name: /Select Test Template 1 template for Cardiology/ 
    });
    expect(firstButton).toHaveAttribute('aria-describedby', 'template-desc-test-1');
  });

  it('applies custom className correctly', () => {
    const { container } = render(
      <SmartRxTemplatePicker 
        templates={mockTemplates}
        className="custom-class"
      />
    );
    
    const picker = container.querySelector('.smart-rx-template-picker');
    expect(picker).toHaveClass('custom-class');
  });

  it('displays custom title when provided', () => {
    render(
      <SmartRxTemplatePicker 
        templates={mockTemplates}
        title="Custom Template Title"
      />
    );
    
    expect(screen.getByText('Custom Template Title')).toBeInTheDocument();
  });

  it('shows no templates message when empty template array is provided', () => {
    render(
      <SmartRxTemplatePicker 
        templates={[]}
        onSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByRole('status')).toHaveTextContent('No prescription templates available.');
  });

  it('handles templates without descriptions', () => {
    const templatesWithoutDesc: RxTemplate[] = [
      {
        id: 'no-desc-1',
        name: 'No Description Template',
        specialty: 'Neurology'
      }
    ];
    
    render(
      <SmartRxTemplatePicker 
        templates={templatesWithoutDesc}
        onSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText('No Description Template')).toBeInTheDocument();
    expect(screen.getByText('Neurology')).toBeInTheDocument();
    
    const button = screen.getByRole('listitem', { 
      name: /Select No Description Template template for Neurology/ 
    });
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('handles keyboard navigation properly', async () => {
    const user = userEvent.setup();
    
    render(
      <SmartRxTemplatePicker 
        templates={mockTemplates}
        onSelect={mockOnSelect}
      />
    );
    
    const firstButton = screen.getByRole('listitem', { 
      name: /Select Test Template 1 template for Cardiology/ 
    });
    
    // Focus the button
    firstButton.focus();
    expect(firstButton).toHaveFocus();
    
    // Activate with keyboard
    await user.keyboard('{Enter}');
    expect(mockOnSelect).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('supports space key activation', async () => {
    const user = userEvent.setup();
    
    render(
      <SmartRxTemplatePicker 
        templates={mockTemplates}
        onSelect={mockOnSelect}
      />
    );
    
    const firstButton = screen.getByRole('listitem', { 
      name: /Select Test Template 1 template for Cardiology/ 
    });
    
    firstButton.focus();
    await user.keyboard(' ');
    expect(mockOnSelect).toHaveBeenCalledWith(mockTemplates[0]);
  });
});