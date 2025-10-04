const RAILWAY_BASE = 'https://webqx-production.up.railway.app';
const sel = q=>document.querySelector(q);
const fmt = (o)=>JSON.stringify(o,null,2);

function badge(status){
  const span=document.createElement('span');
  span.className='badge '+(status==='ok'||status==='healthy'?'ok':status==='degraded'?'warn':'err');
  span.textContent=status;
  return span;
}

async function fetchRaw(path){
  const t0=performance.now();
  const res = await fetch(path,{cache:'no-store'});
  const text= await res.text();
  return { ok:res.ok, status:res.status, ms:Math.round(performance.now()-t0), text, headers:res.headers };
}

async function fetchJSON(path){
  const r = await fetchRaw(path);
  let data; try{ data=JSON.parse(r.text);}catch{ data={ raw:r.text }; }
  return { ...r, data };
}

// Existing loaders
async function loadHealth(){
  const out=sel('#healthOut'); if(!out) return;
  out.textContent='Loading /health ...';
  try {
    const r=await fetchJSON(RAILWAY_BASE+'/health');
    out.textContent=fmt(r.data);
    const b=sel('#healthBadge'); if(b){ b.innerHTML=''; b.appendChild(badge(r.data.status|| (r.ok?'ok':'error')));}    
    const m=sel('#healthMeta'); if(m) m.textContent=r.ms+' ms • HTTP '+r.status;
    window.__lastHealth = r.data;
    computeHealthDiff();
  } catch(e){ out.textContent='Error: '+e.message; }
}

async function loadAdapter(){
  const out=sel('#adapterOut'); if(!out) return;
  out.textContent='Loading /emr/status ...';
  try {
    const r=await fetchJSON(RAILWAY_BASE+'/emr/status');
    out.textContent=fmt(r.data);
    const b=sel('#adapterBadge'); if(b){ b.innerHTML=''; let s = r.data.status || (r.ok?'ok':'error'); b.appendChild(badge(s)); }
    const m=sel('#adapterMeta'); if(m) m.textContent=r.ms+' ms • HTTP '+r.status + (r.data.adapter?' • '+r.data.adapter:'');
    window.__lastAdapter = r.data;
    computeHealthDiff();
  } catch(e){ out.textContent='Error: '+e.message; }
}

async function loadPatients(){
  const out=sel('#patientsOut'); if(!out) return;
  out.textContent='Loading /emr/patients ...';
  try {
    const r=await fetchJSON(RAILWAY_BASE+'/emr/patients');
    let patients = (r.data && Array.isArray(r.data.patients)) ? r.data.patients : [];
    if(!patients.length){
      patients = window.__syntheticPatients || generateSyntheticPatients();
      window.__syntheticPatients = patients;
      out.textContent = fmt({ source:'synthetic', patients });
    } else {
      out.textContent = fmt({ source:'api', patients });
    }
    const count = patients.length;
    const m=sel('#patientsMeta'); if(m) m.textContent=r.ms+' ms • HTTP '+r.status+' • '+count+' patients';
    window.__allPatients = patients;
    computePatientStats(patients);
  } catch(e){ out.textContent='Error: '+e.message; }
}

async function loadMetrics(){
  const out=sel('#metricsOut'); if(!out) return;
  out.textContent='Loading /metrics ...';
  try {
    const r=await fetchRaw(RAILWAY_BASE+'/metrics');
    const lines = r.text.split('\n');
    out.textContent=lines.slice(0,120).join('\n');
    const m=sel('#metricsMeta'); if(m) m.textContent='HTTP '+r.status+' (first 120 lines)';
    parseLatencyHistogram(lines);
  } catch(e){ out.textContent='Error: '+e.message; }
}

function parseLatencyHistogram(lines){
  const target='webqx_proxy_http_request_duration_seconds_bucket';
  const buckets = lines.filter(l=>l.startsWith(target));
  if(!buckets.length) return;
  const parsed = buckets.map(l=>{
    const match = l.match(/le="([0-9\.inf]+)".* (\d+)$/);
    return match? { le: match[1], count: Number(match[2]) }: null;
  }).filter(Boolean);
  const histOut = sel('#histogramOut');
  if(histOut){
    // derive per-bucket increment
    let prev=0; const rows = parsed.map(p=>{ const inc=p.count - prev; prev=p.count; return { le:p.le, inc, total:p.count }; });
    const maxInc = rows.reduce((m,r)=>r.inc>m?r.inc:m,0)||1;
    // Build tiny text bars
    const linesOut = rows.map(r=>{
      const width = Math.max(1, Math.round((r.inc/maxInc)*24));
      const bar = '█'.repeat(width);
      const label = r.le==='inf'?'∞':r.le;
      return `${label.padStart(6,' ')} | ${bar} ${r.inc}`;
    });
    histOut.textContent = linesOut.join('\n');
  }
}

