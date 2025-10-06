/**
 * Provider Dashboard Aggregation Routes
 * 
 * Aggregates data from multiple production APIs for provider dashboard
 * Features caching, error handling, and authentication
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

// Simple in-memory cache
const dashboardCache = {
  provider: { data: null, ts: 0 }
};
const TTL_MS = 30000; // 30 seconds

/**
 * Helper function to fetch with timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * GET /api/dashboard/provider
 * Aggregates data from real production APIs for provider dashboard
 * Requires valid authenticated provider request (JWT role check)
 */
router.get('/provider', async (req, res) => {
  try {
    // Check authentication and provider role
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const userRoles = req.user.roles || [];
    if (!userRoles.includes('provider') && !userRoles.includes('admin')) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Provider role required'
      });
    }

    // Check cache
    const now = Date.now();
    if (dashboardCache.provider.data && (now - dashboardCache.provider.ts) < TTL_MS) {
      return res.json({
        ...dashboardCache.provider.data,
        cached: true
      });
    }

    // Aggregate data from various endpoints
    const errors = [];
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    
    // Prepare aggregated response
    const dashboardData = {
      updated_at: new Date().toISOString()
    };

    // Fetch patients count
    try {
      const patientsUrl = `${baseUrl}/emr/patients?limit=100`;
      const patientsResponse = await fetchWithTimeout(patientsUrl);
      
      if (patientsResponse.ok) {
        const patientsData = await patientsResponse.json();
        dashboardData.patients = {
          count: patientsData.count || (patientsData.patients ? patientsData.patients.length : 0)
        };
      } else {
        errors.push({
          section: 'patients',
          error: `HTTP_${patientsResponse.status}`
        });
      }
    } catch (error) {
      errors.push({
        section: 'patients',
        error: error.name === 'AbortError' ? 'TIMEOUT' : error.message
      });
    }

    // Fetch telehealth sessions
    try {
      const telehealthUrl = `${baseUrl}/api/telehealth/sessions`;
      const telehealthResponse = await fetchWithTimeout(telehealthUrl);
      
      if (telehealthResponse.ok) {
        const telehealthData = await telehealthResponse.json();
        const sessions = telehealthData.data || telehealthData.sessions || [];
        
        // Count active vs waiting based on status
        const active = sessions.filter(s => s.status === 'active' || s.status === 'in_progress').length;
        const waiting = sessions.filter(s => s.status === 'scheduled' || s.status === 'waiting').length;
        
        dashboardData.telehealth = { active, waiting };
      } else {
        errors.push({
          section: 'telehealth',
          error: `HTTP_${telehealthResponse.status}`
        });
      }
    } catch (error) {
      errors.push({
        section: 'telehealth',
        error: error.name === 'AbortError' ? 'TIMEOUT' : error.message
      });
    }

    // Fetch transcription jobs
    try {
      const transcribeUrl = `${baseUrl}/emr/transcribe/status`;
      const transcribeResponse = await fetchWithTimeout(transcribeUrl);
      
      if (transcribeResponse.ok) {
        const transcribeData = await transcribeResponse.json();
        const jobs = transcribeData.jobs || transcribeData.recent || [];
        
        // Slice to first 5
        dashboardData.transcriptionJobs = jobs.slice(0, 5).map(job => ({
          id: job.id,
          status: job.status,
          created_at: job.created_at || job.timestamp
        }));
      } else {
        errors.push({
          section: 'transcription',
          error: `HTTP_${transcribeResponse.status}`
        });
      }
    } catch (error) {
      errors.push({
        section: 'transcription',
        error: error.name === 'AbortError' ? 'TIMEOUT' : error.message
      });
    }

    // Note: Files endpoint doesn't exist yet, so we'll add a placeholder
    // When implemented, add actual file count here
    try {
      // Placeholder for future files endpoint
      // const filesUrl = `${baseUrl}/emr/files`;
      // For now, omit this section rather than return fake data
      errors.push({
        section: 'files',
        error: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      errors.push({
        section: 'files',
        error: error.message
      });
    }

    // Add errors array to response
    dashboardData.errors = errors;

    // Cache the response
    dashboardCache.provider = {
      data: dashboardData,
      ts: now
    };

    // Return aggregated data
    res.json(dashboardData);

  } catch (error) {
    console.error('Dashboard aggregation error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to aggregate dashboard data',
      updated_at: new Date().toISOString(),
      errors: [{
        section: 'dashboard',
        error: error.message
      }]
    });
  }
});

module.exports = router;
