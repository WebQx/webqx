# Client Integration – Medical Transcription (Production)

This document describes how WebQx clients (Portal, Provider) should call the production Whisper service via the gateway.

## File upload (batch)

- Endpoint: POST /api/transcription/v1/transcribe
- Auth: Authorization: Bearer <provider_token>
- Body: multipart/form-data with `file` (audio/wav, audio/webm, audio/mpeg)

Example (TypeScript):

```ts
async function transcribe(file: File, token: string) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  const res = await fetch('/api/transcription/v1/transcribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`Transcribe failed: ${res.status}`);
  return res.json();
}
```

Response schema:
- filename, language, duration_seconds, model, processing_ms, redaction_applied, text, segments[]

## Streaming (optional)

- Endpoint: WS /api/transcription/v1/ws
- Protocol: Send binary audio chunks; send a final text frame `__end__` to close; receive one final JSON payload.
- Auth: Pass `Authorization: Bearer ...` header if your WS client supports headers; otherwise negotiated via query param (only if approved by security).

## UI guidance

- Show upload progress and allow cancel.
- Enforce client-side max duration/size to match server limits.
- Indicate when redaction was applied.
- Store transcript as a FHIR DocumentReference only after user confirmation.

## Migration from mock

- Always call `/api/transcription/v1/transcribe`. If the gateway isn't configured (no TRANSCRIPTION_BASE_URL), the request will return 503 (TRANSCRIPTION_UNAVAILABLE).
- Keep mock available for local dev with TRANSCRIPTION_BASE_URL unset.
