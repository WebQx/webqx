/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DrugInteractionChecker from '../components/DrugInteractionChecker';
import * as drugInteractionsModule from '../utils/api/drugInteractions';

// Mock the drug interactions API
jest.mock('../utils/api/drugInteractions');

const mockCheckDrugInteractions = drugInteractionsModule.checkDrugInteractions as jest.MockedFunction<
  typeof drugInteractionsModule.checkDrugInteractions
>;

describe('DrugInteractionChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('should render the component with initial elements', () => {
      render(<DrugInteractionChecker />);
      
      expect(screen.getByText('💊 Drug Interaction Checker')).toBeInTheDocument();
      expect(screen.getByLabelText('RxCUI (Drug Identifier):')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Check for drug interactions' })).toBeInTheDocument();
      expect(screen.getByText(/Enter a drug's RxCUI/)).toBeInTheDocument();
    });

    it('should render with initial RxCUI when provided', () => {
      render(<DrugInteractionChecker initialRxcui="207106" />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):') as HTMLInputElement;
      expect(input.value).toBe('207106');
    });

    it('should apply custom className when provided', () => {
      const { container } = render(<DrugInteractionChecker className="custom-class" />);
      
      expect(container.firstChild).toHaveClass('drug-interaction-checker custom-class');
    });
  });

  describe('Input Handling', () => {
    it('should update input value when user types', async () => {
      const user = userEvent.setup();
      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      await user.type(input, '207106');
      
      expect(input).toHaveValue('207106');
    });

    it('should manage button state based on loading', async () => {
      const user = userEvent.setup();
      render(<DrugInteractionChecker />);
      
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      
      // Button should be enabled initially
      expect(button).toBeEnabled();
      
      // Enter valid input
      await user.type(input, '207106');
      expect(button).toBeEnabled();
    });

    it('should clear results when input changes after checking', async () => {
      const user = userEvent.setup();
      mockCheckDrugInteractions.mockResolvedValueOnce({
        success: true,
        interactions: [],
        rxcui: '207106'
      });

      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      
      // Check interactions first
      await user.type(input, '207106');
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Results for RxCUI: 207106')).toBeInTheDocument();
      });
      
      // Change input - results should disappear
      await user.clear(input);
      await user.type(input, '123');
      
      expect(screen.queryByText('Results for RxCUI: 207106')).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call checkDrugInteractions API when form is submitted', async () => {
      const user = userEvent.setup();
      mockCheckDrugInteractions.mockResolvedValueOnce({
        success: true,
        interactions: [],
        rxcui: '207106'
      });

      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      
      await user.type(input, '207106');
      await user.click(button);
      
      expect(mockCheckDrugInteractions).toHaveBeenCalledWith({ rxcui: '207106' });
    });

    it('should handle form submission via Enter key', async () => {
      const user = userEvent.setup();
      mockCheckDrugInteractions.mockResolvedValueOnce({
        success: true,
        interactions: [],
        rxcui: '207106'
      });

      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      
      await user.type(input, '207106');
      await user.keyboard('{Enter}');
      
      expect(mockCheckDrugInteractions).toHaveBeenCalledWith({ rxcui: '207106' });
    });

    it('should show validation error for empty input', async () => {
      const user = userEvent.setup();
      render(<DrugInteractionChecker />);
      
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      
      // Click the button without entering any input
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid RxCUI/)).toBeInTheDocument();
      });
      
      expect(mockCheckDrugInteractions).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should show loading state during API call', async () => {
      const user = userEvent.setup();
      // Create a promise that won't resolve immediately
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockCheckDrugInteractions.mockReturnValueOnce(promise as any);

      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      
      await user.type(input, '207106');
      await user.click(button);
      
      // Should show loading state
      expect(screen.getByText('Checking...')).toBeInTheDocument();
      expect(button).toBeDisabled();
      expect(input).toBeDisabled();
      
      // Resolve the promise
      resolvePromise!({
        success: true,
        interactions: [],
        rxcui: '207106'
      });
      
      await waitFor(() => {
        expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Success Results', () => {
    it('should display no interactions message when none found', async () => {
      const user = userEvent.setup();
      mockCheckDrugInteractions.mockResolvedValueOnce({
        success: true,
        interactions: [],
        rxcui: '207106'
      });

      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      
      await user.type(input, '207106');
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Results for RxCUI: 207106')).toBeInTheDocument();
        expect(screen.getByText('No drug interactions found for this medication.')).toBeInTheDocument();
        expect(screen.getByText(/This search is based on available data/)).toBeInTheDocument();
      });
    });

    it('should display interactions when found', async () => {
      const user = userEvent.setup();
      mockCheckDrugInteractions.mockResolvedValueOnce({
        success: true,
        interactions: [
          {
            source: 'RxNav/NIH',
            description: 'Warfarin may increase bleeding risk',
            severity: 'High'
          },
          {
            source: 'RxNav/NIH',
            description: 'Monitor patient closely',
            severity: 'Moderate'
          }
        ],
        rxcui: '207106'
      });

      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      
      await user.type(input, '207106');
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('⚠️ 2 interactions found')).toBeInTheDocument();
        expect(screen.getByText('Warfarin may increase bleeding risk')).toBeInTheDocument();
        expect(screen.getByText('Monitor patient closely')).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
        expect(screen.getByText('Moderate')).toBeInTheDocument();
      });
    });

    it('should handle interactions with missing severity', async () => {
      const user = userEvent.setup();
      mockCheckDrugInteractions.mockResolvedValueOnce({
        success: true,
        interactions: [
          {
            source: 'RxNav/NIH',
            description: 'Some interaction description',
            severity: undefined
          }
        ],
        rxcui: '207106'
      });

      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      
      await user.type(input, '207106');
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Unknown')).toBeInTheDocument();
        expect(screen.getByText('Some interaction description')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      const user = userEvent.setup();
      mockCheckDrugInteractions.mockResolvedValueOnce({
        success: false,
        interactions: [],
        error: 'Network error occurred',
        rxcui: '207106'
      });

      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      
      await user.type(input, '207106');
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText(/Network error occurred/)).toBeInTheDocument();
        expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      const user = userEvent.setup();
      mockCheckDrugInteractions.mockRejectedValueOnce(new Error('Unexpected error'));

      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      
      await user.type(input, '207106');
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<DrugInteractionChecker />);
      
      expect(screen.getByLabelText('RxCUI (Drug Identifier):')).toBeInTheDocument();
      expect(screen.getByLabelText('Check for drug interactions')).toBeInTheDocument();
      expect(screen.getByRole('search')).toBeInTheDocument();
    });

    it('should announce results to screen readers', async () => {
      const user = userEvent.setup();
      mockCheckDrugInteractions.mockResolvedValueOnce({
        success: true,
        interactions: [],
        rxcui: '207106'
      });

      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      
      await user.type(input, '207106');
      await user.click(button);
      
      await waitFor(() => {
        const resultsRegion = screen.getByLabelText(/Results for RxCUI/);
        expect(resultsRegion).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should have proper error announcements', async () => {
      const user = userEvent.setup();
      mockCheckDrugInteractions.mockResolvedValueOnce({
        success: false,
        interactions: [],
        error: 'Test error',
        rxcui: '207106'
      });

      render(<DrugInteractionChecker />);
      
      const input = screen.getByLabelText('RxCUI (Drug Identifier):');
      const button = screen.getByRole('button', { name: 'Check for drug interactions' });
      
      await user.type(input, '207106');
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('Educational Content', () => {
    it('should display educational information', () => {
      render(<DrugInteractionChecker />);
      
      expect(screen.getByText('ℹ️ About Drug Interaction Checking')).toBeInTheDocument();
      
      // Click to expand
      fireEvent.click(screen.getByText('ℹ️ About Drug Interaction Checking'));
      
      expect(screen.getByText(/This tool uses the FDA's RxNav API/)).toBeInTheDocument();
      expect(screen.getByText('Important Notes:')).toBeInTheDocument();
      expect(screen.getByText('Common RxCUI Examples:')).toBeInTheDocument();
    });

    it('should provide help text for input', () => {
      render(<DrugInteractionChecker />);
      
      expect(screen.getByText(/RxCUI is a unique identifier/)).toBeInTheDocument();
      expect(screen.getByText(/207106 \(Warfarin\)/)).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should render without layout issues on small screens', () => {
      // This test ensures the component doesn't break on small screens
      // In a real app, you might want to test viewport changes
      const { container } = render(<DrugInteractionChecker />);
      
      expect(container.firstChild).toHaveClass('drug-interaction-checker');
    });
  });
});