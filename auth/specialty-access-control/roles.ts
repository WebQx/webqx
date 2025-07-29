/**
 * Healthcare Role Definitions for WebQX™
 * 
 * Defines role-based access control (RBAC) permissions for different
 * healthcare user types with HIPAA-compliant access patterns.
 */

import { UserRole, Permission, RolePermissions } from '../types';

/**
 * Comprehensive healthcare role definitions with permissions and resources
 */
export const HEALTHCARE_ROLES: Record<UserRole, RolePermissions> = {
  PATIENT: {
    role: 'PATIENT',
    permissions: [
      'read:own_records',
      'create:appointments',
      'read:lab_results',
      'send:messages'
    ],
    resources: [
      'patient_portal',
      'messaging',
      'appointments',
      'lab_results_viewer',
      'medication_list',
      'health_summary'
    ],
    restrictions: [
      'admin_console',
      'provider_tools',
      'clinical_documentation',
      'prescription_writing'
    ]
  },

  PROVIDER: {
    role: 'PROVIDER',
    permissions: [
      'read:patient_records',
      'write:prescriptions',
      'write:clinical_notes',
      'order:lab_tests',
      'access:imaging',
      'send:messages',
      'create:appointments'
    ],
    resources: [
      'ehr_system',
      'clinical_tools',
      'prescription_pad',
      'lab_ordering',
      'imaging_tools',
      'patient_records',
      'clinical_documentation',
      'provider_dashboard',
      'messaging',
      'appointment_management'
    ]
  },

  NURSE: {
    role: 'NURSE',
    permissions: [
      'read:patient_records',
      'write:vitals',
      'administer:medications',
      'monitor:patients',
      'send:messages'
    ],
    resources: [
      'nursing_station',
      'patient_monitoring',
      'vitals_recording',
      'medication_administration',
      'patient_records',
      'nursing_documentation',
      'messaging'
    ],
    restrictions: [
      'prescription_writing',
      'advanced_clinical_tools',
      'admin_console'
    ]
  },

  ADMIN: {
    role: 'ADMIN',
    permissions: [
      'manage:users',
      'configure:system',
      'view:audit_logs',
      'manage:billing'
    ],
    resources: [
      'admin_console',
      'system_settings',
      'user_management',
      'audit_logs',
      'billing_management',
      'system_configuration',
      'compliance_dashboard'
    ],
    restrictions: [
      'direct_patient_care',
      'prescription_writing'
    ]
  },

  STAFF: {
    role: 'STAFF',
    permissions: [
      'create:appointments',
      'read:lab_results',
      'send:messages'
    ],
    resources: [
      'appointment_scheduling',
      'patient_check_in',
      'basic_patient_info',
      'messaging',
      'registration_system'
    ],
    restrictions: [
      'clinical_documentation',
      'prescription_writing',
      'admin_console',
      'patient_records'
    ]
  },

  RESIDENT: {
    role: 'RESIDENT',
    permissions: [
      'read:patient_records',
      'write:clinical_notes',
      'order:lab_tests',
      'access:imaging',
      'send:messages'
    ],
    resources: [
      'ehr_system',
      'clinical_tools',
      'lab_ordering',
      'imaging_tools',
      'patient_records',
      'clinical_documentation',
      'educational_resources',
      'messaging'
    ],
    restrictions: [
      'prescription_writing', // Requires attending supervision
      'admin_console',
      'unsupervised_procedures'
    ]
  },

  FELLOW: {
    role: 'FELLOW',
    permissions: [
      'read:patient_records',
      'write:prescriptions',
      'write:clinical_notes',
      'order:lab_tests',
      'access:imaging',
      'send:messages'
    ],
    resources: [
      'ehr_system',
      'clinical_tools',
      'prescription_pad',
      'lab_ordering',
      'imaging_tools',
      'patient_records',
      'clinical_documentation',
      'advanced_clinical_tools',
      'educational_resources',
      'messaging'
    ],
    restrictions: [
      'admin_console'
    ]
  },

  ATTENDING: {
    role: 'ATTENDING',
    permissions: [
      'read:patient_records',
      'write:prescriptions',
      'write:clinical_notes',
      'order:lab_tests',
      'access:imaging',
      'send:messages',
      'supervise:residents',
      'approve:procedures'
    ],
    resources: [
      'ehr_system',
      'clinical_tools',
      'prescription_pad',
      'lab_ordering',
      'imaging_tools',
      'patient_records',
      'clinical_documentation',
      'advanced_clinical_tools',
      'procedure_authorization',
      'supervision_tools',
      'quality_metrics',
      'messaging'
    ]
  }
};

