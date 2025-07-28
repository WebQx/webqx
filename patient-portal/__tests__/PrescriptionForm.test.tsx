/**
 * Comprehensive tests for PrescriptionForm component and sub-components
 * 
 * Tests cover:
 * - Basic functionality and user interactions
 * - Error handling and retry mechanisms  
 * - Loading states and accessibility features
 * - Keyboard navigation and ARIA compliance
 * - TypeScript type safety
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Import components
import PrescriptionForm from '../components/PrescriptionForm';
import SearchInput from '../components/SearchInput';
import LoadingIndicator from '../components/LoadingIndicator';
import ErrorMessage from '../components/ErrorMessage';
import NotificationMessage from '../components/NotificationMessage';
import MedicationResults from '../components/MedicationResults';

// Import services and types
import { rxNormService } from '../services/rxnorm';
import { MedicationItem } from '../types/prescription';

// Mock the RxNorm service
jest.mock('../services/rxnorm');
const mockedRxNormService = jest.mocked(rxNormService);

describe('PrescriptionForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service to default mock behavior
    mockedRxNormService.searchMedications.mockClear();
  });

  describe('Basic Rendering and Props', () => {
    test('renders with default props', () => {
      render(<PrescriptionForm />);
      
      expect(screen.getByRole('region', { name: /prescription management/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('💊 Prescription Management');
      expect(screen.getByRole('search')).toBeInTheDocument();
    });

    test('applies custom className', () => {
      render(<PrescriptionForm className="custom-class" />);
      
      const form = screen.getByRole('region', { name: /prescription management/i });
      expect(form).toHaveClass('prescription-form');
      expect(form).toHaveClass('custom-class');
    });

    test('renders in disabled state', () => {
      render(<PrescriptionForm disabled={true} />);
      
      const form = screen.getByRole('region', { name: /prescription management/i });
      expect(form).toHaveClass('prescription-form--disabled');
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    test('renders with initial query', async () => {
      const mockMedications: MedicationItem[] = [
        { rxcui: '161', name: 'Acetaminophen', synonym: 'Tylenol', strength: '500mg', doseForm: 'tablet' }
      ];
      mockedRxNormService.searchMedications.mockResolvedValue(mockMedications);
      
      render(<PrescriptionForm initialQuery="acetaminophen" />);
      
      await waitFor(() => {
        expect(screen.getByText('Acetaminophen')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    test('performs search when form is submitted', async () => {
      const mockMedications: MedicationItem[] = [
        { rxcui: '161', name: 'Acetaminophen', synonym: 'Tylenol', strength: '500mg', doseForm: 'tablet' }
      ];
      mockedRxNormService.searchMedications.mockResolvedValue(mockMedications);
      
      const user = userEvent.setup();
      render(<PrescriptionForm />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search for medications/i });
      
      await user.type(searchInput, 'acetaminophen');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(mockedRxNormService.searchMedications).toHaveBeenCalledWith('acetaminophen');
        expect(screen.getByText('Acetaminophen')).toBeInTheDocument();
      });
    });

    test('calls onSearch callback when search is performed', async () => {
      const mockMedications: MedicationItem[] = [];
      mockedRxNormService.searchMedications.mockResolvedValue(mockMedications);
      const onSearchMock = jest.fn();
      
      const user = userEvent.setup();
      render(<PrescriptionForm onSearch={onSearchMock} />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search for medications/i });
      
      await user.type(searchInput, 'test');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(onSearchMock).toHaveBeenCalledWith('test');
      });
    });

    test('shows loading state during search', async () => {
      let resolveSearch: (value: MedicationItem[]) => void;
      const searchPromise = new Promise<MedicationItem[]>((resolve) => {
        resolveSearch = resolve;
      });
      mockedRxNormService.searchMedications.mockReturnValue(searchPromise);
      
      const user = userEvent.setup();
      render(<PrescriptionForm />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search for medications/i });
      
      await user.type(searchInput, 'test');
      await user.click(searchButton);
      
      // Check loading state
      expect(screen.getByText(/searching/i)).toBeInTheDocument();
      expect(screen.getByRole('status', { name: /searching rxnorm database/i })).toBeInTheDocument();
      
      // Resolve the search
      act(() => {
        resolveSearch!([]);
      });
      
      await waitFor(() => {
        expect(screen.queryByText(/searching/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Retry Mechanism', () => {
    test('displays error message when search fails', async () => {
      mockedRxNormService.searchMedications.mockRejectedValue(new Error('API Error'));
      
      const user = userEvent.setup();
      render(<PrescriptionForm />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search for medications/i });
      
      await user.type(searchInput, 'test');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/api error/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    test('retry mechanism works correctly', async () => {
      // First call fails, second succeeds
      mockedRxNormService.searchMedications
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([
          { rxcui: '161', name: 'Acetaminophen', synonym: 'Tylenol', strength: '500mg', doseForm: 'tablet' }
        ]);
      
      const user = userEvent.setup();
      render(<PrescriptionForm maxRetries={3} />);
      
      // Initial search that fails
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search for medications/i });
      
      await user.type(searchInput, 'test');
      await user.click(searchButton);
      
      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      
      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry medication search/i });
      await user.click(retryButton);
      
      // Check that retry worked
      await waitFor(() => {
        expect(screen.getByText('Acetaminophen')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
      
      expect(mockedRxNormService.searchMedications).toHaveBeenCalledTimes(2);
    });

    test('shows max retries message when limit exceeded', async () => {
      mockedRxNormService.searchMedications.mockRejectedValue(new Error('Persistent error'));
      
      const user = userEvent.setup();
      render(<PrescriptionForm maxRetries={2} />);
      
      // Initial search
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search for medications/i });
      
      await user.type(searchInput, 'test');
      await user.click(searchButton);
      
      // First retry
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry medication search/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /retry medication search/i }));
      
      // Second retry
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry medication search/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /retry medication search/i }));
      
      // Should show max retries message
      await waitFor(() => {
        expect(screen.getByText(/maximum retry attempts/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /retry medication search/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Medication Results and EHR Integration', () => {
    test('displays search results correctly', async () => {
      const mockMedications: MedicationItem[] = [
        { 
          rxcui: '161', 
          name: 'Acetaminophen', 
          synonym: 'Tylenol', 
          strength: '500mg', 
          doseForm: 'tablet' 
        },
        { 
          rxcui: '5640', 
          name: 'Ibuprofen', 
          synonym: 'Advil, Motrin', 
          strength: '200mg', 
          doseForm: 'tablet' 
        }
      ];
      mockedRxNormService.searchMedications.mockResolvedValue(mockMedications);
      
      const user = userEvent.setup();
      render(<PrescriptionForm />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search for medications/i });
      
      await user.type(searchInput, 'pain');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText('Acetaminophen')).toBeInTheDocument();
        expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
        expect(screen.getByText('Also known as: Tylenol')).toBeInTheDocument();
        expect(screen.getByText('Also known as: Advil, Motrin')).toBeInTheDocument();
        expect(screen.getByText('Found 2 medications')).toBeInTheDocument();
      });
    });

    test('adds medication to EHR successfully', async () => {
      const mockMedications: MedicationItem[] = [
        { rxcui: '161', name: 'Acetaminophen', synonym: 'Tylenol', strength: '500mg', doseForm: 'tablet' }
      ];
      mockedRxNormService.searchMedications.mockResolvedValue(mockMedications);
      const onMedicationAddedMock = jest.fn();
      
      const user = userEvent.setup();
      render(<PrescriptionForm onMedicationAdded={onMedicationAddedMock} />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search for medications/i });
      
      await user.type(searchInput, 'acetaminophen');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText('Acetaminophen')).toBeInTheDocument();
      });
      
      // Click "Add to EHR" button
      const addButton = screen.getByRole('button', { name: /add acetaminophen to your electronic health record/i });
      await user.click(addButton);
      
      // Check success notification
      await waitFor(() => {
        expect(screen.getByText(/acetaminophen has been successfully added/i)).toBeInTheDocument();
      });
      
      // Check that button shows "Added"
      expect(screen.getByRole('button', { name: /acetaminophen has been added/i })).toBeInTheDocument();
      
      // Check callback was called
      expect(onMedicationAddedMock).toHaveBeenCalledWith(mockMedications[0]);
    });

    test('prevents duplicate medications from being added', async () => {
      const mockMedications: MedicationItem[] = [
        { rxcui: '161', name: 'Acetaminophen', synonym: 'Tylenol', strength: '500mg', doseForm: 'tablet' }
      ];
      mockedRxNormService.searchMedications.mockResolvedValue(mockMedications);
      
      const user = userEvent.setup();
      render(<PrescriptionForm />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search for medications/i });
      
      await user.type(searchInput, 'acetaminophen');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText('Acetaminophen')).toBeInTheDocument();
      });
      
      // Add medication first time
      const addButton = screen.getByRole('button', { name: /add acetaminophen to your electronic health record/i });
      await user.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText(/acetaminophen has been successfully added/i)).toBeInTheDocument();
      });
      
      // Try to add again - should show already added message
      const addedButton = screen.getByRole('button', { name: /acetaminophen has been added/i });
      await user.click(addedButton);
      
      await waitFor(() => {
        expect(screen.getByText(/acetaminophen is already in your ehr/i)).toBeInTheDocument();
      });
    });

    test('shows empty state when no results found', async () => {
      mockedRxNormService.searchMedications.mockResolvedValue([]);
      
      const user = userEvent.setup();
      render(<PrescriptionForm />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search for medications/i });
      
      await user.type(searchInput, 'nonexistentdrug');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText('No medications found')).toBeInTheDocument();
        expect(screen.getByText(/try searching with/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Features', () => {
    test('has proper ARIA labels and roles', () => {
      render(<PrescriptionForm />);
      
      // Main form region
      expect(screen.getByRole('region', { name: /prescription management/i })).toBeInTheDocument();
      
      // Search form
      expect(screen.getByRole('search')).toBeInTheDocument();
      expect(screen.getByLabelText(/search medications in rxnorm database/i)).toBeInTheDocument();
      
      // Help section
      expect(screen.getByText(/how to search for medications/i)).toBeInTheDocument();
    });

    test('keyboard navigation works correctly', async () => {
      const mockMedications: MedicationItem[] = [
        { rxcui: '161', name: 'Acetaminophen', synonym: 'Tylenol', strength: '500mg', doseForm: 'tablet' }
      ];
      mockedRxNormService.searchMedications.mockResolvedValue(mockMedications);
      
      const user = userEvent.setup();
      render(<PrescriptionForm />);
      
      const searchInput = screen.getByRole('textbox');
      
      // Tab to search input
      await user.tab();
      expect(searchInput).toHaveFocus();
      
      // Type and press Enter to search
      await user.type(searchInput, 'acetaminophen');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText('Acetaminophen')).toBeInTheDocument();
      });
      
      // Tab to Add button and press Enter
      await user.tab();
      await user.tab();
      const addButton = screen.getByRole('button', { name: /add acetaminophen to your electronic health record/i });
      expect(addButton).toHaveFocus();
      
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/acetaminophen has been successfully added/i)).toBeInTheDocument();
      });
    });

    test('screen reader announcements work correctly', async () => {
      render(<PrescriptionForm />);
      
      // Check for live regions
      expect(screen.getByLabelText(/search medications in rxnorm database/i)).toBeInTheDocument();
      
      // Test loading announcement
      const mockMedications: MedicationItem[] = [];
      let resolveSearch: (value: MedicationItem[]) => void;
      const searchPromise = new Promise<MedicationItem[]>((resolve) => {
        resolveSearch = resolve;
      });
      mockedRxNormService.searchMedications.mockReturnValue(searchPromise);
      
      const user = userEvent.setup();
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search for medications/i });
      
      await user.type(searchInput, 'test');
      await user.click(searchButton);
      
      // Check loading status is announced
      await waitFor(() => {
        expect(screen.getByText(/searching rxnorm database/i)).toBeInTheDocument();
      });
      
      act(() => {
        resolveSearch!([]);
      });
    });
  });

  describe('Debug Mode', () => {
    test('shows debug information when debug prop is true', () => {
      const consoleSpy = jest.spyOn(console, 'group').mockImplementation();
      const consoleEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();
      
      render(<PrescriptionForm debug={true} />);
      
      expect(consoleSpy).toHaveBeenCalledWith('PrescriptionForm Debug Info');
      expect(consoleEndSpy).toHaveBeenCalled();
      
      // Check for reset button
      expect(screen.getByRole('button', { name: /reset search state/i })).toBeInTheDocument();
      
      consoleSpy.mockRestore();
      consoleEndSpy.mockRestore();
    });

    test('reset button works in debug mode', async () => {
      const user = userEvent.setup();
      render(<PrescriptionForm debug={true} />);
      
      // Perform a search first
      const searchInput = screen.getByRole('textbox');
      await user.type(searchInput, 'test');
      
      // Click reset button
      const resetButton = screen.getByRole('button', { name: /reset search state/i });
      await user.click(resetButton);
      
      // Check that input is cleared
      expect(searchInput).toHaveValue('');
    });
  });
});

describe('SearchInput Component', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    isLoading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with default props', () => {
    render(<SearchInput {...defaultProps} />);
    
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search for medications/i })).toBeInTheDocument();
  });

  test('handles input changes', async () => {
    const onChangeMock = jest.fn();
    const user = userEvent.setup();
    
    render(<SearchInput {...defaultProps} onChange={onChangeMock} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test');
    
    expect(onChangeMock).toHaveBeenCalledTimes(4); // One for each character
  });

  test('shows clear button when input has value', () => {
    render(<SearchInput {...defaultProps} value="test" />);
    
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  test('keyboard shortcuts work correctly', async () => {
    const onSubmitMock = jest.fn();
    const onChangeMock = jest.fn();
    const user = userEvent.setup();
    
    render(<SearchInput {...defaultProps} value="test" onChange={onChangeMock} onSubmit={onSubmitMock} />);
    
    const input = screen.getByRole('textbox');
    input.focus();
    
    // Test Enter key
    await user.keyboard('{Enter}');
    expect(onSubmitMock).toHaveBeenCalled();
    
    // Test Escape key
    await user.keyboard('{Escape}');
    expect(onChangeMock).toHaveBeenCalledWith('');
  });
});

describe('LoadingIndicator Component', () => {
  test('renders when isLoading is true', () => {
    render(<LoadingIndicator isLoading={true} />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/searching medications/i)).toBeInTheDocument();
  });

  test('does not render when isLoading is false', () => {
    render(<LoadingIndicator isLoading={false} />);
    
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('displays custom message', () => {
    render(<LoadingIndicator isLoading={true} message="Custom loading message" />);
    
    expect(screen.getByText('Custom loading message')).toBeInTheDocument();
  });
});

describe('ErrorMessage Component', () => {
  test('renders error message', () => {
    render(<ErrorMessage error="Test error message" />);
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  test('does not render when error is null', () => {
    render(<ErrorMessage error={null} />);
    
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('shows retry button when onRetry is provided', () => {
    const onRetryMock = jest.fn();
    render(<ErrorMessage error="Test error" onRetry={onRetryMock} />);
    
    expect(screen.getByRole('button', { name: /retry medication search/i })).toBeInTheDocument();
  });

  test('calls onRetry when retry button is clicked', async () => {
    const onRetryMock = jest.fn();
    const user = userEvent.setup();
    
    render(<ErrorMessage error="Test error" onRetry={onRetryMock} />);
    
    const retryButton = screen.getByRole('button', { name: /retry medication search/i });
    await user.click(retryButton);
    
    expect(onRetryMock).toHaveBeenCalled();
  });
});

describe('NotificationMessage Component', () => {
  test('renders notification message', () => {
    render(<NotificationMessage message="Test notification" />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Test notification')).toBeInTheDocument();
  });

  test('does not render when message is null', () => {
    render(<NotificationMessage message={null} />);
    
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('shows dismiss button when onDismiss is provided', () => {
    const onDismissMock = jest.fn();
    render(<NotificationMessage message="Test" onDismiss={onDismissMock} />);
    
    expect(screen.getByRole('button', { name: /dismiss notification/i })).toBeInTheDocument();
  });

  test('auto-dismisses after delay', async () => {
    const onDismissMock = jest.fn();
    
    render(<NotificationMessage message="Test" onDismiss={onDismissMock} autoHideDelay={100} />);
    
    await waitFor(() => {
      expect(onDismissMock).toHaveBeenCalled();
    }, { timeout: 200 });
  });
});

describe('MedicationResults Component', () => {
  const mockMedications: MedicationItem[] = [
    { rxcui: '161', name: 'Acetaminophen', synonym: 'Tylenol', strength: '500mg', doseForm: 'tablet' },
    { rxcui: '5640', name: 'Ibuprofen', synonym: 'Advil', strength: '200mg', doseForm: 'tablet' }
  ];

  test('renders medication results', () => {
    const onAddToEHRMock = jest.fn();
    render(<MedicationResults results={mockMedications} isLoading={false} onAddToEHR={onAddToEHRMock} />);
    
    expect(screen.getByText('Acetaminophen')).toBeInTheDocument();
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
    expect(screen.getByText('Found 2 medications')).toBeInTheDocument();
  });

  test('shows loading skeleton when isLoading is true', () => {
    const onAddToEHRMock = jest.fn();
    render(<MedicationResults results={[]} isLoading={true} onAddToEHR={onAddToEHRMock} />);
    
    expect(screen.getByRole('status', { name: /loading medication search results/i })).toBeInTheDocument();
  });

  test('shows empty state when no results', () => {
    const onAddToEHRMock = jest.fn();
    render(<MedicationResults results={[]} isLoading={false} onAddToEHR={onAddToEHRMock} />);
    
    expect(screen.getByText('No medications found')).toBeInTheDocument();
  });

  test('calls onAddToEHR when add button is clicked', async () => {
    const onAddToEHRMock = jest.fn();
    const user = userEvent.setup();
    
    render(<MedicationResults results={mockMedications} isLoading={false} onAddToEHR={onAddToEHRMock} />);
    
    const addButton = screen.getAllByRole('button', { name: /add.*to your electronic health record/i })[0];
    await user.click(addButton);
    
    expect(onAddToEHRMock).toHaveBeenCalledWith(mockMedications[0]);
  });
});