# 💰 WebQx EMR - Free Tier Optimization Guide

## 🎯 Goal: Stay Under Free Tier Limits

This guide shows you how to maximize the free tier limits and minimize costs.

---

## 📊 Free Tier Limits Overview

| Service | Free Tier Limit | Cost if Exceeded |
|---------|----------------|------------------|
| **Medplum** | 100 API requests/month | $99/month (10K requests) |
| **Nextcloud** | 25-40GB storage | $1/10GB extra |
| **Railway** | $5 credit/month (~500 hours) | $0.01/hour after |
| **OpenAI Whisper** | N/A (pay-as-you-go) | $0.006/minute |

---

## 🚀 Optimization Strategy #1: Reduce Medplum API Calls

### Problem: Each Patient Operation = 1 Request

**Typical workflow consumes:**
```javascript
// Creating a new patient encounter:
await medplum.readResource('Patient', patientId);        // Request #1
await medplum.readResource('Practitioner', providerId);  // Request #2
await medplum.createResource({                          // Request #3
  resourceType: 'Encounter',
  subject: { reference: `Patient/${patientId}` }
});
await medplum.searchResources('Observation', {          // Request #4
  patient: patientId
});

// Total: 4 requests for one encounter!
```

### Solution 1: Use Bundle/Batch Requests (1 request instead of 4)

```javascript
// Combine multiple operations into ONE request:
const batch = await medplum.executeBatch({
  resourceType: 'Bundle',
  type: 'batch',
  entry: [
    {
      request: {
        method: 'GET',
        url: `Patient/${patientId}`
      }
    },
    {
      request: {
        method: 'GET',
        url: `Practitioner/${providerId}`
      }
    },
    {
      request: {
        method: 'POST',
        url: 'Encounter'
      },
      resource: {
        resourceType: 'Encounter',
        subject: { reference: `Patient/${patientId}` }
      }
    },
    {
      request: {
        method: 'GET',
        url: `Observation?patient=${patientId}`
      }
    }
  ]
});

// Total: 1 request! (75% savings)
```

### Solution 2: Aggressive Caching

**Already implemented in your code:**
```javascript
// light-emr-adapter/src/medplum.js
const CACHE_TTL_MS = 30000; // 30 seconds

// Reads from cache if available:
const cached = getCache('patient-' + patientId);
if (cached) {
  return cached; // No API request!
}
```

**Increase cache duration for read-heavy data:**
```javascript
// For data that rarely changes:
const LONG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Patient demographics (rarely change):
cachePatient(patientId, data, LONG_CACHE_TTL);

// Vital signs (change frequently):
cacheObservation(obsId, data, 30000); // 30 sec
```

### Solution 3: Store Transcriptions in Nextcloud, Not Medplum

**Current approach (uses 2 Medplum requests per transcription):**
```javascript
// Request #1: Create Media resource
const media = await medplum.createResource({
  resourceType: 'Media',
  content: { url: audioUrl }
});

// Request #2: Create DocumentReference with transcription
await medplum.createResource({
  resourceType: 'DocumentReference',
  content: [{ attachment: { data: transcription } }]
});
```

**Optimized approach (uses 1 Medplum request + Nextcloud):**
```javascript
// 1. Save transcription to Nextcloud (no Medplum request):
const transcriptionFileName = `transcription-${Date.now()}.txt`;
await fetch(`${NEXTCLOUD_WEBDAV_URL}transcriptions/${transcriptionFileName}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
    'Content-Type': 'text/plain'
  },
  body: transcriptionText
});

// 2. Only store reference in Medplum (1 request):
await medplum.createResource({
  resourceType: 'DocumentReference',
  status: 'current',
  type: { text: 'Voice Transcription' },
  subject: { reference: `Patient/${patientId}` },
  content: [{
    attachment: {
      contentType: 'text/plain',
      url: `${NEXTCLOUD_WEBDAV_URL}transcriptions/${transcriptionFileName}`
    }
  }]
});