/**
 * Role hierarchy for inheritance-based permissions
 * Higher roles inherit permissions from lower roles
 */
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  PATIENT: [],
  STAFF: [],
  NURSE: [],
  RESIDENT: ['STAFF'],
  FELLOW: ['RESIDENT', 'STAFF'],
  PROVIDER: ['STAFF'],
  ATTENDING: ['PROVIDER', 'FELLOW', 'RESIDENT', 'STAFF'],
  ADMIN: []
};

/**
 * Emergency access roles that can override certain restrictions
 */
export const EMERGENCY_ACCESS_ROLES: UserRole[] = [
  'ATTENDING',
  'PROVIDER',
  'FELLOW'
];

/**
 * Roles that require provider verification
 */
export const VERIFICATION_REQUIRED_ROLES: UserRole[] = [
  'PROVIDER',
  'RESIDENT',
  'FELLOW',
  'ATTENDING'
];

/**
 * Get effective permissions for a role (including inherited permissions)
 */
export function getEffectivePermissions(role: UserRole): Permission[] {
  const directPermissions = HEALTHCARE_ROLES[role]?.permissions || [];
  const inheritedRoles = ROLE_HIERARCHY[role] || [];
  
  const inheritedPermissions = inheritedRoles.reduce((acc, inheritedRole) => {
    const rolePermissions = HEALTHCARE_ROLES[inheritedRole]?.permissions || [];
    return [...acc, ...rolePermissions];
  }, [] as Permission[]);

  // Remove duplicates and return
  return Array.from(new Set([...directPermissions, ...inheritedPermissions]));
}

/**
 * Get effective resources for a role (including inherited resources)
 */
export function getEffectiveResources(role: UserRole): string[] {
  const directResources = HEALTHCARE_ROLES[role]?.resources || [];
  const inheritedRoles = ROLE_HIERARCHY[role] || [];
  
  const inheritedResources = inheritedRoles.reduce((acc, inheritedRole) => {
    const roleResources = HEALTHCARE_ROLES[inheritedRole]?.resources || [];
    return [...acc, ...roleResources];
  }, [] as string[]);

  // Remove duplicates and return
  return Array.from(new Set([...directResources, ...inheritedResources]));
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const effectivePermissions = getEffectivePermissions(role);
  return effectivePermissions.includes(permission);
}

/**
 * Check if a role has access to a specific resource
 */
export function hasResourceAccess(role: UserRole, resource: string): boolean {
  const effectiveResources = getEffectiveResources(role);
  const restrictions = HEALTHCARE_ROLES[role]?.restrictions || [];
  
  // Check if explicitly restricted
  if (restrictions.some(restriction => resource.includes(restriction))) {
    return false;
  }
  
  // Check if has access
  return effectiveResources.some(res => resource.includes(res));
}

/**
 * Check if role requires provider verification
 */
export function requiresVerification(role: UserRole): boolean {
  return VERIFICATION_REQUIRED_ROLES.includes(role);
}

/**
 * Check if role has emergency access privileges
 */
export function hasEmergencyAccess(role: UserRole): boolean {
  return EMERGENCY_ACCESS_ROLES.includes(role);
}

export default {
  HEALTHCARE_ROLES,
  ROLE_HIERARCHY,
  EMERGENCY_ACCESS_ROLES,
  VERIFICATION_REQUIRED_ROLES,
  getEffectivePermissions,
  getEffectiveResources,
  hasPermission,
  hasResourceAccess,
  requiresVerification,
  hasEmergencyAccess
};