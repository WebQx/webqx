import React, { useEffect, useState } from 'react';
import { computeBasePath } from './basePath';

interface PlacementInfo { id: string; path: string; ok: boolean; }

const TARGETS: { id: string; path: string }[] = [
  { id: 'patient-portal', path: 'patient-portal/' },
  { id: 'provider', path: 'provider/' },
  { id: 'admin-console', path: 'admin-console/' },
  // Demo pages removed; keep only production-relevant sections
  { id: 'login', path: 'login.html' },
  { id: 'auth', path: 'auth/' },
  { id: 'modules', path: 'modules/' }
];

export const PlacementStatusPanel: React.FC = () => {
  const [items, setItems] = useState<PlacementInfo[]>([]);
  const [ts, setTs] = useState<string>('');

  useEffect(() => {
    let active = true;
  const base = computeBasePath();
    const run = async () => {
      const results: PlacementInfo[] = [];
      for (const t of TARGETS) {
        try {
          const resp = await fetch(base + t.path, { method: 'HEAD' });
          results.push({ id: t.id, path: t.path, ok: resp.ok });
        } catch {
          results.push({ id: t.id, path: t.path, ok: false });
        }
      }
      if (active) { setItems(results); setTs(new Date().toLocaleTimeString()); }
    };
    run();
    const id = setInterval(run, 20000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const healthy = items.filter(i => i.ok).length;

  return (
    <div className="panel" style={{ gridColumn: '1 / -1' }}>
      <h2 style={{ marginTop: 0 }}>Placement Status <small className="muted">{healthy}/{items.length}</small></h2>
      {!items.length && <div className="loading-skeleton" style={{ height: 40 }} />}
      {items.length > 0 && (
        <div style={{ display: 'grid', gap: '.4rem', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
          {items.map(i => (
            <div key={i.id} className="feature-flag" style={{ background: i.ok ? 'rgba(5,150,105,.15)' : '#f1f5f9', color: i.ok ? '#065f46' : '#475569' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: i.ok ? 'var(--ok)' : 'var(--danger)' }} />
              <span style={{ fontSize: '.65rem' }}>{i.id}</span>
            </div>
          ))}
        </div>
      )}
      <footer className="meta">HEAD probe every 20s • Last check: {ts || '—'} • Base derived</footer>
    </div>
  );
};

// deriveBase removed in favor of computeBasePath
