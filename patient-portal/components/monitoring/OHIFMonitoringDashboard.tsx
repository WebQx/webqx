/**
 * @fileoverview OHIF Viewer Monitoring Dashboard
 * 
 * Real-time monitoring and troubleshooting dashboard for OHIF viewer
 * performance, security events, and system health.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ohifAPI, ViewerSession, PerformanceMetrics } from '../../services/ohifAPI';
import { imagingCache } from '../../services/imagingCache';

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'error';
  uptime: number;
  activeSessionsCount: number;
  errorRate: number;
  averageLoadTime: number;
  cacheHitRate: number;
  lastUpdated: Date;
}

export interface SecurityAlert {
  id: string;
  type: 'unauthorized_access' | 'suspicious_activity' | 'security_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  details: {
    patientId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    description: string;
  };
  resolved: boolean;
}

interface OHIFMonitoringDashboardProps {
  isAdminUser: boolean;
  onSecurityAlert?: (alert: SecurityAlert) => void;
  className?: string;
}

/**
 * Real-time monitoring dashboard for OHIF viewer system
 */
export const OHIFMonitoringDashboard: React.FC<OHIFMonitoringDashboardProps> = ({
  isAdminUser,
  onSecurityAlert,
  className = '',
}) => {
  const { t } = useTranslation();
  
  // Component state
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [activeSessions, setActiveSessions] = useState<ViewerSession[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<Record<string, PerformanceMetrics>>({});
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds

  /**
   * Fetch system health metrics
   */
  const fetchSystemHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/monitoring/system-health', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch system health: ${response.statusText}`);
      }

      const health: SystemHealth = await response.json();
      setSystemHealth(health);
    } catch (err) {
      console.error('Failed to fetch system health:', err);
    }
  }, []);

  /**
   * Fetch active viewer sessions
   */
  const fetchActiveSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/monitoring/active-sessions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch active sessions: ${response.statusText}`);
      }

      const sessions: ViewerSession[] = await response.json();
      setActiveSessions(sessions);

      // Fetch performance metrics for each session
      const metrics: Record<string, PerformanceMetrics> = {};
      for (const session of sessions) {
        const sessionMetrics = ohifAPI.getPerformanceMetrics(session.sessionId);
        if (sessionMetrics) {
          metrics[session.sessionId] = sessionMetrics;
        }
      }
      setPerformanceMetrics(metrics);
    } catch (err) {
      console.error('Failed to fetch active sessions:', err);
    }
  }, []);

  /**
   * Fetch security alerts
   */
  const fetchSecurityAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/monitoring/security-alerts?limit=50', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch security alerts: ${response.statusText}`);
      }

      const alerts: SecurityAlert[] = await response.json();
      setSecurityAlerts(alerts);

      // Notify about new critical alerts
      alerts
        .filter(alert => alert.severity === 'critical' && !alert.resolved)
        .forEach(alert => onSecurityAlert?.(alert));
    } catch (err) {
      console.error('Failed to fetch security alerts:', err);
    }
  }, [onSecurityAlert]);

  /**
   * Refresh all monitoring data
   */
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchSystemHealth(),
        fetchActiveSessions(),
        fetchSecurityAlerts(),
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh monitoring data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fetchSystemHealth, fetchActiveSessions, fetchSecurityAlerts]);

  /**
   * Resolve security alert
   */
  const resolveSecurityAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch(`/api/monitoring/security-alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to resolve alert: ${response.statusText}`);
      }

      // Update local state
      setSecurityAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, resolved: true }
            : alert
        )
      );
    } catch (err) {
      console.error('Failed to resolve security alert:', err);
    }
  }, []);

  /**
   * Force close viewer session
   */
  const forceCloseSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/monitoring/sessions/${sessionId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to close session: ${response.statusText}`);
      }

      // Remove from local state
      setActiveSessions(prev => prev.filter(session => session.sessionId !== sessionId));
      setPerformanceMetrics(prev => {
        const updated = { ...prev };
        delete updated[sessionId];
        return updated;
      });
    } catch (err) {
      console.error('Failed to close session:', err);
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !isAdminUser) return;

    const interval = setInterval(refreshData, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshData, isAdminUser]);

  // Initial data load
  useEffect(() => {
    if (isAdminUser) {
      refreshData();
    }
  }, [isAdminUser, refreshData]);

  // Render access denied for non-admin users
  if (!isAdminUser) {
    return (
      <div className={`monitoring-access-denied ${className}`}>
        <div className="access-denied-content">
          <div className="access-denied-icon">🔒</div>
          <h3>{t('monitoring.access_denied_title')}</h3>
          <p>{t('monitoring.access_denied_description')}</p>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isLoading && !systemHealth) {
    return (
      <div className={`monitoring-loading ${className}`}>
        <div className="loading-spinner" />
        <p>{t('monitoring.loading_dashboard')}</p>
      </div>
    );
  }

  // Render error state
  if (error && !systemHealth) {
    return (
      <div className={`monitoring-error ${className}`}>
        <div className="error-icon">⚠️</div>
        <h3>{t('monitoring.error_title')}</h3>
        <p>{error}</p>
        <button onClick={refreshData} className="retry-button">
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className={`ohif-monitoring-dashboard ${className}`}>
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <h2>{t('monitoring.dashboard_title')}</h2>
        <div className="dashboard-controls">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            {t('monitoring.auto_refresh')}
          </label>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            disabled={!autoRefresh}
          >
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>1m</option>
            <option value={300}>5m</option>
          </select>
          <button onClick={refreshData} className="refresh-button">
            {t('monitoring.refresh_now')}
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      {systemHealth && (
        <div className="system-health-section">
          <h3>{t('monitoring.system_health')}</h3>
          <div className="health-metrics">
            <div className={`health-status ${systemHealth.status}`}>
              <div className="status-indicator" />
              <span>{t(`monitoring.status_${systemHealth.status}`)}</span>
            </div>
            <div className="metric">
              <label>{t('monitoring.uptime')}</label>
              <span>{Math.floor(systemHealth.uptime / 3600)}h {Math.floor((systemHealth.uptime % 3600) / 60)}m</span>
            </div>
            <div className="metric">
              <label>{t('monitoring.active_sessions')}</label>
              <span>{systemHealth.activeSessionsCount}</span>
            </div>
            <div className="metric">
              <label>{t('monitoring.error_rate')}</label>
              <span>{(systemHealth.errorRate * 100).toFixed(2)}%</span>
            </div>
            <div className="metric">
              <label>{t('monitoring.avg_load_time')}</label>
              <span>{systemHealth.averageLoadTime.toFixed(0)}ms</span>
            </div>
            <div className="metric">
              <label>{t('monitoring.cache_hit_rate')}</label>
              <span>{(systemHealth.cacheHitRate * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Security Alerts */}
      {securityAlerts.length > 0 && (
        <div className="security-alerts-section">
          <h3>{t('monitoring.security_alerts')}</h3>
          <div className="alerts-list">
            {securityAlerts
              .filter(alert => !alert.resolved)
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
              .slice(0, 10)
              .map(alert => (
                <div key={alert.id} className={`security-alert ${alert.severity}`}>
                  <div className="alert-header">
                    <span className="alert-type">{t(`monitoring.alert_${alert.type}`)}</span>
                    <span className="alert-severity">{t(`monitoring.severity_${alert.severity}`)}</span>
                    <span className="alert-time">
                      {alert.timestamp.toLocaleString()}
                    </span>
                  </div>
                  <div className="alert-details">
                    <p>{alert.details.description}</p>
                    {alert.details.patientId && (
                      <span className="alert-detail">
                        {t('monitoring.patient_id')}: {alert.details.patientId}
                      </span>
                    )}
                    {alert.details.ipAddress && (
                      <span className="alert-detail">
                        {t('monitoring.ip_address')}: {alert.details.ipAddress}
                      </span>
                    )}
                  </div>
                  <div className="alert-actions">
                    <button
                      onClick={() => resolveSecurityAlert(alert.id)}
                      className="resolve-button"
                    >
                      {t('monitoring.resolve_alert')}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Active Sessions */}
      <div className="active-sessions-section">
        <h3>{t('monitoring.active_sessions')}</h3>
        <div className="sessions-table">
          <table>
            <thead>
              <tr>
                <th>{t('monitoring.session_id')}</th>
                <th>{t('monitoring.patient_id')}</th>
                <th>{t('monitoring.study_id')}</th>
                <th>{t('monitoring.start_time')}</th>
                <th>{t('monitoring.last_activity')}</th>
                <th>{t('monitoring.performance')}</th>
                <th>{t('monitoring.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {activeSessions.map(session => {
                const metrics = performanceMetrics[session.sessionId];
                return (
                  <tr key={session.sessionId}>
                    <td className="session-id">{session.sessionId.slice(-8)}</td>
                    <td>{session.patientId}</td>
                    <td>{session.studyId}</td>
                    <td>{session.startTime.toLocaleTimeString()}</td>
                    <td>{session.lastActivity.toLocaleTimeString()}</td>
                    <td>
                      {metrics && (
                        <div className="performance-summary">
                          <span>Load: {metrics.initialLoadTime}ms</span>
                          <span>Avg: {metrics.averageImageLoadTime.toFixed(0)}ms</span>
                          <span>Errors: {metrics.errorCount}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => forceCloseSession(session.sessionId)}
                        className="close-session-button"
                        title={t('monitoring.force_close_session')}
                      >
                        {t('monitoring.close')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cache Statistics */}
      <div className="cache-statistics-section">
        <h3>{t('monitoring.cache_statistics')}</h3>
        <div className="cache-metrics">
          {(() => {
            const cacheMetrics = imagingCache.getMetrics();
            return (
              <>
                <div className="metric">
                  <label>{t('monitoring.cached_studies')}</label>
                  <span>{cacheMetrics.totalCachedStudies}</span>
                </div>
                <div className="metric">
                  <label>{t('monitoring.cache_size')}</label>
                  <span>{(cacheMetrics.totalCacheSize / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                <div className="metric">
                  <label>{t('monitoring.cache_hit_rate')}</label>
                  <span>{(cacheMetrics.cacheHitRate * 100).toFixed(1)}%</span>
                </div>
                <div className="metric">
                  <label>{t('monitoring.avg_load_time')}</label>
                  <span>{cacheMetrics.averageLoadTime.toFixed(0)}ms</span>
                </div>
              </>
            );
          })()}
        </div>
        <div className="cache-actions">
          <button
            onClick={() => imagingCache.clearCache()}
            className="clear-cache-button"
          >
            {t('monitoring.clear_cache')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OHIFMonitoringDashboard;