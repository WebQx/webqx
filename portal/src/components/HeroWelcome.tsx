import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export const HeroWelcome: React.FC = () => {
  const { role, setRole } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('webqx_hero_collapsed');
      if (raw != null) return raw === '1';
    } catch {}
    return !!role; // default collapsed after role selection
  });

  useEffect(() => {
    try { localStorage.setItem('webqx_hero_collapsed', collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  return (
    <section id="welcome" style={{ gridColumn: '1 / -1' }}>
      {collapsed ? (
        <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.6rem' }}>
            <strong>Welcome</strong>
            <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>WebQX Production Portal {role ? `• viewing as ${role}` : ''}</span>
          </div>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setCollapsed(false)}>Show Welcome</button>
            {!role && ['patient','provider','admin'].map(r => (
              <button key={r} className="btn" style={{ background: 'rgba(37,99,235,.08)', color: 'var(--accent)' }} onClick={() => setRole(r)}>{r}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="panel" style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', border: 'none', boxShadow: '0 6px 18px -4px rgba(0,0,0,.25)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.9rem', letterSpacing: '.5px' }}>WebQX Production Portal</h1>
            <button onClick={() => setCollapsed(true)} style={{ background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.5)', padding: '.35rem .6rem', borderRadius: 8, cursor: 'pointer', fontSize: '.7rem' }}>Hide</button>
          </div>
          <p style={{ fontSize: '.9rem', lineHeight: 1.4, maxWidth: 780, margin: '.85rem 0 1.2rem', color: 'rgba(255,255,255,.92)' }}>
            Explore patient, provider, and admin perspectives in a single experience. Select a role below to load tailored modules.
            This portal provides access to live healthcare services backed by actual API data.
          </p>
          <div style={{ fontSize: '.9rem', lineHeight: 1.5, maxWidth: 860, margin: '0 0 1.0rem', color: 'rgba(255,255,255,.95)' }}>
            <p style={{ margin: '0 0 .5rem' }}>
              An open-source healthcare platform built to bridge the gap between expensive commercial systems and the underserved communities that need them most. Offering affordable, multilingual, and customizable solutions for safety-net clinics and community hospitals
            </p>
            <p style={{ margin: 0 }}>
              Cloud-based, FHIR-compliant, global healthcare ecosystem with telehealth, Medical Transcription , patient portals, and provider tools integrated with AI.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem', marginBottom: '1rem' }}>
            {['patient','provider','admin'].map(r => (
              <button key={r} onClick={() => setRole(r)} style={{
                background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.35)',
                padding: '.65rem 1rem', borderRadius: 10, cursor: 'pointer', fontSize: '.75rem', letterSpacing: '.5px', fontWeight: 500
              }}>{r.charAt(0).toUpperCase() + r.slice(1)} Role</button>
            ))}
          </div>
          <p style={{ fontSize: '.6rem', margin: 0, opacity: .85 }}>Need live backend metrics? Deploy server stack locally or in cloud infrastructure.</p>
        </div>
      )}
    </section>
  );
};
