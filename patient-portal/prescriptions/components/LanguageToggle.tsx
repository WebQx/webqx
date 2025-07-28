/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React from 'react';
import { whisperTranslator } from '../services/whisperTranslator';

/**
 * LanguageToggle component for dynamic internationalization
 * Provides multi-language support with real-time switching
 */
interface LanguageToggleProps {
  /** Current active language */
  currentLanguage: string;
  /** Callback when language is changed */
  onLanguageChange: (languageCode: string) => void;
  /** Show language names in native script */
  showNativeNames?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  currentLanguage,
  onLanguageChange,
  showNativeNames = true,
  className = '',
  disabled = false,
  'data-testid': testId = 'language-toggle'
}) => {
  const supportedLanguages = whisperTranslator.getSupportedLanguages();

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = event.target.value;
    if (newLanguage !== currentLanguage) {
      onLanguageChange(newLanguage);
    }
  };

  return (
    <div className={`language-toggle ${className}`} data-testid={testId}>
      <label htmlFor="language-select" className="language-toggle-label">
        🌐 Language:
      </label>
      <select
        id="language-select"
        value={currentLanguage}
        onChange={handleLanguageChange}
        disabled={disabled}
        className="language-select"
        aria-label="Select language"
      >
        {supportedLanguages.map((language) => (
          <option key={language.code} value={language.code}>
            {showNativeNames ? `${language.nativeName} (${language.name})` : language.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageToggle;