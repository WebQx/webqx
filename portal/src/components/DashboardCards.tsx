import React, { useMemo } from 'react';
import { MODULE_CATALOG } from './PortalContent';
import { useAuth } from './AuthContext';
import { computeBasePath } from './basePath';

export interface DashboardLink {
  id: string;
  title: string;
  description: string;
  href?: string; // optional now; we can rely on hash routing
  badge?: string;
  external?: boolean;
  category?: string;
}

// Legacy function removed; replaced by computeBasePath()

interface DashboardCardsProps { onSelect: (id: string) => void; selectedId: string | null; }

export const DashboardCards: React.FC<DashboardCardsProps> = ({ onSelect, selectedId }) => {
  const { role } = useAuth();
  const base = computeBasePath();
  const links: DashboardLink[] = useMemo(() => MODULE_CATALOG
    .filter(m => !role || !m.roles || m.roles.includes(role))
    .map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      href: m.externalHref ? base + m.externalHref : undefined,
      badge: m.category === 'FHIR' ? 'FHIR' : (m.category === 'Docs' ? 'Docs' : (m.category === 'AI' ? 'AI' : undefined)),
      category: m.category
    })), [base, role]);

  return (
    <div className="panel" style={{ gridColumn: '1 / -1' }}>
  <h2 style={{ marginTop: 0 }}>Healthcare Modules {role && <span style={{ fontSize: '.6rem', color: 'var(--muted)', fontWeight: 400 }}>({role} view)</span>}</h2>
      <div className="cards">
        {links.map(l => {
          const active = l.id === selectedId;
          return (
            <div
              key={l.id}
              className="card-link"
              style={{ cursor: 'pointer', outline: active ? '2px solid var(--accent)' : 'none', position: 'relative' }}
              onClick={(e) => {
                // If user holds meta/ctrl open original target in new tab
                if ((e.metaKey || e.ctrlKey) && l.href) {
                  window.open(l.href, '_blank');
                  return;
                }
                onSelect(l.id);
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
                <h3>{l.title}</h3>
                {l.badge && <span className="badge">{l.badge}</span>}
              </div>
              <p>{l.description}</p>
              {l.href && (
                <div className="card-actions" style={{ display: 'flex', gap: '.4rem', marginTop: '.6rem' }}>
                  <button className="btn secondary small" onClick={(e) => { e.stopPropagation(); onSelect(l.id); }}>Details</button>
                  <a className="btn small" href={l.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Open module ↗</a>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <footer className="meta" style={{ fontSize: '.55rem' }}>Click to view details inline • Ctrl/Cmd+Click opens legacy destination • {links.length} modules</footer>
    </div>
  );
};
