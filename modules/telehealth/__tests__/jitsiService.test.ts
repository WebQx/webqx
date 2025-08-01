/**
 * @jest-environment jsdom
 */

import { JitsiService } from '../services/jitsiService';
import { generateRoomName, validateSession } from '../types';

describe('JitsiService', () => {
  let jitsiService: JitsiService;

  beforeEach(() => {
    jitsiService = new JitsiService({
      serverUrl: 'https://test.jitsi.com',
      enablePasswordsByDefault: true,
      maxParticipants: 5
    });
  });

  describe('generateSecureRoomName', () => {
    it('should generate a valid room name from patient UUID', () => {
      const patientId = '123e4567-e89b-12d3-a456-426614174000';
      const roomName = jitsiService.generateSecureRoomName(patientId);
      
      expect(roomName).toMatch(/^webqx-[a-f0-9]{8}-[a-f0-9]{8}-[a-z0-9]{6,8}$/);
      expect(roomName).toContain('123e4567');
    });

    it('should throw error for invalid patient UUID', () => {
      const invalidPatientId = 'invalid-uuid';
      
      expect(() => {
        jitsiService.generateSecureRoomName(invalidPatientId);
      }).toThrow('Patient ID must be a valid UUID format');
    });

    it('should generate unique room names for same patient', () => {
      const patientId = '123e4567-e89b-12d3-a456-426614174000';
      const roomName1 = jitsiService.generateSecureRoomName(patientId);
      const roomName2 = jitsiService.generateSecureRoomName(patientId);
      
      expect(roomName1).not.toBe(roomName2);
    });
  });

  describe('createRoom', () => {
    it('should create a room with default configuration', async () => {
      const patientId = '123e4567-e89b-12d3-a456-426614174000';
      const displayName = 'Test Telehealth Session';
      
      const result = await jitsiService.createRoom(patientId, displayName);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.roomName).toMatch(/^webqx-/);
      expect(result.data?.displayName).toBe(displayName);
      expect(result.data?.password).toBeDefined();
      expect(result.data?.maxParticipants).toBe(5);
    });

    it('should create a room with custom options', async () => {
      const patientId = '123e4567-e89b-12d3-a456-426614174000';
      const displayName = 'Test Session';
      const customOptions = {
        enableLobby: false,
        requirePassword: false,
        enableChat: false
      };
      
      const result = await jitsiService.createRoom(patientId, displayName, customOptions);
      
      expect(result.success).toBe(true);
      expect(result.data?.options?.enableLobby).toBe(false);
      expect(result.data?.options?.requirePassword).toBe(false);
      expect(result.data?.options?.enableChat).toBe(false);
      // Password might still be generated due to enablePasswordsByDefault config
      // So we check the option instead
    });
  });

  describe('generateRoomLinks', () => {
    it('should generate valid room links', async () => {
      const roomConfig = {
        roomName: 'webqx-123e4567-abcd1234-xy12z3',
        displayName: 'Test Room',
        password: 'testpass',
        maxParticipants: 10,
        options: {}
      };
      
      const result = await jitsiService.generateRoomLinks(roomConfig);
      
      expect(result.success).toBe(true);
      expect(result.data?.roomUrl).toBe('https://test.jitsi.com/webqx-123e4567-abcd1234-xy12z3');
      expect(result.data?.webLink).toContain('config.roomPassword');
      expect(result.data?.mobileLink).toContain('jitsi-meet://');
    });

    it('should generate links without password when not provided', async () => {
      const roomConfig = {
        roomName: 'webqx-123e4567-abcd1234-xy12z3',
        displayName: 'Test Room',
        maxParticipants: 10,
        options: {}
      };
      
      const result = await jitsiService.generateRoomLinks(roomConfig);
      
      expect(result.success).toBe(true);
      expect(result.data?.webLink).not.toContain('config.roomPassword');
    });
  });

  describe('validateRoomConfig', () => {
    it('should validate correct room configuration', () => {
      const roomConfig = {
        roomName: 'webqx-test-room',
        displayName: 'Valid Test Room',
        password: 'testpassword',
        maxParticipants: 5,
        expiresAt: new Date(Date.now() + 60000),
        options: {}
      };
      
      const result = jitsiService.validateRoomConfig(roomConfig);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid room configuration', () => {
      const roomConfig = {
        roomName: '',
        displayName: '',
        password: '123',
        maxParticipants: 1,
        expiresAt: new Date(Date.now() - 60000),
        options: {}
      };
      
      const result = jitsiService.validateRoomConfig(roomConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Room name is required');
      expect(result.errors).toContain('Display name is required');
      expect(result.errors).toContain('Room password must be at least 6 characters');
      expect(result.errors).toContain('Maximum participants must be at least 2');
      expect(result.errors).toContain('Room expiration time must be in the future');
    });
  });

  describe('isValidRoomName', () => {
    it('should validate correct room name format', () => {
      const validRoomName = 'webqx-123e4567-abcd1234-xy12z3';
      
      expect(jitsiService.isValidRoomName(validRoomName)).toBe(true);
    });

    it('should reject invalid room name format', () => {
      const invalidRoomNames = [
        'invalid-room-name',
        'webqx-123-456-789',
        'webqx-invalid',
        'not-webqx-room'
      ];
      
      invalidRoomNames.forEach(roomName => {
        expect(jitsiService.isValidRoomName(roomName)).toBe(false);
      });
    });
  });

  describe('extractPatientIdFromRoom', () => {
    it('should extract patient ID from valid room name', () => {
      const roomName = 'webqx-123e4567-abcd1234-xy12z3';
      const patientId = jitsiService.extractPatientIdFromRoom(roomName);
      
      expect(patientId).toBe('123e4567');
    });

    it('should return null for invalid room name', () => {
      const invalidRoomName = 'invalid-room-name';
      const patientId = jitsiService.extractPatientIdFromRoom(invalidRoomName);
      
      expect(patientId).toBeNull();
    });
  });
});

describe('Utility Functions', () => {
  describe('generateRoomName', () => {
    it('should generate consistent format', () => {
      const patientId = '123e4567-e89b-12d3-a456-426614174000';
      const sessionId = 'session-123';
      
      const roomName = generateRoomName(patientId, sessionId);
      
      expect(roomName).toMatch(/^webqx-[a-f0-9]{8}-[a-f0-9]{8}-[a-z0-9\-]+$/);
      expect(roomName).toContain('123e4567');
      expect(roomName).toContain('session-');
    });

    it('should generate unique names without session ID', () => {
      const patientId = '123e4567-e89b-12d3-a456-426614174000';
      
      const roomName1 = generateRoomName(patientId);
      const roomName2 = generateRoomName(patientId);
      
      expect(roomName1).not.toBe(roomName2);
    });
  });

  describe('validateSession', () => {
    it('should validate correct session data', () => {
      const sessionData = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        providerId: 'provider-123',
        scheduledStartTime: new Date(Date.now() + 60000)
      };
      
      const result = validateSession(sessionData);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject session with missing required fields', () => {
      const sessionData = {
        patientId: '',
        providerId: '',
        scheduledStartTime: undefined
      };
      
      const result = validateSession(sessionData);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Patient ID is required');
      expect(result.errors).toContain('Provider ID is required');
      expect(result.errors).toContain('Scheduled start time is required');
    });

    it('should reject session with past start time', () => {
      const sessionData = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        providerId: 'provider-123',
        scheduledStartTime: new Date(Date.now() - 60000)
      };
      
      const result = validateSession(sessionData);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Scheduled start time cannot be in the past');
    });
  });
});