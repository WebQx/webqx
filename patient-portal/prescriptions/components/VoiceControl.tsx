/**
 * Voice Control Component for accessibility and hands-free interaction
 * Provides speech recognition and text-to-speech capabilities
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceControlProps {
  /** Whether voice control is enabled */
  enabled?: boolean;
  /** Language for speech recognition */
  language?: string;
  /** Callback when speech is recognized */
  onSpeechRecognized?: (text: string, confidence: number) => void;
  /** Callback when voice control state changes */
  onStateChange?: (isListening: boolean, isSupported: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

interface VoiceControlState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  confidence: number;
  error: string | null;
}

// Voice commands for prescription form
const VOICE_COMMANDS = {
  'start prescription': () => console.log('Starting new prescription'),
  'patient id': () => (document.querySelector('[aria-label*="Patient"]') as HTMLElement)?.focus(),
  'search medication': () => (document.querySelector('[role="combobox"]') as HTMLElement)?.focus(),
  'dosage': () => (document.querySelector('[aria-label*="Dosage"]') as HTMLElement)?.focus(),
  'frequency': () => (document.querySelector('[aria-label*="Frequency"]') as HTMLElement)?.focus(),
  'submit form': () => (document.querySelector('[type="submit"]') as HTMLElement)?.click(),
  'help': () => speak('Available commands: patient ID, search medication, dosage, frequency, submit form'),
  'scroll up': () => window.scrollBy(0, -200),
  'scroll down': () => window.scrollBy(0, 200),
  'go back': () => window.history.back(),
  'dark mode': () => (document.querySelector('.theme-toggle') as HTMLElement)?.click(),
  'light mode': () => (document.querySelector('.theme-toggle') as HTMLElement)?.click()
};

// Text-to-speech function
const speak = (text: string, language: string = 'en-US'): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));

    speechSynthesis.speak(utterance);
  });
};

