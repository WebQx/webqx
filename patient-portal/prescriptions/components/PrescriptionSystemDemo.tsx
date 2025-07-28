/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React, { useState } from 'react';
import PrescriptionForm from './PrescriptionForm';
import { ThemeProvider, ThemeToggle } from './ThemeProvider';
import VoiceControl from './VoiceControl';
import { PrescriptionForm as PrescriptionFormData } from '../types';
import '../styles/prescriptions.css';

/**
 * Complete Prescription System Demo
 * Showcases all implemented features and enhancements
 */
interface PrescriptionSystemDemoProps {
  /** Whether to show all accessibility features */
  showAccessibilityFeatures?: boolean;
  /** Whether to enable voice control */
  enableVoiceControl?: boolean;
  /** Initial theme */
  defaultTheme?: 'light' | 'dark';
}

export const PrescriptionSystemDemo: React.FC<PrescriptionSystemDemoProps> = ({
  showAccessibilityFeatures = true,
  enableVoiceControl = true,
  defaultTheme = 'light'
}) => {
  const [submittedPrescriptions, setSubmittedPrescriptions] = useState<PrescriptionFormData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePrescriptionSubmit = async (prescription: PrescriptionFormData) => {
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add timestamp and ID
      const completePrescription = {
        ...prescription,
        id: `rx_${Date.now()}`,
        dateIssued: new Date()
      };
      
      setSubmittedPrescriptions(prev => [...prev, completePrescription]);
      
      // Announce success to screen reader and voice control
      const message = `Prescription created successfully for patient ${prescription.patientId}`;
      
      // Screen reader announcement
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = message;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);

      console.log('Prescription submitted:', completePrescription);
    } catch (error) {
      console.error('Failed to submit prescription:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemeProvider defaultTheme={defaultTheme}>
      <div className="prescription-system-demo">
        {/* Header with Theme Toggle */}
        <header className="demo-header" style={{ 
          padding: 'var(--spacing-md)', 
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 'var(--spacing-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              color: 'var(--color-primary)',
              fontSize: '1.5rem' 
            }}>
              WebQX Prescription System
            </h1>
            <p style={{ 
              margin: '0.5rem 0 0 0', 
              color: 'var(--color-text-secondary)',
              fontSize: '0.9rem'
            }}>
              Comprehensive prescription management with enhanced features
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <ThemeToggle />
          </div>
        </header>

        {/* Voice Control (if enabled) */}
        {showAccessibilityFeatures && enableVoiceControl && (
          <VoiceControl
            enabled={enableVoiceControl}
            language="en-US"
            onSpeechRecognized={(text, confidence) => {
              console.log('Speech recognized:', text, 'Confidence:', confidence);
            }}
            className="demo-voice-control"
          />
        )}

        {/* Main Prescription Form */}
        <main>
          <PrescriptionForm
            onSubmit={handlePrescriptionSubmit}
            showLanguageToggle={true}
            language="en"
            className="demo-prescription-form"
          />
        </main>

        {/* Submitted Prescriptions Display */}
        {submittedPrescriptions.length > 0 && (
          <section style={{
            marginTop: 'var(--spacing-xl)',
            padding: 'var(--spacing-lg)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)'
          }}>
            <h2 style={{ 
              color: 'var(--color-primary)',
              marginBottom: 'var(--spacing-md)'
            }}>
              📋 Recent Prescriptions ({submittedPrescriptions.length})
            </h2>
            
            <div style={{ 
              display: 'grid', 
              gap: 'var(--spacing-md)',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
            }}>
              {submittedPrescriptions.slice(-3).map((prescription) => (
                <div
                  key={prescription.id}
                  style={{
                    padding: 'var(--spacing-md)',
                    background: 'var(--color-background)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 'var(--spacing-sm)'
                  }}>
                    <h3 style={{ 
                      margin: 0,
                      fontSize: '1rem',
                      color: 'var(--color-text)'
                    }}>
                      Patient: {prescription.patientId}
                    </h3>
                    <span style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-text-secondary)',
                      background: 'var(--color-surface)',
                      padding: 'var(--spacing-xs)',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      {prescription.priority}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      <strong>Medication:</strong> {prescription.medicationId}
                    </p>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      <strong>Dosage:</strong> {prescription.dosage}
                    </p>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      <strong>Frequency:</strong> {prescription.frequency}
                    </p>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      <strong>Duration:</strong> {prescription.duration}
                    </p>
                    {prescription.instructions && (
                      <p style={{ 
                        margin: '0.5rem 0 0 0',
                        fontStyle: 'italic',
                        color: 'var(--color-text-secondary)'
                      }}>
                        "{prescription.instructions}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Feature Showcase */}
        <section style={{
          marginTop: 'var(--spacing-xl)',
          padding: 'var(--spacing-lg)',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)'
        }}>
          <h2 style={{ 
            color: 'var(--color-primary)',
            marginBottom: 'var(--spacing-md)'
          }}>
            🚀 Implemented Features
          </h2>
          
          <div style={{ 
            display: 'grid', 
            gap: 'var(--spacing-md)',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'
          }}>
            {[
              {
                icon: '🔍',
                title: 'Advanced Medication Search',
                description: 'RxNorm integration with autocomplete, filters, and caching'
              },
              {
                icon: '🌐',
                title: 'Multi-language Support',
                description: 'Real-time translation with 12 supported languages'
              },
              {
                icon: '♿',
                title: 'WCAG 2.1 Accessibility',
                description: 'Screen reader support, keyboard navigation, high contrast'
              },
              {
                icon: '🎤',
                title: 'Voice Control',
                description: 'Speech recognition for hands-free form interaction'
              },
              {
                icon: '🌙',
                title: 'Dark Mode',
                description: 'Automatic theme switching with system preference detection'
              },
              {
                icon: '📊',
                title: 'Export & Reporting',
                description: 'Multiple formats: CSV, JSON, XML, HL7 FHIR, PDF'
              },
              {
                icon: '⚡',
                title: 'Performance Optimized',
                description: 'Caching, debouncing, and retry logic for reliability'
              },
              {
                icon: '🔒',
                title: 'Error Handling',
                description: 'Comprehensive validation with user-friendly messages'
              }
            ].map((feature, index) => (
              <div
                key={index}
                style={{
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-background)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  transition: 'var(--transition)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>
                  {feature.icon}
                </div>
                <h3 style={{ 
                  margin: '0 0 var(--spacing-xs) 0',
                  fontSize: '1rem',
                  color: 'var(--color-text)'
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.4
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          marginTop: 'var(--spacing-xl)',
          padding: 'var(--spacing-lg)',
          textAlign: 'center',
          borderTop: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem'
        }}>
          <p style={{ margin: 0 }}>
            WebQX Prescription System - Enhanced Healthcare Technology
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem' }}>
            Built with React, TypeScript, and comprehensive accessibility features
          </p>
        </footer>
      </div>
    </ThemeProvider>
  );
};

export default PrescriptionSystemDemo;