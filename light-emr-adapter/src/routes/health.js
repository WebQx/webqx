import { Router } from 'express';
import { checkMedplum } from '../medplum.js';
import { checkNextcloud } from '../nextcloud.js';
import { config } from '../config.js';

const router = Router();

/**
 * GET /emr/health/full
 * 
 * Comprehensive health check for all backend services
 * Returns detailed status for Medplum, Nextcloud, and OpenAI
 */
router.get('/health/full', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check all services in parallel
    const [medplumStatus, nextcloudStatus] = await Promise.all([
      checkMedplum(),
      checkNextcloud()
    ]);

    // Check OpenAI API key
    const openaiConfigured = !!(config.OPENAI_API_KEY || config.WHISPER_API_KEY);

    // Check Medplum credentials
    const medplumFullyConfigured = !!(
      config.MEDPLUM_API_URL && 
      config.MEDPLUM_CLIENT_ID && 
      config.MEDPLUM_CLIENT_SECRET
    );

    // Check Nextcloud credentials
    const nextcloudFullyConfigured = !!(
      config.NEXTCLOUD_WEBDAV_URL && 
      config.NEXTCLOUD_USERNAME && 
      config.NEXTCLOUD_PASSWORD
    );

    // Determine overall health
    const allServicesOnline = 
      medplumStatus.status === 'online' && 
      nextcloudStatus.status === 'online';
    
    const allServicesConfigured = 
      medplumFullyConfigured && 
      nextcloudFullyConfigured && 
      openaiConfigured;

    const overallStatus = allServicesOnline && allServicesConfigured 
      ? 'healthy' 
      : allServicesConfigured 
        ? 'degraded' 
        : 'configuration_incomplete';

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      response_time_ms: Date.now() - startTime,
      services: {
        medplum: {
          ...medplumStatus,
          configured: medplumFullyConfigured,
          credentials_set: {
            api_url: !!config.MEDPLUM_API_URL,
            client_id: !!config.MEDPLUM_CLIENT_ID,
            client_secret: !!config.MEDPLUM_CLIENT_SECRET
          }
        },
        nextcloud: {
          ...nextcloudStatus,
          configured: nextcloudFullyConfigured,
          credentials_set: {
            webdav_url: !!config.NEXTCLOUD_WEBDAV_URL,
            username: !!config.NEXTCLOUD_USERNAME,
            password: !!config.NEXTCLOUD_PASSWORD
          }
        },
        openai_whisper: {
          configured: openaiConfigured,
          api_key_set: !!config.OPENAI_API_KEY || !!config.WHISPER_API_KEY,
          model: config.WHISPER_MODEL,
          base_url: config.WHISPER_BASE_URL
        }
      },
      configuration: {
        port: config.PORT,
        log_level: config.ADAPTER_LOG_LEVEL,
        cache_ttl_ms: config.ADAPTER_CACHE_TTL_MS,
        allowed_origins: config.ALLOWED_ORIGINS || 'default'
      }
    };

    // Add warnings if any service is misconfigured
    const warnings = [];
    
    if (!medplumFullyConfigured) {
      warnings.push({
        service: 'medplum',
        message: 'Medplum credentials incomplete. Set MEDPLUM_API_URL, MEDPLUM_CLIENT_ID, and MEDPLUM_CLIENT_SECRET',
        severity: 'critical'
      });
    }
    
    if (!nextcloudFullyConfigured) {
      warnings.push({
        service: 'nextcloud',
        message: 'Nextcloud credentials incomplete. Set NEXTCLOUD_WEBDAV_URL, NEXTCLOUD_USERNAME, and NEXTCLOUD_PASSWORD',
        severity: 'critical'
      });
    }
    
    if (!openaiConfigured) {
      warnings.push({
        service: 'openai',
        message: 'OpenAI API key not set. Transcription features will not work. Set OPENAI_API_KEY',
        severity: 'high'
      });
    }

    if (medplumStatus.status === 'offline') {
      warnings.push({
        service: 'medplum',
        message: `Medplum FHIR server is offline or unreachable: ${medplumStatus.error || 'Unknown error'}`,
        severity: 'critical'
      });
    }

    if (nextcloudStatus.status === 'offline') {
      warnings.push({
        service: 'nextcloud',
        message: `Nextcloud file storage is offline or unreachable: ${nextcloudStatus.error || 'Unknown error'}`,
        severity: 'critical'
      });
    }

    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    const statusCode = overallStatus === 'healthy' ? 200 : 
                       overallStatus === 'degraded' ? 503 : 
                       500;

    res.status(statusCode).json(response);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      response_time_ms: Date.now() - startTime,
      error: {
        message: error.message,
        type: error.name
      }
    });
  }
});

/**
 * GET /emr/health/ready
 * 
 * Kubernetes-style readiness probe
 * Returns 200 only if all critical services are online and configured
 */
router.get('/health/ready', async (req, res) => {
  try {
    const [medplumStatus, nextcloudStatus] = await Promise.all([
      checkMedplum(),
      checkNextcloud()
    ]);

    const medplumReady = medplumStatus.status === 'online' && 
                         config.MEDPLUM_API_URL && 
                         config.MEDPLUM_CLIENT_ID;
    
    const nextcloudReady = nextcloudStatus.status === 'online' && 
                           config.NEXTCLOUD_WEBDAV_URL;

    const ready = medplumReady && nextcloudReady;

    if (ready) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ 
        ready: false,
        medplum_ready: medplumReady,
        nextcloud_ready: nextcloudReady
      });
    }
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message });
  }
});

/**
 * GET /emr/health/live
 * 
 * Kubernetes-style liveness probe
 * Returns 200 if the service is running (doesn't check dependencies)
 */
router.get('/health/live', (req, res) => {
  res.status(200).json({ 
    alive: true,
    uptime_seconds: Math.floor(process.uptime())
  });
});

export default router;
