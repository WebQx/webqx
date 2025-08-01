import { CryptoUtils } from '../utils/crypto';

describe('SSO Basic Tests', () => {
  describe('CryptoUtils', () => {
    it('should generate secure random strings', () => {
      const random1 = CryptoUtils.generateSecureRandom();
      const random2 = CryptoUtils.generateSecureRandom();
      
      expect(random1).toBeDefined();
      expect(random2).toBeDefined();
      expect(random1).not.toBe(random2);
      expect(random1.length).toBe(64); // 32 bytes * 2 (hex)
    });

    it('should generate secure state', () => {
      const state1 = CryptoUtils.generateState();
      const state2 = CryptoUtils.generateState();
      
      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state1).not.toBe(state2);
      expect(state1.length).toBe(32); // 16 bytes * 2 (hex)
    });

    it('should generate nonce', () => {
      const nonce1 = CryptoUtils.generateNonce();
      const nonce2 = CryptoUtils.generateNonce();
      
      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBe(32); // 16 bytes * 2 (hex)
    });

    it('should hash strings correctly', () => {
      const data = 'test-data';
      const hash1 = CryptoUtils.hash(data);
      const hash2 = CryptoUtils.hash(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA256 hash length
    });

    it('should create and verify HMAC', () => {
      const data = 'test-data';
      const secret = 'test-secret';
      
      const signature = CryptoUtils.createHMAC(data, secret);
      const isValid = CryptoUtils.verifyHMAC(data, signature, secret);
      const isInvalid = CryptoUtils.verifyHMAC(data, signature, 'wrong-secret');
      
      expect(signature).toBeDefined();
      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    it('should safely compare strings', () => {
      const string1 = 'test-string';
      const string2 = 'test-string';
      const string3 = 'different-string';
      
      expect(CryptoUtils.safeCompare(string1, string2)).toBe(true);
      expect(CryptoUtils.safeCompare(string1, string3)).toBe(false);
    });
  });
});