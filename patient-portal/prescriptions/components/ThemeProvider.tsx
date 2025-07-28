/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

/**
 * Theme Provider for Dark Mode and UI Theme Management
 * Provides comprehensive theming with light/dark mode support
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UITheme, ThemeContextValue } from '../types';

// Default light theme
const lightTheme: UITheme = {
  name: 'light',
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#212529',
    textSecondary: '#6c757d',
    border: '#dee2e6',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545'
  },
  fonts: {
    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    secondary: 'Georgia, "Times New Roman", serif',
    mono: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '3rem'
  }
};

// Dark theme
const darkTheme: UITheme = {
  name: 'dark',
  colors: {
    primary: '#4dabf7',
    secondary: '#adb5bd',
    background: '#121212',
    surface: '#1e1e1e',
    text: '#e9ecef',
    textSecondary: '#adb5bd',
    border: '#495057',
    success: '#51cf66',
    warning: '#ffd43b',
    error: '#ff6b6b'
  },
  fonts: {
    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    secondary: 'Georgia, "Times New Roman", serif',
    mono: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '3rem'
  }
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: 'light' | 'dark';
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light'
}) => {
  const [themeName, setThemeName] = useState<'light' | 'dark'>(defaultTheme);

  // Load saved theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('prescription-theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setThemeName(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeName(prefersDark ? 'dark' : 'light');
    }
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('prescription-theme')) {
        setThemeName(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply theme to document
  useEffect(() => {
    const theme = themeName === 'dark' ? darkTheme : lightTheme;
    const root = document.documentElement;
    
    // Apply CSS custom properties
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    Object.entries(theme.fonts).forEach(([key, value]) => {
      root.style.setProperty(`--font-${key}`, value);
    });
    
    Object.entries(theme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });

    // Apply theme class to body
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${themeName}`);
    
    // Save to localStorage
    localStorage.setItem('prescription-theme', themeName);
  }, [themeName]);

  const toggleTheme = () => {
    setThemeName(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeName(newTheme);
  };

  const contextValue: ThemeContextValue = {
    theme: themeName === 'dark' ? darkTheme : lightTheme,
    themeName,
    toggleTheme,
    setTheme
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme Toggle Component
interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = true
}) => {
  const { themeName, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle ${className}`}
      aria-label={`Switch to ${themeName === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${themeName === 'light' ? 'dark' : 'light'} mode`}
      type="button"
    >
      <span className="theme-icon" aria-hidden="true">
        {themeName === 'light' ? '🌙' : '☀️'}
      </span>
      {showLabel && (
        <span className="theme-label">
          {themeName === 'light' ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </button>
  );
};

export default ThemeProvider;