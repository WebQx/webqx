/**
 * WebQX™ Authentication System Types
 * 
 * Core type definitions for the healthcare authentication and access control system.
 * Designed for HIPAA compliance and healthcare-specific requirements.
 */

// ============================================================================
// Core Authentication Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  specialty?: MedicalSpecialty;
  isVerified: boolean;
  mfaEnabled: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthCredentials {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: AuthSession;
  error?: AuthError;
  requiresMFA?: boolean;
}

// ============================================================================
// User Roles and Permissions
// ============================================================================

export type UserRole = 
  | 'PATIENT'
  | 'PROVIDER'
  | 'NURSE'
  | 'ADMIN'
  | 'STAFF'
  | 'RESIDENT'
  | 'FELLOW'
  | 'ATTENDING';

export type Permission = 
  // Patient permissions
  | 'read:own_records'
  | 'create:appointments'
  | 'read:lab_results'
  | 'send:messages'
  
  // Provider permissions
  | 'read:patient_records'
  | 'write:prescriptions'
  | 'write:clinical_notes'
  | 'order:lab_tests'
  | 'access:imaging'
  
  // Administrative permissions
  | 'manage:users'
  | 'configure:system'
  | 'view:audit_logs'
  | 'manage:billing'
  
  // Nursing permissions
  | 'write:vitals'
  | 'administer:medications'
  | 'monitor:patients'
  
  // Attending-specific permissions
  | 'supervise:residents'
  | 'approve:procedures';

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
  resources: string[];
  restrictions?: string[];
}

// ============================================================================
// Medical Specialties
// ============================================================================

export type MedicalSpecialty = 
  | 'PRIMARY_CARE'
  | 'RADIOLOGY'
  | 'CARDIOLOGY'
  | 'PEDIATRICS'
  | 'ONCOLOGY'
  | 'PSYCHIATRY'
  | 'ENDOCRINOLOGY'
  | 'ORTHOPEDICS'
  | 'NEUROLOGY'
  | 'GASTROENTEROLOGY'
  | 'PULMONOLOGY'
  | 'DERMATOLOGY'
  | 'OBGYN'
  | 'ANESTHESIOLOGY'
  | 'EMERGENCY_MEDICINE'
  | 'PATHOLOGY'
  | 'SURGERY'
  | 'UROLOGY'
  | 'OPHTHALMOLOGY'
  | 'ENT';

export interface SpecialtyAccess {
  specialty: MedicalSpecialty;
  tools: string[];
  protocols: string[];
  restrictedAreas?: string[];
  requiredCertifications?: string[];
}

// ============================================================================
// Provider Verification
// ============================================================================

export interface Provider extends User {
  role: 'PROVIDER' | 'RESIDENT' | 'FELLOW' | 'ATTENDING';
  npiNumber: string;
  deaNumber?: string;
  medicalLicenseNumber: string;
  medicalLicenseState: string;
  boardCertifications: BoardCertification[];
  hospitalPrivileges: HospitalPrivilege[];
  verificationStatus: ProviderVerificationStatus;
  verificationDate?: Date;
}

export interface BoardCertification {
  boardName: string;
  specialty: MedicalSpecialty;
  certificationNumber: string;
  issueDate: Date;
  expirationDate: Date;
  isActive: boolean;
}

export interface HospitalPrivilege {
  hospitalId: string;
  hospitalName: string;
  privilegeType: string;
  department: string;
  grantedDate: Date;
  expirationDate?: Date;
  isActive: boolean;
}

export type ProviderVerificationStatus = 
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUSPENDED';

export interface VerificationRequest {
  providerId: string;
  requestType: 'LICENSE' | 'DEA' | 'BOARD_CERTIFICATION' | 'NPI';
  requestData: Record<string, any>;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  completedAt?: Date;
  result?: VerificationResult;
}

export interface VerificationResult {
  isValid: boolean;
  details: Record<string, any>;
  source: string;
  verifiedAt: Date;
  expirationDate?: Date;
}

// ============================================================================
// Authentication Providers
// ============================================================================

export interface AuthProvider {
  name: string;
  initialize(config: AuthProviderConfig): Promise<void>;
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  createUser(userData: CreateUserData): Promise<User>;
  verifySession(token: string): Promise<User | null>;
  revokeSession(sessionId: string): Promise<void>;
  refreshToken(refreshToken: string): Promise<AuthSession>;
}

export interface AuthProviderConfig {
  apiKey?: string;
  domain?: string;
  projectId?: string;
  enableMFA?: boolean;
  sessionTimeout?: number;
  [key: string]: any;
}

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  specialty?: MedicalSpecialty;
  temporaryPassword?: string;
}

