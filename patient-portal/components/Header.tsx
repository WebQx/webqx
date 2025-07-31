import React, { useState, useEffect } from 'react';
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
 * - Multilingual support with simplified language selector
 * - Accessibility-compliant design with ARIA labels and live announcements
 * - Responsive layout for various screen sizes
 * - Performance optimized with React.memo
 * - Visual feedback for language changes
 * - Proper semantic HTML structure
 */
const Header: React.FC<HeaderProps> = React.memo(({
  patientName = "Patient",
  language,
  onLanguageChange,
  texts,
  className = ""
}) => {
  const [isLanguageChanging, setIsLanguageChanging] = useState(false);

  /**
   * Handle language selection change with visual feedback
   */
  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = event.target.value as SupportedLanguage;
    setIsLanguageChanging(true);
    
    // Call the callback immediately to update parent state
    onLanguageChange(newLanguage);
    
    // Use a much shorter delay for visual feedback
    setTimeout(() => {
      setIsLanguageChanging(false);
    }, 50);
  };

  /**
   * Get the current language option for display purposes
   */
  const currentLanguageOption = getLanguageOption(language);

  // Announce language changes to screen readers
  useEffect(() => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = `Interface language changed to ${currentLanguageOption.nativeName}`;
    document.body.appendChild(announcement);
    
    const timer = setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    };
  }, [language, currentLanguageOption.nativeName]);

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
        <div className="language-selector-wrapper">
          <select
            id="language-selector"
            className={`language-selector ${isLanguageChanging ? 'changing' : ''}`}
            value={language}
            onChange={handleLanguageChange}
            aria-labelledby="language-selector-label"
            aria-describedby="language-selector-description"
            disabled={isLanguageChanging}
          >
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.nativeName}
              </option>
            ))}
          </select>
          {isLanguageChanging && (
            <div className="language-change-indicator" aria-hidden="true">
              <span className="spinner"></span>
            </div>
          )}
        </div>
        <div id="language-selector-description" className="sr-only">
          {texts.languageLabel}. Current selection: {currentLanguageOption.nativeName}
        </div>
      </div>

      {/* Main Content Container */}
      <div className="header-content">
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
      </div>
    </header>
  );
});

// Add display name for debugging
Header.displayName = 'Header';

export default Header;