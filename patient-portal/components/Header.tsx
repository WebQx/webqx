import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n/config';

/**
 * Header component properties
 */
interface HeaderProps {
  /** Patient's display name for personalization */
  patientName?: string;
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
  className = ""
}) => {
  const { t, i18n } = useTranslation();
  const [isLanguageChanging, setIsLanguageChanging] = useState(false);

  /**
   * Handle language selection change with visual feedback
   */
  const handleLanguageChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = event.target.value;
    setIsLanguageChanging(true);
    
    // Add small delay for visual feedback
    setTimeout(async () => {
      await i18n.changeLanguage(newLanguage);
      // Store the selected language in localStorage
      localStorage.setItem('webqx-language', newLanguage);
      setIsLanguageChanging(false);
    }, 150);
  };

  /**
   * Get the current language option for display purposes
   */
  const currentLanguageOption = supportedLanguages.find(lang => lang.code === i18n.language) || supportedLanguages[0];

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
  }, [i18n.language, currentLanguageOption.nativeName]);

  return (
    <header className={`portal-header ${className}`} role="banner">
      {/* Language Selector */}
      <div className="language-selector-container">
        <label 
          htmlFor="language-selector"
          className="language-selector-label"
          id="language-selector-label"
        >
          {t('language.selector')}
        </label>
        <div className="language-selector-wrapper">
          <select
            id="language-selector"
            className={`language-selector ${isLanguageChanging ? 'changing' : ''}`}
            value={i18n.language}
            onChange={handleLanguageChange}
            aria-labelledby="language-selector-label"
            aria-describedby="language-selector-description"
            disabled={isLanguageChanging}
          >
            {supportedLanguages.map((option) => (
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
          {t('language.selector')}. {t('language.current', { language: currentLanguageOption.nativeName })}
        </div>
      </div>

      {/* Main Content Container */}
      <div className="header-content">
        {/* Main Portal Title */}
        <h1 className="portal-title">
          {t('portal.title')}
        </h1>
        
        {/* Portal Tagline */}
        <p className="portal-tagline" aria-describedby="portal-description">
          {t('portal.tagline')}
        </p>
        
        {/* Screen reader description */}
        <div id="portal-description" className="sr-only">
          {t('portal.description')}
        </div>
        
        {/* Personalized Greeting */}
        <div className="welcome-message" role="region" aria-label="Personalized welcome">
          <p>
            {t('portal.welcomeBack', { name: patientName })}
          </p>
        </div>
      </div>
    </header>
  );
});

// Add display name for debugging
Header.displayName = 'Header';

export default Header;