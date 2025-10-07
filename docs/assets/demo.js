/*
 * Legacy demo.js stub
 * Original demo scaffolding moved to /legacy/demo/
 * This provides minimal compatibility for documentation pages
 * For production dashboard features, see /portal/ and /api/dashboard/provider
 */

console.log('📝 Demo stub loaded - original moved to /legacy/demo/');
console.log('ℹ️  For production features, see the React Portal at /portal/');

// Minimal stubs for documentation page compatibility
export function loadHealth() {
  console.log('loadHealth stub - original in /legacy/demo/demo.js');
}

export function loadAdapter() {
  console.log('loadAdapter stub - original in /legacy/demo/demo.js');
}

export function loadPatients() {
  console.log('loadPatients stub - original in /legacy/demo/demo.js');
}

export function loadMetrics() {
  console.log('loadMetrics stub - original in /legacy/demo/demo.js');
}

export function loadSystemStatus() {
  console.log('loadSystemStatus stub - original in /legacy/demo/demo.js');
}

export function loadEnv() {
  console.log('loadEnv stub - original in /legacy/demo/demo.js');
}

export function loadSecurityHeaders() {
  console.log('loadSecurityHeaders stub - original in /legacy/demo/demo.js');
}

export function loadFhirProbe() {
  console.log('loadFhirProbe stub - original in /legacy/demo/demo.js');
}

export function runRateLimitProbe() {
  console.log('runRateLimitProbe stub - original in /legacy/demo/demo.js');
}

export function generateSyntheticPatients() {
  console.log('generateSyntheticPatients stub - original in /legacy/demo/demo.js');
  return [];
}

export function filterPatients(term) {
  console.log('filterPatients stub - original in /legacy/demo/demo.js');
  return [];
}

export function applyPatientFilter() {
  console.log('applyPatientFilter stub - original in /legacy/demo/demo.js');
}

// Show migration notice
const notice = document.createElement('div');
notice.style.cssText = `
  position: fixed;
  bottom: 10px;
  right: 10px;
  background: #fef3c7;
  border: 2px solid #f59e0b;
  color: #92400e;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  max-width: 300px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 9999;
`;
notice.innerHTML = `
  <strong>⚠️ Legacy Demo Page</strong><br>
  <span style="font-size: 0.75rem;">
    For production features, visit the 
    <a href="/portal/" style="color: #0066cc; text-decoration: underline;">React Portal</a>
  </span>
`;
document.addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(notice);
  setTimeout(() => {
    notice.style.opacity = '0.7';
  }, 5000);
});
