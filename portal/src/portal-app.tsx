import React, { useState } from 'react';
import { DashboardCards } from './components/DashboardCards';
import { AuthPanel } from './components/AuthPanel';
// Diagnostics now lazy-toggle (SystemStatus + Placement) inside DiagnosticsSection
import { ReadmePreview } from './components/ReadmePreview';
import { PortalContent } from './components/PortalContent';
import { AuthProvider, useAuth } from './components/AuthContext';
import { computeBasePath } from './components/basePath';
import { HeroWelcome } from './components/HeroWelcome';
import { DiagnosticsSection } from './components/DiagnosticsSection';
import { QuickStart } from './components/QuickStart';
import { RoleGate } from './components/RoleGate';
import { ProviderMetrics } from './components/ProviderMetrics';

const AppInner: React.FC = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const { role } = useAuth();

  // Keep URL stable (no hash); internal state controls selection.
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Show provider metrics only for provider/admin roles
  const showProviderMetrics = role === 'provider' || role === 'admin';

  return (
    <div className="portal-shell">
      <RoleGate />
      <header className="portal-header">
        <h1>WebQX Portal</h1>
        <nav>
          <button onClick={() => scrollTo('welcome')}>Dashboard</button>
          <button onClick={() => scrollTo('experiences')}>Modules</button>
          <button onClick={() => scrollTo('overview')}>Overview</button>
          <button onClick={() => scrollTo('diagnostics')}>Diagnostics</button>
          <button onClick={() => scrollTo('session')}>Session</button>
        </nav>
      </header>
      <div className="grid" style={{ gap: '1.25rem' }}>
        <HeroWelcome />
        {showProviderMetrics && <ProviderMetrics />}
        <QuickStart onSelect={setSelected} scrollTo={scrollTo} />
        {/* Experiences & content are visible even before role; internal gating handles access notes */}
        <section id="experiences">
          <DashboardCards onSelect={setSelected} selectedId={selected} />
        </section>
        <section id="content-detail">
          <PortalContent selectedId={selected} base={computeBasePath()} onClose={() => { setSelected(null); }} />
        </section>
        <section id="overview">
          <ReadmePreview />
        </section>
        <section id="diagnostics">
          <DiagnosticsSection />
        </section>
        <section id="session" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '1.25rem' }}>
          <AuthPanel />
        </section>
      </div>
      <footer className="site-footer">WebQX Healthcare Platform © {new Date().getFullYear()} • Enhanced Portal Dashboard Preview</footer>
    </div>
  );
};

export const PortalApp: React.FC = () => (
  <AuthProvider>
    <AppInner />
  </AuthProvider>
);

// Local deriveBase removed; using computeBasePath utility
