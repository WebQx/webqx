/**
 * @fileoverview Tests for OttehrVoiceTranscription component
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { OttehrVoiceTranscription } from '../OttehrVoiceTranscription';
import { WhisperOttehrIntegration } from '../../../services/whisperOttehrIntegration';

// Mock the integration service
jest.mock('../../../services/whisperOttehrIntegration');

const MockedWhisperOttehrIntegration = WhisperOttehrIntegration as jest.MockedClass<typeof WhisperOttehrIntegration>;

// Mock media devices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn()
  },
  writable: true
});

// Mock clipboard API
const mockClipboard = {
  writeText: jest.fn()
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  configurable: true
});

// Mock MediaRecorder
(global as any).MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  ondataavailable: null,
  onstop: null,
  state: 'inactive',
  mimeType: 'audio/webm'
}));
(global as any).MediaRecorder.isTypeSupported = jest.fn().mockReturnValue(true);

// Mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  createAnalyser: jest.fn(() => ({
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: jest.fn()
  })),
  createMediaStreamSource: jest.fn(() => ({
    connect: jest.fn()
  })),
  close: jest.fn()
}));

describe('OttehrVoiceTranscription', () => {
  let mockIntegration: jest.Mocked<WhisperOttehrIntegration>;
  let mockUserMedia: jest.MockedFunction<typeof navigator.mediaDevices.getUserMedia>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock integration instance
    mockIntegration = {
      transcribeWithHealthcareContext: jest.fn(),
      createOrderWithTranscription: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      destroy: jest.fn()
    } as any;

    MockedWhisperOttehrIntegration.mockImplementation(() => mockIntegration);

    // Mock getUserMedia
    mockUserMedia = navigator.mediaDevices.getUserMedia as jest.MockedFunction<typeof navigator.mediaDevices.getUserMedia>;
    mockUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    } as any);

    // Reset clipboard mock
    mockClipboard.writeText.mockClear();
    mockClipboard.writeText.mockResolvedValue(undefined);
  });

  describe('Component Rendering', () => {
    it('should render with default props', () => {
      render(<OttehrVoiceTranscription />);
      
      expect(screen.getByText('🎤 Healthcare Voice Transcription')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/upload audio file/i)).toBeInTheDocument();
    });

    it('should display patient context when provided', () => {
      render(
        <OttehrVoiceTranscription
          patientId="patient-123"
          encounterType="consultation"
          specialty="cardiology"
        />
      );
      
      expect(screen.getByText('Patient: patient-123')).toBeInTheDocument();
      expect(screen.getByText('Type: consultation')).toBeInTheDocument();
      expect(screen.getByText('Specialty: cardiology')).toBeInTheDocument();
    });

    it('should show compliance notice', () => {
      render(<OttehrVoiceTranscription />);
      
      expect(screen.getByText(/HIPAA compliant processing/i)).toBeInTheDocument();
    });

    it('should apply custom className and aria-label', () => {
      const { container } = render(
        <OttehrVoiceTranscription
          className="custom-class"
          ariaLabel="Custom voice transcription"
        />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
      expect(screen.getByLabelText('Custom voice transcription')).toBeInTheDocument();
    });
  });

  describe('Integration Service Setup', () => {
    it('should initialize integration service with config', () => {
      const config = {
        whisper: { timeout: 60000 },
        ottehr: { apiKey: 'test-key' }
      };

      render(<OttehrVoiceTranscription integrationConfig={config} />);
      
      expect(MockedWhisperOttehrIntegration).toHaveBeenCalledWith(config);
    });

    it('should set up event listeners on integration service', () => {
      render(<OttehrVoiceTranscription />);
      
      expect(mockIntegration.on).toHaveBeenCalledWith('transcriptionCompleted', expect.any(Function));
      expect(mockIntegration.on).toHaveBeenCalledWith('transcriptionError', expect.any(Function));
      expect(mockIntegration.on).toHaveBeenCalledWith('whisperLoadingStateChanged', expect.any(Function));
      expect(mockIntegration.on).toHaveBeenCalledWith('orderWithTranscriptionCreated', expect.any(Function));
    });

    it('should clean up on unmount', () => {
      const { unmount } = render(<OttehrVoiceTranscription />);
      
      unmount();
      
      expect(mockIntegration.removeAllListeners).toHaveBeenCalled();
      expect(mockIntegration.destroy).toHaveBeenCalled();
    });
  });

  describe('File Upload', () => {
    it('should handle audio file upload', async () => {
      const user = userEvent.setup();
      render(<OttehrVoiceTranscription patientId="patient-123" specialty="cardiology" />);
      
      const file = new File(['audio content'], 'test.wav', { type: 'audio/wav' });
      const fileInput = screen.getByLabelText(/upload audio file/i);
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(mockIntegration.transcribeWithHealthcareContext).toHaveBeenCalledWith({
          audioFile: file,
          patientId: 'patient-123',
          encounterType: 'consultation',
          specialty: 'cardiology',
          targetLanguage: undefined,
          customPrompt: undefined
        });
      });
    });
  });

  describe('Transcription Results', () => {
    const mockResult = {
      text: 'The patient is experiencing chest pain and shortness of breath.',
      language: 'en',
      confidence: 0.95,
      specialty: 'cardiology',
      medicalTerms: ['chest pain', 'shortness of breath'],
      medicalConfidence: 0.88,
      patientContext: {
        patientId: 'patient-123',
        encounterType: 'consultation' as const,
        timestamp: '2024-01-01T00:00:00Z'
      }
    };

    it('should display transcription results', () => {
      const onTranscriptionComplete = jest.fn();
      render(<OttehrVoiceTranscription onTranscriptionComplete={onTranscriptionComplete} />);
      
      // Simulate transcription completion
      act(() => {
        const callback = mockIntegration.on.mock.calls.find(call => call[0] === 'transcriptionCompleted')?.[1];
        callback?.(mockResult);
      });

      expect(screen.getByText(mockResult.text)).toBeInTheDocument();
      expect(screen.getByText('Language: EN')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 95%')).toBeInTheDocument();
      expect(screen.getByText('Medical Terms: 2')).toBeInTheDocument();
      expect(screen.getByText('Specialty: cardiology')).toBeInTheDocument();
      expect(onTranscriptionComplete).toHaveBeenCalledWith(mockResult);
    });

    it('should display medical terms', () => {
      render(<OttehrVoiceTranscription />);
      
      act(() => {
        const callback = mockIntegration.on.mock.calls.find(call => call[0] === 'transcriptionCompleted')?.[1];
        callback?.(mockResult);
      });

      expect(screen.getByText('Detected Medical Terms:')).toBeInTheDocument();
      expect(screen.getByText('chest pain')).toBeInTheDocument();
      expect(screen.getByText('shortness of breath')).toBeInTheDocument();
    });

    it.skip('should copy text to clipboard', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<OttehrVoiceTranscription />);
      
      act(() => {
        const callback = mockIntegration.on.mock.calls.find(call => call[0] === 'transcriptionCompleted')?.[1];
        callback?.(mockResult);
      });

      await waitFor(() => {
        expect(screen.getByText(mockResult.text)).toBeInTheDocument();
      });

      const copyButton = screen.getByText('📋 Copy Text');
      await user.click(copyButton);
      
      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(mockResult.text);
      }, { timeout: 3000 });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should display transcription errors', () => {
      const onError = jest.fn();
      render(<OttehrVoiceTranscription onError={onError} />);
      
      const error = new Error('Transcription failed');
      
      act(() => {
        const callback = mockIntegration.on.mock.calls.find(call => call[0] === 'transcriptionError')?.[1];
        callback?.(error);
      });

      expect(screen.getByRole('alert')).toHaveTextContent('Transcription failed');
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});