// Total: 1 Medplum request instead of 2 (50% savings!)
```

### Solution 4: Lazy Loading

**Don't fetch data until it's actually needed:**
```javascript
// ❌ BAD: Fetch everything upfront
const patient = await medplum.readResource('Patient', id);
const encounters = await medplum.searchResources('Encounter', { patient: id });
const observations = await medplum.searchResources('Observation', { patient: id });
const medications = await medplum.searchResources('MedicationRequest', { patient: id });
// 4 requests even if user only views patient demographics!

// ✅ GOOD: Fetch on-demand
const patient = await medplum.readResource('Patient', id);
// Only 1 request initially

// Then when user clicks "View Encounters" tab:
const encounters = await medplum.searchResources('Encounter', { patient: id });
// Additional request only when needed
```

---

## 🚀 Optimization Strategy #2: Reduce OpenAI Whisper Costs

### Problem: Audio transcription costs add up

**Cost breakdown:**
- 1 minute of audio = $0.006
- 10 minutes/day = $1.80/month
- 30 minutes/day = $5.40/month

### Solution 1: Use WebM Opus Compression

**Already configured in your MediaRecorder:**
```javascript
const recorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 32000 // 32 kbps (good quality, small size)
});

// Result: 5-minute recording = ~1.2 MB (vs. 5 MB uncompressed)
```

### Solution 2: Implement Voice Activity Detection (VAD)

**Skip silent parts of recording:**
```javascript
// Add to your recording logic:
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
const dataArray = new Uint8Array(analyser.fftSize);

function isSpeaking() {
  analyser.getByteTimeDomainData(dataArray);
  
  // Check if audio level exceeds threshold:
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += Math.abs(dataArray[i] - 128);
  }
  const average = sum / dataArray.length;
  
  return average > 10; // Threshold for "speaking"
}

// Only record when speaking:
let isRecording = false;
setInterval(() => {
  if (isSpeaking() && !isRecording) {
    recorder.start(); // Start recording
    isRecording = true;
  } else if (!isSpeaking() && isRecording) {
    recorder.stop(); // Stop recording during silence
    isRecording = false;
  }
}, 100);

// Result: 50% reduction in audio length = 50% cost savings!
```

### Solution 3: Client-Side Transcription (Free!)

**Use browser's built-in Speech Recognition API:**
```javascript
// For Chrome/Edge (free, no API calls):
const recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'en-US';

recognition.onresult = (event) => {
  const transcript = event.results[event.results.length - 1][0].transcript;
  console.log('Transcription:', transcript);
  
  // Save to Nextcloud:
  saveTranscription(transcript);
};

recognition.start();

// Fallback to OpenAI Whisper only if browser doesn't support:
if (!('webkitSpeechRecognition' in window)) {
  // Use OpenAI Whisper
}

// Result: $0 for supported browsers (Chrome, Edge, Safari)
```

### Solution 4: Batch Transcription Requests

**Instead of real-time transcription, process in batches:**
```javascript
// Queue audio files:
const transcriptionQueue = [];

function queueForTranscription(audioBlob) {
  transcriptionQueue.push(audioBlob);
  
  // Process batch every 5 minutes or when 10 files queued:
  if (transcriptionQueue.length >= 10) {
    processBatch();
  }
}

async function processBatch() {
  // Concatenate audio files (OpenAI accepts up to 25MB):
  const combinedAudio = await concatenateAudioFiles(transcriptionQueue);
  
  // Single API call for all files:
  const transcription = await transcribeAudio(combinedAudio);
  
  // Split transcription by timestamps:
  const segments = splitTranscription(transcription);
  
  transcriptionQueue = [];
}

