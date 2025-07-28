import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportReview, { 
  ExportReviewProps, 
  SelectedMedication, 
  mapICD10FromSpecialty 
} from '../components/ExportReview';

describe('ExportReview Component', () => {
  const mockSelectedMed: SelectedMedication = {
    id: 'med-123',
    name: 'Lisinopril',
    dosage: '10mg',
    frequency: 'Once daily',
    duration: '30 days',
    notes: 'Take with food'
  };

  const defaultProps: ExportReviewProps = {
    selectedMed: mockSelectedMed,
    specialty: 'cardiology',
    providerId: 'provider-dynamic-123',
    className: 'test-class'
  };

  const mockOnExportSuccess = jest.fn();
  const mockOnExportError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders correctly with provided props', () => {
      render(<ExportReview {...defaultProps} />);
      
      expect(screen.getByText('Export Prescription Review')).toBeInTheDocument();
      expect(screen.getByText('Review and confirm prescription export to WebQX™ EHR')).toBeInTheDocument();
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText('10mg')).toBeInTheDocument();
      expect(screen.getByText('Once daily')).toBeInTheDocument();
      expect(screen.getByText('30 days')).toBeInTheDocument();
      expect(screen.getByText('Take with food')).toBeInTheDocument();
    });

    it('displays provider information correctly', () => {
      render(<ExportReview {...defaultProps} />);
      
      expect(screen.getByText('provider-dynamic-123')).toBeInTheDocument();
      expect(screen.getByText('cardiology')).toBeInTheDocument();
    });

    it('applies custom className correctly', () => {
      const { container } = render(<ExportReview {...defaultProps} />);
      const exportReview = container.querySelector('.export-review');
      
      expect(exportReview).toHaveClass('test-class');
    });

    it('renders without optional medication fields when not provided', () => {
      const medWithoutOptionalFields: SelectedMedication = {
        id: 'med-456',
        name: 'Aspirin',
        dosage: '81mg',
        frequency: 'Daily'
        // no duration or notes
      };

      render(
        <ExportReview 
          {...defaultProps} 
          selectedMed={medWithoutOptionalFields} 
        />
      );
      
      expect(screen.getByText('Aspirin')).toBeInTheDocument();
      expect(screen.getByText('81mg')).toBeInTheDocument();
      expect(screen.getByText('Daily')).toBeInTheDocument();
      expect(screen.queryByText('Duration:')).not.toBeInTheDocument();
      expect(screen.queryByText('Notes:')).not.toBeInTheDocument();
    });
  });

  describe('ICD-10 Mapping and Error Handling', () => {
    it('displays correct ICD-10 code for known specialty', () => {
      render(<ExportReview {...defaultProps} specialty="cardiology" />);
      
      expect(screen.getByText('I25.9')).toBeInTheDocument();
      expect(screen.queryByText(/Default code/)).not.toBeInTheDocument();
    });

    it('displays default ICD-10 code R69 for unknown specialty', () => {
      render(<ExportReview {...defaultProps} specialty="unknown-specialty" />);
      
      expect(screen.getByText('R69')).toBeInTheDocument();
      expect(screen.getByText(/Default code \(specialty not mapped\)/)).toBeInTheDocument();
    });

    it('shows warning message when using default ICD-10 code', () => {
      render(<ExportReview {...defaultProps} specialty="unknown-specialty" />);
      
      const warningMessages = screen.getAllByRole('alert');
      const mainWarningMessage = warningMessages.find(alert => 
        alert.textContent?.includes('The specialty "unknown-specialty" is not specifically mapped')
      );
      
      expect(mainWarningMessage).toBeDefined();
      expect(mainWarningMessage).toHaveTextContent('Using default ICD-10 code R69');
    });

    it('does not show warning message for mapped specialties', () => {
      render(<ExportReview {...defaultProps} specialty="cardiology" />);
      
      const warningMessages = screen.queryAllByRole('alert');
      const hasWarning = warningMessages.some(alert => 
        alert.textContent?.includes('not specifically mapped')
      );
      expect(hasWarning).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<ExportReview {...defaultProps} />);
      
      expect(screen.getByRole('region', { name: 'Prescription Export Review' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Medication Details/ })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Export Details/ })).toBeInTheDocument();
    });

    it('has dynamic aria-label for export button based on medication name', () => {
      render(<ExportReview {...defaultProps} />);
      
      const exportButton = screen.getByRole('button', { 
        name: /Export prescription for Lisinopril to WebQX EHR system/ 
      });
      expect(exportButton).toBeInTheDocument();
    });

    it('has proper aria-describedby for export button', () => {
      render(<ExportReview {...defaultProps} />);
      
      const exportButton = screen.getByRole('button');
      expect(exportButton).toHaveAttribute('aria-describedby', 'export-button-description');
      
      const description = screen.getByText(/Click to export the prescription for Lisinopril/);
      expect(description).toBeInTheDocument();
    });

    it('has proper alert roles for status messages', () => {
      render(<ExportReview {...defaultProps} specialty="unknown-specialty" />);
      
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Export Functionality', () => {
    it('handles successful export', async () => {
      render(
        <ExportReview 
          {...defaultProps} 
          onExportSuccess={mockOnExportSuccess}
        />
      );
      
      const exportButton = screen.getByRole('button');
      fireEvent.click(exportButton);
      
      // Button should show loading state
      expect(screen.getByText('⏳ Exporting...')).toBeInTheDocument();
      expect(exportButton).toBeDisabled();
      
      // Wait for export to complete
      await waitFor(() => {
        expect(screen.getByText('✅ Prescription successfully exported to WebQX™ EHR')).toBeInTheDocument();
      });
      
      // Check callback was called
      expect(mockOnExportSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          medication: mockSelectedMed,
          specialty: 'cardiology',
          icd10Code: 'I25.9',
          providerId: 'provider-dynamic-123'
        })
      );
    });

    it('handles export errors when medication name is missing', async () => {
      const invalidMed: SelectedMedication = {
        id: 'med-invalid',
        name: '',
        dosage: '10mg',
        frequency: 'Daily'
      };

      render(
        <ExportReview 
          {...defaultProps} 
          selectedMed={invalidMed}
          onExportError={mockOnExportError}
        />
      );
      
      const exportButton = screen.getByRole('button');
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByText(/❌ Export failed:/)).toBeInTheDocument();
        expect(screen.getByText(/Missing required medication or provider information/)).toBeInTheDocument();
      });
      
      expect(mockOnExportError).toHaveBeenCalledWith(
        'Missing required medication or provider information'
      );
    });

    it('handles export errors when provider ID is missing', async () => {
      render(
        <ExportReview 
          {...defaultProps} 
          providerId=""
          onExportError={mockOnExportError}
        />
      );
      
      const exportButton = screen.getByRole('button');
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByText(/❌ Export failed:/)).toBeInTheDocument();
      });
      
      expect(mockOnExportError).toHaveBeenCalled();
    });

    it('disables button during export', async () => {
      render(<ExportReview {...defaultProps} />);
      
      const exportButton = screen.getByRole('button');
      fireEvent.click(exportButton);
      
      expect(exportButton).toBeDisabled();
      expect(screen.getByText('⏳ Exporting...')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(exportButton).not.toBeDisabled();
        expect(screen.getByText('📤 Export to WebQX™ EHR')).toBeInTheDocument();
      });
    });
  });

  describe('mapICD10FromSpecialty Function', () => {
    it('returns correct ICD-10 codes for known specialties', () => {
      expect(mapICD10FromSpecialty('cardiology')).toBe('I25.9');
      expect(mapICD10FromSpecialty('dermatology')).toBe('L30.9');
      expect(mapICD10FromSpecialty('endocrinology')).toBe('E11.9');
      expect(mapICD10FromSpecialty('gastroenterology')).toBe('K59.9');
      expect(mapICD10FromSpecialty('neurology')).toBe('G93.9');
      expect(mapICD10FromSpecialty('orthopedics')).toBe('M25.9');
      expect(mapICD10FromSpecialty('psychiatry')).toBe('F99');
      expect(mapICD10FromSpecialty('pulmonology')).toBe('J98.9');
      expect(mapICD10FromSpecialty('urology')).toBe('N39.9');
      expect(mapICD10FromSpecialty('general')).toBe('Z00.00');
    });

    it('returns R69 for unknown specialties', () => {
      expect(mapICD10FromSpecialty('unknown')).toBe('R69');
      expect(mapICD10FromSpecialty('invalid-specialty')).toBe('R69');
      expect(mapICD10FromSpecialty('')).toBe('R69');
    });

    it('handles case-insensitive specialty matching', () => {
      expect(mapICD10FromSpecialty('CARDIOLOGY')).toBe('I25.9');
      expect(mapICD10FromSpecialty('Cardiology')).toBe('I25.9');
      expect(mapICD10FromSpecialty('cArDiOlOgY')).toBe('I25.9');
    });

    it('handles specialty strings with extra whitespace', () => {
      expect(mapICD10FromSpecialty('  cardiology  ')).toBe('I25.9');
      expect(mapICD10FromSpecialty('\tcardiology\n')).toBe('I25.9');
    });
  });

  describe('Prop Types Validation', () => {
    it('accepts valid SelectedMedication props', () => {
      const validMed: SelectedMedication = {
        id: 'test-id',
        name: 'Test Med',
        dosage: '5mg',
        frequency: 'Twice daily',
        duration: '14 days',
        notes: 'Test notes'
      };

      expect(() => {
        render(<ExportReview {...defaultProps} selectedMed={validMed} />);
      }).not.toThrow();
    });

    it('accepts valid specialty string prop', () => {
      expect(() => {
        render(<ExportReview {...defaultProps} specialty="cardiology" />);
      }).not.toThrow();
    });

    it('accepts valid providerId string prop', () => {
      expect(() => {
        render(<ExportReview {...defaultProps} providerId="provider-123" />);
      }).not.toThrow();
    });
  });
});