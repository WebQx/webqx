import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PrescriptionForm from '../../components/prescriptions/PrescriptionForm';
import { PrescriptionsProvider } from '../../components/prescriptions/PrescriptionsContext';

describe('PrescriptionForm', () => {
  const user = userEvent.setup();

  describe('Form Rendering', () => {
    test('renders form with all required fields', () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      expect(screen.getByRole('region', { name: /Prescription Form/ })).toBeInTheDocument();
      expect(screen.getByLabelText(/Medication Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Dosage/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Frequency/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Duration/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Prescriber/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Refills Remaining/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Special Instructions/)).toBeInTheDocument();
    });

    test('has proper form structure and accessibility', () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('noValidate');
      expect(form).toHaveAttribute('aria-describedby', 'form-instructions');

      const formInstructions = screen.getByText(/Fill out all required fields/);
      expect(formInstructions).toHaveAttribute('id', 'form-instructions');
      expect(formInstructions).toHaveClass('sr-only');
    });

    test('applies custom className', () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm className="custom-form-class" />
        </PrescriptionsProvider>
      );

      const formContainer = screen.getByRole('region');
      expect(formContainer).toHaveClass('prescription-form');
      expect(formContainer).toHaveClass('custom-form-class');
    });
  });

  describe('Required Field Validation', () => {
    test('all required fields have proper ARIA attributes', () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const requiredFields = [
        'Medication Name *',
        'Dosage *',
        'Frequency *',
        'Duration *',
        'Prescriber *'
      ];

      requiredFields.forEach(fieldLabel => {
        const field = screen.getByLabelText(fieldLabel);
        expect(field).toHaveAttribute('aria-required', 'true');
      });
    });

    test('shows validation errors for empty required fields', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const submitButton = screen.getByRole('button', { name: /Submit Prescription/ });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Medication name is required')).toBeInTheDocument();
        expect(screen.getByText('Dosage is required')).toBeInTheDocument();
        expect(screen.getByText('Frequency is required')).toBeInTheDocument();
        expect(screen.getByText('Duration is required')).toBeInTheDocument();
        expect(screen.getByText('Prescriber is required')).toBeInTheDocument();
      });
    });

    test('validation errors have proper ARIA attributes', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const submitButton = screen.getByRole('button', { name: /Submit Prescription/ });
      await user.click(submitButton);

      await waitFor(() => {
        const medicationField = screen.getByLabelText(/Medication Name/);
        expect(medicationField).toHaveAttribute('aria-invalid', 'true');
        
        const errorMessage = screen.getByText('Medication name is required');
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });

    test('clears validation errors when field values are provided', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      // First trigger validation errors
      const submitButton = screen.getByRole('button', { name: /Submit Prescription/ });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Medication name is required')).toBeInTheDocument();
      });

      // Then fill in the medication field
      const medicationField = screen.getByLabelText(/Medication Name/);
      await user.type(medicationField, 'Aspirin');

      await waitFor(() => {
        expect(screen.queryByText('Medication name is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Input Functionality', () => {
    test('text inputs accept and display user input', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const medicationField = screen.getByLabelText(/Medication Name/);
      const dosageField = screen.getByLabelText(/Dosage/);
      const durationField = screen.getByLabelText(/Duration/);

      await user.type(medicationField, 'Lisinopril');
      await user.type(dosageField, '10mg');
      await user.type(durationField, '30 days');

      expect(medicationField).toHaveValue('Lisinopril');
      expect(dosageField).toHaveValue('10mg');
      expect(durationField).toHaveValue('30 days');
    });

    test('frequency dropdown works correctly', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const frequencySelect = screen.getByLabelText(/Frequency/);
      await user.selectOptions(frequencySelect, 'Once daily');

      expect(frequencySelect).toHaveValue('Once daily');
    });

    test('refills number input accepts valid values', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const refillsField = screen.getByLabelText(/Refills Remaining/);
      await user.clear(refillsField);
      await user.type(refillsField, '3');

      expect(refillsField).toHaveValue(3);
    });

    test('textarea accepts multi-line input', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const instructionsField = screen.getByLabelText(/Special Instructions/);
      const instructions = 'Take with food\nAvoid alcohol';
      
      await user.type(instructionsField, instructions);
      expect(instructionsField).toHaveValue(instructions);
    });
  });

  describe('Form Submission', () => {
    const fillValidForm = async () => {
      await user.type(screen.getByLabelText(/Medication Name/), 'Lisinopril');
      await user.type(screen.getByLabelText(/Dosage/), '10mg');
      await user.selectOptions(screen.getByLabelText(/Frequency/), 'Once daily');
      await user.type(screen.getByLabelText(/Duration/), '30 days');
      // Prescriber is pre-filled
      await user.type(screen.getByLabelText(/Special Instructions/), 'Take with food');
    };

    test('submits form with valid data', async () => {
      const mockOnSubmit = jest.fn();
      render(
        <PrescriptionsProvider>
          <PrescriptionForm onSubmit={mockOnSubmit} />
        </PrescriptionsProvider>
      );

      await fillValidForm();

      const submitButton = screen.getByRole('button', { name: /Submit Prescription/ });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            medication: 'Lisinopril',
            dosage: '10mg',
            frequency: 'Once daily',
            duration: '30 days',
            prescriber: 'Dr. Smith, MD',
            instructions: 'Take with food',
            refillsRemaining: 0
          })
        );
      });
    });

    test('shows loading state during submission', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      await fillValidForm();

      const submitButton = screen.getByRole('button', { name: /Submit Prescription/ });
      await user.click(submitButton);

      expect(screen.getByText('Submitting...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    test('prevents submission with invalid data', async () => {
      const mockOnSubmit = jest.fn();
      render(
        <PrescriptionsProvider>
          <PrescriptionForm onSubmit={mockOnSubmit} />
        </PrescriptionsProvider>
      );

      // Leave required fields empty
      const submitButton = screen.getByRole('button', { name: /Submit Prescription/ });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    test('resets form after successful submission', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      await fillValidForm();

      const submitButton = screen.getByRole('button', { name: /Submit Prescription/ });
      await user.click(submitButton);

      // Wait for submission to complete and form to reset
      await waitFor(() => {
        expect(screen.getByLabelText(/Medication Name/)).toHaveValue('');
        expect(screen.getByLabelText(/Dosage/)).toHaveValue('');
        expect(screen.getByLabelText(/Special Instructions/)).toHaveValue('');
      });
    });
  });

  describe('Cancel Functionality', () => {
    test('cancel button clears form', async () => {
      const mockOnCancel = jest.fn();
      render(
        <PrescriptionsProvider>
          <PrescriptionForm onCancel={mockOnCancel} />
        </PrescriptionsProvider>
      );

      // Fill in some data
      await user.type(screen.getByLabelText(/Medication Name/), 'Test Med');
      await user.type(screen.getByLabelText(/Dosage/), '5mg');

      const cancelButton = screen.getByRole('button', { name: /Cancel and clear form/ });
      await user.click(cancelButton);

      expect(screen.getByLabelText(/Medication Name/)).toHaveValue('');
      expect(screen.getByLabelText(/Dosage/)).toHaveValue('');
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    test('cancel button is disabled during submission', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      await user.type(screen.getByLabelText(/Medication Name/), 'Lisinopril');
      await user.type(screen.getByLabelText(/Dosage/), '10mg');
      await user.selectOptions(screen.getByLabelText(/Frequency/), 'Once daily');
      await user.type(screen.getByLabelText(/Duration/), '30 days');

      const submitButton = screen.getByRole('button', { name: /Submit Prescription/ });
      await user.click(submitButton);

      const cancelButton = screen.getByRole('button', { name: /Cancel and clear form/ });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Refills Validation', () => {
    test('validates refills are within allowed range', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const refillsField = screen.getByLabelText(/Refills Remaining/);
      
      // Test invalid high value
      await user.clear(refillsField);
      await user.type(refillsField, '15');

      const submitButton = screen.getByRole('button', { name: /Submit Prescription/ });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Refills must be between 0 and 11')).toBeInTheDocument();
      });

      // Test valid value
      await user.clear(refillsField);
      await user.type(refillsField, '5');

      await waitFor(() => {
        expect(screen.queryByText('Refills must be between 0 and 11')).not.toBeInTheDocument();
      });
    });
  });

  describe('Template Integration', () => {
    test('displays template indicator when template is selected', () => {
      // Mock the context to simulate a selected template
      const mockContextValue = {
        state: {
          selectedTemplate: {
            id: '1',
            name: 'Lisinopril Template',
            medication: 'Lisinopril',
            commonDosages: ['10mg'],
            commonFrequencies: ['Once daily'],
            category: 'Cardiovascular'
          },
          formData: { medication: 'Lisinopril' },
          isLoading: false,
          error: null,
          prescriptions: [],
          templates: []
        },
        updateFormData: jest.fn(),
        clearFormData: jest.fn(),
        submitPrescription: jest.fn()
      };

      jest.spyOn(React, 'useContext').mockReturnValue(mockContextValue);

      render(<PrescriptionForm />);

      expect(screen.getByText('Using template:')).toBeInTheDocument();
      expect(screen.getByText('Lisinopril Template')).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    test('displays context error messages', () => {
      const mockContextValue = {
        state: {
          error: 'Submission failed',
          isLoading: false,
          selectedTemplate: null,
          formData: {},
          prescriptions: [],
          templates: []
        },
        updateFormData: jest.fn(),
        clearFormData: jest.fn(),
        submitPrescription: jest.fn()
      };

      jest.spyOn(React, 'useContext').mockReturnValue(mockContextValue);

      render(<PrescriptionForm />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Submission failed')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    test('displays loading indicator when context is loading', () => {
      const mockContextValue = {
        state: {
          isLoading: true,
          error: null,
          selectedTemplate: null,
          formData: {},
          prescriptions: [],
          templates: []
        },
        updateFormData: jest.fn(),
        clearFormData: jest.fn(),
        submitPrescription: jest.fn()
      };

      jest.spyOn(React, 'useContext').mockReturnValue(mockContextValue);

      render(<PrescriptionForm />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading form...')).toBeInTheDocument();
    });
  });

  describe('Accessibility Features', () => {
    test('form has proper ARIA structure', () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const formRegion = screen.getByRole('region');
      expect(formRegion).toHaveAttribute('aria-labelledby', 'prescription-form-heading');

      const formTitle = screen.getByText('📝 Prescription Form');
      expect(formTitle).toHaveAttribute('id', 'prescription-form-heading');
    });

    test('form actions have proper group role', () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const actionsGroup = screen.getByRole('group', { name: 'Form actions' });
      expect(actionsGroup).toBeInTheDocument();
    });

    test('help text is properly associated with inputs', () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const medicationField = screen.getByLabelText(/Medication Name/);
      expect(medicationField).toHaveAttribute('aria-describedby', 'medication-help');

      const helpText = screen.getByText('Enter the generic or brand name of the medication');
      expect(helpText).toHaveAttribute('id', 'medication-help');
    });

    test('submit button has proper accessibility attributes', () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const submitButton = screen.getByRole('button', { name: /Submit Prescription/ });
      expect(submitButton).toHaveAttribute('aria-describedby', 'submit-help');

      const submitHelp = screen.getByText('Submit the prescription for processing');
      expect(submitHelp).toHaveAttribute('id', 'submit-help');
    });
  });

  describe('Keyboard Navigation', () => {
    test('form fields are properly focusable', async () => {
      render(
        <PrescriptionsProvider>
          <PrescriptionForm />
        </PrescriptionsProvider>
      );

      const medicationField = screen.getByLabelText(/Medication Name/);
      const dosageField = screen.getByLabelText(/Dosage/);

      medicationField.focus();
      expect(medicationField).toHaveFocus();

      await user.tab();
      expect(dosageField).toHaveFocus();
    });

    test('form submission works with keyboard', async () => {
      const mockOnSubmit = jest.fn();
      render(
        <PrescriptionsProvider>
          <PrescriptionForm onSubmit={mockOnSubmit} />
        </PrescriptionsProvider>
      );

      // Fill form using keyboard
      await user.type(screen.getByLabelText(/Medication Name/), 'Lisinopril');
      await user.tab();
      await user.type(screen.getByLabelText(/Dosage/), '10mg');
      await user.tab();
      await user.selectOptions(screen.getByLabelText(/Frequency/), 'Once daily');
      await user.tab();
      await user.type(screen.getByLabelText(/Duration/), '30 days');

      // Submit with Enter key
      const submitButton = screen.getByRole('button', { name: /Submit Prescription/ });
      submitButton.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });
});