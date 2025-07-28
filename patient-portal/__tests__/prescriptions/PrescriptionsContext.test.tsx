import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { 
  PrescriptionsProvider, 
  usePrescriptions, 
  RxTemplate, 
  Prescription 
} from '../../components/prescriptions/PrescriptionsContext';

// Test component to access context
const TestComponent: React.FC = () => {
  const {
    state,
    selectTemplate,
    updateFormData,
    clearFormData,
    submitPrescription,
    loadTemplates,
    loadPrescriptions
  } = usePrescriptions();

  return (
    <div>
      <div data-testid="loading">{state.isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="error">{state.error || 'no-error'}</div>
      <div data-testid="templates-count">{state.templates.length}</div>
      <div data-testid="prescriptions-count">{state.prescriptions.length}</div>
      <div data-testid="selected-template">
        {state.selectedTemplate?.name || 'none'}
      </div>
      <div data-testid="form-medication">
        {state.formData.medication || 'empty'}
      </div>
      
      <button onClick={() => loadTemplates()}>Load Templates</button>
      <button onClick={() => loadPrescriptions()}>Load Prescriptions</button>
      <button onClick={() => selectTemplate({
        id: '1',
        name: 'Test Template',
        medication: 'Test Med',
        commonDosages: ['10mg'],
        commonFrequencies: ['Once daily'],
        category: 'Test'
      })}>Select Template</button>
      <button onClick={() => updateFormData({ medication: 'Updated Med' })}>
        Update Form Data
      </button>
      <button onClick={() => clearFormData()}>Clear Form Data</button>
      <button onClick={() => submitPrescription({
        medication: 'New Med',
        dosage: '5mg',
        frequency: 'Twice daily',
        duration: '30 days',
        prescriber: 'Dr. Test'
      })}>Submit Prescription</button>
    </div>
  );
};

// Component that uses context outside of provider (for error testing)
const ComponentWithoutProvider: React.FC = () => {
  const context = usePrescriptions();
  return <div>{context.state.isLoading ? 'loading' : 'loaded'}</div>;
};

describe('PrescriptionsContext', () => {
  describe('Provider Setup', () => {
    test('provides context to child components', () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      expect(screen.getByTestId('templates-count')).toHaveTextContent('0');
      expect(screen.getByTestId('prescriptions-count')).toHaveTextContent('0');
    });

    test('throws error when used outside provider', () => {
      // Suppress console error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        render(<ComponentWithoutProvider />);
      }).toThrow('usePrescriptions must be used within a PrescriptionsProvider');

      console.error = originalError;
    });
  });

  describe('Initial State', () => {
    test('has correct initial state values', () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      expect(screen.getByTestId('templates-count')).toHaveTextContent('0');
      expect(screen.getByTestId('prescriptions-count')).toHaveTextContent('0');
      expect(screen.getByTestId('selected-template')).toHaveTextContent('none');
      expect(screen.getByTestId('form-medication')).toHaveTextContent('empty');
    });
  });

  describe('Template Management', () => {
    test('loads templates successfully', async () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      const loadButton = screen.getByText('Load Templates');
      fireEvent.click(loadButton);

      // Should show loading state
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');

      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('templates-count')).toHaveTextContent('3');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });

    test('selects template and updates form data', async () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      const selectButton = screen.getByText('Select Template');
      fireEvent.click(selectButton);

      expect(screen.getByTestId('selected-template')).toHaveTextContent('Test Template');
      expect(screen.getByTestId('form-medication')).toHaveTextContent('Test Med');
    });

    test('clears template selection', async () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      // First select a template
      const selectButton = screen.getByText('Select Template');
      fireEvent.click(selectButton);

      expect(screen.getByTestId('selected-template')).toHaveTextContent('Test Template');

      // Then clear it
      const clearButton = screen.getByText('Clear Form Data');
      fireEvent.click(clearButton);

      expect(screen.getByTestId('selected-template')).toHaveTextContent('none');
      expect(screen.getByTestId('form-medication')).toHaveTextContent('empty');
    });
  });

  describe('Form Data Management', () => {
    test('updates form data', () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      const updateButton = screen.getByText('Update Form Data');
      fireEvent.click(updateButton);

      expect(screen.getByTestId('form-medication')).toHaveTextContent('Updated Med');
    });

    test('clears form data', () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      // First update form data
      const updateButton = screen.getByText('Update Form Data');
      fireEvent.click(updateButton);
      expect(screen.getByTestId('form-medication')).toHaveTextContent('Updated Med');

      // Then clear it
      const clearButton = screen.getByText('Clear Form Data');
      fireEvent.click(clearButton);
      expect(screen.getByTestId('form-medication')).toHaveTextContent('empty');
    });
  });

  describe('Prescription Management', () => {
    test('loads prescriptions successfully', async () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      const loadButton = screen.getByText('Load Prescriptions');
      fireEvent.click(loadButton);

      // Should show loading state
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');

      // Wait for prescriptions to load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('prescriptions-count')).toHaveTextContent('1');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });

    test('submits prescription successfully', async () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      const submitButton = screen.getByText('Submit Prescription');
      fireEvent.click(submitButton);

      // Should show loading state
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');

      // Wait for submission to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('prescriptions-count')).toHaveTextContent('1');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      expect(screen.getByTestId('form-medication')).toHaveTextContent('empty'); // Form should be cleared
    });
  });

  describe('Error Handling', () => {
    test('handles template loading errors gracefully', async () => {
      // Mock the promise to reject
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        throw new Error('Network error');
      }) as any;

      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      const loadButton = screen.getByText('Load Templates');
      fireEvent.click(loadButton);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      });

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('State Management', () => {
    test('maintains state consistency across operations', async () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      // Load templates
      fireEvent.click(screen.getByText('Load Templates'));
      await waitFor(() => {
        expect(screen.getByTestId('templates-count')).toHaveTextContent('3');
      });

      // Select template
      fireEvent.click(screen.getByText('Select Template'));
      expect(screen.getByTestId('selected-template')).toHaveTextContent('Test Template');

      // Update form data
      fireEvent.click(screen.getByText('Update Form Data'));
      expect(screen.getByTestId('form-medication')).toHaveTextContent('Updated Med');

      // Load prescriptions (should not affect templates or form data)
      fireEvent.click(screen.getByText('Load Prescriptions'));
      await waitFor(() => {
        expect(screen.getByTestId('prescriptions-count')).toHaveTextContent('1');
      });

      expect(screen.getByTestId('templates-count')).toHaveTextContent('3');
      expect(screen.getByTestId('selected-template')).toHaveTextContent('Test Template');
      expect(screen.getByTestId('form-medication')).toHaveTextContent('Updated Med');
    });
  });

  describe('Loading States', () => {
    test('shows loading state during template loading', () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      fireEvent.click(screen.getByText('Load Templates'));
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    });

    test('shows loading state during prescription loading', () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      fireEvent.click(screen.getByText('Load Prescriptions'));
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    });

    test('shows loading state during prescription submission', () => {
      render(
        <PrescriptionsProvider>
          <TestComponent />
        </PrescriptionsProvider>
      );

      fireEvent.click(screen.getByText('Submit Prescription'));
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    });
  });
});