function computePatientStats(patients){
  const statsEl=sel('#patientStats'); if(!statsEl || !patients.length) return;
  const avgAge = (patients.reduce((a,p)=>a+p.age,0)/patients.length).toFixed(1);
  const riskCounts = patients.reduce((m,p)=>{ m[p.risk]=(m[p.risk]||0)+1; return m; },{});
  statsEl.textContent = fmt({ count:patients.length, avgAge:Number(avgAge), risk:riskCounts });
}

// New: system status
async function loadSystemStatus(){
  const out=sel('#systemOut'); if(!out) return;
  out.textContent='Loading /api/system/status ...';
  try {
    const r=await fetchJSON(RAILWAY_BASE+'/api/system/status');
    out.textContent=fmt(r.data);
    const m=sel('#systemMeta'); if(m) m.textContent=r.ms+' ms • HTTP '+r.status;
  } catch(e){ out.textContent='Error: '+e.message; }
}

// New: environment snapshot
async function loadEnv(){
  const out=sel('#envOut'); if(!out) return;
  out.textContent='Loading /api/env ...';
  try {
    const r=await fetchJSON(RAILWAY_BASE+'/api/env');
    out.textContent=fmt(r.data);
    const m=sel('#envMeta'); if(m) m.textContent=r.ms+' ms • HTTP '+r.status;
  } catch(e){ out.textContent='Error: '+e.message; }
}

// New: security headers (show selected)
async function loadSecurityHeaders(){
  const out=sel('#headersOut'); if(!out) return;
  out.textContent='Fetching /health headers ...';
  try {
    const r=await fetchRaw(RAILWAY_BASE+'/health');
    const interesting=['content-security-policy','x-content-type-options','x-frame-options','x-xss-protection','strict-transport-security'];
    const presented={}; interesting.forEach(h=>{ const v=r.headers.get(h); if(v) presented[h]=v; });
    out.textContent=fmt({ status:r.status, ms:r.ms, headers:presented });
    const m=sel('#headersMeta'); if(m) m.textContent=r.ms+' ms • HTTP '+r.status;
  } catch(e){ out.textContent='Error: '+e.message; }
}

// New: FHIR connectivity probe (HEAD or OPTIONS attempt)
async function loadFhirProbe(){
  const out=sel('#fhirOut'); if(!out) return;
  out.textContent='Probing FHIR base (OPENEMR demo proxied) ...';
  try {
    // Use a lightweight request to openemr root through default /api/emr (may 502 if remote unreachable)
    const r=await fetchRaw(RAILWAY_BASE+'/api/emr');
    out.textContent=fmt({ status:r.status, ms:r.ms, snippet:r.text.slice(0,240) });
    const m=sel('#fhirMeta'); if(m) m.textContent=r.ms+' ms • HTTP '+r.status;
  } catch(e){ out.textContent='Error: '+e.message; }
}

// New: WebSocket echo test
function initWebSocket(){
  const log=sel('#wsLog'); if(!log) return;
  const statusEl=sel('#wsStatus');
  function append(line){ const pre=document.createElement('div'); pre.textContent=line; log.appendChild(pre); log.scrollTop=log.scrollHeight; }
  const url = RAILWAY_BASE.replace('https','wss')+'/api/telehealth/ws';
  const ws = new WebSocket(url);
  ws.onopen=()=>{ statusEl.textContent='open'; append('Connected: '+url); };
  ws.onmessage=(e)=>{ append('← '+e.data); };
  ws.onclose=()=>{ statusEl.textContent='closed'; append('Connection closed'); };
  sel('#wsSend')?.addEventListener('click',()=>{ const txt=sel('#wsInput').value||'ping'; ws.send(txt); append('→ '+txt); });
}

// New: rate limit probe
async function runRateLimitProbe(){
  const out=sel('#rateOut'); if(!out) return;
  out.textContent='Starting 15 rapid requests to /health ...';
  const results=[];
  for(let i=0;i<15;i++){
    try { const r=await fetchRaw(RAILWAY_BASE+'/health'); results.push({ i, status:r.status, ms:r.ms }); }
    catch(e){ results.push({ i, error:e.message }); }
  }
  out.textContent=fmt(results);
}

