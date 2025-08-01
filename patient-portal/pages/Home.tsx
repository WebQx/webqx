import React, { useState } from 'react';
import TelehealthAppointmentCard from '../components/TelehealthAppointmentCard';
import LiteracyAssistant from '../components/LiteracyAssistant';
import DrugInteractionChecker from '../components/DrugInteractionChecker';
import Header from '../components/Header';
import PrescriptionDosage from '../components/PrescriptionDosage';
import SpecialtyPicker from '../components/SpecialtyPicker';
import { SupportedLanguage } from '../types/localization';
import { getTranslations } from '../utils/localization';

/**
 * Home component - Main landing page for the WebQX Patient Portal
 * 
 * This component serves as the primary interface for patients accessing
 * the WebQX healthcare platform. It provides a comprehensive overview
 * of available services and quick access to essential healthcare features.
 * 
 * Features:
 * - Welcome panel with personalized care overview
 * - Appointment management and scheduling
 * - Health literacy assistance
 * - Accessibility-compliant design with ARIA labels
 * - Responsive layout for various screen sizes
 */

interface HomeProps {
  /** Patient's display name for personalization */
  patientName?: string;
  /** CSS class name for additional styling */
  className?: string;
  /** Whether to show the literacy assistant expanded by default */
  showLiteracyAssistant?: boolean;
  /** Initial language for the portal */
  initialLanguage?: SupportedLanguage;
  /** Callback function when language is changed */
  onLanguageChange?: (language: SupportedLanguage) => void;
  /** Whether to show the specialty picker section */
  showSpecialtyPicker?: boolean;
}

/**
 * Home Component - Patient Portal Main Dashboard
 * 
 * Renders the main dashboard interface for patients, including
 * appointment cards, health literacy tools, and navigation to
 * various portal features.
 */
