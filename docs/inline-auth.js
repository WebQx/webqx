// Inline auth helper for standalone demo pages (no shared dashboard)
// Provides: ensureSession(containerCb) which renders an overlay login if not authed.
const INLINE_DEMO_USERS=[
  {u:'demo@patient.com',p:'patient123',r:'patient'},
  {u:'doctor@webqx.com',p:'provider123',r:'provider'},
  {u:'physician@webqx.com',p:'demo123',r:'provider'},
  {u:'admin@webqx.com',p:'admin123',r:'admin'}
];
// Look for either inline or legacy main login session; normalize to inline key.
function getSess(){
  try {
    const inline = localStorage.getItem('inline_demo_session');
    if(inline) return JSON.parse(inline);
    const legacy = localStorage.getItem('webqx_demo_session');
    if(legacy){
      const sess = JSON.parse(legacy);
      try { localStorage.setItem('inline_demo_session', legacy); } catch {}
      return sess;
    }
  } catch {}
  return null;
}
function setSess(s){
  const str=JSON.stringify(s);
  try { localStorage.setItem('inline_demo_session',str); } catch {}
  try { localStorage.setItem('webqx_demo_session',str); } catch {}
}
export function logoutInline(){localStorage.removeItem('inline_demo_session');location.reload();}
export function ensureSession(onReady){const s=getSess();if(s){onReady(s);return;}if(document.getElementById('inlineAuthOverlay')){return;}renderLogin(onReady);} 
export function ensureSessionRole(roles,onReady){roles=Array.isArray(roles)?roles:[roles];ensureSession(sess=>{if(!roles.includes(sess.role)){alert('Access restricted to: '+roles.join(', '));logoutInline();return;}onReady(sess);});}
function renderLogin(onReady){if(document.getElementById('inlineAuthOverlay')) return;const wrap=document.createElement('div');wrap.id='inlineAuthOverlay';wrap.innerHTML=`<div style="position:fixed;inset:0;background:#0b1116;display:flex;align-items:center;justify-content:center;font-family:system-ui;z-index:9999">
  <div style="background:#121b23;border:1px solid #1f2c37;padding:1.8rem 2rem;border-radius:14px;color:#d4dde5;width:100%;max-width:420px;box-shadow:0 10px 40px -8px #000;font-size:14px;">
    <h1 style="margin:0 0 .25rem;font-size:1.2rem;letter-spacing:.5px;color:#eef5fa">WebQX Demo Login</h1>
    <p style="margin:0 0 1rem;font-size:.65rem;letter-spacing:.6px;text-transform:uppercase;color:#7d8d99">Standalone Page Access</p>
    <div id="err" style="display:none;background:#3f1d28;border:1px solid #7f243b;padding:.45rem .6rem;border-radius:6px;font-size:.62rem;margin-bottom:.75rem;color:#f8d7da"></div>
    <form id="f" style="display:flex;flex-direction:column;gap:.75rem">
      <div style="display:flex;flex-direction:column;gap:.35rem"><label style="font-size:.62rem;font-weight:600;letter-spacing:.5px;color:#9fb4c7">Email / Username</label><input id="user" required style="background:#0d1419;border:1px solid #27323d;padding:.55rem .6rem;border-radius:6px;color:#eef5fa;font-size:.75rem"/></div>
      <div style="display:flex;flex-direction:column;gap:.35rem"><label style="font-size:.62rem;font-weight:600;letter-spacing:.5px;color:#9fb4c7">Password</label><input id="pass" type="password" required style="background:#0d1419;border:1px solid #27323d;padding:.55rem .6rem;border-radius:6px;color:#eef5fa;font-size:.75rem"/></div>
      <button style="background:#2563eb;border:1px solid #1d4ed8;color:#fff;padding:.6rem .75rem;border-radius:6px;font-size:.7rem;letter-spacing:.5px;font-weight:600;cursor:pointer">Enter Demo</button>
      <div style="font-size:.58rem;line-height:1.05rem;color:#788a96;margin-top:.25rem">Use any demo credential below. No PHI. Client-side only.</div>
    </form>
    <div style="margin-top:1rem;background:#0d1419;border:1px solid #27323d;padding:.55rem .65rem;border-radius:8px;font-size:.6rem;line-height:1rem" id="creds"></div>
  </div>
</div>`;document.body.appendChild(wrap);const credsDiv=wrap.querySelector('#creds');credsDiv.innerHTML=INLINE_DEMO_USERS.map(c=>`<div><code>${c.u}</code> / <code>${c.p}</code> <span style='opacity:.6'>(${c.r})</span></div>`).join('');const form=wrap.querySelector('#f');const err=wrap.querySelector('#err');form.addEventListener('submit',e=>{e.preventDefault();err.style.display='none';const u=form.querySelector('#user').value.trim();const p=form.querySelector('#pass').value.trim();const match=INLINE_DEMO_USERS.find(x=>x.u.toLowerCase()===u.toLowerCase()&&x.p===p)||(INLINE_DEMO_USERS.find(x=>x.u.split('@')[0]===u&&x.p===p));if(!match){err.textContent='Invalid credentials';err.style.display='block';return;}const sess={user:match.u,role:match.r,ts:Date.now()};setSess(sess);wrap.remove();onReady(sess);});}
