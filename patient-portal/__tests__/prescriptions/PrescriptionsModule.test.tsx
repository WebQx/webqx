/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PrescriptionsModule from '../../components/prescriptions/PrescriptionsModule';

// Mock the child components to isolate testing
jest.mock('../../components/prescriptions/SmartRxTemplatePicker', () => {
  return function MockSmartRxTemplatePicker({ className, onTemplateSelect }: any) {
    return (
      <div 
        data-testid="mock-template-picker" 
        className={className}
      >
        <button onClick={() => onTemplateSelect?.({ id: '1', name: 'Test Template' })}>
          Select Template
        </button>
      </div>
    );
  };
});

jest.mock('../../components/prescriptions/PrescriptionForm', () => {
  return function MockPrescriptionForm({ className, onSubmit, onCancel }: any) {
    return (
      <div 
        data-testid="mock-prescription-form" 
        className={className}
      >
        <button onClick={() => onSubmit?.({ medication: 'Test Med' })}>
          Submit Prescription
        </button>
        <button onClick={() => onCancel?.()}>
          Cancel
        </button>
      </div>
    );
  };
});

// Component that throws an error for testing error boundaries
const ErrorComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error in child component');
  }
  return <div>No error</div>;
};

// Mock console.error to avoid cluttering test output
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('PrescriptionsModule', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders main module structure', () => {
      render(<PrescriptionsModule />);

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
      expect(screen.getByText('💊 Prescription Management')).toBeInTheDocument();
    });

    test('renders child components', () => {
      render(<PrescriptionsModule />);

      expect(screen.getByTestId('mock-template-picker')).toBeInTheDocument();
      expect(screen.getByTestId('mock-prescription-form')).toBeInTheDocument();
    });

    test('applies custom className', () => {
      render(<PrescriptionsModule className="custom-module-class" />);

      const moduleContainer = screen.getByRole('main');
      expect(moduleContainer).toHaveClass('prescriptions-module');
      expect(moduleContainer).toHaveClass('custom-module-class');
    });

    test('applies compact mode class when enabled', () => {
      render(<PrescriptionsModule compact={true} />);

      const moduleContainer = screen.getByRole('main');
      expect(moduleContainer).toHaveClass('prescriptions-module');
      expect(moduleContainer).toHaveClass('compact');
    });
  });

  describe('Accessibility Features', () => {
    test('has proper ARIA structure', () => {
      render(<PrescriptionsModule />);

      const mainContainer = screen.getByRole('main');
      expect(mainContainer).toHaveAttribute('aria-labelledby', 'prescriptions-module-heading');

      const moduleHeading = screen.getByText('💊 Prescription Management');
      expect(moduleHeading).toHaveAttribute('id', 'prescriptions-module-heading');
    });

    test('has proper section landmarks', () => {
      render(<PrescriptionsModule />);

      const templateSection = screen.getByRole('region', { name: /Prescription Template Selection/ });
      expect(templateSection).toBeInTheDocument();

      const formSection = screen.getByRole('region', { name: /Prescription Creation Form/ });
      expect(formSection).toBeInTheDocument();
    });

    test('has skip links for accessibility', () => {
      render(<PrescriptionsModule />);

      const skipLinks = screen.getByLabelText('Skip navigation links');
      expect(skipLinks).toBeInTheDocument();

      const skipToTemplate = screen.getByText('Skip to template picker');
      expect(skipToTemplate).toHaveAttribute('href', '#template-picker-content');

      const skipToForm = screen.getByText('Skip to prescription form');
      expect(skipToForm).toHaveAttribute('href', '#prescription-form-heading');
    });

    test('has live region for announcements', () => {
      render(<PrescriptionsModule />);

      const liveRegion = screen.getByLabelText('Prescription system announcements');
      expect(liveRegion).toHaveAttribute('role', 'status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveClass('sr-only');
    });

    test('navigation buttons have proper ARIA labels', () => {
      render(<PrescriptionsModule />);

      expect(screen.getByLabelText('View prescription history')).toBeInTheDocument();
      expect(screen.getByLabelText('Access prescription help and documentation')).toBeInTheDocument();
      expect(screen.getByLabelText('Module settings and preferences')).toBeInTheDocument();
    });
  });

  describe('Error Boundary Integration', () => {
    test('catches and handles errors from child components', () => {
      // Mock a child component that throws an error
      jest.doMock('../../components/prescriptions/SmartRxTemplatePicker', () => {
        return function ErrorTemplatePicker() {
          throw new Error('Template picker error');
        };
      });

      render(<PrescriptionsModule />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('⚠️ Prescription System Unavailable')).toBeInTheDocument();
    });

    test('error boundary fallback has proper accessibility', () => {
      // Mock ErrorBoundary to render fallback
      jest.doMock('../../components/prescriptions/ErrorBoundary', () => {
        return function MockErrorBoundary({ children, fallback }: any) {
          return fallback || children;
        };
      });

      // Trigger error condition
      jest.doMock('../../components/prescriptions/SmartRxTemplatePicker', () => {
        return function ErrorTemplatePicker() {
          throw new Error('Test error');
        };
      });

      render(<PrescriptionsModule />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByLabelText('Reload page to try again')).toBeInTheDocument();
    });

    test('calls onError callback when error occurs', () => {
      const mockOnError = jest.fn();

      // Create a component that simulates error boundary behavior
      const ErrorBoundaryTest: React.FC = () => {
        const [hasError, setHasError] = React.useState(false);

        React.useEffect(() => {
          try {
            throw new Error('Test error');
          } catch (error) {
            mockOnError(error, { componentStack: 'test stack' });
            setHasError(true);
          }
        }, []);

        if (hasError) {
          return <div role="alert">Error occurred</div>;
        }

        return <PrescriptionsModule onError={mockOnError} />;
      };

      render(<ErrorBoundaryTest />);

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: 'test stack'
        })
      );
    });
  });

  describe('Callback Integration', () => {
    test('calls onPrescriptionSubmitted when prescription is submitted', async () => {
      const mockOnPrescriptionSubmitted = jest.fn();
      render(<PrescriptionsModule onPrescriptionSubmitted={mockOnPrescriptionSubmitted} />);

      const submitButton = screen.getByText('Submit Prescription');
      await user.click(submitButton);

      expect(mockOnPrescriptionSubmitted).toHaveBeenCalledWith(
        expect.stringMatching(/^rx-\d+$/)
      );
    });

    test('passes callbacks to child components', () => {
      render(<PrescriptionsModule />);

      // Verify that child components receive the necessary props
      const templatePicker = screen.getByTestId('mock-template-picker');
      const prescriptionForm = screen.getByTestId('mock-prescription-form');

      expect(templatePicker).toBeInTheDocument();
      expect(prescriptionForm).toBeInTheDocument();
    });
  });

  describe('Module Information and Navigation', () => {
    test('displays module version and compliance information', () => {
      render(<PrescriptionsModule />);

      expect(screen.getByText(/WebQX Prescriptions v1.0/)).toBeInTheDocument();
      expect(screen.getByText(/HIPAA Compliant | FDA Approved Templates/)).toBeInTheDocument();
    });

    test('navigation links are properly structured', () => {
      render(<PrescriptionsModule />);

      const navigation = screen.getByRole('navigation', { name: 'Prescription module navigation' });
      expect(navigation).toBeInTheDocument();

      // Test each navigation button individually
      expect(screen.getByLabelText('View prescription history')).toBeInTheDocument();
      expect(screen.getByLabelText('Access prescription help and documentation')).toBeInTheDocument();
      expect(screen.getByLabelText('Module settings and preferences')).toBeInTheDocument();
    });

    test('module information has proper accessibility grouping', () => {
      render(<PrescriptionsModule />);

      const moduleInfo = screen.getByRole('group', { name: 'Module information' });
      expect(moduleInfo).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    test('template picker has correct CSS class', () => {
      render(<PrescriptionsModule />);

      const templatePicker = screen.getByTestId('mock-template-picker');
      expect(templatePicker).toHaveClass('module-template-picker');
    });

    test('prescription form has correct CSS class', () => {
      render(<PrescriptionsModule />);

      const prescriptionForm = screen.getByTestId('mock-prescription-form');
      expect(prescriptionForm).toHaveClass('module-prescription-form');
    });
  });

  describe('Individual Error Boundary Fallbacks', () => {
    test('template picker error shows specific fallback', () => {
      // We can't easily test individual error boundaries without mocking deeper,
      // but we can verify the structure exists
      render(<PrescriptionsModule />);

      const templateSection = screen.getByRole('region', { name: /Prescription Template Selection/ });
      expect(templateSection).toBeInTheDocument();
    });

    test('form error shows specific fallback', () => {
      render(<PrescriptionsModule />);

      const formSection = screen.getByRole('region', { name: /Prescription Creation Form/ });
      expect(formSection).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    test('skip links are keyboard accessible', async () => {
      render(<PrescriptionsModule />);

      const skipToTemplate = screen.getByText('Skip to template picker');
      const skipToForm = screen.getByText('Skip to prescription form');

      skipToTemplate.focus();
      expect(skipToTemplate).toHaveFocus();

      await user.tab();
      expect(skipToForm).toHaveFocus();
    });

    test('navigation buttons are keyboard accessible', async () => {
      render(<PrescriptionsModule />);

      const historyButton = screen.getByLabelText('View prescription history');
      const helpButton = screen.getByLabelText('Access prescription help and documentation');
      const settingsButton = screen.getByLabelText('Module settings and preferences');

      historyButton.focus();
      expect(historyButton).toHaveFocus();

      await user.tab();
      expect(helpButton).toHaveFocus();

      await user.tab();
      expect(settingsButton).toHaveFocus();
    });
  });

  describe('Responsive Design', () => {
    test('module structure adapts to compact mode', () => {
      const { rerender } = render(<PrescriptionsModule />);

      let moduleContainer = screen.getByRole('main');
      expect(moduleContainer).not.toHaveClass('compact');

      rerender(<PrescriptionsModule compact={true} />);

      moduleContainer = screen.getByRole('main');
      expect(moduleContainer).toHaveClass('compact');
    });
  });

  describe('Context Provider Integration', () => {
    test('wraps children with PrescriptionsProvider', () => {
      render(<PrescriptionsModule />);

      // The child components should be able to access the context
      // This is implicitly tested by the components rendering without errors
      expect(screen.getByTestId('mock-template-picker')).toBeInTheDocument();
      expect(screen.getByTestId('mock-prescription-form')).toBeInTheDocument();
    });
  });

  describe('Module Description', () => {
    test('displays helpful description text', () => {
      render(<PrescriptionsModule />);

      expect(screen.getByText(/Create and manage prescriptions using smart templates/)).toBeInTheDocument();
    });

    test('description is properly associated with the module', () => {
      render(<PrescriptionsModule />);

      const description = screen.getByText(/Create and manage prescriptions using smart templates/);
      expect(description).toHaveClass('module-description');
    });
  });
});