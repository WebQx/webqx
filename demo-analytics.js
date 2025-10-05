'use strict';

/**
 * Demo Analytics - Lightweight client-only tracking
 * Stores events in localStorage for privacy-friendly analytics
 * No external services or tracking pixels
 */

(function() {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'webqx_demo_analytics';
  const SESSION_KEY = 'webqx_demo_session';
  const MAX_EVENTS = 500; // Limit stored events
  
  let sessionId = getSessionId();
  let sessionStartTime = Date.now();
  let isDebugMode = false;

  // Check for debug mode
  if (typeof window !== 'undefined' && window.location) {
    const urlParams = new URLSearchParams(window.location.search);
    isDebugMode = urlParams.get('debug') === '1';
  }

  function getSessionId() {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  }

  function getStoredEvents() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to load analytics data:', e);
      return [];
    }
  }

  function storeEvent(event) {
    try {
      let events = getStoredEvents();
      events.push(event);
      
      // Keep only recent events
      if (events.length > MAX_EVENTS) {
        events = events.slice(-MAX_EVENTS);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
      console.warn('Failed to store analytics event:', e);
    }
  }

  function log(eventType, details = {}) {
    const event = {
      type: eventType,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      ts: Date.now(),
      ...details
    };
    
    storeEvent(event);
    
    if (isDebugMode) {
      console.log('[Analytics]', event);
    }
  }

  function getSummary() {
    const events = getStoredEvents();
    const sessionEvents = events.filter(e => e.session_id === sessionId);
    
    const summary = {
      total_events: events.length,
      session_events: sessionEvents.length,
      session_id: sessionId,
      session_duration_ms: Date.now() - sessionStartTime,
      event_counts: {}
    };
    
    // Count events by type
    sessionEvents.forEach(event => {
      summary.event_counts[event.type] = (summary.event_counts[event.type] || 0) + 1;
    });
    
    return summary;
  }

  function clearData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      return true;
    } catch (e) {
      console.warn('Failed to clear analytics data:', e);
      return false;
    }
  }

  function exportData() {
    const events = getStoredEvents();
    const summary = getSummary();
    
    return {
      summary,
      events: events.filter(e => e.session_id === sessionId)
    };
  }

  // Track page unload
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('beforeunload', () => {
      log('session_end', { 
        duration_ms: Date.now() - sessionStartTime,
        duration_seconds: Math.round((Date.now() - sessionStartTime) / 1000)
      });
    });
  }

  // Create debug panel if enabled
  if (isDebugMode && typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      createDebugPanel();
    });
  }

  function createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'webqx-debug-panel';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid #374151;
      border-radius: 8px;
      padding: 12px;
      max-width: 300px;
      z-index: 10000;
      font-family: ui-monospace, monospace;
      font-size: 11px;
      color: #e5e7eb;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong style="color: #60a5fa;">📊 Demo Analytics</strong>
        <button onclick="window.WebQxDemoAnalytics.togglePanel()" style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; padding: 0;">✕</button>
      </div>
      <div id="debug-summary" style="line-height: 1.6;"></div>
      <div style="margin-top: 8px; display: flex; gap: 4px;">
        <button onclick="window.WebQxDemoAnalytics.refreshDebug()" style="flex: 1; background: #1f2937; border: 1px solid #374151; color: #e5e7eb; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">Refresh</button>
        <button onclick="window.WebQxDemoAnalytics.downloadData()" style="flex: 1; background: #1f2937; border: 1px solid #374151; color: #e5e7eb; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">Export</button>
      </div>
    `;
    
    document.body.appendChild(panel);
    refreshDebugPanel();
  }

  function refreshDebugPanel() {
    const summaryEl = document.getElementById('debug-summary');
    if (!summaryEl) return;
    
    const summary = getSummary();
    const durationSec = Math.round(summary.session_duration_ms / 1000);
    
    let html = `
      <div style="margin-bottom: 4px;">Session: ${durationSec}s</div>
      <div style="margin-bottom: 4px;">Events: ${summary.session_events}</div>
    `;
    
    if (Object.keys(summary.event_counts).length > 0) {
      html += '<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #374151;">';
      for (const [type, count] of Object.entries(summary.event_counts)) {
        html += `<div style="color: #9ca3af;">${type}: ${count}</div>`;
      }
      html += '</div>';
    }
    
    summaryEl.innerHTML = html;
  }

  function togglePanel() {
    const panel = document.getElementById('webqx-debug-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  }

  function downloadData() {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webqx-demo-analytics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Expose public API
  window.WebQxDemoAnalytics = {
    log,
    getSummary,
    clearData,
    exportData,
    refreshDebug: refreshDebugPanel,
    togglePanel,
    downloadData
  };

  // Log initial page load
  log('page_load', {
    url: window.location.href,
    referrer: document.referrer || '(direct)'
  });

})();
