import React from 'react';
import { useProviderDashboard } from './useProviderDashboard';

/**
 * Freshness indicator component
 * Green dot if updated < 30s, amber < 120s, red >= 120s
 */
const FreshnessIndicator: React.FC<{ lastUpdated: Date | null }> = ({ lastUpdated }) => {
  if (!lastUpdated) return null;

  const ageMs = Date.now() - lastUpdated.getTime();
  const ageSec = Math.floor(ageMs / 1000);

  let color = '#10b981'; // green
  let label = 'Fresh';

  if (ageSec >= 120) {
    color = '#ef4444'; // red
    label = 'Stale';
  } else if (ageSec >= 30) {
    color = '#f59e0b'; // amber
    label = 'Recent';
  }

  return (
    <span 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '0.25rem',
        fontSize: '0.75rem',
        color: '#94a3b8'
      }}
      title={`Last updated: ${lastUpdated.toLocaleTimeString()} (${ageSec}s ago)`}
    >
      <span 
        style={{ 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          backgroundColor: color,
          border: ageSec >= 120 ? `2px solid ${color}` : 'none'
        }} 
      />
      {label}
    </span>
  );
};

/**
 * Metric badge component
 */
const MetricBadge: React.FC<{ 
  label: string; 
  value: number | string; 
  tooltip?: string;
  unavailable?: boolean;
}> = ({ label, value, tooltip, unavailable }) => {
  const badgeStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    background: unavailable ? '#1f2937' : '#0f172a',
    border: unavailable ? '1px solid #374151' : '1px solid #1e293b',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#94a3b8',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: unavailable ? '#6b7280' : '#f1f5f9'
  };

  return (
    <div style={badgeStyle} title={tooltip}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{unavailable ? 'N/A' : value}</div>
    </div>
  );
};

/**
 * Provider Metrics component
 * Displays live provider dashboard metrics with freshness indicators
 */
export const ProviderMetrics: React.FC = () => {
  const { data, loading, error, lastUpdated, refresh } = useProviderDashboard();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const containerStyle: React.CSSProperties = {
    padding: '1.5rem',
    background: '#0b1120',
    border: '1px solid #1e293b',
    borderRadius: '12px',
    marginBottom: '1.5rem'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  };

  const refreshButtonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#f1f5f9',
    cursor: 'pointer',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'all 0.2s'
  };

  const metricsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem'
  };

  const transcriptionListStyle: React.CSSProperties = {
    marginTop: '1rem',
    padding: '1rem',
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '8px'
  };

  const transcriptionItemStyle: React.CSSProperties = {
    padding: '0.5rem',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.875rem'
  };

  const errorStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    background: '#7f1d1d',
    border: '1px solid #991b1b',
    borderRadius: '8px',
    color: '#fecaca',
    fontSize: '0.875rem',
    marginTop: '1rem'
  };

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Provider Dashboard</h2>
          <button onClick={handleRefresh} style={refreshButtonStyle}>
            🔄 Retry
          </button>
        </div>
        <div style={errorStyle}>
          ⚠️ {error}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>
          Provider Dashboard
          <FreshnessIndicator lastUpdated={lastUpdated} />
        </h2>
        <button 
          onClick={handleRefresh} 
          style={refreshButtonStyle}
          disabled={isRefreshing}
        >
          {isRefreshing ? '⏳' : '🔄'} Refresh
        </button>
      </div>

      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
          Loading dashboard data...
        </div>
      ) : (
        <>
          <div style={metricsGridStyle}>
            <MetricBadge
              label="Patients"
              value={data?.patients?.count ?? 0}
              tooltip="Source: /emr/patients"
              unavailable={!data?.patients}
            />
            <MetricBadge
              label="Active Sessions"
              value={data?.telehealth?.active ?? 0}
              tooltip="Source: /api/telehealth/sessions (active)"
              unavailable={!data?.telehealth}
            />
            <MetricBadge
              label="Waiting"
              value={data?.telehealth?.waiting ?? 0}
              tooltip="Source: /api/telehealth/sessions (waiting)"
              unavailable={!data?.telehealth}
            />
            <MetricBadge
              label="Files"
              value={data?.files?.total ?? 0}
              tooltip="Source: /emr/files"
              unavailable={!data?.files}
            />
          </div>

          {data?.transcriptionJobs && data.transcriptionJobs.length > 0 && (
            <div style={transcriptionListStyle}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#f1f5f9', marginBottom: '0.75rem' }}>
                Recent Transcription Jobs
              </div>
              {data.transcriptionJobs.map((job, idx) => (
                <div 
                  key={job.id} 
                  style={{
                    ...transcriptionItemStyle,
                    borderBottom: idx === data.transcriptionJobs!.length - 1 ? 'none' : '1px solid #1e293b'
                  }}
                >
                  <span style={{ color: '#94a3b8' }}>Job {job.id}</span>
                  <span style={{ 
                    color: job.status === 'completed' ? '#10b981' : 
                           job.status === 'failed' ? '#ef4444' : '#f59e0b',
                    fontWeight: '500'
                  }}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {data?.errors && data.errors.length > 0 && (
            <div style={errorStyle}>
              <strong>Partial failures:</strong>
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                {data.errors.map((err, idx) => (
                  <li key={idx}>{err.section}: {err.error}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};
