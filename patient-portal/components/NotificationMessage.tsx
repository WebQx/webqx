/**
 * NotificationMessage Component
 * 
 * Displays success and informational messages with auto-dismiss functionality
 * and accessibility features.
 */

import React, { useEffect } from 'react';
import { NotificationMessageProps } from '../types/prescription';

/**
 * NotificationMessage - Accessible notification display with auto-dismiss
 */
export const NotificationMessage: React.FC<NotificationMessageProps> = ({
  message,
  type = 'success',
  onDismiss,
  autoHideDelay = 5000
}) => {
  // Auto-dismiss functionality
  useEffect(() => {
    if (message && autoHideDelay > 0 && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss();
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [message, autoHideDelay, onDismiss]);

  if (!message) {
    return null;
  }

  const typeClass = `notification-message--${type}`;
  const iconMap = {
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌'
  };

  const icon = iconMap[type];

  return (
    <div 
      className={`notification-message ${typeClass}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="notification-message__content">
        <div className="notification-message__icon" aria-hidden="true">
          {icon}
        </div>
        <div className="notification-message__text">
          {message}
        </div>
        {onDismiss && (
          <button
            type="button"
            className="notification-message__dismiss"
            onClick={onDismiss}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        )}
      </div>
      
      {autoHideDelay > 0 && (
        <div 
          className="notification-message__progress"
          style={{
            animation: `notification-progress ${autoHideDelay}ms linear forwards`
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default NotificationMessage;