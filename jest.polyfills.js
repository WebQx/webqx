// Minimal production-safe polyfills to run tests in Node
// 1) TextEncoder/TextDecoder for libraries expecting Web APIs
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

// 2) Ensure global.crypto exists using Node's built-in webcrypto
(() => {
  try {
    const { webcrypto } = require('crypto');
    if (typeof global.crypto === 'undefined') {
      global.crypto = webcrypto;
    } else if (typeof global.crypto.getRandomValues !== 'function') {
      global.crypto.getRandomValues = webcrypto.getRandomValues.bind(webcrypto);
    }
  } catch {}
})();
