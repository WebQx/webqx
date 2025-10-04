// Patient & Provider UX enhancement module
import { generateSyntheticPatients } from './demo.js';

function ensurePatients(){
  if(!window.__allPatients){
    window.__allPatients = window.__syntheticPatients || generateSyntheticPatients();
    window.__syntheticPatients = window.__allPatients;
  }
  // Enrich with conditions & medications if not present
  window.__allPatients = window.__allPatients.map(p=>{
    if(p.conditions && p.medications) return p;
    return { ...p, conditions: synthConditions(p), medications: synthMeds(p) };
  });
}

function synthConditions(p){
  const base=[ 'Hypertension','Type 2 Diabetes','Hyperlipidemia','Asthma','Anxiety','Chronic Kidney Disease','Hypothyroidism'];
  const chosen=[]; base.forEach(c=>{ if(Math.random()>0.7) chosen.push(c); });
  if(!chosen.length) chosen.push('General Wellness');
  return chosen.slice(0,4);
}
function synthMeds(p){
  const meds=['Metformin 500mg','Lisinopril 10mg','Atorvastatin 20mg','Levothyroxine 75mcg','Albuterol Inhaler','Sertraline 50mg'];
  const chosen=[]; meds.forEach(m=>{ if(Math.random()>0.75) chosen.push(m); });
  if(!chosen.length && Math.random()>0.5) chosen.push('Vitamin D3');
  return chosen.slice(0,5);
}

// ----- Patient UI -----
export function renderPatientUIEnhancements(){
  ensurePatients();
  const tableBody = document.querySelector('#patientTable tbody');
  if(!tableBody) return;
  const detail = document.getElementById('detailBody');
  const rawToggle = document.getElementById('rawToggle');
  const rawBlock = document.getElementById('patientsOut');
  rawToggle?.addEventListener('click',()=>{ rawBlock.classList.toggle('open'); rawToggle.textContent = rawBlock.classList.contains('open')? 'Hide Raw JSON':'Show Raw JSON'; });
  function riskBadge(r){ return `<span class="badge-risk ${r}">${r}</span>`; }
  function renderTable(patients){
    tableBody.innerHTML = patients.map(p=>`<tr data-id="${p.id}"><td>${p.name}</td><td>${p.age}</td><td>${riskBadge(p.risk)}</td><td>${p.lastEncounterDaysAgo}d</td></tr>`).join('');
  }
  function selectPatient(id){
    const patient = (window.__allPatients||[]).find(p=>p.id===id);
    if(!patient){ detail.textContent='Not found'; return; }
    tableBody.querySelectorAll('tr').forEach(tr=>tr.classList.toggle('selected', tr.getAttribute('data-id')===id));
    detail.innerHTML = `<div style='display:flex;align-items:center;justify-content:space-between;gap:.6rem'><strong>${patient.name}</strong>${riskBadge(patient.risk)}</div>
    <div style='margin-top:.4rem'>Age: ${patient.age} • Last Encounter: ${patient.lastEncounterDaysAgo}d • Gender: ${patient.gender}</div>
    <div style='margin-top:.5rem'><strong>Conditions</strong><div>${patient.conditions.map(c=>`<span class='tag'>${c}</span>`).join('')||'(none)'}</div></div>
    <div style='margin-top:.5rem'><strong>Medications</strong><div>${patient.medications.map(m=>`<span class='tag'>${m}</span>`).join('')||'(none)'}</div></div>
    <div style='margin-top:.6rem;font-size:.55rem;opacity:.7'>Synthetic data • No PHI</div>`;
  }
  // initial render
  renderTable(window.__allPatients);
  tableBody.addEventListener('click',e=>{
    const tr = e.target.closest('tr'); if(!tr) return; selectPatient(tr.getAttribute('data-id'));
  });
  // auto select first
  if(window.__allPatients.length) selectPatient(window.__allPatients[0].id);
}

// ----- Provider UI -----
export function initProviderUX(){
  ensurePatients();
  renderTodayPatients();
  buildSchedule();
}

function renderTodayPatients(){
  const el=document.getElementById('todayPatients'); if(!el) return;
  const pts = (window.__allPatients||[]).slice(0,5);
  el.innerHTML = pts.map(p=>`<div>${p.name} <span class='badge-risk ${p.risk}'>${p.risk}</span></div>`).join('');
}

function buildSchedule(){
  const grid=document.getElementById('scheduleGrid'); if(!grid) return;
  const days=['Mon','Tue','Wed','Thu','Fri'];
  const hours=[8,9,10,11,12,13,14,15,16];
  let html='<div></div>'+days.map(d=>`<div class="slot-col-header">${d}</div>`).join('');
  hours.forEach(h=>{
    html+=`<div class='slot-hour'>${String(h).padStart(2,'0')}:00</div>`;
    days.forEach(d=>{
      const id=`${d}-${h}`;
      html+=`<div class='slot free' data-slot='${id}'></div>`;
    });
  });
  grid.innerHTML=html;
  grid.addEventListener('click',e=>{
    const slot=e.target.closest('.slot'); if(!slot) return;
    toggleSlot(slot.getAttribute('data-slot'), slot);
  });
}

function toggleSlot(id, el){
  el.classList.toggle('booked');
  el.classList.toggle('free');
  updateBookings();
}

function updateBookings(){
  const bookingsEl=document.getElementById('bookingItems'); if(!bookingsEl) return;
  const booked=[...document.querySelectorAll('.slot.booked')].map(s=>s.getAttribute('data-slot'));
  bookingsEl.innerHTML = booked.length? booked.map(b=>`<div>${b}</div>`).join('') : '(none)';
}
