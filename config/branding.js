// Centralized branding & lineage constants for WebQX EMR
// Usage: import { BRAND } from '../config/branding.js';

export const BRAND = {
  productName: 'WebQX EMR',
  shortName: 'WebQX',
  lineageNote: 'Powered by an enhanced OpenEMR foundation',
  company: 'WebQX Health',
  version: process.env.WEBQX_VERSION || '0.1.0-dev',
  ai: {
    assistantName: 'WebQX AI Assist',
    transcriptionEngine: 'Whisper (planned)',
  },
  links: {
    docs: 'https://webqx.github.io/EMR/',
    support: 'https://github.com/WebQx/webqx/issues',
  }
};

export function applyBranding(res) {
  // Helper to attach branding headers (optional usage in responses)
  res.setHeader('X-WebQX-Product', BRAND.productName);
  res.setHeader('X-WebQX-Lineage', BRAND.lineageNote);
}
