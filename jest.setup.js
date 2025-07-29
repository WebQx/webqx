require('@testing-library/jest-dom');

// Add fetch polyfill for tests
if (!globalThis.fetch) {
  // First try to get node-fetch
  try {
    globalThis.fetch = require('node-fetch');
  } catch (e) {
    // Fallback to a mock fetch for tests
    globalThis.fetch = jest.fn();
  }
}