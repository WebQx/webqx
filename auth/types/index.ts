/**
 * Authentication and authorization types
 */

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  specialty?: string;
}

export interface UseAuthReturn {
  user: User;
  roleVerified: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuditLogEntry {
  user: string;
  module: string;
  action: string;
  timestamp: string;
  status: 'success' | 'failure';
  error?: string;
}