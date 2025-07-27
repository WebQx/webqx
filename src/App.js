import React from 'react';
import WebQXApp from './components/WebQXApp.js';

/**
 * Main App wrapper for WebQX Healthcare Platform
 * Integrates the WebQXApp component with the existing patient portal
 */
const App = () => {
  const handleRoleChange = (newRole) => {
    console.log('Role changed to:', newRole);
    // In a real implementation, this could update user permissions
  };

  const handleAudioToggle = (enabled) => {
    console.log('Audio toggled:', enabled);
    // Could store audio preference in user settings
  };

  const handleSecurityAlert = (auditLog) => {
    console.log('Security event logged:', auditLog);
    // In production, this would send to a secure logging service
  };

  return (
    <div className="app">
      <header style={headerStyles}>
        <h1>🌐 WebQX™ Healthcare Platform</h1>
        <p>Empowering Patients and Supporting Health Care Providers</p>
      </header>
      
      <main style={mainStyles}>
        <WebQXApp
          userRole="patient"
          enableAudio={true}
          hipaaMode={true}
          onRoleChange={handleRoleChange}
          onAudioToggle={handleAudioToggle}
          onSecurityAlert={handleSecurityAlert}
        />
      </main>
      
      <footer style={footerStyles}>
        <p>
          Crafted with ❤️ by WebQX Health - "Care equity begins with code equity."
        </p>
      </footer>
    </div>
  );
};

const headerStyles = {
  textAlign: 'center',
  padding: '20px',
  backgroundColor: '#2c3e50',
  color: 'white',
  marginBottom: '20px'
};

const mainStyles = {
  padding: '0 20px',
  minHeight: '60vh'
};

const footerStyles = {
  textAlign: 'center',
  padding: '20px',
  marginTop: '40px',
  borderTop: '1px solid #ddd',
  color: '#666'
};

export default App;