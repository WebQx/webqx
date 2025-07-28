import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoadingIndicator from '../components/PrescriptionForm/LoadingIndicator';
import ErrorHandler from '../components/PrescriptionForm/ErrorHandler';
import { LoadingState, ApiError } from '../components/PrescriptionForm/types';

describe('LoadingIndicator Component', () => {
  it('renders nothing when not loading', () => {
    const loading: LoadingState = {
      isLoading: false,
      loadingMessage: ''
    };

    const { container } = render(<LoadingIndicator loading={loading} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders loading indicator when loading', () => {
    const loading: LoadingState = {
      isLoading: true,
      loadingMessage: 'Loading data...'
    };

    render(<LoadingIndicator loading={loading} />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    const loading: LoadingState = {
      isLoading: true,
      loadingMessage: 'Processing request...'
    };

    render(<LoadingIndicator loading={loading} />);
    
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('shows progress bar when progress is provided', () => {
    const loading: LoadingState = {
      isLoading: true,
      loadingMessage: 'Uploading...',
      progress: 75
    };

    render(<LoadingIndicator loading={loading} showProgress={true} />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    expect(progressBar).toHaveAttribute('aria-label', 'Loading progress: 75%');
  });

  it('applies size classes correctly', () => {
    const loading: LoadingState = {
      isLoading: true,
      loadingMessage: 'Loading...'
    };

    const { rerender, container } = render(
      <LoadingIndicator loading={loading} size="large" />
    );
    
    expect(container.querySelector('.loading-indicator--large')).toBeInTheDocument();

    rerender(<LoadingIndicator loading={loading} size="small" />);
    expect(container.querySelector('.loading-indicator--small')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const loading: LoadingState = {
      isLoading: true,
      loadingMessage: 'Loading...'
    };

    const { container } = render(
      <LoadingIndicator loading={loading} className="custom-loading" />
    );
    
    expect(container.querySelector('.loading-indicator.custom-loading')).toBeInTheDocument();
  });
});

describe('ErrorHandler Component', () => {
  const mockError: ApiError = {
    message: 'Test error message',
    code: 'TEST_ERROR',
    retryable: true
  };

  const mockOnRetry = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when no error', () => {
    const { container } = render(
      <ErrorHandler 
        error={null}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('renders error message when error is provided', () => {
    render(
      <ErrorHandler 
        error={mockError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('shows retry button for retryable errors', () => {
    render(
      <ErrorHandler 
        error={mockError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );
    
    const retryButton = screen.getByRole('button', { name: /Try again/ });
    expect(retryButton).toBeInTheDocument();
  });

  it('hides retry button for non-retryable errors', () => {
    const nonRetryableError: ApiError = {
      ...mockError,
      retryable: false
    };

    render(
      <ErrorHandler 
        error={nonRetryableError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );
    
    expect(screen.queryByRole('button', { name: /Try again/ })).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ErrorHandler 
        error={mockError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );
    
    const retryButton = screen.getByRole('button', { name: /Try again/ });
    await user.click(retryButton);
    
    expect(mockOnRetry).toHaveBeenCalled();
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ErrorHandler 
        error={mockError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );
    
    const dismissButton = screen.getByRole('button', { name: /Dismiss error/ });
    await user.click(dismissButton);
    
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('shows retrying state when isRetrying is true', () => {
    render(
      <ErrorHandler 
        error={mockError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
        isRetrying={true}
      />
    );
    
    const retryButton = screen.getByRole('button', { name: /Retrying/ });
    expect(retryButton).toBeDisabled();
    expect(screen.getByText('Retrying...')).toBeInTheDocument();
  });

  it('shows error details when showDetails is true', async () => {
    const user = userEvent.setup();
    render(
      <ErrorHandler 
        error={mockError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
        showDetails={true}
      />
    );
    
    const detailsToggle = screen.getByRole('button', { name: /Show technical details/ });
    expect(detailsToggle).toBeInTheDocument();
    
    await user.click(detailsToggle);
    
    expect(screen.getByText('Error Code:')).toBeInTheDocument();
    expect(screen.getByText(mockError.code)).toBeInTheDocument();
    expect(screen.getByText('Retryable:')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <ErrorHandler 
        error={mockError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );
    
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('disables buttons when retrying', () => {
    render(
      <ErrorHandler 
        error={mockError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
        isRetrying={true}
      />
    );
    
    const retryButton = screen.getByRole('button', { name: /Retrying/ });
    const dismissButton = screen.getByRole('button', { name: /Dismiss error/ });
    
    expect(retryButton).toBeDisabled();
    expect(dismissButton).toBeDisabled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ErrorHandler 
        error={mockError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
        className="custom-error"
      />
    );
    
    expect(container.querySelector('.error-handler.custom-error')).toBeInTheDocument();
  });

  it('shows appropriate help text based on error type', () => {
    render(
      <ErrorHandler 
        error={mockError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );
    
    expect(screen.getByText(/This error can be retried/)).toBeInTheDocument();
    
    const nonRetryableError: ApiError = {
      ...mockError,
      retryable: false
    };

    const { rerender } = render(
      <ErrorHandler 
        error={nonRetryableError}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );
    
    expect(screen.getByText(/If this problem persists/)).toBeInTheDocument();
  });
});