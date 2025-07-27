import React from 'react';

/**
 * AppointmentCard component displays appointment information
 * This is a placeholder component for the patient portal
 */
interface AppointmentCardProps {
  /** The title of the appointment */
  title?: string;
  /** The date and time of the appointment */
  datetime?: string;
  /** The provider or department name */
  provider?: string;
  /** Additional appointment details */
  details?: string;
  /** CSS class name for styling */
  className?: string;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  title = "Upcoming Appointment",
  datetime = "No appointments scheduled",
  provider = "WebQX Health",
  details = "Schedule your next appointment through the portal",
  className = ""
}) => {
  return (
    <div 
      className={`appointment-card ${className}`}
      role="article"
      aria-label={`Appointment: ${title}`}
    >
      <div className="appointment-header">
        <h3>{title}</h3>
        <span className="appointment-datetime" aria-label={`Date and time: ${datetime}`}>
          📅 {datetime}
        </span>
      </div>
      <div className="appointment-body">
        <p className="appointment-provider">
          <strong>Provider:</strong> {provider}
        </p>
        <p className="appointment-details">{details}</p>
      </div>
    </div>
  );
};

export default AppointmentCard;