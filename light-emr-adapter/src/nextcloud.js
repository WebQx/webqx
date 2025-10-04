import axios from 'axios';
import { config } from './config.js';
import { logger } from './logger.js';

export async function checkNextcloud() {
  if (!config.NEXTCLOUD_WEBDAV_URL) return { enabled: false, status: 'disabled' };
  try {
    const start = Date.now();
    // WebDAV PROPFIND depth 0
    const resp = await axios.request({
      url: config.NEXTCLOUD_WEBDAV_URL,
      method: 'PROPFIND',
      headers: { Depth: 0 },
      auth: config.NEXTCLOUD_USERNAME && config.NEXTCLOUD_PASSWORD ? {
        username: config.NEXTCLOUD_USERNAME,
        password: config.NEXTCLOUD_PASSWORD
      } : undefined,
      timeout: 5000,
      validateStatus: () => true
    });
    const latency = Date.now() - start;
    const ok = resp.status >= 200 && resp.status < 400;
    return { enabled: true, status: ok ? 'online' : 'degraded', latency_ms: latency, http_status: resp.status };
  } catch (e) {
    logger.warn({ msg: 'Nextcloud check failed', err: e.message });
    return { enabled: true, status: 'offline', error: e.message };
  }
}
