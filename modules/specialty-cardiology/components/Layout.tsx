import React from 'react';

/**
 * Cardiology Layout Component
 * Provides consistent layout and styling for cardiology-related pages
 */
interface CardiologyLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const CardiologyLayout: React.FC<CardiologyLayoutProps> = ({ 
  children, 
  className = "" 
}) => {
  return (
    <div 
      className={`cardiology-layout ${className}`}
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <header style={{ 
        marginBottom: '24px', 
        textAlign: 'center',
        borderBottom: '2px solid #e0e0e0',
        paddingBottom: '16px'
      }}>
        <h1 style={{ 
          color: '#d32f2f', 
          margin: 0,
          fontSize: '28px',
          fontWeight: 'bold'
        }}>
          ❤️ Cardiology Intake
        </h1>
        <p style={{ 
          color: '#666', 
          margin: '8px 0 0 0',
          fontSize: '16px'
        }}>
          Voice-enabled clinical documentation
        </p>
      </header>
      
      <main style={{ minHeight: '400px' }}>
        {children}
      </main>
      
      <footer style={{ 
        marginTop: '24px',
        paddingTop: '16px',
        borderTop: '1px solid #e0e0e0',
        textAlign: 'center',
        fontSize: '14px',
        color: '#666'
      }}>
        <p>WebQX Healthcare Platform - Cardiology Module</p>
      </footer>
    </div>
  );
};

export default CardiologyLayout;