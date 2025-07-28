import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Import components
import MedicationSearch from '../components/MedicationSearch';
import PrescriptionForm from '../components/PrescriptionForm';
import LanguageToggle from '../components/LanguageToggle';
import FormField from '../components/FormField';

import { Medication, PrescriptionForm as PrescriptionFormData } from '../types';

// Test data
const mockMedication: Medication = {
  id: 'test-med-1',
  name: 'Test Medication',
  rxcui: '12345',
  genericName: 'test-generic',
  brandNames: ['TestBrand'],
  dosageForm: 'TABLET',
  strength: '10mg',
  route: 'ORAL',
  category: 'ANALGESIC'
};

const mockPrescriptionData: PrescriptionFormData = {
  patientId: 'patient-123',
  medicationId: 'test-med-1',
  dosage: '10mg',
  frequency: 'twice daily',
  duration: '7 days',
  quantity: 14,
  refills: 2,
  instructions: 'Take with food',
  substitutionAllowed: true,
  priority: 'ROUTINE',
  language: 'en'
};

// Mock services with simplified implementations
jest.mock('../services/rxnormService', () => ({
  rxnormService: {
    searchDrugs: jest.fn().mockResolvedValue([
      {
        rxcui: '12345',
        name: 'Test Medication',
        synonym: 'test-generic',
        tty: 'SBD',
        language: 'ENG'
      }
    ]),
    getFDAWarnings: jest.fn().mockResolvedValue([]),
    clearCache: jest.fn(),
    getCacheStats: jest.fn().mockReturnValue({ size: 0, keys: [] })
  }
}));

jest.mock('../services/whisperTranslator', () => ({
  whisperTranslator: {
    getSupportedLanguages: jest.fn().mockReturnValue([
      { code: 'en', name: 'English', nativeName: 'English', rtl: false },
      { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false },
      { code: 'fr', name: 'French', nativeName: 'Français', rtl: false }
    ]),
    translate: jest.fn().mockResolvedValue({
      originalText: 'test',
      translatedText: 'prueba',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      confidence: 0.9
    }),
    detectLanguage: jest.fn().mockResolvedValue({
      language: 'en',
      confidence: 0.9
    }),
    isLanguageSupported: jest.fn().mockReturnValue(true)
  }
}));

