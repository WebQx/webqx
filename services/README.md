# WhisperService Documentation

The `WhisperService` provides a comprehensive, production-ready interface for audio transcription using the Whisper API. It includes robust error handling, file validation, loading state management, and full TypeScript support.

## Features

- ✅ **Comprehensive Error Handling** - Network errors, HTTP errors, validation errors, timeouts
- ✅ **Dynamic Configuration** - Environment-based API URL configuration
- ✅ **Request Timeout Management** - AbortController integration with configurable timeouts
- ✅ **File Validation** - Type, size, and content validation with detailed error messages
- ✅ **Loading State Management** - Observable loading states with progress tracking
- ✅ **Full TypeScript Support** - Complete type definitions and interfaces
- ✅ **React Integration** - Easy integration with React components
- ✅ **Comprehensive Testing** - 24+ test cases covering all functionality

## Quick Start

### 1. Environment Setup

Add to your `.env` file:

```bash
WHISPER_API_URL=https://api.openai.com/v1/audio/transcriptions
WHISPER_API_KEY=your_openai_api_key_here
```

### 2. Basic Usage

```typescript
import { whisperService, transcribeAudio } from './services/whisperService';

// Quick transcription using convenience function
try {
  const result = await transcribeAudio(audioFile);
  console.log('Transcription:', result.text);
} catch (error) {
  console.error('Error:', error.message);
}

// Using the service instance for more control
const service = new WhisperService({
  timeout: 60000, // 60 seconds
  maxFileSize: 50 * 1024 * 1024 // 50MB
});

const result = await service.transcribeAudio(audioFile, {
  language: 'en',
  temperature: 0.2
});
```

### 3. React Integration

```tsx
import React, { useState, useEffect } from 'react';
import { whisperService } from './services/whisperService';

function AudioTranscriber() {
  const [loading, setLoading] = useState(false);
  const [transcription, setTranscription] = useState('');

  useEffect(() => {
    return whisperService.onLoadingStateChange((state) => {
      setLoading(state.isLoading);
    });
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      const validation = whisperService.validateFile(file);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }

      const result = await whisperService.transcribeAudio(file);
      setTranscription(result.text);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="audio/*" 
        onChange={(e) => handleFileUpload(e.target.files[0])} 
        disabled={loading}
      />
      {loading && <p>Transcribing...</p>}
      {transcription && <p>Result: {transcription}</p>}
    </div>
  );
}
```

## API Reference

### WhisperService Class

#### Constructor

```typescript
new WhisperService(config?: WhisperConfig)
```

**Config Options:**
- `apiUrl?: string` - API endpoint URL (defaults to env var)
- `timeout?: number` - Request timeout in milliseconds (default: 30000)
- `maxFileSize?: number` - Maximum file size in bytes (default: 25MB)
- `allowedFileTypes?: string[]` - Allowed MIME types

#### Methods

##### `transcribeAudio(file, options?)`

Transcribes an audio file to text.

```typescript
async transcribeAudio(
  file: File,
  options?: {
    language?: string;
    prompt?: string;
    temperature?: number;
  }
): Promise<WhisperResponse>
```

**Returns:** `WhisperResponse` with transcription text and metadata

**Throws:** `WhisperError` on validation or API errors

##### `validateFile(file)`

Validates a file before transcription.

```typescript
validateFile(file: File): ValidationResult
```

**Returns:** Validation result with error details if invalid

##### `onLoadingStateChange(callback)`

Subscribes to loading state changes.

```typescript
onLoadingStateChange(callback: (state: LoadingState) => void): () => void
```

**Returns:** Unsubscribe function

##### `updateConfig(config)` & `getConfig()`

Update or retrieve service configuration.

```typescript
updateConfig(newConfig: Partial<WhisperConfig>): void
getConfig(): Required<WhisperConfig>
```

### Error Handling

The service provides detailed error information:

```typescript
interface WhisperError {
  message: string;
  code: string;
  details?: any;
}
```

**Error Codes:**
- `VALIDATION_ERROR` - File validation failed
- `CONFIG_ERROR` - Configuration issue (missing API key)
- `NETWORK_ERROR` - Network connection problem
- `HTTP_ERROR` - API returned error status
- `TIMEOUT_ERROR` - Request exceeded timeout
- `INVALID_RESPONSE` - Unexpected API response format

### File Validation

**Supported File Types:**
- `audio/mpeg` (MP3)
- `audio/mp4` (MP4 Audio)
- `audio/wav` (WAV)
- `audio/webm` (WebM Audio)
- `audio/ogg` (OGG)
- `audio/flac` (FLAC)
- `audio/m4a` (M4A)
- `audio/x-m4a` (M4A Alternative)

**Validation Rules:**
- File must be present and non-empty
- File type must be in allowed list
- File size must not exceed configured limit (default: 25MB)

### Loading States

Track transcription progress:

```typescript
interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number; // 0-100
}
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
try {
  const result = await whisperService.transcribeAudio(file);
  // Handle success
} catch (error) {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      // Show user-friendly validation message
      break;
    case 'NETWORK_ERROR':
      // Suggest retry or check connection
      break;
    case 'TIMEOUT_ERROR':
      // Suggest trying again with smaller file
      break;
    default:
      // Generic error handling
  }
}
```

### 2. File Validation

Validate files before transcription:

```typescript
const validation = whisperService.validateFile(file);
if (!validation.isValid) {
  showError(validation.error);
  return;
}
```

### 3. Loading States

Provide user feedback during transcription:

```typescript
whisperService.onLoadingStateChange((state) => {
  if (state.isLoading) {
    showProgress(state.message, state.progress);
  } else {
    hideProgress();
  }
});
```

### 4. Configuration

Use environment variables for configuration:

```typescript
// Development
WHISPER_API_URL=http://localhost:8000/transcribe

// Production
WHISPER_API_URL=https://api.openai.com/v1/audio/transcriptions
```

## Testing

The service includes comprehensive tests. Run them with:

```bash
npm test -- --testPathPatterns=whisperService
```

Test coverage includes:
- ✅ Configuration and initialization
- ✅ File validation (all scenarios)
- ✅ Loading state management
- ✅ Error handling (all error types)
- ✅ Successful transcription flow
- ✅ Convenience functions
- ✅ React component integration

## License

Part of the WebQX Healthcare Platform - Apache 2.0 License