// Result: Fewer API calls = lower costs
```

---

## 🚀 Optimization Strategy #3: Reduce Railway Costs

### Problem: Railway free tier = $5 credit = ~500 hours

**If your app is always running:**
- 24 hours/day × 30 days = 720 hours/month
- Exceeds free tier by 220 hours = $2.20 extra

### Solution 1: Scale Down During Off-Hours

**Railway allows scheduled scaling:**
```yaml
# railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "numReplicas": 1,
    "sleepApplication": false
  }
}
```

**Alternative: Use Railway's built-in sleep:**
```json
{
  "deploy": {
    "sleepApplication": true  // Sleep after 15 min inactivity
  }
}
```

**Result:**
- App sleeps overnight (11pm - 6am) = 7 hours/day saved
- 7 hours × 30 days = 210 hours saved
- New usage: 510 hours/month (barely over free tier!)

### Solution 2: Use Cold Starts Wisely

**Accept 5-10 second cold start delay:**
- Better for small practices
- First request wakes up app
- Subsequent requests are instant

**Optimization: Keep critical pages warm:**
```javascript
// Add to your frontend:
setInterval(() => {
  // Ping health check every 10 minutes:
  fetch('https://webqx-production.up.railway.app/health');
}, 10 * 60 * 1000);

// Only runs during business hours:
const now = new Date();
if (now.getHours() >= 8 && now.getHours() <= 18) {
  // Keep app awake during work hours
}
```

### Solution 3: Optimize Container Image Size

**Smaller image = faster starts = less compute time:**
```dockerfile
# Current size: ~500MB
# Optimized size: ~150MB (70% reduction)

FROM node:20-alpine  # Use Alpine (smaller)
WORKDIR /app

# Copy only necessary files:
COPY package*.json ./
RUN npm ci --only=production  # Skip dev dependencies

COPY core/ ./core/
COPY light-emr-adapter/ ./light-emr-adapter/

# Remove unnecessary files:
RUN rm -rf \
  *.md \
  .git \
  tests/ \
  docs/

CMD ["node", "core/unified-server.js"]
```

---

## 🚀 Optimization Strategy #4: Nextcloud Storage Management

### Problem: 25-40GB fills up quickly with audio files

**Typical usage:**
- 5-minute voice note = 2 MB (WebM)
- 50 notes/day = 100 MB/day
- 30 days = 3 GB/month
- 1 year = 36 GB (exceeds free tier!)

### Solution 1: Implement Retention Policy

**Auto-delete old audio files:**
```bash
# Add cron job on Nextcloud server:
# Delete audio files older than 90 days:
0 2 * * * find /var/lib/docker/volumes/nextcloud_aio_nextcloud_data/_data/admin/files/audio/ -type f -mtime +90 -delete

# Keep only transcriptions (text is tiny):
# audio/file.webm (2 MB) → DELETE
# transcriptions/file.txt (2 KB) → KEEP
```

**Or use Nextcloud's built-in retention:**
```bash
# SSH into Nextcloud container:
docker exec -it nextcloud-aio-nextcloud bash

# Enable retention:
php occ config:app:set files_retention retention_policy --value='{"class":"OCA\\\\FilesRetention\\\\Policy\\\\TimeRetention","age":90}'

# Older than 90 days = auto-archived to cheaper storage
```

### Solution 2: External Storage (S3-Compatible)

**Use Backblaze B2 (cheaper than AWS S3):**
- First 10GB: Free
- Additional storage: $0.005/GB/month
- 100GB = $0.50/month

**Configure in Nextcloud:**
```bash
# Admin → External Storage → Add storage
Type: Amazon S3
Bucket: webqx-audio-archive
Region: us-west-002
Access Key: <from-backblaze>
Secret Key: <from-backblaze>

# Move old files to B2 automatically:
php occ files_external:list
php occ files_external:applicable <storage_id> --add-user admin
```

### Solution 3: Compress Audio with FFmpeg

**Re-encode uploaded audio to save space:**
```javascript
// After audio upload to Nextcloud, compress it:
const { exec } = require('child_process');

async function compressAudio(filePath) {
  // Original: 2 MB WebM
  // Compressed: 500 KB Opus
  
  return new Promise((resolve, reject) => {
    exec(
      `ffmpeg -i ${filePath} -c:a libopus -b:a 16k -vbr on ${filePath}.compressed`,
      (error) => {
        if (error) reject(error);
        
        // Replace original with compressed:
        exec(`mv ${filePath}.compressed ${filePath}`, resolve);
      }
    );
  });
}

