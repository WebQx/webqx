import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardiologyIntake } from '../components/CardiologyIntake';

// Mock the external dependencies
jest.mock('@/modules/transcription/hooks/useWhisper', () => ({
  useWhisper: () => ({
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    transcript: "Patient reports chest pain and shortness of breath.",
    isRecording: false,
    error: null
  })
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: "test-user-123",
      name: "Dr. Test",
      email: "test@example.com",
      role: "physician",
      specialty: "cardiology"
    },
    roleVerified: true,
    isLoading: false,
    error: null
  })
}));

jest.mock('@/auth/logging/logger', () => ({
  useAuditLog: () => jest.fn()
}));

jest.mock('@/ehr-integrations/openemr/api', () => ({
  saveToEHR: jest.fn().mockResolvedValue({
    success: true,
    noteId: 'test-note-123',
    message: 'Note saved successfully'
  })
}));

describe('CardiologyIntake Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  test('renders correctly with all essential elements', () => {
    render(<CardiologyIntake />);
    
    // Check for main heading
    expect(screen.getByText('❤️ Cardiology Intake')).toBeInTheDocument();
    
    // Check for microphone button with proper aria-label
    expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
    
    // Check for submit button
    expect(screen.getByLabelText('Submit note')).toBeInTheDocument();
    
    // Check for note preview section
    expect(screen.getByText('📝 Note Preview')).toBeInTheDocument();
  });

  test('displays transcript in note preview', () => {
    render(<CardiologyIntake />);
    
    // Should show the mocked transcript
    expect(screen.getByText('Patient reports chest pain and shortness of breath.')).toBeInTheDocument();
  });

  test('submit button has correct accessibility attributes', () => {
    render(<CardiologyIntake />);
    
    const submitButton = screen.getByLabelText('Submit note');
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute('aria-label', 'Submit note');
  });

  test('microphone button has correct accessibility attributes', () => {
    render(<CardiologyIntake />);
    
    const micButton = screen.getByLabelText('Start recording');
    expect(micButton).toBeInTheDocument();
    expect(micButton).toHaveAttribute('aria-label', 'Start recording');
  });

  test('shows loading state when submitting', async () => {
    render(<CardiologyIntake />);
    
    const submitButton = screen.getByLabelText('Submit note');
    fireEvent.click(submitButton);
    
    // Should show loading state briefly
    await waitFor(() => {
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
    });
  });
});