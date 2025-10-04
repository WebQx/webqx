// Adds latency measurement + auto ping for telehealth demo
export function enhanceWebSocketDemo(){
  const statusEl=document.querySelector('#wsStatus');
  const log=document.querySelector('#wsLog');
  if(!statusEl||!log) return;
  function append(line){ const d=document.createElement('div'); d.textContent=line; log.appendChild(d); log.scrollTop=log.scrollHeight; }
  const url = (location.protocol==='https:'?'wss':'ws')+'://webqx-production.up.railway.app/api/telehealth/ws';
  let ws = new WebSocket(url);
  let pingSentAt=null; let latencySamples=[];
  const latencyStat=document.querySelector('#latencyStat');
  function updateLatency(ms){ if(!latencyStat) return; latencySamples.push(ms); if(latencySamples.length>30) latencySamples.shift(); const avg = (latencySamples.reduce((a,b)=>a+b,0)/latencySamples.length).toFixed(1); latencyStat.textContent=`latency: ${ms} ms (avg ${avg})`; }
  ws.onopen=()=>{ statusEl.textContent='open'; statusEl.className='badge ok'; append('Connected '+url); };
  ws.onclose=()=>{ statusEl.textContent='closed'; statusEl.className='badge err'; append('Closed'); };
  ws.onerror=(e)=>{ append('Error'); };
  ws.onmessage=(e)=>{ append('<- '+e.data); if(e.data==='ping'&&pingSentAt){ updateLatency(Math.round(performance.now()-pingSentAt)); pingSentAt=null; } };
  document.querySelector('#wsSend')?.addEventListener('click',()=>{ const txt=document.querySelector('#wsInput').value||'ping'; ws.send(txt); append('-> '+txt); if(txt==='ping') pingSentAt=performance.now(); });
  const auto=document.querySelector('#autoPing');
  setInterval(()=>{ if(auto?.checked && ws.readyState===1){ ws.send('ping'); append('-> ping'); pingSentAt=performance.now(); } },3000);
}
