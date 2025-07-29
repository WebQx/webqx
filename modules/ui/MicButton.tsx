import React from 'react';
import { MicButtonProps } from './types';

/**
 * Microphone Button Component
 * Accessible button for starting voice recording
 */
const MicButton: React.FC<MicButtonProps> = ({ 
  onClick, 
  'aria-label': ariaLabel = "Start recording", 
  disabled = false 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="mic-button"
      style={{
        backgroundColor: disabled ? '#ccc' : '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        width: '60px',
        height: '60px',
        fontSize: '24px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.3s ease'
      }}
    >
      🎤
    </button>
  );
};

export default MicButton;