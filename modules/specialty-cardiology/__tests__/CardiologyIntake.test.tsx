/**
 * Test suite for CardiologyIntake component
 * 
 * Tests all functionality including error handling, loading states,
 * accessibility, and user interactions.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { CardiologyIntake } from '../components/CardiologyIntake';
import { IntakeFormStatus } from '../../../ehr-integrations/types';

// Mock the EHR hooks
jest.mock('../../../ehr-integrations/hooks', () => ({
  useIntakeForm: () => ({
    data: null,
    loading: { isLoading: false },
    error: null,
    errorMessage: '',
    success: false,
    submitForm: jest.fn(),
    saveDraft: jest.fn(),
    clearError: jest.fn()
  })
}));

// Mock the EHR utils
jest.mock('../../../ehr-integrations/utils', () => ({
  generateEHRId: jest.fn(() => 'test-id-123'),
  formatEHRDate: jest.fn(() => '01/01/2024 12:00 PM')
}));

describe('CardiologyIntake Component', () => {
  const defaultProps = {
    patientId: 'patient-123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Accessibility', () => {
    test('renders with proper accessibility attributes', () => {
      render(<CardiologyIntake {...defaultProps} />);

      // Check main heading
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByText('💗 Cardiology Intake Form')).toBeInTheDocument();

      // Check progress indicator
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');

      // Check form navigation
      expect(screen.getByRole('navigation', { name: 'Form navigation' })).toBeInTheDocument();
    });

    test('renders form fields with proper labels and ARIA attributes', () => {
      render(<CardiologyIntake {...defaultProps} />);

      // Check chief complaint field
      const chiefComplaintField = screen.getByLabelText(/main concern today/i);
      expect(chiefComplaintField).toBeInTheDocument();
      expect(chiefComplaintField).toHaveAttribute('aria-required', 'true');
      expect(chiefComplaintField).toHaveAttribute('aria-describedby');

      // Check history field
      const historyField = screen.getByLabelText(/history of present illness/i);
      expect(historyField).toBeInTheDocument();
      expect(historyField).toHaveAttribute('aria-required', 'true');
    });

    test('displays progress indicator when showProgress is true', () => {
      render(<CardiologyIntake {...defaultProps} showProgress={true} />);
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/Section 1 of 6/)).toBeInTheDocument();
    });

    test('hides progress indicator when showProgress is false', () => {
      render(<CardiologyIntake {...defaultProps} showProgress={false} />);
      
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    test('allows user to fill in chief complaint', async () => {
      const user = userEvent.setup();
      render(<CardiologyIntake {...defaultProps} />);

      const chiefComplaintField = screen.getByLabelText(/main concern today/i);
      await user.type(chiefComplaintField, 'Chest pain');

      expect(chiefComplaintField).toHaveValue('Chest pain');
    });

    test('allows user to fill in history of present illness', async () => {
      const user = userEvent.setup();
      render(<CardiologyIntake {...defaultProps} />);

      const historyField = screen.getByLabelText(/history of present illness/i);
      await user.type(historyField, 'Pain started 3 days ago');

      expect(historyField).toHaveValue('Pain started 3 days ago');
    });

    test('navigation buttons work correctly', async () => {
      const user = userEvent.setup();
      render(<CardiologyIntake {...defaultProps} />);

      // Check initial state - Previous should be disabled
      const previousButton = screen.getByLabelText('Go to previous section');
      const nextButton = screen.getByLabelText('Go to next section');

      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeEnabled();

      // Click next to go to section 2
      await user.click(nextButton);

      // Now previous should be enabled
      expect(previousButton).toBeEnabled();
    });
  });

  describe('Error Handling', () => {
    test('displays validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      render(<CardiologyIntake {...defaultProps} />);

      // Navigate to the last section without filling required fields
      const nextButton = screen.getByLabelText('Go to next section');
      
      // Navigate through all sections to reach submit
      for (let i = 0; i < 5; i++) {
        await user.click(nextButton);
      }

      // Try to submit without filling required fields
      const submitButton = screen.getByLabelText('Submit completed intake form');
      await user.click(submitButton);

      // Check for error display - validation errors should appear
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/please correct the following errors/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    test('shows appropriate loading state during form submission', () => {
      // Create a separate render for loading state test
      const LoadingComponent = () => {
        // Mock the hook to return loading state inline
        const mockHook = {
          data: null,
          loading: { isLoading: true, message: 'Submitting form...' },
          error: null,
          errorMessage: '',
          success: false,
          submitForm: jest.fn(),
          saveDraft: jest.fn(),
          clearError: jest.fn()
        };

        // Override the mock for this test
        require('../../../ehr-integrations/hooks').useIntakeForm = () => mockHook;
        
        return <CardiologyIntake {...defaultProps} />;
      };

      render(<LoadingComponent />);

      expect(screen.getByText('Submitting form...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Read-only Mode', () => {
    test('disables all form inputs when readOnly is true', () => {
      render(<CardiologyIntake {...defaultProps} readOnly={true} />);

      const chiefComplaintField = screen.getByLabelText(/main concern today/i);
      const historyField = screen.getByLabelText(/history of present illness/i);

      expect(chiefComplaintField).toBeDisabled();
      expect(historyField).toBeDisabled();
    });
  });

  describe('Success States', () => {
    test('displays success message when form is submitted successfully', () => {
      // Create component with success state
      const SuccessComponent = () => {
        const mockHook = {
          data: {
            id: 'form-123',
            patientId: 'patient-123',
            specialty: 'cardiology',
            status: IntakeFormStatus.SUBMITTED,
            data: {},
            submittedAt: new Date()
          },
          loading: { isLoading: false },
          error: null,
          errorMessage: '',
          success: true,
          submitForm: jest.fn(),
          saveDraft: jest.fn(),
          clearError: jest.fn()
        };

        require('../../../ehr-integrations/hooks').useIntakeForm = () => mockHook;
        
        return <CardiologyIntake {...defaultProps} />;
      };

      render(<SuccessComponent />);

      expect(screen.getByText('✅ Form Submitted Successfully!')).toBeInTheDocument();
      expect(screen.getByText(/Reference ID: form-123/)).toBeInTheDocument();
    });
  });

  describe('Initial Data', () => {
    test('populates form with initial data when provided', () => {
      const initialData = {
        chiefComplaint: 'Initial complaint',
        historyOfPresentIllness: 'Initial history'
      };

      render(<CardiologyIntake {...defaultProps} initialData={initialData} />);

      const chiefComplaintField = screen.getByLabelText(/main concern today/i);
      const historyField = screen.getByLabelText(/history of present illness/i);

      expect(chiefComplaintField).toHaveValue('Initial complaint');
      expect(historyField).toHaveValue('Initial history');
    });
  });
});