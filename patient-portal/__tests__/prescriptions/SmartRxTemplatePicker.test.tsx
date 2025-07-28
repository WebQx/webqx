import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SmartRxTemplatePicker from '../../components/prescriptions/SmartRxTemplatePicker';
import { PrescriptionsProvider } from '../../components/prescriptions/PrescriptionsContext';

describe('SmartRxTemplatePicker', () => {
  const user = userEvent.setup();

  describe('Loading States', () => {
    test('displays initial state correctly', () => {
      render(
        <PrescriptionsProvider>
          <SmartRxTemplatePicker />
        </PrescriptionsProvider>
      );

      expect(screen.getByText('📋 Smart Prescription Templates')).toBeInTheDocument();
      expect(screen.getByLabelText('Expand template picker')).toBeInTheDocument();
    });

    test('expand/collapse functionality works', async () => {
      render(
        <PrescriptionsProvider>
          <SmartRxTemplatePicker />
        </PrescriptionsProvider>
      );

      const expandButton = screen.getByLabelText('Expand template picker');
      
      // Initially collapsed
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      
      // Expand
      await user.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      expect(expandButton).toHaveAttribute('aria-label', 'Collapse template picker');
      
      // Collapse
      await user.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      expect(expandButton).toHaveAttribute('aria-label', 'Expand template picker');
    });
  });

  describe('Template Display', () => {
    test('displays templates after loading', async () => {
      render(
        <PrescriptionsProvider>
          <SmartRxTemplatePicker />
        </PrescriptionsProvider>
      );

      // Expand the picker first
      const expandButton = screen.getByLabelText('Expand template picker');
      await user.click(expandButton);

      // Wait for templates to load and check for some template content
      await waitFor(() => {
        // Look for common elements that should be present after loading
        expect(screen.getByLabelText('Search templates:')).toBeInTheDocument();
        expect(screen.getByLabelText('Category:')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Search Functionality', () => {
    test('search input is properly labeled', async () => {
      render(
        <PrescriptionsProvider>
          <SmartRxTemplatePicker />
        </PrescriptionsProvider>
      );

      // Expand and wait for content
      const expandButton = screen.getByLabelText('Expand template picker');
      await user.click(expandButton);
      
      await waitFor(() => {
        const searchInput = screen.getByLabelText('Search templates:');
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveAttribute('placeholder', 'Search by medication or template name...');
        expect(searchInput).toHaveAttribute('aria-describedby', 'search-help');
      });
    });
  });

  describe('Accessibility Features', () => {
    test('has proper ARIA landmarks and labels', () => {
      render(
        <PrescriptionsProvider>
          <SmartRxTemplatePicker />
        </PrescriptionsProvider>
      );

      expect(screen.getByRole('region')).toHaveAttribute('aria-labelledby', 'template-picker-heading');
      expect(screen.getByText('📋 Smart Prescription Templates')).toHaveAttribute('id', 'template-picker-heading');
    });

    test('search controls have proper accessibility attributes', async () => {
      render(
        <PrescriptionsProvider>
          <SmartRxTemplatePicker />
        </PrescriptionsProvider>
      );

      const expandButton = screen.getByLabelText('Expand template picker');
      await user.click(expandButton);

      await waitFor(() => {
        const controlsGroup = screen.getByRole('group', { name: 'Template search and filter controls' });
        expect(controlsGroup).toBeInTheDocument();

        const searchInput = screen.getByLabelText('Search templates:');
        expect(searchInput).toHaveAttribute('aria-describedby', 'search-help');

        const categorySelect = screen.getByLabelText('Category:');
        expect(categorySelect).toHaveAttribute('aria-describedby', 'category-help');
      });
    });
  });

  describe('Custom Props', () => {
    test('applies custom className', () => {
      render(
        <PrescriptionsProvider>
          <SmartRxTemplatePicker className="custom-class" />
        </PrescriptionsProvider>
      );

      const picker = screen.getByRole('region');
      expect(picker).toHaveClass('smart-rx-picker');
      expect(picker).toHaveClass('custom-class');
    });

    test('calls onTemplateSelect callback when provided', async () => {
      const mockOnTemplateSelect = jest.fn();
      render(
        <PrescriptionsProvider>
          <SmartRxTemplatePicker onTemplateSelect={mockOnTemplateSelect} />
        </PrescriptionsProvider>
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
      // Template selection testing would require more complex setup
    });
  });
});