import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VoiceTranscription from '../components/VoiceTranscription';
import { whisperService } from '../../services/whisperService';

// Mock the whisperService
jest.mock('../../services/whisperService', () => ({
  whisperService: {
    validateFile: jest.fn(),
    transcribeAudio: jest.fn(),
    onLoadingStateChange: jest.fn(() => () => {}) // Return unsubscribe function
  }
}));

const mockWhisperService = whisperService as jest.Mocked<typeof whisperService>;

describe('VoiceTranscription Component', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders voice transcription interface', () => {
    render(<VoiceTranscription />);
    
    expect(screen.getByText('🎤 Voice Transcription')).toBeInTheDocument();
    expect(screen.getByText('Upload an audio file to convert speech to text')).toBeInTheDocument();
    expect(screen.getByLabelText('Choose Audio File')).toBeInTheDocument();
    expect(screen.getByText('Supported formats: MP3, MP4, WAV, WebM, OGG, FLAC, M4A (max 25MB)')).toBeInTheDocument();
  });

  it('handles successful file transcription', async () => {
    const mockFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
    const mockOnComplete = jest.fn();

    mockWhisperService.validateFile.mockReturnValue({ isValid: true });
    mockWhisperService.transcribeAudio.mockResolvedValue({
      text: 'Hello, this is a test transcription.',
      duration: 5.2,
      language: 'en'
    });

    render(<VoiceTranscription onTranscriptionComplete={mockOnComplete} />);
    
    const fileInput = screen.getByLabelText('Choose Audio File') as HTMLInputElement;
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText('📝 Transcription Result')).toBeInTheDocument();
      expect(screen.getByText('Hello, this is a test transcription.')).toBeInTheDocument();
    });

    expect(mockOnComplete).toHaveBeenCalledWith('Hello, this is a test transcription.');
  });

  it('handles file validation errors', async () => {
    const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    const mockOnError = jest.fn();

    mockWhisperService.validateFile.mockReturnValue({
      isValid: false,
      error: 'Unsupported file type'
    });

    render(<VoiceTranscription onError={mockOnError} />);
    
    const fileInput = screen.getByLabelText('Choose Audio File') as HTMLInputElement;
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText('❌ Error:')).toBeInTheDocument();
      expect(screen.getByText(/Unsupported file type/)).toBeInTheDocument();
    });

    expect(mockOnError).toHaveBeenCalledWith('Unsupported file type');
  });

  it('handles transcription errors', async () => {
    const mockFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
    const mockOnError = jest.fn();

    mockWhisperService.validateFile.mockReturnValue({ isValid: true });
    mockWhisperService.transcribeAudio.mockRejectedValue({
      message: 'Network error',
      code: 'NETWORK_ERROR'
    });

    render(<VoiceTranscription onError={mockOnError} />);
    
    const fileInput = screen.getByLabelText('Choose Audio File') as HTMLInputElement;
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText('❌ Error:')).toBeInTheDocument();
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    expect(mockOnError).toHaveBeenCalledWith('Network error');
  });

  it('clears results when clear button is clicked', async () => {
    const mockFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });

    mockWhisperService.validateFile.mockReturnValue({ isValid: true });
    mockWhisperService.transcribeAudio.mockResolvedValue({
      text: 'Test transcription text',
      duration: 3.0,
      language: 'en'
    });

    render(<VoiceTranscription />);
    
    const fileInput = screen.getByLabelText('Choose Audio File') as HTMLInputElement;
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText('Test transcription text')).toBeInTheDocument();
    });

    const clearButton = screen.getByLabelText('Clear transcription results');
    fireEvent.click(clearButton);

    expect(screen.queryByText('Test transcription text')).not.toBeInTheDocument();
    expect(screen.queryByText('📝 Transcription Result')).not.toBeInTheDocument();
  });

  it('subscribes to loading state changes on mount', () => {
    render(<VoiceTranscription />);
    
    expect(mockWhisperService.onLoadingStateChange).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });

  it('provides accessibility features', () => {
    render(<VoiceTranscription />);
    
    // Check for proper ARIA labels and roles
    expect(screen.getByRole('region', { name: 'Voice Transcription Tool' })).toBeInTheDocument();
    expect(screen.getByLabelText('Choose Audio File')).toBeInTheDocument();
    expect(screen.getByText('Supported formats: MP3, MP4, WAV, WebM, OGG, FLAC, M4A (max 25MB)')).toHaveAttribute('id', 'file-help');
  });
});