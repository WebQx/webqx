import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrescriptionDosage, { Dosage, PrescriptionDosageProps } from '../components/PrescriptionDosage';

describe('PrescriptionDosage Component', () => {
  const mockDosages: Dosage[] = [
    {
      id: '1',
      amount: '10',
      unit: 'mg',
      frequency: 'once daily',
      instructions: 'Take with food'
    },
    {
      id: '2',
      amount: '25',
      unit: 'mg',
      frequency: 'twice daily'
    },
    {
      id: '3',
      amount: '50',
      unit: 'mg',
      frequency: 'once daily',
      instructions: 'Take at bedtime'
    }
  ];

  const mockOnChoose = jest.fn();

  const defaultProps: PrescriptionDosageProps = {
    dosages: mockDosages,
    onChoose: mockOnChoose
  };

  beforeEach(() => {
    mockOnChoose.mockClear();
  });

  it('renders with default title when title prop is not provided', () => {
    render(<PrescriptionDosage {...defaultProps} />);
    
    expect(screen.getByText('Available Dosage Options')).toBeInTheDocument();
  });

  it('renders with custom title when title prop is provided', () => {
    render(<PrescriptionDosage {...defaultProps} title="Select Your Dosage" />);
    
    expect(screen.getByText('Select Your Dosage')).toBeInTheDocument();
  });

  it('renders all dosage options correctly', () => {
    render(<PrescriptionDosage {...defaultProps} />);
    
    // Check that all dosages are rendered
    expect(screen.getByText('10 mg')).toBeInTheDocument();
    expect(screen.getByText('25 mg')).toBeInTheDocument();
    expect(screen.getByText('50 mg')).toBeInTheDocument();
    
    // Check frequencies
    expect(screen.getAllByText('once daily')).toHaveLength(2);
    expect(screen.getByText('twice daily')).toBeInTheDocument();
    
    // Check instructions
    expect(screen.getByText('Take with food')).toBeInTheDocument();
    expect(screen.getByText('Take at bedtime')).toBeInTheDocument();
  });

  it('renders dosage without instructions correctly', () => {
    render(<PrescriptionDosage {...defaultProps} />);
    
    // The second dosage doesn't have instructions
    const dosageItems = screen.getAllByRole('listitem');
    const secondDosage = dosageItems[1];
    
    expect(secondDosage).toHaveTextContent('25 mg');
    expect(secondDosage).toHaveTextContent('twice daily');
    expect(secondDosage).not.toHaveTextContent('Take');
  });

  it('calls onChoose with correct dosage when Choose button is clicked', async () => {
    const user = userEvent.setup();
    render(<PrescriptionDosage {...defaultProps} />);
    
    const chooseButtons = screen.getAllByText('Choose');
    await user.click(chooseButtons[0]);
    
    expect(mockOnChoose).toHaveBeenCalledTimes(1);
    expect(mockOnChoose).toHaveBeenCalledWith(mockDosages[0]);
  });

  it('calls onChoose with different dosages when different Choose buttons are clicked', async () => {
    const user = userEvent.setup();
    render(<PrescriptionDosage {...defaultProps} />);
    
    const chooseButtons = screen.getAllByText('Choose');
    
    // Click second dosage
    await user.click(chooseButtons[1]);
    expect(mockOnChoose).toHaveBeenCalledWith(mockDosages[1]);
    
    // Click third dosage
    await user.click(chooseButtons[2]);
    expect(mockOnChoose).toHaveBeenCalledWith(mockDosages[2]);
    
    expect(mockOnChoose).toHaveBeenCalledTimes(2);
  });

  it('displays fallback message when dosages array is empty', () => {
    render(<PrescriptionDosage dosages={[]} onChoose={mockOnChoose} />);
    
    expect(screen.getByText('No dosage options are currently available. Please contact your healthcare provider.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('Choose')).not.toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<PrescriptionDosage {...defaultProps} />);
    
    // Check main region
    const mainRegion = screen.getByRole('region', { name: 'Prescription dosage selection' });
    expect(mainRegion).toBeInTheDocument();
    
    // Check title
    const title = screen.getByRole('heading', { level: 3 });
    expect(title).toHaveAttribute('id', 'dosage-title');
    
    // Check list
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('aria-labelledby', 'dosage-title');
    
    // Check list items
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
  });

  it('has proper aria-labels on Choose buttons', () => {
    render(<PrescriptionDosage {...defaultProps} />);
    
    const chooseButtons = screen.getAllByRole('button', { name: /Choose/ });
    
    expect(chooseButtons[0]).toHaveAttribute('aria-label', 'Choose 10 mg once daily dosage option');
    expect(chooseButtons[1]).toHaveAttribute('aria-label', 'Choose 25 mg twice daily dosage option');
    expect(chooseButtons[2]).toHaveAttribute('aria-label', 'Choose 50 mg once daily dosage option');
  });

  it('has proper accessibility attributes for empty state', () => {
    render(<PrescriptionDosage dosages={[]} onChoose={mockOnChoose} />);
    
    const emptyStatus = screen.getByRole('status', { name: 'No dosage options available' });
    expect(emptyStatus).toBeInTheDocument();
  });

  it('applies custom className correctly', () => {
    const { container } = render(<PrescriptionDosage {...defaultProps} className="custom-class" />);
    const dosageDiv = container.querySelector('.prescription-dosage');
    
    expect(dosageDiv).toHaveClass('custom-class');
  });

  it('renders correct number of Choose buttons', () => {
    render(<PrescriptionDosage {...defaultProps} />);
    
    const chooseButtons = screen.getAllByText('Choose');
    expect(chooseButtons).toHaveLength(mockDosages.length);
  });

  it('handles single dosage option correctly', () => {
    const singleDosage: Dosage[] = [
      {
        id: '1',
        amount: '20',
        unit: 'mg',
        frequency: 'once daily'
      }
    ];
    
    render(<PrescriptionDosage dosages={singleDosage} onChoose={mockOnChoose} />);
    
    expect(screen.getByText('20 mg')).toBeInTheDocument();
    expect(screen.getByText('once daily')).toBeInTheDocument();
    expect(screen.getAllByText('Choose')).toHaveLength(1);
  });

  it('handles dosage with long instructions correctly', () => {
    const dosageWithLongInstructions: Dosage[] = [
      {
        id: '1',
        amount: '15',
        unit: 'mg',
        frequency: 'twice daily',
        instructions: 'Take with plenty of water, avoid alcohol, and do not take with dairy products within 2 hours'
      }
    ];
    
    render(<PrescriptionDosage dosages={dosageWithLongInstructions} onChoose={mockOnChoose} />);
    
    expect(screen.getByText('Take with plenty of water, avoid alcohol, and do not take with dairy products within 2 hours')).toBeInTheDocument();
  });

  it('ensures each Choose button has type="button" attribute', () => {
    render(<PrescriptionDosage {...defaultProps} />);
    
    const chooseButtons = screen.getAllByText('Choose');
    chooseButtons.forEach(button => {
      expect(button).toHaveAttribute('type', 'button');
    });
  });
});