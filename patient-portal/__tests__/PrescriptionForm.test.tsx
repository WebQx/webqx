import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrescriptionForm } from '../components/PrescriptionForm';
import { Medication } from '../components/PrescriptionForm/types';

// Mock medications data
const mockMedications: Medication[] = [
  {
    id: 'med-001',
    name: 'Lisinopril',
    dosage: '10mg',
    frequency: 'Once daily',
    prescribedBy: 'Dr. Smith',
    lastFilled: '2024-02-15',
    refillsRemaining: 3,
    canRefill: true
  },
  {
    id: 'med-002',
    name: 'Metformin',
    dosage: '500mg',
    frequency: 'Twice daily',
    prescribedBy: 'Dr. Johnson',
    lastFilled: '2024-02-10',
    refillsRemaining: 2,
    canRefill: true
  }
];

// Mock API functions to avoid async issues in tests
jest.mock('../components/PrescriptionForm/utils', () => ({
  ...jest.requireActual('../components/PrescriptionForm/utils'),
  fetchMedications: jest.fn(() => Promise.resolve(mockMedications)),
  submitPrescriptionRefill: jest.fn(() => Promise.resolve({ success: true, confirmationNumber: 'RX123' })),
  withRetry: jest.fn((fn) => fn())
}));

describe('PrescriptionForm Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnError = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders trigger button when not initially visible', () => {
    render(
      <PrescriptionForm
        medications={mockMedications}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        onCancel={mockOnCancel}
      />
    );

    const triggerButton = screen.getByRole('button', { name: /Request prescription refill/ });
    expect(triggerButton).toBeInTheDocument();
    expect(triggerButton).toHaveTextContent('💊 Refill Prescription');
  });

  it('shows form dialog when trigger button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <PrescriptionForm
        medications={mockMedications}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        onCancel={mockOnCancel}
      />
    );

    const triggerButton = screen.getByRole('button', { name: /Request prescription refill/ });
    await user.click(triggerButton);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Prescription Refill Request')).toBeInTheDocument();
  });

  it('displays form when initially visible', () => {
    render(
      <PrescriptionForm
        medications={mockMedications}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        onCancel={mockOnCancel}
        initiallyVisible={true}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Prescription Refill Request')).toBeInTheDocument();
  });

  it('shows medication selection step initially', () => {
    render(
      <PrescriptionForm
        medications={mockMedications}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        onCancel={mockOnCancel}
        initiallyVisible={true}
      />
    );

    expect(screen.getByText('Select Medication to Refill')).toBeInTheDocument();
    expect(screen.getByText('Lisinopril')).toBeInTheDocument();
    expect(screen.getByText('Metformin')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <PrescriptionForm
        medications={mockMedications}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        onCancel={mockOnCancel}
        initiallyVisible={true}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'prescription-form-title');

    const title = screen.getByText('Prescription Refill Request');
    expect(title).toHaveAttribute('id', 'prescription-form-title');
  });

  it('applies custom className correctly', () => {
    const { container } = render(
      <PrescriptionForm
        medications={mockMedications}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        onCancel={mockOnCancel}
        className="custom-prescription-form"
      />
    );

    const triggerButton = container.querySelector('.prescription-form-trigger');
    expect(triggerButton).toHaveClass('custom-prescription-form');
  });

  it('shows progress indicator with correct steps', () => {
    render(
      <PrescriptionForm
        medications={mockMedications}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        onCancel={mockOnCancel}
        initiallyVisible={true}
      />
    );

    const progressBar = screen.getByRole('progressbar', { name: /Form progress/ });
    expect(progressBar).toBeInTheDocument();

    expect(screen.getByText('Medication')).toBeInTheDocument();
    expect(screen.getByText('Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });
});