// Extend Jest with @testing-library/jest-dom matchers for TS awareness
require('@testing-library/jest-dom');
try {
  const matchers = require('@testing-library/jest-dom/matchers');
  expect.extend(matchers);
} catch {}

// Polyfill for TextEncoder/TextDecoder in Node.js test environment
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock for crypto.subtle
if (typeof global.crypto === 'undefined') {
  global.crypto = {};
}
if (typeof global.crypto.subtle === 'undefined') {
  const { webcrypto } = require('crypto');
  global.crypto.subtle = webcrypto.subtle;
}

// Ensure we are in test mode for conditionals in code
process.env.NODE_ENV = 'test';

// Note: Do not reset OTP/SMS between individual tests because some suites
// depend on state across tests (e.g., OTP existing for subsequent checks).

// Provide a clipboard mock if missing so clipboard tests can assert writeText calls
// Ensure navigator exists and prefer the jsdom window.navigator instance
if (!global.navigator) {
  if (typeof window !== 'undefined' && window.navigator) {
    global.navigator = window.navigator;
  } else {
    global.navigator = {};
  }
}

// Create a shared clipboard object to avoid recursive getters between window and global navigator
let __sharedClipboard = global.__JEST_SHARED_CLIPBOARD__;
if (!__sharedClipboard || typeof __sharedClipboard.writeText !== 'function') {
  __sharedClipboard = { writeText: jest.fn(() => Promise.resolve()) };
}
global.__JEST_SHARED_CLIPBOARD__ = __sharedClipboard;

// Define navigator.clipboard on both global and window to return the shared object
try {
  Object.defineProperty(global.navigator, 'clipboard', {
    configurable: true,
    get() { return global.__JEST_SHARED_CLIPBOARD__; },
    set(val) { global.__JEST_SHARED_CLIPBOARD__ = val; __sharedClipboard = val; },
  });
} catch {}

try {
  if (typeof window !== 'undefined' && window.navigator) {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      get() { return global.__JEST_SHARED_CLIPBOARD__; },
      set(val) { global.__JEST_SHARED_CLIPBOARD__ = val; __sharedClipboard = val; },
    });
  }
} catch {}

// Ensure clipboard mock is present before each test (unless a test deliberately removes it)
beforeEach(() => {
  try {
    // Ensure the shared clipboard exists and has a jest-mocked writeText
    if (!global.__JEST_SHARED_CLIPBOARD__ || typeof global.__JEST_SHARED_CLIPBOARD__.writeText !== 'function') {
      global.__JEST_SHARED_CLIPBOARD__ = { writeText: jest.fn(() => Promise.resolve()) };
    }
    __sharedClipboard = global.__JEST_SHARED_CLIPBOARD__;
    if ('mock' in __sharedClipboard.writeText) {
      __sharedClipboard.writeText.mockReset().mockResolvedValue(undefined);
    }
  } catch {}
});

// Polyfill MediaStream for tests that reference it (used when mocking getUserMedia)
if (typeof global.MediaStream === 'undefined') {
  global.MediaStream = function MediaStream() {};
}

// Note: Do not enable fake timers globally. React Testing Library and userEvent
// rely on real timers for proper act() behavior. If a specific test requires
// fake timers, enable them within that test file or test block.