export const VoiceControl: React.FC<VoiceControlProps> = ({
  enabled = true,
  language = 'en-US',
  onSpeechRecognized,
  onStateChange,
  className = ''
}) => {
  const [state, setState] = useState<VoiceControlState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    confidence: 0,
    error: null
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isSupported = !!SpeechRecognition && 'speechSynthesis' in window;
    
    setState(prev => ({ ...prev, isSupported }));
    
    if (isSupported && enabled) {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, error: null }));
      };

      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }));
      };

      recognition.onerror = (event) => {
        setState(prev => ({
          ...prev,
          isListening: false,
          error: `Speech recognition error: ${event.error}`
        }));
      };

      recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        const transcript = lastResult[0].transcript.toLowerCase().trim();
        const confidence = lastResult[0].confidence;

        setState(prev => ({
          ...prev,
          transcript,
          confidence
        }));

        if (lastResult.isFinal) {
          handleVoiceCommand(transcript);
          onSpeechRecognized?.(transcript, confidence);
        }
      };

      recognitionRef.current = recognition;
    }

    onStateChange?.(state.isListening, isSupported);
  }, [enabled, language, onSpeechRecognized, onStateChange, state.isListening]);

  // Handle voice commands
  const handleVoiceCommand = useCallback((transcript: string) => {
    console.log('Voice command:', transcript);

    // Check for exact matches first
    if (VOICE_COMMANDS[transcript as keyof typeof VOICE_COMMANDS]) {
      VOICE_COMMANDS[transcript as keyof typeof VOICE_COMMANDS]();
      speak(`Executing: ${transcript}`);
      return;
    }

    // Check for partial matches
    for (const [command, action] of Object.entries(VOICE_COMMANDS)) {
      if (transcript.includes(command)) {
        action();
        speak(`Executing: ${command}`);
        return;
      }
    }

    // Check for form filling commands
    if (transcript.startsWith('set patient id to ')) {
      const value = transcript.replace('set patient id to ', '');
      const input = document.querySelector('[aria-label*="Patient"]') as HTMLInputElement;
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        speak(`Patient ID set to ${value}`);
      }
      return;
    }

    if (transcript.startsWith('search for ')) {
      const medication = transcript.replace('search for ', '');
      const input = document.querySelector('[role="combobox"]') as HTMLInputElement;
      if (input) {
        input.value = medication;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        speak(`Searching for ${medication}`);
      }
      return;
    }

    if (transcript.startsWith('set dosage to ')) {
      const dosage = transcript.replace('set dosage to ', '');
      const input = document.querySelector('[aria-label*="Dosage"]') as HTMLInputElement;
      if (input) {
        input.value = dosage;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        speak(`Dosage set to ${dosage}`);
      }
      return;
    }

    // Fallback: announce that command was not recognized
    speak('Command not recognized. Say "help" for available commands.');
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    if (!state.isSupported || !recognitionRef.current) {
      setState(prev => ({ ...prev, error: 'Speech recognition not supported' }));
      return;
    }

    try {
      recognitionRef.current.start();
      speak('Voice control activated. Listening for commands.');
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start voice recognition'
      }));
    }
  }, [state.isSupported]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      speak('Voice control deactivated.');
    }
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  // Announce page elements for navigation
  const announcePageElements = useCallback(() => {
    const elements = [
      'Patient ID field',
      'Medication search',
      'Dosage input',
      'Frequency selector',
      'Submit button'
    ];
    
    speak(`Page contains: ${elements.join(', ')}`);
  }, []);

  if (!enabled || !state.isSupported) {
    return null;
  }

  return (
    <div className={`voice-control ${className}`} role="region" aria-label="Voice Control">
      <div className="voice-control-header">
        <h3>🎤 Voice Control</h3>
        <div className="voice-status">
          <span className={`status-indicator ${state.isListening ? 'listening' : 'idle'}`}>
            {state.isListening ? '🔴 Listening' : '⚫ Idle'}
          </span>
        </div>
      </div>

      <div className="voice-controls">
        <button
          onClick={toggleListening}
          className={`voice-toggle ${state.isListening ? 'listening' : ''}`}
          aria-label={state.isListening ? 'Stop voice recognition' : 'Start voice recognition'}
          disabled={!state.isSupported}
        >
          {state.isListening ? '🛑 Stop Listening' : '🎤 Start Listening'}
        </button>

        <button
          onClick={announcePageElements}
          className="announce-elements"
          aria-label="Announce page elements"
          disabled={!state.isSupported}
        >
          📢 Announce Elements
        </button>

        <button
          onClick={() => speak('Voice commands: patient ID, search medication, dosage, frequency, submit form, help, scroll up, scroll down, dark mode')}
          className="help-commands"
          aria-label="Announce available voice commands"
          disabled={!state.isSupported}
        >
          ❓ Voice Commands
        </button>
      </div>

      {state.transcript && (
        <div className="voice-transcript" role="log" aria-live="polite">
          <label>Last heard:</label>
          <div className="transcript-text">
            "{state.transcript}"
            {state.confidence > 0 && (
              <span className="confidence">
                ({Math.round(state.confidence * 100)}% confidence)
              </span>
            )}
          </div>
        </div>
      )}

      {state.error && (
        <div className="voice-error" role="alert">
          ⚠️ {state.error}
        </div>
      )}

      {/* Voice Commands Help */}
      <details className="voice-help">
        <summary>Available Voice Commands</summary>
        <ul>
          <li><strong>"patient id"</strong> - Focus patient ID field</li>
          <li><strong>"search medication"</strong> - Focus medication search</li>
          <li><strong>"set patient id to [value]"</strong> - Fill patient ID</li>
          <li><strong>"search for [medication]"</strong> - Search for medication</li>
          <li><strong>"set dosage to [amount]"</strong> - Fill dosage field</li>
          <li><strong>"dosage"</strong> - Focus dosage field</li>
          <li><strong>"frequency"</strong> - Focus frequency field</li>
          <li><strong>"submit form"</strong> - Submit the prescription</li>
          <li><strong>"scroll up/down"</strong> - Scroll the page</li>
          <li><strong>"dark mode/light mode"</strong> - Toggle theme</li>
          <li><strong>"help"</strong> - Get voice help</li>
        </ul>
      </details>
    </div>
  );
};

// Hook for voice control integration
export const useVoiceControl = (enabled: boolean = true) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const handleStateChange = useCallback((listening: boolean, supported: boolean) => {
    setIsListening(listening);
    setIsSupported(supported);
  }, []);

  const announceText = useCallback(async (text: string, language: string = 'en-US') => {
    try {
      await speak(text, language);
    } catch (error) {
      console.warn('Failed to announce text:', error);
    }
  }, []);

  return {
    isListening,
    isSupported,
    announceText,
    onStateChange: handleStateChange
  };
};

export default VoiceControl;