// Result: 75% storage savings!
```

---

## 📊 Expected Savings Summary

| Optimization | Medplum Requests Saved | Cost Savings |
|--------------|------------------------|--------------|
| Batch requests | 60-70/month | Stay under free tier |
| Caching | 20-30/month | Stay under free tier |
| Nextcloud transcriptions | 30-40/month | Stay under free tier |
| **TOTAL** | **~80% reduction** | **$0** |

| Optimization | Whisper Minutes Saved | Cost Savings |
|--------------|----------------------|--------------|
| WebM compression | N/A | $0 (already efficient) |
| Voice Activity Detection | 50% | $0.03-0.15/day |
| Browser Speech API | 100% | $0.18/day |
| **TOTAL** | **50-100%** | **$2.70-5.40/month** |

| Optimization | Railway Hours Saved | Cost Savings |
|--------------|---------------------|--------------|
| Sleep mode | 200-300/month | ~$2-3 |
| Smaller container | 10-20/month | ~$0.20-0.40 |
| **TOTAL** | **~30-40%** | **$2-4/month** |

| Optimization | Nextcloud GB Saved | Cost Savings |
|--------------|-------------------|--------------|
| 90-day retention | 20-30 GB/year | $0 (stay under limit) |
| FFmpeg compression | 50-60 GB/year | $0 (stay under limit) |
| External storage (B2) | Unlimited | $0.50/100GB |
| **TOTAL** | **Stay under 40GB** | **$0-1/month** |

---

## 🎯 Final Optimized Costs

### Before Optimization:
- Medplum: $99/month (exceeded free tier)
- OpenAI Whisper: $5.40/month
- Railway: $7/month (exceeded free tier)
- Nextcloud VPS: $5/month
- **TOTAL: ~$116/month**

### After Optimization:
- Medplum: $0/month (under 100 requests)
- OpenAI Whisper: $0-2/month (Browser Speech API + VAD)
- Railway: $0-2/month (sleep mode + optimization)
- Nextcloud VPS: $5/month
- **TOTAL: $5-9/month** 💰

---

## ✅ Implementation Checklist

### Medplum Optimization:
- [ ] Implement batch requests for multi-resource operations
- [ ] Increase cache TTL for read-heavy data
- [ ] Store transcriptions in Nextcloud instead of Medplum
- [ ] Add lazy loading for patient tabs
- [ ] Monitor API usage in Medplum dashboard

### Whisper Optimization:
- [ ] Enable Voice Activity Detection
- [ ] Implement browser Speech Recognition API as primary
- [ ] Fall back to OpenAI Whisper only when needed
- [ ] Add audio compression with FFmpeg
- [ ] Queue and batch transcription requests

### Railway Optimization:
- [ ] Enable sleep mode for off-hours
- [ ] Optimize Docker image size
- [ ] Add health check pinging during business hours
- [ ] Monitor Railway usage dashboard
- [ ] Consider scaling down to 0 replicas overnight

### Nextcloud Optimization:
- [ ] Set up 90-day retention policy
- [ ] Configure external storage (Backblaze B2)
- [ ] Add FFmpeg compression job
- [ ] Monitor storage usage weekly
- [ ] Archive old files to cold storage

---

## 📈 Monitoring Dashboard

**Track your usage to stay under limits:**

```javascript
// Create simple dashboard endpoint:
app.get('/admin/usage', async (req, res) => {
  const usage = {
    medplum: {
      requestsThisMonth: await getMedplumRequestCount(),
      limit: 100,
      percentage: (requestsThisMonth / 100) * 100
    },
    railway: {
      hoursThisMonth: await getRailwayHours(),
      limit: 500,
      percentage: (hoursThisMonth / 500) * 100
    },
    nextcloud: {
      storageUsedGB: await getNextcloudStorage(),
      limit: 40,
      percentage: (storageUsedGB / 40) * 100
    },
    whisper: {
      minutesThisMonth: await getWhisperMinutes(),
      costThisMonth: minutesThisMonth * 0.006
    }
  };
  
  res.json(usage);
});
```

**Add alerts when approaching limits:**
```javascript
if (usage.medplum.percentage > 80) {
  sendAlert('Medplum usage at 80%! Optimize now!');
}
```

---

**With these optimizations, you can run a full-featured EMR for $5-9/month!** 🎉
