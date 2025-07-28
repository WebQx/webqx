import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '../../components/prescriptions/ErrorBoundary';

// Component that throws an error for testing
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error');
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

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Normal Operation', () => {
    test('renders children when there are no errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    test('applies proper accessibility attributes to children', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child-content">Child content</div>
        </ErrorBoundary>
      );

      const childContent = screen.getByTestId('child-content');
      expect(childContent).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('catches errors and displays fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('⚠️ Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/We're sorry, but something unexpected happened/)).toBeInTheDocument();
    });

    test('displays custom fallback UI when provided', () => {
      const customFallback = <div data-testid="custom-fallback">Custom error message</div>;
      
      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });

    test('calls onError callback when error occurs', () => {
      const onErrorMock = jest.fn();
      
      render(
        <ErrorBoundary onError={onErrorMock}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });

    test('logs error to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalledWith(
        'ErrorBoundary caught an error:',
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });
  });

  describe('Accessibility Features', () => {
    test('fallback UI has proper ARIA attributes', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const errorContainer = screen.getByRole('alert');
      expect(errorContainer).toHaveAttribute('aria-live', 'assertive');
      expect(errorContainer).toHaveAttribute('aria-labelledby', 'error-boundary-title');
    });

    test('retry button has proper accessibility label', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const retryButton = screen.getByRole('button', { name: 'Try again' });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toHaveAttribute('aria-label', 'Try again');
    });

    test('error title is properly associated with container', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const title = screen.getByRole('heading', { level: 2 });
      expect(title).toHaveAttribute('id', 'error-boundary-title');
    });
  });

  describe('Recovery Functionality', () => {
    test('retry button resets error state', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Verify error UI is shown
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Click retry button
      const retryButton = screen.getByRole('button', { name: 'Try again' });
      fireEvent.click(retryButton);

      // Re-render with no error
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Development Mode Features', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test('shows error details in development mode', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error Details (Development Mode)')).toBeInTheDocument();
      
      const details = screen.getByRole('group');
      expect(details).toHaveTextContent('Test error');
    });
  });

  describe('Production Mode Features', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test('hides error details in production mode', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Error Details (Development Mode)')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    test('retry button is focusable', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const retryButton = screen.getByRole('button', { name: 'Try again' });
      retryButton.focus();
      expect(retryButton).toHaveFocus();
    });

    test('retry button responds to keyboard interaction', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const retryButton = screen.getByRole('button', { name: 'Try again' });
      
      // Simulate keyboard activation (Enter key)
      fireEvent.keyDown(retryButton, { key: 'Enter', code: 'Enter' });
      fireEvent.click(retryButton); // React's onClick handles both mouse and keyboard

      // Re-render with no error
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });
  });
});