import React from 'react';
import { SupportedLanguage, LocalizationTexts } from '../types/localization';
import { languageOptions, getLanguageOption } from '../utils/localization';

/**
 * Header component properties
 */
interface HeaderProps {
  /** Patient's display name for personalization */
  patientName?: string;
  /** Current selected language */
  language: SupportedLanguage;
  /** Callback function when language is changed */
  onLanguageChange: (language: SupportedLanguage) => void;
  /** Localized text content */
  texts: LocalizationTexts;
  /** CSS class name for additional styling */
  className?: string;
}

/**
 * Header Component - Portal Navigation and Language Selection
 * 
 * This component renders the main header for the WebQX Patient Portal,
 * including the title, tagline, personalized welcome message, and
 * language selection dropdown with full accessibility support.
 * 
 * Features:
 * - Multilingual support with language selector
 * - Accessibility-compliant design with ARIA labels
 * - Responsive layout for various screen sizes
 * - Proper semantic HTML structure
 */
const Header: React.FC<HeaderProps> = ({
  patientName = "Patient",
  language,
  onLanguageChange,
  texts,
  className = ""
}) => {
  /**
   * Handle language selection change
   */
  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = event.target.value as SupportedLanguage;
    onLanguageChange(newLanguage);
  };

  /**
   * Get the current language option for display purposes
   */
  const currentLanguageOption = getLanguageOption(language);

  return (
    <header className={`portal-header ${className}`} role="banner">
      {/* Language Selector */}
      <div className="language-selector-container">
        <label 
          htmlFor="language-selector"
          className="language-selector-label"
          id="language-selector-label"
        >
          {texts.languageLabel}
        </label>
        <select
          id="language-selector"
          className="language-selector"
          value={language}
          onChange={handleLanguageChange}
          aria-labelledby="language-selector-label"
          aria-describedby="language-selector-description"
        >
          {languageOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.nativeName} ({option.name})
            </option>
          ))}
        </select>
        <div id="language-selector-description" className="sr-only">
          Select your preferred language for the patient portal interface. 
          Current selection: {currentLanguageOption.nativeName}
        </div>
      </div>

      {/* Main Portal Title */}
      <h1 className="portal-title">
        {texts.portalTitle}
      </h1>
      
      {/* Portal Tagline */}
      <p className="portal-tagline" aria-describedby="portal-description">
        {texts.portalTagline}
      </p>
      
      {/* Screen reader description */}
      <div id="portal-description" className="sr-only">
        Your comprehensive healthcare management platform with multilingual support,
        appointment scheduling, secure messaging, and health record access.
      </div>
      
      {/* Personalized Greeting */}
      <div className="welcome-message" role="region" aria-label="Personalized welcome">
        <p>
          {texts.welcomeBack}, <strong>{patientName}</strong>! 👋
        </p>
      </div>
    </header>
  );
};

export default Header;