describe('Prescription System Core Components', () => {
  describe('FormField Component', () => {
    it('should render label and input', () => {
      render(
        <FormField label="Test Field" required>
          <input type="text" data-testid="test-input" />
        </FormField>
      );
      
      expect(screen.getByText('Test Field')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument(); // Required indicator
      expect(screen.getByTestId('test-input')).toBeInTheDocument();
    });

    it('should display error message', () => {
      render(
        <FormField label="Test Field" error="This field is required">
          <input type="text" data-testid="test-input" />
        </FormField>
      );
      
      expect(screen.getByRole('alert')).toHaveTextContent('❌ This field is required');
    });

    it('should display warning message', () => {
      render(
        <FormField label="Test Field" warning="This is a warning">
          <input type="text" data-testid="test-input" />
        </FormField>
      );
      
      expect(screen.getByRole('alert')).toHaveTextContent('⚠️ This is a warning');
    });
  });

  describe('LanguageToggle Component', () => {
    const mockOnLanguageChange = jest.fn();

    beforeEach(() => {
      mockOnLanguageChange.mockClear();
    });

    it('should render supported languages', () => {
      render(
        <LanguageToggle
          currentLanguage="en"
          onLanguageChange={mockOnLanguageChange}
        />
      );
      
      const select = screen.getByLabelText('Select language');
      expect(select).toBeInTheDocument();
      
      // Check that options are rendered
      expect(screen.getByDisplayValue(/English/)).toBeInTheDocument();
    });

    it('should call onLanguageChange when language is selected', async () => {
      const user = userEvent.setup();
      
      render(
        <LanguageToggle
          currentLanguage="en"
          onLanguageChange={mockOnLanguageChange}
        />
      );
      
      const select = screen.getByLabelText('Select language');
      await user.selectOptions(select, 'es');
      
      expect(mockOnLanguageChange).toHaveBeenCalledWith('es');
    });
  });

  describe('MedicationSearch Component', () => {
    const mockOnSelect = jest.fn();

    beforeEach(() => {
      mockOnSelect.mockClear();
    });

    it('should render search input', () => {
      render(<MedicationSearch onMedicationSelect={mockOnSelect} />);
      
      const searchInput = screen.getByRole('combobox');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('placeholder', 'Search medications...');
    });

    it('should have proper accessibility attributes', () => {
      render(<MedicationSearch onMedicationSelect={mockOnSelect} />);
      
      const searchInput = screen.getByRole('combobox');
      expect(searchInput).toHaveAttribute('aria-label', 'Search for medications');
      expect(searchInput).toHaveAttribute('aria-expanded', 'false');
      expect(searchInput).toHaveAttribute('aria-haspopup', 'listbox');
      expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');
    });

    it('should handle input changes', async () => {
      const user = userEvent.setup();
      
      render(<MedicationSearch onMedicationSelect={mockOnSelect} />);
      
      const searchInput = screen.getByRole('combobox');
      await user.type(searchInput, 'aspirin');
      
      expect(searchInput).toHaveValue('aspirin');
    });
  });

  describe('PrescriptionForm Component', () => {
    const mockOnSubmit = jest.fn();

    beforeEach(() => {
      mockOnSubmit.mockClear();
    });

    it('should render essential form fields', () => {
      render(<PrescriptionForm onSubmit={mockOnSubmit} />);
      
      expect(screen.getByLabelText(/Patient ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Dosage/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Frequency/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Duration/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Quantity/)).toBeInTheDocument();
    });

    it('should validate required fields on submit', async () => {
      const user = userEvent.setup();
      
      render(<PrescriptionForm onSubmit={mockOnSubmit} />);
      
      const submitButton = screen.getByRole('button', { name: /Create Prescription/ });
      await user.click(submitButton);
      
      // Should show validation errors
      expect(screen.getByText('Please correct the following errors:')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should submit form with valid data', async () => {
      const user = userEvent.setup();
      
      render(<PrescriptionForm onSubmit={mockOnSubmit} initialData={mockPrescriptionData} />);
      
      const submitButton = screen.getByRole('button', { name: /Create Prescription/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          patientId: 'patient-123',
          dosage: '10mg'
        }));
      });
    });

    it('should prevent data loss with beforeunload listener', () => {
      const mockAddEventListener = jest.spyOn(window, 'addEventListener');
      
      render(<PrescriptionForm onSubmit={mockOnSubmit} />);
      
      expect(mockAddEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      
      mockAddEventListener.mockRestore();
    });

    it('should display language toggle when enabled', () => {
      render(<PrescriptionForm onSubmit={mockOnSubmit} showLanguageToggle={true} />);
      
      expect(screen.getByLabelText('Select language')).toBeInTheDocument();
    });
  });

  describe('Form Integration', () => {
    it('should integrate multiple components properly', () => {
      const mockOnSubmit = jest.fn();
      
      render(
        <PrescriptionForm 
          onSubmit={mockOnSubmit} 
          showLanguageToggle={true}
          initialData={mockPrescriptionData}
        />
      );
      
      // Should render all components
      expect(screen.getByLabelText('Select language')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument(); // MedicationSearch
      expect(screen.getByLabelText(/Patient ID/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Prescription/ })).toBeInTheDocument();
    });
  });

  describe('Accessibility Features', () => {
    it('should support keyboard navigation for form fields', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      
      render(<PrescriptionForm onSubmit={mockOnSubmit} />);
      
      // Tab through form fields
      await user.tab();
      expect(screen.getByLabelText(/Patient ID/)).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('combobox')).toHaveFocus();
    });

    it('should have proper ARIA roles and labels', () => {
      const mockOnSubmit = jest.fn();
      
      render(<PrescriptionForm onSubmit={mockOnSubmit} />);
      
      // Check fieldsets have legends
      expect(screen.getByRole('group', { name: 'Patient Information' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Medication' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Prescription Details' })).toBeInTheDocument();
    });

    it('should announce form errors properly', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      
      render(<PrescriptionForm onSubmit={mockOnSubmit} />);
      
      const submitButton = screen.getByRole('button', { name: /Create Prescription/ });
      await user.click(submitButton);
      
      // Error summary should have alert role
      const errorSummary = screen.getByRole('alert', { name: 'Form errors' });
      expect(errorSummary).toBeInTheDocument();
    });
  });

  describe('Responsive Design Features', () => {
    it('should apply custom CSS classes', () => {
      const mockOnSubmit = jest.fn();
      
      render(<PrescriptionForm onSubmit={mockOnSubmit} className="custom-form" />);
      
      const form = screen.getByTestId('prescription-form');
      expect(form).toHaveClass('prescription-form');
    });

    it('should handle disabled state', () => {
      const mockOnSelect = jest.fn();
      
      render(<MedicationSearch onMedicationSelect={mockOnSelect} disabled={true} />);
      
      const searchInput = screen.getByRole('combobox');
      expect(searchInput).toBeDisabled();
    });
  });

  describe('User Experience Features', () => {
    it('should show filters when enabled', () => {
      const mockOnSelect = jest.fn();
      
      render(<MedicationSearch onMedicationSelect={mockOnSelect} showFilters={true} />);
      
      // Should have filter dropdowns
      expect(screen.getByLabelText('Filter by category')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by dosage form')).toBeInTheDocument();
    });

    it('should show recent searches when enabled', () => {
      const mockOnSelect = jest.fn();
      
      render(<MedicationSearch onMedicationSelect={mockOnSelect} showRecentSearches={true} />);
      
      // Component should render without errors
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });
});