const Home: React.FC<HomeProps> = ({
  patientName = "Patient",
  className = "",
  showLiteracyAssistant = true,
  initialLanguage = 'en',
  onLanguageChange,
  showSpecialtyPicker = true
}) => {
  // State management for language selection
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(initialLanguage);
  
  // Get localized texts based on current language
  const texts = getTranslations(currentLanguage);
  
  /**
   * Handle language change - update local state and notify parent component
   */
  const handleLanguageChange = (newLanguage: SupportedLanguage) => {
    setCurrentLanguage(newLanguage);
    // Notify parent component if callback is provided
    if (onLanguageChange) {
      onLanguageChange(newLanguage);
    }
  };

  // Sample dosage data for demonstration
  const sampleDosages = [
    {
      id: '1',
      amount: '250mg',
      frequency: 'twice daily',
      instructions: 'Take with food to reduce stomach upset',
      recommended: true
    },
    {
      id: '2',
      amount: '500mg',
      frequency: 'once daily',
      instructions: 'Take on empty stomach, 1 hour before meals'
    },
    {
      id: '3',
      amount: '125mg',
      frequency: 'three times daily',
      instructions: 'Take at evenly spaced intervals'
    }
  ];

  const handleDosageChoice = (dosage: any) => {
    alert(`You selected: ${dosage.amount} ${dosage.frequency}\nInstructions: ${dosage.instructions || 'None'}`);
  };

  // Handle telehealth session actions
  const handleJoinSession = (sessionId: string) => {
    console.log('Joining telehealth session:', sessionId);
    // In a real app, this would redirect to the session page
    window.open(`/patient-portal/telehealth-session.html?sessionId=${sessionId}`, '_blank');
  };

  const handleTestConnection = () => {
    console.log('Testing connection...');
    alert('Testing your camera and microphone...\n\nIn a real app, this would open a connection test tool.');
  };

  return (
    <main 
      className={`portal ${className}`}
      role="main"
      aria-label="WebQX Patient Portal Dashboard"
    >
      {/* Welcome Section */}
      <Header
        patientName={patientName}
        language={currentLanguage}
        onLanguageChange={handleLanguageChange}
        texts={texts}
      />

      {/* Main Content Area */}
      <div className="portal-content">
        
        {/* Appointments Section */}
        <section 
          className="appointments-section"
          role="region"
          aria-labelledby="appointments-heading"
        >
          <h2 id="appointments-heading" className="section-title">
            {texts.appointments}
          </h2>
          <div className="appointments-grid" role="list">
            <TelehealthAppointmentCard
              title="Annual Checkup"
              datetime="March 15, 2024 at 10:00 AM"
              provider="Dr. Smith, Internal Medicine"
              details="Annual physical examination and health screening"
              className="appointment-upcoming"
            />
            <TelehealthAppointmentCard
              title="Telehealth Follow-up"
              datetime="March 22, 2024 at 2:30 PM"
              provider="Dr. Johnson, Cardiology"
              details="Follow-up consultation via video call"
              className="appointment-upcoming"
              telehealthSession={{
                sessionId: 'session-123',
                status: 'scheduled',
                canJoin: true,
                joinAvailableAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
                platform: 'webrtc_native'
              }}
              onJoinSession={handleJoinSession}
              onTestConnection={handleTestConnection}
            />
          </div>
        </section>

        {/* Quick Actions Section */}
        <section 
          className="quick-actions-section"
          role="region"
          aria-labelledby="quick-actions-heading"
        >
          <h2 id="quick-actions-heading" className="section-title">
            {texts.quickActions}
          </h2>
          <nav className="quick-actions-nav" role="navigation" aria-label="Quick actions menu">
            <ul className="quick-actions-list">
              <li>
                <button 
                  className="action-button"
                  aria-label="Schedule new appointment"
                >
                  {texts.scheduleAppointment}
                </button>
              </li>
              <li>
                <button 
                  className="action-button"
                  aria-label="View test results"
                >
                  {texts.viewLabResults}
                </button>
              </li>
              <li>
                <button 
                  className="action-button"
                  aria-label="Send secure message to provider"
                >
                  {texts.messageProvider}
                </button>
              </li>
              <li>
                <button 
                  className="action-button"
                  aria-label="Request prescription refill"
                >
                  {texts.refillPrescription}
                </button>
              </li>
            </ul>
          </nav>
        </section>

        {/* Medical Specialty Selection */}
        {showSpecialtyPicker && (
          <section 
            className="specialty-section"
            role="region"
            aria-labelledby="specialty-heading"
          >
            <h2 id="specialty-heading" className="section-title">
              🏥 Medical Specialties
            </h2>
            <p className="section-description">
              Select a medical specialty to find providers and schedule appointments
            </p>
            <SpecialtyPicker 
              label="Choose a Medical Specialty"
              showSelectedSpecialty={true}
              className="portal-specialty-picker"
              onSpecialtyChange={(specialtyId) => {
                console.log('Selected specialty:', specialtyId);
                // In a real app, this would navigate to specialty-specific content
              }}
            />
          </section>
        )}

        {/* Health Overview Section */}
        <section 
          className="health-overview-section"
          role="region"
          aria-labelledby="health-overview-heading"
        >
          <h2 id="health-overview-heading" className="section-title">
            {texts.healthOverview}
          </h2>
          <div className="health-overview-grid">
            <div className="health-metric" role="group" aria-label="Vital signs summary">
              <h3>{texts.recentVitals}</h3>
              <ul>
                <li>Blood Pressure: 120/80 mmHg</li>
                <li>Heart Rate: 72 bpm</li>
                <li>Weight: 165 lbs</li>
                <li>Last Updated: March 10, 2024</li>
              </ul>
            </div>
            <div className="health-alerts" role="group" aria-label="Health alerts and reminders">
              <h3>{texts.healthAlerts}</h3>
              <ul>
                <li>Annual flu shot due</li>
                <li>Prescription refill available</li>
                <li>Wellness check reminder</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Drug Interaction Checker */}
        <section 
          className="drug-interaction-section"
          role="region"
          aria-labelledby="drug-interaction-heading"
        >
          <h2 id="drug-interaction-heading" className="section-title">
            💊 Drug Safety Tools
          </h2>
          <DrugInteractionChecker 
            className="portal-drug-checker"
          />
        </section>

        {/* Prescription Dosage Section */}
        <section 
          className="prescription-section"
          role="region"
          aria-labelledby="prescription-heading"
        >
          <h2 id="prescription-heading" className="section-title">
            💊 Prescription Management
          </h2>
          <PrescriptionDosage
            dosages={sampleDosages}
            onChoose={handleDosageChoice}
            title="Select Your Dosage"
            className="portal-prescription-dosage"
          />
          
          {/* Demo with empty dosages */}
          <PrescriptionDosage
            dosages={[]}
            onChoose={handleDosageChoice}
            title="Alternative Medication (Currently Unavailable)"
            className="portal-prescription-dosage"
          />
        </section>

        {/* Health Literacy Assistant */}
        {showLiteracyAssistant && (
          <section 
            className="literacy-section"
            role="region"
            aria-labelledby="literacy-heading"
          >
            <h2 id="literacy-heading" className="section-title">
              {texts.healthEducation}
            </h2>
            <LiteracyAssistant 
              className="portal-literacy-assistant"
              initiallyExpanded={false}
            />
          </section>
        )}

        {/* Emergency Contact Section */}
        <section 
          className="emergency-section"
          role="region"
          aria-labelledby="emergency-heading"
        >
          <h2 id="emergency-heading" className="section-title">
            {texts.emergencyInfo}
          </h2>
          <div className="emergency-content" role="group" aria-label="Emergency contact information">
            <p className="emergency-notice">
              <strong>{texts.emergencyNotice}</strong>
            </p>
            <p>
              {texts.urgentCare}
            </p>
            <ul>
              <li>Nurse Hotline: (555) 123-HELP</li>
              <li>After-hours clinic: (555) 123-CARE</li>
              <li>Patient portal messaging for non-urgent questions</li>
            </ul>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="portal-footer" role="contentinfo">
        <div className="footer-content">
          <p>&copy; 2024 WebQX Healthcare Platform. All rights reserved.</p>
          <nav aria-label="Footer navigation">
            <ul className="footer-links">
              <li><a href="/privacy" aria-label="Privacy policy">Privacy Policy</a></li>
              <li><a href="/terms" aria-label="Terms of service">Terms of Service</a></li>
              <li><a href="/help" aria-label="Help and support">Help & Support</a></li>
              <li><a href="/accessibility" aria-label="Accessibility statement">Accessibility</a></li>
            </ul>
          </nav>
        </div>
      </footer>
    </main>
  );
};

export default Home;