import React, { useState, useCallback } from 'react';
import { FHIRAppointment, FHIRAppointmentStatus } from '../../ehr-integrations/types/fhir-r4';

/**
 * Enhanced AppointmentCard component with FHIR R4 integration
 * Displays appointment information with real-time updates and actions
 */
interface AppointmentCardProps {
  /** FHIR Appointment resource */
  appointment?: FHIRAppointment;
  /** Legacy props for backward compatibility */
  title?: string;
  datetime?: string;
  provider?: string;
  details?: string;
  /** CSS class name for styling */
  className?: string;
  /** Enable interactive actions */
  interactive?: boolean;
  /** Callback when appointment is cancelled */
  onCancel?: (appointmentId: string) => void;
  /** Callback when appointment is rescheduled */
  onReschedule?: (appointmentId: string) => void;
  /** Callback when appointment details are viewed */
  onViewDetails?: (appointment: FHIRAppointment) => void;
  /** Show real-time status updates */
  showRealTimeStatus?: boolean;
  /** Theme configuration */
  theme?: {
    primaryColor?: string;
    warningColor?: string;
    errorColor?: string;
    successColor?: string;
  };
}

/**
 * Get appointment status display information
 */
const getStatusInfo = (status: FHIRAppointmentStatus, theme: any) => {
  const statusMap = {
    proposed: { label: 'Proposed', color: theme.primaryColor || '#3b82f6', icon: '📋' },
    pending: { label: 'Pending', color: theme.warningColor || '#f59e0b', icon: '⏳' },
    booked: { label: 'Booked', color: theme.successColor || '#10b981', icon: '✅' },
    arrived: { label: 'Arrived', color: theme.primaryColor || '#3b82f6', icon: '🏥' },
    fulfilled: { label: 'Completed', color: theme.successColor || '#10b981', icon: '✅' },
    cancelled: { label: 'Cancelled', color: theme.errorColor || '#ef4444', icon: '❌' },
    noshow: { label: 'No Show', color: theme.errorColor || '#ef4444', icon: '⚠️' },
    'entered-in-error': { label: 'Error', color: theme.errorColor || '#ef4444', icon: '❌' },
    'checked-in': { label: 'Checked In', color: theme.primaryColor || '#3b82f6', icon: '📝' },
    waitlist: { label: 'Waitlisted', color: theme.warningColor || '#f59e0b', icon: '⏰' }
  };
  
  return statusMap[status] || { label: status, color: '#6b7280', icon: '❓' };
};

/**
 * Format appointment date/time
 */
