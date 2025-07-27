import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';

export default function WebQXApp() {
  // 📌 Global State
  const [role, setRole] = useState('Provider'); // 'Provider' | 'Reviewer' | 'Admin'
  const [recording, setRecording] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [specialty, setSpecialty] = useState("Radiology");
  const [language, setLanguage] = useState("English");
  const [transcript, setTranscript] = useState("This is your live transcript...");
  const [segments, setSegments] = useState([
    { text: "Right upper quadrant pain", start: 0.5, end: 2.8 },
    { text: "likely cholecystitis.", start: 2.9, end: 4.2 }
  ]);
  const [currentTime, setCurrentTime] = useState(0);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [analytics, setAnalytics] = useState([]);

  // 🕐 Timestamp simulation (Whisper sync)
  useEffect(() => {
    if (recording) {
      const interval = setInterval(() => setCurrentTime(t => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [recording]);

  // 🧠 Fetch reviewer queue and audit logs (mocked)
  useEffect(() => {
    if (role === 'Reviewer') {
      setReviewQueue([
        { id: 'tx001', user: 'provider_101', transcript: 'Ultrasound shows gallstones...' }
      ]);
    }
    if (role === 'Admin') {
      setAuditLogs([
        { userId: 'provider_101', action: 'Submitted Transcript', timestamp: '2025-07-24T14:05Z' }
      ]);
      setAnalytics([
        { specialty: 'Radiology', count: 18 },
        { specialty: 'Cardiology', count: 12 }
      ]);
    }
  }, [role]);

  // 🧭 UI Renderer by Role
  const renderModule = () => {
    switch (role) {
      case 'Provider':
        return (
          <>
            <Text style={styles.header}>🎙️ Dictation</Text>
            <View style={styles.row}>
              <Text>Specialty: {specialty}</Text>
              <Text>Language: {language}</Text>
            </View>
            <TouchableOpacity style={styles.recordBtn} onPress={() => setRecording(!recording)}>
              <Text style={styles.btnText}>{recording ? "⏹ Stop" : "⏺ Start Recording"}</Text>
            </TouchableOpacity>
            <View style={styles.switchRow}>
              <Text>Privacy Mode</Text>
              <Switch value={privacyMode} onValueChange={setPrivacyMode} />
              <Text>Offline</Text>
              <Switch value={offlineMode} onValueChange={setOfflineMode} />
            </View>
            <Text style={styles.header}>📝 Transcript</Text>
            <TextInput
              style={styles.transcriptBox}
              multiline
              value={transcript}
              onChangeText={setTranscript}
            />
            <Text style={styles.subHeader}>📡 Sync</Text>
            {segments.map((seg, idx) => {
              const active = currentTime >= seg.start && currentTime <= seg.end;
              return (
                <Text key={idx} style={[styles.segmentText, active && styles.activeSegment]}>
                  {seg.text}
                </Text>
              );
            })}
            <TouchableOpacity style={styles.submitBtn}>
              <Text style={styles.btnText}>✅ Submit to EMR</Text>
            </TouchableOpacity>
          </>
        );

      case 'Reviewer':
        return (
          <>
            <Text style={styles.header}>🧐 Review Queue</Text>
            {reviewQueue.map((item, idx) => (
              <View key={idx} style={styles.card}>
                <Text>ID: {item.id}</Text>
                <Text>Provider: {item.user}</Text>
                <Text>Transcript: {item.transcript}</Text>
                <TouchableOpacity style={styles.btn}>
                  <Text style={styles.btnText}>✅ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btn}>
                  <Text style={styles.btnText}>🚩 Flag</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        );

      case 'Admin':
        return (
          <>
            <Text style={styles.header}>📋 Audit Logs</Text>
            {auditLogs.map((log, idx) => (
              <View key={idx} style={styles.card}>
                <Text>User: {log.userId}</Text>
                <Text>Action: {log.action}</Text>
                <Text>Time: {new Date(log.timestamp).toLocaleString()}</Text>
              </View>
            ))}
            <Text style={styles.header}>📊 Analytics</Text>
            {analytics.map((a, idx) => (
              <View key={idx} style={styles.row}>
                <Text>{a.specialty}</Text>
                <Text>{a.count} transcripts</Text>
              </View>
            ))}
          </>
        );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>🌐 WebQX™ Mobile Platform</Text>
      <View style={styles.roleSwitch}>
        {['Provider', 'Reviewer', 'Admin'].map(r => (
          <TouchableOpacity key={r} onPress={() => setRole(r)} style={styles.roleBtn}>
            <Text style={styles.btnText}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {renderModule()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f9f9f9' },
  header: { fontSize: 22, fontWeight: 'bold', marginVertical: 10 },
  subHeader: { fontSize: 18, fontWeight: '600', marginTop: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  transcriptBox: { backgroundColor: '#fff', borderColor: '#ccc', borderWidth: 1, padding: 12, borderRadius: 10, fontSize: 16, marginTop: 10 },
  segmentText: { fontSize: 16, color: '#444', marginBottom: 4 },
  activeSegment: { backgroundColor: '#FFEB3B', fontWeight: 'bold' },
  recordBtn: { backgroundColor: '#1976D2', padding: 12, borderRadius: 8, marginTop: 10 },
  submitBtn: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 10, marginVertical: 20, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16 },
  roleSwitch: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  roleBtn: { backgroundColor: '#03A9F4', padding: 10, borderRadius: 6 },
  card: { backgroundColor: '#eee', padding: 12, marginVertical: 8, borderRadius: 6 },
  btn: { backgroundColor: '#607D8B', padding: 8, borderRadius: 6, marginTop: 5, alignItems: 'center' }
});