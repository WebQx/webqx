import { z } from 'zod';

const schema = z.object({
  PORT: z.string().default('3100'),
  // Medplum FHIR Server (BACKBONE #1 - Patient Records)
  MEDPLUM_API_URL: z.string().url().optional(),
  MEDPLUM_CLIENT_ID: z.string().optional(),
  MEDPLUM_CLIENT_SECRET: z.string().optional(),
  // Nextcloud File Storage (BACKBONE #2 - Files, Audio, Documents)
  NEXTCLOUD_WEBDAV_URL: z.string().url().optional(),
  NEXTCLOUD_USERNAME: z.string().optional(),
  NEXTCLOUD_PASSWORD: z.string().optional(),
  // OpenAI Whisper Transcription
  OPENAI_API_KEY: z.string().optional(),
  WHISPER_API_KEY: z.string().optional(),
  WHISPER_BASE_URL: z.string().default('https://api.openai.com/v1'),
  WHISPER_MODEL: z.string().default('whisper-1'),
  // Security
  ALLOWED_ORIGINS: z.string().optional(),
  ADAPTER_LOG_LEVEL: z.string().default('info'),
  ADAPTER_CACHE_TTL_MS: z.string().default('30000')
});

export const config = schema.parse(process.env);

export function parseAllowedOrigins(raw) {
  if (!raw) return ['https://webqx.github.io'];
  if (raw.trim() === '*') return '*';
  return raw.split(',').map(o => o.trim()).filter(Boolean);
}
