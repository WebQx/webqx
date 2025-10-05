// Shared lightweight data fetchers for persona portals.
// All endpoints are public-safe demo surfaces.

const BASE = '';
async function jfetch(path, opts={}){
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), opts.timeout||5000);
  try {
    const res = await fetch(BASE+path,{signal:controller.signal,cache:'no-store'});
    clearTimeout(t);
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  } catch(e){
    return { error:true, message:e.name==='AbortError'?'timeout':(e.message||'error') };
  }
}

export async function fetchHealth(){ return await jfetch('/health'); }
export async function fetchAdapter(){ return await jfetch('/emr/status'); }
export async function fetchPatients(){ return await jfetch('/emr/patients'); }

export function summarizeHealth(h){
  if(!h || h.error) return 'unavailable';
  return h.status || h.state || 'unknown';
}

export function patientCount(p){
  if(!p || p.error) return 0;
  if(Array.isArray(p)) return p.length;
  if(Array.isArray(p.patients)) return p.patients.length;
  return 0;
}

// Convenience to fetch all in parallel.
export async function portalSnapshot(){
  const [health,adapter,patients] = await Promise.all([fetchHealth(),fetchAdapter(),fetchPatients()]);
  return { health, adapter, patients };
}
