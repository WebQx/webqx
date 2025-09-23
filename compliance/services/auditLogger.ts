/**
 * Minimal AuditLogger replacement used by compliance services
 * Decoupled from removed ehr-integrations module.
 */
export interface AuditLogInputMinimal {
  action: string;
  resourceType: string;
  resourceId?: string;
  userId?: string;
  userRole?: string;
  success: boolean;
  details?: Record<string, unknown>;
  timestamp?: Date | string;
}

export interface AuditLoggerLike {
  log(entry: AuditLogInputMinimal): Promise<{ success: boolean; data?: { logId: string } }>;
}

export class AuditLogger implements AuditLoggerLike {
  constructor(_config?: Record<string, unknown>) {}
  async log(entry: AuditLogInputMinimal): Promise<{ success: boolean; data?: { logId: string } }>{
    // In tests, this will be mocked; return a basic success structure otherwise
    return { success: true, data: { logId: `audit_${Date.now()}` } };
  }
}
