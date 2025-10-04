// Dynamic navigation builder + active highlighting
const PAGES = [
  { href: 'index.html', label: 'Home' },
  { href: 'patient.html', label: 'Patient' },
  { href: 'provider.html', label: 'Provider' },
  { href: 'metrics.html', label: 'Metrics' },
  { href: 'system.html', label: 'System' },
  { href: 'env.html', label: 'Env' },
  { href: 'security.html', label: 'Security' },
  { href: 'fhir.html', label: 'FHIR' },
  { href: 'telehealth.html', label: 'Telehealth' },
  { href: 'transcription.html', label: 'Transcription' },
  { href: 'rate-limit.html', label: 'Rate Limit' },
  { href: 'dependencies.html', label: 'Deps' }
];

(function initNav(){
  const nav = document.querySelector('header nav.links');
  if(!nav) return;
  nav.innerHTML = PAGES.map(p=>`<a href="${p.href}" data-nav="${p.href}">${p.label}</a>`).join('');
  const here = location.pathname.split('/').pop() || 'index.html';
  const active = nav.querySelector(`[data-nav='${here}']`);
  if(active){ active.classList.add('active-link'); }
})();
