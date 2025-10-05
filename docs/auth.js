// Simple client-side demo auth (no backend) for GitHub Pages
// Stores a lightweight session token + role in localStorage.
// NOT FOR PRODUCTION USE.
const DEMO_USERS = [
  { user: 'demo@patient.com', pass: 'patient123', role: 'patient' },
  { user: 'patient', pass: 'patient123', role: 'patient' },
  { user: 'doctor@webqx.com', pass: 'provider123', role: 'provider' },
  { user: 'doctor', pass: 'provider123', role: 'provider' },
  { user: 'physician@webqx.com', pass: 'demo123', role: 'provider' },
  { user: 'physician', pass: 'demo123', role: 'provider' },
  { user: 'admin@webqx.com', pass: 'admin123', role: 'admin' },
  { user: 'admin', pass: 'admin123', role: 'admin' }
];

export function loginDemo(username, password) {
  const match = DEMO_USERS.find(u => u.user.toLowerCase() === username.toLowerCase() && u.pass === password);
  if (!match) return null;
  const session = { user: match.user, role: match.role, ts: Date.now() };
  localStorage.setItem('webqx_demo_session', JSON.stringify(session));
  return session;
}

export function currentSession() {
  try { return JSON.parse(localStorage.getItem('webqx_demo_session')||'null'); } catch { return null; }
}

export function logout() {
  localStorage.removeItem('webqx_demo_session');
  window.location.href = 'login.html';
}

export function requireAuth(opts={}) {
  const sess = currentSession();
  if(!sess) {
    const ret = encodeURIComponent(window.location.pathname.replace(/.*\/docs\//,'') + window.location.search);
    window.location.href = `login.html?redirect=${ret}`;
    return false;
  }
  if(opts.role && sess.role !== opts.role) {
    // basic role check; redirect to user's home for mismatch
    window.location.href = roleHome(sess.role);
    return false;
  }
  return true;
}

export function roleHome(role) {
  switch(role){
    case 'patient': return 'patient-portal.html';
    case 'provider': return 'provider-panel.html';
    case 'admin': return 'admin-console.html';
    default: return 'admin-console.html';
  }
}
