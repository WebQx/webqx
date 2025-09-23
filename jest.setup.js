// Extend Jest with @testing-library/jest-dom matchers for TS awareness
require('@testing-library/jest-dom');
try {
  const matchers = require('@testing-library/jest-dom/matchers');
  expect.extend(matchers);
} catch {}

// Polyfill for TextEncoder/TextDecoder in Node.js test environment
(() => {
  try {
    if (typeof global.TextEncoder === 'undefined' || typeof global.TextDecoder === 'undefined') {
      const util = require('util');
      if (util.TextEncoder && util.TextDecoder) {
        global.TextEncoder = util.TextEncoder;
        global.TextDecoder = util.TextDecoder;
      }
    }
  } catch {}
})();

// Ensure Web Crypto is available without overriding read-only properties
(() => {
  const { webcrypto } = require('crypto');
  if (typeof global.crypto === 'undefined') {
    global.crypto = webcrypto;
  } else {
    // Only provide getRandomValues if missing. Do NOT assign to crypto.subtle (read-only in Node).
    if (typeof global.crypto.getRandomValues !== 'function') {
      global.crypto.getRandomValues = webcrypto.getRandomValues.bind(webcrypto);
    }
  }
})();

// Patch Express' dependency on mime.charsets.lookup when running tests
// Some environments hoist a newer mime version without charsets.lookup, causing res.header to crash
(() => {
  try {
    const send = require('send');
    if (send && send.mime) {
      const m = send.mime;
      if (!m.charsets || typeof m.charsets.lookup !== 'function') {
        m.charsets = m.charsets || {};
        // Minimal implementation: default to utf-8 for known text types, else undefined -> no charset append
        m.charsets.lookup = (type) => {
          try {
            const t = String(type || '').toLowerCase();
            if (t.startsWith('text/') || t === 'application/json' || t === 'application/javascript') {
              return 'utf-8';
            }
          } catch {}
          return undefined;
        };
      }
    }
  } catch {}
})();

// Ensure we are in test mode for conditionals in code
process.env.NODE_ENV = 'test';

// Polyfill btoa/atob for Node test environments
(() => {
  try {
    if (typeof global.btoa !== 'function') {
      global.btoa = (str) => Buffer.from(String(str), 'utf8').toString('base64');
    }
    if (typeof global.atob !== 'function') {
      global.atob = (b64) => Buffer.from(String(b64), 'base64').toString('utf8');
    }
  } catch {}
})();

// Patch Express' dependency on send.mime.charsets.lookup to avoid crashes in tests
(() => {
  try {
    const send = require('send');
    if (send && send.mime) {
      if (!send.mime.charsets) send.mime.charsets = {};
      if (typeof send.mime.charsets.lookup !== 'function') {
        // Minimal lookup: default to utf-8 for text/*, */json, */xml, and javascript types
        send.mime.charsets.lookup = (type) => {
          try {
            const t = String(type || '').toLowerCase();
            return /^text\//.test(t) || /\/(json|xml|javascript)$/.test(t) ? 'utf-8' : undefined;
          } catch {
            return 'utf-8';
          }
        };
      }
    }
  } catch {}
})();

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

// Provide basic navigator.mediaDevices with getUserMedia/getDisplayMedia mocks if missing
if (!global.navigator.mediaDevices) {
  global.navigator.mediaDevices = {};
}
if (typeof global.navigator.mediaDevices.getUserMedia !== 'function') {
  global.navigator.mediaDevices.getUserMedia = jest.fn(async () => new MediaStream());
}
if (typeof global.navigator.mediaDevices.getDisplayMedia !== 'function') {
  global.navigator.mediaDevices.getDisplayMedia = jest.fn(async () => new MediaStream());
}

// Note: Do not enable fake timers globally. React Testing Library and userEvent
// rely on real timers for proper act() behavior. If a specific test requires
// fake timers, enable them within that test file or test block.