// ============================================================================
// Access Control
// ============================================================================

export interface AccessControlRequest {
  userId: string;
  resource: string;
  action: string;
  context?: AccessContext;
}

export interface AccessContext {
  patientId?: string;
  departmentId?: string;
  specialty?: MedicalSpecialty;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, any>;
}

export interface AccessControlResult {
  granted: boolean;
  reason?: string;
  conditions?: string[];
  auditRequired?: boolean;
}

// ============================================================================
// Audit and Logging
// ============================================================================

export interface AuthAuditEvent {
  id: string;
  eventType: AuthEventType;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details: Record<string, any>;
  timestamp: Date;
}

export type AuthEventType = 
  | 'LOGIN_ATTEMPT'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'SESSION_EXPIRED'
  | 'PASSWORD_RESET'
  | 'MFA_SETUP'
  | 'MFA_VERIFICATION'
  | 'PERMISSION_DENIED'
  | 'PROVIDER_VERIFICATION'
  | 'ROLE_CHANGE'
  | 'ACCOUNT_LOCKED'
  | 'SUSPICIOUS_ACTIVITY';

// ============================================================================
// Configuration
// ============================================================================

export interface AuthConfig {
  provider: 'firebase' | 'custom';
  enableProviderVerification: boolean;
  enableAuditLogging: boolean;
  specialtyAccess: boolean;
  mfaRequired: boolean;
  sessionTimeout: number;
  maxFailedAttempts: number;
  passwordPolicy: PasswordPolicy;
  auditConfig: AuditConfig;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number; // days
  preventReuse: number; // number of previous passwords to check
}

export interface AuditConfig {
  enabled: boolean;
  retentionDays: number;
  logToFile: boolean;
  logToDatabase: boolean;
  logToExternalService: boolean;
  externalServiceEndpoint?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: Record<string, any>;
}

export type AuthErrorCode = 
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'USER_DISABLED'
  | 'ACCOUNT_LOCKED'
  | 'SESSION_EXPIRED'
  | 'INVALID_TOKEN'
  | 'MFA_REQUIRED'
  | 'MFA_INVALID'
  | 'PERMISSION_DENIED'
  | 'PROVIDER_NOT_VERIFIED'
  | 'LICENSE_EXPIRED'
  | 'SPECIALTY_ACCESS_DENIED'
  | 'NETWORK_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'UNKNOWN_ERROR'
  | 'EXCHANGE_FAILED'
  | 'CENTRAL_IDP_TOKEN_EXCHANGE_FAILED'
  | 'OPENEMR_TOKEN_EXCHANGE_FAILED';

// ============================================================================
// Middleware and Hooks
// ============================================================================

export interface AuthMiddleware {
  requireAuth: (req: any, res: any, next: any) => void;
  requireRole: (role: UserRole) => (req: any, res: any, next: any) => void;
  requireSpecialty: (specialty: MedicalSpecialty) => (req: any, res: any, next: any) => void;
  requireVerifiedProvider: (req: any, res: any, next: any) => void;
  auditRequest: (req: any, res: any, next: any) => void;
}

export interface AuthHookResult {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
  login: (credentials: AuthCredentials) => Promise<AuthResult>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasPermission: (permission: Permission) => boolean;
  hasSpecialtyAccess: (specialty: MedicalSpecialty) => boolean;
}

// ============================================================================
// External API Types
// ============================================================================

export interface ExternalVerificationAPI {
  validateLicense: (licenseNumber: string, state: string) => Promise<LicenseValidationResult>;
  validateNPI: (npiNumber: string) => Promise<NPIValidationResult>;
  validateDEA: (deaNumber: string) => Promise<DEAValidationResult>;
}

export interface LicenseValidationResult {
  isValid: boolean;
  licenseNumber: string;
  state: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';
  issueDate: Date;
  expirationDate: Date;
  practitionerName: string;
  disciplinaryActions?: DisciplinaryAction[];
}

export interface NPIValidationResult {
  isValid: boolean;
  npiNumber: string;
  providerType: 'INDIVIDUAL' | 'ORGANIZATION';
  name: string;
  specialty?: string;
  address: string;
  isActive: boolean;
}

export interface DEAValidationResult {
  isValid: boolean;
  deaNumber: string;
  registrantName: string;
  businessActivity: string;
  schedules: string[];
  expirationDate: Date;
  isActive: boolean;
}

export interface DisciplinaryAction {
  actionType: string;
  actionDate: Date;
  description: string;
  status: 'PENDING' | 'ACTIVE' | 'RESOLVED';
}