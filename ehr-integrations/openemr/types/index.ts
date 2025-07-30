export interface OpenEMRConfig {
  baseUrl: string;
  apiVersion: string;
  oauth: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
  };
  fhir?: {
    enabled: boolean;
    baseUrl?: string;
  };
  security?: {
    verifySSL: boolean;
    timeout: number;
  };
  features?: {
    enableAudit: boolean;
    enableSync: boolean;
    syncInterval: number;
  };
  debug?: boolean;
}

export interface OpenEMRTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
  idToken?: string;
}

export interface OpenEMRPatient {
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  name: Array<{
    use: string;
    family: string;
    given: string[];
  }>;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string;
  telecom?: Array<{
    system: 'phone' | 'email' | 'fax' | 'pager' | 'url' | 'sms' | 'other';
    value: string;
    use: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  }>;
  address?: Array<{
    use: 'home' | 'work' | 'temp' | 'old' | 'billing';
    line: string[];
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
  active: boolean;
}

export interface OpenEMRAppointment {
  id: string;
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error' | 'checked-in' | 'waitlist';
  serviceType?: {
    coding?: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  reasonCode?: Array<{
    coding?: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  start: string;
  end: string;
  participant: Array<{
    actor: {
      reference: string;
      display?: string;
    };
    required?: 'required' | 'optional' | 'information-only';
    status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  }>;
  comment?: string;
}

export interface OpenEMRSlot {
  id: string;
  schedule: {
    reference: string;
  };
  status: 'busy' | 'free' | 'busy-unavailable' | 'busy-tentative' | 'entered-in-error';
  start: string;
  end: string;
  serviceType?: Array<{
    coding?: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  comment?: string;
}

export interface OpenEMREncounter {
  id: string;
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: {
    system: string;
    code: string;
    display: string;
  };
  type?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  subject: {
    reference: string;
  };
  participant?: Array<{
    individual: {
      reference: string;
      display?: string;
    };
  }>;
  period: {
    start: string;
    end?: string;
  };
  reasonCode?: Array<{
    coding?: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  diagnosis?: Array<{
    condition: {
      reference: string;
    };
    rank?: number;
  }>;
}

export interface OpenEMRClinicalSummary {
  patient: OpenEMRPatient;
  activeProblems: Array<{
    id: string;
    code: string;
    display: string;
    system: string;
    clinicalStatus: string;
    verificationStatus: string;
    onsetDate?: string;
  }>;
  medications: Array<{
    id: string;
    medication: {
      reference: string;
      display: string;
    };
    status: string;
    dosageInstruction: Array<{
      text: string;
      timing?: {
        repeat: {
          frequency: number;
          period: number;
          periodUnit: string;
        };
      };
    }>;
  }>;
  allergies: Array<{
    id: string;
    substance: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    criticality: 'low' | 'high' | 'unable-to-assess';
    reaction?: Array<{
      manifestation: Array<{
        coding: Array<{
          system: string;
          code: string;
          display: string;
        }>;
      }>;
      severity: 'mild' | 'moderate' | 'severe';
    }>;
  }>;
  vitals: Array<{
    id: string;
    code: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    valueQuantity?: {
      value: number;
      unit: string;
      system: string;
      code: string;
    };
    effectiveDateTime: string;
  }>;
}

export interface OpenEMRSearchParams {
  family?: string;
  given?: string;
  birthdate?: string;
  gender?: string;
  identifier?: string;
  active?: boolean;
  _count?: number;
  _offset?: number;
}

export interface OpenEMRAppointmentRequest {
  patient: string;
  practitioner?: string;
  start: string;
  duration: number; // in minutes
  serviceType?: string;
  reason?: string;
  comment?: string;
}

export interface OpenEMRSlotSearchParams {
  start: string;
  end: string;
  practitioner?: string;
  serviceType?: string;
  status?: 'free' | 'busy' | 'busy-unavailable' | 'busy-tentative';
}

export interface OpenEMROperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  warnings?: string[];
}

export interface OpenEMRAuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string;
  userId: string;
  timestamp: Date;
  outcome: 'success' | 'failure' | 'warning';
  details?: any;
}