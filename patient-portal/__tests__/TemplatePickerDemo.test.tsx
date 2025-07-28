import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplatePickerDemo from '../pages/TemplatePickerDemo';

describe('TemplatePickerDemo Page', () => {
  it('renders demo page correctly', () => {
    render(<TemplatePickerDemo />);
    
    expect(screen.getByText('SmartRx Template Picker Demo')).toBeInTheDocument();
    expect(screen.getByText('Interactive demonstration of the template picker component')).toBeInTheDocument();
    expect(screen.getByText('Default Templates')).toBeInTheDocument();
    expect(screen.getByText('Custom Templates')).toBeInTheDocument();
  });

  it('displays default templates section', () => {
    render(<TemplatePickerDemo />);
    
    expect(screen.getByText('Choose from Default Templates')).toBeInTheDocument();
    expect(screen.getAllByText('Hypertension Management')).toHaveLength(2); // One in each section
    expect(screen.getByText('Diabetes Type 2')).toBeInTheDocument();
  });

  it('displays custom templates section', () => {
    render(<TemplatePickerDemo />);
    
    expect(screen.getByText('Choose from Custom Templates')).toBeInTheDocument();
    expect(screen.getByText('Pain Management Protocol')).toBeInTheDocument();
    expect(screen.getAllByText('Hypertension Management')).toHaveLength(2); // One in each section
    expect(screen.getByText('Diabetes Care Package')).toBeInTheDocument();
  });

  it('shows selected template when a template is clicked', async () => {
    const user = userEvent.setup();
    
    render(<TemplatePickerDemo />);
    
    // Click on a template from the custom templates section
    const painManagementButton = screen.getByRole('listitem', { 
      name: /Select Pain Management Protocol template for Pain Medicine/ 
    });
    
    await user.click(painManagementButton);
    
    // Check that the selected template section appears
    expect(screen.getByText('Selected Template')).toBeInTheDocument();
    
    // Find the selected template section and check its contents
    const selectedSection = document.querySelector('.selected-template-section');
    expect(selectedSection).toBeInTheDocument();
    expect(selectedSection).toHaveTextContent('Pain Management Protocol');
    expect(selectedSection).toHaveTextContent('Pain Medicine');
    expect(selectedSection).toHaveTextContent('demo-1');
  });

  it('updates selected template when different template is clicked', async () => {
    const user = userEvent.setup();
    
    render(<TemplatePickerDemo />);
    
    // First click on Pain Management
    const painManagementButton = screen.getByRole('listitem', { 
      name: /Select Pain Management Protocol template for Pain Medicine/ 
    });
    await user.click(painManagementButton);
    
    // Check first selection
    let selectedSection = document.querySelector('.selected-template-section');
    expect(selectedSection).toHaveTextContent('Pain Medicine');
    
    // Then click on Diabetes Care Package
    const diabetesButton = screen.getByRole('listitem', { 
      name: /Select Diabetes Care Package template for Endocrinology/ 
    });
    await user.click(diabetesButton);
    
    // Should now show Diabetes template
    selectedSection = document.querySelector('.selected-template-section');
    expect(selectedSection).toHaveTextContent('Endocrinology');
    expect(selectedSection).toHaveTextContent('demo-3');
  });

  it('has proper accessibility structure', () => {
    const { container } = render(<TemplatePickerDemo />);
    
    // Check main content structure by class since div doesn't have role="main"
    const mainElement = container.querySelector('.portal');
    expect(mainElement).toBeInTheDocument();
    
    // Check template picker regions
    const templatePickerRegions = screen.getAllByRole('region', { 
      name: 'Prescription template picker' 
    });
    expect(templatePickerRegions).toHaveLength(2); // Default and custom sections
  });
});