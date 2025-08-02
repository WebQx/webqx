require('@testing-library/jest-dom');

// Polyfill for TextEncoder/TextDecoder in Node.js test environment
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}