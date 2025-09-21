import React, { useEffect, useState } from 'react';

interface FeatureFlags {
  USE_REMOTE_OPENEMR?: boolean;
  TRANSCRIPTION_CONFIGURED?: boolean;
  ENVIRONMENT?: string;
}

export const FeaturesPanel: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);

  useEffect(() => {
    let active = true;
    let interval: any = null;
    const load = async () => {
      try {
        const res = await fetch('/health');
        if (!res.ok) throw new Error('Health endpoint not available');
        const data = await res.json();
        const cfg = data?.config || {};
        const feature: FeatureFlags = {
          USE_REMOTE_OPENEMR: !!cfg.useRemoteOpenEMR,
          TRANSCRIPTION_CONFIGURED: !!cfg.transcriptionConfigured,
          ENVIRONMENT: cfg.environment || 'development'
        };
        if (active) setFlags(feature);
      } catch (e: any) {
        // On error, keep showing last known flags; do not switch to demo mode
      }
    };
    load();
    interval = setInterval(load, 15000);
    return () => { active = false; if (interval) clearInterval(interval); };
  }, []);

  return (
    <div style={panelStyle}>
      <h2 style={titleStyle}>Runtime Configuration</h2>
  {!flags && <div>Loading...</div>}
      {flags && (
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          <li><strong>ENVIRONMENT</strong>: {flags.ENVIRONMENT}</li>
          <li><strong>USE_REMOTE_OPENEMR</strong>: {flags.USE_REMOTE_OPENEMR ? 'ENABLED' : 'disabled'}</li>
          <li><strong>TRANSCRIPTION_CONFIGURED</strong>: {flags.TRANSCRIPTION_CONFIGURED ? 'ENABLED' : 'disabled'}</li>
        </ul>
      )}
    </div>
  );
};

const panelStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: '1rem',
  background: '#fff'
};
const titleStyle: React.CSSProperties = { marginTop: 0, fontSize: '1.1rem' };
