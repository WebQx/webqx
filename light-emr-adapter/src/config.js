import { z } from 'zod';

const schema = z.object({
  PORT: z.string().default('3100'),
  MEDPLUM_API_URL: z.string().url().optional(),
  NEXTCLOUD_WEBDAV_URL: z.string().url().optional(),
  NEXTCLOUD_USERNAME: z.string().optional(),
  NEXTCLOUD_PASSWORD: z.string().optional(),
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