const formatDateTime = (start?: string, end?: string): string => {
  if (!start) return 'Time TBD';
  
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  
  const dateStr = startDate.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const timeStr = startDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  if (endDate) {
    const endTimeStr = endDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${dateStr} at ${timeStr} - ${endTimeStr}`;
  }
  
  return `${dateStr} at ${timeStr}`;
};

/**
 * Get participant information
 */
const getParticipantInfo = (appointment: FHIRAppointment) => {
  const participants = appointment.participant || [];
  
  const patient = participants.find(p => 
    p.actor?.reference?.startsWith('Patient/') || 
    p.type?.[0]?.coding?.[0]?.code === 'patient'
  );
  
  const provider = participants.find(p => 
    p.actor?.reference?.startsWith('Practitioner/') || 
    p.type?.[0]?.coding?.[0]?.code === 'provider'
  );
  
  return {
    patient: patient?.actor?.display || 'Patient',
    provider: provider?.actor?.display || 'Provider TBD'
  };
};

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  title,
  datetime,
  provider,
  details,
  className = '',
  interactive = false,
  onCancel,
  onReschedule,
  onViewDetails,
  showRealTimeStatus = false,
  theme = {}
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Use FHIR appointment data if available, otherwise fall back to legacy props
  const displayData = appointment ? {
    title: appointment.serviceType?.[0]?.text || appointment.reasonCode?.[0]?.text || 'Appointment',
    datetime: formatDateTime(appointment.start, appointment.end),
    provider: getParticipantInfo(appointment).provider,
    details: appointment.comment || appointment.description || 'No additional details',
    status: appointment.status,
    id: appointment.id
  } : {
    title: title || "Upcoming Appointment",
    datetime: datetime || "No appointments scheduled",
    provider: provider || "WebQX Health",
    details: details || "Schedule your next appointment through the portal",
    status: undefined as FHIRAppointmentStatus | undefined,
    id: undefined
  };

  const statusInfo = displayData.status ? getStatusInfo(displayData.status, theme) : null;

  /**
   * Handle cancel appointment
   */
  const handleCancel = useCallback(async () => {
    if (!displayData.id || !onCancel) return;
    
    if (confirm('Are you sure you want to cancel this appointment?')) {
      setIsProcessing(true);
      try {
        await onCancel(displayData.id);
      } finally {
        setIsProcessing(false);
        setShowActions(false);
      }
    }
  }, [displayData.id, onCancel]);

  /**
   * Handle reschedule appointment
   */
  const handleReschedule = useCallback(async () => {
    if (!displayData.id || !onReschedule) return;
    
    setIsProcessing(true);
    try {
      await onReschedule(displayData.id);
    } finally {
      setIsProcessing(false);
      setShowActions(false);
    }
  }, [displayData.id, onReschedule]);

  /**
   * Handle view details
   */
  const handleViewDetails = useCallback(() => {
    if (appointment && onViewDetails) {
      onViewDetails(appointment);
    }
  }, [appointment, onViewDetails]);

  /**
   * Check if appointment can be cancelled or rescheduled
   */
  const canModify = displayData.status && ['proposed', 'pending', 'booked'].includes(displayData.status);
  
  /**
   * Check if appointment is upcoming
   */
  const isUpcoming = appointment?.start ? new Date(appointment.start) > new Date() : true;

  return (
    <div 
      className={`appointment-card ${className}`}
      role="article"
      aria-label={`Appointment: ${displayData.title}`}
      tabIndex={0}
      style={{
        position: 'relative',
        padding: '1.5rem',
        border: '1px solid #e5e7eb',
        borderRadius: '0.75rem',
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease-in-out',
        cursor: interactive ? 'pointer' : 'default'
      }}
      onMouseEnter={() => interactive && setShowActions(true)}
      onMouseLeave={() => !isProcessing && setShowActions(false)}
      onClick={interactive ? handleViewDetails : undefined}
    >
      {/* Status Badge */}
      {statusInfo && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '1rem',
            backgroundColor: statusInfo.color + '20',
            color: statusInfo.color,
            fontSize: '0.75rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
          aria-label={`Status: ${statusInfo.label}`}
        >
          <span aria-hidden="true">{statusInfo.icon}</span>
          {statusInfo.label}
        </div>
      )}

      {/* Real-time Status Indicator */}
      {showRealTimeStatus && (
        <div
          style={{
            position: 'absolute',
            top: '0.5rem',
            left: '0.5rem',
            width: '0.5rem',
            height: '0.5rem',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            animation: 'pulse 2s infinite'
          }}
          title="Real-time updates enabled"
          aria-label="Real-time updates enabled"
        />
      )}

      <div className="appointment-header" style={{ marginBottom: '1rem' }}>
        <h3 style={{ 
          margin: '0 0 0.5rem 0', 
          fontSize: '1.25rem', 
          fontWeight: '600',
          color: '#1f2937',
          paddingRight: statusInfo ? '6rem' : '0'
        }}>
          {displayData.title}
        </h3>
        <div 
          className="appointment-datetime" 
          aria-label={`Date and time: ${displayData.datetime}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1rem',
            color: '#6b7280',
            fontWeight: '500'
          }}
        >
          <span aria-hidden="true">📅</span>
          {displayData.datetime}
        </div>
      </div>

      <div className="appointment-body">
        <div 
          className="appointment-provider"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem',
            fontSize: '0.875rem'
          }}
        >
          <span aria-hidden="true">👨‍⚕️</span>
          <strong>Provider:</strong> 
          <span style={{ color: '#374151' }}>{displayData.provider}</span>
        </div>
        
        {displayData.details && (
          <p 
            className="appointment-details"
            style={{
              margin: '0 0 1rem 0',
              fontSize: '0.875rem',
              color: '#6b7280',
              lineHeight: '1.5'
            }}
          >
            {displayData.details}
          </p>
        )}

        {/* Appointment Duration */}
        {appointment?.minutesDuration && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: '#6b7280',
            marginBottom: '0.75rem'
          }}>
            <span aria-hidden="true">⏱️</span>
            <strong>Duration:</strong> 
            <span>{appointment.minutesDuration} minutes</span>
          </div>
        )}

        {/* Reason for Visit */}
        {appointment?.reasonCode?.[0]?.text && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: '#6b7280',
            marginBottom: '0.75rem'
          }}>
            <span aria-hidden="true">📝</span>
            <strong>Reason:</strong> 
            <span>{appointment.reasonCode[0].text}</span>
          </div>
        )}
      </div>

      {/* Interactive Actions */}
      {interactive && showActions && canModify && isUpcoming && (
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            display: 'flex',
            gap: '0.5rem',
            opacity: showActions ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out'
          }}
        >
          {onReschedule && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReschedule();
              }}
              disabled={isProcessing}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: theme.primaryColor || '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: '500',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
              title="Reschedule appointment"
            >
              {isProcessing ? '⏳' : '📅'} Reschedule
            </button>
          )}
          
          {onCancel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              disabled={isProcessing}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: theme.errorColor || '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: '500',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
              title="Cancel appointment"
            >
              {isProcessing ? '⏳' : '❌'} Cancel
            </button>
          )}
        </div>
      )}

      {/* Confirmation Number */}
      {appointment?.identifier?.[0]?.value && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.375rem',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            fontSize: '0.75rem',
            color: '#6b7280',
            marginBottom: '0.25rem'
          }}>
            Confirmation Number
          </div>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151',
            fontFamily: 'monospace'
          }}>
            {appointment.identifier[0].value}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .appointment-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .appointment-card:focus {
          outline: 2px solid ${theme.primaryColor || '#3b82f6'};
          outline-offset: 2px;
        }
        
        .appointment-card button:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .appointment-card button:focus {
          outline: 2px solid white;
          outline-offset: -2px;
        }
      `}</style>
    </div>
  );
};

export default AppointmentCard;