import React from 'react';
import { useDashboard } from './useDashboard';
import { useAuth } from './AuthContext';

export const ProviderDashboard: React.FC = () => {
  const { role } = useAuth();
  const { data, loading, error, lastUpdated, refetch } = useDashboard();

  // Only show for provider and admin roles
  if (role !== 'provider' && role !== 'admin') {
    return null;
  }

  // Calculate freshness (green if < 60s, gray otherwise)
  const isFresh = lastUpdated && (Date.now() - lastUpdated.getTime() < 60000);

  return (
    <div className="panel" style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <h2 style={{ margin: 0 }}>Provider Dashboard</h2>
          {lastUpdated && (
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isFresh ? '#10b981' : '#6b7280'
              }}
              title={`Last updated: ${lastUpdated.toLocaleString()}`}
            />
          )}
        </div>
        <button
          className="btn small"
          onClick={refetch}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '.3rem'
          }}
        >
          <span style={{
            display: 'inline-block',
            animation: loading ? 'spin 1s linear infinite' : 'none'
          }}>↻</span>
          Refresh
        </button>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '.75rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          fontSize: '.8rem'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          Loading dashboard data...
        </div>
      )}

      {data && (
        <>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {/* Patients Card */}
            {data.patients ? (
              <div className="card-link" title="Source: /emr/patients">
                <h3 style={{ fontSize: '.9rem', color: 'var(--accent)' }}>Patients</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '.5rem 0' }}>
                  {data.patients.count}
                </div>
                <p style={{ fontSize: '.7rem', margin: 0, color: 'var(--muted)' }}>Total patients</p>
              </div>
            ) : (
              <div className="card-link" style={{ opacity: 0.6 }}>
                <h3 style={{ fontSize: '.9rem' }}>Patients</h3>
                <div style={{
                  fontSize: '.7rem',
                  padding: '.4rem .6rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  display: 'inline-block',
                  marginTop: '.5rem'
                }}>
                  Unavailable
                </div>
              </div>
            )}

            {/* Telehealth Card */}
            {data.telehealth ? (
              <div className="card-link" title="Source: /api/telehealth/sessions">
                <h3 style={{ fontSize: '.9rem', color: 'var(--accent)' }}>Telehealth</h3>
                <div style={{ display: 'flex', gap: '1rem', margin: '.5rem 0' }}>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{data.telehealth.active}</div>
                    <p style={{ fontSize: '.65rem', margin: 0, color: 'var(--muted)' }}>Active</p>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{data.telehealth.waiting}</div>
                    <p style={{ fontSize: '.65rem', margin: 0, color: 'var(--muted)' }}>Waiting</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-link" style={{ opacity: 0.6 }}>
                <h3 style={{ fontSize: '.9rem' }}>Telehealth</h3>
                <div style={{
                  fontSize: '.7rem',
                  padding: '.4rem .6rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  display: 'inline-block',
                  marginTop: '.5rem'
                }}>
                  Unavailable
                </div>
              </div>
            )}

            {/* Transcription Jobs Card */}
            {data.transcriptionJobs && data.transcriptionJobs.length > 0 ? (
              <div className="card-link" title="Source: /emr/transcribe">
                <h3 style={{ fontSize: '.9rem', color: 'var(--accent)' }}>Transcriptions</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '.5rem 0' }}>
                  {data.transcriptionJobs.length}
                </div>
                <p style={{ fontSize: '.7rem', margin: 0, color: 'var(--muted)' }}>Recent jobs</p>
              </div>
            ) : (
              <div className="card-link" style={{ opacity: 0.6 }}>
                <h3 style={{ fontSize: '.9rem' }}>Transcriptions</h3>
                <div style={{
                  fontSize: '.7rem',
                  padding: '.4rem .6rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  display: 'inline-block',
                  marginTop: '.5rem'
                }}>
                  Unavailable
                </div>
              </div>
            )}

            {/* Files Card */}
            {data.files ? (
              <div className="card-link" title="Source: /emr/files">
                <h3 style={{ fontSize: '.9rem', color: 'var(--accent)' }}>Files</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '.5rem 0' }}>
                  {data.files.total}
                </div>
                <p style={{ fontSize: '.7rem', margin: 0, color: 'var(--muted)' }}>Total files</p>
              </div>
            ) : (
              <div className="card-link" style={{ opacity: 0.6 }}>
                <h3 style={{ fontSize: '.9rem' }}>Files</h3>
                <div style={{
                  fontSize: '.7rem',
                  padding: '.4rem .6rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  display: 'inline-block',
                  marginTop: '.5rem'
                }}>
                  Unavailable
                </div>
              </div>
            )}
          </div>

          {/* Show errors if any */}
          {data.errors && data.errors.length > 0 && (
            <details style={{ marginTop: '1rem', fontSize: '.75rem' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>
                {data.errors.length} service error{data.errors.length !== 1 ? 's' : ''}
              </summary>
              <ul style={{ marginTop: '.5rem', paddingLeft: '1.5rem', color: 'var(--muted)' }}>
                {data.errors.map((err, idx) => (
                  <li key={idx}>
                    <strong>{err.section}:</strong> {err.error}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {data.cached && (
            <p style={{ fontSize: '.65rem', color: 'var(--muted)', marginTop: '.5rem' }}>
              Cached data (refreshes every 30s)
            </p>
          )}
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
