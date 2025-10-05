// Simple streaming transcript simulator & tiny event emitter

export class Emitter {
  constructor(){ this.l={}; }
  on(ev,fn){ (this.l[ev]=this.l[ev]||[]).push(fn); return ()=>this.off(ev,fn); }
  off(ev,fn){ this.l[ev]=(this.l[ev]||[]).filter(f=>f!==fn); }
  emit(ev,data){ (this.l[ev]||[]).forEach(f=>f(data)); }
}

const SAMPLE_SENTENCES=[
  'Patient reports mild headache for three days',
  'Denies vision changes or nausea',
  'Blood pressure stable and within target range',
  'Plan includes hydration and over the counter analgesic',
  'Follow up in one week if symptoms persist'
];

export function simulateStreaming(opts={}){
  const { onPartial, onFinal, onDone, delayBase=600 } = opts;
  let i=0; let active=true;
  function push(){
    if(!active) return;
    if(i >= SAMPLE_SENTENCES.length) {
      if(onDone) onDone();
      return;
    }
    const raw = SAMPLE_SENTENCES[i];
    let partial='';
    const words = raw.split(' ');
    words.forEach((w,idx)=>{
      setTimeout(()=>{ 
        if(!active) return; 
        partial += (partial?' ':'')+w; 
        if(onPartial) onPartial(partial); 
        if(idx===words.length-1){ 
          if(onFinal) onFinal(raw); 
        } 
      }, idx*120);
    });
    i++; 
    setTimeout(push, delayBase + Math.random()*500);
  }
  push();
  return { stop:()=>{ active=false; if(onDone) onDone(); } };
}

export function wordCount(text){ return (text.trim().match(/\S+/g)||[]).length; }