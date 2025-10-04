const RAILWAY_BASE = 'https://webqx-production.up.railway.app';
const sel = q=>document.querySelector(q);
const fmt = (o)=>JSON.stringify(o,null,2);

function badge(status){
  const span=document.createElement('span');
  span.className='badge '+(status==='ok'||status==='healthy'?'ok':status==='degraded'?'warn':'err');
  span.textContent=status;
  return span;
}

async function fetchJSON(path){
  const t0=performance.now();
  const res = await fetch(path,{cache:'no-store'});
  const text= await res.text();
  let data; try{ data=JSON.parse(text);}catch{ data={raw:text}; }
  return { ok:res.ok, status:res.status, ms:Math.round(performance.now()-t0), data };
}

async function loadHealth(){
  const out=sel('#healthOut');
  out.textContent='Loading /health ...';
  try {
    const r=await fetchJSON(RAILWAY_BASE+'/health');
    out.textContent=fmt(r.data);
    const b=sel('#healthBadge'); b.innerHTML=''; b.appendChild(badge(r.data.status|| (r.ok?'ok':'error')));
    sel('#healthMeta').textContent=r.ms+' ms • HTTP '+r.status;
  } catch(e){ out.textContent='Error: '+e.message; }
}

async function loadAdapter(){
  const out=sel('#adapterOut');
  out.textContent='Loading /emr/status ...';
  try {
    const r=await fetchJSON(RAILWAY_BASE+'/emr/status');
    out.textContent=fmt(r.data);
    const b=sel('#adapterBadge'); b.innerHTML='';
    let s = r.data.status || (r.ok?'ok':'error');
    b.appendChild(badge(s));
    sel('#adapterMeta').textContent=r.ms+' ms • HTTP '+r.status + (r.data.adapter?' • '+r.data.adapter:'');
  } catch(e){ out.textContent='Error: '+e.message; }
}

async function loadPatients(){
  const out=sel('#patientsOut');
  out.textContent='Loading /emr/patients ...';
  try {
    const r=await fetchJSON(RAILWAY_BASE+'/emr/patients');
    out.textContent=fmt(r.data);
    const count = Array.isArray(r.data.patients)? r.data.patients.length : 0;
    sel('#patientsMeta').textContent=r.ms+' ms • HTTP '+r.status+' • '+count+' patients';
  } catch(e){ out.textContent='Error: '+e.message; }
}

async function loadMetrics(){
  const out=sel('#metricsOut');
  out.textContent='Loading /metrics ...';
  try {
    const res= await fetch(RAILWAY_BASE+'/metrics',{cache:'no-store'});
    const txt= await res.text();
    out.textContent=txt.split('\n').slice(0,120).join('\n');
    sel('#metricsMeta').textContent='HTTP '+res.status+' (first 120 lines)';
  } catch(e){ out.textContent='Error: '+e.message; }
}

function wire(){
  sel('#btnHealth').addEventListener('click',loadHealth);
  sel('#btnAdapter').addEventListener('click',loadAdapter);
  sel('#btnPatients').addEventListener('click',loadPatients);
  sel('#btnMetrics').addEventListener('click',loadMetrics);
  loadHealth();
  loadAdapter();
}

document.addEventListener('DOMContentLoaded', wire);
