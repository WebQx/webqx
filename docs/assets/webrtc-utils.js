// Minimal in-page loopback WebRTC helper (no external signaling)
// Creates two RTCPeerConnections and wires ICE locally.

export async function createLoopback(stream, onRemoteTrack, onState){
  const pc1 = new RTCPeerConnection({iceServers:[]});
  const pc2 = new RTCPeerConnection({iceServers:[]});

  function report(){
    if(onState){
      onState({
        pc1: pc1.connectionState,
        pc2: pc2.connectionState,
        ice1: pc1.iceConnectionState,
        ice2: pc2.iceConnectionState
      });
    }
  }
  pc1.onconnectionstatechange = report;
  pc2.onconnectionstatechange = report;
  pc1.oniceconnectionstatechange = report;
  pc2.oniceconnectionstatechange = report;

  pc2.ontrack = (e)=>{ if(onRemoteTrack) onRemoteTrack(e.streams[0]||e.stream); };
  stream.getTracks().forEach(t=>pc1.addTrack(t, stream));

  pc1.onicecandidate = (e)=>{ if(e.candidate) pc2.addIceCandidate(e.candidate).catch(()=>{}); };
  pc2.onicecandidate = (e)=>{ if(e.candidate) pc1.addIceCandidate(e.candidate).catch(()=>{}); };

  const offer = await pc1.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true});
  await pc1.setLocalDescription(offer);
  await pc2.setRemoteDescription(offer);
  const answer = await pc2.createAnswer();
  await pc2.setLocalDescription(answer);
  await pc1.setRemoteDescription(answer);
  report();
  return { pc1, pc2, close:()=>{ pc1.close(); pc2.close(); } };
}

export async function collectBitrate(pc, cb){
  if(!pc) return; let lastBytes=0; let lastTs=0;
  async function sample(){
    try {
      const stats = await pc.getStats();
      stats.forEach(r=>{
        if(r.type==='outbound-rtp' && (r.kind==='video' || r.kind==='audio')){
          if(lastTs){
            const deltaBytes = r.bytesSent - lastBytes;
            const deltaTime = (r.timestamp - lastTs)/1000; // ms to s
            const bitrate = deltaTime>0 ? Math.round((deltaBytes*8)/deltaTime) : 0; // bits per sec
            cb({kind:r.kind, bitrate});
          }
          lastBytes = r.bytesSent; lastTs = r.timestamp;
        }
      });
    } catch {}
    requestAnimationFrame(sample);
  }
  sample();
}