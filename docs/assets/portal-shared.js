// Shared portal helpers: unified nav + session utilities for persona pages.
// Lightweight, no framework. Injects a role-aware navigation bar.

export function currentDemoSession(){
  try {
    const inline = localStorage.getItem('inline_demo_session');
    if(inline) return JSON.parse(inline);
    const legacy = localStorage.getItem('webqx_demo_session');
    if(legacy) return JSON.parse(legacy);
  } catch {}
  return null;
}

export function clearDemoSession(){
  try { localStorage.removeItem('inline_demo_session'); } catch {}
  try { localStorage.removeItem('webqx_demo_session'); } catch {}
}

export function roleHome(role){
  switch(role){
    case 'patient': return 'patient-portal.html';
    case 'provider': return 'provider-panel.html';
    case 'admin': return 'admin-console.html';
    default: return 'index.html';
  }
}

function ensureBaseStyles(){
  if(document.getElementById('portalSharedStyles')) return;
  const s=document.createElement('style');
  s.id='portalSharedStyles';
  s.textContent=`.portal-nav{display:flex;align-items:center;justify-content:space-between;padding:.55rem .9rem;background:#11181f;border-bottom:1px solid #1e2932;font-family:system-ui,-apple-system,Segoe UI,Roboto;position:sticky;top:0;z-index:500}`+
  `.portal-nav .brand{font-size:.8rem;font-weight:600;letter-spacing:.5px;color:#e2eef7;text-decoration:none}`+
  `.portal-nav .links{display:flex;gap:.6rem;align-items:center}`+
  `.portal-nav a.nav-link{font-size:.6rem;padding:.4rem .55rem;border-radius:6px;text-decoration:none;color:#b5c6d4;background:#18232c;border:1px solid #253341}`+
  `.portal-nav a.nav-link.active{background:#2563eb;border-color:#1d4ed8;color:#fff}`+
  `.portal-nav a.nav-link:hover{background:#223140}`+
  `.portal-nav .session-box{display:flex;align-items:center;gap:.5rem;font-size:.55rem;color:#9fb3c5}`+
  `.portal-nav button.logout{background:#2b3b46;border:1px solid #374a56;color:#fff;font-size:.55rem;padding:.4rem .55rem;border-radius:6px;cursor:pointer}`+
  `.portal-nav button.logout:hover{background:#374a56}`;
  document.head.appendChild(s);
}

export function injectPortalNav(opts={}){
  ensureBaseStyles();
  const sess = opts.session || currentDemoSession();
  const current = opts.current || (sess && sess.role) || '';
  const nav=document.createElement('div');
  nav.className='portal-nav';
  nav.innerHTML=`<a class="brand" href="index.html">WebQX Demo</a>
    <div class="links">
      <a class="nav-link ${current==='patient'?'active':''}" href="patient-portal.html">Patient</a>
      <a class="nav-link ${current==='provider'?'active':''}" href="provider-panel.html">Provider</a>
      <a class="nav-link ${current==='admin'?'active':''}" href="admin-console.html">Admin</a>
      <a class="nav-link ${current==='hub'?'active':''}" href="hub.html">Technical Hub</a>
    </div>
    <div class="session-box" id="portalSessionBox">
      ${sess?`<span>${sess.user} • ${sess.role}</span><button class="logout" id="portalLogoutBtn">Logout</button>`:'<span>Not signed in</span>'}
    </div>`;
  document.body.insertBefore(nav, document.body.firstChild);
  if(sess){
    nav.querySelector('#portalLogoutBtn').addEventListener('click',()=>{
      clearDemoSession();
      if(window.logoutInline){ try{ window.logoutInline(); return;}catch{} }
      location.href='index.html';
    });
  }
}

// Optional auto-inject (disabled by default to allow ordering control)
// if(window.__PORTAL_SHARED_AUTO_INJECT__){ injectPortalNav(); }
