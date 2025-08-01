import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import EnhancedVoiceTranscription from '../components/EnhancedVoiceTranscription';

// Mock services
jest.mock('../../services/whisperService', () => ({
  whisperService: {
    validateFile: jest.fn(),
    transcribeAudio: jest.fn(),
    onLoadingStateChange: jest.fn(() => () => {})
  }
}));

jest.mock('../../services/whisperStreamingService', () => ({
  WhisperStreamingService: jest.fn().mockImplementation(() => ({
    startTranscription: jest.fn(),
    stopTranscription: jest.fn(),
    getState: jest.fn(() => ({ isRecording: false, isProcessing: false, chunksBuffered: 0 }))
  }))
}));

jest.mock('../prescriptions/services/whisperTranslator', () => ({
  whisperTranslator: {
    getSupportedLanguages: jest.fn(() => [
      { code: 'en', name: 'English', nativeName: 'English', rtl: false },
      { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false },
      { code: 'fr', name: 'French', nativeName: 'Français', rtl: false }
    ]),
    detectLanguage: jest.fn(() => Promise.resolve({ language: 'en', confidence: 0.9 })),
    translate: jest.fn(() => Promise.resolve({ 
      originalText: 'Hello',
      translatedText: 'Hola',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      confidence: 0.9
    }))
  }
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
});

describe('EnhancedVoiceTranscription', () => {
  const mockOnTranscriptionComplete = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('should render file upload mode by default', () => {
      render(<EnhancedVoiceTranscription />);
      
      expect(screen.getByText('🎤 Voice Transcription')).toBeInTheDocument();
      expect(screen.getByLabelText('Choose Audio File')).toBeInTheDocument();
      expect(screen.getByText(/Supported formats/)).toBeInTheDocument();
    });

    test('should render with real-time mode enabled', () => {
      render(<EnhancedVoiceTranscription enableRealTime={true} />);
      
      expect(screen.getByText('📁 File Upload')).toBeInTheDocument();
      expect(screen.getByText('🎙️ Real-time')).toBeInTheDocument();
    });

    test('should render with multilingual support', () => {
      render(<EnhancedVoiceTranscription enableMultilingual={true} />);
      
      expect(screen.getByLabelText('Select transcription language')).toBeInTheDocument();
      expect(screen.getByText('Auto-detect')).toBeInTheDocument();
    });

    test('should render with accessibility features', () => {
      render(<EnhancedVoiceTranscription enableAccessibility={true} />);
      
      const region = screen.getByRole('region', { name: 'Enhanced Voice Transcription Tool' });
      expect(region).toBeInTheDocument();
      
      // Check for screen reader announcements element
      const srElement = region.querySelector('.sr-only');
      expect(srElement).toBeInTheDocument();
    });
  });

  describe('File Upload Functionality', () => {
    test('should handle file upload', async () => {
      const { whisperService } = require('../../services/whisperService');
      whisperService.validateFile.mockReturnValue({ isValid: true });
      whisperService.transcribeAudio.mockResolvedValue({
        text: 'Test transcription',
        confidence: 0.95,
        language: 'en'
      });

      const user = userEvent.setup();
      render(
        <EnhancedVoiceTranscription 
          onTranscriptionComplete={mockOnTranscriptionComplete}
        />
      );

      const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText('Choose Audio File');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(whisperService.validateFile).toHaveBeenCalledWith(file);
        expect(whisperService.transcribeAudio).toHaveBeenCalledWith(
          file,
          expect.objectContaining({
            prompt: expect.stringContaining('Medical consultation'),
            temperature: 0.1
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Test transcription')).toBeInTheDocument();
        expect(mockOnTranscriptionComplete).toHaveBeenCalledWith('Test transcription', 'en');
      });
    });

    test('should handle file validation errors', async () => {
      const { whisperService } = require('../../services/whisperService');
      whisperService.validateFile.mockReturnValue({ 
        isValid: false, 
        error: 'Invalid file type' 
      });

      const user = userEvent.setup();
      render(
        <EnhancedVoiceTranscription 
          onError={mockOnError}
        />
      );

      const file = new File(['text data'], 'test.txt', { type: 'text/plain' });
      const fileInput = screen.getByLabelText('Choose Audio File');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid file type');
        expect(mockOnError).toHaveBeenCalledWith('Invalid file type');
      });
    });

    test('should handle transcription errors', async () => {
      const { whisperService } = require('../../services/whisperService');
      whisperService.validateFile.mockReturnValue({ isValid: true });
      whisperService.transcribeAudio.mockRejectedValue({
        message: 'API Error',
        code: 'NETWORK_ERROR'
      });

      const user = userEvent.setup();
      render(
        <EnhancedVoiceTranscription 
          onError={mockOnError}
        />
      );

      const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText('Choose Audio File');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('API Error');
        expect(mockOnError).toHaveBeenCalledWith('API Error');
      });
    });
  });

  describe('Real-time Transcription', () => {
    test('should switch to real-time mode', async () => {
      const user = userEvent.setup();
      render(<EnhancedVoiceTranscription enableRealTime={true} />);

      const realtimeTab = screen.getByText('🎙️ Real-time');
      await user.click(realtimeTab);

      expect(screen.getByText('🎤 Start Recording')).toBeInTheDocument();
    });

    test('should start real-time transcription', async () => {
      const { WhisperStreamingService } = require('../../services/whisperStreamingService');
      const mockService = {
        startTranscription: jest.fn(),
        stopTranscription: jest.fn(),
        getState: jest.fn(() => ({ isRecording: false }))
      };
      WhisperStreamingService.mockImplementation(() => mockService);

      // Mock getUserMedia
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: jest.fn().mockResolvedValue(new MediaStream())
        },
        writable: true
      });

      const user = userEvent.setup();
      render(<EnhancedVoiceTranscription enableRealTime={true} />);

      // Switch to real-time mode
      await user.click(screen.getByText('🎙️ Real-time'));
      
      // Start recording
      const startButton = screen.getByText('🎤 Start Recording');
      await user.click(startButton);

      await waitFor(() => {
        expect(mockService.startTranscription).toHaveBeenCalled();
      });
    });

    test('should show audio visualization when enabled', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedVoiceTranscription 
          enableRealTime={true} 
          enableVisualization={true}
        />
      );

      await user.click(screen.getByText('🎙️ Real-time'));
      
      // Visualization should not be visible when not recording
      expect(screen.queryByText('🔇 Silent')).not.toBeInTheDocument();
    });
  });

  describe('Multilingual Support', () => {
    test('should show language selector when multilingual is enabled', () => {
      render(<EnhancedVoiceTranscription enableMultilingual={true} />);
      
      const languageSelect = screen.getByLabelText('Select transcription language');
      expect(languageSelect).toBeInTheDocument();
      
      expect(screen.getByText('Auto-detect')).toBeInTheDocument();
      expect(screen.getByText('English (English)')).toBeInTheDocument();
      expect(screen.getByText('Spanish (Español)')).toBeInTheDocument();
    });

    test('should handle language detection and translation', async () => {
      const { whisperService } = require('../../services/whisperService');
      const { whisperTranslator } = require('../../prescriptions/services/whisperTranslator');
      
      whisperService.validateFile.mockReturnValue({ isValid: true });
      whisperService.transcribeAudio.mockResolvedValue({
        text: 'Hello world',
        confidence: 0.95,
        language: 'en'
      });

      const user = userEvent.setup();
      render(
        <EnhancedVoiceTranscription 
          enableMultilingual={true}
          targetLanguage="es"
          onTranscriptionComplete={mockOnTranscriptionComplete}
        />
      );

      const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText('Choose Audio File');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(whisperTranslator.detectLanguage).toHaveBeenCalledWith('Hello world');
        expect(whisperTranslator.translate).toHaveBeenCalledWith('Hello world', 'en', 'es');
      });

      await waitFor(() => {
        expect(screen.getByText('Hello world')).toBeInTheDocument();
        expect(screen.getByText('🌐 Translation (es):')).toBeInTheDocument();
        expect(screen.getByText('Hola')).toBeInTheDocument();
      });
    });

    test('should change language selection', async () => {
      const user = userEvent.setup();
      render(<EnhancedVoiceTranscription enableMultilingual={true} />);
      
      const languageSelect = screen.getByLabelText('Select transcription language');
      await user.selectOptions(languageSelect, 'es');
      
      expect(languageSelect).toHaveValue('es');
    });
  });

  describe('Medical Specialty Support', () => {
    test('should use specialty-specific medical prompts', async () => {
      const { whisperService } = require('../../services/whisperService');
      whisperService.validateFile.mockReturnValue({ isValid: true });
      whisperService.transcribeAudio.mockResolvedValue({
        text: 'Patient has hypertension',
        confidence: 0.95
      });

      const user = userEvent.setup();
      render(<EnhancedVoiceTranscription medicalSpecialty="cardiology" />);

      const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText('Choose Audio File');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(whisperService.transcribeAudio).toHaveBeenCalledWith(
          file,
          expect.objectContaining({
            prompt: expect.stringContaining('Cardiology consultation'),
            temperature: 0.1
          })
        );
      });
    });
  });

  describe('User Actions', () => {
    test('should clear transcription results', async () => {
      const { whisperService } = require('../../services/whisperService');
      whisperService.validateFile.mockReturnValue({ isValid: true });
      whisperService.transcribeAudio.mockResolvedValue({
        text: 'Test transcription',
        confidence: 0.95
      });

      const user = userEvent.setup();
      render(<EnhancedVoiceTranscription />);

      // Upload file and get transcription
      const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText('Choose Audio File');
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Test transcription')).toBeInTheDocument();
      });

      // Clear results
      const clearButton = screen.getByLabelText('Clear transcription results');
      await user.click(clearButton);

      expect(screen.queryByText('Test transcription')).not.toBeInTheDocument();
    });

    test('should copy transcription to clipboard', async () => {
      const { whisperService } = require('../../services/whisperService');
      whisperService.validateFile.mockReturnValue({ isValid: true });
      whisperService.transcribeAudio.mockResolvedValue({
        text: 'Test transcription',
        confidence: 0.95
      });

      const user = userEvent.setup();
      render(<EnhancedVoiceTranscription />);

      // Upload file and get transcription
      const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText('Choose Audio File');
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Test transcription')).toBeInTheDocument();
      });

      // Copy to clipboard
      const copyButton = screen.getByLabelText('Copy transcription to clipboard');
      await user.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test transcription');
    });

    test('should copy translation to clipboard', async () => {
      const { whisperService } = require('../../services/whisperService');
      whisperService.validateFile.mockReturnValue({ isValid: true });
      whisperService.transcribeAudio.mockResolvedValue({
        text: 'Hello world',
        confidence: 0.95,
        language: 'en'
      });

      const user = userEvent.setup();
      render(
        <EnhancedVoiceTranscription 
          enableMultilingual={true}
          targetLanguage="es"
        />
      );

      // Upload file and get transcription with translation
      const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText('Choose Audio File');
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Hola')).toBeInTheDocument();
      });

      // Copy translation to clipboard
      const copyTranslationButton = screen.getByLabelText('Copy translation to clipboard');
      await user.click(copyTranslationButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hola');
    });
  });

  describe('Transcription History', () => {
    test('should show transcription history after multiple transcriptions', async () => {
      const { whisperService } = require('../../services/whisperService');
      whisperService.validateFile.mockReturnValue({ isValid: true });
      whisperService.transcribeAudio
        .mockResolvedValueOnce({
          text: 'First transcription',
          confidence: 0.95,
          language: 'en'
        })
        .mockResolvedValueOnce({
          text: 'Second transcription',
          confidence: 0.90,
          language: 'en'
        });

      const user = userEvent.setup();
      render(<EnhancedVoiceTranscription />);

      // First transcription
      const file1 = new File(['audio data 1'], 'test1.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText('Choose Audio File');
      await user.upload(fileInput, file1);

      await waitFor(() => {
        expect(screen.getByText('First transcription')).toBeInTheDocument();
      });

      // Second transcription
      const file2 = new File(['audio data 2'], 'test2.wav', { type: 'audio/wav' });
      await user.upload(fileInput, file2);

      await waitFor(() => {
        expect(screen.getByText('Second transcription')).toBeInTheDocument();
      });

      // Check history
      const historyToggle = screen.getByText(/Recent Transcriptions/);
      expect(historyToggle).toBeInTheDocument();
      
      await user.click(historyToggle);
      
      expect(screen.getByText('First transcription')).toBeInTheDocument();
      expect(screen.getByText('Second transcription')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should provide proper ARIA labels and roles', () => {
      render(<EnhancedVoiceTranscription enableAccessibility={true} />);
      
      expect(screen.getByRole('region', { name: 'Enhanced Voice Transcription Tool' })).toBeInTheDocument();
      expect(screen.getByLabelText('Choose Audio File')).toBeInTheDocument();
      expect(screen.getByText(/Supported formats/)).toHaveAttribute('id', 'file-help');
    });

    test('should announce transcription results to screen readers', async () => {
      const { whisperService } = require('../../services/whisperService');
      whisperService.validateFile.mockReturnValue({ isValid: true });
      whisperService.transcribeAudio.mockResolvedValue({
        text: 'Test transcription',
        confidence: 0.95,
        language: 'en'
      });

      const user = userEvent.setup();
      render(<EnhancedVoiceTranscription enableAccessibility={true} />);

      const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText('Choose Audio File');
      await user.upload(fileInput, file);

      await waitFor(() => {
        const liveRegion = document.querySelector('.sr-only');
        expect(liveRegion).toHaveTextContent('Transcription completed. Detected language: en');
      });
    });
  });

  describe('Error Handling', () => {
    test('should display loading state during transcription', async () => {
      const { whisperService } = require('../../services/whisperService');
      whisperService.validateFile.mockReturnValue({ isValid: true });
      
      // Mock loading state
      whisperService.onLoadingStateChange.mockImplementation((callback: any) => {
        setTimeout(() => {
          callback({ isLoading: true, message: 'Processing...', progress: 50 });
        }, 100);
        return () => {};
      });

      whisperService.transcribeAudio.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          text: 'Test transcription',
          confidence: 0.95
        }), 1000))
      );

      const user = userEvent.setup();
      render(<EnhancedVoiceTranscription />);

      const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText('Choose Audio File');
      await user.upload(fileInput, file);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    test('should handle missing clipboard API gracefully', async () => {
      // Remove clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true
      });

      const { whisperService } = require('../../services/whisperService');
      whisperService.validateFile.mockReturnValue({ isValid: true });
      whisperService.transcribeAudio.mockResolvedValue({
        text: 'Test transcription',
        confidence: 0.95
      });

      const user = userEvent.setup();
      render(<EnhancedVoiceTranscription enableAccessibility={true} />);

      // Upload file and get transcription
      const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText('Choose Audio File');
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Test transcription')).toBeInTheDocument();
      });

      // Try to copy to clipboard
      const copyButton = screen.getByLabelText('Copy transcription to clipboard');
      await user.click(copyButton);

      // Should announce failure to screen reader
      await waitFor(() => {
        const liveRegion = document.querySelector('.sr-only');
        expect(liveRegion).toHaveTextContent('Failed to copy text');
      });
    });
  });
});