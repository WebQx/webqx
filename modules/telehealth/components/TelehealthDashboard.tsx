import React, { useState, useEffect, useMemo } from 'react';
import {
  TelehealthDashboardData,
  TelehealthSession,
  DashboardSummary,
  UsageAnalytics,
  QualityInsights,
  TelehealthSessionStatus
} from '../types';
import { telehealthService } from '../services/telehealthService';

/**
 * Props for TelehealthDashboard component
 */
export interface TelehealthDashboardProps {
  /** Optional provider ID filter */
  providerId?: string;
  /** Optional date range filter */
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  /** Dashboard refresh interval in seconds */
  refreshInterval?: number;
  /** Callback for session selection */
  onSessionSelect?: (session: TelehealthSession) => void;
  /** Callback for errors */
  onError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Compact view for embedding */
  compact?: boolean;
}

/**
 * TelehealthDashboard component provides comprehensive analytics and insights
 */
export const TelehealthDashboard: React.FC<TelehealthDashboardProps> = ({
  providerId,
  dateRange,
  refreshInterval = 30,
  onSessionSelect,
  onError,
  className = '',
  compact = false
}) => {
  const [dashboardData, setDashboardData] = useState<TelehealthDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /**
   * Load dashboard data
   */
  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const result = await telehealthService.getDashboardData(providerId, dateRange);
      
      if (result.success && result.data) {
        setDashboardData(result.data);
        setError(null);
        setLastUpdated(new Date());
      } else {
        const errorMsg = result.error?.message || 'Failed to load dashboard data';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load data on mount and set up refresh interval
   */
  useEffect(() => {
    loadDashboardData();

    const interval = setInterval(loadDashboardData, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [providerId, dateRange, refreshInterval]);

  /**
   * Format session status for display
   */
  const formatSessionStatus = (status: TelehealthSessionStatus): string => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  /**
   * Get status color class
   */
  const getStatusColor = (status: TelehealthSessionStatus): string => {
    switch (status) {
      case 'scheduled': return 'status-scheduled';
      case 'waiting_room': return 'status-waiting';
      case 'in_progress': return 'status-active';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      case 'no_show': return 'status-no-show';
      default: return 'status-unknown';
    }
  };

  /**
   * Memoized calculations for performance
   */
  const calculations = useMemo(() => {
    if (!dashboardData) return null;

    const { summary } = dashboardData;
    
    return {
      completionPercentage: summary.totalSessions > 0 
        ? Math.round((summary.completionRate * 100)) 
        : 0,
      noShowPercentage: summary.totalSessions > 0 
        ? Math.round((summary.noShowRate * 100)) 
        : 0,
      averageDurationFormatted: `${Math.round(summary.averageSessionDuration)} min`,
      sessionsGrowth: {
        daily: summary.sessionsToday,
        weekly: summary.sessionsThisWeek,
        monthly: summary.sessionsThisMonth
      }
    };
  }, [dashboardData]);

  if (isLoading && !dashboardData) {
    return (
      <div className={`telehealth-dashboard loading ${className}`}>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading telehealth analytics...</p>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className={`telehealth-dashboard error ${className}`}>
        <div className="error-container">
          <h2>📊 Dashboard Error</h2>
          <p>{error}</p>
          <button onClick={loadDashboardData}>
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className={`telehealth-dashboard no-data ${className}`}>
        <div className="no-data-container">
          <h2>📊 Telehealth Dashboard</h2>
          <p>No telehealth session data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`telehealth-dashboard ${compact ? 'compact' : ''} ${className}`}>
      {/* Dashboard Header */}
      {!compact && (
        <header className="dashboard-header">
          <h1>📊 Telehealth Analytics Dashboard</h1>
          {lastUpdated && (
            <p className="last-updated">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </header>
      )}

      {/* Summary Statistics */}
      <section className="summary-stats">
        <h2 className={compact ? 'compact-heading' : ''}>📈 Session Overview</h2>
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-value">{dashboardData.summary.totalSessions}</div>
            <div className="stat-label">Total Sessions</div>
          </div>
          
          <div className="stat-card today">
            <div className="stat-value">{dashboardData.summary.sessionsToday}</div>
            <div className="stat-label">Today</div>
          </div>
          
          <div className="stat-card week">
            <div className="stat-value">{dashboardData.summary.sessionsThisWeek}</div>
            <div className="stat-label">This Week</div>
          </div>
          
          <div className="stat-card month">
            <div className="stat-value">{dashboardData.summary.sessionsThisMonth}</div>
            <div className="stat-label">This Month</div>
          </div>
          
          <div className="stat-card completion">
            <div className="stat-value">{calculations?.completionPercentage}%</div>
            <div className="stat-label">Completion Rate</div>
          </div>
          
          <div className="stat-card duration">
            <div className="stat-value">{calculations?.averageDurationFormatted}</div>
            <div className="stat-label">Avg Duration</div>
          </div>
        </div>
      </section>

      {/* Recent Sessions */}
      <section className="recent-sessions">
        <h2 className={compact ? 'compact-heading' : ''}>⏰ Recent Sessions</h2>
        {dashboardData.recentSessions.length === 0 ? (
          <p className="no-sessions">No recent sessions found.</p>
        ) : (
          <div className="sessions-list">
            {dashboardData.recentSessions.slice(0, compact ? 3 : 10).map((session) => (
              <div 
                key={session.id} 
                className="session-card"
                onClick={() => onSessionSelect?.(session)}
                style={{ cursor: onSessionSelect ? 'pointer' : 'default' }}
              >
                <div className="session-header">
                  <span className="session-id">#{session.id.slice(0, 8)}</span>
                  <span className={`session-status ${getStatusColor(session.status)}`}>
                    {formatSessionStatus(session.status)}
                  </span>
                </div>
                
                <div className="session-details">
                  <div className="session-time">
                    📅 {session.scheduledStartTime.toLocaleDateString()} 
                    at {session.scheduledStartTime.toLocaleTimeString()}
                  </div>
                  
                  {session.chiefComplaint && (
                    <div className="session-complaint">
                      🩺 {session.chiefComplaint}
                    </div>
                  )}
                  
                  <div className="session-participants">
                    👥 {session.participants.length} participant{session.participants.length !== 1 ? 's' : ''}
                    {session.durationMinutes && (
                      <span className="session-duration">
                        • ⏱️ {session.durationMinutes} min
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quality Insights - Only in full view */}
      {!compact && dashboardData.qualityInsights && (
        <section className="quality-insights">
          <h2>⭐ Quality Insights</h2>
          <div className="insights-grid">
            {/* Common Issues */}
            <div className="insight-card issues">
              <h3>⚠️ Common Issues</h3>
              {dashboardData.qualityInsights.commonIssues.length === 0 ? (
                <p className="no-issues">No quality issues reported! 🎉</p>
              ) : (
                <ul className="issues-list">
                  {dashboardData.qualityInsights.commonIssues.slice(0, 5).map((issue, index) => (
                    <li key={index} className={`issue-item ${issue.impact}`}>
                      <span className="issue-name">{issue.issue}</span>
                      <span className="issue-frequency">{issue.frequency} times</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Device Quality */}
            <div className="insight-card devices">
              <h3>📱 Quality by Device</h3>
              {dashboardData.qualityInsights.qualityByDevice.length === 0 ? (
                <p className="no-data">No device quality data available.</p>
              ) : (
                <div className="device-quality-list">
                  {dashboardData.qualityInsights.qualityByDevice.map((device, index) => (
                    <div key={index} className="device-quality-item">
                      <span className="device-type">{device.deviceType}</span>
                      <div className="quality-bar">
                        <div 
                          className="quality-fill"
                          style={{ width: `${(device.averageQuality / 5) * 100}%` }}
                        ></div>
                      </div>
                      <span className="quality-score">{device.averageQuality.toFixed(1)}/5</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Usage Analytics - Only in full view */}
      {!compact && dashboardData.analytics && (
        <section className="usage-analytics">
          <h2>📊 Usage Analytics</h2>
          <div className="analytics-grid">
            {/* Device Distribution */}
            <div className="analytics-card device-distribution">
              <h3>📱 Device Types</h3>
              {dashboardData.analytics.deviceTypes.length === 0 ? (
                <p className="no-data">No device data available.</p>
              ) : (
                <div className="device-chart">
                  {dashboardData.analytics.deviceTypes.map((device, index) => (
                    <div key={index} className="device-item">
                      <span className="device-name">{device.type}</span>
                      <div className="device-bar">
                        <div 
                          className="device-fill"
                          style={{ width: `${device.percentage}%` }}
                        ></div>
                      </div>
                      <span className="device-percentage">{device.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Language Distribution */}
            <div className="analytics-card locale-distribution">
              <h3>🌍 Languages</h3>
              {dashboardData.analytics.localeDistribution.length === 0 ? (
                <p className="no-data">No language data available.</p>
              ) : (
                <div className="locale-chart">
                  {dashboardData.analytics.localeDistribution.map((locale, index) => (
                    <div key={index} className="locale-item">
                      <span className="locale-name">{locale.locale}</span>
                      <div className="locale-bar">
                        <div 
                          className="locale-fill"
                          style={{ width: `${locale.percentage}%` }}
                        ></div>
                      </div>
                      <span className="locale-percentage">{locale.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Styles */}
      <style jsx>{`
        .telehealth-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .telehealth-dashboard.compact {
          padding: 15px;
        }

        .dashboard-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .dashboard-header h1 {
          color: #333;
          margin: 0 0 10px 0;
        }

        .last-updated {
          color: #6c757d;
          font-size: 14px;
          margin: 0;
        }

        .compact-heading {
          font-size: 18px !important;
          margin-bottom: 15px !important;
        }

        .loading-container, .error-container, .no-data-container {
          text-align: center;
          padding: 40px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .summary-stats, .recent-sessions, .quality-insights, .usage-analytics {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .telehealth-dashboard.compact .summary-stats,
        .telehealth-dashboard.compact .recent-sessions {
          padding: 15px;
          margin-bottom: 15px;
        }

        .summary-stats h2, .recent-sessions h2, .quality-insights h2, .usage-analytics h2 {
          margin: 0 0 20px 0;
          color: #333;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 15px;
        }

        .telehealth-dashboard.compact .stats-grid {
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .stat-card {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          border-left: 4px solid #007bff;
        }

        .telehealth-dashboard.compact .stat-card {
          padding: 10px;
        }

        .stat-card.total { border-left-color: #007bff; }
        .stat-card.today { border-left-color: #28a745; }
        .stat-card.week { border-left-color: #ffc107; }
        .stat-card.month { border-left-color: #17a2b8; }
        .stat-card.completion { border-left-color: #6f42c1; }
        .stat-card.duration { border-left-color: #fd7e14; }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
          margin-bottom: 5px;
        }

        .telehealth-dashboard.compact .stat-value {
          font-size: 18px;
        }

        .stat-label {
          font-size: 12px;
          color: #6c757d;
          text-transform: uppercase;
        }

        .sessions-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .session-card {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          padding: 15px;
          transition: background-color 0.2s;
        }

        .telehealth-dashboard.compact .session-card {
          padding: 10px;
        }

        .session-card:hover {
          background: #e9ecef;
        }

        .session-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .session-id {
          font-family: monospace;
          font-weight: bold;
          color: #495057;
        }

        .session-status {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
        }

        .status-scheduled { background: #fff3cd; color: #856404; }
        .status-waiting { background: #cce5ff; color: #004085; }
        .status-active { background: #d4edda; color: #155724; }
        .status-completed { background: #e2e3e5; color: #383d41; }
        .status-cancelled { background: #f8d7da; color: #721c24; }
        .status-no-show { background: #f5c6cb; color: #721c24; }

        .session-details {
          font-size: 14px;
          color: #6c757d;
        }

        .session-time, .session-complaint, .session-participants {
          margin-bottom: 5px;
        }

        .session-duration {
          margin-left: 10px;
        }

        .insights-grid, .analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .insight-card, .analytics-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #dee2e6;
        }

        .insight-card h3, .analytics-card h3 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 16px;
        }

        .issues-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .issue-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #dee2e6;
        }

        .issue-item:last-child {
          border-bottom: none;
        }

        .issue-item.high { border-left: 3px solid #dc3545; padding-left: 10px; }
        .issue-item.medium { border-left: 3px solid #ffc107; padding-left: 10px; }
        .issue-item.low { border-left: 3px solid #28a745; padding-left: 10px; }

        .issue-frequency {
          font-size: 12px;
          color: #6c757d;
        }

        .device-quality-list, .device-chart, .locale-chart {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .device-quality-item, .device-item, .locale-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .device-type, .device-name, .locale-name {
          min-width: 80px;
          font-size: 12px;
          font-weight: bold;
        }

        .quality-bar, .device-bar, .locale-bar {
          flex: 1;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }

        .quality-fill {
          height: 100%;
          background: linear-gradient(to right, #dc3545, #ffc107, #28a745);
          transition: width 0.3s ease;
        }

        .device-fill, .locale-fill {
          height: 100%;
          background: #007bff;
          transition: width 0.3s ease;
        }

        .quality-score, .device-percentage, .locale-percentage {
          min-width: 40px;
          font-size: 12px;
          font-weight: bold;
          text-align: right;
        }

        .no-sessions, .no-issues, .no-data {
          color: #6c757d;
          font-style: italic;
          text-align: center;
          padding: 20px;
        }

        .error-container button {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin-top: 15px;
        }

        .error-container button:hover {
          background: #0056b3;
        }
      `}</style>
    </div>
  );
};

export default TelehealthDashboard;