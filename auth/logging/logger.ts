import { useCallback } from 'react';
import { AuditLogEntry } from '../types';

/**
 * Hook for audit logging
 * Provides functionality to log user actions for compliance and monitoring
 */
export const useAuditLog = () => {
  const logAction = useCallback((entry: AuditLogEntry) => {
    // In a real implementation, this would send logs to a secure logging service
    // For now, we'll log to console with proper formatting
    console.log(`[AUDIT LOG] ${entry.timestamp} - ${entry.module}:${entry.action} by ${entry.user} [${entry.status}]`, {
      ...entry,
      ...(entry.error && { error: entry.error })
    });

    // Here you would typically send to your audit logging service:
    // await auditLogService.log(entry);
  }, []);

  return logAction;
};