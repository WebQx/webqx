import React from 'react';
import AppointmentCard from '../components/AppointmentCard';
import LiteracyAssistant from '../components/LiteracyAssistant';
import DrugInteractionChecker from '../components/DrugInteractionChecker';

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
  showLiteracyAssistant = true
}) => {
  return (
    <main 
      className={`portal ${className}`}
      role="main"
      aria-label="WebQX Patient Portal Dashboard"
    >
      {/* Welcome Section */}
      <header className="portal-header" role="banner">
        <h1 className="portal-title">
          🌐 Welcome to WebQX™ Patient Portal
        </h1>
        <p className="portal-tagline" aria-describedby="portal-description">
          Empowering Patients and Supporting Health Care Providers
        </p>
        <div id="portal-description" className="sr-only">
          Your comprehensive healthcare management platform with multilingual support,
          appointment scheduling, secure messaging, and health record access.
        </div>
        
        {/* Personalized Greeting */}
        <div className="welcome-message" role="region" aria-label="Personalized welcome">
          <p>Welcome back, <strong>{patientName}</strong>! 👋</p>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="portal-content">
        
        {/* Appointments Section */}
        <section 
          className="appointments-section"
          role="region"
          aria-labelledby="appointments-heading"
        >
          <h2 id="appointments-heading" className="section-title">
            📅 Your Appointments
          </h2>
          <div className="appointments-grid" role="list">
            <AppointmentCard
              title="Annual Checkup"
              datetime="March 15, 2024 at 10:00 AM"
              provider="Dr. Smith, Internal Medicine"
              details="Annual physical examination and health screening"
              className="appointment-upcoming"
            />
            <AppointmentCard
              title="Follow-up Visit"
              datetime="March 22, 2024 at 2:30 PM"
              provider="Dr. Johnson, Cardiology"
              details="Follow-up for previous consultation"
              className="appointment-upcoming"
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
            🎯 Quick Actions
          </h2>
          <nav className="quick-actions-nav" role="navigation" aria-label="Quick actions menu">
            <ul className="quick-actions-list">
              <li>
                <button 
                  className="action-button"
                  aria-label="Schedule new appointment"
                >
                  🗓️ Schedule Appointment
                </button>
              </li>
              <li>
                <button 
                  className="action-button"
                  aria-label="View test results"
                >
                  🧪 View Lab Results
                </button>
              </li>
              <li>
                <button 
                  className="action-button"
                  aria-label="Send secure message to provider"
                >
                  💬 Message Provider
                </button>
              </li>
              <li>
                <button 
                  className="action-button"
                  aria-label="Request prescription refill"
                >
                  💊 Refill Prescription
                </button>
              </li>
            </ul>
          </nav>
        </section>

        {/* Health Overview Section */}
        <section 
          className="health-overview-section"
          role="region"
          aria-labelledby="health-overview-heading"
        >
          <h2 id="health-overview-heading" className="section-title">
            📊 Health Overview
          </h2>
          <div className="health-overview-grid">
            <div className="health-metric" role="group" aria-label="Vital signs summary">
              <h3>📈 Recent Vitals</h3>
              <ul>
                <li>Blood Pressure: 120/80 mmHg</li>
                <li>Heart Rate: 72 bpm</li>
                <li>Weight: 165 lbs</li>
                <li>Last Updated: March 10, 2024</li>
              </ul>
            </div>
            <div className="health-alerts" role="group" aria-label="Health alerts and reminders">
              <h3>🔔 Health Alerts</h3>
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

        {/* Health Literacy Assistant */}
        {showLiteracyAssistant && (
          <section 
            className="literacy-section"
            role="region"
            aria-labelledby="literacy-heading"
          >
            <h2 id="literacy-heading" className="section-title">
              📚 Health Education
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
            🚨 Emergency Information
          </h2>
          <div className="emergency-content" role="group" aria-label="Emergency contact information">
            <p className="emergency-notice">
              <strong>For medical emergencies, call 911 immediately</strong>
            </p>
            <p>
              For urgent but non-emergency healthcare needs:
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