// New: transcription placeholder (simulated)
function loadTranscriptionDemo(){
  const out=sel('#transcriptionOut'); if(!out) return;
  out.textContent='Simulating transcription latency...';
  setTimeout(()=>{ out.textContent=fmt({ status:'simulated', engine:'whisper', latency_ms: Math.round(300+Math.random()*400), note:'Real transcription requires authenticated backend streaming.' }); }, 600);
}

function wire(){
  // Existing buttons
  sel('#btnHealth')?.addEventListener('click',loadHealth);
  sel('#btnAdapter')?.addEventListener('click',loadAdapter);
  sel('#btnPatients')?.addEventListener('click',loadPatients);
  sel('#btnMetrics')?.addEventListener('click',loadMetrics);

  // New buttons
  sel('#btnSystem')?.addEventListener('click',loadSystemStatus);
  sel('#btnEnv')?.addEventListener('click',loadEnv);
  sel('#btnHeaders')?.addEventListener('click',loadSecurityHeaders);
  sel('#btnFhir')?.addEventListener('click',loadFhirProbe);
  sel('#btnRate')?.addEventListener('click',runRateLimitProbe);
  sel('#btnTranscription')?.addEventListener('click',loadTranscriptionDemo);

  // New: patient search
  sel('#patientSearch')?.addEventListener('input',()=>{ applyPatientFilter(); });

  // Auto-load on pages where elements exist
  loadHealth();
  loadAdapter();
  loadSystemStatus();
  loadEnv();
  loadSecurityHeaders();
  loadFhirProbe();
  loadTranscriptionDemo();
  initWebSocket();
}

document.addEventListener('DOMContentLoaded', wire);

function generateSyntheticPatients(){
  const first=['Ava','Liam','Mia','Noah','Ella','Eli','Zoe','Omar','Isla','Hugo'];
  const last=['Rivera','Chen','Patel','Okafor','Sato','Ivanov','Garcia','Singh','Khan',' Novak'];
  const rnd=a=>a[Math.floor(Math.random()*a.length)];
  const patients=[]; const today=new Date();
  for(let i=0;i<8;i++){
    const dobYear = 1950 + Math.floor(Math.random()*60);
    const dob = new Date(dobYear, Math.floor(Math.random()*12), Math.floor(Math.random()*28)+1);
    const age = today.getFullYear() - dob.getFullYear();
    patients.push({
      id:'SYN-'+(1000+i),
      name: rnd(first)+' '+rnd(last),
      age,
      gender: Math.random()>0.5?'female':'male',
      lastEncounterDaysAgo: Math.floor(Math.random()*180),
      risk: ['low','medium','high'][Math.floor(Math.random()*3)],
      synthetic:true,
      // placeholders enriched later
      conditions:[],
      medications:[]
    });
  }
  return patients;
}

function filterPatients(term){
  const list = window.__allPatients || [];
  if(!term) return list;
  term=term.toLowerCase();
  return list.filter(p=>p.name.toLowerCase().includes(term) || String(p.id).includes(term));
}

function applyPatientFilter(){
  const input = sel('#patientSearch'); if(!input) return;
  const term = input.value.trim();
  const out=sel('#patientsOut'); if(!out) return;
  const filtered = filterPatients(term);
  out.textContent = fmt({ filter: term||null, count: filtered.length, patients: filtered });
}

export { loadHealth, loadAdapter, loadPatients, loadMetrics, loadSystemStatus, loadEnv, loadSecurityHeaders, loadFhirProbe, runRateLimitProbe, generateSyntheticPatients, filterPatients, applyPatientFilter };

// --- Diff logic appended (kept out of export) ---
function computeHealthDiff(){
  const a = window.__lastHealth, b = window.__lastAdapter; if(!a || !b) return;
  const diffEl = sel('#healthAdapterDiff'); if(!diffEl) return;
  const keys = ['status','uptime','version','adapter','patients'];
  const summary = {};
  keys.forEach(k=>{
    const av = a[k]; const bv = b[k];
    if(av===undefined && bv===undefined) return;
    summary[k] = av===bv ? { same: true, value: av ?? bv } : { same:false, health: av, adapter: bv };
  });
  diffEl.textContent = JSON.stringify(summary,null,2);
}
