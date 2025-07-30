# Translation API Documentation

## Overview

The `translateMedicationInfo` function provides robust translation capabilities for medication-related text using the WebQX Whisper API. This implementation includes comprehensive error handling, type safety, validation, and configurable environment support.

## Features

✅ **Type Safety**: Full TypeScript support with interfaces for requests and responses  
✅ **Input Validation**: Validates text and language code parameters  
✅ **Error Handling**: Comprehensive error handling with custom error types  
✅ **Headers**: Proper Content-Type and Accept headers  
✅ **Environment Configuration**: Configurable base URL for different environments  
✅ **Unit Tests**: Complete test coverage for all scenarios  

## Installation and Setup

The translation functionality is included in the WebQX patient portal. No additional installation is required.

### Environment Configuration

Set the API base URL using the environment variable:

```bash
REACT_APP_API_BASE_URL=http://localhost:3000
```

Or configure it programmatically:

```typescript
import { setApiBaseUrl } from './utils/api';
setApiBaseUrl('https://your-api-server.com');
```

## Usage

### Basic Usage

```typescript
import { translateMedicationInfo } from './utils/api';

try {
  const result = await translateMedicationInfo('Take 2 tablets daily', 'es');
  console.log(result.translatedText); // "Tomar 2 tabletas al día"
} catch (error) {
  console.error('Translation failed:', error.message);
}
```

### Advanced Usage with Error Handling

```typescript
import { translateMedicationInfo, TranslationError } from './utils/api';

async function translateWithErrorHandling(text: string, targetLang: string) {
  try {
    const result = await translateMedicationInfo(text, targetLang);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    if (error instanceof TranslationError) {
      switch (error.code) {
        case 'INVALID_TEXT':
        case 'INVALID_TARGET_LANG':
        case 'INVALID_LANG_CODE':
          return { success: false, error: 'Invalid input parameters' };
        case 'NETWORK_ERROR':
          return { success: false, error: 'Network connection failed' };
        case 'HTTP_ERROR':
          return { success: false, error: `Server error (${error.status})` };
        default:
          return { success: false, error: 'Translation service unavailable' };
      }
    }
    return { success: false, error: 'Unexpected error occurred' };
  }
}
```

## API Reference

### `translateMedicationInfo(text, targetLang)`

Translates medication information text to the specified target language.

#### Parameters

- `text` (string): The medication information text to translate
  - Must be a non-empty string
  - Whitespace is automatically trimmed
- `targetLang` (string): The target language code
  - Must be a valid 2-3 character language code (e.g., 'en', 'es', 'fr')
  - Case-insensitive (automatically normalized to lowercase)

#### Returns

Promise that resolves to a `TranslationResponse` object:

```typescript
interface TranslationResponse {
  translatedText: string;      // The translated text
  sourceLanguage?: string;     // Detected source language
  targetLanguage: string;      // Target language used
  confidence?: number;         // Translation confidence (0-1)
}
```

#### Throws

`TranslationError` with the following possible error codes:

- `INVALID_TEXT`: Text parameter is invalid or empty
- `INVALID_TARGET_LANG`: Target language parameter is invalid
- `INVALID_LANG_CODE`: Language code format is invalid
- `NETWORK_ERROR`: Network connection failed
- `HTTP_ERROR`: Server returned an error response
- `INVALID_RESPONSE`: Server response is not valid JSON
- `INVALID_RESPONSE_FORMAT`: Response format is unexpected
- `MISSING_TRANSLATED_TEXT`: Translation result is missing
- `UNEXPECTED_ERROR`: Unexpected error occurred

### Configuration Functions

#### `setApiBaseUrl(baseUrl)`

Sets the base URL for API requests.

```typescript
setApiBaseUrl('https://api.production.com');
```

#### `getApiConfig()`

Returns the current API configuration.

```typescript
const config = getApiConfig();
console.log(config.baseUrl); // Current base URL
```

## Server Endpoint

### POST `/api/whisper/translate`

Translation endpoint that accepts JSON requests.

#### Request Body

```json
{
  "text": "Take 2 tablets daily",
  "targetLang": "es"
}
```

#### Response (Success)

```json
{
  "translatedText": "Tomar 2 tabletas al día",
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "confidence": 0.95
}
```

#### Response (Error)

```json
{
  "message": "Text parameter is required and must be a non-empty string",
  "code": "INVALID_TEXT"
}
```

## Supported Languages

The translation service supports the following languages:

- **Spanish** (`es`): Full translation support
- **French** (`fr`): Full translation support  
- **German** (`de`): Full translation support
- **Italian** (`it`): Fallback translation
- **Portuguese** (`pt`): Fallback translation

Additional languages can be added by extending the server-side translation mappings.

## Testing

Run the complete test suite:

```bash
npm test
```

Run only translation API tests:

```bash
npm test -- patient-portal/__tests__/api.test.ts
```

The test suite covers:
- Input validation scenarios
- HTTP request handling
- Success response processing
- Error response handling
- Configuration functions
- Custom error class behavior

## Error Handling Best Practices

1. **Always use try-catch blocks** when calling the translation function
2. **Check for TranslationError instances** to handle specific error types
3. **Provide fallback behavior** for failed translations
4. **Log errors appropriately** for debugging and monitoring
5. **Show user-friendly error messages** instead of technical details

## Example React Component

See `patient-portal/examples/TranslationExample.tsx` for a complete React component implementation with proper error handling and user interface.

## Development

### Adding New Languages

To add support for new languages:

1. Update the server-side translation mappings in `server.js`
2. Add the language code to validation tests
3. Update documentation

### Extending Functionality

The translation system can be extended to support:
- Batch translation requests
- Translation caching
- Language detection
- Translation quality scoring
- Integration with external translation services

## Security Considerations

- Input validation is performed on both client and server sides
- All requests require proper Content-Type headers
- Language codes are validated to prevent injection attacks
- Error messages don't expose sensitive server information

## Performance

- Requests are made using the native `fetch` API
- Response validation is minimal to maintain performance
- Failed translations include appropriate fallback mechanisms
- The server includes confidence scoring for translation quality assessment